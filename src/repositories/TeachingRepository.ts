/**
 * ที่เดียวที่อ่าน/เขียนตารางพระโอวาท
 *
 * ชั้น service เรียกที่นี่เท่านั้น ห้ามเรียก db() ตรงจากชั้นบน
 * ประโยชน์: เปลี่ยนวิธีเก็บข้อมูลภายหลังก็แก้แค่ไฟล์นี้ไฟล์เดียว
 */

import { db } from '../shared/db'
import { AppError } from '../shared/result'
import type { Teaching, Passage } from '../domain/teaching'

/** พระโอวาทหนึ่งฉบับพร้อมท่อนที่เกี่ยวข้องกับคำค้น */
export interface TeachingWithPassages {
  teaching: Teaching
  passages: Pick<Passage, 'idx' | 'text'>[]
}

// รูปแบบแถวดิบที่ Supabase คืนมา (join ตารางอ้างอิงแล้ว)
interface TeachingRow {
  id: string
  legacy_id: string | null
  content?: string
  taught_on: string | null
  location_note: string | null
  status: Teaching['status']
  duplicate_of: string | null
  deities: { name: string } | null
  temples: { name: string; province: string | null; country: string } | null
  categories: { name: string } | null
}

const TEACHING_FIELDS = `
  id, legacy_id, taught_on, location_note, status, duplicate_of,
  deities ( name ),
  temples ( name, province, country ),
  categories ( name )
`

function toTeaching(row: TeachingRow): Teaching {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    content: row.content ?? '',
    deity: row.deities?.name ?? null,
    temple: row.temples?.name ?? null,
    province: row.temples?.province ?? null,
    country: row.temples?.country ?? 'ไทย',
    category: row.categories?.name ?? null,
    taughtOn: row.taught_on,
    locationNote: row.location_note,
    status: row.status,
    isDuplicate: row.duplicate_of !== null,
  }
}

/**
 * PostgREST ใช้เครื่องหมายพวกนี้เป็นไวยากรณ์ของตัวกรอง
 * ถ้าผู้ใช้พิมพ์มาตรงๆ ต้องหนีให้หมด ไม่งั้นค้นแล้วพัง
 */
function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[(),"]/g, ' ')
}

export class TeachingRepository {
  /**
   * ฉบับที่ "ยังใช้งานอยู่" ทั้งหมด พร้อมท่อนแรกของแต่ละฉบับ
   * ใช้ตอนเปิดหน้าค้นหาโดยยังไม่พิมพ์อะไร (โหมดเปิดดูทั้งหมด)
   */
  async listAllWithFirstPassage(): Promise<TeachingWithPassages[]> {
    const { data, error } = await db()
      .from('teachings')
      .select(`${TEACHING_FIELDS}, teaching_passages ( idx, text )`)
      .is('duplicate_of', null)
      .eq('status', 'published')
      .eq('teaching_passages.idx', 0)
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านรายการพระโอวาทไม่สำเร็จ', error.message)

    return (data ?? []).map((row) => {
      const r = row as unknown as TeachingRow & { teaching_passages: Pick<Passage, 'idx' | 'text'>[] }
      return { teaching: toTeaching(r), passages: r.teaching_passages ?? [] }
    })
  }

  /**
   * ฉบับที่มีท่อนตรงกับคำค้น พร้อมเฉพาะท่อนที่ตรง
   *
   * กรองหยาบที่ฐานข้อมูลก่อน (ILIKE บน index trgm) แล้วให้ชั้น service
   * ให้คะแนนละเอียดต่อ — แบ่งงานแบบนี้ทำให้ผลลัพธ์ตรงกับ ver1 เป๊ะ
   */
  async findByPassageText(terms: string[]): Promise<TeachingWithPassages[]> {
    if (terms.length === 0) return []
    const orFilter = terms.map((t) => `text.ilike.%${escapeLike(t)}%`).join(',')

    const { data, error } = await db()
      .from('teaching_passages')
      .select(`idx, text, teachings!inner ( ${TEACHING_FIELDS} )`)
      .or(orFilter)
      .is('teachings.duplicate_of', null)
      .eq('teachings.status', 'published')
    if (error) throw new AppError('INTERNAL_ERROR', 'ค้นหาพระโอวาทไม่สำเร็จ', error.message)

    // แถวที่ได้เป็นระดับ "ท่อน" — รวบกลับเป็นระดับ "ฉบับ" ให้ service ใช้ต่อ
    const byTeaching = new Map<string, TeachingWithPassages>()
    for (const row of data ?? []) {
      const r = row as unknown as { idx: number; text: string; teachings: TeachingRow }
      const t = r.teachings
      if (!t) continue
      let entry = byTeaching.get(t.id)
      if (!entry) {
        entry = { teaching: toTeaching(t), passages: [] }
        byTeaching.set(t.id, entry)
      }
      entry.passages.push({ idx: r.idx, text: r.text })
    }
    for (const entry of byTeaching.values()) entry.passages.sort((a, b) => a.idx - b.idx)
    return [...byTeaching.values()]
  }

  /**
   * ฉบับที่ชื่อองค์ผู้ประทาน / สถานธรรม / จังหวัด ตรงกับคำค้น
   * (ver1 ให้ผลกลุ่มนี้คะแนนต่ำกว่าท่อนที่ตรง และใช้ท่อนแรกเป็นตัวอย่าง)
   */
  async findByMetadata(terms: string[]): Promise<TeachingWithPassages[]> {
    if (terms.length === 0) return []
    const all = await this.listAllWithFirstPassage()
    const lowered = terms.map((t) => t.toLowerCase())
    return all.filter(({ teaching: t }) => {
      // รวม location_note ด้วย เพราะบางฉบับจับคู่กับตารางสถานธรรมไม่ได้
      // ชื่อสถานที่จึงอยู่ในข้อความดิบก้อนนี้ก้อนเดียว
      const haystacks = [t.deity, t.temple, t.province, t.locationNote]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
      return haystacks.some((h) => lowered.some((term) => h.includes(term)))
    })
  }

  /** เนื้อหาเต็มของฉบับหนึ่ง — เนื้อหาต้นฉบับ ไม่ผ่านการแก้ไขใดๆ */
  async findById(id: string): Promise<Teaching | null> {
    const { data, error } = await db()
      .from('teachings')
      .select(`${TEACHING_FIELDS}, content`)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านพระโอวาทไม่สำเร็จ', error.message)
    return data ? toTeaching(data as unknown as TeachingRow) : null
  }

  /** ค้นด้วย id เดิมจาก ver1 — ให้ลิงก์เก่าที่ทีมส่งต่อกันไว้ยังเปิดได้ */
  async findByLegacyId(legacyId: string): Promise<Teaching | null> {
    const { data, error } = await db()
      .from('teachings')
      .select(`${TEACHING_FIELDS}, content`)
      .eq('legacy_id', legacyId)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL_ERROR', 'อ่านพระโอวาทไม่สำเร็จ', error.message)
    return data ? toTeaching(data as unknown as TeachingRow) : null
  }

  /** จำนวนฉบับที่ใช้งานอยู่ — ใช้ตรวจว่าย้ายข้อมูลครบไหม */
  async countActive(): Promise<number> {
    const { count, error } = await db()
      .from('teachings')
      .select('id', { count: 'exact', head: true })
      .is('duplicate_of', null)
      .eq('status', 'published')
    if (error) throw new AppError('INTERNAL_ERROR', 'นับจำนวนพระโอวาทไม่สำเร็จ', error.message)
    return count ?? 0
  }
}

export const teachingRepository = new TeachingRepository()
