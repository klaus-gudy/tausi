import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { BackLink } from "../back-link";
import { NewRoleForm } from "../new-role-form";
import { NoAccessState } from "@/components/no-access-state";
import { Skeleton } from "@/components/ui/skeleton";
import { readActiveMember } from "@/lib/membership";

export const metadata: Metadata = {
  title: "New role",
};

export default function NewRolePage() {
  return (
    <>
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New role</h1>
        <p className="text-muted-foreground">
          Name the role first. You&apos;ll set what it can do on its own page.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full max-w-xl" />}>
        <NewRole />
      </Suspense>
    </>
  );
}

async function NewRole() {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("roles.manage")) return <NoAccessState reason="no-permission" />;
  return <NewRoleForm />;
}
