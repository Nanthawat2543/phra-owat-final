// POST /api/auth/login  { email, password } → sets httpOnly session cookie
import { checkCredentials, signSession, sessionCookie, readJsonBody } from '../_lib/auth.js'

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

  const user = checkCredentials(body.email, body.password)
  if (!user) {
    res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
    return
  }

  const token = signSession({ email: user.email, name: user.name, role: user.role })
  res.setHeader('Set-Cookie', sessionCookie(token))
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ user })
}
