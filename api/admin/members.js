// จัดการสมาชิก (เฉพาะแอดมิน)
//   GET  /api/admin/members            → รายชื่อสมาชิกทั้งหมด
//   POST /api/admin/members {email,action:approve|reject|block|pending}
import { sessionFromRequest, listMembers, setMemberStatus, readJsonBody } from '../_lib/auth.js'

const ACTION_STATUS = {
  approve: 'active',
  reject: 'rejected',
  block: 'blocked',
  pending: 'pending',
}

export default async function handler(req, res) {
  // ต้องเป็นแอดมินเท่านั้น
  const session = sessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบ' })
    return
  }
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    try {
      const members = await listMembers()
      res.status(200).json({ members })
    } catch (err) {
      console.error('list members failed:', err)
      res.status(500).json({ error: 'โหลดรายชื่อสมาชิกไม่สำเร็จ' })
    }
    return
  }

  if (req.method === 'POST') {
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      res.status(400).json({ error: 'Invalid JSON' })
      return
    }
    const status = ACTION_STATUS[body.action]
    if (!body.email || !status) {
      res.status(400).json({ error: 'ต้องระบุ email และ action (approve/reject/block/pending)' })
      return
    }
    try {
      const ok = await setMemberStatus(body.email, status)
      if (!ok) {
        res.status(404).json({ error: 'ไม่พบสมาชิกนี้' })
        return
      }
      res.status(200).json({ ok: true, email: body.email, status })
    } catch (err) {
      console.error('update member failed:', err)
      res.status(500).json({ error: 'อัปเดตสถานะไม่สำเร็จ' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
