// Passage-extraction utilities — ported from the original phra-owat
// lib/passages.ts. Used by the oracle draw and passage-level search.

export const skipPatterns = [
  'พระโอวาทสิ่งศักดิ์สิทธิ์',
  'พระโอวาทอรหันต์',
  'พระโอวาทพระสงฆ์',
  'ประทานไว้เนื่อง',
  'ประทานเนื่องใน',
  'สาธุชนกราบขอประทาน',
  'น้อมจิตสงบ',
  'รับบัญชาจาก',
  'พระอนุตตรธรรมมารดา',
  'ลงสู่พุทธสถาน',
  'ลงสู่โลกา',
  'องค์มารดาผู้เมตตา',
  'องค์ชคัตตรยา',
  'แฝงกายเคียมคัล',
  'ถามศิษย์รักทุกคน',
  'วันเสาร์ที่',
  'วันอาทิตย์ที่',
  'วันอังคารที่',
  'วันจันทร์ที่',
  'พ.ศ.',
  'เราคือ',
  'ฮา ฮา',
  'ฮา  ฮา',
  'เข้าใจไหม',
]

export function isSkipLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (trimmed === 'ฮา' || trimmed === 'ฮา ฮา' || trimmed === 'ฮา  ฮา') return true
  for (const pattern of skipPatterns) {
    if (trimmed.includes(pattern)) return true
  }
  return false
}

export const MIN_QUOTE_LENGTH = 40
export const MAX_QUOTE_LENGTH = 300

export function splitIntoParagraphs(content) {
  const lines = content.split(/\n/).filter((l) => l.trim())
  const sentences = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (isSkipLine(trimmed)) continue

    const parts = trimmed.split(/\s{2,}/)
    for (const part of parts) {
      const clean = part.trim()
      if (!clean) continue

      if (clean.length <= MAX_QUOTE_LENGTH) {
        sentences.push(clean)
      } else {
        const words = clean.split(/\s+/)
        let chunk = ''
        for (const w of words) {
          if (chunk && (chunk + ' ' + w).length > MAX_QUOTE_LENGTH) {
            if (chunk.length >= MIN_QUOTE_LENGTH) sentences.push(chunk)
            chunk = w
          } else {
            chunk += (chunk ? ' ' : '') + w
          }
        }
        if (chunk.length >= MIN_QUOTE_LENGTH) sentences.push(chunk)
      }
    }
  }

  return sentences.filter(
    (s) =>
      s.length >= MIN_QUOTE_LENGTH &&
      s.length <= MAX_QUOTE_LENGTH &&
      /[ก-๙]/.test(s) &&
      !isJunkPassage(s)
  )
}

// ── Junk / metadata passage filter (high precision) ──
const ADDR_WORDS = ['จังหวัด', 'อำเภอ', 'ตำบล', 'เลขที่', 'ถนน']
const ADDR_ABBR = /(^|\s)(จ\.|อ\.|ต\.|ถ\.|ซ\.|ม\.)\s*\S/
const DATE_CODE = /\d{2}\.\d{2}\.\d{4}/
const FILE_EXT = /\.(docx?|pdf|jpe?g|png)\b/i

function looksLikeAddress(s) {
  return ADDR_WORDS.some((w) => s.includes(w)) || ADDR_ABBR.test(s)
}

export function isJunkPassage(s) {
  if (FILE_EXT.test(s)) return true
  if (s.includes('ศูนย์กลางธรรมกิจ') && s.length < 90) return true
  if (s.includes('ศูนย์กลางอาณาจักรธรรม') && s.length < 90) return true
  if (s.includes('คณะรับผิดชอบศูนย์กลาง')) return true
  if (s.includes('ฟาอีฉงเต๋อ') && s.includes('ประเทศไทย') && s.length < 120) return true

  const head = s.replace(/^[*>\s]+/, '')
  if (head.startsWith('ณ ') && (looksLikeAddress(s) || DATE_CODE.test(s))) return true
  if (head.startsWith('เขต') && s.includes('ฝอเอวี้ยน')) return true
  if (s.includes('ฝอเอวี้ยน') && (looksLikeAddress(s) || DATE_CODE.test(s))) return true
  if (s.includes('พุทธสถานไท่') && looksLikeAddress(s)) return true

  return false
}

export const popularTopics = [
  { label: 'ความรัก', query: 'ความรัก' },
  { label: 'ครอบครัว', query: 'ครอบครัว' },
  { label: 'กำลังใจ', query: 'กำลังใจ' },
  { label: 'ความทุกข์', query: 'ทุกข์' },
  { label: 'ท้อแท้', query: 'ท้อแท้' },
  { label: 'การงาน', query: 'งาน' },
  { label: 'จิตใจ', query: 'จิตใจ' },
  { label: 'อภัย', query: 'อภัย' },
  { label: 'บำเพ็ญ', query: 'บำเพ็ญ' },
  { label: 'ศรัทธา', query: 'ศรัทธา' },
]

// ค้นหาตรงตามคำที่พิมพ์เท่านั้น — ไม่ขยายคำพ้อง (Bug #4: ค้น "เมตตา" ต้องไม่แมตช์ "รัก")
// คำค้นหลายคำ (คั่นวรรค) จะค้นทั้งวลีเต็มและรายคำ
export function expandQueryTerms(query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const matched = new Set([q])
  q.split(/\s+/)
    .filter((w) => w.length > 1)
    .forEach((w) => matched.add(w))
  return [...matched]
}
