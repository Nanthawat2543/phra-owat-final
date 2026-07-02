// GET /api/search?q=<query>&deity=&temple=&category=&year=
// Free-text query is optional — facet filters alone also return results
// (browse mode). Response includes facet value counts for the dropdowns.

import { runSearch } from './_lib/search.js'

export default function handler(req, res) {
  const { searchParams } = new URL(req.url, 'http://localhost')
  const q = (searchParams.get('q') || '').trim()
  const filters = {
    deity: (searchParams.get('deity') || '').trim(),
    temple: (searchParams.get('temple') || '').trim(),
    category: (searchParams.get('category') || '').trim(),
    year: (searchParams.get('year') || '').trim(),
  }

  const { hits, total, facets } = runSearch(q, filters)
  res.setHeader('Cache-Control', 'public, max-age=60')
  res.status(200).json({ query: q, filters, hits, total, facets })
}
