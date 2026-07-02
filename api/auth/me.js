// GET /api/auth/me → current session user, or 401
import { sessionFromRequest } from '../_lib/auth.js'

export default function handler(req, res) {
  const session = sessionFromRequest(req)
  res.setHeader('Cache-Control', 'no-store')
  if (!session) {
    res.status(401).json({ user: null })
    return
  }
  res.status(200).json({ user: { email: session.email, name: session.name, role: session.role } })
}
