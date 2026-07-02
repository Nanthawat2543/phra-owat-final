// GET /api/search?q=<query>&scope=all|passage|deity|temple

import { runSearch } from './_lib/search.js'

export default function handler(req, res) {
  const { searchParams } = new URL(req.url, 'http://localhost')
  const q = (searchParams.get('q') || '').trim()
  const scope = searchParams.get('scope') || 'all'

  if (!q) {
    res.status(200).json({ query: '', scope, hits: [], counts: { all: 0, passage: 0, deity: 0, temple: 0 } })
    return
  }

  const { hits, counts } = runSearch(q, scope)
  res.setHeader('Cache-Control', 'public, max-age=60')
  res.status(200).json({ query: q, scope, hits, counts })
}
