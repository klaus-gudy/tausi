"use client";

import { ErrorState } from "@/components/error-state";
import "./globals.css";

// Replaces the root layout when it fails, so it brings its own document and
// styles. There's no theme provider here, so it always shows the light theme.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground antialiased">
        <title>Something went wrong</title>
        <ErrorState error={error} retry={retry} />
      </body>
    </html>
  );
}
