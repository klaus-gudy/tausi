import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "../../actions";
import { acceptInvitation } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { findOpenInvitation } from "@/lib/invitations";
import { readSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Invitation",
};

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<Skeleton className="h-56 w-full rounded-xl" />}>
      <Invitation params={params} />
    </Suspense>
  );
}

async function Invitation({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  await connection();
  const [invitation, session] = await Promise.all([findOpenInvitation(token), readSession()]);

  if (!invitation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This invitation can&apos;t be used</CardTitle>
          <CardDescription>
            It may have expired, been revoked, or already been accepted. Ask
            whoever invited you to send a new one.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link href={session ? "/dashboard" : "/login"}>
              {session ? "Go to dashboard" : "Log in"}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const inviter = invitation.invitedBy?.name || invitation.invitedBy?.email;
  const here = `/invite/${encodeURIComponent(token)}`;
  const intro = (
    <CardHeader>
      <CardTitle>Join {invitation.organization.name}</CardTitle>
      <CardDescription>
        {inviter ? `${inviter} invited you` : "You've been invited"} to join as{" "}
        {invitation.role.name}.
      </CardDescription>
    </CardHeader>
  );

  if (!session) {
    const next = encodeURIComponent(here);
    return (
      <Card>
        {intro}
        <CardContent className="text-sm text-muted-foreground">
          Accept with{" "}
          <span className="font-medium text-foreground">{invitation.email}</span>.
          No organization is created: you join this one as{" "}
          {invitation.role.name}.
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button asChild className="w-full">
            <Link href={`/sign-up?next=${next}`}>Accept invitation</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/login?next=${next}`}>I already have an account</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return (
      <Card>
        {intro}
        <CardContent className="text-sm text-muted-foreground">
          This invitation is for{" "}
          <span className="font-medium text-foreground">{invitation.email}</span>,
          but you&apos;re logged in as{" "}
          <span className="font-medium text-foreground">{session.user.email}</span>.
          Log out and sign in with the invited address.
        </CardContent>
        <CardFooter>
          <form action={signOut} className="w-full">
            <Button type="submit" variant="outline" className="w-full">
              Log out
            </Button>
          </form>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      {intro}
      <CardFooter className="flex-col gap-2">
        <form action={acceptInvitation.bind(null, token)} className="w-full">
          <Button type="submit" className="w-full">
            Accept invitation
          </Button>
        </form>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/dashboard">Not now</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
