// Outline of a winged pad, drawn upright in a 200-wide box. `length` stretches
// the body: the bottom cap moves down by the extra length and the wings stay
// centred, so every size keeps the same ends and wings.

export const PAD_WIDTH = 200
export const BASE_LENGTH = 520

export function padOutline(length = BASE_LENGTH) {
  const d = length - BASE_LENGTH
  const w = d / 2
  const y = (n: number, shift: number) => n + shift
  return [
    `M100 10`,
    `C135 10 160 30 160 80`,
    `C160 ${y(130, w * 0.5)} 152 ${y(170, w)} 150 ${y(200, w)}`,
    `C170 ${y(198, w)} 196 ${y(212, w)} 196 ${y(236, w)}`,
    `L196 ${y(284, w)}`,
    `C196 ${y(308, w)} 170 ${y(322, w)} 150 ${y(320, w)}`,
    `C152 ${y(350, w)} 160 ${y(390, w * 1.5)} 160 ${y(440, d)}`,
    `C160 ${y(490, d)} 135 ${y(510, d)} 100 ${y(510, d)}`,
    `C65 ${y(510, d)} 40 ${y(490, d)} 40 ${y(440, d)}`,
    `C40 ${y(390, w * 1.5)} 48 ${y(350, w)} 50 ${y(320, w)}`,
    `C30 ${y(322, w)} 4 ${y(308, w)} 4 ${y(284, w)}`,
    `L4 ${y(236, w)}`,
    `C4 ${y(212, w)} 30 ${y(198, w)} 50 ${y(200, w)}`,
    `C48 ${y(170, w)} 40 ${y(130, w * 0.5)} 40 80`,
    `C40 30 65 10 100 10 Z`,
  ].join(" ")
}

// The quilted channel around the absorbent core.
export function padCore(length = BASE_LENGTH) {
  const d = length - BASE_LENGTH
  const w = d / 2
  return [
    `M100 50`,
    `C128 50 138 68 138 100`,
    `C138 ${160 + w * 0.5} 126 ${210 + w * 0.5} 126 ${260 + w}`,
    `C126 ${310 + w * 1.5} 138 ${360 + d} 138 ${420 + d}`,
    `C138 ${452 + d} 128 ${470 + d} 100 ${470 + d}`,
    `C72 ${470 + d} 62 ${452 + d} 62 ${420 + d}`,
    `C62 ${360 + d} 74 ${310 + w * 1.5} 74 ${260 + w}`,
    `C74 ${210 + w * 0.5} 62 ${160 + w * 0.5} 62 100`,
    `C62 68 72 50 100 50 Z`,
  ].join(" ")
}
