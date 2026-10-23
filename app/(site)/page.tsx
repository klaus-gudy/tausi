import type { Metadata } from "next";
import Link from "next/link";
import { Emblem } from "@/components/landing/emblem";
import { PadSpinner } from "@/components/landing/pad-spinner";
import { PAD_WIDTH, padCore, padOutline } from "@/components/landing/pad-shape";

export const metadata: Metadata = {
  title: "Tausi Premium pads",
  description:
    "Soft, winged Tausi Premium pads: 340 mm long for heavy days and nights, 9 in a pack, with a disposal bag inside.",
};

// Placeholder: replace with the sales team's real address before launch.
const SALES_EMAIL = "sales@example.com";

const LAYERS = [
  {
    name: "Top sheet",
    text: "A soft, breathable surface that lets fluid through and stays dry against your skin.",
    bar: "h-2 border border-(--lilac) bg-white",
  },
  {
    name: "Absorbent core",
    text: "The purple strip down the middle draws fluid in fast and holds it, so it doesn't come back up.",
    bar: "h-6 bg-[linear-gradient(90deg,#EFE7F2_0%,#EFE7F2_38%,#8A2FB0_38%,#8A2FB0_62%,#EFE7F2_62%)]",
  },
  {
    name: "Leak guard",
    text: "A barrier underneath that keeps your underwear and clothes clean.",
    bar: "h-1.5 bg-(--lilac)",
  },
  {
    name: "Wings and adhesive",
    text: "Grip your underwear and fold over the sides, so the pad stays where you put it.",
    bar: "h-2 bg-[repeating-linear-gradient(90deg,#F7F3F9_0_14px,#E4D9E8_14px_18px)] border border-(--lilac)",
  },
];

const PACK = [
  { value: "340 mm", text: "Long enough for heavy days and through the night." },
  { value: "9 pads", text: "Nine pads in every pack." },
  { value: "Bag inside", text: "A sanitary bag in every pack, for discreet disposal." },
];

export default function LandingPage() {
  return (
    <>
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--plum)">
          <Emblem className="w-8 bg-(--royal)" />
          <span className="pl-[0.35em] font-(family-name:--font-cinzel) text-lg tracking-[0.35em]">TAUSI</span>
        </Link>
        <nav className="flex items-center gap-8 text-[15px] text-(--muted)">
          <a href="#inside" className="hidden hover:text-(--ink) sm:inline">What&apos;s inside</a>
          <a href="#pack" className="hidden hover:text-(--ink) sm:inline">The pack</a>
          <a href="#stockists" className="hidden hover:text-(--ink) sm:inline">Stockists</a>
          <Link href="/login" className="hover:text-(--ink)">Staff sign in</Link>
        </nav>
      </header>

      <main>
        {/* Hero: the pad itself, turning slowly. */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-16 px-6 pt-12 pb-24 md:min-h-[calc(100svh-5rem)] md:grid-cols-2 md:gap-8 md:pt-8">
          <div className="max-w-xl">
            <h1 className="font-(family-name:--font-bodoni) text-[clamp(2.75rem,6vw,4.75rem)] leading-[1.04] font-normal tracking-[-0.015em]">
              Soft enough to forget you&apos;re wearing it.
            </h1>
            <p className="mt-8 max-w-[36ch] text-lg leading-relaxed text-(--muted)">
              Tausi Premium pads are long, soft and winged, made to stay in
              place from the first hour of the day to the last hour of the
              night.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
              <a
                href="#pack"
                className="inline-flex h-12 items-center rounded-full bg-(--plum) px-7 text-[15px] text-white transition-colors hover:bg-(--royal) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--plum)"
              >
                See the pack
              </a>
              <a
                href="#stockists"
                className="text-[15px] underline decoration-(--lilac) underline-offset-[6px] hover:decoration-(--plum)"
              >
                Stock Tausi in your shop
              </a>
            </div>
          </div>
          <div className="relative flex flex-col items-center">
            <div aria-hidden className="absolute top-1/2 left-1/2 -z-0 size-[min(88vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--mist)" />
            <div className="relative">
              <PadSpinner />
            </div>
            <p className="relative mt-6 text-sm text-(--muted)">Drag to turn it</p>
          </div>
        </section>

        {/* The layers, top to bottom, drawn apart. */}
        <section id="inside" className="mx-auto grid w-full max-w-6xl scroll-mt-8 gap-16 px-6 py-32 md:grid-cols-[5fr_7fr] md:py-44">
          <div>
            <h2 className="font-(family-name:--font-bodoni) text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-normal">
              Four layers, each with one job.
            </h2>
            <p className="mt-6 max-w-[34ch] text-lg leading-relaxed text-(--muted)">
              From the side that touches your skin to the side that holds on
              to your underwear.
            </p>
          </div>
          <ol className="flex flex-col gap-14">
            {LAYERS.map((layer) => (
              <li key={layer.name} className="grid grid-cols-[minmax(5rem,9rem)_1fr] items-center gap-8">
                <span aria-hidden className={`block w-full rounded-full ${layer.bar}`} />
                <div>
                  <h3 className="font-(family-name:--font-bodoni) text-2xl font-normal">{layer.name}</h3>
                  <p className="mt-2 max-w-[44ch] leading-relaxed text-(--muted)">{layer.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* The Premium pack: one size, drawn to scale against its length. */}
        <section id="pack" className="scroll-mt-8 bg-(--mist) py-32 md:py-44">
          <div className="mx-auto w-full max-w-6xl px-6">
            <h2 className="max-w-[18ch] font-(family-name:--font-bodoni) text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-normal">
              The Premium pack.
            </h2>
            <MeasuredPad />
            <dl className="mt-20 grid gap-12 md:grid-cols-3 md:gap-10">
              {PACK.map((item) => (
                <div key={item.value} className="border-t border-(--lilac) pt-6">
                  <dt className="font-(family-name:--font-bodoni) text-3xl">{item.value}</dt>
                  <dd className="mt-3 max-w-[30ch] leading-relaxed text-(--muted)">{item.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* The brand line, given room. */}
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-36 text-center md:py-52">
          <Emblem className="w-28 bg-(--lilac)" />
          <p className="mt-10 font-(family-name:--font-bodoni) text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.1]">
            Beauty from within.
          </p>
          <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-(--muted)">
            Tausi is Swahili for peacock. Like its feathers, we take care over
            the parts no one else sees.
          </p>
        </section>

        <section id="stockists" className="scroll-mt-8 bg-(--plum) text-white">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-28 md:grid-cols-[7fr_5fr] md:items-end md:py-36">
            <div>
              <h2 className="font-(family-name:--font-bodoni) text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-normal">
                Stock Tausi in your shop.
              </h2>
              <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-(--lilac)">
                We supply shops, pharmacies and supermarkets through dealers in
                every zone. Tell us where you are, and a salesperson will visit
                with stock.
              </p>
            </div>
            <div className="md:justify-self-end">
              <a
                href={`mailto:${SALES_EMAIL}?subject=Stocking%20Tausi`}
                className="inline-flex h-12 items-center rounded-full bg-white px-7 text-[15px] text-(--plum) transition-colors hover:bg-(--mist) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Email the sales team
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-12 text-sm text-(--muted) sm:flex-row sm:items-center sm:justify-between">
        <span className="pl-[0.35em] font-(family-name:--font-cinzel) tracking-[0.35em] text-(--ink)">TAUSI</span>
        <span>© 2026 Tausi</span>
        <Link href="/login" className="hover:text-(--ink)">Staff sign in</Link>
      </footer>
    </>
  );
}

// The pad laid flat with a rule along its length. The rule is the one place
// the feather gold appears.
function MeasuredPad() {
  const length = 520;
  return (
    <figure className="mx-auto mt-20 w-full max-w-3xl">
      <svg viewBox={`0 0 ${length} ${PAD_WIDTH + 60}`} className="w-full" role="img" aria-label="The pad laid flat, measured at 340 millimetres long">
        <g stroke="var(--gold)" strokeWidth="1">
          <line x1="10" y1="14" x2={length - 10} y2="14" />
          <line x1="10" y1="6" x2="10" y2="22" />
          <line x1={length - 10} y1="6" x2={length - 10} y2="22" />
        </g>
        <rect x={length / 2 - 40} y="2" width="80" height="24" fill="var(--mist)" />
        <text x={length / 2} y="19" textAnchor="middle" fontSize="14" fill="var(--ink)" fontFamily="var(--font-jost)">
          340 mm
        </text>
        <g transform={`translate(0 ${PAD_WIDTH + 50}) rotate(-90)`}>
          <path d={padOutline()} fill="white" stroke="#DCCFE2" strokeWidth="1.5" />
          <path d={padCore()} fill="none" stroke="#D8C8DE" strokeWidth="1.4" strokeDasharray="1 4" strokeLinecap="round" />
          <rect x="84" y="196" width="32" height="128" rx="6" fill="#7A22A0" />
        </g>
      </svg>
    </figure>
  );
}
