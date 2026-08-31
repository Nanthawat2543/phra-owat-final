/**
 * เปิดรับพระโอวาทชี้แนะประจำวัน
 *
 * ver1 จำกัดวันละครั้งด้วย localStorage ฝั่งเบราว์เซอร์ — ล้างข้อมูลก็สุ่มใหม่ได้
 * ver2 บังคับที่ฐานข้อมูล: เปิดรับแล้วในวันนี้ จะได้ท่อนเดิมกลับไปเสมอ
 */

import { expandQueryTerms, scorePassage } from '../domain/search'
import type { PassageWithSource } from '../domain/teaching'
import { AppError } from '../shared/result'
import { DAILY_DRAW_LIMIT } from '../shared/config'
import { passageRepository, type PassageRepository } from '../repositories/PassageRepository'
import { drawRepository, type DrawOwner, type DrawRepository } from '../repositories/DrawRepository'

export interface DrawResult {
  passage: PassageWithSource
  /** true = เคยเปิดรับไปแล้ววันนี้ ท่อนนี้คือของเดิม ไม่ได้สุ่มใหม่ */
  alreadyDrawnToday: boolean
  drawDate: string
}

/** วันที่ตามเวลาไทย — ผู้ใช้อยู่ไทย เซิร์ฟเวอร์อยู่ต่างประเทศ ต้องยึดเวลาผู้ใช้ */
export function todayInBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export class OracleService {
  constructor(
    private readonly passages: PassageRepository = passageRepository,
    private readonly draws: DrawRepository = drawRepository,
  ) {}

  /**
   * เปิดรับของวันนี้ — ถ้าเปิดไปแล้วคืนท่อนเดิม
   * @param question คำถามที่ผู้ใช้ตั้งไว้ (ว่างได้ = สุ่มล้วน)
   */
  async drawDaily(owner: DrawOwner, question = ''): Promise<DrawResult> {
    if (!owner.memberId && !owner.guestKey) {
      throw new AppError('VALIDATION_ERROR', 'ไม่รู้ว่าเป็นการเปิดรับของใคร')
    }
    const date = todayInBangkok()

    const existing = await this.draws.findForDate(owner, date)
    if (existing) {
      const passage = await this.passages.findById(existing.passageId)
      if (passage) return { passage, alreadyDrawnToday: true, drawDate: date }
      // ท่อนเดิมถูกลบไปแล้ว (แทบไม่เกิด) — สุ่มใหม่แทนที่จะตอบว่างเปล่า
    }

    const recent = await this.draws.recentPassageIds(owner)
    const passage = question.trim()
      ? await this.drawForQuestion(question, recent)
      : await this.drawRandom(recent)

    if (!passage) throw new AppError('NOT_FOUND', 'ยังไม่มีพระโอวาทให้เปิดรับ')

    await this.draws.record(owner, date, passage.id)
    return { passage, alreadyDrawnToday: false, drawDate: date }
  }

  /** สุ่มโดยไม่บันทึก — ใช้แสดงตัวอย่างหรือทดสอบ ไม่กินโควตาของวัน */
  async peek(question = ''): Promise<PassageWithSource> {
    const passage = question.trim()
      ? await this.drawForQuestion(question, [])
      : await this.drawRandom([])
    if (!passage) throw new AppError('NOT_FOUND', 'ยังไม่มีพระโอวาทให้เปิดรับ')
    return passage
  }

  /** โควตาที่เหลือของวันนี้ */
  async remainingToday(owner: DrawOwner): Promise<number> {
    const existing = await this.draws.findForDate(owner, todayInBangkok())
    return existing ? 0 : DAILY_DRAW_LIMIT
  }

  // ── สุ่มล้วน ──
  // สุ่มตำแหน่งแล้วดึงแถวเดียว ไม่โหลดทั้งคลังขึ้นหน่วยความจำเหมือน ver1
  private async drawRandom(exclude: string[]): Promise<PassageWithSource | null> {
    const total = await this.passages.countQuotable()
    if (total === 0) return null

    const skip = new Set(exclude)
    // ลองไม่กี่ครั้งเพื่อเลี่ยงท่อนที่เพิ่งได้ไป — ครบแล้วยอมซ้ำดีกว่าไม่ได้อะไรเลย
    for (let attempt = 0; attempt < 5; attempt++) {
      const passage = await this.passages.findQuotableAt(Math.floor(Math.random() * total))
      if (passage && !skip.has(passage.id)) return passage
      if (passage && attempt === 4) return passage
    }
    return this.passages.findQuotableAt(Math.floor(Math.random() * total))
  }

  // ── สุ่มตามคำถาม ──
  // ให้คะแนนตามคำที่ตรง แล้วสุ่มจากกลุ่มคะแนนสูงสุด (ไม่หยิบอันดับหนึ่งเสมอ
  // เพราะถามคำเดิมทุกวันแล้วได้คำตอบเดิมจะไม่มีความหมาย)
  private async drawForQuestion(
    question: string,
    exclude: string[],
    topK = 30,
  ): Promise<PassageWithSource | null> {
    const rawLower = question.trim().toLowerCase()
    const terms = expandQueryTerms(question)
    if (!terms.includes(rawLower)) terms.push(rawLower)

    const candidates = await this.passages.findQuotableMatching(terms)
    if (candidates.length === 0) return this.drawRandom(exclude)

    const skip = new Set(exclude)
    const scored = candidates
      .map((p) => ({ p, score: scorePassage(p.text.toLowerCase(), terms, rawLower).score }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) return this.drawRandom(exclude)

    const top = scored.slice(0, topK).map((s) => s.p)
    const fresh = top.filter((p) => !skip.has(p.id))
    const pool = fresh.length > 0 ? fresh : top
    return pool[Math.floor(Math.random() * pool.length)]
  }
}

export const oracleService = new OracleService()
