"use client";

import { useState } from "react";
import { MapPinned, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";

import { saveSalesperson, type SalespersonResult } from "./actions";
import { CopyLink } from "@/components/copy-link";
import { FormSection } from "@/components/form-section";
import { PlaceFields } from "@/components/place-fields";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import { formatPhone, type PlaceZone } from "@/lib/dealers";

/** A salesperson as the form edits them: name and email from their user, phone from their membership. */
export type EditableSalesperson = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** What they cover, as the place pickers start from it. */
  zoneKey: string | null;
  regionKey: string | null;
  districtKey: string | null;
};

const initialState: SalespersonResult = { message: "" };

const DIALOG_CLASS = "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl";

/** The "Add salesperson" button and its dialog. */
export function AddSalespersonDialog({ places }: { places: PlaceZone[] }) {
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
      <DialogContent className={DIALOG_CLASS}>
        <SalespersonForm
          key={formKey}
          places={places}
          onAnother={() => setFormKey((key) => key + 1)}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Edits a salesperson; opened from their row menu. */
export function EditSalespersonDialog({
  salesperson,
  places,
  open,
  onOpenChange,
}: {
  salesperson: EditableSalesperson;
  places: PlaceZone[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS}>
        {open ? (
          <SalespersonForm
            salesperson={salesperson}
            places={places}
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SalespersonForm({
  salesperson,
  places,
  onAnother,
  onSaved,
}: {
  salesperson?: EditableSalesperson;
  places: PlaceZone[];
  onAnother?: () => void;
  onSaved: () => void;
}) {
  const [state, onSubmit, pending] = useFormAction(
    async (previous: SalespersonResult, formData: FormData) => {
      const result = await saveSalesperson(previous, formData);
      if (result.success) {
        toast.success(result.message);
        // An invitation stays open to show its link.
        if (!result.link) onSaved();
      }
      return result;
    },
    initialState
  );

  if (state.success && state.link) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Invitation link ready</DialogTitle>
          <DialogDescription>
            Send this link to {state.email}. Once they join, they show on Members and sign in as
            this salesperson. It works once and expires in 7 days.
          </DialogDescription>
        </DialogHeader>
        <CopyLink link={state.link} />
        <DialogFooter>
          <Button variant="outline" onClick={onAnother}>
            Add another
          </Button>
          <Button onClick={onSaved}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  const submitLabel = salesperson ? "Save changes" : "Add and invite";

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{salesperson ? `Edit ${salesperson.name}` : "Add a salesperson"}</DialogTitle>
        <DialogDescription>
          {salesperson
            ? "Field staff the store sends stock to."
            : "Field staff the store sends stock to. They're invited as a member with the Salesperson role, and sign in to acknowledge stock and supply dealers."}
        </DialogDescription>
      </DialogHeader>
      {salesperson ? <input type="hidden" name="id" value={salesperson.id} /> : null}
      <FieldGroup className="gap-4 py-4">
        <FormSection icon={UserRound} title="Salesperson" description="Who they are and how to reach them.">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="salesperson-phone">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="salesperson-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={salesperson?.phone ? formatPhone(salesperson.phone) : ""}
                placeholder="0715 234 567"
                autoComplete="off"
                maxLength={40}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="salesperson-email">Email</FieldLabel>
              {/* What they sign in with; it stays as invited. */}
              <Input
                id="salesperson-email"
                name="email"
                type="email"
                defaultValue={salesperson?.email ?? ""}
                placeholder="juma@example.com"
                autoComplete="off"
                maxLength={200}
                required
                disabled={!!salesperson}
              />
            </Field>
          </div>
        </FormSection>
        <FormSection icon={MapPinned} title="Coverage" description="Where they work: a whole zone, or a region or district in it.">
          <div className="grid gap-4 sm:grid-cols-3">
            <PlaceFields
              places={places}
              zoneKey={salesperson?.zoneKey ?? null}
              regionKey={salesperson?.regionKey ?? null}
              districtKey={salesperson?.districtKey ?? null}
              idPrefix="salesperson"
            />
          </div>
        </FormSection>
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
