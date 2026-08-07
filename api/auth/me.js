// GET /api/auth/me → current session user (user: null ถ้ายังไม่ล็อกอิน)
// คืน 200 เสมอ — "ยังไม่ล็อกอิน" เป็นสถานะปกติ ไม่ใช่ error
// (เดิมคืน 401 ทำให้ console ของผู้ใช้ขึ้น error แดงทุกหน้าโดยไม่จำเป็น)
import { sessionFromRequest } from '../_lib/auth.js'

export default function handler(req, res) {
  const session = sessionFromRequest(req)
  res.setHeader('Cache-Control', 'no-store')
  if (!session) {
    res.status(200).json({ user: null })
    return
  }
  res.status(200).json({ user: { email: session.email, name: session.name, role: session.role } })
}
