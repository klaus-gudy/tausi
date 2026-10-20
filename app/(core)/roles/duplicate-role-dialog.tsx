"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";

const initialState: SaveRoleResult = { message: "" };

/** Asks only for a name; the copy takes the role's permissions on the server. */
export function DuplicateRoleDialog({ role }: { role: { id: string; name: string } }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Copy data-icon="inline-start" />
          Duplicate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {open ? <DuplicateForm role={role} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DuplicateForm({ role }: { role: { id: string; name: string } }) {
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
    <form
      onSubmit={(event) => {
        // The dialog is portalled out of the role's own form, but React events
        // still bubble to it; this submit is the copy's alone.
        event.stopPropagation();
        onSubmit(event);
      }}
    >
      <DialogHeader>
        <DialogTitle>Duplicate {role.name}</DialogTitle>
        <DialogDescription>
          The new role starts with the same description and permissions. You can change them after.
        </DialogDescription>
      </DialogHeader>
      <input type="hidden" name="from" value={role.id} />
      <Field className="py-4">
        <FieldLabel htmlFor="duplicate-role-name">New role&apos;s name</FieldLabel>
        <Input
          id="duplicate-role-name"
          name="name"
          defaultValue={`${role.name} copy`}
          autoComplete="off"
          maxLength={60}
          required
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
        />
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Duplicating…" : "Duplicate role"}
        </Button>
      </DialogFooter>
    </form>
  );
}
