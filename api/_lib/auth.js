// Minimal auth layer — HMAC-SHA256 JWT in an httpOnly cookie.
// v1: single admin account from env vars (no database yet).
//   ADMIN_EMAIL            login email
//   ADMIN_PASSWORD_SHA256  hex sha256 of the password
//   AUTH_SECRET            JWT signing secret

import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'ow_session'
const SESSION_DAYS = 7

const b64url = (buf) => Buffer.from(buf).toString('base64url')

function getSecret() {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return s
}

export function signSession(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400
  const body = b64url(JSON.stringify({ ...payload, exp }))
  const sig = createHmac('sha256', getSecret()).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export function verifySession(token) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const expected = createHmac('sha256', getSecret()).update(`${header}.${body}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function checkCredentials(email, password) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const adminHash = (process.env.ADMIN_PASSWORD_SHA256 || '').trim().toLowerCase()
  if (!adminEmail || !adminHash) return null
  if ((email || '').trim().toLowerCase() !== adminEmail) return null
  const hash = createHash('sha256').update(password || '', 'utf8').digest('hex')
  const a = Buffer.from(hash)
  const b = Buffer.from(adminHash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return { email: adminEmail, name: 'ผู้ดูแลระบบ (ทดสอบ)', role: 'admin' }
}

export function sessionFromRequest(req) {
  const cookies = req.headers?.cookie || ''
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))
  return m ? verifySession(decodeURIComponent(m[1])) : null
}

export function sessionCookie(token, { clear = false } = {}) {
  const secure = process.env.VERCEL ? '; Secure' : ''
  if (clear) return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${SESSION_DAYS * 86400}`
}

// Read a JSON body — works both on Vercel (pre-parsed req.body) and in the
// local vite dev middleware (raw stream).
export async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}
