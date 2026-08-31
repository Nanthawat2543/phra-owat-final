/**
 * งานของผู้ดูแลระบบ — ดูรายชื่อสมาชิกและอนุมัติ/ปฏิเสธ/ระงับ
 *
 * ทุกฟังก์ชันตรวจสิทธิ์ผู้ดูแลก่อนเสมอ ไม่ฝากให้ชั้น api ตรวจให้
 * (ถ้าลืมตรวจที่ api สักที่เดียว ข้อมูลสมาชิกทั้งหมดจะหลุด)
 */

import type { Member, MemberStatus } from '../domain/member'
import { AppError } from '../shared/result'
import { memberRepository, type MemberRepository } from '../repositories/MemberRepository'
import type { SessionPayload } from './AuthService'

/** ข้อมูลสมาชิกที่ผู้ดูแลเห็น — ไม่มีรหัสผ่านไม่ว่ารูปแบบใด */
export interface MemberSummary {
  id: string
  email: string
  name: string
  dharmaTitle: string | null
  templeName: string | null
  status: MemberStatus
  role: Member['role']
  createdAt: string
  reviewedAt: string | null
  lastLoginAt: string | null
}

const STATUS_LABEL: Record<MemberStatus, string> = {
  pending: 'รอตรวจสอบ',
  active: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
  blocked: 'ระงับการใช้งาน',
}

function requireAdmin(actor: SessionPayload | null): SessionPayload {
  if (!actor) throw new AppError('UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบก่อน')
  if (actor.role !== 'admin') throw new AppError('FORBIDDEN', 'เฉพาะผู้ดูแลระบบเท่านั้น')
  return actor
}

function toSummary(m: Member): MemberSummary {
  return {
    id: m.id,
    email: m.email,
    name: m.name,
    dharmaTitle: m.dharmaTitle,
    templeName: m.templeName,
    status: m.status,
    role: m.role,
    createdAt: m.createdAt,
    reviewedAt: m.reviewedAt,
    lastLoginAt: m.lastLoginAt,
  }
}

export class MemberService {
  constructor(private readonly members: MemberRepository = memberRepository) {}

  /** รายชื่อสมาชิก — รายที่รอตรวจสอบขึ้นก่อน เพราะเป็นงานที่ต้องทำ */
  async list(actor: SessionPayload | null, status?: MemberStatus): Promise<MemberSummary[]> {
    requireAdmin(actor)
    return (await this.members.list(status)).map(toSummary)
  }

  /** จำนวนสมาชิกที่รอตรวจสอบ — ใช้ขึ้นตัวเลขแจ้งเตือนในเมนู */
  async countPending(actor: SessionPayload | null): Promise<number> {
    requireAdmin(actor)
    return (await this.members.list('pending')).length
  }

  /**
   * เปลี่ยนสถานะสมาชิก
   * ผู้ดูแลเปลี่ยนสถานะตัวเองไม่ได้ — กันเผลอตัดสิทธิ์ตัวเองจนไม่มีใครเข้าหลังบ้านได้
   */
  async setStatus(
    actor: SessionPayload | null,
    memberId: string,
    status: MemberStatus,
  ): Promise<MemberSummary> {
    const admin = requireAdmin(actor)
    if (!memberId) throw new AppError('VALIDATION_ERROR', 'ไม่ได้ระบุว่าจะเปลี่ยนสถานะของใคร')
    if (memberId === admin.sub) {
      throw new AppError('FORBIDDEN', 'เปลี่ยนสถานะบัญชีของตัวเองไม่ได้')
    }
    if (!(status in STATUS_LABEL)) {
      throw new AppError('VALIDATION_ERROR', `สถานะ "${status}" ไม่ถูกต้อง`)
    }
    return toSummary(await this.members.setStatus(memberId, status, admin.sub))
  }

  /** คำอธิบายสถานะภาษาไทย — ให้หน้าเว็บกับ LINE OA ใช้คำเดียวกัน */
  statusLabel(status: MemberStatus): string {
    return STATUS_LABEL[status]
  }
}

export const memberService = new MemberService()
