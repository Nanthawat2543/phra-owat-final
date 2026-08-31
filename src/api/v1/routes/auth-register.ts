// POST /api/v1/auth/register — สมัครสมาชิก
//
// สมัครแล้วสถานะเป็น "รอตรวจสอบ" ยังเข้าใช้งานไม่ได้จนกว่าผู้ดูแลจะอนุมัติ

import { allowMethods, handler, readJson, sendOk } from '../../../shared/http.js'
import { authService } from '../../../services/AuthService.js'
import type { RegisterInput } from '../../../domain/member.js'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return

  const user = await authService.register(await readJson<Partial<RegisterInput>>(req))
  sendOk(res, {
    user,
    message: 'สมัครสมาชิกเรียบร้อย รอผู้ดูแลระบบอนุมัติแล้วจึงเข้าใช้งานได้',
  })
})
