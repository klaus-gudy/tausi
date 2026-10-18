"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { changeMemberRole, removeMember, revokeInvitation } from "./actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Role = { id: string; name: string };

export function RoleSelect({
  membershipId,
  roleId,
  roles,
  label,
}: {
  membershipId: string;
  roleId: string;
  roles: Role[];
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <NativeSelect
      size="sm"
      aria-label={label}
      value={roleId}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(async () => {
          const result = await changeMemberRole(membershipId, next);
          if (result.success) toast.success(result.message);
          else toast.error(result.message);
        });
      }}
    >
      {roles.map((role) => (
        <NativeSelectOption key={role.id} value={role.id}>
          {role.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

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

export function RemoveMemberMenu({
  membershipId,
  name,
  organizationName,
  self,
}: {
  membershipId: string;
  name: string;
  organizationName: string;
  self: boolean;
}) {
  return self ? (
    <RowMenu
      label="Your membership options"
      itemLabel="Leave organization"
      title={`Leave ${organizationName}?`}
      description="You'll lose access until someone invites you again."
      confirmLabel="Leave"
      pendingLabel="Leaving…"
      action={() => removeMember(membershipId)}
    />
  ) : (
    <RowMenu
      label={`Options for ${name}`}
      itemLabel="Remove from organization"
      title={`Remove ${name}?`}
      description={`They'll lose access to ${organizationName} until invited again.`}
      confirmLabel="Remove"
      pendingLabel="Removing…"
      action={() => removeMember(membershipId)}
    />
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
