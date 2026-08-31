/**
 * ที่เดียวที่อ่าน/เขียนตารางพระโอวาท
 *
 * ชั้น service เรียกที่นี่เท่านั้น ห้ามเรียก db() ตรงจากชั้นบน
 * ประโยชน์: เปลี่ยนวิธีเก็บข้อมูลภายหลังก็แก้แค่ไฟล์นี้ไฟล์เดียว
 */

import { db } from '../shared/db.js'
import { AppError } from '../shared/result.js'
import type { Teaching, Passage } from '../domain/teaching.js'
import { fetchAllRows } from './paginate.js'

/** พระโอวาทหนึ่งฉบับพร้อมท่อนที่เกี่ยวข้องกับคำค้น */
export interface TeachingWithPassages {
  teaching: Teaching
  passages: Pick<Passage, 'idx' | 'text' | 'isQuotable'>[]
}

// รูปแบบแถวดิบที่ Supabase คืนมา (join ตารางอ้างอิงแล้ว)
interface TeachingRow {
  id: string
  legacy_id: string | null
  content?: string
  taught_on: string | null
  location_note: string | null
  status: Teaching['status']
  duplicate_of: string | null
  deities: { name: string } | null
  temples: { name: string; province: string | null; country: string } | null
  categories: { name: string } | null
}

const TEACHING_FIELDS = `
  id, legacy_id, taught_on, location_note, status, duplicate_of,
  deities ( name ),
  temples ( name, province, country ),
  categories ( name )
`

function toTeaching(row: TeachingRow): Teaching {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    content: row.content ?? '',
    deity: row.deities?.name ?? null,
    temple: row.temples?.name ?? null,
    province: row.temples?.province ?? null,
    country: row.temples?.country ?? 'ไทย',
    category: row.categories?.name ?? null,
    taughtOn: row.taught_on,
    locationNote: row.location_note,
    status: row.status,
    isDuplicate: row.duplicate_of !== null,
  }
}

/**
 * PostgREST ใช้เครื่องหมายพวกนี้เป็นไวยากรณ์ของตัวกรอง
 * ถ้าผู้ใช้พิมพ์มาตรงๆ ต้องหนีให้หมด ไม่งั้นค้นแล้วพัง
 */
function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[(),"]/g, ' ')
}

export class TeachingRepository {
  // แคชรายการฉบับทั้งหมด — การค้นหนึ่งครั้งเรียกซ้ำหลายรอบ และรายการนี้
  // ต้องไล่ดึงหลายหน้า มีอายุจำกัดเพื่อให้ฉบับที่เพิ่มใหม่ขึ้นเองภายในไม่กี่นาที
  private activeCache: { at: number; rows: Promise<TeachingWithPassages[]> } | null = null
  private static readonly CACHE_TTL_MS = 5 * 60_000

  /**
   * ฉบับที่ "ยังใช้งานอยู่" ทั้งหมด พร้อมท่อนแรกของแต่ละฉบับ
   * ใช้ตอนเปิดหน้าค้นหาโดยยังไม่พิมพ์อะไร (โหมดเปิดดูทั้งหมด)
   */
  async listAllWithFirstPassage(): Promise<TeachingWithPassages[]> {
    const fresh =
      this.activeCache && Date.now() - this.activeCache.at < TeachingRepository.CACHE_TTL_MS
    if (fresh && this.activeCache) return this.activeCache.rows

    const rows = this.loadAllWithFirstPassage()
    this.activeCache = { at: Date.now(), rows }
    // ดึงไม่สำเร็จอย่าค้างแคชไว้ ไม่งั้นพังยาว 5 นาที
    rows.catch(() => {
      this.activeCache = null
    })
    return rows
  }

  private async loadAllWithFirstPassage(): Promise<TeachingWithPassages[]> {
    // เอาท่อนแรกที่ "ยกมาแสดงเดี่ยวๆ ได้" ไม่ใช่ท่อนที่ idx เป็น 0
    // เพราะท่อนแรกสุดของหลายฉบับเป็นเศษข้อความสั้นๆ อ่านแล้วไม่ได้ใจความ
    const rows = await fetchAllRows<
      TeachingRow & { teaching_passages: { idx: number; text: string; is_quotable: boolean }[] }
    >((from, to) =>
      db()
        .from('teachings')
        .select(`${TEACHING_FIELDS}, teaching_passages ( idx, text, is_quotable )`)
        .is('duplicate_of', null)
        .eq('status', 'published')
        .eq('teaching_passages.is_quotable', true)
        .order('idx', { referencedTable: 'teaching_passages', ascending: true })
        .limit(1, { referencedTable: 'teaching_passages' })
        .order('id', { ascending: true })
        .range(from, to) as never,
    ).catch((e: Error) => {
      throw new AppError('INTERNAL_ERROR', 'อ่านรายการพระโอวาทไม่สำเร็จ', e.message)
    })

    return rows.map((r) => ({
      teaching: toTeaching(r),
      passages: (r.teaching_passages ?? []).map((p) => ({
        idx: p.idx,
        text: p.text,
        isQuotable: p.is_quotable,
      })),
    }))
  }

  /**
   * ฉบับที่มีท่อนตรงกับคำค้น พร้อมเฉพาะท่อนที่ตรง
   *
   * กรองหยาบที่ฐานข้อมูลก่อน (ILIKE บน index trgm) แล้วให้ชั้น service
   * ให้คะแนนละเอียดต่อ — แบ่งงานแบบนี้ทำให้ผลลัพธ์ตรงกับ ver1 เป๊ะ
   *
   * ดึงเฉพาะข้อความท่อนก่อน แล้วค่อยดึงข้อมูลฉบับของ id ที่ได้
   * (คำค้นยอดนิยมตรงหลายพันท่อน ถ้าพ่วงข้อมูลฉบับไปทุกแถวจะโหลดซ้ำมหาศาล)
   */
  async findByPassageText(terms: string[]): Promise<TeachingWithPassages[]> {
    if (terms.length === 0) return []
    const orFilter = terms.map((t) => `text.ilike.%${escapeLike(t)}%`).join(',')

    const passageRows = await fetchAllRows<{
      teaching_id: string
      idx: number
      text: string
      is_quotable: boolean
    }>((from, to) =>
      db()
        .from('teaching_passages')
        .select('teaching_id, idx, text, is_quotable, teachings!inner ( id )')
        .or(orFilter)
        .is('teachings.duplicate_of', null)
        .eq('teachings.status', 'published')
        .order('teaching_id', { ascending: true })
        .order('idx', { ascending: true })
        .range(from, to) as never,
    ).catch((e: Error) => {
      throw new AppError('INTERNAL_ERROR', 'ค้นหาพระโอวาทไม่สำเร็จ', e.message)
    })

    if (passageRows.length === 0) return []

    const byTeaching = new Map<string, Pick<Passage, 'idx' | 'text' | 'isQuotable'>[]>()
    for (const row of passageRows) {
      const p = { idx: row.idx, text: row.text, isQuotable: row.is_quotable }
      const list = byTeaching.get(row.teaching_id)
      if (list) list.push(p)
      else byTeaching.set(row.teaching_id, [p])
    }

    // ข้อมูลฉบับเอาจากรายการที่แคชไว้ ไม่ยิงถามซ้ำ
    // (เคยยิง .in() ด้วย id หลายร้อยตัวแล้ว URL ยาวเกินที่เซิร์ฟเวอร์รับได้)
    const all = await this.listAllWithFirstPassage()
    const out: TeachingWithPassages[] = []
    for (const row of all) {
      const passages = byTeaching.get(row.teaching.id)
      if (passages) out.push({ teaching: row.teaching, passages })
    }
    return out
  }

  /**
   * ฉบับที่ชื่อองค์ผู้ประทาน / สถานธรรม / จังหวัด / ข้อความสถานที่ดิบ ตรงกับคำค้น
   * (ver1 ให้ผลกลุ่มนี้คะแนนต่ำกว่าท่อนที่ตรง และใช้ท่อนแรกเป็นตัวอย่าง)
   */
  async findByMetadata(terms: string[]): Promise<TeachingWithPassages[]> {
    if (terms.length === 0) return []
    const all = await this.listAllWithFirstPassage()
    const lowered = terms.map((t) => t.toLowerCase())
    return all.filter(({ teaching: t }) => {
      // รวม location_note ด้วย เพราะบางฉบับจับคู่กับตารางสถานธรรมไม่ได้
      // ชื่อสถานที่จึงอยู่ในข้อความดิบก้อนนี้ก้อนเดียว
      const haystacks = [t.deity, t.temple, t.province, t.locationNote]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
      return haystacks.some((h) => lowered.some((term) => h.includes(term)))
    })
  }

  /** เนื้อหาเต็มของฉบับหนึ่ง — เนื้อหาต้นฉบับ ไม่ผ่านการแก้ไขใดๆ */
  async findById(id: string): Promise<Teaching | null> {
    const { data, error } = await db()
      .from('teachings')
      .select(`${TEACHING_FIELDS}, content`)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านพระโอวาทไม่สำเร็จ', error.message)
    return data ? toTeaching(data as unknown as TeachingRow) : null
  }

  /** ค้นด้วย id เดิมจาก ver1 — ให้ลิงก์เก่าที่ทีมส่งต่อกันไว้ยังเปิดได้ */
  async findByLegacyId(legacyId: string): Promise<Teaching | null> {
    const { data, error } = await db()
      .from('teachings')
      .select(`${TEACHING_FIELDS}, content`)
      .eq('legacy_id', legacyId)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านพระโอวาทไม่สำเร็จ', error.message)
    return data ? toTeaching(data as unknown as TeachingRow) : null
  }

  /** จำนวนฉบับที่ใช้งานอยู่ — ใช้ตรวจว่าย้ายข้อมูลครบไหม */
  async countActive(): Promise<number> {
    const { count, error } = await db()
      .from('teachings')
      .select('id', { count: 'exact', head: true })
      .is('duplicate_of', null)
      .eq('status', 'published')
    if (error) throw new AppError('INTERNAL_ERROR', 'นับจำนวนพระโอวาทไม่สำเร็จ', error.message)
    return count ?? 0
  }
}

export const teachingRepository = new TeachingRepository()
