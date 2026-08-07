// Minimal auth layer — HMAC-SHA256 JWT in an httpOnly cookie.
// v1: single admin account from env vars (no database yet).
//   ADMIN_EMAIL            login email
//   ADMIN_PASSWORD_SHA256  hex sha256 of the password
//   AUTH_SECRET            JWT signing secret

import { createHmac, createHash, timingSafeEqual, randomUUID } from 'node:crypto'
import { list, put, del } from '@vercel/blob'

// อ่านไฟล์ private blob (downloadUrl แบบ signed คืน 403 ต้องแนบ token)
// bust CDN cache ด้วย query timestamp + no-store เพราะ record นี้แก้ไขได้ (mutable)
async function readBlobJson(url) {
  const bust = url + (url.includes('?') ? '&' : '?') + '_ts=' + Date.now()
  const res = await fetch(bust, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  })
  if (!res.ok) return null
  return res.json()
}

export const SESSION_COOKIE = 'ow_session'
const SESSION_DAYS = 7

// เทียบ hash แบบ constant-time (กัน timing attack)
function hashEquals(hexA, hexB) {
  const a = Buffer.from(String(hexA || ''))
  const b = Buffer.from(String(hexB || ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

const emailKeyOf = (email) => createHash('sha256').update(email).digest('hex').slice(0, 24)

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

// บัญชีแอดมินจาก env (ตรวจแบบ sync)
export function checkAdminCredentials(email, password) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const adminHash = (process.env.ADMIN_PASSWORD_SHA256 || '').trim().toLowerCase()
  if (!adminEmail || !adminHash) return null
  if ((email || '').trim().toLowerCase() !== adminEmail) return null
  const hash = createHash('sha256').update(password || '', 'utf8').digest('hex')
  if (!hashEquals(hash, adminHash)) return null
  return { email: adminEmail, name: 'ผู้ดูแลระบบ (ทดสอบ)', role: 'admin' }
}

// หา blob ของสมาชิกตามอีเมล (คืน record + pathname สำหรับเขียนทับ)
async function findMemberBlob(email) {
  const e = (email || '').trim().toLowerCase()
  if (!e) return null
  const { blobs } = await list({ prefix: `members/${emailKeyOf(e)}-` })
  if (!blobs.length) return null
  const blob = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0]
  const rec = await readBlobJson(blob.url)
  return rec ? { rec, pathname: blob.pathname } : null
}

export async function findMemberByEmail(email) {
  const found = await findMemberBlob(email)
  return found ? found.rec : null
}

// ตรวจรหัสผ่านสมาชิก — คืน record (รวม status) ถ้ารหัสถูก, null ถ้าไม่มี/รหัสผิด
// ให้ผู้เรียกตัดสินใจตาม status เอง (แยกข้อความ "รหัสผิด" กับ "รออนุมัติ")
export async function verifyMemberPassword(email, password) {
  let rec
  try {
    rec = await findMemberByEmail(email)
  } catch {
    return null
  }
  if (!rec) return null
  const hash = createHash('sha256').update(password || '', 'utf8').digest('hex')
  if (!hashEquals(hash, rec.passwordSha256)) return null
  return rec
}

// แอดมินอัปเดตสถานะสมาชิก (approve/reject/block)
// เขียนไฟล์ path ใหม่เสมอ แล้วลบไฟล์เก่า — เพราะเขียนทับ path เดิม Vercel Blob CDN
// จะแคชค่าเก่าค้าง (query-bust ไม่ช่วย) ทำให้ login อ่านสถานะเก่า
export async function setMemberStatus(email, status) {
  const e = (email || '').trim().toLowerCase()
  const { blobs } = await list({ prefix: `members/${emailKeyOf(e)}-` })
  if (!blobs.length) return false
  const newest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0]
  const rec = await readBlobJson(newest.url)
  if (!rec) return false
  rec.status = status
  rec.reviewedAt = new Date().toISOString()
  await put(`members/${emailKeyOf(e)}-${randomUUID()}.json`, JSON.stringify(rec, null, 2), {
    access: 'private',
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  })
  // ลบไฟล์เก่าทั้งหมด (URL เดิมที่อาจถูกแคช)
  await Promise.all(blobs.map((b) => del(b.url).catch(() => {})))
  return true
}

// รายชื่อสมาชิกทั้งหมด (ตัด hash รหัสผ่านออก) — สำหรับหน้าจัดการของแอดมิน
export async function listMembers() {
  const { blobs } = await list({ prefix: 'members/' })
  const out = []
  for (const b of blobs) {
    const rec = await readBlobJson(b.url).catch(() => null)
    if (!rec) continue
    out.push({
      email: rec.email,
      name: rec.name || '',
      dharmaTitle: rec.dharmaTitle || '',
      temple: rec.temple || '',
      status: rec.status || 'pending',
      createdAt: rec.createdAt || null,
      reviewedAt: rec.reviewedAt || null,
    })
  }
  return out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
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
