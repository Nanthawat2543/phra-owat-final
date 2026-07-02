// Oracle draw engine — ported from the original phra-owat lib/oracle.ts.
// Operates on the in-memory pools (data.js). No embeddings/AI: question mode
// uses keyword/term-overlap scoring (the original's graceful fallback path).

import { getGeneralPool, getCuratedPool } from './data.js'
import { expandQueryTerms } from './passages.js'

const CURATED_WEIGHT = 6

// Weighted pick from a pool (curated entries weigh CURATED_WEIGHT× more).
function weightedPick(pool, rand = Math.random) {
  if (pool.length === 0) return null
  let total = 0
  for (const p of pool) total += p.curated ? CURATED_WEIGHT : 1
  let r = rand() * total
  for (const p of pool) {
    r -= p.curated ? CURATED_WEIGHT : 1
    if (r < 0) return p
  }
  return pool[pool.length - 1]
}

/** Pure random draw. ~15% curated, avoids recently-seen passages. */
export function drawRandom(exclude = []) {
  const excludeSet = new Set(exclude)
  const general = getGeneralPool()
  const curated = getCuratedPool()

  // ~15% of the time, offer a hand-picked curated passage.
  if (curated.length > 0 && Math.random() < 0.15) {
    const fresh = curated.filter((p) => !excludeSet.has(p.passageId))
    const pick = (fresh.length > 0 ? fresh : curated)[
      Math.floor(Math.random() * (fresh.length > 0 ? fresh.length : curated.length))
    ]
    if (pick) return pick
  }

  let pool = [...general, ...curated].filter((p) => !excludeSet.has(p.passageId))
  if (pool.length === 0) pool = [...general, ...curated]
  return weightedPick(pool, Math.random)
}

/** Question-guided draw: score by term overlap, random pick among top K. */
export function drawForQuestion(question, opts = {}) {
  const q = (question || '').trim()
  if (!q) return drawRandom()

  const topK = opts.topK ?? 30
  const pool = [...getGeneralPool(), ...getCuratedPool()]

  const terms = expandQueryTerms(q)
  const rawLower = q.toLowerCase()
  if (!terms.includes(rawLower)) terms.push(rawLower)

  const scored = []
  for (const p of pool) {
    const lower = p.text.toLowerCase()
    let score = 0
    for (const term of terms) {
      if (!term) continue
      if (lower.includes(term)) {
        const isExact = term === rawLower || rawLower.includes(term) || term.includes(rawLower)
        score += isExact ? 3 : 1
      }
    }
    if (p.curated && score > 0) score += 1
    if (score > 0) scored.push({ p, score })
  }

  if (scored.length === 0) return weightedPick(pool, Math.random)

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, topK).map((s) => s.p)
  return weightedPick(top, Math.random)
}
