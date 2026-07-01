import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

const FILTER_LABELS = ['สิ่งศักดิ์สิทธิ์', 'สถานธรรม', 'ชั้นเรียน', 'วันที่']

const chipBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  padding: '9px 20px',
  borderRadius: 999,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  fontFamily: "'Sarabun', sans-serif",
  fontWeight: 600,
  fontSize: 17,
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

export default function Search() {
  const [active, setActive] = useState('สิ่งศักดิ์สิทธิ์')
  const [q, setQ] = useState('')

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background:
          'radial-gradient(120% 90% at 50% 8%, #3a2410 0%, #271606 34%, #170d03 64%, #0b0602 100%)',
        fontFamily: "'Sarabun', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          position: 'relative',
          width: '100%',
          background:
            'linear-gradient(180deg, rgba(78,47,18,0.92) 0%, rgba(52,31,11,0.8) 58%, rgba(36,21,8,0.4) 100%)',
          borderBottom: '1px solid rgba(214,160,70,0.22)',
          padding: '22px 0 20px',
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
            <Link
              to="/"
              className="ow-logo-pill"
              aria-label="กลับหน้าแรก พระโอวาท"
              style={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                textDecoration: 'none',
                padding: '12px 8px',
                borderRadius: 12,
                transition: 'background 0.2s',
              }}
            >
              <span
                style={{
                  fontFamily: "'Sarabun', sans-serif",
                  fontWeight: 600,
                  fontSize: 22,
                  letterSpacing: '0.3px',
                  background: 'linear-gradient(176deg, #fff0cc 4%, #ffce6b 38%, #f5a92f 78%, #d4801c 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                }}
              >
                พระโอวาท
              </span>
            </Link>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 24px',
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, rgba(34,20,8,0.6), rgba(24,14,5,0.55))',
                  border: '1px solid rgba(222,170,80,0.4)',
                  boxShadow: '0 0 0 1px rgba(255,200,110,0.05) inset, 0 12px 34px rgba(0,0,0,0.4)',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: '#d8a657', flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  placeholder="ค้นหาคำ ความรู้สึก ผู้ประทาน หรือสถานธรรม..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: "'Sarabun', sans-serif",
                    fontSize: 18,
                    color: '#f3e4c4',
                    padding: '2px 0',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {FILTER_LABELS.map((label) => (
                  <button
                    key={label}
                    onClick={() => setActive(label)}
                    style={label === active ? chipActive : chipIdle}
                  >
                    <span>{label}</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%' }} />
    </div>
  )
}
