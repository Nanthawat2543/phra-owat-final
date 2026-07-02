import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import BackgroundGlow from '../components/BackgroundGlow'

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

/** Small lotus-flame flourish used in dividers. */
function Lotus({ width = 34, height = 22, opacities = [0.95, 0.8, 0.55] }: { width?: number; height?: number; opacities?: number[] }) {
  return (
    <svg width={width} height={height} viewBox="0 0 34 22" fill="none" style={{ color: '#e6b65c', flexShrink: 0 }}>
      <path d="M17 21c0-7 5-12 5-12s-2 7-5 12c-3-5-5-12-5-12s5 5 5 12z" fill="currentColor" opacity={opacities[0]} />
      <path d="M17 21c4-3 11-3 13-9-5-1-10 2-13 9zm0 0c-4-3-11-3-13-9 5-1 10 2 13 9z" fill="currentColor" opacity={opacities[1]} />
      {opacities[2] != null && (
        <path d="M17 21c6 0 12-3 14-8-6-2-12 1-14 8zm0 0c-6 0-12-3-14-8 6-2 12 1 14 8z" fill="currentColor" opacity={opacities[2]} />
      )}
    </svg>
  )
}

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false)

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

      {/* Login button — top right */}
      <Link
        to="/login"
        className="ow-login-btn"
        style={{
          position: 'absolute',
          top: 18,
          right: 20,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 40,
          padding: '8px 16px',
          borderRadius: 999,
          textDecoration: 'none',
          background: 'rgba(180,83,9,0.4)',
          border: '1px solid rgba(245,158,11,0.4)',
          color: '#fef3c7',
          fontFamily: "'Sarabun', sans-serif",
          fontSize: 14,
          fontWeight: 500,
          transition: 'all 0.2s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
          />
        </svg>
        เข้าสู่ระบบ
      </Link>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: 1020,
          padding: '0 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Title */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1
            style={{
              margin: 0,
              paddingTop: 12,
              fontFamily: "'Sarabun', sans-serif",
              fontWeight: 700,
              fontSize: 120,
              lineHeight: 1.18,
              letterSpacing: '1px',
              filter: 'drop-shadow(0 6px 30px rgba(240,160,50,0.4))',
              ...goldTextGradient,
            }}
          >
            พระโอวาท
          </h1>
        </div>

        {/* Lotus divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            margin: '18px 0 46px',
            width: 540,
            color: '#c79a52',
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.85 }}>✦</span>
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(199,154,82,0) 0%, rgba(199,154,82,0.75) 100%)' }} />
          <Lotus />
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(199,154,82,0.75) 0%, rgba(199,154,82,0) 100%)' }} />
          <span style={{ fontSize: 13, opacity: 0.85 }}>✦</span>
        </div>

        {/* Search bar */}
        <div
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
            className="ow-voice-btn"
            aria-label="ค้นหาด้วยเสียง"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#d8a657',
              borderRadius: '50%',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <Link
            to="/search"
            className="ow-primary-link"
            style={{
              display: 'flex',
              alignItems: 'center',
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l1.6 5.1L19 9.6l-4.4 2.2L12 17l-2.6-5.2L5 9.6l5.4-1.5L12 3z" fill="#fff" />
              <path d="M19 4l0.6 1.9L21 6.4l-1.4 0.6L19 9l-0.6-2L17 6.4l1.4-0.5L19 4z" fill="#fff" />
            </svg>
            ค้นหา
          </Link>
        </div>

        {/* Daily quote button */}
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 26 }}>
          <button
            className="ow-daily-btn"
            onClick={() => setModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: '26px 56px',
              borderRadius: 18,
              cursor: 'pointer',
              background: amberButtonGradient,
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#fff',
              fontFamily: "'Sarabun', sans-serif",
              fontWeight: 500,
              fontSize: 22,
              transition: 'all 0.2s',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: '#fff' }}>
              <path d="M12 4V2M5 7L3.5 5.5M19 7l1.5-1.5M2 18h20M4 18a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 18a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
            เปิดรับพระโอวาทชี้แนะวันนี้
          </button>
        </div>
      </div>

      {/* Daily-quote modal */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(8,4,1,0.74)',
            backdropFilter: 'blur(7px)',
            animation: 'owOverlayIn 0.25s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 560,
              padding: '42px 46px 36px',
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

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                padding: '7px 16px',
                borderRadius: 999,
                background: 'rgba(233,184,94,0.12)',
                border: '1px solid rgba(222,170,80,0.32)',
                color: '#f0c878',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 4V2M5 7L3.5 5.5M19 7l1.5-1.5M2 18h20M4 18a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 18a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
              พระโอวาทแนะนำวันนี้
            </div>

            <div style={{ fontSize: 14, color: '#b08a4c', margin: '14px 0 18px' }}>
              วันอังคารที่ ๑ กรกฎาคม ๒๕๖๙
            </div>

            <div style={{ position: 'relative', paddingTop: 6 }}>
              <span
                style={{
                  position: 'absolute',
                  top: -22,
                  left: -6,
                  fontSize: 76,
                  lineHeight: 1,
                  color: 'rgba(233,184,94,0.22)',
                  fontFamily: 'Georgia, serif',
                }}
              >
                “
              </span>
              <p
                style={{
                  position: 'relative',
                  margin: 0,
                  fontSize: 27,
                  lineHeight: 1.6,
                  fontWeight: 500,
                  color: '#f5e6c4',
                  textWrap: 'pretty',
                }}
              >
                ความสุขที่แท้จริง มิได้อยู่ที่การมีมาก แต่อยู่ที่ใจรู้จักพอ
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0 28px', color: '#c79a52' }}>
              <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(199,154,82,0) 0%, rgba(199,154,82,0.6) 100%)' }} />
              <Lotus width={26} height={17} opacities={[0.95, 0.7]} />
              <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(199,154,82,0.6) 0%, rgba(199,154,82,0) 100%)' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link
                to="/full"
                className="ow-modal-read"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
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
                อ่านพระโอวาทต้นฉบับ
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <button
                className="ow-modal-close-btn"
                onClick={() => setModalOpen(false)}
                style={{
                  padding: '15px 26px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: '1px solid rgba(200,150,70,0.34)',
                  color: '#d9bd8a',
                  fontFamily: "'Sarabun', sans-serif",
                  fontWeight: 600,
                  fontSize: 17,
                }}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
