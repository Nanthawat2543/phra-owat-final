// GET /api/v1/auth/me — ผู้ใช้ที่กำลังเข้าใช้งานอยู่
//
// ยังไม่เข้าสู่ระบบก็ตอบ 200 พร้อม user: null — ไม่ใช่ข้อผิดพลาด
// (ver1 ตอบ 401 ทำให้ console ขึ้นแดงทุกหน้าแม้ระบบทำงานปกติ)

import { allowMethods, cookie, handler, sendOk } from '../../../shared/http'
import { authService } from '../../../services/AuthService'
import { authConfig } from '../../../shared/config'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return

  sendOk(res, { user: await authService.currentUser(cookie(req, authConfig().cookieName)) })
})
