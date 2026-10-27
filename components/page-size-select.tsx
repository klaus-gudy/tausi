"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

/**
 * The "Rows per page" picker under a paged table. Each choice links to the
 * list's first page at that size; the links are built by TablePagination.
 */
export function PageSizeSelect({
  value,
  options,
}: {
  value: number
  options: { size: number; href: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <label className="flex items-center gap-2 whitespace-nowrap">
      Rows per page
      <NativeSelect
        size="sm"
        value={value}
        disabled={pending}
        onChange={(event) => {
          const href = options.find((option) => option.size === Number(event.target.value))?.href
          if (href) startTransition(() => router.push(href, { scroll: false }))
        }}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.size} value={option.size}>
            {option.size}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  )
}
