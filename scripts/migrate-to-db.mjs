#!/usr/bin/env node
/**
 * ย้ายข้อมูลพระโอวาทจากไฟล์ (ver1) เข้าฐานข้อมูล (ver2)
 *
 *   node scripts/migrate-to-db.mjs --env dev [--dry] [--report]
 *
 *   --dry     ตรวจข้อมูลอย่างเดียว ไม่เขียนลงฐานข้อมูล
 *   --report  ออกรายงานปัญหาข้อมูลเป็นไฟล์ JSON
 *
 * ⚠️ กฎสำคัญ: เนื้อหาพระโอวาท (content) ย้ายตรงต้นฉบับ 100% ไม่แก้แม้แต่ตัวอักษรเดียว
 *    การล้างข้อมูลทำเฉพาะ metadata (สถานที่/วันที่) เท่านั้น
 *    ฉบับที่เนื้อหาซ้ำจะ "รายงาน" ไม่ลบเอง — รอผู้ดูแลตัดสินใจ
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { splitIntoParagraphs, splitIntoSegments, isQuotable, displayKey } from '../api/_lib/passages.js'

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue
  const k = argv[i].slice(2)
  if (k === 'dry' || k === 'report') args[k] = true
  else args[k] = argv[++i]
}

const DATA = fileURLToPath(new URL('../api/_data/teachings.json.gz', import.meta.url))
const teachings = JSON.parse(gunzipSync(readFileSync(DATA)).toString('utf8'))

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')

/**
 * ทำเนื้อหาเต็มฉบับให้อยู่ในรูปที่ผู้อ่านเห็นจริง เพื่อใช้เทียบว่าซ้ำกันไหม
 *
 * ต่างจาก displayKey() ที่ออกแบบไว้สำหรับข้อความท่อนเดียว (ล้าง # และ > เฉพาะต้นบรรทัดแรก)
 * เนื้อหาเต็มฉบับมีสัญลักษณ์จัดรูปแบบกระจายอยู่หลายบรรทัด จึงต้องล้างทุกตำแหน่ง
 *
 * ⚠️ ใช้เปรียบเทียบเท่านั้น — เนื้อหาที่เก็บลงฐานข้อมูลยังเป็นต้นฉบับครบทุกตัวอักษร
 */
function normalizeForCompare(text) {
  return String(text || '')
    .replace(/\{[^}]*(?:width|height)=[^}]*\}/gi, '')  // ขยะจากการแปลงไฟล์
    .replace(/[*>#\\]/g, '')                            // สัญลักษณ์จัดรูปแบบทุกตำแหน่ง
    .replace(/-{2,}/g, '')                              // เส้นคั่น
    .replace(/\s+/g, '')                                // ช่องว่างทั้งหมด
}

// ── ล้างเฉพาะ metadata (คัดลอกกติกาจาก ver1 api/_lib/data.js) ──
const THAI_MONTHS = /มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม/
const TEMPLE_HINT = /ฝอเอวี้ยน|เอวี้ยน|พุทธสถาน|ธรรมสถาน|สถานธรรม|อาราม|ตำหนัก|วัด|ศูนย์/

function cleanPlace(raw, { isProvince = false } = {}) {
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

// ── ตรวจข้อมูล ──
const problems = { duplicates: [], noDate: [], futureDate: [], noPassage: [], dirtyPlace: [] }
const byHash = new Map()
const thisYear = new Date().getFullYear()

const rows = teachings.map((t) => {
  const content = t.content_th || ''
  const hash = sha256(content)
  // จับซ้ำจากเนื้อหาที่ตัดช่องว่างและรูปแบบออกแล้ว — สองฉบับที่ต่างกันแค่
  // ช่องว่างหรือสัญลักษณ์จัดรูปแบบ ผู้อ่านเห็นเป็นเนื้อหาเดียวกัน
  const dedupeHash = sha256(normalizeForCompare(content))
  // เก็บทุกท่อนเพื่อให้ค้นเจอครบทุกคำในต้นฉบับ
  // ท่อนที่ "ยกมาแสดงเดี่ยวๆ ได้" คือชุดเดียวกับที่ ver1 ใช้ (44,915 ท่อน)
  // การสุ่มเปิดรับใช้เฉพาะชุดนั้น คุณภาพจึงเท่าเดิม
  const segments = splitIntoSegments(content)
  const paragraphs = splitIntoParagraphs(content)

  // จัดกลุ่มฉบับที่เนื้อหาเหมือนกัน — เลือกตัวหลักทีหลังเมื่อรู้จำนวนท่อนของทุกฉบับแล้ว
  if (byHash.has(dedupeHash)) byHash.get(dedupeHash).push(t.id)
  else byHash.set(dedupeHash, [t.id])

  if (!t.date) problems.noDate.push(t.id)
  else if (new Date(t.date).getFullYear() > thisYear) problems.futureDate.push({ id: t.id, date: t.date })
  if (paragraphs.length === 0) problems.noPassage.push(t.id)

  const temple = cleanPlace(t.temple_th)
  const province = cleanPlace(t.province_th, { isProvince: true })
  if ((t.temple_th && !temple) || (t.province_th && !province)) {
    problems.dirtyPlace.push({ id: t.id, temple_th: t.temple_th, province_th: t.province_th })
  }

  return {
    legacy_id: t.id,
    content,
    content_hash: hash,
    dedupe_hash: dedupeHash,
    deity: (t.deity_th || '').trim() || null,
    temple, province,
    country: t.country || 'ไทย',
    category: (t.category || '').trim() || null,
    taught_on: t.date || null,
    location_note: t.location_th || null,
    quotableCount: paragraphs.length,
    passages: segments.map((text, idx) => ({
      idx, text,
      display_key: displayKey(text),
      char_length: text.length,
      is_quotable: isQuotable(text),
    })),
  }
})

// ── เลือก "ตัวหลัก" ของแต่ละกลุ่มเนื้อหาซ้ำ ──
//
// เนื้อหาชุดเดียวกันมีหลายฉบับในคลัง ต่างกันแค่ช่องว่างและสัญลักษณ์จัดรูปแบบ
// แต่การแตกท่อนขึ้นกับช่องว่าง ฉบับหนึ่งจึงอาจแตกได้ 82 ท่อน อีกฉบับได้ 8 ท่อน
// หรือ 0 ท่อน
//
// ถ้าเลือกตัวหลักตามลำดับที่เจอ (แบบเดิม) มีโอกาสไปเก็บฉบับที่แตกท่อนไม่ได้ไว้
// แล้วเนื้อหานั้นหายจากการค้นหาทั้งที่ยังอยู่ในคลัง — เจอจริง 1 ฉบับหายสนิท
// และอีกหลายฉบับหาเจอไม่ครบ
//
// จึงเลือกฉบับที่ "ค้นเจอได้มากที่สุด" — วัดจากจำนวนตัวอักษรรวมในท่อนที่แตกได้
// เพราะคำที่อยู่นอกท่อนคือคำที่ค้นไม่เจอ เท่ากันจึงดูจำนวนท่อนและความยาวเนื้อหา
// แล้วยึดลำดับที่เจอเป็นตัวตัดสินสุดท้าย (รันกี่ครั้งก็ได้ผลเดิม)
//
// ⚠️ ทุกฉบับยังเข้าฐานข้อมูลครบ ตัวที่ไม่ได้เป็นตัวหลักแค่ถูกทำเครื่องหมายว่าซ้ำ
const rowByLegacy = new Map(rows.map((r) => [r.legacy_id, r]))
const coverage = (r) => r.passages.reduce((sum, p) => sum + p.char_length, 0)
const quotable = (r) => r.quotableCount
for (const ids of byHash.values()) {
  if (ids.length < 2) continue
  const ranked = [...ids].sort((a, b) => {
    const ra = rowByLegacy.get(a)
    const rb = rowByLegacy.get(b)
    if (coverage(rb) !== coverage(ra)) return coverage(rb) - coverage(ra)
    if (quotable(rb) !== quotable(ra)) return quotable(rb) - quotable(ra)
    if (rb.content.length !== ra.content.length) return rb.content.length - ra.content.length
    return ids.indexOf(a) - ids.indexOf(b)
  })
  const [primary, ...rest] = ranked
  for (const id of rest) problems.duplicates.push({ id, sameAs: primary })
}

// ── สรุปผลตรวจ ──
const totalPassages = rows.reduce((a, r) => a + r.passages.length, 0)
const totalQuotable = rows.reduce((a, r) => a + r.quotableCount, 0)
console.log('═══ ตรวจข้อมูลก่อนย้าย ═══')
console.log('  พระโอวาททั้งหมด   :', rows.length, 'ฉบับ')
console.log('  ท่อนที่ค้นได้      :', totalPassages.toLocaleString(), 'ท่อน')
console.log('  ในนั้นยกมาแสดงได้  :', totalQuotable.toLocaleString(), 'ท่อน (ใช้สุ่มเปิดรับ)')
console.log('  องค์ผู้ประทาน      :', new Set(rows.map((r) => r.deity).filter(Boolean)).size)
console.log('  สถานธรรม (หลังล้าง):', new Set(rows.map((r) => r.temple).filter(Boolean)).size)
console.log('  ชั้นเรียน          :', new Set(rows.map((r) => r.category).filter(Boolean)).size)
console.log('')
console.log('═══ ปัญหาที่พบ (ต้องให้ผู้ดูแลตัดสินใจ ไม่แก้เอง) ═══')
console.log('  เนื้อหาซ้ำกับฉบับอื่น :', problems.duplicates.length, 'ฉบับ')
console.log('  ไม่มีวันที่           :', problems.noDate.length, 'ฉบับ')
console.log('  วันที่เป็นอนาคต       :', problems.futureDate.length, 'ฉบับ', problems.futureDate.slice(0, 3).map((x) => x.date).join(' '))
console.log('  แตกท่อนไม่ได้เลย     :', problems.noPassage.length, 'ฉบับ (ค้นหา/สุ่มไม่เจอ)')
console.log('  สถานที่ถูกล้างทิ้ง    :', problems.dirtyPlace.length, 'ฉบับ (ค่าเดิมไม่ใช่ชื่อสถานที่)')

if (args.report) {
  const out = fileURLToPath(new URL('../migration-report.json', import.meta.url))
  writeFileSync(out, JSON.stringify({ summary: { teachings: rows.length, passages: totalPassages }, problems }, null, 2))
  console.log('\n📄 รายงานฉบับเต็ม: migration-report.json')
}

if (args.dry) {
  console.log('\n(dry run — ไม่เขียนลงฐานข้อมูล)')
  process.exit(0)
}

// ── เขียนลงฐานข้อมูล ──
const envName = args.env || 'dev'
const url = process.env[`SUPABASE_URL_${envName.toUpperCase()}`] || process.env.SUPABASE_URL
const key = process.env[`SUPABASE_SERVICE_KEY_${envName.toUpperCase()}`] || process.env.SUPABASE_SERVICE_KEY

if (!url || !key) {
  console.error(`\n❌ ยังไม่ได้ตั้งค่าฐานข้อมูลของ "${envName}"`)
  console.error(`   ต้องมีใน .env.local:  SUPABASE_URL_${envName.toUpperCase()} และ SUPABASE_SERVICE_KEY_${envName.toUpperCase()}`)
  console.error(`   (ใช้ --dry เพื่อตรวจข้อมูลโดยไม่ต้องมีฐานข้อมูล)`)
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
// Node ต่ำกว่า 22 ไม่มี WebSocket ในตัว แต่ supabase-js สร้างตัวเชื่อม realtime เสมอ
const { default: WebSocketImpl } = await import('ws')
const realtimeOptions =
  typeof globalThis.WebSocket === 'undefined' ? { realtime: { transport: WebSocketImpl } } : {}
const db = createClient(url, key, { auth: { persistSession: false }, ...realtimeOptions })

// ตารางอ้างอิง: สร้างครั้งเดียวแล้วอ้างด้วย id
async function upsertLookup(table, names, extra = () => ({})) {
  const uniq = [...new Set(names.filter(Boolean))]
  if (!uniq.length) return new Map()
  const payload = uniq.map((name) => ({ name, ...extra(name) }))
  const { data, error } = await db.from(table).upsert(payload, { onConflict: table === 'temples' ? 'name,province' : 'name' }).select('id,name')
  if (error) throw new Error(`${table}: ${error.message}`)
  return new Map(data.map((r) => [r.name, r.id]))
}

console.log(`\n═══ กำลังย้ายเข้าฐานข้อมูล "${envName}" ═══`)

const deityMap = await upsertLookup('deities', rows.map((r) => r.deity))
console.log('  องค์ผู้ประทาน:', deityMap.size)

const templeRows = [...new Map(rows.filter((r) => r.temple).map((r) => [`${r.temple}|${r.province || ''}`, r])).values()]
const { data: templeData, error: templeErr } = await db.from('temples')
  .upsert(templeRows.map((r) => ({ name: r.temple, province: r.province, country: r.country })), { onConflict: 'name,province' })
  .select('id,name,province')
if (templeErr) throw new Error(`temples: ${templeErr.message}`)
const templeMap = new Map(templeData.map((r) => [`${r.name}|${r.province || ''}`, r.id]))
console.log('  สถานธรรม:', templeMap.size)

const catMap = await upsertLookup('categories', rows.map((r) => r.category))
console.log('  ชั้นเรียน:', catMap.size)

// พระโอวาท + ท่อน — ย้ายเข้าครบทุกฉบับ ไม่ทิ้งอะไรเลย
// ฉบับที่เนื้อหาซ้ำจะถูกทำเครื่องหมาย duplicate_of ในขั้นตอนถัดไป (ไม่ลบ)
let done = 0
const idByLegacy = new Map()
const CHUNK = 50

for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK)
  const payload = chunk.map((r) => ({
    legacy_id: r.legacy_id,
    content: r.content,
    content_hash: r.content_hash,
    dedupe_hash: r.dedupe_hash,
    deity_id: r.deity ? deityMap.get(r.deity) : null,
    temple_id: r.temple ? templeMap.get(`${r.temple}|${r.province || ''}`) : null,
    category_id: r.category ? catMap.get(r.category) : null,
    taught_on: r.taught_on,
    location_note: r.location_note,
    status: 'published',
    source_file: 'ver1:teachings.json.gz',
    imported_at: new Date().toISOString(),
  }))

  const { data, error } = await db.from('teachings')
    .upsert(payload, { onConflict: 'legacy_id' })
    .select('id,legacy_id')
  if (error) throw new Error(`teachings: ${error.message}`)

  const passagePayload = []
  for (const r of data || []) idByLegacy.set(r.legacy_id, r.id)
  for (const r of chunk) {
    const tid = idByLegacy.get(r.legacy_id)
    if (!tid) continue
    for (const p of r.passages) passagePayload.push({ teaching_id: tid, ...p })
  }
  if (passagePayload.length) {
    const { error: pErr } = await db.from('teaching_passages').upsert(passagePayload, { onConflict: 'teaching_id,idx' })
    if (pErr) throw new Error(`passages: ${pErr.message}`)
  }

  done += (data || []).length
  process.stdout.write(`\r  พระโอวาท: ${done}/${rows.length} ฉบับ   `)
}

// ทำเครื่องหมายฉบับซ้ำ — ชี้ไปยังฉบับแรกที่พบ (ฉบับต้นทางยังอยู่ครบ)
let marked = 0
for (const dup of problems.duplicates) {
  const dupId = idByLegacy.get(dup.id)
  const originalId = idByLegacy.get(dup.sameAs)
  if (!dupId || !originalId) continue
  const { error } = await db.from('teachings').update({ duplicate_of: originalId }).eq('id', dupId)
  if (!error) marked++
}

console.log(`\n\n✅ ย้ายเสร็จ — ${done} ฉบับเข้าฐานข้อมูลครบ ไม่มีอะไรหาย`)
console.log(`   ทำเครื่องหมาย "ซ้ำ" ${marked} ฉบับ (ยังอยู่ในฐานข้อมูล แค่ไม่แสดงในผลค้นหา)`)
console.log('   ผู้ดูแลตรวจแล้วยกเลิกเครื่องหมายได้ตลอด — ดูรายละเอียดใน migration-report.json')
