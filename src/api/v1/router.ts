/**
 * ตารางเส้นทางของ REST API v1 — เส้นทางทั้งหมดของระบบอยู่ในไฟล์เดียวนี้
 *
 * ทำไมรวมเป็นทางเข้าเดียวแทนที่จะแยกไฟล์ละเส้นทาง:
 *   1. แพ็กเกจของ Vercel จำกัดจำนวนฟังก์ชันต่อโปรเจกต์ — ver1 ใช้ไปแล้ว 7
 *      ถ้า ver2 แยกอีก 9 จะเกินเพดานจน deploy ไม่ผ่าน
 *   2. รวมเป็นฟังก์ชันเดียวแปลว่ามีจุดตื่นจุดเดียว ตอบเร็วกว่าแยกกัน
 *   3. เปิดไฟล์นี้ไฟล์เดียวก็เห็นว่า API มีเส้นทางอะไรบ้าง
 *
 * เพิ่มเส้นทางใหม่: สร้างไฟล์ใน routes/ แล้วมาเพิ่มหนึ่งบรรทัดใน ROUTES
 */

import { fail } from '../../shared/result.js'
import type { ApiRequest, ApiResponseWriter } from '../../shared/http.js'

import teachingsSearch from './routes/teachings-search.js'
import teachingsFacets from './routes/teachings-facets.js'
import teachingsRead from './routes/teachings-read.js'
import drawsDaily from './routes/draws-daily.js'
import authRegister from './routes/auth-register.js'
import authLogin from './routes/auth-login.js'
import authLogout from './routes/auth-logout.js'
import authMe from './routes/auth-me.js'
import adminMembers from './routes/admin-members.js'

type Route = (req: ApiRequest, res: ApiResponseWriter) => Promise<void>

/**
 * เส้นทางแบบตายตัว — เทียบตรงๆ กับ path ที่เหลือหลังตัด /api/v1/ ออก
 * ต้องตรวจก่อนเส้นทางที่มีตัวแปรเสมอ ไม่งั้น "facets" จะถูกอ่านเป็นชื่อ id
 */
const ROUTES: Record<string, Route> = {
  'teachings': teachingsSearch,
  'teachings/facets': teachingsFacets,
  'draws/daily': drawsDaily,
  'auth/register': authRegister,
  'auth/login': authLogin,
  'auth/logout': authLogout,
  'auth/me': authMe,
  'admin/members': adminMembers,
}

/** เส้นทางที่มีตัวแปรใน path */
const DYNAMIC_ROUTES: { pattern: RegExp; params: string[]; route: Route }[] = [
  { pattern: /^teachings\/([^/]+)$/, params: ['id'], route: teachingsRead },
]

/** path ที่เหลือหลังตัด /api/v1/ ออก เช่น "teachings/facets" */
export function normalizePath(url: string): string {
  return url
    .split('?')[0]
    .replace(/^\/api\/v1\/?/, '')
    .replace(/\/+$/, '')
}

/**
 * ส่ง request ไปยังเส้นทางที่ตรงกัน
 * ไม่มีเส้นทางไหนตรง ตอบ 404 ในรูปแบบเดียวกับข้อผิดพลาดอื่นทั้งหมด
 */
export async function route(req: ApiRequest, res: ApiResponseWriter): Promise<void> {
  const path = normalizePath(req.url || '')

  const exact = ROUTES[path]
  if (exact) return exact(req, res)

  for (const { pattern, params, route: handler } of DYNAMIC_ROUTES) {
    const match = path.match(pattern)
    if (!match) continue
    // ยัดค่าจาก path ลง query เพื่อให้ handler อ่านผ่าน param() ทางเดียวเหมือนกันหมด
    const fromPath = Object.fromEntries(
      params.map((name, i) => [name, decodeURIComponent(match[i + 1])]),
    )
    Object.assign(req, { query: { ...(req.query ?? {}), ...fromPath } })
    return handler(req, res)
  }

  res.status(404).json(fail('NOT_FOUND', `ไม่มีปลายทาง /api/v1/${path}`))
}

/** รายชื่อเส้นทางทั้งหมด — ใช้ในสคริปต์ทดสอบและเอกสาร */
export const ROUTE_NAMES = [
  ...Object.keys(ROUTES).map((p) => `/api/v1/${p}`),
  '/api/v1/teachings/:id',
]
