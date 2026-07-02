import { useEffect, useRef } from 'react'

interface Orb {
  x: number
  y: number
  baseX: number
  baseY: number
  size: number
  speed: number
  angle: number
  radius: number // how far it drifts from base
  opacity: number
  pulseSpeed: number
  pulsePhase: number
}

/** Animated amber glow orbs — ported from the original owat.fycdth.com background. */
export default function BackgroundGlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const orbsRef = useRef<Orb[]>([])
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const w = window.innerWidth
    const h = window.innerHeight
    orbsRef.current = [
      // Large soft ambient glows
      { x: 0, y: 0, baseX: w * 0.15, baseY: h * 0.2, size: 80, speed: 0.3, angle: 0, radius: 40, opacity: 0.25, pulseSpeed: 0.4, pulsePhase: 0 },
      { x: 0, y: 0, baseX: w * 0.75, baseY: h * 0.15, size: 70, speed: 0.25, angle: Math.PI * 0.5, radius: 35, opacity: 0.2, pulseSpeed: 0.35, pulsePhase: 1 },
      { x: 0, y: 0, baseX: w * 0.4, baseY: h * 0.65, size: 60, speed: 0.35, angle: Math.PI, radius: 30, opacity: 0.22, pulseSpeed: 0.45, pulsePhase: 2 },
      { x: 0, y: 0, baseX: w * 0.85, baseY: h * 0.7, size: 65, speed: 0.28, angle: Math.PI * 1.5, radius: 35, opacity: 0.18, pulseSpeed: 0.3, pulsePhase: 3 },
      // Smaller brighter firefly-like dots
      { x: 0, y: 0, baseX: w * 0.25, baseY: h * 0.45, size: 12, speed: 0.5, angle: 0.5, radius: 50, opacity: 0.5, pulseSpeed: 0.8, pulsePhase: 0.5 },
      { x: 0, y: 0, baseX: w * 0.6, baseY: h * 0.35, size: 10, speed: 0.55, angle: 1.2, radius: 45, opacity: 0.45, pulseSpeed: 0.9, pulsePhase: 1.5 },
      { x: 0, y: 0, baseX: w * 0.5, baseY: h * 0.8, size: 8, speed: 0.6, angle: 2.0, radius: 40, opacity: 0.4, pulseSpeed: 1.0, pulsePhase: 2.5 },
      { x: 0, y: 0, baseX: w * 0.1, baseY: h * 0.7, size: 9, speed: 0.45, angle: 3.0, radius: 55, opacity: 0.35, pulseSpeed: 0.7, pulsePhase: 3.5 },
      { x: 0, y: 0, baseX: w * 0.9, baseY: h * 0.4, size: 7, speed: 0.5, angle: 4.0, radius: 35, opacity: 0.4, pulseSpeed: 0.85, pulsePhase: 4.0 },
      { x: 0, y: 0, baseX: w * 0.35, baseY: h * 0.1, size: 6, speed: 0.65, angle: 5.0, radius: 30, opacity: 0.35, pulseSpeed: 1.1, pulsePhase: 0.8 },
    ]

    const draw = (time: number) => {
      // Delta time in seconds, capped to prevent jumps after tab switch
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = time

      const vw = window.innerWidth
      const vh = window.innerHeight

      ctx.clearRect(0, 0, vw, vh)

      for (const orb of orbsRef.current) {
        // Circular drift
        orb.angle += orb.speed * dt
        orb.x = orb.baseX + Math.cos(orb.angle) * orb.radius
        orb.y = orb.baseY + Math.sin(orb.angle * 0.7) * orb.radius

        // Pulsing opacity
        orb.pulsePhase += orb.pulseSpeed * dt
        const pulse = 0.5 + 0.5 * Math.sin(orb.pulsePhase)
        const alpha = orb.opacity * (0.4 + 0.6 * pulse)

        const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.size)
        gradient.addColorStop(0, `rgba(251, 191, 36, ${alpha})`)
        gradient.addColorStop(0.4, `rgba(234, 179, 8, ${alpha * 0.5})`)
        gradient.addColorStop(1, 'rgba(234, 179, 8, 0)')

        ctx.beginPath()
        ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    // Reset lastTime on tab return to prevent time jump
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastTimeRef.current = performance.now()
        animRef.current = requestAnimationFrame(draw)
      } else {
        cancelAnimationFrame(animRef.current)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    lastTimeRef.current = performance.now()
    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  )
}
