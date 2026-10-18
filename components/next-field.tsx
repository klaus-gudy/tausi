"use client"

import { useSearchParams } from "next/navigation"

// Carries ?next= from the URL into a form, so the server action can send the
// user back where they came from (e.g. an invitation) after signing in.
// Render inside <Suspense>, since it reads the URL.
export function NextField() {
  const next = useSearchParams().get("next")
  return next ? <input type="hidden" name="next" value={next} /> : null
}
