"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { saveSuperDealer } from "./actions";
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
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/inventory";

export type EditableDealer = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  region: string | null;
  address: string | null;
  notes: string | null;
};

const initialState: ActionResult = { message: "" };

/** The "Add dealer" button and its dialog. */
export function AddDealerDialog() {
  const [open, setOpen] = useState(false);
  // Remounting the form clears it for the next dealer.
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
          Add dealer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DealerForm key={formKey} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Edits a dealer; opened from its row menu. */
export function EditDealerDialog({
  dealer,
  open,
  onOpenChange,
}: {
  dealer: EditableDealer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <DealerForm dealer={dealer} onSaved={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DealerForm({ dealer, onSaved }: { dealer?: EditableDealer; onSaved: () => void }) {
  const [state, onSubmit, pending] = useFormAction(
    async (previous: ActionResult, formData: FormData) => {
      const result = await saveSuperDealer(previous, formData);
      if (result.success) {
        toast.success(result.message);
        onSaved();
      }
      return result;
    },
    initialState
  );

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{dealer ? `Edit ${dealer.name}` : "Add a super dealer"}</DialogTitle>
        <DialogDescription>
          A shop or distributor you issue stock to.
        </DialogDescription>
      </DialogHeader>
      {dealer ? <input type="hidden" name="id" value={dealer.id} /> : null}
      <FieldGroup className="py-4">
        <Field>
          <FieldLabel htmlFor="dealer-name">Business name</FieldLabel>
          <Input
            id="dealer-name"
            name="name"
            defaultValue={dealer?.name}
            placeholder="Mwanza Traders"
            autoComplete="off"
            maxLength={200}
            required
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="dealer-contact">Contact person</FieldLabel>
            <Input
              id="dealer-contact"
              name="contactPerson"
              defaultValue={dealer?.contactPerson ?? ""}
              autoComplete="off"
              maxLength={200}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dealer-phone">Phone</FieldLabel>
            <Input
              id="dealer-phone"
              name="phone"
              type="tel"
              defaultValue={dealer?.phone ?? ""}
              autoComplete="off"
              maxLength={40}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dealer-email">Email</FieldLabel>
            <Input
              id="dealer-email"
              name="email"
              type="email"
              defaultValue={dealer?.email ?? ""}
              autoComplete="off"
              maxLength={200}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dealer-region">Region</FieldLabel>
            <Input
              id="dealer-region"
              name="region"
              defaultValue={dealer?.region ?? ""}
              placeholder="Mwanza"
              autoComplete="off"
              maxLength={100}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="dealer-address">Address</FieldLabel>
          <Input
            id="dealer-address"
            name="address"
            defaultValue={dealer?.address ?? ""}
            autoComplete="off"
            maxLength={300}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dealer-notes">Notes</FieldLabel>
          <Textarea
            id="dealer-notes"
            name="notes"
            defaultValue={dealer?.notes ?? ""}
            maxLength={1000}
            rows={2}
          />
        </Field>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : dealer ? "Save changes" : "Add dealer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
