// GET /api/search?q=<query>&deity=&temple=&category=&year=
// Free-text query is optional — facet filters alone also return results
// (browse mode). Response includes facet value counts for the dropdowns.
//
// ⚠️ ต้องล็อกอินก่อนจึงค้นหาได้ (ตามนโยบายที่ตกลงไว้)
//    - สุ่มพระโอวาทหน้าแรก /api/owat?random=true → เปิดสาธารณะ ไม่ต้องล็อกอิน
//    - ค้นหา/กรอง /api/search → สมาชิกที่ล็อกอินแล้วเท่านั้น
//    ชั้นนี้กัน "ข้อมูล" ไม่ให้ดึงตรงผ่าน API — คู่กับ guard หน้าเพจใน src/main.tsx
//    (เดิม endpoint นี้เปิดโล่ง ใครก็ยิงได้ ทั้งที่หน้าเว็บมีปุ่มเข้าสู่ระบบอยู่)

import { runSearch } from './_lib/search.js'
import { sessionFromRequest } from './_lib/auth.js'

export default function handler(req, res) {
  // ผลลัพธ์ขึ้นกับ cookie แล้ว — ห้ามให้ CDN แคชแบบ public
  // ไม่งั้นผล 200 ของสมาชิกอาจถูกเสิร์ฟต่อให้คนที่ยังไม่ล็อกอิน
  res.setHeader('Cache-Control', 'private, no-store')

  const session = sessionFromRequest(req)
  if (!session) {
    res.status(401).json({
      error: 'กรุณาเข้าสู่ระบบก่อนค้นหา',
      code: 'unauthenticated',
    })
    return
  }

  const { searchParams } = new URL(req.url, 'http://localhost')
  const q = (searchParams.get('q') || '').trim()
  const filters = {
    deity: (searchParams.get('deity') || '').trim(),
    temple: (searchParams.get('temple') || '').trim(),
    category: (searchParams.get('category') || '').trim(),
    year: (searchParams.get('year') || '').trim(),
  }

  const page = parseInt(searchParams.get('page') || '1', 10) || 1
  const { hits, total, facets, page: curPage, pageSize, totalPages } = runSearch(q, filters, page)
  res.status(200).json({ query: q, filters, hits, total, facets, page: curPage, pageSize, totalPages })
}
