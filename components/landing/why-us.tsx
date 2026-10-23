"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

import { AbsorbScene, AnionScene, BagScene, FeatherScene } from "./why-us-scenes"

// Why us as a carousel on a deep aubergine band, one reason at a time so the
// section stays short. A glowing stage plays the reason's scene
// while its numeral, title and text slide in; the numeral fills with colour
// from the bottom up, the way the pad draws fluid in. Each reason takes one of
// the peacock's feather colours. It moves on by itself, pauses while the
// pointer or keyboard focus is on it, and can be swiped or stepped through.

const REASONS = [
  {
    name: "Discreet disposal (vifuko)",
    text: "Every pack comes with sanitary bags, so you can wrap a used pad and throw it away without anyone seeing.",
    accent: "#D4B062",
    Scene: BagScene,
  },
  {
    name: "Anion chip protection",
    text: "An anion chip in each pad helps keep odour away, so you stay fresh all day.",
    accent: "#7CC47A",
    Scene: AnionScene,
  },
  {
    name: "High absorbency and dryness",
    text: "The core draws fluid in fast and locks it away, so the surface stays dry against your skin.",
    accent: "#4FB3E8",
    Scene: AbsorbScene,
  },
  {
    name: "Gentle on skin",
    text: "A soft, breathable top sheet that is kind to skin, even on long days.",
    accent: "#C99AE0",
    Scene: FeatherScene,
  },
]

const SLIDE_MS = 6000
const numeral = "font-(family-name:--font-bodoni) leading-none"

export function WhyUs() {
  // `direction` decides which way the slides travel: 1 forward, -1 back.
  const [[active, direction], setSlide] = useState([0, 1])
  const [paused, setPaused] = useState(false)
  const reduce = useReducedMotion()
  const reason = REASONS[active]
  const autoplay = !paused && !reduce

  function go(step: number) {
    setSlide(([current]) => [(current + step + REASONS.length) % REASONS.length, step])
  }

  function show(index: number) {
    setSlide(([current]) => [index, index >= current ? 1 : -1])
  }

  useEffect(() => {
    if (!autoplay) return
    const timer = setTimeout(() => go(1), SLIDE_MS)
    return () => clearTimeout(timer)
  }, [active, autoplay])

  return (
    <MotionConfig reducedMotion="user">
      <section
        id="why"
        aria-roledescription="carousel"
        aria-label="Why us"
        className="scroll-mt-0 overflow-hidden bg-(--ink) text-white"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
          <div className="text-center">
            <h2 className="font-(family-name:--font-bodoni) text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] font-normal">
              Why us.
            </h2>
            <p className="mx-auto mt-4 max-w-[38ch] text-lg leading-relaxed text-(--lilac)">
              Four things every Tausi pad is made to do for you.
            </p>
          </div>

          <div className="mt-12 grid items-center gap-10 md:mt-14 md:grid-cols-2 md:gap-16">
            <Stage active={active} accent={reason.accent} Scene={reason.Scene} />

            <motion.div
              className="relative min-h-[18rem] touch-pan-y sm:min-h-[15rem]"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) go(1)
                else if (info.offset.x > 60) go(-1)
              }}
              aria-live={autoplay ? "off" : "polite"}
            >
              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.div
                  key={active}
                  custom={direction}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${active + 1} of ${REASONS.length}`}
                  variants={{
                    enter: (dir: number) => ({ x: dir * 80, opacity: 0 }),
                    centre: { x: 0, opacity: 1 },
                    leave: (dir: number) => ({ x: dir * -80, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="centre"
                  exit="leave"
                  transition={{ type: "spring", stiffness: 160, damping: 24 }}
                >
                  <FillingNumeral key={active} value={active + 1} accent={reason.accent} />
                  <h3 className="mt-4 font-(family-name:--font-bodoni) text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.1] font-normal">
                    {reason.name}
                  </h3>
                  <p className="mt-4 max-w-[40ch] text-lg leading-relaxed text-(--lilac)">{reason.text}</p>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Faint arrows either side of the four progress bars. */}
          <div className="mt-10 flex items-center justify-center gap-5">
            <StepButton label="Previous reason" onClick={() => go(-1)}>
              <ArrowLeft className="size-4" aria-hidden />
            </StepButton>
            <div className="flex gap-2">
              {REASONS.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => show(index)}
                  aria-label={`Show reason ${index + 1}: ${item.name}`}
                  aria-current={index === active}
                  className="group flex h-6 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span className="relative block h-0.5 w-10 overflow-hidden rounded-full bg-white/15 group-hover:bg-white/30">
                    {/* The active bar fills over the time before the next slide. */}
                    {index === active && (
                      <motion.span
                        key={`${active}-${autoplay}`}
                        className="absolute inset-0 origin-left"
                        style={{ backgroundColor: item.accent }}
                        initial={{ scaleX: autoplay ? 0 : 1 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: autoplay ? SLIDE_MS / 1000 : 0, ease: "linear" }}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <StepButton label="Next reason" onClick={() => go(1)}>
              <ArrowRight className="size-4" aria-hidden />
            </StepButton>
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}

// The glowing circle that plays the current reason's scene.
function Stage({
  active,
  accent,
  Scene,
}: {
  active: number
  accent: string
  Scene: (typeof REASONS)[number]["Scene"]
}) {
  return (
    <div aria-hidden className="flex justify-center">
      <div className="relative flex size-[min(64vw,20rem)] items-center justify-center rounded-full md:size-[min(24rem,36vw)]">
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ background: `radial-gradient(closest-side, ${accent}40, ${accent}10 60%, transparent)` }}
          transition={{ duration: 0.8 }}
        />
        <motion.div
          className="absolute inset-[12%] rounded-full border"
          animate={{ borderColor: `${accent}55` }}
          transition={{ duration: 0.8 }}
        />
        {/* A slow orbit with one bead of colour travelling round it. */}
        <motion.div
          className="absolute inset-[4%] rounded-full border border-dashed border-white/10"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
        >
          <motion.span
            className="absolute top-0 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            animate={{ backgroundColor: accent, boxShadow: `0 0 16px 4px ${accent}88` }}
            transition={{ duration: 0.8 }}
          />
        </motion.div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={active}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          >
            <div className="relative size-[56%]" style={{ color: accent }}>
              <Scene />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// A large outlined numeral with a solid copy on top that fills upwards.
function FillingNumeral({ value, accent }: { value: number; accent: string }) {
  return (
    <span aria-hidden className="relative block w-fit text-[clamp(4.5rem,8vw,7rem)]">
      <span className={`${numeral} block text-transparent`} style={{ WebkitTextStroke: `1.5px ${accent}` }}>
        {value}
      </span>
      <motion.span
        className={`${numeral} absolute inset-0 block`}
        style={{ color: accent }}
        initial={{ clipPath: "inset(100% 0 0 0)" }}
        animate={{ clipPath: "inset(0% 0 0 0)" }}
        transition={{ delay: 0.25, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {value}
      </motion.span>
    </span>
  )
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full border border-white/10 text-white/40 transition-colors hover:border-white/30 hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {children}
    </button>
  )
}
