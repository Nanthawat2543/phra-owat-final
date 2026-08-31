// POST /api/v1/auth/login — เข้าสู่ระบบ
//
// สำเร็จแล้วตั้งคุกกี้ httpOnly ให้ — หน้าเว็บไม่ต้องเก็บ token เอง

import { allowMethods, handler, readJson, sendOk } from '../../../src/shared/http'
import { authService } from '../../../src/services/AuthService'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return

  const { email, password } = await readJson<{ email?: string; password?: string }>(req)
  const { token, user } = await authService.login(String(email ?? ''), String(password ?? ''))

  res.setHeader('Set-Cookie', authService.sessionCookie(token))
  sendOk(res, { user })
})
