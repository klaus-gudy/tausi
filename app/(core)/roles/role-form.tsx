"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteRole, saveRole, type SaveRoleResult } from "./actions";
import { DuplicateRoleDialog } from "./duplicate-role-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { useFormAction } from "@/hooks/use-form-action";
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

const initialState: SaveRoleResult = { message: "" };

type Draft = { name: string; description: string; permissions: Set<string> };

function draftOf(role: EditableRole): Draft {
  return { name: role.name, description: role.description ?? "", permissions: new Set(role.permissions) };
}

function sameDraft(a: Draft, b: Draft) {
  return (
    a.name.trim() === b.name.trim() &&
    a.description.trim() === b.description.trim() &&
    a.permissions.size === b.permissions.size &&
    [...a.permissions].every((key) => b.permissions.has(key))
  );
}

/**
 * A role's own page: its name and description at the top, then what it can
 * do, module by module. The same page shows the role and sets it, with Save
 * appearing once something changes. Read-only for the owner role and for
 * members who can't manage roles.
 */
export function RoleForm({
  role,
  members,
  choices,
  readOnly = false,
  builtIn = false,
  note,
}: {
  role: EditableRole;
  members: number;
  choices: PermissionChoices;
  readOnly?: boolean;
  builtIn?: boolean;
  /** Shown under the description, e.g. why the role can't be changed. */
  note?: string;
}) {
  const router = useRouter();
  const grantable = new Set(readOnly ? [] : choices.grantable);
  // What was last saved, so the form knows when there's something to save.
  const [saved, setSaved] = useState(() => draftOf(role));
  const [draft, setDraft] = useState(() => draftOf(role));
  const [deleting, setDeleting] = useState(false);
  const dirty = !sameDraft(draft, saved);
  const [state, onSubmit, pending] = useFormAction(
    async (previous: SaveRoleResult, formData: FormData) => {
      const result = await saveRole(previous, formData);
      if (result.success) {
        toast.success(result.message);
        setSaved(draft);
      }
      return result;
    },
    initialState
  );

  /** Ticks or unticks keys, keeping each module's read key in step. */
  function toggle(group: PermissionModule, keys: string[], on: boolean) {
    setDraft((current) => {
      const next = new Set(current.permissions);
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
      return { ...current, permissions: next };
    });
  }

  // Inputs that read as a heading and its subtitle until they're clicked.
  const inline =
    "-mx-2 w-full rounded-md bg-transparent px-2 outline-none transition-colors read-only:cursor-default not-read-only:hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="id" value={role.id} />
      {[...draft.permissions].map((key) => (
        <input key={key} type="hidden" name="permissions" value={key} />
      ))}

      <div className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex items-center gap-2">
              <input
                name="name"
                aria-label="Role name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                readOnly={readOnly}
                required
                maxLength={60}
                autoComplete="off"
                className={`${inline} h-10 min-w-0 text-2xl font-semibold tracking-tight`}
              />
              {builtIn ? <Badge variant="secondary">Built-in</Badge> : null}
            </div>
            <input
              name="description"
              aria-label="Role description"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              readOnly={readOnly}
              maxLength={200}
              autoComplete="off"
              placeholder={readOnly ? "" : "Add a description, e.g. Receives and counts stock"}
              className={`${inline} h-8 text-muted-foreground placeholder:text-muted-foreground/60`}
            />
            <p className="text-xs text-muted-foreground">
              {note ?? (members === 1 ? "1 member has this role." : `${members} members have this role.`)}
            </p>
          </div>
          {readOnly ? null : (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {dirty ? (
                <>
                  <Button key="discard" type="button" variant="ghost" disabled={pending} onClick={() => setDraft(saved)}>
                    Discard
                  </Button>
                  <Button key="save" type="submit" disabled={pending || !draft.name.trim()}>
                    {pending ? "Saving…" : "Save changes"}
                  </Button>
                </>
              ) : (
                <>
                  <DuplicateRoleDialog key="duplicate" role={role} />
                  <Button
                    key="delete"
                    type="button"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        {state.message && !state.success ? <FieldError className="mt-2">{state.message}</FieldError> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {choices.modules.map((group) => {
          const keys = group.permissions.map((p) => p.key);
          const all = keys.every((key) => draft.permissions.has(key));
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
                        checked={draft.permissions.has(permission.key)}
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

      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${saved.name}?`}
        description="Only a role nobody has can be deleted. This can't be undone."
        action={() => deleteRole(role.id)}
        onDeleted={() => router.push("/roles")}
      />
    </form>
  );
}
