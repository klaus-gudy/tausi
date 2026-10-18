"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

// next-themes injects an inline script that applies the saved theme before
// the first paint. React warns about <script> tags rendered on the client, so
// the script is only executable in the server HTML; in the browser it becomes
// inert text/plain (see the Next.js "Preventing Flash" guide).
const scriptProps = {
  type: typeof window === "undefined" ? "text/javascript" : "text/plain",
}

export function ThemeProvider(
  props: React.ComponentProps<typeof NextThemesProvider>
) {
  return <NextThemesProvider scriptProps={scriptProps} {...props} />
}
