/**
 * ที่เดียวที่อ่าน/เขียนตารางสมาชิก
 *
 * ver1 เก็บสมาชิกเป็นไฟล์ใน Vercel Blob — CDN แคชค่าเก่าค้าง ทำให้อนุมัติแล้ว
 * ยังเข้าไม่ได้ ต้องเขียนไฟล์ path ใหม่ทุกครั้งแล้วลบของเก่า
 * ver2 ย้ายมาอยู่ในฐานข้อมูล ปัญหานี้หายไปทั้งคลาส
 */

import { db } from '../shared/db.js'
import { AppError } from '../shared/result.js'
import { normalizeEmail, type Member, type MemberStatus } from '../domain/member.js'

interface MemberRow {
  id: string
  email: string
  password_hash: string
  name: string
  dharma_title: string | null
  temple_name: string | null
  status: MemberStatus
  role: Member['role']
  reviewed_at: string | null
  last_login_at: string | null
  created_at: string
}

const MEMBER_FIELDS =
  'id, email, name, dharma_title, temple_name, status, role, reviewed_at, last_login_at, created_at'

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    dharmaTitle: row.dharma_title,
    templeName: row.temple_name,
    status: row.status,
    role: row.role,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    lastLoginAt: row.last_login_at,
  }
}

export interface NewMember {
  email: string
  passwordHash: string
  name: string
  dharmaTitle: string | null
  templeName: string | null
}

export class MemberRepository {
  async findByEmail(email: string): Promise<Member | null> {
    const { data, error } = await db()
      .from('members')
      .select(MEMBER_FIELDS)
      .eq('email', normalizeEmail(email))
      .maybeSingle()
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านข้อมูลสมาชิกไม่สำเร็จ', error.message)
    return data ? toMember(data as unknown as MemberRow) : null
  }

  /**
   * สมาชิกพร้อมรหัสผ่านที่เข้ารหัสไว้ — ใช้เฉพาะตอนตรวจการเข้าสู่ระบบ
   * แยกจาก findByEmail เพื่อให้ hash ไม่หลุดออกไปโดยไม่ตั้งใจ
   */
  async findByEmailWithHash(email: string): Promise<(Member & { passwordHash: string }) | null> {
    const { data, error } = await db()
      .from('members')
      .select(`${MEMBER_FIELDS}, password_hash`)
      .eq('email', normalizeEmail(email))
      .maybeSingle()
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านข้อมูลสมาชิกไม่สำเร็จ', error.message)
    if (!data) return null
    const row = data as unknown as MemberRow
    return { ...toMember(row), passwordHash: row.password_hash }
  }

  async findById(id: string): Promise<Member | null> {
    const { data, error } = await db()
      .from('members')
      .select(MEMBER_FIELDS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านข้อมูลสมาชิกไม่สำเร็จ', error.message)
    return data ? toMember(data as unknown as MemberRow) : null
  }

  async create(input: NewMember): Promise<Member> {
    const { data, error } = await db()
      .from('members')
      .insert({
        email: normalizeEmail(input.email),
        password_hash: input.passwordHash,
        name: input.name,
        dharma_title: input.dharmaTitle,
        temple_name: input.templeName,
        status: 'pending',
        role: 'member',
      })
      .select(MEMBER_FIELDS)
      .single()

    // 23505 = ค่าซ้ำกับ unique index (อีเมลนี้สมัครไปแล้ว)
    if (error?.code === '23505') {
      throw new AppError('DUPLICATE', 'อีเมลนี้สมัครสมาชิกไว้แล้ว')
    }
    if (error) throw new AppError('INTERNAL_ERROR', 'สมัครสมาชิกไม่สำเร็จ', error.message)
    return toMember(data as unknown as MemberRow)
  }

  /** ผู้ดูแลเปลี่ยนสถานะสมาชิก (อนุมัติ / ปฏิเสธ / ระงับ) */
  async setStatus(id: string, status: MemberStatus, reviewedBy: string): Promise<Member> {
    const { data, error } = await db()
      .from('members')
      .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select(MEMBER_FIELDS)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL_ERROR', 'เปลี่ยนสถานะสมาชิกไม่สำเร็จ', error.message)
    if (!data) throw new AppError('NOT_FOUND', 'ไม่พบสมาชิกรายนี้')
    return toMember(data as unknown as MemberRow)
  }

  async touchLastLogin(id: string): Promise<void> {
    await db().from('members').update({ last_login_at: new Date().toISOString() }).eq('id', id)
  }

  /** รายชื่อสมาชิกสำหรับหน้าจัดการ — รอตรวจสอบขึ้นก่อนเสมอ */
  async list(status?: MemberStatus): Promise<Member[]> {
    let q = db().from('members').select(MEMBER_FIELDS).order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านรายชื่อสมาชิกไม่สำเร็จ', error.message)

    const members = (data ?? []).map((r) => toMember(r as unknown as MemberRow))
    return members.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (b.status === 'pending' && a.status !== 'pending') return 1
      return b.createdAt.localeCompare(a.createdAt)
    })
  }
}

export const memberRepository = new MemberRepository()
