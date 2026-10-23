"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { removeMember, revokeInvitation } from "./actions";
import { EditMemberDialog, type EditableMember } from "./edit-member-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** A "…" menu with one destructive action, confirmed before it runs. */
function RowMenu({
  label,
  itemLabel,
  title,
  description,
  confirmLabel,
  pendingLabel,
  action,
}: {
  label: string;
  itemLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  action: () => Promise<{ success?: boolean; message: string }>;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={label}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            {itemLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDeleteDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        pendingLabel={pendingLabel}
        action={action}
      />
    </>
  );
}

/** A member's "…" menu: edit them, and remove them (or leave, on your own row). */
export function MemberMenu({
  member,
  roles,
  editable,
  roleEditable,
  removable,
  organizationName,
  self,
}: {
  member: EditableMember;
  roles: { id: string; name: string }[];
  editable: boolean;
  roleEditable: boolean;
  removable: boolean;
  organizationName: string;
  self: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={self ? "Your membership options" : `Options for ${member.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {editable ? <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem> : null}
          {editable && removable ? <DropdownMenuSeparator /> : null}
          {removable ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(true)}>
              {self ? "Leave organization" : "Remove from organization"}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {editable ? (
        <EditMemberDialog
          member={member}
          roles={roles}
          roleEditable={roleEditable}
          open={editing}
          onOpenChange={setEditing}
        />
      ) : null}
      <ConfirmDeleteDialog
        open={removing}
        onOpenChange={setRemoving}
        title={self ? `Leave ${organizationName}?` : `Remove ${member.name}?`}
        description={
          self
            ? "You'll lose access until someone invites you again."
            : `They'll lose access to ${organizationName} until invited again.`
        }
        confirmLabel={self ? "Leave" : "Remove"}
        pendingLabel={self ? "Leaving…" : "Removing…"}
        action={() => removeMember(member.id)}
      />
    </>
  );
}

export function RevokeInvitationMenu({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  return (
    <RowMenu
      label={`Options for the invitation to ${email}`}
      itemLabel="Revoke invitation"
      title={`Revoke the invitation to ${email}?`}
      description="The link they were sent will stop working."
      confirmLabel="Revoke"
      pendingLabel="Revoking…"
      action={() => revokeInvitation(invitationId)}
    />
  );
}
