/**
 * เทียบผลค้นหาของ ver1 กับ ver2 ด้วยคำค้นเดียวกัน
 *
 *   npm run check:search
 *
 * ทำไมต้องมี: ver2 เขียนชั้นค้นหาใหม่ทั้งหมด ถ้าผลลัพธ์ต่างจาก ver1
 * แปลว่ามีพระโอวาทบางฉบับหายไปหรือเรียงผิด ต้องรู้ก่อนขึ้นระบบ
 *
 * วิธีทดสอบ: ป้อนข้อมูลชุดเดียวกัน (ไฟล์ของ ver1) ให้ทั้งสองเวอร์ชัน
 * โดยสวมฐานข้อมูลปลอมให้ ver2 — จึงเทียบได้โดยยังไม่ต้องมี Supabase
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'

// @ts-expect-error — โมดูลของ ver1 เป็น JavaScript ล้วน ไม่มีไฟล์ประกาศชนิด
import { runSearch } from '../api/_lib/search.js'
// @ts-expect-error — เช่นเดียวกัน
import { splitIntoParagraphs } from '../api/_lib/passages.js'

import { SearchService } from '../src/services/SearchService'
import type { TeachingRepository, TeachingWithPassages } from '../src/repositories/TeachingRepository'
import type { Teaching } from '../src/domain/teaching'

interface LegacyTeaching {
  id: string
  content_th?: string
  deity_th?: string
  temple_th?: string | null
  province_th?: string | null
  location_th?: string | null
  country?: string | null
  date?: string | null
  category?: string | null
}

// ── ข้อมูลชุดเดียวกับที่ ver1 ใช้ ──
// อ้างจากรากโปรเจกต์ เพราะสคริปต์ถูกรวมไฟล์ก่อนรัน ตำแหน่งไฟล์จริงจึงย้ายที่
const dataPath = resolve(process.cwd(), 'api/_data/teachings.json.gz')
const legacy: LegacyTeaching[] = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf8'))

// ver1 ล้างค่าสถานที่ตอนรัน — ver2 ล้างตอนย้ายข้อมูล ที่นี่จึงต้องล้างให้เหมือนกัน
// (คัดลอกกติกามาจาก api/_lib/data.js เพื่อให้จุดตั้งต้นของสองเวอร์ชันเท่ากันจริง)
const THAI_MONTHS =
  /มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม/
const TEMPLE_HINT = /ฝอเอวี้ยน|เอวี้ยน|พุทธสถาน|ธรรมสถาน|สถานธรรม|อาราม|ตำหนัก|วัด|ศูนย์/

function cleanPlace(raw: string | null | undefined, isProvince = false): string | null {
  if (!raw) return null
  let s = String(raw).trim()
  s = s.replace(/วัน(จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์|อาทิตย์)?ที่.*$/u, '').trim()
  s = s.replace(/^[-–—·,\s]+|[-–—·,\s]+$/g, '').trim()
  if (!s) return null
  if (/^(วันนี้|วันนั้น|วันเดียวกัน)$/.test(s)) return null
  if (/^\d{1,2}[.:]\d{2}([-–]\d{1,2}[.:]\d{2})?$/.test(s)) return null
  if (/^น\.?$/.test(s) || /\d{1,2}[.:]\d{2}\s*น\.?$/.test(s) || /เวลา/.test(s)) return null
  if (THAI_MONTHS.test(s) || /พ\.ศ\.|พุทธศักราช/.test(s)) return null
  if (isProvince ? s.length > 16 : s.length > 32 && !TEMPLE_HINT.test(s)) return null
  return s
}

/** พระโอวาทหนึ่งฉบับในรูปแบบที่ ver2 ใช้ พร้อมท่อนที่แตกไว้แล้ว */
const corpus: TeachingWithPassages[] = legacy.map((t) => {
  const teaching: Teaching = {
    id: t.id,
    legacyId: t.id,
    content: t.content_th || '',
    deity: t.deity_th || null,
    temple: cleanPlace(t.temple_th),
    province: cleanPlace(t.province_th, true),
    country: t.country || 'ไทย',
    category: t.category ?? null,
    taughtOn: t.date ?? null,
    locationNote: t.location_th ?? null,
    status: 'published',
    isDuplicate: false,
  }
  const passages = (splitIntoParagraphs(t.content_th || '') as string[]).map(
    (text: string, idx: number) => ({ idx, text }),
  )
  return { teaching, passages }
})

// ── ฐานข้อมูลปลอม: ตอบคำถามเดียวกับของจริง แต่อ่านจากหน่วยความจำ ──
const fakeRepository = {
  async listAllWithFirstPassage() {
    return corpus
      .filter((r) => r.passages.length > 0)
      .map((r) => ({ teaching: r.teaching, passages: r.passages.slice(0, 1) }))
  },

  async findByPassageText(terms: string[]) {
    const lowered = terms.map((t) => t.toLowerCase())
    const out: TeachingWithPassages[] = []
    for (const row of corpus) {
      const hits = row.passages.filter((p) => {
        const text = p.text.toLowerCase()
        return lowered.some((term) => term && text.includes(term))
      })
      if (hits.length) out.push({ teaching: row.teaching, passages: hits })
    }
    return out
  },

  async findByMetadata(terms: string[]) {
    const lowered = terms.map((t) => t.toLowerCase())
    return (await this.listAllWithFirstPassage()).filter(({ teaching: t }) =>
      [t.deity, t.temple, t.province, t.locationNote]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .some((h) => lowered.some((term) => term && h.includes(term))),
    )
  },
} as unknown as TeachingRepository

// ── เทียบผล ──
const QUERIES = ['เมตตา', 'ปัญญา', 'กำลังใจ', 'ครอบครัว', 'บำเพ็ญ', 'อภัย', '']
const service = new SearchService(fakeRepository)

let failed = 0

for (const q of QUERIES) {
  const label = q || '(เปิดดูทั้งหมด)'
  const v1 = runSearch(q, {}, 1)
  const v2 = await service.search(q, {}, 1)

  const problems: string[] = []
  if (v1.total !== v2.total) problems.push(`จำนวนผลรวม ver1=${v1.total} ver2=${v2.total}`)

  const ids1 = v1.hits.map((h: { teachingId: string }) => h.teachingId)
  const ids2 = v2.hits.map((h) => h.teachingId)
  const sameOrder = ids1.length === ids2.length && ids1.every((id: string, i: number) => id === ids2[i])
  if (!sameOrder) {
    const missing = ids1.filter((id: string) => !ids2.includes(id))
    const extra = ids2.filter((id) => !ids1.includes(id))
    problems.push(
      `ลำดับหน้าแรกต่างกัน (หายไป ${missing.length} เกินมา ${extra.length})` +
        (missing.length ? `\n      หายไป: ${missing.slice(0, 3).join(', ')}` : ''),
    )
  }

  for (const dim of ['deity', 'temple', 'category', 'year'] as const) {
    const a = v1.facets[dim].length
    const b = v2.facets[dim].length
    if (a !== b) problems.push(`ตัวเลือกฟิลเตอร์ ${dim}: ver1=${a} ver2=${b}`)
  }

  if (problems.length) {
    failed++
    console.log(`\n✗ "${label}"`)
    for (const p of problems) console.log(`    ${p}`)
  } else {
    console.log(`✓ "${label}" — ${v1.total} ผล ตรงกันทุกรายการ`)
  }
}

console.log(
  failed === 0
    ? `\n✅ ผลค้นหาของ ver2 ตรงกับ ver1 ครบทั้ง ${QUERIES.length} คำค้น`
    : `\n❌ ต่างกัน ${failed} จาก ${QUERIES.length} คำค้น`,
)
process.exit(failed === 0 ? 0 : 1)
