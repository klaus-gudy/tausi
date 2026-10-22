"use client"

import { useEffect, useRef, useState } from "react"
import { Eraser } from "lucide-react"

import { Button } from "@/components/ui/button"

// Ink on white whatever the theme, so the saved PNG reads like paper.
const INK = "#111827"
const PAPER = "#ffffff"

/**
 * A box to sign in with a finger, stylus or mouse. Submits the drawing as a
 * PNG data URL in a hidden field called `name`, empty until something is drawn.
 */
export function SignaturePad({
  name,
  label,
  onSignedChange,
}: {
  name: string
  /** Read out to screen readers, e.g. "Dealer's signature". */
  label: string
  onSignedChange?: (signed: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [value, setValue] = useState("")

  // Size the drawing surface to the box at the screen's pixel density (at most
  // 2x, which keeps the PNG small), and start on white.
  useEffect(() => {
    const canvas = canvasRef.current!
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const context = canvas.getContext("2d")!
    context.scale(ratio, ratio)
    context.fillStyle = PAPER
    context.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }

  function stroke(from: { x: number; y: number }, to: { x: number; y: number }) {
    const context = canvasRef.current!.getContext("2d")!
    context.strokeStyle = INK
    context.lineWidth = 2.2
    context.lineCap = "round"
    context.lineJoin = "round"
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
  }

  function save() {
    const next = canvasRef.current!.toDataURL("image/png")
    setValue(next)
    onSignedChange?.(true)
  }

  function clear() {
    const canvas = canvasRef.current!
    const context = canvas.getContext("2d")!
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.fillStyle = PAPER
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.restore()
    setValue("")
    onSignedChange?.(false)
  }

  return (
    <div className="grid gap-2">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={value ? `${label}, signed` : `${label}, not signed yet`}
        // touch-none stops the page scrolling while signing on a phone.
        className="h-44 w-full cursor-crosshair touch-none rounded-lg border border-input bg-white"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drawing.current = true
          last.current = point(event)
          // A tap leaves a dot.
          stroke(last.current, { x: last.current.x + 0.1, y: last.current.y + 0.1 })
        }}
        onPointerMove={(event) => {
          if (!drawing.current || !last.current) return
          const next = point(event)
          stroke(last.current, next)
          last.current = next
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          drawing.current = false
          last.current = null
          save()
        }}
        onPointerCancel={() => {
          drawing.current = false
          last.current = null
        }}
      />
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{value ? "Signed." : "Sign inside the box."}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!value}>
          <Eraser data-icon="inline-start" />
          Clear
        </Button>
      </div>
    </div>
  )
}
