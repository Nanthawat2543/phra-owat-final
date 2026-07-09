import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { thaiDate, placeLabel, stripMarkdown, type Teaching } from '../lib/format'
import { useAuth } from '../lib/auth'
import UserMenu from '../components/UserMenu'

export default function FullText() {
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id') || ''
  const { user, logout } = useAuth()

  const [scale, setScale] = useState(100)
  const [light, setLight] = useState(false)
  const [teaching, setTeaching] = useState<Teaching | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError(true)
      return
    }
    setLoading(true)
    setError(false)
    fetch(`/api/owat?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Teaching) => setTeaching(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  const percentLabel = `${scale}%`
  const bodyFont = `${((20 * scale) / 100).toFixed(1)}px`

  const pageBg = light
    ? 'radial-gradient(120% 90% at 50% 0%, #2a1808 0%, #1a0f04 60%, #0e0702 100%)'
    : 'radial-gradient(120% 90% at 50% 0%, #2c1a0a 0%, #190e04 58%, #0c0602 100%)'
  const wmColor = light ? 'rgba(233,184,94,0.05)' : 'rgba(233,184,94,0.055)'
  const sheetBg = light
    ? 'linear-gradient(180deg, #f6ecd6, #efe1c4)'
    : 'linear-gradient(180deg, rgba(52,32,12,0.62), rgba(33,20,8,0.58))'
  const sheetBorder = light ? 'rgba(190,150,90,0.5)' : 'rgba(222,170,80,0.3)'
  const headingColor = light ? '#2e2008' : '#f7ead0'
  const textColor = light ? '#4a3618' : '#dcc296'

  // Split the full teaching content into display paragraphs.
  const paragraphs = (teaching?.content_th || '')
    .split(/\n+/)
    .map((s) => stripMarkdown(s))
    .filter(Boolean)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: pageBg,
        fontFamily: "'Sarabun', sans-serif",
        transition: 'background 0.3s',
      }}
    >
      {/* Anti-copy watermark */}
      <svg aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
        <defs>
          <pattern id="owWm" width="320" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
            <text x="0" y="28" fill={wmColor} fontFamily="Sarabun, sans-serif" fontSize="15" fontWeight="600">พระโอวาท</text>
            <text x="46" y="62" fill={wmColor} fontFamily="Sarabun, sans-serif" fontSize="13">สำหรับศึกษาเท่านั้น</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#owWm)" />
      </svg>

      <header
        className="ow-full-head"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px clamp(14px, 4vw, 32px)',
          background: 'linear-gradient(180deg, rgba(74,44,16,0.94) 0%, rgba(48,28,10,0.82) 100%)',
          borderBottom: '1px solid rgba(214,160,70,0.22)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <Link
            to="/"
            className="ow-wordmark"
            aria-label="กลับหน้าหลัก"
            style={{
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 22,
              flexShrink: 0,
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
          </Link>
          <span style={{ width: 1, height: 22, background: 'rgba(214,160,70,0.3)', flexShrink: 0 }} />
          <Link
            to="/search"
            className="ow-archive-link"
            style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: '#e6b65c', fontSize: 15, fontWeight: 500, flexShrink: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="ow-archive-text">กลับคลังพระโอวาท</span>
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: 6,
              borderRadius: 999,
              flexShrink: 0,
              background: 'rgba(20,12,4,0.45)',
              border: '1px solid rgba(200,150,70,0.28)',
            }}
          >
            <button
              className="ow-icon-btn"
              onClick={() => setScale((s) => Math.max(70, s - 10))}
              aria-label="ลดขนาดตัวอักษร"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 32, border: 'none', borderRadius: 999, cursor: 'pointer', background: 'transparent', color: '#e0bd84', fontFamily: "'Sarabun', sans-serif", fontSize: 16, fontWeight: 600 }}
            >
              ก−
            </button>
            <span style={{ minWidth: 46, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#cdb085' }}>{percentLabel}</span>
            <button
              className="ow-icon-btn"
              onClick={() => setScale((s) => Math.min(170, s + 10))}
              aria-label="เพิ่มขนาดตัวอักษร"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 32, border: 'none', borderRadius: 999, cursor: 'pointer', background: 'transparent', color: '#e0bd84', fontFamily: "'Sarabun', sans-serif", fontSize: 18, fontWeight: 600 }}
            >
              ก+
            </button>
          </div>

          {/* ปุ่มผู้ใช้/เข้าสู่ระบบ — มีทุกหน้า (Bug #7) */}
          <UserMenu user={user} onLogout={logout} />
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center', padding: 'clamp(24px, 5vw, 44px) clamp(14px, 4vw, 24px) 96px' }}>
        <article
          style={{
            width: '100%',
            maxWidth: 860,
            padding: 'clamp(24px, 5vw, 30px) clamp(20px, 6vw, 56px) clamp(40px, 8vw, 64px)',
            borderRadius: 22,
            background: sheetBg,
            border: `1px solid ${sheetBorder}`,
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
            transition: 'background 0.3s, border-color 0.3s',
          }}
        >
          {loading && (
            <p style={{ textAlign: 'center', color: '#c79a52', fontSize: 16, padding: '40px 0' }}>กำลังโหลด...</p>
          )}
          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ color: light ? '#7a5a20' : '#c79a52', fontSize: 17 }}>ไม่พบพระโอวาทฉบับนี้</p>
              <Link to="/search" style={{ color: '#e6b65c', fontSize: 15 }}>ไปหน้าค้นหา</Link>
            </div>
          )}

          {!loading && !error && teaching && (
            <>
              {/* Header: giver / place / date */}
              <div style={{ textAlign: 'center', marginBottom: 30 }}>
                <h1 style={{ margin: '20px 0 14px', fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 700, lineHeight: 1.4, color: headingColor, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  {teaching.deity_th || 'พระโอวาท'}
                </h1>
                {placeLabel(teaching) && (
                  <p style={{ margin: '0 0 6px', fontSize: 16, color: light ? '#6b4f22' : '#c79a52', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{placeLabel(teaching)}</p>
                )}
                {teaching.date && (
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: light ? '#6b4f22' : '#b08a4c' }}>{thaiDate(teaching.date)}</p>
                )}
              </div>

              {/* Body */}
              <div style={{ fontSize: bodyFont, transition: 'font-size 0.15s' }}>
                {paragraphs.map((para, i) => (
                  <p
                    key={i}
                    style={{
                      margin: '0 0 18px',
                      fontSize: '1.04em',
                      lineHeight: 1.95,
                      fontWeight: 400,
                      color: textColor,
                      textIndent: '2em',
                      textWrap: 'pretty',
                      // ตัดคำไทย/สตริงยาวไม่มีเว้นวรรค กันล้นกรอบบนจอแคบ
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </>
          )}
        </article>
      </main>

      <button
        className="ow-theme-toggle"
        onClick={() => setLight((v) => !v)}
        aria-label="สลับโหมดอ่าน"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 52,
          height: 52,
          border: '1px solid rgba(222,170,80,0.4)',
          borderRadius: '50%',
          cursor: 'pointer',
          background: 'rgba(40,24,8,0.7)',
          color: '#f0c878',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.9" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
