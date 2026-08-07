import { useEffect, useState, useCallback } from 'react'

export interface User {
  email: string
  name: string
  role: string
}

/** Session state from the httpOnly cookie (via /api/auth/me). */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    const refresh = () =>
      fetch('/api/auth/me', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { user: null }))
        .then((d) => {
          if (!cancelled) setUser(d.user ?? null)
        })
        .catch(() => {
          if (!cancelled) setUser(null)
        })
        .finally(() => {
          if (!cancelled) setChecking(false)
        })

    refresh()

    // Bug #18: หลัง logout แล้วกด back เบราว์เซอร์คืนหน้าจาก bfcache (ไม่ remount)
    // ทำให้ UI ยังโชว์สถานะล็อกอินค้าง — เช็คสถานะใหม่เมื่อหน้าโผล่จาก cache
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => {
      cancelled = true
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  return { user, checking, logout }
}

export async function login(email: string, password: string): Promise<{ user?: User; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || 'เข้าสู่ระบบไม่สำเร็จ' }
    return { user: data.user }
  } catch {
    return { error: 'เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง' }
  }
}
