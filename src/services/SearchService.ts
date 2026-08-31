/**
 * การค้นหาพระโอวาท — ให้คะแนน, รวมฉบับซ้ำ, นับตัวเลือกฟิลเตอร์, แบ่งหน้า
 *
 * กฎทุกข้อยกมาจาก ver1 (api/_lib/search.js) โดยตั้งใจ เพื่อให้ผลค้นหา
 * ของสองเวอร์ชันตรงกัน ทีมจึงเทียบผลได้ว่าไม่มีอะไรหายไประหว่างย้ายระบบ
 */

import {
  expandQueryTerms,
  scorePassage,
  beYear,
  PAGE_SIZE,
  type FacetCounts,
  type FacetName,
  type SearchFilters,
} from '../domain/search.js'
import { toSnippetKey, type Teaching } from '../domain/teaching.js'
import {
  teachingRepository,
  type TeachingRepository,
  type TeachingWithPassages,
} from '../repositories/TeachingRepository.js'

/** หนึ่งรายการในผลค้นหา */
export interface SearchHit {
  teachingId: string
  deity: string | null
  temple: string | null
  province: string | null
  country: string
  date: string | null
  category: string | null
  passageIndex: number
  snippet: string
  matchedTerms: string[]
  score: number
  matchedField: 'passage' | 'deity' | 'temple'
}

export interface SearchResult {
  hits: SearchHit[]
  total: number
  facets: FacetCounts
  page: number
  pageSize: number
  totalPages: number
}

/** ฉบับหนึ่งพร้อมท่อนที่ถูกเลือกมาแสดง */
interface Match {
  teaching: Teaching
  passageIndex: number
  snippet: string
  score: number
  matched: string[]
  field: SearchHit['matchedField']
}

export interface SearchOptions {
  /**
   * รวมผลลัพธ์ที่ "ท่อนที่ยกมาแสดง" ตรงกันให้เหลือรายการเดียว
   *
   * ver1 ทำแบบนี้เสมอ แต่ในคลังจริงมี 182 กลุ่มที่ท่อนแรกเหมือนกัน
   * ทั้งที่เป็นพระโอวาทคนละฉบับ (มักเป็นคำขึ้นต้นแบบเดียวกัน)
   * เปิดไว้แล้วพระโอวาท 251 ฉบับหายจากรายการทั้งที่ไม่ได้ซ้ำจริง
   *
   * ver2 จึงปิดไว้ และกันซ้ำที่ระดับ "ฉบับ" แทน (ดูจากลายเซ็นเนื้อหาทั้งฉบับ
   * ตอนย้ายข้อมูล ตรวจสอบย้อนหลังได้ ผู้ดูแลยกเลิกเครื่องหมายได้)
   *
   * เปิดเป็น true เฉพาะตอนเทียบผลกับ ver1 (npm run check:search)
   */
  mergeIdenticalSnippets?: boolean
}

export class SearchService {
  constructor(
    private readonly teachings: TeachingRepository = teachingRepository,
    private readonly options: SearchOptions = {},
  ) {}

  private dedupe(matches: Match[]): Match[] {
    return this.options.mergeIdenticalSnippets ? mergeByVisibleText(matches) : matches
  }

  async search(query: string, filters: SearchFilters = {}, page = 1): Promise<SearchResult> {
    const raw = (query || '').trim()
    const matches = raw ? await this.matchQuery(raw) : await this.matchAll()
    const deduped = this.dedupe(matches)

    const facets = aggregateFacets(deduped, filters)
    const filtered = deduped.filter((m) => passesFilters(m, filters, null))
    sortByDateThenScore(filtered)

    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages)
    const start = (safePage - 1) * PAGE_SIZE

    return {
      hits: filtered.slice(start, start + PAGE_SIZE).map(toHit),
      total,
      facets,
      page: safePage,
      pageSize: PAGE_SIZE,
      totalPages,
    }
  }

  /** ตัวเลือกฟิลเตอร์อย่างเดียว — หน้าเว็บเรียกตอนเปิดหน้าค้นหา */
  async facets(query = '', filters: SearchFilters = {}): Promise<FacetCounts> {
    const raw = query.trim()
    const matches = raw ? await this.matchQuery(raw) : await this.matchAll()
    return aggregateFacets(this.dedupe(matches), filters)
  }

  // ── โหมดเปิดดูทั้งหมด (ยังไม่พิมพ์คำค้น) ──
  private async matchAll(): Promise<Match[]> {
    const rows = await this.teachings.listAllWithFirstPassage()
    return rows
      .filter((r) => r.passages.length > 0)
      .map((r) => ({
        teaching: r.teaching,
        passageIndex: r.passages[0].idx,
        snippet: r.passages[0].text,
        score: 0,
        matched: [],
        field: 'passage' as const,
      }))
  }

  // ── โหมดค้นหา ──
  private async matchQuery(raw: string): Promise<Match[]> {
    const rawLower = raw.toLowerCase()
    const terms = expandQueryTerms(raw)
    if (!terms.includes(rawLower)) terms.push(rawLower)

    // ท่อนที่ตรงคำค้นมาก่อน — เป็นผลลัพธ์ที่ตรงที่สุด
    const byPassage = await this.teachings.findByPassageText(terms)
    const matches: Match[] = []
    const seen = new Set<string>()

    for (const row of byPassage) {
      const best = bestPassage(row, terms, rawLower)
      if (!best) continue
      matches.push({ teaching: row.teaching, ...best, field: 'passage' })
      seen.add(row.teaching.id)
    }

    // ฉบับที่ตรงเฉพาะชื่อองค์/สถานธรรม ได้คะแนนต่ำกว่า และใช้ท่อนแรกเป็นตัวอย่าง
    const byMeta = await this.teachings.findByMetadata(terms)
    for (const row of byMeta) {
      if (seen.has(row.teaching.id) || row.passages.length === 0) continue
      const field = matchesDeity(row.teaching, terms) ? 'deity' : 'temple'
      matches.push({
        teaching: row.teaching,
        passageIndex: row.passages[0].idx,
        snippet: row.passages[0].text,
        score: field === 'deity' ? 0.5 : 0.4,
        matched:
          field === 'deity'
            ? [row.teaching.deity].filter((v): v is string => !!v)
            : [row.teaching.temple, row.teaching.province].filter((v): v is string => !!v),
        field,
      })
    }

    return matches
  }
}

// ── ฟังก์ชันช่วย ──

/**
 * ท่อนที่คะแนนสูงสุดของฉบับหนึ่ง (null = ไม่มีท่อนไหนตรงเลย)
 *
 * เลือกจากท่อนที่ "ยกมาแสดงเดี่ยวๆ ได้" ก่อนเสมอ ต่อให้ท่อนเศษสั้นๆ
 * จะได้คะแนนสูงกว่า เพราะยกเศษข้อความมาโชว์แล้วผู้อ่านไม่ได้ใจความ
 * ใช้ท่อนเศษก็ต่อเมื่อไม่มีท่อนที่แสดงได้ตรงคำค้นเลย (ดีกว่าหาไม่เจอ)
 */
function bestPassage(
  row: TeachingWithPassages,
  terms: string[],
  rawLower: string,
): Pick<Match, 'passageIndex' | 'snippet' | 'score' | 'matched'> | null {
  let best: Pick<Match, 'passageIndex' | 'snippet' | 'score' | 'matched'> | null = null
  let bestQuotable = false

  for (const p of row.passages) {
    const { score, matched } = scorePassage(p.text.toLowerCase(), terms, rawLower)
    if (score <= 0) continue
    const quotable = p.isQuotable !== false
    const better =
      best === null || (quotable && !bestQuotable) || (quotable === bestQuotable && score > best.score)
    if (better) {
      best = { passageIndex: p.idx, snippet: p.text, score, matched }
      bestQuotable = quotable
    }
  }
  return best
}

function matchesDeity(t: Teaching, terms: string[]): boolean {
  const deity = (t.deity || '').toLowerCase()
  return !!deity && terms.some((term) => deity.includes(term))
}

/**
 * รวมรายการที่ผู้อ่านเห็นเป็นข้อความเดียวกันให้เหลือรายการเดียว (กติกาของ ver1)
 * เก็บฉบับที่คะแนนสูงกว่าไว้
 *
 * ⚠️ ใช้เฉพาะตอนเทียบผลกับ ver1 — ดูเหตุผลที่ SearchOptions
 */
function mergeByVisibleText(matches: Match[]): Match[] {
  const byKey = new Map<string, Match>()
  const out: Match[] = []
  for (const m of matches) {
    const key = toSnippetKey(m.snippet) || m.teaching.id
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, m)
      out.push(m)
    } else if (m.score > prev.score) {
      out[out.indexOf(prev)] = m
      byKey.set(key, m)
    }
  }
  return out
}

/** ผ่านฟิลเตอร์ทุกมิติไหม (skip = มิติที่ยกเว้น ใช้ตอนนับตัวเลือกฟิลเตอร์) */
function passesFilters(m: Match, filters: SearchFilters, skip: FacetName | null): boolean {
  const t = m.teaching
  if (skip !== 'deity' && filters.deity && t.deity !== filters.deity) return false
  if (skip !== 'temple' && filters.temple && (t.temple || '') !== filters.temple) return false
  if (skip !== 'category' && filters.category && (t.category || '') !== filters.category) return false
  if (skip !== 'year' && filters.year && String(beYear(t.taughtOn)) !== String(filters.year)) {
    return false
  }
  return true
}

/**
 * นับตัวเลือกของแต่ละมิติ โดย "ข้ามฟิลเตอร์ของมิตินั้นเอง"
 *
 * ถ้านับโดยใช้ฟิลเตอร์ของตัวเองด้วย ผู้ใช้จะเลือกค่าอื่นในมิติเดิมไม่ได้เลย
 * เพราะทุกตัวเลือกที่ไม่ได้เลือกอยู่จะกลายเป็น 0
 */
function aggregateFacets(matches: Match[], filters: SearchFilters): FacetCounts {
  const count = (dim: FacetName, valueOf: (t: Teaching) => string): [string, number][] => {
    const counts = new Map<string, number>()
    for (const m of matches) {
      if (!passesFilters(m, filters, dim)) continue
      const v = valueOf(m.teaching)
      if (!v) continue
      counts.set(v, (counts.get(v) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }

  return {
    deity: count('deity', (t) => t.deity || ''),
    temple: count('temple', (t) => t.temple || ''),
    category: count('category', (t) => t.category || ''),
    year: count('year', (t) => {
      const y = beYear(t.taughtOn)
      return y ? String(y) : ''
    }).sort((a, b) => Number(b[0]) - Number(a[0])),
  }
}

/**
 * เรียงตามวันที่ ใหม่สุดขึ้นก่อน ฉบับที่ไม่ระบุวันที่อยู่ท้ายสุด
 * วันที่เท่ากันค่อยใช้คะแนนความตรงของคำค้นตัดสิน
 * (มติของทีมใน ver1 — ผู้ใช้อยากเห็นพระโอวาทล่าสุดก่อน)
 */
function sortByDateThenScore(matches: Match[]): void {
  matches.sort((a, b) => {
    const da = a.teaching.taughtOn || ''
    const db = b.teaching.taughtOn || ''
    if (da && !db) return -1
    if (!da && db) return 1
    if (da !== db) return db.localeCompare(da)
    return b.score - a.score
  })
}

function toHit(m: Match): SearchHit {
  return {
    teachingId: m.teaching.id,
    deity: m.teaching.deity,
    temple: m.teaching.temple,
    province: m.teaching.province,
    country: m.teaching.country,
    date: m.teaching.taughtOn,
    category: m.teaching.category,
    passageIndex: m.passageIndex,
    snippet: m.snippet,
    matchedTerms: m.matched,
    score: m.score,
    matchedField: m.field,
  }
}

export const searchService = new SearchService()
