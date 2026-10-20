"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createRole, type SaveRoleResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";

const initialState: SaveRoleResult = { message: "" };

/** Names a new role, then opens it to pick its permissions. */
export function NewRoleForm() {
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction(
    async (previous: SaveRoleResult, formData: FormData) => {
      const result = await createRole(previous, formData);
      if (result.success && result.id) {
        toast.success(result.message);
        router.push(`/roles/${result.id}`);
      }
      return result;
    },
    initialState
  );

  return (
    <form onSubmit={onSubmit} className="max-w-xl">
      <Card>
        <CardContent className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="role-name">Name</FieldLabel>
            <Input
              id="role-name"
              name="name"
              placeholder="Storekeeper"
              autoComplete="off"
              maxLength={60}
              required
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="role-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id="role-description"
              name="description"
              placeholder="Receives and counts stock"
              autoComplete="off"
              maxLength={200}
            />
            <FieldDescription>You&apos;ll pick what the role can do on the next page.</FieldDescription>
          </Field>
          {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create role"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
