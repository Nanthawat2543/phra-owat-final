/**
 * ตัวช่วยชั้น HTTP — แปลงระหว่าง request/response ของ Vercel กับชั้น service
 *
 * ชั้น api ต้องบางที่สุด: อ่าน input → เรียก service → ตอบกลับ
 * ตรรกะทั้งหมดอยู่ที่ service ห้ามเขียนกฎธุรกิจในไฟล์ api
 */

import { fail, ok, AppError, STATUS_BY_CODE, type ApiMeta, type ApiResponse } from './result.js'

// รูปแบบ request/response ขั้นต่ำที่เราใช้จริง — ประกาศเองเพื่อไม่ผูกกับ Vercel
// (LINE OA / App ในอนาคตต่อผ่าน HTTP เหมือนกัน ไม่ต้องแก้ชั้นนี้)
export interface ApiRequest {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  query?: Record<string, string | string[] | undefined>
  [Symbol.asyncIterator]?: () => AsyncIterableIterator<Buffer>
}

export interface ApiResponseWriter {
  setHeader(key: string, value: string): void
  status(code: number): ApiResponseWriter
  json(body: unknown): void
}

/** พารามิเตอร์จาก query string — คืนค่าเดียวเสมอ (กรณีซ้ำเอาตัวแรก) */
export function param(req: ApiRequest, name: string): string {
  const fromQuery = req.query?.[name]
  if (fromQuery !== undefined) {
    return String(Array.isArray(fromQuery) ? fromQuery[0] : fromQuery)
  }
  // รันในเครื่องผ่าน vite ไม่มี req.query ให้ อ่านจาก url เอง
  const raw = req.url || ''
  const qs = raw.slice(raw.indexOf('?') + 1)
  if (!raw.includes('?')) return ''
  return new URLSearchParams(qs).get(name) ?? ''
}

export function intParam(req: ApiRequest, name: string, fallback: number): number {
  const n = Number.parseInt(param(req, name), 10)
  return Number.isFinite(n) ? n : fallback
}

/** อ่าน JSON body — ใช้ได้ทั้งบน Vercel (แปลงมาให้แล้ว) และ vite dev (สตรีมดิบ) */
export async function readJson<T = Record<string, unknown>>(req: ApiRequest): Promise<T> {
  if (req.body !== undefined && req.body !== null) {
    return (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as T
  }
  const chunks: Buffer[] = []
  for await (const chunk of req as AsyncIterable<Buffer>) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return (raw ? JSON.parse(raw) : {}) as T
}

export function cookie(req: ApiRequest, name: string): string | null {
  const header = req.headers?.cookie
  const raw = Array.isArray(header) ? header.join('; ') : header || ''
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

export function sendOk<T>(res: ApiResponseWriter, data: T, meta?: ApiMeta): void {
  res.status(200).json(ok(data, meta))
}

/**
 * ตอบข้อผิดพลาด — AppError จากชั้น service แปลงเป็น status ตามรหัส
 * ข้อผิดพลาดที่ไม่คาดคิดตอบ 500 พร้อมข้อความกลางๆ (ไม่เปิดเผยรายละเอียดภายใน)
 */
export function sendError(res: ApiResponseWriter, err: unknown): void {
  if (err instanceof AppError) {
    res.status(STATUS_BY_CODE[err.code]).json(fail(err.code, err.message, err.details))
    return
  }
  console.error('[api] ข้อผิดพลาดที่ไม่คาดคิด:', err)
  res.status(500).json(fail('INTERNAL_ERROR', 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง'))
}

/** จำกัดเมธอดที่รับได้ — คืน false เมื่อตอบกลับไปแล้ว */
export function allowMethods(
  req: ApiRequest,
  res: ApiResponseWriter,
  methods: string[],
): boolean {
  const method = (req.method || 'GET').toUpperCase()
  if (methods.includes(method)) return true
  res.setHeader('Allow', methods.join(', '))
  res.status(405).json(fail('VALIDATION_ERROR', `เมธอด ${method} ใช้กับปลายทางนี้ไม่ได้`))
  return false
}

/** ห่อ handler ให้ข้อผิดพลาดทุกแบบตอบกลับในรูปแบบเดียวกัน */
export function handler(
  fn: (req: ApiRequest, res: ApiResponseWriter) => Promise<void>,
): (req: ApiRequest, res: ApiResponseWriter) => Promise<void> {
  return async (req, res) => {
    try {
      await fn(req, res)
    } catch (err) {
      sendError(res, err)
    }
  }
}

export type { ApiResponse }
