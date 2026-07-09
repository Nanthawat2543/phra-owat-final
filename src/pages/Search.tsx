import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { thaiDate, placeLabel, stripMarkdown, type SearchHit } from '../lib/format'
import { useAuth } from '../lib/auth'
import UserMenu from '../components/UserMenu'

type FacetKey = 'deity' | 'temple' | 'category' | 'year'

const FACETS: { key: FacetKey; label: string }[] = [
  { key: 'deity', label: 'สิ่งศักดิ์สิทธิ์' },
  { key: 'temple', label: 'สถานธรรม' },
  { key: 'category', label: 'ชั้นเรียน' },
  { key: 'year', label: 'วันที่' },
]

interface SearchResponse {
  query: string
  hits: SearchHit[]
  total: number
  facets: Record<FacetKey, [string, number][]>
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

/** One dropdown facet chip: label + chevron; opens a scrollable option list. */
function FacetChip({
  label,
  value,
  options,
  displayValue,
  onSelect,
}: {
  label: string
  value: string
  options: [string, number][]
  displayValue?: (v: string) => string
  onSelect: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const active = !!value
  const shown = filter.trim()
    ? options.filter(([v]) => v.toLowerCase().includes(filter.trim().toLowerCase()))
    : options

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen((o) => !o)} style={active ? chipActive : chipIdle}>
        <span>{active ? (displayValue ? displayValue(value) : value) : label}</span>
        {active ? (
          <span
            role="button"
            aria-label={`ล้างตัวกรอง${label}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelect('')
              setOpen(false)
            }}
            style={{ display: 'flex', alignItems: 'center', marginLeft: 2 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 40,
            minWidth: 230,
            maxWidth: 300,
            borderRadius: 14,
            background: 'linear-gradient(180deg, rgba(52,32,12,0.98), rgba(33,20,8,0.98))',
            border: '1px solid rgba(222,170,80,0.4)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
            overflow: 'hidden',
          }}
        >
          {options.length > 8 && (
            <div style={{ padding: '10px 12px 6px' }}>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`ค้นหา${label}...`}
                autoFocus
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: '1px solid rgba(200,150,70,0.32)',
                  background: 'rgba(20,12,4,0.55)',
                  outline: 'none',
                  fontFamily: "'Sarabun', sans-serif",
                  fontSize: 14,
                  color: '#f3e4c4',
                }}
              />
            </div>
          )}
          <div style={{ maxHeight: 260, overflowY: 'auto', padding: '6px 6px 8px' }}>
            <button
              onClick={() => {
                onSelect('')
                setOpen(false)
              }}
              className="ow-facet-option"
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '9px 12px',
                border: 'none',
                borderRadius: 9,
                cursor: 'pointer',
                background: 'transparent',
                color: value === '' ? '#f5b942' : '#e6c890',
                fontFamily: "'Sarabun', sans-serif",
                fontWeight: value === '' ? 700 : 500,
                fontSize: 14.5,
                textAlign: 'left',
              }}
            >
              ทั้งหมด
            </button>
            {shown.map(([v, count]) => (
              <button
                key={v}
                onClick={() => {
                  onSelect(v)
                  setOpen(false)
                  setFilter('')
                }}
                className="ow-facet-option"
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '9px 12px',
                  border: 'none',
                  borderRadius: 9,
                  cursor: 'pointer',
                  background: v === value ? 'rgba(233,184,94,0.16)' : 'transparent',
                  color: v === value ? '#f5b942' : '#e6c890',
                  fontFamily: "'Sarabun', sans-serif",
                  fontWeight: v === value ? 700 : 500,
                  fontSize: 14.5,
                  textAlign: 'left',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayValue ? displayValue(v) : v}
                </span>
                <span style={{ fontSize: 12.5, color: '#b08a4c', flexShrink: 0 }}>{count}</span>
              </button>
            ))}
            {shown.length === 0 && (
              <p style={{ margin: 0, padding: '10px 12px', fontSize: 13.5, color: '#b08a4c' }}>ไม่พบตัวเลือก</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const urlQ = searchParams.get('q') || ''
  const fDeity = searchParams.get('deity') || ''
  const fTemple = searchParams.get('temple') || ''
  const fCategory = searchParams.get('category') || ''
  const fYear = searchParams.get('year') || ''

  const [input, setInput] = useState(urlQ)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setInput(urlQ)
  }, [urlQ])

  const hasAnyFilter = !!(fDeity || fTemple || fCategory || fYear)
  const hasCriteria = !!urlQ.trim() || hasAnyFilter

  // Refetch whenever the query or any filter in the URL changes.
  useEffect(() => {
    if (!hasCriteria) {
      // Still fetch once to populate facet dropdowns with the full corpus.
    }
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams()
    if (urlQ.trim()) params.set('q', urlQ.trim())
    if (fDeity) params.set('deity', fDeity)
    if (fTemple) params.set('temple', fTemple)
    if (fCategory) params.set('category', fCategory)
    if (fYear) params.set('year', fYear)
    fetch(`/api/search?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: SearchResponse) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [urlQ, fDeity, fTemple, fCategory, fYear, hasCriteria])

  const updateParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setSearchParams(next)
  }

  const submit = () => updateParams({ q: input.trim() })

  const facetValue: Record<FacetKey, string> = { deity: fDeity, temple: fTemple, category: fCategory, year: fYear }

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
        {/* ชิดซ้ายเหมือน header หน้าอื่น (Bug #7) — โลโก้ซ้ายสุด, ปุ่มผู้ใช้ขวาสุด */}
        <div style={{ width: '100%', padding: '0 clamp(14px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                {FACETS.map(({ key, label }) => (
                  <FacetChip
                    key={key}
                    label={label}
                    value={facetValue[key]}
                    options={data?.facets?.[key] ?? []}
                    displayValue={key === 'year' ? (v) => `พ.ศ. ${v}` : undefined}
                    onSelect={(v) => updateParams({ [key]: v })}
                  />
                ))}
              </div>
            </div>

            {/* ปุ่มผู้ใช้/เข้าสู่ระบบ — มีทุกหน้า (Bug #7) */}
            <div style={{ flexShrink: 0 }}>
              <UserMenu user={user} onLogout={logout} />
            </div>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px clamp(16px, 5vw, 40px) 80px' }}>
        {!hasCriteria && (
          <p style={{ textAlign: 'center', color: '#b08a4c', fontSize: 17, marginTop: 40 }}>
            พิมพ์คำที่ต้องการค้นหา หรือเลือกตัวกรองด้านบน
          </p>
        )}

        {hasCriteria && loading && (
          <p style={{ textAlign: 'center', color: '#c79a52', fontSize: 16, marginTop: 40 }}>กำลังค้นหา...</p>
        )}

        {hasCriteria && !loading && data && data.hits.length === 0 && (
          <p style={{ textAlign: 'center', color: '#b08a4c', fontSize: 17, marginTop: 40 }}>
            ไม่พบผลลัพธ์{urlQ.trim() ? ` สำหรับ “${urlQ}”` : ''}
          </p>
        )}

        {hasCriteria && !loading && data && data.hits.length > 0 && (
          <>
            <p style={{ color: '#b08a4c', fontSize: 14, margin: '0 0 18px' }}>
              พบ {data.total} รายการ{data.total > data.hits.length ? ` (แสดง ${data.hits.length})` : ''}
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
                    {hit.category && <span style={{ fontSize: 13, color: '#b08a4c' }}>· {hit.category}</span>}
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
