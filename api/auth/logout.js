// POST /api/auth/logout → clears the session cookie
import { sessionCookie } from '../_lib/auth.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  res.setHeader('Set-Cookie', sessionCookie('', { clear: true }))
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ok: true })
}
