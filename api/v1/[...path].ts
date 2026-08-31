// ทางเข้าเดียวของ REST API v1 — /api/v1/**
//
// ไฟล์นี้ตั้งใจให้ว่างเปล่า: หน้าที่มีแค่ส่งต่อให้ตัวแยกเส้นทาง
// ตารางเส้นทางทั้งหมดอยู่ที่ src/api/v1/router.ts

import { route } from '../../src/api/v1/router'
import { handler } from '../../src/shared/http'

export default handler(route)
