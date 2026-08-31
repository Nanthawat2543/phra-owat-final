/**
 * การเชื่อมต่อฐานข้อมูล — ที่เดียวของทั้งระบบ
 *
 * ใช้ service role key ฝั่งเซิร์ฟเวอร์เท่านั้น ห้ามหลุดไปฝั่งหน้าเว็บ
 * (บทเรียนจากระบบเก่า: anon key ฝังอยู่ในหน้าเว็บ ใครก็ดึงข้อมูลตรงได้)
 *
 * ทุกตารางเปิด RLS โดยไม่มี policy = คีย์สาธารณะเข้าไม่ถึงเลย
 * แอปเข้าถึงผ่านคีย์นี้ทางเดียว
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import WebSocketImpl from 'ws'
import { dbConfig, currentEnv, type Env } from './config.js'

/**
 * supabase-js สร้างตัวเชื่อม realtime ทุกครั้งที่สร้าง client แม้เราไม่ได้ใช้
 * ตัวนั้นต้องการ WebSocket ซึ่ง Node ต่ำกว่า 22 ไม่มีให้ในตัว
 * (Vercel รัน Node 24 จึงไม่เจอปัญหา แต่เครื่องนักพัฒนาบางเครื่องเจอ)
 */
const realtimeOptions =
  typeof globalThis.WebSocket === 'undefined'
    ? { realtime: { transport: WebSocketImpl as unknown as typeof globalThis.WebSocket } }
    : {}

const clients = new Map<Env, SupabaseClient>()

/** ตัวเชื่อมฐานข้อมูลของชั้นที่กำลังทำงาน (สร้างครั้งเดียวแล้วใช้ซ้ำ) */
export function db(env: Env = currentEnv()): SupabaseClient {
  const cached = clients.get(env)
  if (cached) return cached

  const { url, serviceKey } = dbConfig(env)
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...realtimeOptions,
  })
  clients.set(env, client)
  return client
}
