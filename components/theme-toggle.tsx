"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { flushSync } from "react-dom"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next = resolvedTheme === "dark" ? "light" : "dark"
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    // Reveal the new theme as a circle growing out of the button, using
    // snapshots of the page instead of animating every element's colours.
    // Browsers without the API (or users who prefer reduced motion) just get
    // the instant swap.
    if (reduceMotion || !document.startViewTransition) {
      setTheme(next)
      return
    }

    // Centre on the button rather than the pointer so keyboard activation
    // reveals from the same place.
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const transition = document.startViewTransition(() => {
      // The new theme must be on <html> before the callback returns so the
      // "new" snapshot is taken with it applied.
      flushSync(() => setTheme(next))
    })

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 500,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      )
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Toggle dark mode"
      onClick={toggle}
    >
      {/* Icons swap with CSS so the server render never mismatches. */}
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  )
}
