/**
 * รูปแบบการตอบกลับมาตรฐานของ REST API — ใช้เหมือนกันทุก endpoint
 *
 * ทุกคำตอบมีรูปแบบเดียว เพื่อให้ทั้งเว็บ, LINE OA และแอปในอนาคต
 * เขียนโค้ดฝั่งรับได้แบบเดียวกันหมด
 */

export interface ApiMeta {
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
  [key: string]: unknown
}

export interface ApiError {
  code: ErrorCode
  message: string // ข้อความภาษาไทยที่แสดงให้ผู้ใช้อ่านได้เลย
  details?: unknown
}

export interface ApiResponse<T> {
  data: T | null
  meta?: ApiMeta
  error?: ApiError
}

/** รหัสข้อผิดพลาด — ฝั่งรับใช้ตัดสินใจ ส่วน message ใช้แสดงผล */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'PENDING_APPROVAL'
  | 'ACCOUNT_BLOCKED'
  | 'DUPLICATE'
  | 'DAILY_LIMIT_REACHED'
  | 'INTERNAL_ERROR'

/** รหัสข้อผิดพลาด → HTTP status */
export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PENDING_APPROVAL: 403,
  ACCOUNT_BLOCKED: 403,
  DUPLICATE: 409,
  DAILY_LIMIT_REACHED: 429,
  INTERNAL_ERROR: 500,
}

export function ok<T>(data: T, meta?: ApiMeta): ApiResponse<T> {
  return meta ? { data, meta } : { data }
}

export function fail(code: ErrorCode, message: string, details?: unknown): ApiResponse<never> {
  return { data: null, error: details === undefined ? { code, message } : { code, message, details } }
}

/**
 * ข้อผิดพลาดที่ตั้งใจให้ผู้ใช้เห็น — โยนจากชั้น service ได้เลย
 * ชั้น api จะแปลงเป็น response ให้เอง
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
