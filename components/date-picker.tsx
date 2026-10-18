"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/** Calendar-day picker that submits "YYYY-MM-DD" under `name`. */
export function DatePicker({
  id,
  name,
  defaultValue,
  maxDate,
  invalid,
}: {
  id: string
  name: string
  /** "YYYY-MM-DD" */
  defaultValue: string
  /** Latest selectable day, "YYYY-MM-DD". */
  maxDate?: string
  invalid?: boolean
}) {
  const [day, setDay] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const selected = day ? parseISO(day) : undefined

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid}
            className="w-full justify-start font-normal"
          >
            <CalendarIcon data-icon="inline-start" />
            {selected ? format(selected, "d MMM yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={maxDate ? { after: parseISO(maxDate) } : undefined}
            onSelect={(date) => {
              if (!date) return
              setDay(format(date, "yyyy-MM-dd"))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={day} />
    </>
  )
}
