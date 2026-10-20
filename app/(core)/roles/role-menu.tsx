"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { deleteRole } from "./actions";
import { EditRoleDialog, type EditableRole, type PermissionChoices } from "./role-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Edit and delete for a custom role; a system role can only be duplicated. */
export function RoleMenu({
  role,
  system,
  choices,
}: {
  role: EditableRole;
  system: boolean;
  choices: PermissionChoices;
}) {
  const [dialog, setDialog] = useState<"edit" | "copy" | "delete" | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Options for ${role.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {system ? null : <DropdownMenuItem onSelect={() => setDialog("edit")}>Edit</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setDialog("copy")}>Duplicate</DropdownMenuItem>
          {system ? null : (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <EditRoleDialog
        role={role}
        copy={dialog === "copy"}
        choices={choices}
        open={dialog === "edit" || dialog === "copy"}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <ConfirmDeleteDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Delete ${role.name}?`}
        description="Only a role nobody has can be deleted. This can't be undone."
        action={() => deleteRole(role.id)}
      />
    </>
  );
}
