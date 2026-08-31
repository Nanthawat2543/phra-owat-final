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

// ทุกท่อนที่แตกได้ รวมท่อนที่สั้นหรือยาวเกินกว่าจะยกมาแสดงเดี่ยวๆ
//
// splitIntoParagraphs ทิ้งท่อนที่สั้นกว่า 40 หรือยาวกว่า 300 ตัวอักษร
// เพราะยกมาแสดงเป็นการ์ดแล้วไม่ได้ใจความ — แต่คำที่อยู่ในท่อนพวกนั้น
// ก็เลยค้นไม่เจอไปด้วย ทั้งที่อยู่ในต้นฉบับ
//
// ver2 เก็บทุกท่อนไว้ให้ค้นได้ครบ แล้วใช้ธง is_quotable แยกว่าท่อนไหน
// เหมาะยกมาแสดงเดี่ยวๆ (การสุ่มเปิดรับใช้เฉพาะท่อนที่ยกมาแสดงได้)
export function splitIntoSegments(content) {
  const lines = content.split(/\n/).filter((l) => l.trim())
  const segments = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (isSkipLine(trimmed)) continue

    for (const part of trimmed.split(/\s{2,}/)) {
      const clean = part.trim()
      if (!clean) continue

      if (clean.length <= MAX_QUOTE_LENGTH) {
        segments.push(clean)
        continue
      }
      // ท่อนยาวเกินการ์ด ตัดเป็นช่วงตามคำ — เก็บช่วงท้ายที่สั้นไว้ด้วย
      const words = clean.split(/\s+/)
      let chunk = ''
      for (const w of words) {
        if (chunk && (chunk + ' ' + w).length > MAX_QUOTE_LENGTH) {
          segments.push(chunk)
          chunk = w
        } else {
          chunk += (chunk ? ' ' : '') + w
        }
      }
      if (chunk) segments.push(chunk)
    }
  }

  return segments.filter((s) => /[ก-๙]/.test(s) && !isJunkPassage(s))
}

/** ท่อนนี้ยกมาแสดงเดี่ยวๆ ได้ไหม (สั้นไปอ่านไม่ได้ใจความ ยาวไปไม่เหมาะกับการ์ด) */
export function isQuotable(text) {
  return text.length >= MIN_QUOTE_LENGTH && text.length <= MAX_QUOTE_LENGTH
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

// ทำข้อความให้อยู่ในรูปที่ "ผู้ใช้เห็นจริง" — ล้าง markdown/ขยะแบบเดียวกับ
// stripMarkdown ฝั่ง UI (src/lib/format.ts) แล้วตัดช่องว่างทิ้ง
// ใช้เป็นคีย์ dedupe: สอง snippet ที่ต่างกันแค่ `>` หรือ `**` ต้องนับเป็นอันเดียวกัน
export function displayKey(text) {
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
