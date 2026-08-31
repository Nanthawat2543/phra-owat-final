/**
 * ค่าตั้งต้นของระบบ แยกตามชั้นการใช้งาน (dev / test / prod)
 *
 * แต่ละชั้นมีฐานข้อมูลของตัวเอง แยกขาดจากกัน —
 * แก้ข้อมูลที่ dev ไม่มีทางกระทบข้อมูลจริง
 */

export type Env = 'dev' | 'test' | 'prod'

/** ชั้นที่กำลังทำงานอยู่ — ดูจาก branch ที่ deploy */
export function currentEnv(): Env {
  const explicit = process.env.APP_ENV as Env | undefined
  if (explicit === 'dev' || explicit === 'test' || explicit === 'prod') return explicit

  // Vercel บอก branch ที่ deploy มาให้
  const branch = process.env.VERCEL_GIT_COMMIT_REF
  if (branch === 'dev') return 'dev'
  if (branch === 'test') return 'test'
  if (branch === 'main') return 'prod'

  return 'dev' // รันในเครื่อง
}

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `ยังไม่ได้ตั้งค่า ${name}\n` +
        `ใส่ค่านี้ใน .env.local (รันในเครื่อง) หรือ Environment Variables ของ Vercel`,
    )
  }
  return v
}

/** ค่าเชื่อมต่อฐานข้อมูลของชั้นที่กำลังทำงาน */
export function dbConfig(env: Env = currentEnv()) {
  const suffix = env.toUpperCase()
  return {
    url: process.env[`SUPABASE_URL_${suffix}`] || required('SUPABASE_URL'),
    serviceKey: process.env[`SUPABASE_SERVICE_KEY_${suffix}`] || required('SUPABASE_SERVICE_KEY'),
  }
}

/** ชื่อคุกกี้ที่เก็บสถานะการเข้าใช้งาน */
export const SESSION_COOKIE = 'ow_session'

/** อายุของสถานะการเข้าใช้งาน (วัน) */
export const SESSION_DAYS = 7

/**
 * กุญแจลงลายเซ็น token — เรียกเฉพาะตอนต้องลงลายเซ็นหรือตรวจลายเซ็นจริงๆ
 *
 * แยกออกจากชื่อคุกกี้ เพราะแค่ "อ่านว่ามีคุกกี้ไหม" ไม่ควรพังทั้งปลายทาง
 * เมื่อยังไม่ได้ตั้งค่ากุญแจ (ผู้ที่ยังไม่เข้าสู่ระบบต้องได้คำตอบปกติ)
 */
export function authSecret(): string {
  return required('AUTH_SECRET')
}

/** จำนวนพระโอวาทที่เปิดรับได้ต่อวัน */
export const DAILY_DRAW_LIMIT = 1

/** จำนวนผลลัพธ์ต่อหน้าในการค้นหา */
export const SEARCH_PAGE_SIZE = 50
