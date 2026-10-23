"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createRole, type SaveRoleResult } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";

const initialState: SaveRoleResult = { message: "" };

/** The "New role" button: names a role, then opens it to pick its permissions. */
export function NewRoleDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          New role
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">{open ? <NewRoleForm /> : null}</DialogContent>
    </Dialog>
  );
}

function NewRoleForm() {
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
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>New role</DialogTitle>
        <DialogDescription>You&apos;ll pick what it can do next.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <Field>
          <FieldLabel htmlFor="role-name">Name</FieldLabel>
          <Input
            id="role-name"
            name="name"
            placeholder="Accountant"
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
            placeholder="Checks stock values and receipts"
            autoComplete="off"
            maxLength={200}
          />
        </Field>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create role"}
        </Button>
      </DialogFooter>
    </form>
  );
}
