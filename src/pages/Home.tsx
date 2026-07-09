import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackgroundGlow from '../components/BackgroundGlow'
import UserMenu from '../components/UserMenu'
import { thaiDate, placeLabel, stripMarkdown, type Passage } from '../lib/format'
import { useAuth } from '../lib/auth'

/** Shimmering gold title text — the original owat.fycdth.com treatment. */
const goldTextGradient: CSSProperties = {
  background: 'linear-gradient(90deg, #ca8a04, #fde047, #ca8a04)',
  backgroundSize: '200% 100%',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
  animation: 'owShimmer 3s infinite',
}

/** Primary amber button gradient from the original site. */
const amberButtonGradient = 'linear-gradient(90deg, #b45309 0%, #d97706 50%, #b45309 100%)'

const DAILY_LIMIT = 2

function todayKey() {
  const d = new Date()
  return `owat_daily_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function readOpensToday(): number {
  try {
    return parseInt(localStorage.getItem(todayKey()) || '0', 10) || 0
  } catch {
    return 0
  }
}

export default function Home() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [passage, setPassage] = useState<Passage | null>(null)
  const [loading, setLoading] = useState(false)
  const [opensToday, setOpensToday] = useState(0)

  useEffect(() => {
    setOpensToday(readOpensToday())
  }, [])

  // แอดมินเปิดได้ไม่จำกัด (ข้ามลิมิตรายวัน)
  const isAdmin = user?.role === 'admin'
  const limitReached = !isAdmin && opensToday >= DAILY_LIMIT

  const goSearch = () => {
    const q = query.trim()
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  const handleDraw = useCallback(async () => {
    if ((!isAdmin && readOpensToday() >= DAILY_LIMIT) || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/owat?random=true', { cache: 'no-store' })
      const data: Passage = await res.json()
      setPassage(data)
      setModalOpen(true)
      if (!isAdmin) {
        const next = readOpensToday() + 1
        try {
          localStorage.setItem(todayKey(), String(next))
        } catch {
          /* ignore private-mode quota errors */
        }
        setOpensToday(next)
      }
    } catch {
      setPassage(null)
    } finally {
      setLoading(false)
    }
  }, [loading, isAdmin])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #1a0a00 0%, #2d1810 30%, #1a0a00 100%)',
        fontFamily: "'Sarabun', sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Animated amber glow backdrop (canvas, from the original site) */}
      <BackgroundGlow />

      {/* Login / user — top right */}
      <div style={{ position: 'absolute', top: 18, right: 20, zIndex: 30 }}>
        <UserMenu user={user} onLogout={logout} />
      </div>

      <div
        className="ow-home-inner"
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: 1020,
          padding: '96px 32px 48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Title */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 46 }}>
          <h1
            className="ow-title"
            style={{
              margin: 0,
              paddingTop: 12,
              fontFamily: "'Sarabun', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(52px, 12vw, 120px)',
              lineHeight: 1.18,
              letterSpacing: '1px',
              textAlign: 'center',
              filter: 'drop-shadow(0 6px 30px rgba(240,160,50,0.4))',
              ...goldTextGradient,
            }}
          >
            พระโอวาท
          </h1>
        </div>

        {/* Search bar */}
        <div
          className="ow-search-bar"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 11px 11px 26px',
            borderRadius: 999,
            background: 'linear-gradient(180deg, rgba(46,28,10,0.66), rgba(30,18,6,0.62))',
            border: '1px solid rgba(222,170,80,0.42)',
            boxShadow:
              '0 0 0 1px rgba(255,200,110,0.06) inset, 0 18px 48px rgba(0,0,0,0.5), 0 0 60px rgba(220,150,50,0.08)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: '#d8a657', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                goSearch()
              }
            }}
            placeholder="ค้นหาพระโอวาท ธรรมะ หรือคำสอน..."
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: "'Sarabun', sans-serif",
              fontSize: 19,
              color: '#f3e4c4',
              padding: '6px 0',
            }}
          />
          <button
            type="button"
            onClick={goSearch}
            className="ow-primary-link"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              padding: '13px 28px',
              borderRadius: 999,
              cursor: 'pointer',
              textDecoration: 'none',
              background: amberButtonGradient,
              color: '#fff',
              fontFamily: "'Sarabun', sans-serif",
              fontWeight: 600,
              fontSize: 19,
              border: '1px solid rgba(245,158,11,0.3)',
              boxShadow: '0 6px 22px rgba(217,119,6,0.3)',
            }}
          >
            ค้นหา
          </button>
        </div>

        {/* Daily quote button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: 26 }}>
          <button
            className="ow-daily-btn"
            onClick={handleDraw}
            disabled={limitReached || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: '22px clamp(28px, 6vw, 56px)',
              borderRadius: 18,
              cursor: limitReached ? 'not-allowed' : 'pointer',
              background: limitReached ? 'rgba(120,72,20,0.35)' : amberButtonGradient,
              border: '1px solid rgba(245,158,11,0.3)',
              color: limitReached ? '#c9a97a' : '#fff',
              fontFamily: "'Sarabun', sans-serif",
              fontWeight: 500,
              fontSize: 'clamp(18px, 4vw, 22px)',
              textAlign: 'center',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? 'กำลังอัญเชิญ...'
              : limitReached
                ? 'วันนี้เปิดครบแล้ว 🙏 พรุ่งนี้พบกันใหม่'
                : 'เปิดรับพระโอวาทชี้แนะวันนี้'}
          </button>
          {isAdmin ? (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'rgba(240,200,120,0.75)' }}>
              ผู้ดูแลระบบ · เปิดได้ไม่จำกัด
            </p>
          ) : (
            !limitReached && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'rgba(199,154,82,0.6)' }}>
                เปิดได้วันละ {DAILY_LIMIT} ครั้ง · วันนี้เปิดแล้ว {opensToday}/{DAILY_LIMIT}
              </p>
            )
          )}
        </div>
      </div>

      {/* Daily-quote modal */}
      {modalOpen && passage && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            background: 'rgba(8,4,1,0.74)',
            backdropFilter: 'blur(7px)',
            animation: 'owOverlayIn 0.25s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="ow-modal-card"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 560,
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: 'clamp(28px, 6vw, 44px) clamp(22px, 5vw, 46px) clamp(24px, 5vw, 36px)',
              borderRadius: 28,
              background: 'linear-gradient(180deg, rgba(52,32,12,0.97), rgba(31,18,7,0.97))',
              border: '1px solid rgba(222,170,80,0.42)',
              boxShadow: '0 30px 90px rgba(0,0,0,0.6), 0 0 90px rgba(220,150,50,0.1)',
              animation: 'owCardIn 0.32s cubic-bezier(0.2,0.9,0.3,1)',
            }}
          >
            <button
              className="ow-modal-close-x"
              onClick={() => setModalOpen(false)}
              aria-label="ปิด"
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                background: 'rgba(20,12,4,0.5)',
                color: '#c79a52',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* ① Quote — opening and closing quote marks */}
            <div style={{ position: 'relative', padding: '26px 4px 0' }}>
              <span
                aria-hidden="true"
                style={{ position: 'absolute', top: -8, left: -4, fontSize: 72, lineHeight: 1, color: 'rgba(233,184,94,0.22)', fontFamily: 'Georgia, serif' }}
              >
                “
              </span>
              <p
                style={{
                  position: 'relative',
                  margin: 0,
                  fontSize: 'clamp(20px, 5vw, 26px)',
                  lineHeight: 1.65,
                  fontWeight: 500,
                  color: '#f5e6c4',
                  textWrap: 'pretty',
                }}
              >
                {stripMarkdown(passage.text)}
              </p>
              <div style={{ position: 'relative', height: 28 }}>
                <span
                  aria-hidden="true"
                  style={{ position: 'absolute', right: -2, bottom: -30, fontSize: 72, lineHeight: 1, color: 'rgba(233,184,94,0.22)', fontFamily: 'Georgia, serif' }}
                >
                  ”
                </span>
              </div>
            </div>

            {/* ② พระนาม → ③ สถานที่ → ④ วันที่ */}
            <div style={{ margin: '14px 0 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {passage.deity_th && (
                <div style={{ fontSize: 17, fontWeight: 700, color: '#f0c878' }}>{passage.deity_th}</div>
              )}
              {placeLabel(passage) && (
                <div style={{ fontSize: 14, color: '#c79a52' }}>{placeLabel(passage)}</div>
              )}
              {passage.date && (
                <div style={{ fontSize: 14, color: '#b08a4c' }}>{thaiDate(passage.date)}</div>
              )}
            </div>

            {/* ⑤ ปุ่มอ่านพระโอวาท (ไม่มีลูกศร) */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 26 }}>
              <Link
                to={`/full?id=${encodeURIComponent(passage.teaching_id)}`}
                className="ow-modal-read"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 15,
                  borderRadius: 14,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(160deg, #ffd070 0%, #f2a32e 52%, #d4811c 100%)',
                  color: '#341c06',
                  fontFamily: "'Sarabun', sans-serif",
                  fontWeight: 700,
                  fontSize: 17,
                  boxShadow: '0 8px 24px rgba(232,160,55,0.4), 0 0 0 1px rgba(255,225,170,0.35) inset',
                }}
              >
                อ่านพระโอวาท
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
