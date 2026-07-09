import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '../lib/auth'

/**
 * Top-right account control — Google-style: a round avatar that opens a
 * dropdown with the profile info and a logout button.
 */
export default function UserMenu({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!user) {
    return (
      <Link
        to="/login"
        className="ow-login-btn"
        style={{
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ flexShrink: 0 }}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
          />
        </svg>
        {/* จอแคบซ่อนข้อความ เหลือไอคอนกลม (ดู index.css) */}
        <span className="ow-login-label">เข้าสู่ระบบ</span>
      </Link>
    )
  }

  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase()

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Avatar circle */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="บัญชีผู้ใช้"
        className="ow-avatar-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 42,
          height: 42,
          borderRadius: '50%',
          cursor: 'pointer',
          border: open ? '2px solid rgba(245,180,80,0.9)' : '2px solid rgba(222,170,80,0.45)',
          background: 'linear-gradient(160deg, #d97706, #92400e)',
          color: '#fff',
          fontFamily: "'Sarabun', sans-serif",
          fontSize: 18,
          fontWeight: 700,
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          transition: 'border-color 0.15s, transform 0.15s',
        }}
      >
        {initial}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            zIndex: 60,
            width: 260,
            borderRadius: 18,
            background: 'linear-gradient(180deg, rgba(52,32,12,0.98), rgba(33,20,8,0.98))',
            border: '1px solid rgba(222,170,80,0.4)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
            overflow: 'hidden',
            fontFamily: "'Sarabun', sans-serif",
          }}
        >
          {/* Profile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 18px 16px', borderBottom: '1px solid rgba(199,154,82,0.22)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'linear-gradient(160deg, #d97706, #92400e)',
                color: '#fff',
                fontSize: 24,
                fontWeight: 700,
                marginBottom: 10,
                border: '2px solid rgba(255,220,150,0.4)',
              }}
            >
              {initial}
            </div>
            <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: '#f5e6c4', textAlign: 'center' }}>{user.name || user.email}</p>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#b08a4c', textAlign: 'center', wordBreak: 'break-all' }}>{user.email}</p>
            {user.role === 'admin' && (
              <span
                style={{
                  marginTop: 8,
                  padding: '3px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'rgba(233,184,94,0.14)',
                  border: '1px solid rgba(222,170,80,0.35)',
                  color: '#f0c878',
                }}
              >
                ผู้ดูแลระบบ
              </span>
            )}
          </div>

          {/* Logout */}
          <div style={{ padding: 10 }}>
            <button
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className="ow-menu-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '11px 14px',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                background: 'transparent',
                color: '#e6c890',
                fontFamily: "'Sarabun', sans-serif",
                fontSize: 14.5,
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              ออกจากระบบ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
