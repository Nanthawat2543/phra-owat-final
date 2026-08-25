#!/usr/bin/env node
/**
 * แก้ไขเนื้อหาพระโอวาทที่มีอยู่แล้วในคลัง (ใช้เมื่อพบว่าเนื้อหาไม่ตรงต้นฉบับ)
 *
 *   node scripts/update-teaching.mjs --id "<teaching id>" --file ./เนื้อหา.txt [--dry]
 *
 * ⚠️ เนื้อหาต้องตรงกับต้นฉบับ 100% — ดูกฎใน CLAUDE.md
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
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

if (!args.id || !args.file) {
  console.error('❌ ต้องระบุ --id และ --file')
  process.exit(1)
}
if (!existsSync(args.file)) {
  console.error(`❌ ไม่พบไฟล์ ${args.file}`)
  process.exit(1)
}

const content = readFileSync(args.file, 'utf8').trim()
const teachings = JSON.parse(gunzipSync(readFileSync(DATA)).toString('utf8'))
const rec = teachings.find((t) => t.id === args.id)

if (!rec) {
  console.error(`❌ ไม่พบพระโอวาท id: ${args.id}`)
  process.exit(1)
}

const before = rec.content_th
console.log('📄 แก้ไขพระโอวาท:', rec.id)
console.log('   ผู้ประทาน:', rec.deity_th)
console.log('   ความยาวเดิม:', before.length, '→ ใหม่:', content.length, 'ตัวอักษร')

if (before === content) {
  console.log('\n(เนื้อหาเหมือนเดิม — ไม่มีอะไรเปลี่ยน)')
  process.exit(0)
}

if (args.dry) {
  console.log('\n(dry run — ไม่บันทึก)')
  process.exit(0)
}

copyFileSync(DATA, DATA + '.bak')
rec.content_th = content
writeFileSync(DATA, gzipSync(Buffer.from(JSON.stringify(teachings), 'utf8'), { level: 9 }))
console.log('\n✅ แก้ไขแล้ว (สำรองไฟล์เดิมไว้ที่ teachings.json.gz.bak)')
console.log('   ขั้นต่อไป: npm run build && git commit && vercel --prod')
