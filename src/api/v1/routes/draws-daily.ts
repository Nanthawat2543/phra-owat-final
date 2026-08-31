// POST /api/v1/draws/daily — เปิดรับพระโอวาทชี้แนะประจำวัน
// GET  /api/v1/draws/daily — ดูว่าวันนี้เปิดรับไปแล้วหรือยัง
//
// body: { question?: string, guestKey?: string }
//
// เปิดรับได้วันละครั้ง บังคับที่ฐานข้อมูล — เปิดซ้ำจะได้ท่อนเดิมกลับไป
// ผู้ที่เข้าสู่ระบบแล้วผูกกับบัญชี ผู้ที่ยังไม่เข้าสู่ระบบผูกกับ guestKey ของเครื่อง

import { allowMethods, cookie, handler, param, readJson, sendOk } from '../../../shared/http.js'
import { authService } from '../../../services/AuthService.js'
import { oracleService } from '../../../services/OracleService.js'
import { authConfig } from '../../../shared/config.js'
import { AppError } from '../../../shared/result.js'
import type { DrawOwner } from '../../../repositories/DrawRepository.js'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET', 'POST'])) return

  const session = authService.verifySession(cookie(req, authConfig().cookieName))
  const body = req.method === 'POST' ? await readJson<{ question?: string; guestKey?: string }>(req) : {}
  const guestKey = String(body.guestKey ?? param(req, 'guestKey') ?? '').trim()

  const owner: DrawOwner = session ? { memberId: session.sub } : { guestKey }
  if (!session && !guestKey) {
    throw new AppError('VALIDATION_ERROR', 'ต้องเข้าสู่ระบบ หรือส่ง guestKey มาด้วย')
  }

  if (req.method === 'GET') {
    sendOk(res, { remaining: await oracleService.remainingToday(owner) })
    return
  }

  const result = await oracleService.drawDaily(owner, String(body.question ?? ''))
  sendOk(res, result, { alreadyDrawnToday: result.alreadyDrawnToday, drawDate: result.drawDate })
})
