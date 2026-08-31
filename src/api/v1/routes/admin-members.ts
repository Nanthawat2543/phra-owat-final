// GET   /api/v1/admin/members            รายชื่อสมาชิก (?status= กรองได้)
// PATCH /api/v1/admin/members            เปลี่ยนสถานะ { id, status }
//
// เฉพาะผู้ดูแลระบบ — ตรวจสิทธิ์ที่ชั้น service ไม่ใช่ที่นี่

import { allowMethods, cookie, handler, param, readJson, sendOk } from '../../../shared/http.js'
import { authService } from '../../../services/AuthService.js'
import { memberService } from '../../../services/MemberService.js'
import { SESSION_COOKIE } from '../../../shared/config.js'
import type { MemberStatus } from '../../../domain/member.js'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET', 'PATCH'])) return

  const session = authService.verifySession(cookie(req, SESSION_COOKIE))

  if (req.method === 'PATCH') {
    const { id, status } = await readJson<{ id?: string; status?: MemberStatus }>(req)
    const member = await memberService.setStatus(session, String(id ?? ''), status as MemberStatus)
    sendOk(res, { member })
    return
  }

  const status = param(req, 'status') as MemberStatus | ''
  const members = await memberService.list(session, status || undefined)
  sendOk(res, { members }, { total: members.length })
})
