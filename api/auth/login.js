// POST /api/auth/login  { email, password } → sets httpOnly session cookie
import {
  checkAdminCredentials,
  verifyMemberPassword,
  signSession,
  sessionCookie,
  readJsonBody,
  tooManyAttempts,
  recordFailure,
  clearFailures,
  clientKey,
  wrongOrigin,
} from '../_lib/auth.js'

const STATUS_MESSAGE = {
  pending: 'บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ',
  rejected: 'บัญชีของคุณไม่ได้รับอนุมัติ กรุณาติดต่อผู้ดูแลระบบ',
  blocked: 'บัญชีของคุณถูกระงับการใช้งาน',
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  // คำขอที่มาจากเว็บอื่น = ไม่ใช่ผู้ใช้เรากดเอง
  if (wrongOrigin(req)) {
    res.status(403).json({ error: 'คำขอไม่ถูกต้อง' })
    return
  }

  // กันเดารหัสรัวๆ — นับทั้งจาก IP และจากอีเมลที่ถูกเล็ง
  // (นับอีเมลด้วย เพื่อไม่ให้เปลี่ยน IP ไปเรื่อยๆ แล้วถล่มบัญชีเดิมได้)
  const ip = clientKey(req)
  if (tooManyAttempts(`ip:${ip}`)) {
    res.status(429).json({ error: 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่' })
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }

  const emailKey = `em:${String(body.email || '').trim().toLowerCase()}`
  if (tooManyAttempts(emailKey)) {
    res.status(429).json({ error: 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่' })
    return
  }

  const fail = () => {
    recordFailure(`ip:${ip}`)
    recordFailure(emailKey)
  }

  // แอดมินก่อน
  let user = checkAdminCredentials(body.email, body.password)

  // ถ้าไม่ใช่แอดมิน ลองสมาชิก
  if (!user) {
    let member
    try {
      member = await verifyMemberPassword(body.email, body.password)
    } catch {
      member = null
    }
    if (!member) {
      fail()
      res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
      return
    }
    // อนุญาตเฉพาะสมาชิกที่อนุมัติแล้ว
    // (ไม่นับเป็นการเดารหัสผิด เพราะรหัสถูกแล้ว แค่บัญชียังไม่พร้อม)
    if (member.status !== 'active') {
      res.status(403).json({ error: STATUS_MESSAGE[member.status] || 'บัญชียังไม่พร้อมใช้งาน' })
      return
    }
    user = { email: member.email, name: member.name || member.email, role: 'member' }
  }

  // ล็อกอินสำเร็จ — ล้างประวัติเดาผิด
  clearFailures(`ip:${ip}`)
  clearFailures(emailKey)

  const token = signSession({ email: user.email, name: user.name, role: user.role })
  res.setHeader('Set-Cookie', sessionCookie(token))
  res.status(200).json({ user })
}
