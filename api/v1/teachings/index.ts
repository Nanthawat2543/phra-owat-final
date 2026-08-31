// GET /api/v1/teachings — ค้นหา + ฟิลเตอร์ + แบ่งหน้า
//
// q         คำค้น (ว่าง = เปิดดูทั้งหมด)
// deity / temple / category / year   ฟิลเตอร์
// page      หน้าที่ต้องการ (เริ่มที่ 1)

import { allowMethods, handler, intParam, param, sendOk } from '../../../src/shared/http'
import { searchService } from '../../../src/services/SearchService'
import type { SearchFilters } from '../../../src/domain/search'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return

  const filters: SearchFilters = {}
  for (const name of ['deity', 'temple', 'category', 'year'] as const) {
    const value = param(req, name)
    if (value) filters[name] = value
  }

  const result = await searchService.search(param(req, 'q'), filters, intParam(req, 'page', 1))

  sendOk(
    res,
    { hits: result.hits, facets: result.facets },
    {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
  )
})
