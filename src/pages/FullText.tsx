import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function FullText() {
  const [scale, setScale] = useState(100)
  const [light, setLight] = useState(false)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)

  const percentLabel = `${scale}%`
  const bodyFont = `${((20 * scale) / 100).toFixed(1)}px`
  const likeCount = 128 + (liked ? 1 : 0)

  // Derived theme colours (mirrors the prototype's renderVals()).
  const likeColor = liked ? '#e8884a' : light ? '#9a7330' : '#c79a52'
  const saveColor = saved ? '#e9b85e' : light ? '#9a7330' : '#c79a52'
  const mutedColor = light ? '#9a7330' : '#b08a4c'
  const pageBg = light
    ? 'radial-gradient(120% 90% at 50% 0%, #2a1808 0%, #1a0f04 60%, #0e0702 100%)'
    : 'radial-gradient(120% 90% at 50% 0%, #2c1a0a 0%, #190e04 58%, #0c0602 100%)'
  const wmColor = light ? 'rgba(233,184,94,0.05)' : 'rgba(233,184,94,0.055)'
  const sheetBg = light
    ? 'linear-gradient(180deg, #f6ecd6, #efe1c4)'
    : 'linear-gradient(180deg, rgba(52,32,12,0.62), rgba(33,20,8,0.58))'
  const sheetBorder = light ? 'rgba(190,150,90,0.5)' : 'rgba(222,170,80,0.3)'
  const ruleColor = light ? 'rgba(150,110,55,0.3)' : 'rgba(199,154,82,0.22)'
  const headingColor = light ? '#2e2008' : '#f7ead0'
  const textColor = light ? '#4a3618' : '#dcc296'

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
            <text x="0" y="28" fill={wmColor} fontFamily="Sarabun, sans-serif" fontSize="15" fontWeight="600">nanthawat.sris@gmail.com</text>
            <text x="46" y="62" fill={wmColor} fontFamily="Sarabun, sans-serif" fontSize="13">พระโอวาทฉบับเต็ม</text>
            <text x="18" y="96" fill={wmColor} fontFamily="Sarabun, sans-serif" fontSize="12">สำหรับศึกษาเท่านั้น</text>
            <text x="92" y="130" fill={wmColor} fontFamily="Sarabun, sans-serif" fontSize="12">1 ก.ค. 2569</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#owWm)" />
      </svg>

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 32px',
          background: 'linear-gradient(180deg, rgba(74,44,16,0.94) 0%, rgba(48,28,10,0.82) 100%)',
          borderBottom: '1px solid rgba(214,160,70,0.22)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Link
            to="/"
            className="ow-wordmark"
            aria-label="กลับหน้าหลัก"
            style={{
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: '0.3px',
              background: 'linear-gradient(176deg, #fff0cc 4%, #ffce6b 40%, #f5a92f 78%, #d4801c 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            พระโอวาท
          </Link>
          <span style={{ width: 1, height: 24, background: 'rgba(214,160,70,0.3)' }} />
          <Link
            to="/search"
            className="ow-archive-link"
            style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: '#e6b65c', fontSize: 16, fontWeight: 500 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            กลับคลังพระโอวาท
          </Link>
          <span style={{ fontSize: 19, fontWeight: 700, color: '#f5e6c4' }}>พระโอวาทฉบับเต็ม</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: 6,
            borderRadius: 999,
            background: 'rgba(20,12,4,0.45)',
            border: '1px solid rgba(200,150,70,0.28)',
          }}
        >
          <button
            className="ow-icon-btn"
            onClick={() => setScale((s) => Math.max(70, s - 10))}
            aria-label="ลดขนาดตัวอักษร"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 34, border: 'none', borderRadius: 999, cursor: 'pointer', background: 'transparent', color: '#e0bd84', fontFamily: "'Sarabun', sans-serif", fontSize: 16, fontWeight: 600 }}
          >
            ก−
          </button>
          <span style={{ minWidth: 50, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#cdb085' }}>{percentLabel}</span>
          <button
            className="ow-icon-btn"
            onClick={() => setScale((s) => Math.min(170, s + 10))}
            aria-label="เพิ่มขนาดตัวอักษร"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 34, border: 'none', borderRadius: 999, cursor: 'pointer', background: 'transparent', color: '#e0bd84', fontFamily: "'Sarabun', sans-serif", fontSize: 18, fontWeight: 600 }}
          >
            ก+
          </button>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center', padding: '44px 24px 96px' }}>
        <article
          style={{
            width: '100%',
            maxWidth: 860,
            padding: '30px 56px 64px',
            borderRadius: 22,
            background: sheetBg,
            border: `1px solid ${sheetBorder}`,
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
            transition: 'background 0.3s, border-color 0.3s',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              paddingBottom: 26,
              marginBottom: 8,
              borderBottom: `1px solid ${ruleColor}`,
            }}
          >
            <button
              className="ow-action-btn"
              onClick={() => setLiked((v) => !v)}
              aria-label="ถูกใจ"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: 'none', borderRadius: 999, cursor: 'pointer', background: 'transparent', color: likeColor, fontFamily: "'Sarabun', sans-serif", fontSize: 14 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'}>
                <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              <span>{likeCount}</span>
            </button>
            <button
              className="ow-action-btn"
              onClick={() => setSaved((v) => !v)}
              aria-label="บันทึก"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: 'none', borderRadius: 999, cursor: 'pointer', background: 'transparent', color: saveColor }}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'}>
                <path d="M6 4h12v16l-6-4-6 4V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', color: mutedColor, fontSize: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <span>1,204</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: bodyFont, transition: 'font-size 0.15s' }}>
            <div style={{ fontSize: '0.82em', fontWeight: 600, letterSpacing: '1px', color: '#d8a657', margin: '30px 0 14px' }}>พระโอวาทสิ่งศักดิ์สิทธิ์</div>
            <h1 style={{ margin: '0 0 30px', fontSize: '1.55em', fontWeight: 700, lineHeight: 1.4, color: headingColor }}>พระโอวาทพระพุทธจี้กง</h1>
            <p style={{ margin: '0 0 22px', fontSize: '1.04em', lineHeight: 1.7, fontWeight: 500, color: textColor, textWrap: 'pretty' }}>ประทานไว้เนื่องในโอกาสชั้นเรียนถันจู่ป้าน เขตพิษณุโลก</p>
            <p style={{ margin: '0 0 22px', fontSize: '1.04em', lineHeight: 1.7, fontWeight: 500, color: textColor, textWrap: 'pretty' }}>ณ จื้อเสียนฝอเอวี้ยน อำเภอคลองขลุง จังหวัดกำแพงเพชร</p>
            <p style={{ margin: '0 0 30px', fontSize: '1.04em', lineHeight: 1.7, fontWeight: 700, color: headingColor }}>วันอาทิตย์ที่ 22 เมษายน พุทธศักราช 2561</p>
            <p style={{ margin: '0 0 8px', fontSize: '1.1em', lineHeight: 1.7, fontWeight: 700, color: headingColor }}>สาธุชนกราบขอประทานพระโอวาทชี้แนะ</p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '34px auto 36px', maxWidth: 420, color: '#c79a52' }}>
              <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(199,154,82,0) 0%, rgba(199,154,82,0.7) 100%)' }} />
              <svg width="30" height="20" viewBox="0 0 34 22" fill="none" style={{ color: '#e6b65c', flexShrink: 0 }}>
                <path d="M17 21c0-7 5-12 5-12s-2 7-5 12c-3-5-5-12-5-12s5 5 5 12z" fill="currentColor" opacity="0.95" />
                <path d="M17 21c4-3 11-3 13-9-5-1-10 2-13 9zm0 0c-4-3-11-3-13-9 5-1 10 2 13 9z" fill="currentColor" opacity="0.7" />
              </svg>
              <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(199,154,82,0.7) 0%, rgba(199,154,82,0) 100%)' }} />
            </div>

            <p style={{ margin: 0, fontSize: '1.04em', lineHeight: 1.95, fontWeight: 400, color: textColor, textAlign: 'left', textIndent: '2em', textWrap: 'pretty' }}>
              ธรรมะเปรียบดั่งประทีปส่องทาง ผู้ใดน้อมนำมาปฏิบัติด้วยใจบริสุทธิ์ ย่อมพบความสงบเย็นภายใน การบำเพ็ญมิใช่เพื่อผู้อื่นเห็น หากเพื่อขัดเกลาจิตใจของตนให้ผ่องใสขึ้นทุกวัน เมื่อจิตตั้งมั่นในความดี อุปสรรคทั้งปวงย่อมกลายเป็นบทเรียนที่หล่อหลอมให้เราเข้มแข็งและเมตตายิ่งขึ้น
            </p>
          </div>
        </article>
      </main>

      <button
        className="ow-theme-toggle"
        onClick={() => setLight((v) => !v)}
        aria-label="สลับโหมดอ่าน"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
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
