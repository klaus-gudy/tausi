"use client"

import { startTransition, useActionState } from "react"

/**
 * useActionState for a form that keeps what was typed when the action
 * returns an error. A plain `<form action>` is reset by React after every
 * submit, so a rejected form would come back empty. Pass `onSubmit` to the
 * form instead of `action`. The button pressed is sent too, so a form with
 * two submit buttons can tell them apart by their name and value.
 */
export function useFormAction<State>(
  action: (previous: Awaited<State>, formData: FormData) => Promise<State>,
  initialState: Awaited<State>
) {
  const [state, dispatch, pending] = useActionState(action, initialState)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { submitter } = event.nativeEvent as SubmitEvent
    const formData = new FormData(event.currentTarget, submitter)
    startTransition(() => dispatch(formData))
  }

  return [state, onSubmit, pending] as const
}
