// Faceted passage search — text query + facet filters (deity / temple /
// class / year), with facet value aggregation for the dropdown filters.
// Scoring logic ported from the original phra-owat app/api/search/route.ts.

import { expandQueryTerms } from './passages.js'
import { getSearchIndex, countOccurrences } from './data.js'

const MAX_HITS = 50

function scorePassage(paraLower, terms, rawLower) {
  let score = 0
  const matched = []
  for (const term of terms) {
    if (!term) continue
    const occurrences = countOccurrences(paraLower, term)
    if (occurrences > 0) {
      matched.push(term)
      const isExact = term === rawLower || rawLower.includes(term) || term.includes(rawLower)
      const weight = isExact ? 3 : 1
      score += weight * (1 + 0.4 * (occurrences - 1))
    }
  }
  return { score, matched }
}

// Buddhist-era year of a teaching's date, or null.
function beYear(date) {
  if (!date) return null
  const y = new Date(date).getFullYear()
  return isNaN(y) ? null : y + 543
}

/**
 * Search + facet filter.
 * @param {string} query   free-text query ('' = browse everything)
 * @param {{deity?: string, temple?: string, category?: string, year?: string}} filters
 * @returns {{hits: object[], total: number, facets: object}}
 */
export function runSearch(query, filters = {}) {
  const rawQuery = (query || '').trim()
  const index = getSearchIndex()

  // ── 1. Query-match set (no facet filters yet) ──
  // With a query: teachings whose passages/deity/temple match, with the best
  // passage for snippeting. Without a query: every teaching (browse mode).
  const matches = []
  if (rawQuery) {
    const expanded = expandQueryTerms(rawQuery)
    const rawLower = rawQuery.toLowerCase()
    if (!expanded.includes(rawLower)) expanded.push(rawLower)

    for (const t of index) {
      let bestScore = 0
      let bestIdx = -1
      let bestMatched = []
      for (let i = 0; i < t.paragraphsLower.length; i++) {
        const { score, matched } = scorePassage(t.paragraphsLower[i], expanded, rawLower)
        if (score > bestScore) {
          bestScore = score
          bestIdx = i
          bestMatched = matched
        }
      }

      if (bestIdx !== -1) {
        matches.push({ t, idx: bestIdx, score: bestScore, matched: bestMatched, field: 'passage' })
        continue
      }
      const deityHit = expanded.some((term) => t.deityLower.includes(term))
      const templeHit = expanded.some(
        (term) =>
          t.templeLower.includes(term) || t.provinceLower.includes(term) || t.locationLower.includes(term),
      )
      if ((deityHit || templeHit) && t.paragraphs.length > 0) {
        matches.push({
          t,
          idx: 0,
          score: deityHit ? 0.5 : 0.4,
          matched: deityHit ? [t.deity].filter(Boolean) : [t.temple, t.province].filter(Boolean),
          field: deityHit ? 'deity' : 'temple',
        })
      }
    }
  } else {
    for (const t of index) {
      if (t.paragraphs.length === 0) continue
      matches.push({ t, idx: 0, score: 0, matched: [], field: 'passage' })
    }
  }

  // ── 2. Facet filter predicates ──
  const passes = (m, skip) => {
    const t = m.t
    if (skip !== 'deity' && filters.deity && t.deity !== filters.deity) return false
    if (skip !== 'temple' && filters.temple && (t.temple || '') !== filters.temple) return false
    if (skip !== 'category' && filters.category && (t.category || '') !== filters.category) return false
    if (skip !== 'year' && filters.year && String(beYear(t.date)) !== String(filters.year)) return false
    return true
  }

  // ── 3. Facet aggregation — for each dimension, apply the OTHER filters ──
  const aggregate = (dim, getValue) => {
    const counts = new Map()
    for (const m of matches) {
      if (!passes(m, dim)) continue
      const v = getValue(m.t)
      if (!v) continue
      counts.set(v, (counts.get(v) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }

  const facets = {
    deity: aggregate('deity', (t) => t.deity || ''),
    temple: aggregate('temple', (t) => t.temple || ''),
    category: aggregate('category', (t) => t.category || ''),
    year: aggregate('year', (t) => {
      const y = beYear(t.date)
      return y ? String(y) : ''
    }).sort((a, b) => Number(b[0]) - Number(a[0])),
  }

  // ── 4. Final hits — all filters applied ──
  const filtered = matches.filter((m) => passes(m, null))
  filtered.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Browse mode / ties: newest first
    return (b.t.date || '').localeCompare(a.t.date || '')
  })

  const hits = filtered.slice(0, MAX_HITS).map((m) => ({
    teachingId: m.t.id,
    deity: m.t.deity,
    temple: m.t.temple,
    province: m.t.province,
    country: m.t.country,
    date: m.t.date,
    category: m.t.category,
    paragraphIndex: m.idx,
    snippet: m.t.paragraphs[m.idx],
    matchedTerms: m.matched,
    score: m.score,
    matchedField: m.field,
  }))

  return { hits, total: filtered.length, facets }
}
