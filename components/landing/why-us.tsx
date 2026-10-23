"use client"

import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { AbsorbScene, AnionScene, BagScene, FeatherScene } from "./why-us-scenes"

// Why us, told as you scroll, on a deep aubergine band. On wide screens a
// glowing stage stays in place on the left while the reasons pass on the
// right, and the reason in the middle of the screen plays its scene there.
// Each reason's large numeral fills with colour from the bottom up as it
// arrives, the way the pad draws fluid in. Each reason takes one of the
// peacock's feather colours.

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

const numeral = "font-(family-name:--font-bodoni) leading-none"

export function WhyUs() {
  const [active, setActive] = useState(0)
  const reason = REASONS[active]

  return (
    <MotionConfig reducedMotion="user">
      <section id="why" className="scroll-mt-0 bg-(--ink) text-white">
        <div className="mx-auto w-full max-w-6xl px-6 pt-32 md:pt-40">
          <h2 className="font-(family-name:--font-bodoni) text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] font-normal">
            Why us.
          </h2>
          <p className="mt-6 max-w-[38ch] text-lg leading-relaxed text-(--lilac)">
            Four things every Tausi pad is made to do for you.
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-6xl gap-20 px-6 pt-20 pb-32 md:grid-cols-2 md:gap-12 md:pt-0 md:pb-16">
          {/* The stage, wide screens only. */}
          <div aria-hidden className="sticky top-0 hidden h-svh items-center justify-center md:flex">
            <div className="relative flex size-[min(30rem,40vw)] items-center justify-center rounded-full">
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  background: `radial-gradient(closest-side, ${reason.accent}40, ${reason.accent}10 60%, transparent)`,
                }}
                transition={{ duration: 0.8 }}
              />
              <motion.div
                className="absolute inset-[12%] rounded-full border"
                animate={{ borderColor: `${reason.accent}55` }}
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
                  animate={{ backgroundColor: reason.accent, boxShadow: `0 0 16px 4px ${reason.accent}88` }}
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
                  <div className="relative size-[56%]" style={{ color: reason.accent }}>
                    <reason.Scene />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="absolute bottom-16 left-0 flex gap-2">
              {REASONS.map((item, index) => (
                <span key={item.name} className="relative h-0.5 w-10 overflow-hidden rounded-full bg-white/15">
                  {index === active && (
                    <motion.span
                      layoutId="why-us-marker"
                      className="absolute inset-0"
                      style={{ backgroundColor: item.accent }}
                    />
                  )}
                </span>
              ))}
            </div>
          </div>

          <ol className="flex flex-col gap-24 md:gap-0">
            {REASONS.map((item, index) => (
              <Reason
                key={item.name}
                index={index}
                active={index === active}
                onActive={setActive}
                {...item}
              />
            ))}
          </ol>
        </div>
      </section>
    </MotionConfig>
  )
}

// A large outlined numeral with a solid copy on top that fills upwards while
// `filled`, and drains again when it is not.
function FillingNumeral({ value, accent, filled }: { value: number; accent: string; filled: boolean }) {
  return (
    <span aria-hidden className="relative block w-fit text-[clamp(5rem,9vw,8rem)]">
      <span className={`${numeral} block text-transparent`} style={{ WebkitTextStroke: `1.5px ${accent}` }}>
        {value}
      </span>
      <motion.span
        className={`${numeral} absolute inset-0 block`}
        style={{ color: accent }}
        initial={{ clipPath: "inset(100% 0 0 0)" }}
        animate={{ clipPath: filled ? "inset(0% 0 0 0)" : "inset(100% 0 0 0)" }}
        transition={{ duration: filled ? 1.4 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {value}
      </motion.span>
    </span>
  )
}

function Reason({
  index,
  name,
  text,
  accent,
  Scene,
  active,
  onActive,
}: (typeof REASONS)[number] & {
  index: number
  active: boolean
  onActive: (index: number) => void
}) {
  const ref = useRef<HTMLLIElement>(null)
  // "In view" means crossing the middle band of the screen.
  const centred = useInView(ref, { margin: "-45% 0px -45% 0px" })
  // On phones each reason plays its own scene once it scrolls on screen.
  const seen = useInView(ref, { once: true, amount: 0.4 })

  useEffect(() => {
    if (centred) onActive(index)
  }, [centred, index, onActive])

  return (
    <li
      ref={ref}
      data-active={active}
      className="flex flex-col justify-center transition-opacity duration-500 md:min-h-[70svh] md:opacity-25 md:data-[active=true]:opacity-100"
    >
      <div aria-hidden className="relative mb-10 flex size-56 items-center justify-center rounded-full md:hidden" style={{ background: `radial-gradient(closest-side, ${accent}33, transparent)` }}>
        {seen && (
          <div className="relative size-[60%]" style={{ color: accent }}>
            <Scene />
          </div>
        )}
      </div>
      {/* Phones fill each numeral as it scrolls on; wide screens fill the one in the middle. */}
      <span className="md:hidden">
        <FillingNumeral value={index + 1} accent={accent} filled={seen} />
      </span>
      <span className="hidden md:block">
        <FillingNumeral value={index + 1} accent={accent} filled={active} />
      </span>
      <h3 className="mt-4 font-(family-name:--font-bodoni) text-[clamp(1.75rem,3.2vw,2.75rem)] leading-[1.1] font-normal">
        <span className="sr-only">{index + 1}. </span>
        {name}
      </h3>
      <p className="mt-4 max-w-[40ch] text-lg leading-relaxed text-(--lilac)">{text}</p>
    </li>
  )
}
