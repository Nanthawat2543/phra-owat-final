/**
 * พระโอวาท — โครงสร้างข้อมูลและกฎของเนื้อหา
 *
 * ⚠️ กฎเหล็กของโปรเจกต์: เนื้อหาพระโอวาท (content) ต้องตรงต้นฉบับ 100%
 *    ห้ามเพิ่ม ตัด แต่ง หรือเรียบเรียงใหม่ ไม่ว่ากรณีใด
 *    ฟังก์ชันในไฟล์นี้ที่ "ล้าง" ข้อความ ใช้เพื่อ *เปรียบเทียบ* หรือ *แสดงผล* เท่านั้น
 *    ไม่เคยเขียนทับเนื้อหาที่เก็บไว้
 */

export type TeachingStatus = 'draft' | 'published' | 'archived'

/** พระโอวาท 1 ฉบับ */
export interface Teaching {
  id: string
  legacyId: string | null
  content: string // ต้นฉบับ — ห้ามแก้
  deity: string | null // องค์ผู้ประทาน
  temple: string | null // สถานธรรม
  province: string | null
  country: string
  category: string | null // ชั้นเรียน
  taughtOn: string | null // YYYY-MM-DD (null = ไม่ระบุวันที่)
  /**
   * ข้อความสถานที่ดิบจากต้นฉบับ — เก็บไว้เพราะบางฉบับจับคู่กับตารางสถานธรรมไม่ได้
   * ใช้เป็นทางค้นสำรอง ไม่ใช้แสดงผล
   */
  locationNote: string | null
  status: TeachingStatus
  isDuplicate: boolean // เนื้อหาซ้ำกับฉบับอื่น (เก็บไว้ ไม่ลบ)
}

/** ท่อนหนึ่งของพระโอวาท ที่ยกมาแสดงหรือใช้ค้นหาได้ */
export interface Passage {
  id: string
  teachingId: string
  idx: number
  text: string // ตรงต้นฉบับ
  charLength: number
  isQuotable: boolean
}

/** ท่อนพร้อมข้อมูลฉบับที่มันอยู่ — ใช้แสดงผลค้นหาและการสุ่ม */
export interface PassageWithSource extends Passage {
  teaching: Pick<Teaching, 'id' | 'deity' | 'temple' | 'province' | 'category' | 'taughtOn'>
}

// ── กฎของท่อนที่ยกมาแสดงได้ ──
// สั้นเกินไปอ่านแล้วไม่ได้ใจความ ยาวเกินไปไม่เหมาะกับการ์ด
export const MIN_QUOTE_LENGTH = 40
export const MAX_QUOTE_LENGTH = 300

export function isQuotable(text: string): boolean {
  const len = text.trim().length
  return len >= MIN_QUOTE_LENGTH && len <= MAX_QUOTE_LENGTH && /[ก-๙]/.test(text)
}

/**
 * แปลงข้อความให้อยู่ในรูปที่ผู้อ่านเห็นจริง (ตัดสัญลักษณ์จัดรูปแบบและช่องว่าง)
 * ใช้เป็นกุญแจเปรียบเทียบว่าสองข้อความ "ซ้ำกันในสายตาผู้อ่าน" หรือไม่
 *
 * ไม่ใช่การแก้เนื้อหา — ต้นฉบับยังอยู่ครบเสมอ
 */
export function toComparableText(text: string): string {
  return String(text || '')
    .replace(/\{[^}]*(?:width|height)=[^}]*\}/gi, '') // ขยะจากการแปลงไฟล์ Word
    .replace(/[*>#\\]/g, '') // สัญลักษณ์จัดรูปแบบ
    .replace(/-{2,}/g, '') // เส้นคั่น
    .replace(/\s+/g, '')
}

/**
 * กุญแจเปรียบเทียบสำหรับ "ท่อนเดียว" (snippet)
 *
 * ต่างจาก toComparableText ที่ใช้กับเนื้อหาเต็มฉบับ: ท่อนเดียวมี `#` หรือ `>`
 * ได้แค่ต้นข้อความ ถ้าล้างทุกตำแหน่งจะไปรวมท่อนที่ผู้อ่านเห็นเป็นคนละข้อความ
 * เข้าด้วยกัน แล้วผลค้นหาหายไปโดยไม่ควรหาย
 *
 * กติกาที่นี่ตรงกับ stripMarkdown ของหน้าเว็บ (src/lib/format.ts) ทุกข้อ
 * เพราะสองท่อนจะ "ซ้ำ" ก็ต่อเมื่อแสดงผลออกมาเหมือนกันจริง
 */
export function toSnippetKey(text: string): string {
  return String(text || '')
    .replace(/^#{1,9}\s*/, '')
    .replace(/^>\s*/, '')
    .replace(/\*+/g, '')
    .replace(/\{[^}]*(?:width|height)=[^}]*\}/gi, '')
    .replace(/\\-/g, '-')
    .replace(/(?:^|\s)-{2,}(?:\s|$)/g, ' ')
    .replace(/\\(?=[.\s-]|$)/g, '')
    .replace(/\s+/g, '')
    .trim()
}

/**
 * ล้างสัญลักษณ์จัดรูปแบบออกเพื่อ "แสดงผล" — คงช่องว่างและการเว้นวรรคไว้
 * (ต่างจาก toComparableText ที่ตัดช่องว่างทิ้งหมดเพราะใช้เทียบอย่างเดียว)
 */
export function toDisplayText(text: string): string {
  return String(text || '')
    .replace(/^#{1,9}\s*/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/\*+/g, '')
    .replace(/\{[^}]*(?:width|height)=[^}]*\}/gi, '')
    .replace(/\\-/g, '-')
    .replace(/(?:^|\s)-{2,}(?:\s|$)/g, ' ')
    .replace(/\\(?=[.\s-]|$)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** ป้ายสถานที่สำหรับแสดงผล เช่น "ไท่ซิน · จ.ชลบุรี" */
export function formatPlace(t: Pick<Teaching, 'temple' | 'province'>): string {
  const parts: string[] = []
  if (t.temple) parts.push(t.temple)
  if (t.province) parts.push(`จ.${t.province}`)
  return parts.join(' · ')
}

/** ปีพุทธศักราชจากวันที่ (null ถ้าไม่มีวันที่) */
export function buddhistYear(date: string | null): number | null {
  if (!date) return null
  const y = new Date(date).getFullYear()
  return Number.isNaN(y) ? null : y + 543
}
