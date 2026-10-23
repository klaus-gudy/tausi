"use client"

import { motion } from "motion/react"

// One small looping scene per reason, drawn in the reason's accent colour
// (currentColor). Each is a 200 × 200 drawing that scales to its box.

const loop = { repeat: Infinity, ease: "easeInOut" } as const

// Vifuko: a sanitary bag draws itself, then floats.
export function BagScene() {
  return (
    <motion.svg
      viewBox="0 0 200 200"
      className="size-full"
      animate={{ y: [0, -6, 0] }}
      transition={{ ...loop, duration: 4, delay: 1.4 }}
    >
      <motion.path
        d="M52 82h96l-9 86a12 12 0 0 1-12 11H73a12 12 0 0 1-12-11Z"
        fill="currentColor"
        fillOpacity={0.12}
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />
      <motion.path
        d="M76 82V68a24 24 0 0 1 48 0v14"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 1, ease: "easeInOut" }}
      />
      <motion.path
        d="M84 128c6 8 26 8 32 0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.6 }}
      />
    </motion.svg>
  )
}

// Anion chip: freshness rings ripple out from a glowing chip.
export function AnionScene() {
  const sparks = [
    [42, 54],
    [156, 48],
    [168, 132],
    [36, 146],
    [100, 22],
    [104, 178],
  ]
  return (
    <svg viewBox="0 0 200 200" className="size-full">
      {[0, 1, 2].map((ring) => (
        <motion.circle
          key={ring}
          cx="100"
          cy="100"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          initial={{ r: 16, opacity: 0.9 }}
          animate={{ r: 92, opacity: 0 }}
          transition={{ repeat: Infinity, duration: 3, delay: ring, ease: "easeOut" }}
        />
      ))}
      <motion.rect
        x="84"
        y="84"
        width="32"
        height="32"
        rx="8"
        fill="currentColor"
        animate={{ scale: [1, 1.08, 1] }}
        style={{ transformOrigin: "100px 100px" }}
        transition={{ ...loop, duration: 1.5 }}
      />
      {sparks.map(([x, y], i) => (
        <motion.path
          key={i}
          d={`M${x} ${y - 6}l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6Z`}
          fill="currentColor"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.4 }}
        />
      ))}
    </svg>
  )
}

// Absorbency: drops fall onto a surface and soak in, leaving it dry.
export function AbsorbScene() {
  return (
    <svg viewBox="0 0 200 200" className="size-full">
      <defs>
        <clipPath id="absorb-well">
          <circle cx="100" cy="128" r="56" />
        </clipPath>
      </defs>
      <circle cx="100" cy="128" r="56" fill="currentColor" fillOpacity={0.1} stroke="currentColor" strokeWidth={2} />
      {/* The soak: rises as a drop lands, then sinks away. */}
      <motion.rect
        x="40"
        width="120"
        height="120"
        fill="currentColor"
        fillOpacity={0.5}
        clipPath="url(#absorb-well)"
        initial={{ y: 190 }}
        animate={{ y: [190, 150, 190] }}
        transition={{ repeat: Infinity, duration: 2.2, times: [0.35, 0.55, 1], ease: "easeInOut" }}
      />
      <motion.path
        d="M100 20c10 14 16 24 16 32a16 16 0 0 1-32 0c0-8 6-18 16-32Z"
        fill="currentColor"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: [-10, 70, 70], opacity: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 2.2, times: [0, 0.35, 0.45], ease: "easeIn" }}
      />
      <motion.ellipse
        cx="100"
        cy="128"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        initial={{ rx: 4, ry: 2, opacity: 0 }}
        animate={{ rx: [4, 4, 50], ry: [2, 2, 14], opacity: [0, 0.9, 0] }}
        transition={{ repeat: Infinity, duration: 2.2, times: [0, 0.35, 0.8], ease: "easeOut" }}
      />
    </svg>
  )
}

// Gentle on skin: a peacock feather drifts and sways.
export function FeatherScene() {
  return (
    <motion.svg
      viewBox="0 0 200 200"
      className="size-full"
      animate={{ rotate: [-10, 10, -10], y: [-6, 8, -6], x: [-4, 4, -4] }}
      transition={{ ...loop, duration: 5 }}
    >
      <path d="M104 26C150 58 142 128 98 170C64 124 62 62 104 26Z" fill="currentColor" fillOpacity={0.16} stroke="currentColor" strokeWidth={2} />
      <path d="M104 26C106 80 104 130 92 186" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      {[52, 72, 92, 112, 132].map((y, i) => (
        <path key={y} d={`M104 ${y}c${14 - i} ${6} ${22 - i * 2} ${14} ${26 - i * 3} ${24}M104 ${y}c-${12 - i} ${6} -${18 - i * 2} ${14} -${22 - i * 3} ${24}`} fill="none" stroke="currentColor" strokeOpacity={0.6} strokeWidth={1.2} />
      ))}
      {/* The eye of the feather. */}
      <ellipse cx="108" cy="66" rx="13" ry="16" fill="currentColor" fillOpacity={0.35} />
      <ellipse cx="108" cy="67" rx="6" ry="8" fill="currentColor" />
    </motion.svg>
  )
}
