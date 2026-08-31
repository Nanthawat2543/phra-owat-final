// GET /api/v1/teachings/:id — อ่านพระโอวาทฉบับเต็ม
//
// รับได้ทั้ง id ใหม่ (uuid) และ id เดิมจาก ver1

import { allowMethods, handler, param, sendOk } from '../../../src/shared/http'
import { teachingService } from '../../../src/services/TeachingService'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return

  // บน Vercel มาจากชื่อไฟล์ [id] — รันในเครื่องอ่านจากท้าย path เอง
  const id = param(req, 'id') || decodeURIComponent((req.url || '').split('?')[0].split('/').pop() || '')

  sendOk(res, await teachingService.getById(id))
})
