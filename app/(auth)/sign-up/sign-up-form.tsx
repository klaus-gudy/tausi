"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { ArrowLeft } from "lucide-react";

import {
  checkOrganizationName,
  signUp,
  type OrganizationCheck,
  type SignUpState,
} from "../actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Invitation = { email: string; organizationName: string; roleName: string };

// Two steps: claim an organization name, then create the account that owns
// it. Someone arriving from an invitation link skips step 1: signing up
// accepts the invitation instead. Render inside <Suspense>: it reads the URL.
export function SignUpForm({ invitation }: { invitation: Invitation | null }) {
  const next = useSearchParams().get("next");
  const invited = next?.startsWith("/invite/") ?? false;
  const [organization, setOrganization] = useState<string | null>(null);
  // Why step 2 sent the user back to step 1, if it did.
  const [takenMessage, setTakenMessage] = useState("");
  // Bumped to remount step 1, so it shows takenMessage instead of its old result.
  const [organizationKey, setOrganizationKey] = useState(0);
  const [draftName, setDraftName] = useState("");

  if (!invited && organization === null) {
    return (
      <OrganizationStep
        key={organizationKey}
        defaultName={draftName}
        message={takenMessage}
        onAvailable={(name) => {
          setDraftName(name);
          setTakenMessage("");
          setOrganization(name);
        }}
      />
    );
  }

  return (
    <AccountStep
      organization={organization}
      invitation={invitation}
      next={next}
      onBack={(message = "") => {
        setTakenMessage(message);
        setOrganizationKey((key) => key + 1);
        setOrganization(null);
      }}
    />
  );
}

const initialCheck: OrganizationCheck = { message: "" };

function OrganizationStep({
  defaultName,
  message,
  onAvailable,
}: {
  defaultName: string;
  message: string;
  onAvailable: (name: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: OrganizationCheck, formData: FormData) => {
      const result = await checkOrganizationName(previous, formData);
      if (result.available) onAvailable(result.available);
      return result;
    },
    initialCheck
  );
  const error = state.message || message;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Step 1 of 2</CardDescription>
        <CardTitle>Name your organization</CardTitle>
        <CardDescription>
          You&apos;ll be its owner and can invite your team later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="organization">Organization name</FieldLabel>
              <Input
                id="organization"
                name="organization"
                autoComplete="organization"
                placeholder="Acme Inc."
                defaultValue={state.name ?? defaultName}
                maxLength={100}
                aria-invalid={error ? true : undefined}
                autoFocus
                required
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? "Checking…" : "Continue"}
              </Button>
              <FieldDescription className="text-center">
                Already have an account? <Link href="/login">Log in</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

const initialSignUp: SignUpState = { message: "" };

function AccountStep({
  organization,
  invitation,
  next,
  onBack,
}: {
  organization: string | null;
  invitation: Invitation | null;
  next: string | null;
  onBack: (message?: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: SignUpState, formData: FormData) => {
      const result = await signUp(previous, formData);
      if (result.organizationTaken) onBack(result.message);
      return result;
    },
    initialSignUp
  );

  return (
    <Card>
      <CardHeader>
        {organization ? <CardDescription>Step 2 of 2</CardDescription> : null}
        <CardTitle>
          {invitation ? `Join ${invitation.organizationName}` : "Create your account"}
        </CardTitle>
        <CardDescription>
          {organization ? (
            <>
              You&apos;ll own{" "}
              <span className="font-medium text-foreground">{organization}</span>.
            </>
          ) : invitation ? (
            <>
              You&apos;ll join as{" "}
              <span className="font-medium text-foreground">{invitation.roleName}</span>.
            </>
          ) : (
            "Enter your details to accept the invitation."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {organization ? (
            <input type="hidden" name="organization" value={organization} />
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Jane Doe"
                defaultValue={state.name}
                autoFocus
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                defaultValue={invitation?.email ?? state.email}
                readOnly={!!invitation}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <FieldDescription>
                At least 8 characters. Already have an account with this email?
                Enter its password.
              </FieldDescription>
            </Field>
            {state.message && !state.organizationTaken ? (
              <FieldError>{state.message}</FieldError>
            ) : null}
            <Field>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Creating account…"
                  : invitation
                    ? "Accept invitation"
                    : "Create account"}
              </Button>
              {organization ? (
                <Button type="button" variant="ghost" onClick={() => onBack()}>
                  <ArrowLeft data-icon="inline-start" />
                  Change organization name
                </Button>
              ) : null}
              <FieldDescription className="text-center">
                Already have an account?{" "}
                <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
                  Log in
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
