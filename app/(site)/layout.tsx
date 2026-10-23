import { Bodoni_Moda, Cinzel, Jost } from "next/font/google";

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

// Only for the TAUSI wordmark, as on the pack.
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400"],
});

// The public site keeps the pack's light palette in either app theme, so its
// colours live here rather than in the app's theme tokens.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div
      className={`${bodoni.variable} ${jost.variable} ${cinzel.variable} flex flex-1 flex-col bg-white font-(family-name:--font-jost) text-(--ink) [--gold:#B0944D] [--ink:#2A0B36] [--lilac:#CDB8D2] [--mist:#F7F3F9] [--muted:#6E5A78] [--orchid:#9751B2] [--plum:#45065A] [--royal:#721398] [letter-spacing:0]`}
    >
      {children}
    </div>
  );
}
