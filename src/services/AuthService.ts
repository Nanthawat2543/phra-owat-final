/**
 * สมัครสมาชิก เข้าสู่ระบบ และการรักษาสถานะการเข้าใช้งาน
 *
 * เปลี่ยนจาก ver1 สองเรื่องสำคัญ:
 *   1. รหัสผ่านเก็บด้วย bcrypt (ver1 ใช้ sha256 เปล่าๆ ไม่มี salt —
 *      คนที่ได้ฐานข้อมูลไปเทียบกับตารางสำเร็จรูปได้ทันที)
 *   2. สมาชิกอยู่ในฐานข้อมูล (ver1 อยู่ในไฟล์ Blob ที่ CDN แคชค่าเก่าค้าง
 *      จนอนุมัติแล้วยังเข้าไม่ได้)
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import {
  canSignIn,
  normalizeEmail,
  toPublicMember,
  validateRegistration,
  SIGN_IN_BLOCKED_REASON,
  type Member,
  type PublicMember,
  type RegisterInput,
} from '../domain/member.js'
import { authConfig } from '../shared/config.js'
import { AppError } from '../shared/result.js'
import { memberRepository, type MemberRepository } from '../repositories/MemberRepository.js'

const BCRYPT_ROUNDS = 10

export interface SessionPayload {
  sub: string // id สมาชิก
  email: string
  name: string
  role: Member['role']
  exp: number
}

const b64url = (input: string | Buffer): string => Buffer.from(input).toString('base64url')

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

export class AuthService {
  constructor(private readonly members: MemberRepository = memberRepository) {}

  /**
   * สมัครสมาชิก — สมัครแล้วยังเข้าใช้งานไม่ได้จนกว่าผู้ดูแลจะอนุมัติ
   * (ทีมต้องการคัดกรองก่อน ไม่เปิดให้ใครก็สมัครแล้วเข้าได้เลย)
   */
  async register(input: Partial<RegisterInput>): Promise<PublicMember> {
    const problem = validateRegistration(input)
    if (problem) throw new AppError('VALIDATION_ERROR', problem)

    const email = normalizeEmail(String(input.email))
    if (await this.members.findByEmail(email)) {
      throw new AppError('DUPLICATE', 'อีเมลนี้สมัครสมาชิกไว้แล้ว')
    }

    const member = await this.members.create({
      email,
      passwordHash: await bcrypt.hash(String(input.password), BCRYPT_ROUNDS),
      name: String(input.name).trim(),
      dharmaTitle: String(input.dharmaTitle ?? '').trim() || null,
      templeName: String(input.templeName ?? '').trim() || null,
    })
    return toPublicMember(member)
  }

  /**
   * เข้าสู่ระบบ — คืน token สำหรับใส่คุกกี้
   *
   * แยกข้อความ "รหัสผ่านไม่ถูกต้อง" กับ "รออนุมัติ" ให้ชัด เพราะสมาชิกที่รอ
   * อนุมัติอยู่จะได้ไม่เข้าใจผิดว่าตัวเองพิมพ์รหัสผิด (ปัญหาที่ทีมแจ้งใน ver1)
   */
  async login(email: string, password: string): Promise<{ token: string; user: PublicMember }> {
    if (!email?.trim() || !password) {
      throw new AppError('VALIDATION_ERROR', 'กรุณากรอกอีเมลและรหัสผ่าน')
    }

    const record = await this.members.findByEmailWithHash(email)
    // เทียบรหัสผ่านกับ hash หลอกเมื่อไม่พบบัญชี ให้เวลาตอบกลับเท่ากันทั้งสองกรณี
    // (ไม่งั้นคนภายนอกจับเวลาแล้วรู้ว่าอีเมลไหนมีอยู่จริง)
    const hash = record?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv'
    const passwordOk = await bcrypt.compare(password, hash)

    if (!record || !passwordOk) {
      throw new AppError('UNAUTHENTICATED', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    }
    if (!canSignIn(record.status)) {
      const code = record.status === 'pending' ? 'PENDING_APPROVAL' : 'ACCOUNT_BLOCKED'
      throw new AppError(code, SIGN_IN_BLOCKED_REASON[record.status])
    }

    await this.members.touchLastLogin(record.id)
    const user = toPublicMember(record)
    return { token: this.signSession(record), user }
  }

  /** ผู้ใช้ที่กำลังเข้าใช้งานอยู่ (null = ยังไม่เข้าสู่ระบบ) */
  async currentUser(token: string | null): Promise<PublicMember | null> {
    const payload = this.verifySession(token)
    if (!payload) return null

    // อ่านจากฐานข้อมูลซ้ำ เพราะสิทธิ์อาจถูกถอนหลังออก token ไปแล้ว
    const member = await this.members.findById(payload.sub)
    if (!member || !canSignIn(member.status)) return null
    return toPublicMember(member)
  }

  // ── token ──
  // JWT ลงลายเซ็นด้วย HMAC-SHA256 เก็บในคุกกี้ httpOnly
  // (ไม่ใช้ session ฝั่งเซิร์ฟเวอร์ เพราะ serverless ไม่มีหน่วยความจำร่วมกัน)

  signSession(member: Pick<Member, 'id' | 'email' | 'name' | 'role'>): string {
    const { secret, sessionDays } = authConfig()
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload: SessionPayload = {
      sub: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      exp: Math.floor(Date.now() / 1000) + sessionDays * 86400,
    }
    const body = b64url(JSON.stringify(payload))
    const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
    return `${header}.${body}.${signature}`
  }

  verifySession(token: string | null): SessionPayload | null {
    if (!token) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, body, signature] = parts
    const expected = createHmac('sha256', authConfig().secret)
      .update(`${header}.${body}`)
      .digest('base64url')
    if (!constantTimeEquals(signature, expected)) return null

    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
      if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
      return payload
    } catch {
      return null
    }
  }

  /** คุกกี้สำหรับตั้ง/ล้างสถานะการเข้าใช้งาน */
  sessionCookie(token: string, { clear = false } = {}): string {
    const { cookieName, sessionDays } = authConfig()
    const secure = process.env.VERCEL ? '; Secure' : ''
    const base = `Path=/; HttpOnly; SameSite=Lax${secure}`
    if (clear) return `${cookieName}=; ${base}; Max-Age=0`
    return `${cookieName}=${encodeURIComponent(token)}; ${base}; Max-Age=${sessionDays * 86400}`
  }
}

export const authService = new AuthService()
