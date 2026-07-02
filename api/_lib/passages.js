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

// Topic keyword expansion — semantically related Thai terms for richer search.
export const keywordMap = {
  ทุกข์: ['ทุกข์', 'เจ็บ', 'ปวด', 'เศร้า', 'ร้องไห้', 'ลำบาก', 'ยาก', 'ความทุกข์', 'ทรมาน', 'ปวดใจ'],
  ท้อ: ['ท้อ', 'ท้อแท้', 'หมดกำลัง', 'หมดแรง', 'เหนื่อย', 'อ่อนแอ', 'ถอดใจ', 'หมดหวัง', 'สิ้นหวัง', 'ไม่ไหว'],
  เครียด: ['เครียด', 'กดดัน', 'หนักใจ', 'วุ่นวาย', 'ร้อนใจ', 'ไม่สบายใจ', 'เหนื่อยใจ', 'กังวล', 'กลุ้ม', 'กลุ้มใจ', 'หนักอก'],
  กลัว: ['กลัว', 'ห่วง', 'วิตก', 'กังวล', 'หวาด', 'กลัดกลุ้ม', 'ตกใจ', 'หวั่น'],
  รัก: ['รัก', 'ความรัก', 'เมตตา', 'เอ็นดู', 'อ่อนโยน', 'คนรัก', 'แฟน', 'คู่ครอง'],
  โกรธ: ['โกรธ', 'เกลียด', 'อาฆาต', 'พยาบาท', 'ไม่พอใจ', 'เคียดแค้น', 'โทสะ', 'อารมณ์', 'หงุดหงิด', 'โมโห'],
  สับสน: ['สับสน', 'ไม่รู้', 'ไม่เข้าใจ', 'หลงทาง', 'งง', 'ลังเล', 'กังขา', 'ไม่แน่ใจ', 'ตัดสินใจไม่ได้'],
  ปฏิบัติ: ['ปฏิบัติ', 'บำเพ็ญ', 'ธรรม', 'ศีล', 'สมาธิ', 'ปัญญา', 'ฝึกฝน', 'เพียร', 'ภาวนา', 'ทำดี'],
  ศรัทธา: ['ศรัทธา', 'เชื่อ', 'มั่นใจ', 'เชื่อมั่น', 'ศรัทธาจริง', 'ศรัทธาแท้'],
  อดทน: ['อดทน', 'ทน', 'อด', 'รอ', 'รอคอย', 'ขันติ', 'อึด'],
  กำลังใจ: ['กำลังใจ', 'เข้มแข็ง', 'สู้', 'พยายาม', 'มุ่งมั่น', 'เร่งบำเพ็ญ', 'ไม่ยอมแพ้', 'ลุกขึ้น'],
  ครอบครัว: ['ครอบครัว', 'พ่อ', 'แม่', 'ลูก', 'บ้าน', 'บรรพชน', 'พี่น้อง', 'สามี', 'ภรรยา', 'ผัว', 'เมีย'],
  งาน: ['งาน', 'การงาน', 'อาชีพ', 'หน้าที่', 'ภาระ', 'ทำงาน', 'เจ้านาย', 'ลูกน้อง', 'เพื่อนร่วมงาน'],
  เงิน: ['เงิน', 'ทรัพย์', 'ร่ำรวย', 'จน', 'หนี้', 'วัตถุ', 'ลาภ', 'รายได้', 'ค่าใช้จ่าย'],
  สุข: ['สุข', 'ความสุข', 'ยินดี', 'สงบ', 'สบาย', 'ดีใจ', 'เบิกบาน'],
  ชีวิต: ['ชีวิต', 'เกิด', 'ตาย', 'โลก', 'อนาคต', 'อดีต', 'เปลี่ยนแปลง', 'ก้าวต่อไป'],
  บุญ: ['บุญ', 'กุศล', 'ทำบุญ', 'บารมี', 'คุณธรรม', 'คุณงาม', 'ทำความดี'],
  กิเลส: ['กิเลส', 'ตัณหา', 'อัตตา', 'ทิฐิ', 'ยึดติด', 'หลง', 'มายา', 'โลภ', 'โลภะ'],
  จิตใจ: ['จิตใจ', 'จิต', 'ใจ', 'ดวงจิต', 'สติ', 'สมาธิ', 'จิตสงบ', 'นิ่ง'],
  สุขภาพ: ['สุขภาพ', 'ป่วย', 'ไม่สบาย', 'โรค', 'หาย', 'รักษา', 'ร่างกาย'],
  เหงา: ['เหงา', 'เดียวดาย', 'ไม่มีใคร', 'อ้างว้าง', 'ว้าเหว่', 'คิดถึง', 'โดดเดี่ยว'],
  อภัย: ['อภัย', 'ให้อภัย', 'ยกโทษ', 'ปล่อยวาง', 'วางลง', 'ปล่อย', 'วาง', 'คลาย'],
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

export function expandQueryTerms(query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const matched = new Set()
  for (const related of Object.values(keywordMap)) {
    for (const term of related) {
      if (q.includes(term)) {
        related.forEach((t) => matched.add(t))
        break
      }
    }
  }
  matched.add(q)
  q.split(/\s+/)
    .filter((w) => w.length > 1)
    .forEach((w) => matched.add(w))
  return [...matched]
}
