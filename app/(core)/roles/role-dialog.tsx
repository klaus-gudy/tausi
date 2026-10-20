"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { saveRole } from "./actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/inventory";
import type { PermissionModule } from "@/lib/permissions";

export type EditableRole = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
};

/** What the form needs to know about the permissions on offer. */
export type PermissionChoices = {
  modules: PermissionModule[];
  /** The keys the signed-in member holds, so may grant. */
  grantable: string[];
};

const initialState: ActionResult = { message: "" };

/** The "New role" button and its dialog. */
export function AddRoleDialog({ choices }: { choices: PermissionChoices }) {
  const [open, setOpen] = useState(false);
  // Remounting the form clears it for the next role.
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
          New role
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <RoleForm key={formKey} choices={choices} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Edits a custom role, or starts a new one from a copy of any role when
 * `copy` is set; opened from the role's row menu.
 */
export function EditRoleDialog({
  role,
  copy,
  choices,
  open,
  onOpenChange,
}: {
  role: EditableRole;
  copy?: boolean;
  choices: PermissionChoices;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {open ? (
          <RoleForm
            role={copy ? { ...role, id: "", name: `${role.name} copy` } : role}
            choices={choices}
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RoleForm({
  role,
  choices,
  onSaved,
}: {
  role?: EditableRole;
  choices: PermissionChoices;
  onSaved: () => void;
}) {
  const grantable = new Set(choices.grantable);
  const [checked, setChecked] = useState(() => new Set(role?.permissions ?? []));
  const [state, onSubmit, pending] = useFormAction(
    async (previous: ActionResult, formData: FormData) => {
      const result = await saveRole(previous, formData);
      if (result.success) {
        toast.success(result.message);
        onSaved();
      }
      return result;
    },
    initialState
  );

  /** Ticks or unticks keys, keeping each module's read key in step. */
  function toggle(group: PermissionModule, keys: string[], on: boolean) {
    setChecked((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (!grantable.has(key)) continue;
        if (on) next.add(key);
        else next.delete(key);
      }
      const read = group.read;
      if (read && grantable.has(read)) {
        const others = group.permissions.some((p) => p.key !== read && next.has(p.key));
        // Anything else in a module needs read; taking read away takes the rest.
        if (on && others) next.add(read);
        if (!on && keys.includes(read)) {
          for (const p of group.permissions) if (grantable.has(p.key)) next.delete(p.key);
        }
      }
      return next;
    });
  }

  const editing = !!role?.id;

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit role" : "New role"}</DialogTitle>
        <DialogDescription>
          Name the role, then pick what people with it can do in each part of the app.
        </DialogDescription>
      </DialogHeader>
      {editing ? <input type="hidden" name="id" value={role.id} /> : null}
      {[...checked].map((key) => (
        <input key={key} type="hidden" name="permissions" value={key} />
      ))}
      <FieldGroup className="gap-6 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="role-name">Name</FieldLabel>
            <Input
              id="role-name"
              name="name"
              defaultValue={role?.name ?? ""}
              placeholder="Storekeeper"
              autoComplete="off"
              maxLength={60}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="role-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id="role-description"
              name="description"
              defaultValue={role?.description ?? ""}
              placeholder="Receives and counts stock"
              autoComplete="off"
              maxLength={200}
            />
          </Field>
        </div>
        {choices.modules.map((group) => {
          const keys = group.permissions.map((p) => p.key);
          const ticked = keys.filter((key) => checked.has(key)).length;
          const all = ticked === keys.length;
          const id = `role-group-${group.key}`;
          return (
            <FieldSet key={group.key} className="gap-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <FieldLegend variant="label" className="mb-0">
                    {group.label}
                  </FieldLegend>
                  <FieldDescription className="text-xs">{group.description}</FieldDescription>
                </div>
                <Field orientation="horizontal" className="w-auto shrink-0">
                  <Checkbox
                    id={id}
                    checked={all}
                    disabled={!keys.some((key) => grantable.has(key))}
                    onCheckedChange={() => toggle(group, keys, !all)}
                  />
                  <FieldLabel htmlFor={id} className="font-normal text-muted-foreground">
                    All
                  </FieldLabel>
                </Field>
              </div>
              <div className="grid gap-2.5">
                {group.permissions.map((permission) => {
                  const permissionId = `role-permission-${permission.key}`;
                  const allowed = grantable.has(permission.key);
                  return (
                    <Field key={permission.key} orientation="horizontal">
                      <Checkbox
                        id={permissionId}
                        checked={checked.has(permission.key)}
                        disabled={!allowed}
                        onCheckedChange={(on) => toggle(group, [permission.key], on === true)}
                      />
                      <FieldLabel htmlFor={permissionId} className="font-normal">
                        {permission.label}
                        {!allowed ? (
                          <span className="text-xs text-muted-foreground"> · you don&apos;t have this</span>
                        ) : null}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </div>
            </FieldSet>
          );
        })}
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Add role"}
        </Button>
      </DialogFooter>
    </form>
  );
}
