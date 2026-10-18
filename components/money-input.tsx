"use client"

import { useLayoutEffect, useRef, useState } from "react"

import { InputGroupInput } from "@/components/ui/input-group"

const MAX_DIGITS = 12

const withCommas = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

const onlyDigits = (value: string) =>
  value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS)

/** Index in `formatted` just after its `count`-th digit. */
function caretAfterDigits(formatted: string, count: number) {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === count) return i + 1
  }
  return formatted.length
}

type MoneyInputProps = Omit<
  React.ComponentProps<"input">,
  "name" | "value" | "defaultValue" | "onChange" | "type"
> & {
  /** Submits plain digits under this name; omit when the parent submits. */
  name?: string
  defaultValue?: string
  /** Digits only, e.g. "45000". Makes the input controlled. */
  value?: string
  onValueChange?: (digits: string) => void
}

/**
 * Whole-number amount input that shows thousands separators while typing
 * ("45,000") but submits plain digits ("45000") under `name`.
 */
export function MoneyInput({
  name,
  defaultValue,
  value,
  onValueChange,
  ...props
}: MoneyInputProps) {
  const [ownDigits, setOwnDigits] = useState(() =>
    onlyDigits(defaultValue ?? "")
  )
  const digits = value === undefined ? ownDigits : onlyDigits(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)
  const formatted = withCommas(digits)

  // Keep the caret next to the same digit after commas are added or removed.
  useLayoutEffect(() => {
    if (caretRef.current === null || !inputRef.current) return
    const position = caretAfterDigits(formatted, caretRef.current)
    inputRef.current.setSelectionRange(position, position)
    caretRef.current = null
  }, [formatted])

  return (
    <>
      <InputGroupInput
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatted}
        onChange={(event) => {
          const { value: text, selectionStart } = event.target
          const caret = selectionStart ?? text.length
          caretRef.current = onlyDigits(text.slice(0, caret)).length
          const next = onlyDigits(text)
          setOwnDigits(next)
          onValueChange?.(next)
        }}
      />
      {name && <input type="hidden" name={name} value={digits} />}
    </>
  )
}
