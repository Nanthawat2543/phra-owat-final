import { useEffect, useState, useCallback } from 'react'
import { apiLogin, apiLogout, apiMe, ApiError, type User } from './api'

export type { User }

/** Session state from the httpOnly cookie (via /api/v1/auth/me). */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    const refresh = () =>
      apiMe()
        .then((u) => {
          if (!cancelled) setUser(u)
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
    await apiLogout()
    setUser(null)
  }, [])

  return { user, checking, logout }
}

export async function login(email: string, password: string): Promise<{ user?: User; error?: string }> {
  try {
    return { user: await apiLogin(email, password) }
  } catch (err) {
    // ข้อความจาก API เป็นภาษาไทยที่แสดงให้ผู้ใช้อ่านได้ทันที
    return { error: err instanceof ApiError ? err.message : 'เข้าสู่ระบบไม่สำเร็จ' }
  }
}
