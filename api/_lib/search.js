// Passage/deity/temple search — ported from the original phra-owat
// app/api/search/route.ts runSearch(). Operates on the in-memory index.

import { expandQueryTerms } from './passages.js'
import { getSearchIndex, countOccurrences } from './data.js'

const MAX_HITS = 50

function fieldMatches(valueLower, terms) {
  if (!valueLower) return false
  return terms.some((t) => valueLower.includes(t))
}

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

/**
 * Search the corpus.
 * @param {string} query
 * @param {'all'|'passage'|'deity'|'temple'} scope
 * @returns {{hits: object[], counts: object}}
 */
export function runSearch(query, scope = 'all') {
  const rawQuery = (query || '').trim()
  if (!rawQuery) {
    return { hits: [], counts: { all: 0, passage: 0, deity: 0, temple: 0 } }
  }

  const expanded = expandQueryTerms(rawQuery)
  const rawLower = rawQuery.toLowerCase()
  if (!expanded.includes(rawLower)) expanded.push(rawLower)

  const index = getSearchIndex()
  const hits = []

  let passageCount = 0
  let deityTotal = 0
  let templeTotal = 0
  let deityOnly = 0
  let templeOnly = 0

  for (const t of index) {
    const deityHit = fieldMatches(t.deityLower, expanded)
    const templeHit =
      fieldMatches(t.templeLower, expanded) ||
      fieldMatches(t.provinceLower, expanded) ||
      fieldMatches(t.locationLower, expanded)

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
    const hasPassageHit = bestIdx !== -1

    if (hasPassageHit) passageCount += 1
    if (deityHit) deityTotal += 1
    if (templeHit) templeTotal += 1
    if (deityHit && !hasPassageHit) deityOnly += 1
    if (templeHit && !hasPassageHit && !deityHit) templeOnly += 1

    const meta = {
      teachingId: t.id,
      deity: t.deity,
      temple: t.temple,
      province: t.province,
      country: t.country,
      date: t.date,
      category: t.category,
    }

    const pushPassage = () =>
      hits.push({
        ...meta,
        paragraphIndex: bestIdx,
        snippet: t.paragraphs[bestIdx],
        matchedTerms: bestMatched,
        score: bestScore,
        matchedField: 'passage',
      })

    const pushDeity = () => {
      if (t.paragraphs.length === 0) return
      hits.push({
        ...meta,
        paragraphIndex: 0,
        snippet: t.paragraphs[0],
        matchedTerms: [t.deity].filter(Boolean),
        score: 0.5,
        matchedField: 'deity',
      })
    }

    const pushTemple = () => {
      if (t.paragraphs.length === 0) return
      hits.push({
        ...meta,
        paragraphIndex: 0,
        snippet: t.paragraphs[0],
        matchedTerms: [t.temple, t.province].filter(Boolean),
        score: 0.4,
        matchedField: 'temple',
      })
    }

    if (scope === 'passage') {
      if (hasPassageHit) pushPassage()
    } else if (scope === 'deity') {
      if (deityHit) pushDeity()
    } else if (scope === 'temple') {
      if (templeHit) pushTemple()
    } else {
      if (hasPassageHit) pushPassage()
      else if (deityHit) pushDeity()
      else if (templeHit) pushTemple()
    }
  }

  hits.sort((a, b) => b.score - a.score)

  return {
    hits: hits.slice(0, MAX_HITS),
    counts: {
      all: passageCount + deityOnly + templeOnly,
      passage: passageCount,
      deity: deityTotal,
      temple: templeTotal,
    },
  }
}
