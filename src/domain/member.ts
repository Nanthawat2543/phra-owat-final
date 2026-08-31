/**
 * สมาชิก — โครงสร้างข้อมูลและกฎการเข้าใช้งาน
 */

export type MemberStatus = 'pending' | 'active' | 'rejected' | 'blocked'
export type MemberRole = 'member' | 'admin'

export interface Member {
  id: string
  email: string
  name: string
  dharmaTitle: string | null // ตำแหน่งทางธรรม
  templeName: string | null // สถานธรรมที่สังกัด
  status: MemberStatus
  role: MemberRole
  createdAt: string
  reviewedAt: string | null
  lastLoginAt: string | null
}

/** ข้อมูลที่ส่งกลับให้ฝั่งหน้าเว็บ — ไม่มีรหัสผ่านหรือข้อมูลภายใน */
export interface PublicMember {
  id: string
  email: string
  name: string
  role: MemberRole
}

export function toPublicMember(m: Member): PublicMember {
  return { id: m.id, email: m.email, name: m.name, role: m.role }
}

/** เข้าสู่ระบบได้เฉพาะสมาชิกที่อนุมัติแล้ว */
export function canSignIn(status: MemberStatus): boolean {
  return status === 'active'
}

/** ข้อความอธิบายสาเหตุที่เข้าไม่ได้ — แสดงให้ผู้ใช้อ่านตรงๆ */
export const SIGN_IN_BLOCKED_REASON: Record<Exclude<MemberStatus, 'active'>, string> = {
  pending: 'บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ',
  rejected: 'บัญชีของคุณไม่ได้รับอนุมัติ กรุณาติดต่อผู้ดูแลระบบ',
  blocked: 'บัญชีของคุณถูกระงับการใช้งาน',
}

// ── กฎการสมัครสมาชิก ──

export const MIN_PASSWORD_LENGTH = 8

export interface RegisterInput {
  name: string
  dharmaTitle: string
  templeName: string
  email: string
  password: string
  confirmPassword: string
}

/** ตรวจข้อมูลสมัครสมาชิก คืนข้อความผิดพลาดภาษาไทย (null = ผ่าน) */
export function validateRegistration(input: Partial<RegisterInput>): string | null {
  const required: [keyof RegisterInput, string][] = [
    ['name', 'ชื่อ-นามสกุล'],
    ['dharmaTitle', 'ตำแหน่งทางธรรม'],
    ['templeName', 'สถานธรรม'],
    ['email', 'อีเมล'],
    ['password', 'รหัสผ่าน'],
  ]
  for (const [key, label] of required) {
    if (!String(input[key] ?? '').trim()) return `กรุณากรอก${label}`
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email))) {
    return 'รูปแบบอีเมลไม่ถูกต้อง'
  }
  if (String(input.password).length < MIN_PASSWORD_LENGTH) {
    return `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`
  }
  if (input.password !== input.confirmPassword) {
    return 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน'
  }
  return null
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
