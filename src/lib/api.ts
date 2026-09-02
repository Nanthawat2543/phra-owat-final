/**
 * ชั้นเรียก REST API ver2 (/api/v1) สำหรับหน้าเว็บ
 *
 * หน้าที่สำคัญที่สุดของไฟล์นี้คือ **แปลงรูปข้อมูล**
 * API ใหม่ตั้งชื่อฟิลด์แบบใหม่ (deity, taughtOn, ...) แต่โค้ดที่วาดหน้าจอ
 * เขียนไว้กับชื่อเดิม (deity_th, date, ...) มาตั้งแต่ ver1
 *
 * แปลงตรงนี้ที่เดียว → ไม่ต้องแตะโค้ดหน้าจอเลยแม้แต่บรรทัดเดียว
 * หน้าตาเว็บจึงเหมือนเดิม 100% ตามที่ตกลงกันไว้
 *
 * ถ้าจะเลิกใช้ชื่อเก่าในอนาคต ค่อยไล่แก้ทีละหน้าโดยลบการแปลงออกทีละอัน
 */

import type { Passage, SearchHit, Teaching } from './format'

/** รูปแบบตอบกลับมาตรฐานของ API ver2 */
interface Envelope<T> {
  data: T | null
  meta?: Record<string, unknown>
  error?: { code: string; message: string }
}

/** ข้อผิดพลาดที่ API ตั้งใจส่งกลับมา (มีข้อความภาษาไทยพร้อมแสดง) */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<{ data: T; meta: Record<string, unknown> }> {
  let body: Envelope<T>
  try {
    const res = await fetch(`/api/v1${path}`, { cache: 'no-store', ...init })
    body = (await res.json()) as Envelope<T>
  } catch {
    throw new ApiError('NETWORK_ERROR', 'เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง')
  }
  if (body.error) throw new ApiError(body.error.code, body.error.message)
  if (body.data === null || body.data === undefined) {
    throw new ApiError('INTERNAL_ERROR', 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง')
  }
  return { data: body.data, meta: body.meta ?? {} }
}

function postJson(payload: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

// ── ค้นหา ──

export type FacetKey = 'deity' | 'temple' | 'category' | 'year'

export interface SearchData {
  hits: SearchHit[]
  total: number
  page: number
  totalPages: number
  facets: Record<FacetKey, [string, number][]>
}

interface V1Hit {
  teachingId: string
  passageIndex: number
  snippet: string
  matchedTerms: string[]
  score: number
  deity: string | null
  temple: string | null
  province: string | null
  country: string
  date: string | null
  category: string | null
  matchedField: 'passage' | 'deity' | 'temple'
}

export async function apiSearch(params: URLSearchParams): Promise<SearchData> {
  const { data, meta } = await call<{ hits: V1Hit[]; facets: Record<FacetKey, [string, number][]> }>(
    `/teachings?${params}`,
  )
  return {
    hits: data.hits.map((h) => ({
      teachingId: h.teachingId,
      paragraphIndex: h.passageIndex, // ชื่อเดิมที่หน้าจอใช้
      snippet: h.snippet,
      matchedTerms: h.matchedTerms,
      score: h.score,
      deity: h.deity ?? '',
      temple: h.temple,
      province: h.province,
      country: h.country,
      date: h.date,
      category: h.category,
      matchedField: h.matchedField,
    })),
    facets: data.facets,
    total: Number(meta.total ?? 0),
    page: Number(meta.page ?? 1),
    totalPages: Number(meta.totalPages ?? 1),
  }
}

// ── อ่านฉบับเต็ม ──

interface V1Teaching {
  id: string
  legacyId: string | null
  content: string
  deity: string | null
  temple: string | null
  province: string | null
  country: string
  category: string | null
  taughtOn: string | null
  locationNote: string | null
}

export async function apiTeaching(id: string): Promise<Teaching> {
  const { data } = await call<V1Teaching>(`/teachings/${encodeURIComponent(id)}`)
  return {
    id: data.id,
    content_th: data.content, // ต้นฉบับ ไม่ผ่านการแก้ไขใดๆ
    deity_th: data.deity ?? '',
    temple_th: data.temple,
    province_th: data.province,
    location_th: data.locationNote,
    country: data.country,
    date: data.taughtOn,
    category: data.category,
  }
}

// ── เปิดรับพระโอวาทประจำวัน ──

interface V1Passage {
  id: string
  teachingId: string
  text: string
  teaching: {
    deity: string | null
    temple: string | null
    province: string | null
    category: string | null
    taughtOn: string | null
  }
}

/**
 * รหัสประจำเครื่องสำหรับผู้ที่ยังไม่เข้าสู่ระบบ
 * ใช้ผูกโควตา "วันละครั้ง" กับเครื่อง — ผู้ที่เข้าสู่ระบบแล้วผูกกับบัญชีแทน
 */
function guestKey(): string {
  const KEY = 'ow_guest_key'
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    localStorage.setItem(KEY, fresh)
    return fresh
  } catch {
    // โหมดส่วนตัวเขียน localStorage ไม่ได้ — ใช้ค่าชั่วคราวไปก่อน
    return crypto.randomUUID()
  }
}

export interface DrawResult {
  passage: Passage
  alreadyDrawnToday: boolean
}

export async function apiDrawDaily(question = ''): Promise<DrawResult> {
  const { data, meta } = await call<{ passage: V1Passage; alreadyDrawnToday: boolean }>(
    '/draws/daily',
    postJson({ question, guestKey: guestKey() }),
  )
  const p = data.passage
  return {
    alreadyDrawnToday: Boolean(meta.alreadyDrawnToday ?? data.alreadyDrawnToday),
    passage: {
      passage_id: p.id,
      teaching_id: p.teachingId,
      text: p.text,
      deity_th: p.teaching.deity ?? '',
      temple_th: p.teaching.temple,
      province_th: p.teaching.province,
      location_th: null,
      country: null,
      date: p.teaching.taughtOn,
      category: p.teaching.category,
    },
  }
}

// ── สมาชิก ──

export interface User {
  id: string
  email: string
  name: string
  role: string
}

export async function apiMe(): Promise<User | null> {
  const { data } = await call<{ user: User | null }>('/auth/me')
  return data.user
}

export async function apiLogin(email: string, password: string): Promise<User> {
  const { data } = await call<{ user: User }>('/auth/login', postJson({ email, password }))
  return data.user
}

export async function apiLogout(): Promise<void> {
  await call<{ user: null }>('/auth/logout', { method: 'POST' }).catch(() => undefined)
}

export interface RegisterInput {
  name: string
  dharmaTitle: string
  templeName: string
  email: string
  password: string
  confirmPassword: string
}

export async function apiRegister(input: RegisterInput): Promise<string> {
  const { data } = await call<{ message: string }>('/auth/register', postJson(input))
  return data.message
}

// ── ผู้ดูแลระบบ ──

export interface AdminMember {
  id: string
  email: string
  name: string
  dharmaTitle: string
  temple: string
  status: 'pending' | 'active' | 'rejected' | 'blocked'
  createdAt: string | null
  reviewedAt: string | null
}

interface V1Member {
  id: string
  email: string
  name: string
  dharmaTitle: string | null
  templeName: string | null
  status: AdminMember['status']
  createdAt: string
  reviewedAt: string | null
}

const toAdminMember = (m: V1Member): AdminMember => ({
  id: m.id,
  email: m.email,
  name: m.name,
  dharmaTitle: m.dharmaTitle ?? '',
  temple: m.templeName ?? '', // ชื่อเดิมที่หน้าจอใช้
  status: m.status,
  createdAt: m.createdAt,
  reviewedAt: m.reviewedAt,
})

export async function apiListMembers(): Promise<AdminMember[]> {
  const { data } = await call<{ members: V1Member[] }>('/admin/members')
  return data.members.map(toAdminMember)
}

export async function apiSetMemberStatus(
  id: string,
  status: AdminMember['status'],
): Promise<AdminMember> {
  const { data } = await call<{ member: V1Member }>('/admin/members', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  return toAdminMember(data.member)
}
