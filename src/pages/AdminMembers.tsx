import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

interface Member {
  email: string
  name: string
  dharmaTitle: string
  temple: string
  status: 'pending' | 'active' | 'rejected' | 'blocked'
  createdAt: string | null
  reviewedAt: string | null
}

const STATUS_META: Record<Member['status'], { label: string; color: string; bg: string }> = {
  pending: { label: 'รออนุมัติ', color: '#f0c878', bg: 'rgba(233,184,94,0.14)' },
  active: { label: 'อนุมัติแล้ว', color: '#86d29a', bg: 'rgba(70,160,90,0.16)' },
  rejected: { label: 'ไม่อนุมัติ', color: '#f0a08a', bg: 'rgba(190,60,40,0.16)' },
  blocked: { label: 'ระงับ', color: '#d9a0a0', bg: 'rgba(120,50,50,0.18)' },
}

function fmtDate(iso: string | null) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '-'
  }
}

const actionBtn = (bg: string): CSSProperties => ({
  padding: '7px 14px',
  borderRadius: 9,
  border: 'none',
  cursor: 'pointer',
  background: bg,
  color: '#fff',
  fontFamily: "'Sarabun', sans-serif",
  fontWeight: 600,
  fontSize: 13.5,
})

export default function AdminMembers() {
  const { user, checking, logout } = useAuth()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/admin/members', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setMembers(d.members))
      .catch(() => setError('โหลดรายชื่อไม่สำเร็จ'))
  }, [])

  useEffect(() => {
    if (user?.role === 'admin') load()
  }, [user, load])

  const act = async (email: string, action: 'approve' | 'reject' | 'block' | 'pending') => {
    setBusy(email + action)
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action }),
      })
      if (res.ok) load()
    } finally {
      setBusy(null)
    }
  }

  const shell = (children: React.ReactNode) => (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #1a0a00 0%, #2d1810 30%, #1a0a00 100%)',
        fontFamily: "'Sarabun', sans-serif",
        color: '#e8d6b0',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
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
        <Link
          to="/"
          className="ow-wordmark"
          style={{
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 20,
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
        <span style={{ fontSize: 15, color: '#cdb085' }}>จัดการสมาชิก</span>
      </header>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px clamp(14px, 4vw, 32px) 80px' }}>{children}</main>
    </div>
  )

  if (checking) return shell(<p style={{ textAlign: 'center', color: '#c79a52', marginTop: 40 }}>กำลังตรวจสอบสิทธิ์...</p>)

  if (user?.role !== 'admin') {
    return shell(
      <div style={{ textAlign: 'center', marginTop: 40 }}>
        <p style={{ color: '#f0a08a', fontSize: 17 }}>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
        {!user ? (
          <Link to="/login" style={{ color: '#e6b65c' }}>ไปหน้าเข้าสู่ระบบ</Link>
        ) : (
          <button onClick={logout} style={{ ...actionBtn('rgba(120,72,20,0.6)'), marginTop: 10 }}>ออกจากระบบ</button>
        )}
      </div>,
    )
  }

  if (error) return shell(<p style={{ textAlign: 'center', color: '#f0a08a', marginTop: 40 }}>{error}</p>)
  if (!members) return shell(<p style={{ textAlign: 'center', color: '#c79a52', marginTop: 40 }}>กำลังโหลด...</p>)

  const pending = members.filter((m) => m.status === 'pending')
  const others = members.filter((m) => m.status !== 'pending')

  const row = (m: Member) => {
    const meta = STATUS_META[m.status]
    return (
      <div
        key={m.email}
        style={{
          padding: '16px 18px',
          borderRadius: 14,
          background: 'linear-gradient(180deg, rgba(50,30,12,0.5), rgba(33,20,8,0.46))',
          border: '1px solid rgba(200,150,70,0.28)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#f0c878' }}>{m.name || m.email}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: meta.color, background: meta.bg, padding: '2px 10px', borderRadius: 999 }}>
              {meta.label}
            </span>
          </div>
          <div style={{ fontSize: 13.5, color: '#c79a52', marginTop: 4 }}>{m.email}</div>
          <div style={{ fontSize: 13, color: '#b08a4c', marginTop: 2 }}>
            {[m.dharmaTitle, m.temple].filter(Boolean).join(' · ') || '—'} · สมัคร {fmtDate(m.createdAt)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {m.status !== 'active' && (
            <button disabled={!!busy} onClick={() => act(m.email, 'approve')} style={actionBtn('linear-gradient(180deg,#3f8f4f,#2f6f3c)')}>
              อนุมัติ
            </button>
          )}
          {m.status === 'pending' && (
            <button disabled={!!busy} onClick={() => act(m.email, 'reject')} style={actionBtn('rgba(150,50,40,0.7)')}>
              ไม่อนุมัติ
            </button>
          )}
          {m.status === 'active' && (
            <button disabled={!!busy} onClick={() => act(m.email, 'block')} style={actionBtn('rgba(120,60,30,0.7)')}>
              ระงับ
            </button>
          )}
        </div>
      </div>
    )
  }

  return shell(
    <>
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 18, color: '#f7ead0', margin: '0 0 14px' }}>
          รออนุมัติ {pending.length > 0 && <span style={{ color: '#f0c878' }}>({pending.length})</span>}
        </h2>
        {pending.length === 0 ? (
          <p style={{ color: '#b08a4c', fontSize: 15 }}>ไม่มีสมาชิกที่รออนุมัติ</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{pending.map(row)}</div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18, color: '#f7ead0', margin: '0 0 14px' }}>สมาชิกทั้งหมด ({others.length})</h2>
        {others.length === 0 ? (
          <p style={{ color: '#b08a4c', fontSize: 15 }}>ยังไม่มี</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{others.map(row)}</div>
        )}
      </section>
    </>,
  )
}
