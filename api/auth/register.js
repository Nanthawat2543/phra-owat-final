// POST /api/auth/register — รับใบสมัครสมาชิก (Bug #14)
// บันทึกลง Vercel Blob (store: owat-members) หนึ่งไฟล์ต่อหนึ่งใบสมัคร
// รหัสผ่านเก็บเป็น SHA-256 hash เท่านั้น — ไม่เก็บ plain text

import { createHash, randomUUID } from 'node:crypto'
import { put, list } from '@vercel/blob'
import { readJsonBody } from '../_lib/auth.js'

const REQUIRED = [
  ['name', 'ชื่อ-นามสกุล'],
  ['dharmaTitle', 'ตำแหน่งทางธรรม'],
  ['temple', 'สถานธรรม'],
  ['email', 'อีเมล'],
  ['password', 'รหัสผ่าน'],
]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  let body
  try {
    body = await readJsonBody(req)
  } catch {
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }

  for (const [key, label] of REQUIRED) {
    if (!String(body[key] || '').trim()) {
      res.status(400).json({ error: `กรุณากรอก${label}` })
      return
    }
  }
  const email = String(body.email).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' })
    return
  }
  if (String(body.password).length < 8) {
    res.status(400).json({ error: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' })
    return
  }
  if (body.password !== body.confirmPassword) {
    res.status(400).json({ error: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน' })
    return
  }

  try {
    // กันสมัครซ้ำ — เช็คอีเมลเดิมในคลังใบสมัคร
    const emailKey = createHash('sha256').update(email).digest('hex').slice(0, 24)
    const { blobs } = await list({ prefix: `members/${emailKey}-` })
    if (blobs.length > 0) {
      res.status(409).json({ error: 'อีเมลนี้สมัครไว้แล้ว กรุณารอการอนุมัติหรือติดต่อผู้ดูแล' })
      return
    }

    const record = {
      id: randomUUID(),
      name: String(body.name).trim(),
      dharmaTitle: String(body.dharmaTitle).trim(),
      temple: String(body.temple).trim(),
      email,
      passwordSha256: createHash('sha256').update(String(body.password), 'utf8').digest('hex'),
      status: 'pending', // รอผู้ดูแลอนุมัติ
      createdAt: new Date().toISOString(),
    }
    await put(`members/${emailKey}-${record.id}.json`, JSON.stringify(record, null, 2), {
      access: 'private',
      contentType: 'application/json',
    })

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, message: 'สมัครสมาชิกสำเร็จ รอผู้ดูแลระบบอนุมัติ' })
  } catch (err) {
    console.error('register failed:', err)
    res.status(500).json({ error: 'บันทึกใบสมัครไม่สำเร็จ ลองใหม่อีกครั้ง' })
  }
}
