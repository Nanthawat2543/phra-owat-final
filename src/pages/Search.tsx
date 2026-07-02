import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { thaiDate, placeLabel, stripMarkdown, type SearchHit } from '../lib/format'

type Scope = 'all' | 'passage' | 'deity' | 'temple'

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'passage', label: 'เนื้อหา' },
  { key: 'deity', label: 'สิ่งศักดิ์สิทธิ์' },
  { key: 'temple', label: 'สถานธรรม' },
]

interface SearchResponse {
  query: string
  scope: Scope
  hits: SearchHit[]
  counts: { all: number; passage: number; deity: number; temple: number }
}

const chipBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 18px',
  borderRadius: 999,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  fontFamily: "'Sarabun', sans-serif",
  fontWeight: 600,
  fontSize: 15,
  transition: 'all 0.18s',
}

const chipActive: CSSProperties = {
  ...chipBase,
  background: 'linear-gradient(180deg, #fdf3d6, #efd9a4)',
  color: '#3a230a',
  border: '1px solid rgba(255,235,190,0.7)',
  boxShadow: '0 4px 16px rgba(232,190,110,0.35)',
}

const chipIdle: CSSProperties = {
  ...chipBase,
  background: 'linear-gradient(180deg, rgba(50,30,12,0.55), rgba(34,20,8,0.5))',
  color: '#e6c890',
  border: '1px solid rgba(200,150,70,0.3)',
}

// Highlight matched terms inside a snippet (case-insensitive).
function highlight(text: string, terms: string[]) {
  const clean = terms.filter((t) => t && t.length > 1)
  if (clean.length === 0) return text
  const escaped = clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(re)
  return parts.map((part, i) =>
    clean.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
      <mark key={i} style={{ background: 'rgba(245,180,80,0.35)', color: '#fff', borderRadius: 3, padding: '0 2px' }}>
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const urlQ = searchParams.get('q') || ''

  const [input, setInput] = useState(urlQ)
  const [scope, setScope] = useState<Scope>('all')
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setInput(urlQ)
  }, [urlQ])

  const runQuery = useCallback(async (q: string, sc: Scope) => {
    if (!q.trim()) {
      setData(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${sc}`, { cache: 'no-store' })
      setData(await res.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Refetch whenever the URL query or the active scope changes.
  useEffect(() => {
    runQuery(urlQ, scope)
  }, [urlQ, scope, runQuery])

  const submit = () => {
    const q = input.trim()
    setSearchParams(q ? { q } : {})
  }

  const counts = data?.counts

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #1a0a00 0%, #2d1810 30%, #1a0a00 100%)',
        fontFamily: "'Sarabun', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          width: '100%',
          background:
            'linear-gradient(180deg, rgba(78,47,18,0.95) 0%, rgba(52,31,11,0.9) 58%, rgba(36,21,8,0.82) 100%)',
          borderBottom: '1px solid rgba(214,160,70,0.22)',
          backdropFilter: 'blur(8px)',
          padding: '18px 0 16px',
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 clamp(16px, 5vw, 40px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ow-search-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <Link
              to="/"
              className="ow-logo-pill"
              aria-label="กลับหน้าแรก พระโอวาท"
              style={{ display: 'flex', alignItems: 'center', flexShrink: 0, textDecoration: 'none', padding: '10px 6px', borderRadius: 12 }}
            >
              <span
                style={{
                  fontFamily: "'Sarabun', sans-serif",
                  fontWeight: 700,
                  fontSize: 22,
                  background: 'linear-gradient(90deg, #ca8a04, #fde047, #ca8a04)',
                  backgroundSize: '200% 100%',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  animation: 'owShimmer 3s infinite',
                }}
              >
                พระโอวาท
              </span>
            </Link>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 16px',
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, rgba(34,20,8,0.6), rgba(24,14,5,0.55))',
                  border: '1px solid rgba(222,170,80,0.4)',
                  boxShadow: '0 0 0 1px rgba(255,200,110,0.05) inset, 0 12px 34px rgba(0,0,0,0.4)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#d8a657', flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submit()
                    }
                  }}
                  placeholder="ค้นหาคำ ความรู้สึก ผู้ประทาน หรือสถานธรรม..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: "'Sarabun', sans-serif",
                    fontSize: 17,
                    color: '#f3e4c4',
                    padding: '2px 0',
                  }}
                />
                <button
                  type="button"
                  onClick={submit}
                  style={{
                    flexShrink: 0,
                    padding: '9px 20px',
                    borderRadius: 999,
                    border: '1px solid rgba(245,158,11,0.3)',
                    cursor: 'pointer',
                    background: 'linear-gradient(90deg, #b45309 0%, #d97706 50%, #b45309 100%)',
                    color: '#fff',
                    fontFamily: "'Sarabun', sans-serif",
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  ค้นหา
                </button>
              </div>

              <div className="ow-chip-row" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {SCOPES.map(({ key, label }) => (
                  <button key={key} onClick={() => setScope(key)} style={key === scope ? chipActive : chipIdle}>
                    <span>{label}</span>
                    {counts && <span style={{ fontSize: 13, opacity: 0.75 }}>{counts[key]}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px clamp(16px, 5vw, 40px) 80px' }}>
        {!urlQ.trim() && (
          <p style={{ textAlign: 'center', color: '#b08a4c', fontSize: 17, marginTop: 40 }}>
            พิมพ์คำที่ต้องการค้นหา แล้วกด Enter หรือปุ่มค้นหา
          </p>
        )}

        {urlQ.trim() && loading && (
          <p style={{ textAlign: 'center', color: '#c79a52', fontSize: 16, marginTop: 40 }}>กำลังค้นหา...</p>
        )}

        {urlQ.trim() && !loading && data && data.hits.length === 0 && (
          <p style={{ textAlign: 'center', color: '#b08a4c', fontSize: 17, marginTop: 40 }}>
            ไม่พบผลลัพธ์สำหรับ “{urlQ}”
          </p>
        )}

        {urlQ.trim() && !loading && data && data.hits.length > 0 && (
          <>
            <p style={{ color: '#b08a4c', fontSize: 14, margin: '0 0 18px' }}>
              พบ {counts ? counts[scope] : data.hits.length} รายการ (แสดง {data.hits.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.hits.map((hit, i) => (
                <button
                  key={`${hit.teachingId}-${hit.paragraphIndex}-${i}`}
                  onClick={() => navigate(`/full?id=${encodeURIComponent(hit.teachingId)}`)}
                  className="ow-result-card"
                  style={{
                    textAlign: 'left',
                    width: '100%',
                    padding: '20px 22px',
                    borderRadius: 16,
                    cursor: 'pointer',
                    background: 'linear-gradient(180deg, rgba(50,30,12,0.5), rgba(33,20,8,0.46))',
                    border: '1px solid rgba(200,150,70,0.28)',
                    fontFamily: "'Sarabun', sans-serif",
                    transition: 'all 0.18s',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#f0c878' }}>{hit.deity || 'พระโอวาท'}</span>
                    {placeLabel({ temple_th: hit.temple, province_th: hit.province, location_th: null }) && (
                      <span style={{ fontSize: 13, color: '#c79a52' }}>
                        · {placeLabel({ temple_th: hit.temple, province_th: hit.province, location_th: null })}
                      </span>
                    )}
                    {hit.date && <span style={{ fontSize: 13, color: '#b08a4c' }}>· {thaiDate(hit.date)}</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#e8d6b0', textWrap: 'pretty' }}>
                    {highlight(stripMarkdown(hit.snippet), hit.matchedTerms)}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
