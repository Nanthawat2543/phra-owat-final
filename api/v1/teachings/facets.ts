// GET /api/v1/teachings/facets — ตัวเลือกฟิลเตอร์พร้อมจำนวนผลลัพธ์
//
// แยกจากปลายทางค้นหา เพราะหน้าเว็บเรียกตอนเปิดหน้าโดยยังไม่ค้นอะไร
// จำนวนของแต่ละมิติคิดโดยข้ามฟิลเตอร์ของมิตินั้นเอง ผู้ใช้จึงเปลี่ยนตัวเลือกได้

import { allowMethods, handler, param, sendOk } from '../../../src/shared/http'
import { searchService } from '../../../src/services/SearchService'
import type { SearchFilters } from '../../../src/domain/search'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return

  const filters: SearchFilters = {}
  for (const name of ['deity', 'temple', 'category', 'year'] as const) {
    const value = param(req, name)
    if (value) filters[name] = value
  }

  sendOk(res, await searchService.facets(param(req, 'q'), filters))
})
