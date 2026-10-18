"use client";

import { ErrorState } from "@/components/error-state";

// Errors outside the signed-in area, such as the login and invitation pages.
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <ErrorState error={error} retry={retry} />
    </main>
  );
}
