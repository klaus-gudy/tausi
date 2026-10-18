"use client";

import { ErrorState } from "@/components/error-state";

// Errors in signed-in pages: the sidebar stays, so people can go elsewhere.
export default function CoreError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} className="border" />;
}
