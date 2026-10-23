"use client";

import { toast } from "sonner";

import { updateMember } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useFormAction } from "@/hooks/use-form-action";
import { formatPhone } from "@/lib/dealers";

export type EditableMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roleId: string;
  roleName: string;
};

const initialState: { success?: boolean; message: string } = { message: "" };

/** Edits a member's name, phone and role; opened from their row menu. */
export function EditMemberDialog({
  member,
  roles,
  roleEditable,
  open,
  onOpenChange,
}: {
  member: EditableMember;
  roles: { id: string; name: string }[];
  /** False when their role can do things you can't, so you couldn't give it back. */
  roleEditable: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <EditMemberForm
            member={member}
            roles={roles}
            roleEditable={roleEditable}
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditMemberForm({
  member,
  roles,
  roleEditable,
  onSaved,
}: {
  member: EditableMember;
  roles: { id: string; name: string }[];
  roleEditable: boolean;
  onSaved: () => void;
}) {
  const [state, onSubmit, pending] = useFormAction(
    async (previous: typeof initialState, formData: FormData) => {
      const result = await updateMember(previous, formData);
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
        <DialogTitle>Edit {member.name}</DialogTitle>
        <DialogDescription>{member.email}</DialogDescription>
      </DialogHeader>
      <input type="hidden" name="id" value={member.id} />
      <FieldGroup className="py-4">
        <Field>
          <FieldLabel htmlFor="member-name">Name</FieldLabel>
          <Input
            id="member-name"
            name="name"
            defaultValue={member.name === member.email ? "" : member.name}
            autoComplete="off"
            maxLength={100}
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="member-phone">
            Phone <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="member-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={member.phone ? formatPhone(member.phone) : ""}
            placeholder="0754 123 456"
            autoComplete="off"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="member-role">Role</FieldLabel>
          {roleEditable ? (
            <NativeSelect id="member-role" name="roleId" defaultValue={member.roleId} className="w-full">
              {roles.map((role) => (
                <NativeSelectOption key={role.id} value={role.id}>
                  {role.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : (
            <>
              <Input id="member-role" value={member.roleName} disabled />
              <FieldDescription>
                Only someone with every permission of this role can change it.
              </FieldDescription>
            </>
          )}
        </Field>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
