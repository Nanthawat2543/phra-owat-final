/**
 * กฎการค้นหา — ฟังก์ชันบริสุทธิ์ ไม่ยุ่งกับฐานข้อมูลหรือ HTTP
 *
 * ยกตรรกะการให้คะแนนมาจาก ver1 (api/_lib/search.js) ทั้งหมด
 * เพื่อให้ผลค้นหาของ ver2 ตรงกับ ver1 ทุกคำ — ทีมทดสอบเทียบได้
 */

/**
 * คำที่ใช้ค้นจริงจากสิ่งที่ผู้ใช้พิมพ์
 *
 * ค้นตรงตามคำที่พิมพ์เท่านั้น ไม่ขยายคำพ้อง
 * (ver1 เคยขยายแล้วเกิดปัญหา: ค้น "เมตตา" ไปแมตช์ "รัก" ด้วย)
 * คำค้นหลายคำคั่นวรรค จะค้นทั้งวลีเต็มและรายคำ
 */
export function expandQueryTerms(query: string): string[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const terms = new Set([q])
  q.split(/\s+/)
    .filter((w) => w.length > 1)
    .forEach((w) => terms.add(w))
  return [...terms]
}

/** นับจำนวนครั้งที่พบคำ แบบไม่ซ้อนทับกัน (ไม่สร้าง substring ใหม่) */
export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let i = haystack.indexOf(needle)
  while (i !== -1) {
    count++
    i = haystack.indexOf(needle, i + needle.length)
  }
  return count
}

export interface PassageScore {
  score: number
  matched: string[]
}

/**
 * คะแนนความตรงของท่อนหนึ่งกับคำค้น
 *
 * คำที่ตรงกับที่ผู้ใช้พิมพ์เป๊ะได้น้ำหนัก 3 เท่าของคำย่อย
 * เจอซ้ำหลายครั้งในท่อนเดียวได้คะแนนเพิ่มทีละ 40%
 */
export function scorePassage(
  passageLower: string,
  terms: string[],
  rawLower: string,
): PassageScore {
  let score = 0
  const matched: string[] = []
  for (const term of terms) {
    if (!term) continue
    const occurrences = countOccurrences(passageLower, term)
    if (occurrences === 0) continue
    matched.push(term)
    const isExact = term === rawLower || rawLower.includes(term) || term.includes(rawLower)
    const weight = isExact ? 3 : 1
    score += weight * (1 + 0.4 * (occurrences - 1))
  }
  return { score, matched }
}

/** ปีพุทธศักราชจากวันที่ (null ถ้าไม่มีวันที่หรือวันที่เสีย) */
export function beYear(date: string | null): number | null {
  if (!date) return null
  const y = new Date(date).getFullYear()
  return Number.isNaN(y) ? null : y + 543
}

/** จำนวนผลลัพธ์ต่อหน้า — ตรงกับ ver1 */
export const PAGE_SIZE = 50

export type FacetName = 'deity' | 'temple' | 'category' | 'year'

export type SearchFilters = Partial<Record<FacetName, string>>

/** ตัวเลือกฟิลเตอร์พร้อมจำนวนผลลัพธ์ เรียงจากมากไปน้อย */
export type FacetCounts = Record<FacetName, [string, number][]>
