import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { BackLink } from "../back-link";
import { readPermissionChoices, readRole } from "../data";
import { RoleForm } from "../role-form";
import { NoAccessState } from "@/components/no-access-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isUuid } from "@/lib/inventory";
import { readActiveMember } from "@/lib/membership";

export const metadata: Metadata = {
  title: "New role",
};

export default function NewRolePage({ searchParams }: PageProps<"/roles/new">) {
  return (
    <>
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New role</h1>
        <p className="text-muted-foreground">
          Name the role, then pick what people with it can do in each part of the app.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <NewRole searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Starts empty, or from a copy of the role in `?from=`. */
async function NewRole({ searchParams }: Pick<PageProps<"/roles/new">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("roles.manage")) return <NoAccessState reason="no-permission" />;

  const { from } = await searchParams;
  const [choices, source] = await Promise.all([
    readPermissionChoices(member),
    typeof from === "string" && isUuid(from) ? readRole(member.organization.id, from) : null,
  ]);

  return (
    <RoleForm
      role={
        source
          ? { id: "", name: `${source.name} copy`, description: source.description, permissions: source.permissions }
          : undefined
      }
      choices={choices}
    />
  );
}
