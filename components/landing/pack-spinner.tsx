"use client"

import { useEffect, useRef } from "react"

// The Premium pack as a soft 3D pillow: the pack photo on the front and back,
// and rounded foil-purple sides built from narrow strips around a half circle.
// It turns on its own; dragging or the arrow keys turn it by hand.

const DEGREES_PER_SECOND = 26
// Front face proportions come from the photo (1120 × 800); depth is a share
// of the width, about what a pack of nine holds.
const HEIGHT = 800 / 1120
const DEPTH = 0.3
// Strips in each rounded side; more strips, smoother curve.
const STRIPS = 10

export function PackSpinner() {
  const packRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const angle = useRef(-30)
  const drag = useRef<{ x: number; velocity: number } | null>(null)
  const nudge = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    let last = performance.now()
    let frame = 0

    const paint = () => {
      const face = Math.abs(Math.cos((angle.current * Math.PI) / 180))
      packRef.current?.style.setProperty("--angle", `${angle.current}deg`)
      if (shadowRef.current) {
        // The footprint is the front's width as seen, plus the round sides.
        const width = (face + DEPTH) / (1 + DEPTH)
        shadowRef.current.style.transform = `scaleX(${width.toFixed(3)})`
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
    angle.current += dx * 0.5
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
    <div className="flex flex-col items-center select-none [--w:clamp(200px,56vw,360px)] md:[--w:clamp(240px,30vw,380px)]">
      <div
        role="img"
        aria-label="The Tausi Premium pack, turning to show its front, rounded sides and back. Drag or use the arrow keys to turn it."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative cursor-grab touch-pan-y rounded-[2rem] px-[calc(var(--w)*0.2)] py-16 outline-none [perspective:1800px] focus-visible:ring-2 focus-visible:ring-(--plum) focus-visible:ring-offset-8 active:cursor-grabbing"
      >
        <div
          ref={packRef}
          className="relative [transform-style:preserve-3d] [transform:rotateX(-8deg)_rotateY(var(--angle))]"
          style={{ width: "var(--w)", height: `calc(var(--w) * ${HEIGHT})` }}
        >
          {/* Front and back: the pack as photographed. */}
          <Face facing={0} />
          <Face facing={180} />

          {/* Rounded sides: foil purple, as at the photo's edges. */}
          {Array.from({ length: STRIPS }, (_, i) => {
            const turn = ((i + 0.5) * 180) / STRIPS
            return [
              <Strip key={`r${i}`} side={1} turn={turn} />,
              <Strip key={`l${i}`} side={-1} turn={turn} />,
            ]
          })}

          {/* Top and bottom: rounded at both ends to close the sides. */}
          <Panel
            transform={`rotateX(90deg) translateZ(calc(var(--w) * ${HEIGHT / 2}))`}
            filter="brightness(0.95)"
            className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#3E0750,#6A1C85_50%,#3E0750)]"
            style={{ width: `calc(var(--w) * ${1 + DEPTH})`, height: `calc(var(--w) * ${DEPTH})` }}
          />
          <Panel
            transform={`rotateX(-90deg) translateZ(calc(var(--w) * ${HEIGHT / 2}))`}
            filter="brightness(0.7)"
            className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2A0B36]"
            style={{ width: `calc(var(--w) * ${1 + DEPTH})`, height: `calc(var(--w) * ${DEPTH})` }}
          />
        </div>
      </div>
      <div
        ref={shadowRef}
        aria-hidden
        className="-mt-10 h-7 w-[calc(var(--w)*1.35)] rounded-[50%] bg-[radial-gradient(closest-side,rgba(42,11,54,0.22),transparent)]"
      />
    </div>
  )
}

// How lit a face is: full when it points at the viewer, darker as it turns
// away. `turn` is the face's own angle within the pack.
function lit(turn: number) {
  return `brightness(calc(0.55 + 0.45 * max(0, cos(var(--angle) + ${turn}deg))))`
}

function Face({ facing }: { facing: number }) {
  return (
    <Panel
      transform={`rotateY(${facing}deg) translateZ(calc(var(--w) * ${DEPTH / 2}))`}
      filter={lit(facing)}
      className="inset-0 bg-[url(/brand/tausi-pack-front.webp)] bg-cover bg-center"
    >
      {/* Soft shading at the top and bottom, where the foil curves away. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(42,11,54,0.35),transparent_9%,transparent_91%,rgba(42,11,54,0.4))]" />
    </Panel>
  )
}

// One strip of a rounded side. Strips sit on a half circle whose radius is
// half the depth, centred on the front's left or right edge.
function Strip({ side, turn }: { side: 1 | -1; turn: number }) {
  const radius = DEPTH / 2
  // Each strip is the width of its slice of the curve, plus a hair of overlap
  // so no seams show.
  const width = 2 * radius * Math.tan(Math.PI / (2 * STRIPS))
  return (
    <Panel
      transform={`translateX(calc(var(--w) * ${side * 0.5})) rotateY(${side * turn}deg) translateZ(calc(var(--w) * ${radius}))`}
      filter={lit(side * turn)}
      className="top-0 left-1/2 h-full -translate-x-1/2 bg-[linear-gradient(180deg,#3A0548,#6E2390_30%,#5A076F_70%,#3A0548)]"
      style={{ width: `calc(var(--w) * ${width.toFixed(4)} + 0.75px)` }}
    />
  )
}

// One flat piece of the pack, hidden when it faces away.
function Panel({
  transform,
  filter,
  className,
  style,
  children,
}: {
  transform: string
  filter: string
  className: string
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  return (
    <div
      className={`absolute overflow-hidden [backface-visibility:hidden] ${className}`}
      style={{ ...style, transform, filter }}
    >
      {children}
    </div>
  )
}
