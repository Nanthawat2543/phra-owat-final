import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

/**
 * ด่านล็อกอิน — ห่อหน้าที่ต้องเข้าสู่ระบบก่อนถึงจะเข้าได้
 *
 * มติของทีม: เปิดรับพระโอวาทประจำวันเปิดให้ทุกคน แต่การค้นหาต้องเข้าสู่ระบบก่อน
 *
 * ผู้ที่ยังไม่เข้าสู่ระบบจะถูกพาไปหน้าเข้าสู่ระบบ พร้อมจำปลายทางไว้
 * เข้าสู่ระบบเสร็จแล้วพากลับมาที่เดิม (รวมคำค้นที่พิมพ์ไว้) ไม่ต้องเริ่มใหม่
 */
export default function RequireLogin({ children }: { children: React.ReactNode }) {
  const { user, checking } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (checking || user) return
    const back = `${location.pathname}${location.search}`
    navigate(`/login?next=${encodeURIComponent(back)}`, { replace: true })
  }, [checking, user, navigate, location])

  // ระหว่างเช็คสถานะ และระหว่างกำลังพาไปหน้าเข้าสู่ระบบ ยังไม่ต้องวาดอะไร
  // (วาดหน้าค้นหาแวบหนึ่งแล้วเด้งออก จะดูเหมือนระบบกระตุก)
  if (checking || !user) return null

  return <>{children}</>
}
