// GET   /api/v1/admin/members            รายชื่อสมาชิก (?status= กรองได้)
// PATCH /api/v1/admin/members            เปลี่ยนสถานะ { id, status }
//
// เฉพาะผู้ดูแลระบบ — ตรวจสิทธิ์ที่ชั้น service ไม่ใช่ที่นี่

import { allowMethods, cookie, handler, param, readJson, sendOk } from '../../../src/shared/http'
import { authService } from '../../../src/services/AuthService'
import { memberService } from '../../../src/services/MemberService'
import { authConfig } from '../../../src/shared/config'
import type { MemberStatus } from '../../../src/domain/member'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET', 'PATCH'])) return

  const session = authService.verifySession(cookie(req, authConfig().cookieName))

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
