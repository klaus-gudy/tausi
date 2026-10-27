"use client";

import { useState } from "react";
import { KeyRound, MapPinned, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";

import { saveSalesperson, type SalespersonResult } from "./actions";
import { CopyLink } from "@/components/copy-link";
import { FormSection } from "@/components/form-section";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { formatPhone } from "@/lib/dealers";

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

/** A role a new salesperson can be invited with. */
export type RoleOption = { id: string; key: string; name: string };

const initialState: SalespersonResult = { message: "" };

// Select items can't have an empty value, so "none" stands in for no choice.
const NONE = "none";

const DIALOG_CLASS = "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl";

/** The "Add salesperson" button and its dialog. */
export function AddSalespersonDialog({
  zones,
  roles,
}: {
  zones: ZoneOption[];
  roles: RoleOption[];
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
      <DialogContent className={DIALOG_CLASS}>
        <SalespersonForm
          key={formKey}
          zones={zones}
          roles={roles}
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
      <DialogContent className={DIALOG_CLASS}>
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
  roles = [],
  logins = [],
  onAnother,
  onSaved,
}: {
  salesperson?: EditableSalesperson;
  zones: ZoneOption[];
  roles?: RoleOption[];
  logins?: LoginOption[];
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
  const [zoneKey, setZoneKey] = useState(salesperson?.zoneKey ?? NONE);
  const [userId, setUserId] = useState(salesperson?.userId ?? NONE);
  const [roleId, setRoleId] = useState(
    (roles.find((role) => role.key === "salesperson") ?? roles[0])?.id ?? ""
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
            : "Field staff the store sends stock to. They join as a member, so they can sign in."}
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
              <FieldLabel htmlFor="salesperson-email">
                Email
                {salesperson ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
              </FieldLabel>
              <Input
                id="salesperson-email"
                name="email"
                type="email"
                defaultValue={salesperson?.email ?? ""}
                placeholder="juma@example.com"
                autoComplete="off"
                maxLength={200}
                required={!salesperson}
              />
            </Field>
          </div>
        </FormSection>
        <FormSection
          icon={KeyRound}
          title="Sign-in"
          description={
            salesperson
              ? "The member who signs in to acknowledge stock and supply dealers."
              : "They're invited with the email above, and sign in to acknowledge stock and supply dealers."
          }
        >
          {salesperson ? (
            <Field>
              <FieldLabel htmlFor="salesperson-login">Member</FieldLabel>
              <input type="hidden" name="userId" value={userId === NONE ? "" : userId} />
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="salesperson-login" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No login</SelectItem>
                  {logins.map((login) => (
                    <SelectItem key={login.userId} value={login.userId}>
                      {login.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="salesperson-role">Role</FieldLabel>
              <input type="hidden" name="roleId" value={roleId} />
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger id="salesperson-role" className="w-full">
                  <SelectValue placeholder="Pick a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Someone already on Members is linked straight away and keeps their role.
              </FieldDescription>
            </Field>
          )}
        </FormSection>
        <FormSection icon={MapPinned} title="Coverage" description="The zone they work in.">
          <Field>
            <FieldLabel htmlFor="salesperson-zone">Zone</FieldLabel>
            <input type="hidden" name="zoneKey" value={zoneKey === NONE ? "" : zoneKey} />
            <Select value={zoneKey} onValueChange={setZoneKey}>
              <SelectTrigger id="salesperson-zone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No zone yet</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone.key} value={zone.key}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="salesperson-notes">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id="salesperson-notes"
              name="notes"
              defaultValue={salesperson?.notes ?? ""}
              maxLength={1000}
              rows={2}
            />
          </Field>
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
