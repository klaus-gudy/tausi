import type { Metadata } from "next";
import Link from "next/link";
import { Emblem } from "@/components/landing/emblem";
import { PackSpinner } from "@/components/landing/pack-spinner";

export const metadata: Metadata = {
  title: "Tausi Premium pads",
  description:
    "Soft, winged Tausi Premium pads in 340 mm and 390 mm, with sanitary bags in every pack.",
};

// Placeholder: replace with the sales team's real address before launch.
const SALES_EMAIL = "sales@example.com";

const REASONS = [
  {
    name: "Discreet disposal (vifuko)",
    text: "Every pack comes with sanitary bags, so you can wrap a used pad and throw it away without anyone seeing.",
  },
  {
    name: "Anion chip protection",
    text: "An anion chip in each pad helps keep odour away, so you stay fresh all day.",
  },
  {
    name: "High absorbency and dryness",
    text: "The core draws fluid in fast and locks it away, so the surface stays dry against your skin.",
  },
  {
    name: "Gentle on skin",
    text: "A soft, breathable top sheet that is kind to skin, even on long days.",
  },
];

const PACK = [
  { value: "340 mm", text: "Long enough for heavy days." },
  { value: "390 mm", text: "Extra length for the heaviest days and overnight." },
  { value: "9 pads", text: "Nine pads in the 340 mm pack." },
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
          <a href="#why" className="hidden hover:text-(--ink) sm:inline">Why us</a>
          <a href="#pack" className="hidden hover:text-(--ink) sm:inline">The pack</a>
          <a href="#super-dealers" className="hidden hover:text-(--ink) sm:inline">Super dealers</a>
          <Link href="/login" className="hover:text-(--ink)">Staff sign in</Link>
        </nav>
      </header>

      <main>
        {/* Hero: the pack itself, turning slowly. */}
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
                href="#super-dealers"
                className="inline-flex h-12 items-center rounded-full border border-(--plum) px-7 text-[15px] text-(--plum) transition-colors hover:bg-(--mist) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--plum)"
              >
                Become a super dealer
              </a>
            </div>
          </div>
          <div className="relative flex flex-col items-center">
            <div aria-hidden className="absolute top-1/2 left-1/2 -z-0 size-[min(88vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--mist)" />
            <div className="relative">
              <PackSpinner />
            </div>
          </div>
        </section>

        {/* Why us: four reasons, numbered as the brief lists them. */}
        <section id="why" className="mx-auto grid w-full max-w-6xl scroll-mt-8 gap-16 px-6 py-32 md:grid-cols-[5fr_7fr] md:py-44">
          <div>
            <h2 className="font-(family-name:--font-bodoni) text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-normal">
              Why us.
            </h2>
            <p className="mt-6 max-w-[34ch] text-lg leading-relaxed text-(--muted)">
              Four things every Tausi pad is made to do for you.
            </p>
          </div>
          <ol className="flex flex-col gap-14">
            {REASONS.map((reason, index) => (
              <li key={reason.name} className="grid grid-cols-[3rem_1fr] items-baseline gap-6">
                <span aria-hidden className="font-(family-name:--font-bodoni) text-4xl text-(--orchid)">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-(family-name:--font-bodoni) text-2xl font-normal">{reason.name}</h3>
                  <p className="mt-2 max-w-[44ch] leading-relaxed text-(--muted)">{reason.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* The Premium pack: both lengths and the pack size. */}
        <section id="pack" className="scroll-mt-8 bg-(--mist) py-32 md:py-44">
          <div className="mx-auto w-full max-w-6xl px-6">
            <h2 className="max-w-[18ch] font-(family-name:--font-bodoni) text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-normal">
              The Premium pack.
            </h2>
            <dl className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
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

        <section id="super-dealers" className="scroll-mt-8 bg-(--plum) text-white">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-28 md:grid-cols-[7fr_5fr] md:items-end md:py-36">
            <div>
              <h2 className="font-(family-name:--font-bodoni) text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-normal">
                Become a super dealer.
              </h2>
              <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-(--lilac)">
                Super dealers supply Tausi to shops, pharmacies and supermarkets
                in their zone. Tell us where you are, and our sales team will
                get in touch.
              </p>
            </div>
            <div className="md:justify-self-end">
              <a
                href={`mailto:${SALES_EMAIL}?subject=Becoming%20a%20Tausi%20super%20dealer`}
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
