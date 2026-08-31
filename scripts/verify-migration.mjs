#!/usr/bin/env node
/**
 * ตรวจว่าย้ายข้อมูลเข้า ver2 แล้วไม่มีพระโอวาทหายไป
 *
 *   node scripts/verify-migration.mjs [--api http://localhost:5183] [--env dev]
 *
 * ver2 คืนผลค้นหาน้อยกว่า ver1 โดยตั้งใจ เพราะกรองฉบับที่เนื้อหาซ้ำออก
 *
 * ⚠️ ห้ามเทียบด้วย id ของฉบับ
 *    เนื้อหาชุดเดียวกันมีอยู่หลายฉบับในคลัง (ตั้งชื่อไฟล์คนละแบบ)
 *    ver1 กับ ver2 เลือก "ตัวแทน" คนละฉบับได้ ทั้งที่ผู้อ่านเห็นข้อความเดียวกัน
 *    เทียบด้วย id จะรายงานว่าหายทั้งที่ไม่ได้หาย
 *
 * สิ่งที่ตรวจจริงคือ **เนื้อหา**: ทุกเนื้อหาที่ ver1 หาเจอ ver2 ต้องหาเจอด้วย
 */

import { runSearch } from '../api/_lib/search.js'

const argv = process.argv.slice(2)
const args = {}
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i]
}

const API = args.api || 'http://localhost:5183'
const envName = (args.env || 'dev').toUpperCase()
const url = process.env[`SUPABASE_URL_${envName}`] || process.env.SUPABASE_URL
const key = process.env[`SUPABASE_SERVICE_KEY_${envName}`] || process.env.SUPABASE_SERVICE_KEY

if (!url || !key) {
  console.error(`❌ ยังไม่ได้ตั้งค่า SUPABASE_URL_${envName} / SUPABASE_SERVICE_KEY_${envName}`)
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const { default: WebSocketImpl } = await import('ws')
const realtime =
  typeof globalThis.WebSocket === 'undefined' ? { realtime: { transport: WebSocketImpl } } : {}
const db = createClient(url, key, { auth: { persistSession: false }, ...realtime })

// ── ตารางแปลง id ↔ ลายเซ็นเนื้อหา ──
// dedupe_hash คือลายเซ็นของเนื้อหาหลังตัดช่องว่างและสัญลักษณ์จัดรูปแบบ
// สองฉบับที่ผู้อ่านเห็นเป็นเนื้อหาเดียวกันจะได้ลายเซ็นเดียวกัน

async function loadHashTables() {
  const byUuid = new Map()
  const byLegacy = new Map()
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await db
      .from('teachings')
      .select('id, legacy_id, dedupe_hash, duplicate_of')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    for (const r of data) {
      byUuid.set(r.id, r.dedupe_hash)
      byLegacy.set(r.legacy_id, r.dedupe_hash)
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return { byUuid, byLegacy }
}

/** teachingId ทั้งหมดของผลค้นหา ver2 (ไล่ครบทุกหน้า) */
async function collectV2(query) {
  const ids = []
  let page = 1
  let totalPages = 1
  do {
    const res = await fetch(`${API}/api/v1/teachings?q=${encodeURIComponent(query)}&page=${page}`)
    const body = await res.json()
    if (body.error) throw new Error(`${body.error.code}: ${body.error.message}`)
    for (const hit of body.data.hits) ids.push(hit.teachingId)
    totalPages = body.meta.totalPages
    page++
  } while (page <= totalPages)
  return ids
}

/** teachingId ทั้งหมดของผลค้นหา ver1 (ไล่ครบทุกหน้า) */
function collectV1(query) {
  const ids = []
  let page = 1
  for (;;) {
    const r = runSearch(query, {}, page)
    for (const h of r.hits) ids.push(h.teachingId)
    if (page >= r.totalPages) break
    page++
  }
  return ids
}

// ── ข้อ 0: เนื้อหาทุกฉบับต้องตรงต้นฉบับทุกตัวอักษร ──
// กฎเหล็กของโปรเจกต์ ตรวจก่อนอย่างอื่นเสมอ
async function verifyContentUntouched() {
  const { readFileSync } = await import('node:fs')
  const { gunzipSync } = await import('node:zlib')
  const { createHash } = await import('node:crypto')
  const { resolve } = await import('node:path')

  const src = JSON.parse(
    gunzipSync(readFileSync(resolve(process.cwd(), 'api/_data/teachings.json.gz'))).toString('utf8'),
  )
  const sha = (v) => createHash('sha256').update(v || '', 'utf8').digest('hex')
  const wanted = new Map(src.map((t) => [t.id, sha(t.content_th || '')]))

  const found = new Map()
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('teachings')
      .select('legacy_id, content')
      .range(from, from + 199)
    if (error) throw new Error(error.message)
    for (const r of data) found.set(r.legacy_id, sha(r.content))
    if (data.length < 200) break
    from += 200
  }

  const missing = [...wanted.keys()].filter((id) => !found.has(id))
  const altered = [...wanted.entries()].filter(([id, h]) => found.has(id) && found.get(id) !== h)

  console.log('═══ เนื้อหาต้องตรงต้นฉบับ 100% ═══')
  console.log(`  ต้นฉบับ ${wanted.size} ฉบับ · ในฐานข้อมูล ${found.size} ฉบับ`)
  if (missing.length === 0 && altered.length === 0) {
    console.log(`  ✅ ตรงกันทุกตัวอักษรครบ ${wanted.size} ฉบับ ไม่มีฉบับไหนถูกแก้\n`)
    return true
  }
  if (missing.length) console.log(`  ❌ ไม่ได้เข้าฐานข้อมูล ${missing.length} ฉบับ: ${missing.slice(0, 3).join(', ')}`)
  if (altered.length) console.log(`  ❌ เนื้อหาไม่ตรงต้นฉบับ ${altered.length} ฉบับ: ${altered.slice(0, 3).map(([id]) => id).join(', ')}`)
  console.log('')
  return false
}

const contentOk = await verifyContentUntouched()

const QUERIES = ['เมตตา', 'ปัญญา', 'กำลังใจ', 'ครอบครัว', 'บำเพ็ญ', 'อภัย', '']

console.log('═══ ตรวจว่าไม่มีพระโอวาทหายจากการย้ายข้อมูล ═══\n')

const { byUuid, byLegacy } = await loadHashTables()
console.log(`ฉบับในฐานข้อมูล: ${byUuid.size} · เนื้อหาที่ไม่ซ้ำกัน: ${new Set(byUuid.values()).size}\n`)

let failed = contentOk ? 0 : 1

for (const q of QUERIES) {
  const label = q || '(เปิดดูทั้งหมด)'

  const v1Hashes = new Set()
  const v1Unknown = []
  for (const id of collectV1(q)) {
    const h = byLegacy.get(id)
    if (h) v1Hashes.add(h)
    else v1Unknown.push(id)
  }

  const v2Hashes = new Set()
  for (const id of await collectV2(q)) {
    const h = byUuid.get(id)
    if (h) v2Hashes.add(h)
  }

  const missing = [...v1Hashes].filter((h) => !v2Hashes.has(h))

  if (missing.length === 0 && v1Unknown.length === 0) {
    console.log(
      `✓ "${label}" — เนื้อหาที่ ver1 หาเจอ ${v1Hashes.size} แบบ ver2 หาเจอครบทุกแบบ` +
        (v2Hashes.size > v1Hashes.size ? ` (ver2 เจอเพิ่ม ${v2Hashes.size - v1Hashes.size})` : ''),
    )
  } else {
    failed++
    console.log(`\n✗ "${label}" — ver1 ${v1Hashes.size} แบบ · ver2 ${v2Hashes.size} แบบ`)
    if (v1Unknown.length) {
      console.log(`    ⚠️ ฉบับที่ไม่มีในฐานข้อมูลเลย ${v1Unknown.length} ฉบับ:`)
      for (const id of v1Unknown.slice(0, 5)) console.log(`       ${id}`)
    }
    if (missing.length) {
      console.log(`    ⚠️ เนื้อหาที่ ver2 หาไม่เจอ ${missing.length} แบบ`)
      // แสดงชื่อฉบับตัวอย่างเพื่อให้ตามต่อได้
      for (const h of missing.slice(0, 5)) {
        const { data } = await db.from('teachings').select('legacy_id').eq('dedupe_hash', h).limit(1)
        console.log(`       ${data?.[0]?.legacy_id ?? h}`)
      }
    }
  }
}

console.log(
  failed === 0
    ? '\n✅ ไม่มีพระโอวาทหายไป — ทุกเนื้อหาที่ ver1 หาเจอ ver2 หาเจอครบ'
    : `\n❌ พบปัญหา ${failed} จาก ${QUERIES.length} คำค้น`,
)
process.exit(failed === 0 ? 0 : 1)
