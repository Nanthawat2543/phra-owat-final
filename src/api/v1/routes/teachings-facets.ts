// GET /api/v1/teachings/facets — ตัวเลือกฟิลเตอร์พร้อมจำนวนผลลัพธ์
//
// แยกจากปลายทางค้นหา เพราะหน้าเว็บเรียกตอนเปิดหน้าโดยยังไม่ค้นอะไร
// จำนวนของแต่ละมิติคิดโดยข้ามฟิลเตอร์ของมิตินั้นเอง ผู้ใช้จึงเปลี่ยนตัวเลือกได้

import { allowMethods, cookie, handler, param, sendOk } from '../../../shared/http.js'
import { authService } from '../../../services/AuthService.js'
import { SESSION_COOKIE } from '../../../shared/config.js'
import { searchService } from '../../../services/SearchService.js'
import type { SearchFilters } from '../../../domain/search.js'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return

  const filters: SearchFilters = {}
  for (const name of ['deity', 'temple', 'category', 'year'] as const) {
    const value = param(req, name)
    if (value) filters[name] = value
  }

  const actor = authService.verifySession(cookie(req, SESSION_COOKIE))
  sendOk(res, await searchService.facets(actor, param(req, 'q'), filters))
})
