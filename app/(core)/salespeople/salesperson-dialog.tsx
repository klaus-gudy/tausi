"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { saveSalesperson } from "./actions";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { formatPhone } from "@/lib/dealers";
import type { ActionResult } from "@/lib/inventory";

export type EditableSalesperson = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  zoneKey: string | null;
  userId: string | null;
  notes: string | null;
};

export type ZoneOption = { key: string; name: string };

/** A member whose login a salesperson can be linked to. */
export type LoginOption = { userId: string; label: string };

const initialState: ActionResult = { message: "" };

/** The "Add salesperson" button and its dialog. */
export function AddSalespersonDialog({
  zones,
  logins,
}: {
  zones: ZoneOption[];
  logins: LoginOption[];
}) {
  const [open, setOpen] = useState(false);
  // Remounting the form clears it for the next salesperson.
  const [formKey, setFormKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFormKey((key) => key + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Add salesperson
        </Button>
      </DialogTrigger>
      <DialogContent>
        <SalespersonForm key={formKey} zones={zones} logins={logins} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Edits a salesperson; opened from their row menu. */
export function EditSalespersonDialog({
  salesperson,
  zones,
  logins,
  open,
  onOpenChange,
}: {
  salesperson: EditableSalesperson;
  zones: ZoneOption[];
  logins: LoginOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <SalespersonForm
            salesperson={salesperson}
            zones={zones}
            logins={logins}
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SalespersonForm({
  salesperson,
  zones,
  logins,
  onSaved,
}: {
  salesperson?: EditableSalesperson;
  zones: ZoneOption[];
  logins: LoginOption[];
  onSaved: () => void;
}) {
  const [state, onSubmit, pending] = useFormAction(
    async (previous: ActionResult, formData: FormData) => {
      const result = await saveSalesperson(previous, formData);
      if (result.success) {
        toast.success(result.message);
        onSaved();
      }
      return result;
    },
    initialState
  );

  const submitLabel = salesperson ? "Save changes" : "Add salesperson";

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{salesperson ? `Edit ${salesperson.name}` : "Add a salesperson"}</DialogTitle>
        <DialogDescription>Field staff the store sends stock to.</DialogDescription>
      </DialogHeader>
      {salesperson ? <input type="hidden" name="id" value={salesperson.id} /> : null}
      <FieldGroup className="py-4">
        <Field>
          <FieldLabel htmlFor="salesperson-name">Name</FieldLabel>
          <Input
            id="salesperson-name"
            name="name"
            defaultValue={salesperson?.name}
            placeholder="Juma Mwakyusa"
            autoComplete="off"
            maxLength={200}
            required
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="salesperson-phone">Phone</FieldLabel>
            <Input
              id="salesperson-phone"
              name="phone"
              type="tel"
              defaultValue={salesperson?.phone ? formatPhone(salesperson.phone) : ""}
              placeholder="0715 234 567"
              autoComplete="off"
              maxLength={40}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="salesperson-email">Email</FieldLabel>
            <Input
              id="salesperson-email"
              name="email"
              type="email"
              defaultValue={salesperson?.email ?? ""}
              autoComplete="off"
              maxLength={200}
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="salesperson-zone">Zone</FieldLabel>
            <NativeSelect
              id="salesperson-zone"
              name="zoneKey"
              defaultValue={salesperson?.zoneKey ?? ""}
              className="w-full"
            >
              <NativeSelectOption value="">No zone</NativeSelectOption>
              {zones.map((zone) => (
                <NativeSelectOption key={zone.key} value={zone.key}>
                  {zone.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="salesperson-login">Login</FieldLabel>
            <NativeSelect
              id="salesperson-login"
              name="userId"
              defaultValue={salesperson?.userId ?? ""}
              className="w-full"
            >
              <NativeSelectOption value="">No login</NativeSelectOption>
              {logins.map((login) => (
                <NativeSelectOption key={login.userId} value={login.userId}>
                  {login.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              The member who signs in to acknowledge stock and supply dealers.
            </FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="salesperson-notes">Notes</FieldLabel>
          <Textarea
            id="salesperson-notes"
            name="notes"
            defaultValue={salesperson?.notes ?? ""}
            maxLength={1000}
            rows={2}
          />
        </Field>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
