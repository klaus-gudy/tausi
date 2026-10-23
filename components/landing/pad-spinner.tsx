"use client"

import { useEffect, useId, useRef } from "react"

import { Emblem } from "./emblem"
import { PAD_WIDTH, BASE_LENGTH, padCore, padOutline } from "./pad-shape"

// A pad built as a real 3D object: a stack of outline slices gives it
// thickness, with the top sheet and its purple strip on the front and the
// printed release paper on the back. It turns on its own; dragging or the
// arrow keys turn it by hand.

const LAYERS = 14
const DEGREES_PER_SECOND = 26
const outline = padOutline()
const core = padCore()

export function PadSpinner() {
  const id = useId()
  const padRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const angle = useRef(-28)
  const drag = useRef<{ x: number; velocity: number } | null>(null)
  const nudge = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    let last = performance.now()
    let frame = 0

    const paint = () => {
      const a = angle.current
      const facing = Math.abs(Math.cos((a * Math.PI) / 180))
      padRef.current?.style.setProperty("--angle", `${a}deg`)
      padRef.current?.style.setProperty("--facing", facing.toFixed(3))
      if (shadowRef.current) {
        shadowRef.current.style.transform = `scaleX(${Math.max(facing, 0.14)})`
      }
    }

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000
      last = now
      if (!drag.current) {
        // A flick keeps turning, then eases back into the steady spin.
        nudge.current *= Math.pow(0.04, dt)
        const auto = reduce.matches ? 0 : DEGREES_PER_SECOND
        angle.current += (auto + nudge.current) * dt
      }
      paint()
      frame = requestAnimationFrame(tick)
    }

    paint()
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  function onPointerDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, velocity: 0 }
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag.current) return
    const dx = event.clientX - drag.current.x
    drag.current = { x: event.clientX, velocity: dx * 40 }
    angle.current += dx * 0.6
  }

  function onPointerUp() {
    if (drag.current) nudge.current = drag.current.velocity
    drag.current = null
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowLeft") angle.current -= 20
    else if (event.key === "ArrowRight") angle.current += 20
    else return
    event.preventDefault()
  }

  return (
    <div className="flex flex-col items-center select-none">
      <div
        role="img"
        aria-label="A Tausi pad with wings, turning to show the soft top sheet with its purple centre strip, its slim edge and the printed backing. Drag or use the arrow keys to turn it."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative cursor-grab touch-pan-y rounded-[2rem] px-10 py-6 outline-none focus-visible:ring-2 focus-visible:ring-(--plum) focus-visible:ring-offset-8 active:cursor-grabbing [--pad-w:clamp(140px,34vw,196px)] [perspective:1600px]"
      >
        <div
          ref={padRef}
          className="relative [transform-style:preserve-3d] [transform:rotateX(6deg)_rotateY(var(--angle))]"
          style={{
            width: "var(--pad-w)",
            aspectRatio: `${PAD_WIDTH} / ${BASE_LENGTH}`,
          }}
        >
          {Array.from({ length: LAYERS }, (_, i) => {
            const offset = i / (LAYERS - 1) - 0.5
            return (
              <Slice key={i} z={offset} fill={i < LAYERS / 2 ? "#DDD3E2" : "#ECE6EF"} />
            )
          })}

          {/* Front: the top sheet. */}
          <Face z={0.5}>
            <svg viewBox={`0 0 ${PAD_WIDTH} ${BASE_LENGTH}`} className="size-full">
              <defs>
                <radialGradient id={`${id}-sheet`} cx="50%" cy="45%" r="70%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#F1EBF4" />
                </radialGradient>
                <pattern id={`${id}-quilt`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <path d="M0 6h12M6 0v12" stroke="#E6DCEA" strokeWidth="0.8" />
                </pattern>
                <linearGradient id={`${id}-strip`} x1="0" x2="1">
                  <stop offset="0%" stopColor="#5C0A78" />
                  <stop offset="50%" stopColor="#8A2FB0" />
                  <stop offset="100%" stopColor="#5C0A78" />
                </linearGradient>
                <clipPath id={`${id}-core`}>
                  <path d={core} />
                </clipPath>
              </defs>
              <path d={outline} fill={`url(#${id}-sheet)`} stroke="#E2D7E7" strokeWidth="1.5" />
              <rect width={PAD_WIDTH} height={BASE_LENGTH} fill={`url(#${id}-quilt)`} clipPath={`url(#${id}-core)`} />
              <path d={core} fill="none" stroke="#D8C8DE" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
              <path d={core} fill="none" stroke="#E4D9E8" strokeWidth="1" transform="translate(100 260) scale(1.09 1.04) translate(-100 -260)" />
              <path d={core} fill="none" stroke="#EDE5F0" strokeWidth="1" transform="translate(100 260) scale(0.8 0.86) translate(-100 -260)" />
              {/* The purple strip down the centre, as on the pack. */}
              <rect x="84" y="196" width="32" height="128" rx="6" fill={`url(#${id}-strip)`} />
            </svg>
          </Face>

          {/* Back: the release paper, printed with the peacock. */}
          <Face z={0.5} back>
            <svg viewBox={`0 0 ${PAD_WIDTH} ${BASE_LENGTH}`} className="size-full">
              <path d={outline} fill="#F7F3F9" stroke="#DCCFE2" strokeWidth="1.5" />
              <path d={outline} fill="none" stroke="#CDB8D2" strokeWidth="1" strokeDasharray="3 5" transform="translate(100 260) scale(0.9 0.95) translate(-100 -260)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Emblem className="w-[42%] bg-(--orchid)" />
              <span className="pl-[0.4em] font-(family-name:--font-cinzel) text-[calc(var(--pad-w)*0.1)] tracking-[0.4em] text-(--orchid)">
                TAUSI
              </span>
            </div>
          </Face>
        </div>
      </div>
      <div
        ref={shadowRef}
        aria-hidden
        className="-mt-2 h-5 w-[calc(var(--pad-w,180px)*1.1)] rounded-[50%] bg-[radial-gradient(closest-side,rgba(42,11,54,0.16),transparent)] [--pad-w:clamp(140px,34vw,196px)]"
      />
    </div>
  )
}

// Depth is a share of the pad's width, so it scales with the pad.
function depth(z: number) {
  return `calc(var(--pad-w) * ${(z * 0.07).toFixed(4)})`
}

function Slice({ z, fill }: { z: number; fill: string }) {
  return (
    <div
      className="absolute inset-0 [filter:brightness(calc(0.86+var(--facing)*0.14))]"
      style={{ transform: `translateZ(${depth(z)})` }}
    >
      <svg viewBox={`0 0 ${PAD_WIDTH} ${BASE_LENGTH}`} className="size-full">
        <path d={outline} fill={fill} />
      </svg>
    </div>
  )
}

function Face({ z, back, children }: { z: number; back?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 [backface-visibility:hidden] [filter:brightness(calc(0.9+var(--facing)*0.1))]"
      style={{
        transform: `${back ? "rotateY(180deg) " : ""}translateZ(calc(${depth(z)} + 0.5px))`,
      }}
    >
      {children}
    </div>
  )
}
