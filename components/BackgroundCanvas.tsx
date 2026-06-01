'use client'
import { useEffect, useRef } from 'react'

export default function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    let W = c.width = window.innerWidth
    let H = c.height = window.innerHeight
    let animId: number

    const onResize = () => {
      W = c.width = window.innerWidth
      H = c.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    // Particles
    const COLORS = ['26,255,110', '0,212,255', '255,110,74', '160,100,255']
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      a: Math.random() * 0.55 + 0.12,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))

    // Floating orbs (bigger glowing blobs)
    const orbs = [
      { x: W * 0.15, y: H * 0.25, r: 3, vx: 0.18, vy: 0.12, color: '26,255,110',  a: 0.7 },
      { x: W * 0.80, y: H * 0.60, r: 2.5, vx: -0.14, vy: 0.16, color: '0,212,255',  a: 0.6 },
      { x: W * 0.50, y: H * 0.40, r: 2,   vx: 0.10, vy: -0.20, color: '26,255,110', a: 0.45 },
      { x: W * 0.30, y: H * 0.75, r: 2.8, vx: -0.16, vy: -0.10, color: '255,110,74', a: 0.4 },
      { x: W * 0.70, y: H * 0.20, r: 2,   vx: 0.22, vy: 0.14, color: '160,100,255', a: 0.5 },
    ]

    function draw() {
      ctx.clearRect(0, 0, W, H)

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(26,255,110,${0.05 * (1 - dist / 120)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw + move particles
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = W
        if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H
        if (p.y > H) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.color},${p.a})`
        ctx.fill()
      }

      // Draw + move orbs (bigger glowing dots)
      for (const o of orbs) {
        o.x += o.vx
        o.y += o.vy
        if (o.x < 0) o.x = W
        if (o.x > W) o.x = 0
        if (o.y < 0) o.y = H
        if (o.y > H) o.y = 0

        // Glow effect
        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 18)
        grad.addColorStop(0, `rgba(${o.color},${o.a})`)
        grad.addColorStop(1, `rgba(${o.color},0)`)
        ctx.beginPath()
        ctx.arc(o.x, o.y, 18, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${o.color},${Math.min(o.a + 0.3, 1)})`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(animId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.5,
      }}
    />
  )
}
