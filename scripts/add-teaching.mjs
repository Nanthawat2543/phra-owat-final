#!/usr/bin/env node
/**
 * เพิ่มพระโอวาทใหม่เข้าคลังข้อมูล (api/_data/teachings.json.gz)
 *
 * วิธีใช้:
 *   node scripts/add-teaching.mjs \
 *     --file ./เนื้อหา.txt \
 *     --deity "เต้าจี้เทียนจุน" \
 *     --temple "เทียนเซิงฝอเอวี้ยน" \
 *     --province "ชลบุรี" \
 *     --date 2026-08-23 \
 *     --category "ซินหมินจื้อซั่น"
 *
 * ตัวเลือก: --id (กำหนดเอง), --dry (ดูผลโดยไม่บันทึก)
 *
 * หมายเหตุ: หลังรันต้อง commit + deploy ใหม่ ข้อมูลถึงจะขึ้นเว็บจริง
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const DATA = fileURLToPath(new URL('../api/_data/teachings.json.gz', import.meta.url))

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    if (key === 'dry') out.dry = true
    else out[key] = argv[++i]
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const required = ['file', 'deity', 'date']
for (const k of required) {
  if (!args[k]) {
    console.error(`❌ ต้องระบุ --${k}`)
    process.exit(1)
  }
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
  console.error('❌ --date ต้องเป็นรูปแบบ ค.ศ. YYYY-MM-DD (เช่น 2026-08-23)')
  process.exit(1)
}
if (!existsSync(args.file)) {
  console.error(`❌ ไม่พบไฟล์ ${args.file}`)
  process.exit(1)
}

const content = readFileSync(args.file, 'utf8').trim()
if (content.length < 50) {
  console.error('❌ เนื้อหาสั้นเกินไป')
  process.exit(1)
}

// id เริ่มต้น: YYMMDD(พ.ศ.)_พระโอวาท_<ชั้นเรียน><สถานธรรม>_<จังหวัด> — ตามรูปแบบเดิมในคลัง
const [y, m, d] = args.date.split('-')
const beShort = String(Number(y) + 543).slice(2)
const idParts = [
  `${beShort}${m}${d}`,
  'พระโอวาท',
  `${args.category || ''}${args.temple || ''}`.trim() || 'ไม่ระบุสถานที่',
  args.province || '',
].filter(Boolean)
const id = args.id || idParts.join('_')

const teachings = JSON.parse(gunzipSync(readFileSync(DATA)).toString('utf8'))

if (teachings.some((t) => t.id === id)) {
  console.error(`❌ มี id นี้อยู่แล้ว: ${id}`)
  process.exit(1)
}
// กันเพิ่มเนื้อหาซ้ำ (เทียบ 120 ตัวอักษรแรกแบบไม่นับช่องว่าง)
const sig = (s) => s.replace(/\s+/g, '').slice(0, 120)
const dup = teachings.find((t) => sig(t.content_th || '') === sig(content))
if (dup) {
  console.error(`❌ เนื้อหานี้มีอยู่แล้วในคลัง (id: ${dup.id})`)
  process.exit(1)
}

const record = {
  id,
  content_th: content,
  deity_th: args.deity,
  temple_th: args.temple || null,
  province_th: args.province || null,
  location_th: args.temple || null,
  country: args.country || 'ไทย',
  date: args.date,
  category: args.category || null,
  audio_approved: false,
}

console.log('📄 พระโอวาทที่จะเพิ่ม:')
console.log('   id       :', record.id)
console.log('   ผู้ประทาน :', record.deity_th)
console.log('   สถานที่   :', [record.temple_th, record.province_th].filter(Boolean).join(' · ') || '—')
console.log('   วันที่    :', record.date)
console.log('   ชั้นเรียน :', record.category || '—')
console.log('   ความยาว  :', content.length, 'ตัวอักษร')

if (args.dry) {
  console.log('\n(dry run — ไม่บันทึก)')
  process.exit(0)
}

// สำรองไฟล์เดิมก่อนเขียนทับ
copyFileSync(DATA, DATA + '.bak')
teachings.push(record)
writeFileSync(DATA, gzipSync(Buffer.from(JSON.stringify(teachings), 'utf8'), { level: 9 }))

console.log(`\n✅ เพิ่มแล้ว — คลังมี ${teachings.length} ฉบับ (สำรองไฟล์เดิมไว้ที่ teachings.json.gz.bak)`)
console.log('   ขั้นต่อไป: npm run build && git commit && vercel --prod')
