/**
 * อ่านพระโอวาทฉบับเต็ม
 *
 * ⚠️ เนื้อหาที่ส่งออกจากที่นี่เป็นต้นฉบับทุกตัวอักษร
 *    ไม่มีจุดไหนในระบบที่แก้ ตัด หรือเรียบเรียงเนื้อหาใหม่
 *    การล้างสัญลักษณ์จัดรูปแบบทำที่ฝั่งแสดงผลเท่านั้น และไม่เขียนกลับ
 */

import type { Teaching } from '../domain/teaching'
import { AppError } from '../shared/result'
import { teachingRepository, type TeachingRepository } from '../repositories/TeachingRepository'

export class TeachingService {
  constructor(private readonly teachings: TeachingRepository = teachingRepository) {}

  /**
   * อ่านฉบับเต็มด้วย id
   * รับทั้ง id ใหม่ (uuid) และ id เดิมจาก ver1 — ลิงก์เก่าที่ทีมส่งต่อกันไว้ยังเปิดได้
   */
  async getById(id: string): Promise<Teaching> {
    if (!id?.trim()) throw new AppError('VALIDATION_ERROR', 'ไม่ได้ระบุว่าจะอ่านฉบับไหน')

    const found = isUuid(id)
      ? await this.teachings.findById(id)
      : await this.teachings.findByLegacyId(id)
    if (!found) throw new AppError('NOT_FOUND', 'ไม่พบพระโอวาทฉบับนี้')
    return found
  }

  /** จำนวนพระโอวาทที่เปิดให้อ่าน — ใช้ตรวจว่าย้ายข้อมูลมาครบ */
  async count(): Promise<number> {
    return this.teachings.countActive()
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export const teachingService = new TeachingService()
