import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SignUpForm } from "./sign-up-form";
import { RedirectIfSignedIn } from "@/components/redirect-if-signed-in";
import { Skeleton } from "@/components/ui/skeleton";
import { findOpenInvitation, invitationToken } from "@/lib/invitations";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
      <SignUp searchParams={searchParams} />
    </Suspense>
  );
}

// From an invitation link, the form joins that organization instead of
// creating one, so look the invitation up to show what they're joining.
async function SignUp({ searchParams }: Pick<PageProps<"/sign-up">, "searchParams">) {
  const { next } = await searchParams;
  const token = invitationToken(typeof next === "string" ? next : null);
  await connection();
  const invitation = token ? await findOpenInvitation(token) : null;

  return (
    <>
      <RedirectIfSignedIn next={next} />
      <SignUpForm
        invitation={
          invitation && {
            email: invitation.email,
            organizationName: invitation.organization.name,
            roleName: invitation.role.name,
          }
        }
      />
    </>
  );
}
