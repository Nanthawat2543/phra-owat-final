/**
 * ไล่ดึงข้อมูลให้ครบทุกแถว
 *
 * ฐานข้อมูลจำกัดจำนวนแถวต่อหนึ่งคำขอ (ค่าตั้งต้นของ Supabase คือ 1,000)
 * คำขอเดียวจึงได้ข้อมูลไม่ครบโดยไม่มีข้อผิดพลาดแจ้งเตือน — เงียบๆ หายไปเฉยๆ
 *
 * เคยทำให้ค้น "บำเพ็ญ" ได้ 159 ฉบับ ทั้งที่จริงมี 700 ฉบับ
 * ทุกที่ที่ผลลัพธ์อาจเกิน 1,000 แถว ต้องดึงผ่านฟังก์ชันนี้เสมอ
 */

const PAGE = 1000

/** จำนวนแถวสูงสุดที่ยอมดึง — กันคำค้นกว้างมากจนดึงทั้งคลัง */
const MAX_ROWS = 100_000

export interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

/**
 * @param fetchPage ฟังก์ชันที่ดึงแถวช่วง [from, to] (ต้องสร้าง query ใหม่ทุกครั้ง
 *                  เพราะ query ของ Supabase ใช้ซ้ำไม่ได้)
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}
