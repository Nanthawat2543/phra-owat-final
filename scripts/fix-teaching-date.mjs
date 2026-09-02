#!/usr/bin/env node
/**
 * แก้ "วันที่" ของพระโอวาทที่บันทึกผิด
 *
 *   node scripts/fix-teaching-date.mjs --id "<teaching id>" --date YYYY-MM-DD [--dry]
 *
 * ⚠️ สคริปต์นี้แตะได้เฉพาะช่องวันที่เท่านั้น
 *    แยกจาก update-teaching.mjs (ที่ใช้แก้เนื้อหา) โดยตั้งใจ เพื่อไม่ให้ใครเผลอใช้ผิดตัว
 *    ก่อนเขียนไฟล์จะตรวจว่าเนื้อหาทุกฉบับยังตรงเดิมทุกตัวอักษร ถ้าไม่ตรงจะไม่เขียน
 *
 * ใช้เมื่อมีหลักฐานชัดเจนว่าวันที่ผิด เช่น เนื้อหาต้นฉบับระบุปีไว้เอง
 * และต้องได้รับการยืนยันจากผู้ดูแลก่อนเสมอ
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const DATA = fileURLToPath(new URL('../api/_data/teachings.json.gz', import.meta.url))

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue
  const k = argv[i].slice(2)
  if (k === 'dry') args.dry = true
  else args[k] = argv[++i]
}

if (!args.id || !args.date) {
  console.error('❌ ต้องระบุ --id และ --date (รูปแบบ YYYY-MM-DD)')
  process.exit(1)
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
  console.error(`❌ รูปแบบวันที่ไม่ถูกต้อง: ${args.date} (ต้องเป็น YYYY-MM-DD)`)
  process.exit(1)
}

const raw = gunzipSync(readFileSync(DATA)).toString('utf8')
const teachings = JSON.parse(raw)
const rec = teachings.find((t) => t.id === args.id)

if (!rec) {
  console.error(`❌ ไม่พบพระโอวาท id: ${args.id}`)
  process.exit(1)
}

const sha = (v) => createHash('sha256').update(v || '', 'utf8').digest('hex')
const before = new Map(teachings.map((t) => [t.id, sha(t.content_th || '')]))

const beYear = (d) => (d ? new Date(d).getFullYear() + 543 : null)

console.log('═══ ฉบับที่จะแก้ ═══')
console.log('  id      :', rec.id)
console.log('  องค์     :', rec.deity_th)
console.log('  สถานที่  :', rec.location_th || rec.temple_th || '(ไม่ระบุ)')
console.log('  ขึ้นต้น   :', (rec.content_th || '').replace(/\s+/g, ' ').slice(0, 120))
console.log('')
console.log('  วันที่เดิม :', rec.date, '→ พ.ศ.', beYear(rec.date))
console.log('  วันที่ใหม่ :', args.date, '→ พ.ศ.', beYear(args.date))
console.log('')

if (rec.date === args.date) {
  console.log('ℹ️  วันที่ตรงกับที่ต้องการอยู่แล้ว ไม่มีอะไรต้องแก้')
  process.exit(0)
}

rec.date = args.date

// ── ด่านความปลอดภัย: เนื้อหาทุกฉบับต้องไม่เปลี่ยนแม้แต่ตัวอักษรเดียว ──
const changed = teachings.filter((t) => before.get(t.id) !== sha(t.content_th || ''))
if (changed.length > 0) {
  console.error(`\n❌ ยกเลิก — เนื้อหาเปลี่ยนไป ${changed.length} ฉบับ ทั้งที่ควรแตะแค่วันที่`)
  console.error('   ', changed.slice(0, 3).map((t) => t.id).join(', '))
  process.exit(1)
}
console.log('✅ ตรวจแล้ว เนื้อหาทั้ง', teachings.length, 'ฉบับไม่เปลี่ยนแม้แต่ตัวอักษรเดียว')

if (args.dry) {
  console.log('\n(dry run — ไม่เขียนไฟล์)')
  process.exit(0)
}

const backup = DATA.replace(/\.json\.gz$/, `.backup-${args.id.slice(0, 20)}.json.gz`)
copyFileSync(DATA, backup)
writeFileSync(DATA, gzipSync(JSON.stringify(teachings), { level: 9 }))

console.log('\n✅ แก้เรียบร้อย')
console.log('   สำรองไฟล์เดิมไว้ที่:', backup.split('/').pop())
