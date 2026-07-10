import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { thaiDate, placeLabel, stripMarkdown, type Teaching } from '../lib/format'
import { useAuth } from '../lib/auth'
import UserMenu from '../components/UserMenu'

export default function FullText() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const id = searchParams.get('id') || ''
  const { user, logout } = useAuth()

  // กลับหน้าค้นหาแบบคงผลค้น/ตำแหน่งเดิม (Bug #12) — ใช้ history back
  // ถ้าเปิดหน้านี้ตรงๆ (ไม่มีประวัติ) ให้ไปหน้าค้นหาเปล่าแทน
  const goBackToSearch = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/search')
  }

  const [scale, setScale] = useState(100)
  // โหมดสว่างถูกปิดใช้งานชั่วคราวตามมติประชุม (Bug #13) — คงโหมดมืดอย่างเดียว
  const light = false
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
      {/* ลายน้ำถูกถอดออกชั่วคราวตามมติประชุม (Bug #10) — โค้ดเดิมอยู่ใน git history */}

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
        <div className="ow-full-left" style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <Link
            to="/"
            className="ow-wordmark"
            aria-label="กลับหน้าหลัก"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1,
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
          <span className="ow-full-divider" style={{ width: 1, height: 22, background: 'rgba(214,160,70,0.4)', flexShrink: 0 }} />
          <button
            onClick={goBackToSearch}
            className="ow-archive-link"
            style={{ display: 'flex', alignItems: 'center', lineHeight: 1, gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#e6b65c', fontFamily: "'Sarabun', sans-serif", fontSize: 15, fontWeight: 500, flexShrink: 0, padding: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="ow-archive-text">กลับหน้าค้นหา</span>
          </button>
        </div>
        <div className="ow-full-right" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
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

      {/* ปุ่มสลับโหมดสว่างถูกปิดใช้งานชั่วคราวตามมติประชุม (Bug #13) */}
    </div>
  )
}
