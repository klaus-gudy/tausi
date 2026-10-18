"use client"

import { usePathname, useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { Loader2, Search } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

/**
 * Search box that keeps its text in the URL (?q=) so results are bookmarkable.
 * Typing waits briefly before searching and always returns to the top; other
 * query params, such as the sort, are kept.
 */
export function TableSearch({
  defaultValue,
  placeholder,
  label,
}: {
  defaultValue: string
  placeholder: string
  label: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(defaultValue)
  const [searching, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function search(text: string) {
    const query = text.trim()
    // Keep other settings, such as the sort; a new search starts from the top.
    const params = new URLSearchParams(window.location.search)
    params.delete("page")
    params.delete("show")
    if (query) params.set("q", query)
    else params.delete("q")
    const suffix = params.size ? `?${params}` : ""
    startTransition(() => router.replace(`${pathname}${suffix}`))
  }

  return (
    <InputGroup className="sm:max-w-xs">
      <InputGroupAddon>
        {searching ? <Loader2 className="animate-spin" /> : <Search />}
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          const text = event.target.value
          setValue(text)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => search(text), 300)
        }}
      />
    </InputGroup>
  )
}
