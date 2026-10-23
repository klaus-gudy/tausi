// The Tausi peacock, painted in whatever background colour the class sets.

export function Emblem({ className }: { className?: string }) {
  return (
    <i
      aria-hidden
      className={`block aspect-[988/967] [mask:url(/brand/tausi-emblem.svg)_center/contain_no-repeat] ${className ?? ""}`}
    />
  )
}
