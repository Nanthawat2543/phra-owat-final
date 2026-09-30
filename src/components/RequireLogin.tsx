import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

/**
 * ครอบหน้าที่ต้องล็อกอินก่อนเข้า (ตอนนี้ใช้กับหน้าค้นหา)
 *
 * นโยบาย: สุ่มพระโอวาทหน้าแรกเปิดสาธารณะ — ค้นหาต้องเป็นสมาชิกที่ล็อกอินแล้ว
 * ชั้นนี้กัน "หน้าเพจ" อย่างเดียว ชั้นที่กันข้อมูลจริงคือ api/search.js
 * (กัน UI ไว้ชั้นเดียวไม่พอ เพราะใครก็ยิง /api/search ตรงได้)
 *
 * ระหว่างเช็ค session ยังไม่วาดอะไร เพื่อไม่ให้เห็นหน้าค้นหาแวบหนึ่งแล้วเด้งออก
 */
export default function RequireLogin({ children }: { children: React.ReactNode }) {
  const { user, checking } = useAuth()
  const location = useLocation()

  if (checking) return null

  if (!user) {
    // จำหน้าที่ตั้งใจจะไป เพื่อพากลับมาให้หลังล็อกอินเสร็จ
    const next = location.pathname + location.search
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  return <>{children}</>
}
