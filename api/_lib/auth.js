// Minimal auth layer — HMAC-SHA256 JWT in an httpOnly cookie.
// v1: single admin account from env vars (no database yet).
//   ADMIN_EMAIL            login email
//   ADMIN_PASSWORD_SHA256  hex sha256 of the password
//   AUTH_SECRET            JWT signing secret

import { createHmac, createHash, timingSafeEqual, randomUUID, randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
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
//
// ถ้ารหัสยังเก็บแบบเก่า (sha256 เปล่าๆ) จะอัปเกรดเป็น scrypt ให้อัตโนมัติ
// ในครั้งที่ล็อกอินสำเร็จ — สมาชิกไม่ต้องตั้งรหัสใหม่ ไม่รู้ตัวด้วยซ้ำ
export async function verifyMemberPassword(email, password) {
  let rec
  try {
    rec = await findMemberByEmail(email)
  } catch {
    return null
  }
  if (!rec) return null

  const stored = rec.passwordHash || rec.passwordSha256
  if (!(await passwordMatches(password, stored))) return null

  if (needsRehash(stored)) {
    // อัปเกรดแบบเงียบๆ — ถ้าเขียนไม่สำเร็จก็ยังให้ล็อกอินผ่าน
    // (ครั้งหน้าค่อยลองใหม่) ไม่เอาเรื่องความปลอดภัยมาขวางการใช้งาน
    try {
      await upgradePasswordHash(rec.email, password)
    } catch (err) {
      console.error('rehash failed for', rec.email, err)
    }
  }
  return rec
}

// เขียน record ใหม่พร้อม hash แบบ scrypt แล้วลบไฟล์เก่า
// (เขียนทับ path เดิมไม่ได้ เพราะ Blob CDN จะแคชค่าเก่าค้าง)
async function upgradePasswordHash(email, plain) {
  const e = (email || '').trim().toLowerCase()
  const { blobs } = await list({ prefix: `members/${emailKeyOf(e)}-` })
  if (!blobs.length) return false
  const newest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0]
  const rec = await readBlobJson(newest.url)
  if (!rec) return false

  rec.passwordHash = await hashPassword(plain)
  delete rec.passwordSha256 // ทิ้ง hash เก่าให้หมด ไม่เก็บไว้เป็นภาระ
  rec.passwordUpgradedAt = new Date().toISOString()

  await put(`members/${emailKeyOf(e)}-${randomUUID()}.json`, JSON.stringify(rec, null, 2), {
    access: 'private',
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  })
  await Promise.all(blobs.map((b) => del(b.url).catch(() => {})))
  return true
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
  forgetMemberStatus(e) // ระงับแล้วต้องหลุดทันที ไม่ต้องรอแคชหมดอายุ
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
  // SameSite=Strict — เบราว์เซอร์จะไม่แนบคุกกี้เลยถ้าคำขอมาจากเว็บอื่น
  // ปิดประตู CSRF ตั้งแต่ชั้นเบราว์เซอร์ (Lax ยังเปิดช่องบางกรณี)
  if (clear) return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${SESSION_DAYS * 86400}`
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

// ═══════════════════════════════════════════════════════════════
//  รหัสผ่าน — scrypt พร้อมเกลือ (แทน sha256 เปล่าๆ ของเดิม)
// ═══════════════════════════════════════════════════════════════
// sha256 เปล่าๆ คำนวณเร็วมาก ถ้าคลังสมาชิกหลุด การ์ดจอใบเดียวลองได้
// หลายพันล้านรหัสต่อวินาที + ไม่มีเกลือ = ใช้ตารางสำเร็จรูปแกะได้เลย
// scrypt ออกแบบมาให้ช้าและกินแรม จงใจให้เดาไม่คุ้ม และเกลือสุ่มต่อคน
// ทำให้ตารางสำเร็จรูปใช้ไม่ได้
//
// รูปแบบที่เก็บ: scrypt$<N>$<เกลือ hex>$<คีย์ hex>
const scryptAsync = promisify(scrypt)
const SCRYPT_N = 16384 // ~100ms ต่อครั้งบนเครื่อง serverless
const SCRYPT_KEYLEN = 64

export async function hashPassword(plain) {
  const salt = randomBytes(16)
  const key = await scryptAsync(String(plain), salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: 8, p: 1 })
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${key.toString('hex')}`
}

/** เทียบรหัสผ่านกับค่าที่เก็บไว้ — รองรับทั้ง scrypt (ใหม่) และ sha256 (เก่า) */
export async function passwordMatches(plain, stored) {
  if (!stored) return false
  if (stored.startsWith('scrypt$')) {
    const [, n, saltHex, keyHex] = stored.split('$')
    try {
      const key = await scryptAsync(String(plain), Buffer.from(saltHex, 'hex'), keyHex.length / 2, {
        N: Number(n),
        r: 8,
        p: 1,
      })
      return hashEquals(key.toString('hex'), keyHex)
    } catch {
      return false
    }
  }
  // ของเก่า: sha256 เปล่าๆ — ยังรับไว้เพื่อให้สมาชิกเดิมล็อกอินได้
  // แล้วจะถูกอัปเกรดเป็น scrypt อัตโนมัติในครั้งนั้นเลย (ดู verifyMemberPassword)
  const hash = createHash('sha256').update(String(plain), 'utf8').digest('hex')
  return hashEquals(hash, stored)
}

/** true ถ้าค่าที่เก็บยังเป็นรูปแบบเก่า ควรอัปเกรด */
export const needsRehash = (stored) => !String(stored || '').startsWith('scrypt$')

// ═══════════════════════════════════════════════════════════════
//  จำกัดจำนวนครั้งที่เดารหัสผ่าน
// ═══════════════════════════════════════════════════════════════
// เก็บในหน่วยความจำของ instance — Vercel ใช้ instance เดิมซ้ำตอน warm
// จึงกันการยิงรัวได้จริงในทางปฏิบัติ (ไม่สมบูรณ์แบบเพราะ instance
// กระจายหลายตัว แต่ทำงานคู่กับ Vercel Firewall ที่กันชั้นนอกอยู่แล้ว)
const attempts = new Map()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 8

export function tooManyAttempts(key) {
  const rec = attempts.get(key)
  if (!rec) return false
  if (Date.now() > rec.until) {
    attempts.delete(key)
    return false
  }
  return rec.count >= MAX_ATTEMPTS
}

export function recordFailure(key) {
  const now = Date.now()
  const rec = attempts.get(key)
  if (!rec || now > rec.until) {
    attempts.set(key, { count: 1, until: now + WINDOW_MS })
  } else {
    rec.count++
    rec.until = now + WINDOW_MS // เดาผิดอีก = ขยายเวลาล็อกออกไป
  }
  // กันหน่วยความจำบวม
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (now > v.until) attempts.delete(k)
  }
}

export const clearFailures = (key) => attempts.delete(key)

/** ระบุตัวผู้ยิงจาก IP (Vercel ใส่มาให้ใน x-forwarded-for) */
export function clientKey(req) {
  const fwd = req.headers?.['x-forwarded-for'] || ''
  return String(fwd).split(',')[0].trim() || 'unknown'
}

// ═══════════════════════════════════════════════════════════════
//  กัน CSRF ชั้นที่สอง — ตรวจว่าคำขอมาจากเว็บเราเอง
// ═══════════════════════════════════════════════════════════════
// คู่กับ SameSite=Strict ของคุกกี้ เผื่อเบราว์เซอร์เก่าที่ไม่รู้จัก Strict
export function wrongOrigin(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return false
  const origin = req.headers?.origin
  if (!origin) return false // คำขอจากเครื่องมือ/แอป ไม่ใช่เบราว์เซอร์ — คุกกี้ไม่ถูกแนบมาเองอยู่แล้ว
  const host = req.headers?.host || ''
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

// ═══════════════════════════════════════════════════════════════
//  ตรวจสิทธิ์จริงทุกคำขอ — ไม่ใช่แค่ token ยังไม่หมดอายุ
// ═══════════════════════════════════════════════════════════════
// เดิมตรวจแค่ลายเซ็นกับวันหมดอายุ แปลว่าแอดมินกดระงับสมาชิกแล้ว
// คนนั้นยังใช้งานต่อได้จนกว่า token จะหมดอายุ (นานถึง 7 วัน)
// ตอนนี้ย้อนไปเช็คสถานะจริงทุกครั้ง แคชไว้ 60 วินาทีเพื่อไม่ให้ช้า
// → ระงับแล้วหลุดออกจากระบบภายในไม่เกิน 1 นาที
const statusCache = new Map()
const STATUS_TTL_MS = 60 * 1000

async function memberIsActive(email) {
  const now = Date.now()
  const hit = statusCache.get(email)
  if (hit && now < hit.exp) return hit.active
  let active = false
  try {
    const rec = await findMemberByEmail(email)
    active = rec?.status === 'active'
  } catch {
    // อ่านสถานะไม่ได้ → ถือว่าไม่ผ่าน (fail closed) ปลอดภัยไว้ก่อน
    active = false
  }
  statusCache.set(email, { active, exp: now + STATUS_TTL_MS })
  return active
}

/**
 * คืน session ที่ "ใช้ได้จริงตอนนี้" หรือ null
 * ใช้แทน sessionFromRequest ในทุก endpoint ที่หวงข้อมูล
 */
export async function activeSessionFromRequest(req) {
  const session = sessionFromRequest(req)
  if (!session) return null

  // แอดมินมาจาก env ไม่มี record ในคลังสมาชิก — เทียบกับอีเมลแอดมินปัจจุบัน
  if (session.role === 'admin') {
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
    return adminEmail && session.email === adminEmail ? session : null
  }

  return (await memberIsActive(session.email)) ? session : null
}

/** ล้างแคชสถานะของคนนี้ทันที (เรียกตอนแอดมินเปลี่ยนสถานะ) */
export const forgetMemberStatus = (email) => statusCache.delete((email || '').trim().toLowerCase())
