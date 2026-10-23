"use client"

import { Droplets, Feather, ShoppingBag, Sparkles } from "lucide-react"
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react"
import { useEffect, useRef, useState } from "react"

// Why us, told as you scroll: on wide screens the reasons scroll past on the
// right while the left column holds a large outlined numeral for the one in
// the middle of the screen. The numeral fills with plum from the bottom up, the
// way the pad draws fluid in.

const REASONS = [
  {
    name: "Discreet disposal (vifuko)",
    text: "Every pack comes with sanitary bags, so you can wrap a used pad and throw it away without anyone seeing.",
    Icon: ShoppingBag,
  },
  {
    name: "Anion chip protection",
    text: "An anion chip in each pad helps keep odour away, so you stay fresh all day.",
    Icon: Sparkles,
  },
  {
    name: "High absorbency and dryness",
    text: "The core draws fluid in fast and locks it away, so the surface stays dry against your skin.",
    Icon: Droplets,
  },
  {
    name: "Gentle on skin",
    text: "A soft, breathable top sheet that is kind to skin, even on long days.",
    Icon: Feather,
  },
]

const numeral = "font-(family-name:--font-bodoni) leading-none"
const outlined = `${numeral} text-transparent [-webkit-text-stroke:1.5px_var(--orchid)]`

export function WhyUs() {
  const [active, setActive] = useState(0)

  return (
    <MotionConfig reducedMotion="user">
      <section id="why" className="mx-auto grid w-full max-w-6xl scroll-mt-8 gap-16 px-6 py-32 md:grid-cols-[5fr_7fr] md:py-24">
        <div className="md:sticky md:top-0 md:flex md:h-svh md:flex-col md:justify-center">
          <h2 className="font-(family-name:--font-bodoni) text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-normal">
            Why us.
          </h2>
          <p className="mt-6 max-w-[34ch] text-lg leading-relaxed text-(--muted)">
            Four things every Tausi pad is made to do for you.
          </p>
          <div aria-hidden className="relative mt-12 hidden h-[13rem] overflow-hidden md:block">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={active}
                className="absolute inset-0"
                initial={{ y: "70%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-70%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 140, damping: 22 }}
              >
                <span className={`${outlined} block text-[13rem]`}>{active + 1}</span>
                <motion.span
                  className={`${numeral} absolute inset-0 block text-[13rem] text-(--plum)`}
                  initial={{ clipPath: "inset(100% 0 0 0)" }}
                  animate={{ clipPath: "inset(0% 0 0 0)" }}
                  transition={{ delay: 0.15, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  {active + 1}
                </motion.span>
              </motion.div>
            </AnimatePresence>
          </div>
          <div aria-hidden className="mt-8 hidden gap-2 md:flex">
            {REASONS.map((reason, index) => (
              <span key={reason.name} className="relative h-0.5 w-10 overflow-hidden rounded-full bg-(--lilac)/50">
                {index === active && (
                  <motion.span layoutId="why-us-marker" className="absolute inset-0 bg-(--plum)" />
                )}
              </span>
            ))}
          </div>
        </div>

        <ol className="flex flex-col gap-14 md:gap-0">
          {REASONS.map((reason, index) => (
            <Reason
              key={reason.name}
              index={index}
              active={index === active}
              onActive={setActive}
              {...reason}
            />
          ))}
        </ol>
      </section>
    </MotionConfig>
  )
}

function Reason({
  index,
  name,
  text,
  Icon,
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

  useEffect(() => {
    if (centred) onActive(index)
  }, [centred, index, onActive])

  return (
    <li
      ref={ref}
      data-active={active}
      className="grid grid-cols-[auto_1fr] items-start gap-6 md:grid-cols-1 transition-opacity duration-500 md:min-h-[55svh] md:items-center md:opacity-30 md:data-[active=true]:opacity-100"
    >
      <span className={`${outlined} w-10 text-5xl md:hidden`}>{index + 1}</span>
      <div>
        <span className="flex size-12 items-center justify-center rounded-full border border-(--lilac) text-(--royal)">
          <Icon className="size-5" strokeWidth={1.5} aria-hidden />
        </span>
        <h3 className="mt-6 font-(family-name:--font-bodoni) text-[clamp(1.5rem,2.6vw,2rem)] font-normal">
          <span className="sr-only">{index + 1}. </span>
          {name}
        </h3>
        <p className="mt-3 max-w-[40ch] text-lg leading-relaxed text-(--muted)">{text}</p>
      </div>
    </li>
  )
}
