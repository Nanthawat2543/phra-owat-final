// GET /api/owat?random=true[&exclude=id,id]  → a random oracle passage
// GET /api/owat?random=true&question=...      → a question-guided passage
// GET /api/owat?id=<teachingId>               → one full teaching (for /full)

import { drawRandom, drawForQuestion } from './_lib/oracle.js'
import { getTeachingById } from './_lib/data.js'

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

export default function handler(req, res) {
  const { searchParams } = new URL(req.url, 'http://localhost')

  const id = searchParams.get('id')
  if (id) {
    const t = getTeachingById(id)
    if (!t) {
      res.status(404).json({ error: 'not found' })
      return
    }
    res.setHeader('Cache-Control', 'public, max-age=3600')
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
