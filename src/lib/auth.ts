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
    return () => {
      cancelled = true
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
