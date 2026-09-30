// GET /api/owat?random=true[&exclude=id,id]  → a random oracle passage
// GET /api/owat?random=true&question=...      → a question-guided passage
// GET /api/owat?id=<teachingId>               → one full teaching (for /full)
//
// ⚠️ สาธารณะเฉพาะ "สุ่ม" เท่านั้น — สุ่มคืนแค่ท่อนสั้นพอให้อ่านชี้แนะได้
//    ส่วน ?id= คืนพระโอวาททั้งฉบับ ต้องล็อกอินก่อน (เหมือน /api/search)
//    ไม่งั้นคนที่ยังไม่ล็อกอินกดจากหน้าสุ่มเข้าไปอ่านฉบับเต็มได้เฉยๆ

import { drawRandom, drawForQuestion } from './_lib/oracle.js'
import { getTeachingById } from './_lib/data.js'
import { activeSessionFromRequest } from './_lib/auth.js'

function passageResponse(p) {
  return {
    passage_id: p.passageId,
    teaching_id: p.teachingId,
    text: p.text,
    deity_th: p.deity_th,
    temple_th: p.temple_th,
    province_th: p.province_th,
    location_th: p.location_th,
    country: p.country,
    date: p.date,
    category: p.category,
    curated: p.curated,
  }
}

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, 'http://localhost')

  const id = searchParams.get('id')
  if (id) {
    if (!(await activeSessionFromRequest(req))) {
      res.setHeader('Cache-Control', 'private, no-store')
      res.status(401).json({
        error: 'กรุณาเข้าสู่ระบบก่อนอ่านฉบับเต็ม',
        code: 'unauthenticated',
      })
      return
    }
    const t = getTeachingById(id)
    if (!t) {
      res.status(404).json({ error: 'not found' })
      return
    }
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).json({
      id: t.id,
      content_th: t.content_th,
      deity_th: t.deity_th || '',
      temple_th: t.temple_th ?? null,
      province_th: t.province_th ?? null,
      location_th: t.location_th ?? null,
      country: t.country ?? null,
      date: t.date ?? null,
      category: t.category ?? null,
    })
    return
  }

  if (searchParams.get('random') === 'true') {
    const question = searchParams.get('question')
    const exclude = (searchParams.get('exclude') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50)

    const passage =
      question && question.trim() ? drawForQuestion(question.trim()) : drawRandom(exclude)

    if (!passage) {
      res.status(500).json({ error: 'no teachings available' })
      return
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.status(200).json(passageResponse(passage))
    return
  }

  res.status(400).json({ error: 'missing ?random=true or ?id=' })
}
