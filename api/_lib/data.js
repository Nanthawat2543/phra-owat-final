// Loads the bundled พระโอวาท corpus (gzipped JSON copied from the original
// Supabase project) and builds the passage pools + search index once per
// process. Everything is cached in module scope, so warm serverless
// invocations and the Vite dev server reuse the same in-memory structures.

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { splitIntoParagraphs } from './passages.js'

function loadGz(relative) {
  const path = fileURLToPath(new URL(relative, import.meta.url))
  return JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'))
}

let _teachings = null
let _curated = null

/** Raw teaching records (array). Loaded + cached on first use. */
export function getTeachings() {
  if (!_teachings) _teachings = loadGz('../_data/teachings.json.gz')
  return _teachings
}

/** Raw curated records (array). */
export function getCurated() {
  if (!_curated) _curated = loadGz('../_data/curated.json.gz')
  return _curated
}

function metaFromTeaching(t) {
  return {
    deity_th: t.deity_th || '',
    location_th: t.location_th ?? null,
    temple_th: t.temple_th ?? null,
    province_th: t.province_th ?? null,
    country: t.country ?? null,
    date: t.date ?? null,
    category: t.category ?? null,
    audio_approved: !!t.audio_approved,
  }
}

// ── Teaching lookup by id ──
let _byId = null
export function getTeachingById(id) {
  if (!_byId) _byId = new Map(getTeachings().map((t) => [t.id, t]))
  return _byId.get(id) || null
}

// ── General passage pool (flattened, every passage equal) ──
let _generalPool = null
export function getGeneralPool() {
  if (_generalPool) return _generalPool
  const pool = []
  for (const t of getTeachings()) {
    const paragraphs = splitIntoParagraphs(t.content_th || '')
    const meta = metaFromTeaching(t)
    paragraphs.forEach((text, index) => {
      pool.push({
        passageId: `${t.id}#${index}`,
        teachingId: t.id,
        index,
        text,
        curated: false,
        ...meta,
      })
    })
  }
  _generalPool = pool
  return pool
}

// ── Curated passage pool ──
let _curatedPool = null
export function getCuratedPool() {
  if (_curatedPool) return _curatedPool
  const byId = new Map(getTeachings().map((t) => [t.id, t]))
  const pool = []
  for (const c of getCurated()) {
    const src = byId.get(c.source_id)
    const meta = src
      ? metaFromTeaching(src)
      : {
          deity_th: c.deity || '',
          location_th: null,
          temple_th: null,
          province_th: null,
          country: null,
          date: null,
          category: c.category ?? null,
          audio_approved: !!c.audio_approved,
        }
    pool.push({
      passageId: `curated:${c.id}`,
      teachingId: c.source_id,
      index: 0,
      text: c.text,
      curated: true,
      ...meta,
    })
  }
  _curatedPool = pool
  return pool
}

// ── Search index (paragraphs split once, lowercased for matching) ──
let _searchIndex = null
export function getSearchIndex() {
  if (_searchIndex) return _searchIndex
  const index = []
  for (const t of getTeachings()) {
    const paragraphs = splitIntoParagraphs(t.content_th || '')
    index.push({
      id: t.id,
      deity: t.deity_th || '',
      temple: t.temple_th ?? null,
      province: t.province_th ?? null,
      country: t.country ?? null,
      date: t.date ?? null,
      category: t.category ?? null,
      deityLower: (t.deity_th || '').toLowerCase(),
      templeLower: (t.temple_th || '').toLowerCase(),
      provinceLower: (t.province_th || '').toLowerCase(),
      locationLower: (t.location_th || '').toLowerCase(),
      paragraphs,
      paragraphsLower: paragraphs.map((p) => p.toLowerCase()),
    })
  }
  _searchIndex = index
  return index
}

// Non-overlapping occurrence count without allocating substrings.
export function countOccurrences(haystack, needle) {
  if (!needle) return 0
  let count = 0
  let i = haystack.indexOf(needle)
  while (i !== -1) {
    count++
    i = haystack.indexOf(needle, i + needle.length)
  }
  return count
}
