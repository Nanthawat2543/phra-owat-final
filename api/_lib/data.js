// Loads the bundled พระโอวาท corpus (gzipped JSON copied from the original
// Supabase project) and builds the passage pools + search index once per
// process. Everything is cached in module scope, so warm serverless
// invocations and the Vite dev server reuse the same in-memory structures.

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { splitIntoParagraphs } from './passages.js'

function loadGz(relative) {
  const path = fileURLToPath(new URL(relative, import.meta.url))
  return JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'))
}

let _teachings = null
let _curated = null

/** Raw teaching records (array). Loaded + cached on first use. */
export function getTeachings() {
  if (!_teachings) _teachings = loadGz('../_data/teachings.json.gz')
  return _teachings
}

/** Raw curated records (array). */
export function getCurated() {
  if (!_curated) _curated = loadGz('../_data/curated.json.gz')
  return _curated
}

// ── ล้างข้อมูลสถานที่สกปรก (Bug #5) ──
// ข้อมูลในคลังบางฉบับมีค่า temple/province ปนเปื้อน: เวลา ("09.55", "– 10.16 น."),
// วันที่ ("วันเสาร์ที่ 22 เมษายน พ.ศ. 2549", "บุรีรัมย์วันอาทิตย์ที่"),
// หรือประโยคเนื้อหา ("ไฟกล่องมหึมาดับได้ด้วยอะไร")

const THAI_MONTHS =
  /มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม/
// คีย์เวิร์ดที่บ่งว่าเป็นชื่อสถานธรรมจริง (ยอมให้ยาวได้)
const TEMPLE_HINT = /ฝอเอวี้ยน|เอวี้ยน|พุทธสถาน|ธรรมสถาน|สถานธรรม|อาราม|ตำหนัก|วัด|ศูนย์/

function cleanPlaceValue(raw, { isProvince = false } = {}) {
  if (!raw) return null
  let s = String(raw).trim()

  // ตัดท่อนวันที่ที่ติดท้ายมา เช่น "บุรีรัมย์วันอาทิตย์ที่..." → "บุรีรัมย์"
  s = s.replace(/วัน(จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์|อาทิตย์)?ที่.*$/u, '').trim()
  // ตัดเครื่องหมายคั่นตกค้างหัว-ท้าย
  s = s.replace(/^[-–—·,\s]+|[-–—·,\s]+$/g, '').trim()
  if (!s) return null

  // คำขยะที่ไม่ใช่สถานที่ (หลุดมาจากการตัดข้อความต้นทาง)
  if (/^(วันนี้|วันนั้น|วันเดียวกัน)$/.test(s)) return null

  // ค่าที่เป็นเวลา/ตัวเลขล้วน เช่น "09.55", "10.16 น.", "11.13-11.43", "น."
  if (/^\d{1,2}[.:]\d{2}([-–]\d{1,2}[.:]\d{2})?$/.test(s)) return null
  if (/^น\.?$/.test(s) || /\d{1,2}[.:]\d{2}\s*น\.?$/.test(s)) return null
  if (/เวลา/.test(s)) return null

  // ยังมีคำบอกวันที่/ปีหลงเหลือ → ทั้งค่าเป็นวันที่ ไม่ใช่สถานที่
  if (THAI_MONTHS.test(s) || /พ\.ศ\.|พุทธศักราช/.test(s)) return null

  // ประโยคยาวที่ไม่ใช่ชื่อสถานที่ (ชื่อจังหวัดจริงยาวสุด ~15 ตัวอักษร —
  // ข้อยกเว้นคีย์เวิร์ดสถานธรรมใช้กับ temple เท่านั้น)
  if (isProvince) {
    if (s.length > 16) return null
  } else if (s.length > 32 && !TEMPLE_HINT.test(s)) {
    return null
  }

  return s
}

function metaFromTeaching(t) {
  return {
    deity_th: t.deity_th || '',
    location_th: t.location_th ?? null,
    temple_th: cleanPlaceValue(t.temple_th),
    province_th: cleanPlaceValue(t.province_th, { isProvince: true }),
    country: t.country ?? null,
    date: t.date ?? null,
    category: t.category ?? null,
    audio_approved: !!t.audio_approved,
  }
}

// ── Teaching lookup by id ──
let _byId = null
export function getTeachingById(id) {
  if (!_byId) _byId = new Map(getTeachings().map((t) => [t.id, t]))
  return _byId.get(id) || null
}

// ── General passage pool (flattened, every passage equal) ──
let _generalPool = null
export function getGeneralPool() {
  if (_generalPool) return _generalPool
  const pool = []
  for (const t of getTeachings()) {
    const paragraphs = splitIntoParagraphs(t.content_th || '')
    const meta = metaFromTeaching(t)
    paragraphs.forEach((text, index) => {
      pool.push({
        passageId: `${t.id}#${index}`,
        teachingId: t.id,
        index,
        text,
        curated: false,
        ...meta,
      })
    })
  }
  _generalPool = pool
  return pool
}

// ── Curated passage pool ──
let _curatedPool = null
export function getCuratedPool() {
  if (_curatedPool) return _curatedPool
  const byId = new Map(getTeachings().map((t) => [t.id, t]))
  const pool = []
  for (const c of getCurated()) {
    const src = byId.get(c.source_id)
    const meta = src
      ? metaFromTeaching(src)
      : {
          deity_th: c.deity || '',
          location_th: null,
          temple_th: null,
          province_th: null,
          country: null,
          date: null,
          category: c.category ?? null,
          audio_approved: !!c.audio_approved,
        }
    pool.push({
      passageId: `curated:${c.id}`,
      teachingId: c.source_id,
      index: 0,
      text: c.text,
      curated: true,
      ...meta,
    })
  }
  _curatedPool = pool
  return pool
}

// ── Search index (paragraphs split once, lowercased for matching) ──
let _searchIndex = null
export function getSearchIndex() {
  if (_searchIndex) return _searchIndex
  const index = []
  for (const t of getTeachings()) {
    const paragraphs = splitIntoParagraphs(t.content_th || '')
    const temple = cleanPlaceValue(t.temple_th)
    const province = cleanPlaceValue(t.province_th, { isProvince: true })
    index.push({
      id: t.id,
      deity: t.deity_th || '',
      temple,
      province,
      country: t.country ?? null,
      date: t.date ?? null,
      category: t.category ?? null,
      deityLower: (t.deity_th || '').toLowerCase(),
      templeLower: (temple || '').toLowerCase(),
      provinceLower: (province || '').toLowerCase(),
      locationLower: (t.location_th || '').toLowerCase(),
      paragraphs,
      paragraphsLower: paragraphs.map((p) => p.toLowerCase()),
    })
  }
  _searchIndex = index
  return index
}

// Non-overlapping occurrence count without allocating substrings.
export function countOccurrences(haystack, needle) {
  if (!needle) return 0
  let count = 0
  let i = haystack.indexOf(needle)
  while (i !== -1) {
    count++
    i = haystack.indexOf(needle, i + needle.length)
  }
  return count
}
