// POST /api/auth/login  { email, password } → sets httpOnly session cookie
import { checkAdminCredentials, verifyMemberPassword, signSession, sessionCookie, readJsonBody } from '../_lib/auth.js'

const STATUS_MESSAGE = {
  pending: 'บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ',
  rejected: 'บัญชีของคุณไม่ได้รับอนุมัติ กรุณาติดต่อผู้ดูแลระบบ',
  blocked: 'บัญชีของคุณถูกระงับการใช้งาน',
}

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
      res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
      return
    }
    // อนุญาตเฉพาะสมาชิกที่อนุมัติแล้ว
    if (member.status !== 'active') {
      res.status(403).json({ error: STATUS_MESSAGE[member.status] || 'บัญชียังไม่พร้อมใช้งาน' })
      return
    }
    user = { email: member.email, name: member.name || member.email, role: 'member' }
  }

  const token = signSession({ email: user.email, name: user.name, role: user.role })
  res.setHeader('Set-Cookie', sessionCookie(token))
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ user })
}
