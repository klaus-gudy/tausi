"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteRole, saveRole, type SaveRoleResult } from "./actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import type { PermissionModule } from "@/lib/permissions";

export type EditableRole = {
  /** Empty for a role that isn't saved yet. */
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

const initialState: SaveRoleResult = { message: "" };

/**
 * A role's name and its permissions, module by module. The same page shows a
 * role and sets it: read-only for the owner role and for members who can't
 * manage roles.
 */
export function RoleForm({
  role,
  choices,
  readOnly = false,
}: {
  role?: EditableRole;
  choices: PermissionChoices;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const grantable = new Set(readOnly ? [] : choices.grantable);
  const [checked, setChecked] = useState(() => new Set(role?.permissions ?? []));
  const [deleting, setDeleting] = useState(false);
  const [state, onSubmit, pending] = useFormAction(
    async (previous: SaveRoleResult, formData: FormData) => {
      const result = await saveRole(previous, formData);
      if (result.success) {
        toast.success(result.message);
        if (!role?.id && result.id) router.push(`/roles/${result.id}`);
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

  const saved = !!role?.id;

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {saved ? <input type="hidden" name="id" value={role.id} /> : null}
      {[...checked].map((key) => (
        <input key={key} type="hidden" name="permissions" value={key} />
      ))}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>What the role is called and who it&apos;s for.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="role-name">Name</FieldLabel>
            <Input
              id="role-name"
              name="name"
              defaultValue={role?.name ?? ""}
              placeholder="Storekeeper"
              autoComplete="off"
              maxLength={60}
              readOnly={readOnly}
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
              placeholder={readOnly ? "" : "Receives and counts stock"}
              autoComplete="off"
              maxLength={200}
              readOnly={readOnly}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {choices.modules.map((group) => {
          const keys = group.permissions.map((p) => p.key);
          const all = keys.every((key) => checked.has(key));
          const id = `role-module-${group.key}`;
          return (
            <Card key={group.key}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="grid gap-1.5">
                  <CardTitle>{group.label}</CardTitle>
                  <CardDescription>{group.description}</CardDescription>
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
              </CardHeader>
              <CardContent className="grid gap-2.5">
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
                        {!allowed && !readOnly ? (
                          <span className="text-xs text-muted-foreground"> · you don&apos;t have this</span>
                        ) : null}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {readOnly ? null : (
        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
          {state.message && !state.success ? <FieldError className="mr-auto">{state.message}</FieldError> : null}
          {saved ? (
            <>
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => setDeleting(true)}>
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/roles/new?from=${role.id}`}>
                  <Copy data-icon="inline-start" />
                  Duplicate
                </Link>
              </Button>
            </>
          ) : null}
          <Button type="submit" disabled={pending} className="ml-auto">
            {pending ? "Saving…" : saved ? "Save changes" : "Add role"}
          </Button>
        </div>
      )}
      {saved ? (
        <ConfirmDeleteDialog
          open={deleting}
          onOpenChange={setDeleting}
          title={`Delete ${role.name}?`}
          description="Only a role nobody has can be deleted. This can't be undone."
          action={() => deleteRole(role.id)}
          onDeleted={() => router.push("/roles")}
        />
      ) : null}
    </form>
  );
}
