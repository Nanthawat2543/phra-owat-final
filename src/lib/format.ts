// Shared display helpers + API response shapes for the พระโอวาท frontend.

export interface Passage {
  passage_id: string
  teaching_id: string
  text: string
  deity_th: string
  temple_th: string | null
  province_th: string | null
  location_th: string | null
  country: string | null
  date: string | null
  category: string | null
  curated?: boolean
}

export interface Teaching {
  id: string
  content_th: string
  deity_th: string
  temple_th: string | null
  province_th: string | null
  location_th: string | null
  country: string | null
  date: string | null
  category: string | null
}

export interface SearchHit {
  teachingId: string
  paragraphIndex: number
  snippet: string
  matchedTerms: string[]
  score: number
  deity: string
  temple: string | null
  province: string | null
  country: string | null
  date: string | null
  category: string | null
  matchedField: 'passage' | 'deity' | 'temple'
}

const THAI_DAYS = [
  'วันอาทิตย์',
  'วันจันทร์',
  'วันอังคาร',
  'วันพุธ',
  'วันพฤหัสบดี',
  'วันศุกร์',
  'วันเสาร์',
]
const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

/** "2009-08-08" → "วันเสาร์ที่ 8 สิงหาคม พ.ศ. 2552". Falls back to raw string. */
export function thaiDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`
}

/**
 * Strip Markdown formatting markers (headings `#`, blockquote `>`, bold/italic
 * `*`) that live in the source content, keeping the manuscript words intact.
 */
export function stripMarkdown(line: string): string {
  return line
    .replace(/^#{1,9}\s*/, '')
    .replace(/^>\s*/, '')
    .replace(/\*+/g, '')
    .replace(/\\(?=[.\s]|$)/g, '')
    .trim()
}

/** Build a place label from temple/province/location fields. */
export function placeLabel(p: {
  temple_th?: string | null
  province_th?: string | null
  location_th?: string | null
}): string {
  const parts: string[] = []
  if (p.temple_th) parts.push(p.temple_th)
  if (p.province_th) parts.push(`จ.${p.province_th}`)
  if (parts.length > 0) return parts.join(' · ')
  return p.location_th || ''
}
