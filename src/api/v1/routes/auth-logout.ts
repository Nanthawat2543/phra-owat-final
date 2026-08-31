// POST /api/v1/auth/logout — ออกจากระบบ (ล้างคุกกี้)

import { allowMethods, handler, sendOk } from '../../../shared/http'
import { authService } from '../../../services/AuthService'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return

  res.setHeader('Set-Cookie', authService.sessionCookie('', { clear: true }))
  sendOk(res, { user: null })
})
