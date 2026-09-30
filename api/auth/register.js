// POST /api/auth/register — รับใบสมัครสมาชิก (Bug #14)
// บันทึกลง Vercel Blob (store: owat-members) หนึ่งไฟล์ต่อหนึ่งใบสมัคร
// รหัสผ่านเก็บเป็น SHA-256 hash เท่านั้น — ไม่เก็บ plain text

import { createHash, randomUUID } from 'node:crypto'
import { put, list } from '@vercel/blob'
import {
  readJsonBody,
  hashPassword,
  wrongOrigin,
  tooManyAttempts,
  recordFailure,
  clientKey,
} from '../_lib/auth.js'

// ตอบข้อความเดียวกันเสมอ ไม่ว่าอีเมลนี้จะเคยสมัครไว้แล้วหรือยัง
// ถ้าตอบต่างกัน คนนอกจะยิงทีละอีเมลเพื่อไล่ดูว่าใครเป็นสมาชิกบ้างได้
const SAME_ANSWER =
  'รับใบสมัครแล้ว หากอีเมลนี้ยังไม่เคยสมัครไว้ ผู้ดูแลระบบจะตรวจสอบและอนุมัติให้ กรุณารอการติดต่อกลับ'

const REQUIRED = [
  ['name', 'ชื่อ-นามสกุล'],
  ['dharmaTitle', 'ตำแหน่งทางธรรม'],
  ['temple', 'สถานธรรม'],
  ['email', 'อีเมล'],
  ['password', 'รหัสผ่าน'],
]

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (wrongOrigin(req)) {
    res.status(403).json({ error: 'คำขอไม่ถูกต้อง' })
    return
  }
  // กันยิงใบสมัครรัวๆ ทั้งเพื่อสแปมและเพื่อไล่เช็ครายชื่อสมาชิก
  const ip = clientKey(req)
  if (tooManyAttempts(`reg:${ip}`)) {
    res.status(429).json({ error: 'ส่งใบสมัครถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' })
    return
  }
  recordFailure(`reg:${ip}`)

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
      // ตอบเหมือนกรณีสมัครสำเร็จทุกประการ — ไม่บอกว่ามีอีเมลนี้อยู่แล้ว
      res.status(200).json({ ok: true, message: SAME_ANSWER })
      return
    }

    const record = {
      id: randomUUID(),
      name: String(body.name).trim(),
      dharmaTitle: String(body.dharmaTitle).trim(),
      temple: String(body.temple).trim(),
      email,
      passwordHash: await hashPassword(String(body.password)), // scrypt + เกลือสุ่ม
      status: 'pending', // รอผู้ดูแลระบบอนุมัติก่อนจึงเข้าสู่ระบบได้
      createdAt: new Date().toISOString(),
    }
    await put(`members/${emailKey}-${record.id}.json`, JSON.stringify(record, null, 2), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      cacheControlMaxAge: 0, // record แก้ไขได้ — ไม่ให้ CDN แคช
    })

    res.status(200).json({ ok: true, message: SAME_ANSWER })
  } catch (err) {
    console.error('register failed:', err)
    res.status(500).json({ error: 'บันทึกใบสมัครไม่สำเร็จ ลองใหม่อีกครั้ง' })
  }
}
