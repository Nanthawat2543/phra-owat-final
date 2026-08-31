/**
 * ที่เดียวที่อ่านตารางท่อนพระโอวาท (สำหรับการสุ่มเปิดรับ)
 *
 * ver1 แตกท่อน 44,915 ท่อนใหม่ทุกครั้งที่เซิร์ฟเวอร์ตื่น (383ms + แรม 64MB)
 * ver2 แตกไว้ตอนย้ายข้อมูลแล้ว ที่นี่แค่หยิบมาใช้
 */

import { db } from '../shared/db.js'
import { AppError } from '../shared/result.js'
import type { PassageWithSource } from '../domain/teaching.js'

interface PassageRow {
  id: string
  teaching_id: string
  idx: number
  text: string
  char_length: number
  is_quotable: boolean
  teachings: {
    id: string
    taught_on: string | null
    deities: { name: string } | null
    temples: { name: string; province: string | null } | null
    categories: { name: string } | null
  } | null
}

const PASSAGE_FIELDS = `
  id, teaching_id, idx, text, char_length, is_quotable,
  teachings!inner (
    id, taught_on,
    deities ( name ),
    temples ( name, province ),
    categories ( name )
  )
`

function toPassage(row: PassageRow): PassageWithSource {
  const t = row.teachings
  return {
    id: row.id,
    teachingId: row.teaching_id,
    idx: row.idx,
    text: row.text,
    charLength: row.char_length,
    isQuotable: row.is_quotable,
    teaching: {
      id: t?.id ?? row.teaching_id,
      deity: t?.deities?.name ?? null,
      temple: t?.temples?.name ?? null,
      province: t?.temples?.province ?? null,
      category: t?.categories?.name ?? null,
      taughtOn: t?.taught_on ?? null,
    },
  }
}

export class PassageRepository {
  /** จำนวนท่อนที่ยกมาแสดงเดี่ยวๆ ได้ — ใช้คำนวณตำแหน่งสุ่ม */
  async countQuotable(): Promise<number> {
    const { count, error } = await db()
      .from('teaching_passages')
      .select('id, teachings!inner(id)', { count: 'exact', head: true })
      .eq('is_quotable', true)
      .is('teachings.duplicate_of', null)
      .eq('teachings.status', 'published')
    if (error) throw new AppError('INTERNAL_ERROR', 'นับจำนวนท่อนไม่สำเร็จ', error.message)
    return count ?? 0
  }

  /**
   * หยิบท่อนที่ตำแหน่งที่กำหนด
   *
   * สุ่มด้วยการเลือก "ตำแหน่ง" แล้วดึงแถวเดียว ไม่โหลดทั้งคลังเข้าหน่วยความจำ
   * (ver1 โหลดทุกท่อนขึ้นแรมก่อนสุ่ม)
   */
  async findQuotableAt(offset: number): Promise<PassageWithSource | null> {
    const { data, error } = await db()
      .from('teaching_passages')
      .select(PASSAGE_FIELDS)
      .eq('is_quotable', true)
      .is('teachings.duplicate_of', null)
      .eq('teachings.status', 'published')
      .order('id', { ascending: true })
      .range(offset, offset)
    if (error) throw new AppError('INTERNAL_ERROR', 'สุ่มพระโอวาทไม่สำเร็จ', error.message)
    const row = (data ?? [])[0] as unknown as PassageRow | undefined
    return row ? toPassage(row) : null
  }

  /** ท่อนที่มีคำค้นอยู่ — ใช้ตอนผู้ใช้ตั้งคำถามก่อนเปิดรับ */
  async findQuotableMatching(terms: string[], limit = 200): Promise<PassageWithSource[]> {
    if (terms.length === 0) return []
    const orFilter = terms
      .map((t) => `text.ilike.%${t.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[(),"]/g, ' ')}%`)
      .join(',')

    const { data, error } = await db()
      .from('teaching_passages')
      .select(PASSAGE_FIELDS)
      .eq('is_quotable', true)
      .is('teachings.duplicate_of', null)
      .eq('teachings.status', 'published')
      .or(orFilter)
      .limit(limit)
    if (error) throw new AppError('INTERNAL_ERROR', 'ค้นหาท่อนไม่สำเร็จ', error.message)
    return (data ?? []).map((r) => toPassage(r as unknown as PassageRow))
  }

  async findById(id: string): Promise<PassageWithSource | null> {
    const { data, error } = await db()
      .from('teaching_passages')
      .select(PASSAGE_FIELDS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านท่อนพระโอวาทไม่สำเร็จ', error.message)
    return data ? toPassage(data as unknown as PassageRow) : null
  }
}

export const passageRepository = new PassageRepository()
