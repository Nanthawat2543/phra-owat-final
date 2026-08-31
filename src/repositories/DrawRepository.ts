/**
 * ที่เดียวที่อ่าน/เขียนบันทึกการเปิดรับพระโอวาทประจำวัน
 *
 * ver1 จำกัดวันละครั้งด้วย localStorage ฝั่งเบราว์เซอร์ — ล้างข้อมูลหรือ
 * เปลี่ยนเครื่องก็สุ่มใหม่ได้ ver2 ย้ายมาบังคับที่ฐานข้อมูล
 */

import { db } from '../shared/db'
import { AppError } from '../shared/result'

export interface DrawOwner {
  memberId?: string | null
  guestKey?: string | null
}

export interface DrawRecord {
  id: string
  passageId: string
  drawDate: string
}

interface DrawRow {
  id: string
  passage_id: string
  draw_date: string
}

function ownerFilter(owner: DrawOwner) {
  if (owner.memberId) return { column: 'member_id', value: owner.memberId }
  if (owner.guestKey) return { column: 'guest_key', value: owner.guestKey }
  throw new AppError('VALIDATION_ERROR', 'ไม่รู้ว่าเป็นการเปิดรับของใคร')
}

export class DrawRepository {
  /** การเปิดรับของวันนี้ (ถ้ามี) — ใช้ตอบกลับผลเดิมแทนการสุ่มใหม่ */
  async findForDate(owner: DrawOwner, date: string): Promise<DrawRecord | null> {
    const f = ownerFilter(owner)
    const { data, error } = await db()
      .from('daily_draws')
      .select('id, passage_id, draw_date')
      .eq(f.column, f.value)
      .eq('draw_date', date)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านประวัติการเปิดรับไม่สำเร็จ', error.message)
    if (!data) return null
    const row = data as unknown as DrawRow
    return { id: row.id, passageId: row.passage_id, drawDate: row.draw_date }
  }

  /**
   * บันทึกการเปิดรับของวันนี้
   *
   * ฐานข้อมูลมี unique index วันละหนึ่งครั้งต่อคน — ถ้าสองคำขอมาพร้อมกัน
   * ตัวที่สองจะชนแล้วได้ผลของตัวแรกไป ไม่เกิดสองรายการในวันเดียว
   */
  async record(owner: DrawOwner, date: string, passageId: string): Promise<DrawRecord> {
    const { data, error } = await db()
      .from('daily_draws')
      .insert({
        member_id: owner.memberId ?? null,
        guest_key: owner.memberId ? null : (owner.guestKey ?? null),
        draw_date: date,
        passage_id: passageId,
      })
      .select('id, passage_id, draw_date')
      .single()

    if (error?.code === '23505') {
      const existing = await this.findForDate(owner, date)
      if (existing) return existing
    }
    if (error) throw new AppError('INTERNAL_ERROR', 'บันทึกการเปิดรับไม่สำเร็จ', error.message)
    const row = data as unknown as DrawRow
    return { id: row.id, passageId: row.passage_id, drawDate: row.draw_date }
  }

  /** ท่อนที่เพิ่งได้ไปในช่วงหลัง — ใช้เลี่ยงไม่ให้สุ่มซ้ำเร็วเกินไป */
  async recentPassageIds(owner: DrawOwner, limit = 20): Promise<string[]> {
    const f = ownerFilter(owner)
    const { data, error } = await db()
      .from('daily_draws')
      .select('passage_id')
      .eq(f.column, f.value)
      .order('draw_date', { ascending: false })
      .limit(limit)
    if (error) return []
    return (data ?? []).map((r) => (r as { passage_id: string }).passage_id)
  }
}

export const drawRepository = new DrawRepository()
