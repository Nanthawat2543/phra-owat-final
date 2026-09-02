import { useState, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { thaiDate, placeLabel, stripMarkdown, type SearchHit } from '../lib/format'
import { useAuth } from '../lib/auth'
import { apiSearch } from '../lib/api'
import { scrollToTop } from '../lib/scroll'
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
  page: number
  pageSize: number
  totalPages: number
}

// Cache ผลค้นหาต่อชุดพารามิเตอร์ (module scope — อยู่ตลอด session)
// ทำให้กด "กลับหน้าค้นหา" แล้วผลเดิมเรนเดอร์ทันทีในเฟรมแรก ไม่มีจอว่าง/ภาพกระตุก
const responseCache = new Map<string, SearchResponse>()

const pageBtnStyle = (disabled: boolean): CSSProperties => ({
  padding: '9px 18px',
  borderRadius: 999,
  cursor: disabled ? 'not-allowed' : 'pointer',
  border: '1px solid rgba(200,150,70,0.35)',
  background: disabled ? 'rgba(50,30,12,0.3)' : 'linear-gradient(180deg, rgba(60,36,14,0.7), rgba(40,24,9,0.7))',
  color: disabled ? 'rgba(199,154,82,0.4)' : '#e6c890',
  fontFamily: "'Sarabun', sans-serif",
  fontWeight: 600,
  fontSize: 14.5,
})

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
  // ตำแหน่งกางแผง — ใช้ fixed จากตำแหน่งปุ่มจริง เพราะแถวชิปเป็น scroll container
  // (overflow-x) ซึ่งจะตัดแผงแบบ absolute ทิ้งบนจอแคบ
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const toggleOpen = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const panelW = Math.min(300, window.innerWidth - 24)
      const left = Math.min(rect.left, window.innerWidth - panelW - 12)
      setPanelPos({ top: rect.bottom + 8, left: Math.max(12, left) })
    }
    setOpen((o) => !o)
  }

  // ปิดเมื่อคลิกนอกแผง — ส่วนการเลื่อนจอ/จอเปลี่ยนขนาด (เช่นคีย์บอร์ดมือถือเด้งขึ้น)
  // ให้ "ย้ายแผงตามปุ่ม" แทนการปิด (เดิมสั่งปิด ทำให้พิมพ์ค้นหาในแผงบนมือถือไม่ได้
  // เพราะคีย์บอร์ดเด้ง → resize → แผงถูกปิดทันที)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const reposition = () => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const panelW = Math.min(300, window.innerWidth - 24)
      const left = Math.min(rect.left, window.innerWidth - panelW - 12)
      setPanelPos({ top: rect.bottom + 8, left: Math.max(12, left) })
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  const active = !!value
  const shown = filter.trim()
    ? options.filter(([v]) => v.toLowerCase().includes(filter.trim().toLowerCase()))
    : options

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={toggleOpen} style={active ? chipActive : chipIdle}>
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

      {open && panelPos && (
        <div
          style={{
            position: 'fixed',
            top: panelPos.top,
            left: panelPos.left,
            zIndex: 40,
            minWidth: 230,
            maxWidth: Math.min(300, window.innerWidth - 24),
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
                // เดสก์ท็อปโฟกัสให้เลย ส่วนจอสัมผัสให้ผู้ใช้แตะเอง (กันคีย์บอร์ดเด้งบังแผง)
                autoFocus={typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches}
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
          <div className="ow-facet-scroll" style={{ maxHeight: 260, overflowY: 'auto', padding: '6px 6px 8px' }}>
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
  const fPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  // คีย์ประจำชุดพารามิเตอร์ค้นหา — ใช้เป็น key ของ response cache
  const paramsKey = JSON.stringify([urlQ.trim(), fDeity, fTemple, fCategory, fYear, fPage])

  // เรนเดอร์ผลจาก cache ได้ทันทีตั้งแต่เฟรมแรก (กันภาพกระตุกตอนกด "กลับหน้าค้นหา")
  const [input, setInput] = useState(urlQ)
  const [data, setData] = useState<SearchResponse | null>(() => responseCache.get(paramsKey) ?? null)
  const [loading, setLoading] = useState(false)
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    setInput(urlQ)
  }, [urlQ])

  // แสดงปุ่มขึ้นบนสุดเมื่อเลื่อนลงพอสมควร (Bug #15)
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const hasAnyFilter = !!(fDeity || fTemple || fCategory || fYear)
  const hasCriteria = !!urlQ.trim() || hasAnyFilter

  // Refetch whenever the query or any filter in the URL changes.
  // ถ้ามีใน cache ใช้ทันที ไม่ยิงซ้ำ (ข้อมูลคลังคงที่ตลอด session)
  useEffect(() => {
    const cached = responseCache.get(paramsKey)
    if (cached) {
      setData(cached)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams()
    if (urlQ.trim()) params.set('q', urlQ.trim())
    if (fDeity) params.set('deity', fDeity)
    if (fTemple) params.set('temple', fTemple)
    if (fCategory) params.set('category', fCategory)
    if (fYear) params.set('year', fYear)
    if (fPage > 1) params.set('page', String(fPage))
    apiSearch(params)
      .then((d) => {
        responseCache.set(paramsKey, d as SearchResponse)
        if (!cancelled) setData(d as SearchResponse)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey])

  // คืนตำแหน่ง scroll เดิมเมื่อกลับมาจากหน้าอ่านฉบับเต็ม (Bug #12)
  // useLayoutEffect = เลื่อนก่อนเบราว์เซอร์วาดเฟรม → ไม่เห็นภาพกระโดด
  useLayoutEffect(() => {
    if (loading || !data) return
    const saved = sessionStorage.getItem('ow_search_scroll')
    if (saved) {
      sessionStorage.removeItem('ow_search_scroll')
      window.scrollTo(0, parseInt(saved, 10) || 0)
    }
  }, [loading, data])

  const updateParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    // เปลี่ยนคำค้น/ตัวกรอง → กลับหน้า 1 เสมอ
    next.delete('page')
    setSearchParams(next)
  }

  // เปลี่ยนหน้าผลลัพธ์ (Bug #16) + เลื่อนขึ้นบนสุด
  const goToPage = (p: number) => {
    const next = new URLSearchParams(searchParams)
    if (p > 1) next.set('page', String(p))
    else next.delete('page')
    setSearchParams(next)
    scrollToTop()
  }

  const submit = () => updateParams({ q: input.trim() })

  const facetValue: Record<FacetKey, string> = { deity: fDeity, temple: fTemple, category: fCategory, year: fYear }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 'var(--app-screen-h)',
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

            <div className="ow-search-mid" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <div className="ow-search-user" style={{ flexShrink: 0 }}>
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
              พบ {data.total} รายการ
              {data.totalPages > 1 && ` · หน้า ${data.page}/${data.totalPages}`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.hits.map((hit, i) => (
                <button
                  key={`${hit.teachingId}-${hit.paragraphIndex}-${i}`}
                  onClick={() => {
                    // จำตำแหน่ง scroll ไว้ก่อนไปอ่านฉบับเต็ม (Bug #12)
                    try {
                      sessionStorage.setItem('ow_search_scroll', String(window.scrollY))
                    } catch {
                      /* private mode */
                    }
                    navigate(`/full?id=${encodeURIComponent(hit.teachingId)}`)
                  }}
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

            {/* แบ่งหน้า (Bug #16) */}
            {data.totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 28 }}>
                <button
                  onClick={() => goToPage(data.page - 1)}
                  disabled={data.page <= 1}
                  className="ow-page-btn"
                  style={pageBtnStyle(data.page <= 1)}
                >
                  ← ก่อนหน้า
                </button>
                <span style={{ fontSize: 14, color: '#cdb085', minWidth: 90, textAlign: 'center' }}>
                  หน้า {data.page} / {data.totalPages}
                </span>
                <button
                  onClick={() => goToPage(data.page + 1)}
                  disabled={data.page >= data.totalPages}
                  className="ow-page-btn"
                  style={pageBtnStyle(data.page >= data.totalPages)}
                >
                  ถัดไป →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ปุ่มขึ้นบนสุด (Bug #15) */}
      {showTop && (
        <button
          onClick={() => scrollToTop()}
          aria-label="กลับขึ้นบนสุด"
          className="ow-scrolltop"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 30,
            width: 48,
            height: 48,
            borderRadius: '50%',
            cursor: 'pointer',
            border: '1px solid rgba(245,158,11,0.4)',
            background: 'linear-gradient(180deg, rgba(180,83,9,0.92), rgba(120,60,10,0.92))',
            color: '#ffe9c2',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
