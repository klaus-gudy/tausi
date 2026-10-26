"use client"

import { useEffect, useRef } from "react"

// The Premium pack as a real 3D box: the pack photo on the front and back,
// and foil-purple sides. It turns on its own; dragging or the arrow keys turn
// it by hand.

const DEGREES_PER_SECOND = 26
// Front face proportions come from the photo (1120 × 800); depth is a share
// of the width, about what a pack of nine holds.
const HEIGHT = 800 / 1120
const DEPTH = 0.3
const START_ANGLE = -30

// The face most in view at each quarter turn, for screen readers.
const FACES = ["Front", "Side", "Back", "Side"]

/** The turn as a slider value: whole degrees 0–359 and the face in view. */
function turnOf(angle: number) {
  const degrees = Math.round(((angle % 360) + 360) % 360) % 360
  return { degrees, face: FACES[Math.round(degrees / 90) % 4] }
}

export function PackSpinner() {
  const packRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const angle = useRef(START_ANGLE)
  const drag = useRef<{ x: number; velocity: number } | null>(null)
  const nudge = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    let last = performance.now()
    let frame = 0

    const paint = () => {
      const radians = (angle.current * Math.PI) / 180
      const face = Math.abs(Math.cos(radians))
      const side = Math.abs(Math.sin(radians))
      const style = packRef.current?.style
      style?.setProperty("--angle", `${angle.current}deg`)
      style?.setProperty("--face", face.toFixed(3))
      style?.setProperty("--side", side.toFixed(3))
      if (shadowRef.current) {
        // The footprint is the front's width plus the side's depth, as seen.
        const width = face + side * DEPTH
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

  // Only after a turn by hand: updating it every frame of the steady spin
  // would keep a screen reader talking.
  function announce(node: HTMLElement) {
    const { degrees, face } = turnOf(angle.current)
    node.setAttribute("aria-valuenow", String(degrees))
    node.setAttribute("aria-valuetext", face)
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (drag.current) nudge.current = drag.current.velocity
    drag.current = null
    announce(event.currentTarget)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") angle.current -= 20
    else if (event.key === "ArrowRight") angle.current += 20
    else return
    event.preventDefault()
    announce(event.currentTarget)
  }

  return (
    <div className="flex flex-col items-center select-none [--w:clamp(220px,62vw,400px)] md:[--w:clamp(260px,34vw,420px)]">
      <div
        role="slider"
        aria-label="The Tausi Premium pack, 9 pads of 340 mm, turning to show its front, sides and back. Drag or use the arrow keys to turn it."
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={turnOf(START_ANGLE).degrees}
        aria-valuetext={turnOf(START_ANGLE).face}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative cursor-grab touch-pan-y rounded-[2rem] px-6 py-16 outline-none [perspective:1800px] focus-visible:ring-2 focus-visible:ring-(--plum) focus-visible:ring-offset-8 active:cursor-grabbing"
      >
        <div
          ref={packRef}
          className="relative [transform-style:preserve-3d] [transform:rotateX(-8deg)_rotateY(var(--angle))]"
          style={{ width: "var(--w)", height: `calc(var(--w) * ${HEIGHT})` }}
        >
          {/* Front: the pack as photographed. */}
          <Panel
            transform={`translateZ(calc(var(--w) * ${DEPTH / 2}))`}
            light="var(--face)"
            className="inset-0 bg-[url(/brand/tausi-pack-front.webp)] bg-cover bg-center"
          />

          {/* Back: the same printed face as the front. */}
          <Panel
            transform={`rotateY(180deg) translateZ(calc(var(--w) * ${DEPTH / 2}))`}
            light="var(--face)"
            className="inset-0 bg-[url(/brand/tausi-pack-front.webp)] bg-cover bg-center"
          />

          {/* Sides: foil purple, as at the photo's edges. */}
          <Side right />
          <Side />

          <Panel
            transform={`rotateX(90deg) translateZ(calc(var(--w) * ${HEIGHT / 2}))`}
            light="1"
            className="top-1/2 left-0 w-full -translate-y-1/2 bg-[linear-gradient(90deg,#3E0750,#6A1C85_50%,#3E0750)]"
            style={{ height: `calc(var(--w) * ${DEPTH})` }}
          />
          <Panel
            transform={`rotateX(-90deg) translateZ(calc(var(--w) * ${HEIGHT / 2}))`}
            light="0.7"
            className="top-1/2 left-0 w-full -translate-y-1/2 bg-[#2A0B36]"
            style={{ height: `calc(var(--w) * ${DEPTH})` }}
          />
        </div>
      </div>
      <div
        ref={shadowRef}
        aria-hidden
        className="-mt-10 h-7 w-[calc(var(--w)*1.05)] rounded-[50%] bg-[radial-gradient(closest-side,rgba(42,11,54,0.22),transparent)]"
      />
    </div>
  )
}

function Side({ right }: { right?: boolean }) {
  return (
    <Panel
      transform={`rotateY(${right ? 90 : -90}deg) translateZ(calc(var(--w) * 0.5))`}
      light="var(--side)"
      className="top-0 left-1/2 h-full -translate-x-1/2 flex items-center justify-center bg-[linear-gradient(90deg,#3A0548,#6E2390_45%,#5A076F_60%,#3A0548)]"
      style={{ width: `calc(var(--w) * ${DEPTH})` }}
    >
      <span className="rotate-90 pl-[0.4em] font-(family-name:--font-cinzel) text-[calc(var(--w)*0.045)] whitespace-nowrap tracking-[0.4em] text-[#E4D6EA]">
        TAUSI
      </span>
    </Panel>
  )
}

// One face of the box. `light` (0–1) is how squarely it faces the viewer, so
// faces turned away darken.
function Panel({
  transform,
  light,
  className,
  style,
  children,
}: {
  transform: string
  light: string
  className: string
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  return (
    <div
      className={`absolute overflow-hidden rounded-[3px] [backface-visibility:hidden] ${className}`}
      style={{
        ...style,
        transform,
        filter: `brightness(calc(0.62 + ${light} * 0.38))`,
      }}
    >
      {children}
    </div>
  )
}
