// One-time export: pull the full teaching corpus from the OLD Supabase project
// and write compressed JSON data files into this project's data/ folder.
//
// Reads the service-role key from the old project's .env.local (never committed).
// Run:  node scripts/export-data.mjs
//
// Output: data/teachings.json.gz, data/curated.json.gz

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OLD_PROJECT = '/Users/nanthawatauto/Projects/phra-owat'
const SUPABASE_URL = 'https://vsugmjvdxqyysoepfcuu.supabase.co'
// Written into api/_data so the compressed corpus ships bundled with the
// serverless functions (see vercel.json includeFiles).
const OUT_DIR = join(__dirname, '..', 'api', '_data')

// Thai-relevant columns only — the zh/en translation columns are empty for
// nearly the whole corpus, so skipping them roughly halves nothing but keeps
// the payload lean and predictable.
const TEACHING_COLS = [
  'id',
  'content_th',
  'deity_th',
  'temple_th',
  'province_th',
  'location_th',
  'country',
  'date',
  'category',
  'audio_approved',
].join(',')

function readSecretKey() {
  const env = readFileSync(join(OLD_PROJECT, '.env.local'), 'utf8')
  const line = env.split('\n').find((l) => l.startsWith('SUPABASE_SECRET_KEY='))
  if (!line) throw new Error('SUPABASE_SECRET_KEY not found in old project .env.local')
  return line.slice('SUPABASE_SECRET_KEY='.length).trim().replace(/^"|"$/g, '')
}

async function fetchAll(table, columns, key) {
  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${columns}`
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${to}`,
        'Range-Unit': 'items',
      },
    })
    if (!res.ok) throw new Error(`${table} fetch failed: ${res.status} ${await res.text()}`)
    const batch = await res.json()
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

async function main() {
  const key = readSecretKey()
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Fetching teachings…')
  const teachings = await fetchAll('teachings', TEACHING_COLS, key)
  console.log(`  → ${teachings.length} teachings`)

  console.log('Fetching curated_teachings…')
  const curated = await fetchAll('curated_teachings', '*', key)
  console.log(`  → ${curated.length} curated`)

  const tGz = gzipSync(Buffer.from(JSON.stringify(teachings)))
  const cGz = gzipSync(Buffer.from(JSON.stringify(curated)))
  writeFileSync(join(OUT_DIR, 'teachings.json.gz'), tGz)
  writeFileSync(join(OUT_DIR, 'curated.json.gz'), cGz)

  console.log(`Wrote data/teachings.json.gz (${(tGz.length / 1e6).toFixed(2)} MB)`)
  console.log(`Wrote data/curated.json.gz (${(cGz.length / 1e3).toFixed(1)} KB)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
