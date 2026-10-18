"use client";

import { useActionState, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { inviteMember, type InviteState } from "./actions";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Role = { id: string; key: string; name: string };

const initialState: InviteState = { message: "" };

// Creates the invitation and copies its link straight away; the dialog's copy
// button is there if the browser refuses.
async function inviteAndCopy(previous: InviteState, formData: FormData) {
  const state = await inviteMember(previous, formData);
  if (state.success && state.link) {
    navigator.clipboard.writeText(state.link).then(
      () => toast.success("Invitation link copied."),
      () => {}
    );
  }
  return state;
}

export function InviteDialog({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false);
  // Remounting the form clears it and its result for the next invitation.
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
          <UserPlus data-icon="inline-start" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <InviteForm
          key={formKey}
          roles={roles}
          onAnother={() => setFormKey((key) => key + 1)}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({
  roles,
  onAnother,
  onDone,
}: {
  roles: Role[];
  onAnother: () => void;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(inviteAndCopy, initialState);
  const defaultRole = roles.find((role) => role.key === "member") ?? roles[0];

  if (state.success && state.link) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Invitation link ready</DialogTitle>
          <DialogDescription>
            Send this link to {state.email} so they can join. It works once
            and expires in 7 days.
          </DialogDescription>
        </DialogHeader>
        <CopyLink link={state.link} />
        <DialogFooter>
          <Button variant="outline" onClick={onAnother}>
            Invite another
          </Button>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form action={formAction}>
      <DialogHeader>
        <DialogTitle>Invite someone</DialogTitle>
        <DialogDescription>
          You&apos;ll get a link to send them so they can join.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <Field>
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="teammate@example.com"
            autoComplete="off"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite-role">Role</FieldLabel>
          <NativeSelect
            id="invite-role"
            name="roleId"
            defaultValue={defaultRole?.id}
            className="w-full"
          >
            {roles.map((role) => (
              <NativeSelectOption key={role.id} value={role.id}>
                {role.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>You can change it after they join.</FieldDescription>
        </Field>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invitation link"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div className="flex gap-2">
      <Input value={link} readOnly aria-label="Invitation link" onFocus={(e) => e.target.select()} />
      <Button
        variant="outline"
        size="icon"
        aria-label="Copy link"
        onClick={async () => {
          if (!(await copy())) {
            toast.error("Couldn't copy. Select the link and copy it instead.");
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
