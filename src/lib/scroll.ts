/**
 * เลื่อนขึ้นบนสุดแบบเชื่อถือได้ทุกเบราว์เซอร์
 *
 * บางเบราว์เซอร์/บางการตั้งค่า (เช่น เปิด reduce-motion หรือ WebView บางรุ่น)
 * ไม่รองรับ behavior:'smooth' — สั่งแล้วหน้าไม่ขยับเลย ผู้ใช้จะรู้สึกว่า
 * "กดปุ่มแล้วไม่มีอะไรเกิดขึ้น" จึงตรวจซ้ำแล้วกระโดดให้แทนถ้าไม่ขยับจริง
 */
export function scrollToTop() {
  const startY = window.scrollY
  if (startY === 0) return

  try {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch {
    window.scrollTo(0, 0)
    return
  }

  // ถ้าเลื่อนแบบนุ่มไม่ทำงาน (ตำแหน่งไม่ขยับ) ให้กระโดดขึ้นทันที
  window.setTimeout(() => {
    if (window.scrollY >= startY) window.scrollTo(0, 0)
  }, 350)
}
