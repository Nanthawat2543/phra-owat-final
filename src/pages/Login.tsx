import { useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../lib/auth'

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  borderRadius: 12,
  border: '1px solid rgba(200,150,70,0.32)',
  background: 'rgba(20,12,4,0.55)',
  outline: 'none',
  fontFamily: "'Sarabun', sans-serif",
  fontSize: 16,
  color: '#f3e4c4',
}

const labelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: '#d9bd8a',
}

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [showPw, setShowPw] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isLogin = mode === 'login'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (!isLogin) {
      setMessage({ text: 'ยังไม่เปิดรับสมัครสมาชิกในเวอร์ชันนี้ กรุณาติดต่อผู้ดูแลระบบ', error: true })
      return
    }
    if (!email.trim() || !password) {
      setMessage({ text: 'กรุณากรอกอีเมลและรหัสผ่าน', error: true })
      return
    }
    setSubmitting(true)
    const result = await login(email.trim(), password)
    setSubmitting(false)
    if (result.error) {
      setMessage({ text: result.error, error: true })
      return
    }
    navigate('/')
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
        background:
          'radial-gradient(120% 95% at 50% 36%, #34200c 0%, #241405 36%, #160c03 64%, #0b0602 100%)',
        fontFamily: "'Sarabun', sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      {/* Decorative backdrop */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            top: '14%',
            right: '12%',
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,196,92,0.6) 0%, rgba(240,160,40,0.24) 40%, rgba(240,160,40,0) 72%)',
            filter: 'blur(3px)',
            ['--fx' as string]: '-10px',
            ['--fy' as string]: '14px',
            animation: 'owFloat 12s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '14%',
            left: '11%',
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,190,90,0.5) 0%, rgba(220,140,30,0.18) 42%, rgba(220,140,30,0) 72%)',
            filter: 'blur(3px)',
            ['--fx' as string]: '12px',
            ['--fy' as string]: '16px',
            animation: 'owFloat 15s ease-in-out infinite',
          }}
        />
        <div style={{ position: 'absolute', top: '20%', left: '16%', width: 5, height: 5, borderRadius: '50%', background: '#ffce72', boxShadow: '0 0 7px 2px rgba(255,200,110,0.7)' }} />
        <div style={{ position: 'absolute', bottom: '24%', right: '18%', width: 5, height: 5, borderRadius: '50%', background: '#ffd27a', boxShadow: '0 0 7px 2px rgba(255,200,110,0.7)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Link
          to="/"
          aria-label="กลับหน้าหลัก"
          className="ow-login-wordmark"
          style={{
            textDecoration: 'none',
            fontFamily: "'Sarabun', sans-serif",
            fontWeight: 700,
            fontSize: 46,
            lineHeight: 1.18,
            paddingTop: 6,
            letterSpacing: '0.5px',
            marginBottom: 28,
            background: 'linear-gradient(176deg, #fff0cc 4%, #ffce6b 36%, #f5a92f 72%, #d4801c 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            filter: 'drop-shadow(0 4px 22px rgba(240,160,50,0.32))',
          }}
        >
          พระโอวาท
        </Link>

        <div
          style={{
            width: '100%',
            padding: '34px 36px 32px',
            borderRadius: 26,
            background: 'linear-gradient(180deg, rgba(46,28,11,0.72), rgba(28,17,7,0.7))',
            border: '1px solid rgba(222,170,80,0.34)',
            boxShadow: '0 0 0 1px rgba(255,200,110,0.05) inset, 0 26px 70px rgba(0,0,0,0.55), 0 0 90px rgba(220,150,50,0.06)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={handleSubmit}>
            {!isLogin && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={labelStyle}>ชื่อ-นามสกุล</span>
                <input type="text" placeholder="กรอกชื่อของคุณ" className="ow-field" style={fieldStyle} />
              </label>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={labelStyle}>อีเมล</span>
              <input
                type="email"
                placeholder="you@example.com"
                className="ow-field"
                style={fieldStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={labelStyle}>รหัสผ่าน</span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="ow-field"
                  style={{ ...fieldStyle, padding: '13px 48px 13px 16px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label="แสดงรหัสผ่าน"
                  className="ow-eye-btn"
                  style={{
                    position: 'absolute',
                    right: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 34,
                    height: 34,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#c79a52',
                    borderRadius: 8,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </button>
              </div>
            </label>

            {!isLogin && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={labelStyle}>ยืนยันรหัสผ่าน</span>
                <input type="password" placeholder="••••••••" className="ow-field" style={fieldStyle} />
              </label>
            )}

            {isLogin && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, marginTop: -2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#cdb085' }}>
                  <input type="checkbox" style={{ width: 16, height: 16, accentColor: '#e9b85e', cursor: 'pointer' }} />
                  จดจำฉันไว้
                </label>
                <a href="#" className="ow-forgot-link" style={{ color: '#e6b65c', textDecoration: 'none' }}>
                  ลืมรหัสผ่าน?
                </a>
              </div>
            )}

            {message && (
              <p
                role="alert"
                style={{
                  margin: '-2px 0 0',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 14,
                  background: message.error ? 'rgba(190,60,40,0.16)' : 'rgba(233,184,94,0.14)',
                  border: `1px solid ${message.error ? 'rgba(230,110,80,0.4)' : 'rgba(222,170,80,0.35)'}`,
                  color: message.error ? '#f0a08a' : '#f0c878',
                }}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              className="ow-submit-btn"
              disabled={submitting}
              style={{
                marginTop: 8,
                width: '100%',
                padding: 15,
                border: 'none',
                borderRadius: 14,
                cursor: submitting ? 'wait' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                background: 'linear-gradient(160deg, #ffd070 0%, #f2a32e 52%, #d4811c 100%)',
                color: '#341c06',
                fontFamily: "'Sarabun', sans-serif",
                fontWeight: 700,
                fontSize: 18,
                boxShadow: '0 8px 24px rgba(232,160,55,0.4), 0 0 0 1px rgba(255,225,170,0.35) inset',
              }}
            >
              {submitting ? 'กำลังเข้าสู่ระบบ...' : isLogin ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0', color: 'rgba(199,154,82,0.55)', fontSize: 13 }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(199,154,82,0.28)' }} />
            หรือ
            <span style={{ flex: 1, height: 1, background: 'rgba(199,154,82,0.28)' }} />
          </div>

          <div style={{ textAlign: 'center', fontSize: 14.5, color: '#c79a52' }}>
            <span>{isLogin ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?'}</span>
            <button
              type="button"
              onClick={() => {
                setMode(isLogin ? 'signup' : 'login')
                setMessage(null)
              }}
              className="ow-switch-btn"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '0 4px',
                fontFamily: "'Sarabun', sans-serif",
                fontSize: 14.5,
                fontWeight: 600,
                color: '#f5b942',
              }}
            >
              {isLogin ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </div>

        <Link
          to="/"
          className="ow-back-link"
          style={{ marginTop: 22, fontSize: 14, color: 'rgba(199,154,82,0.7)', textDecoration: 'none' }}
        >
          ← กลับหน้าแรก
        </Link>
      </div>
    </div>
  )
}
