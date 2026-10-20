import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { BackLink } from "../back-link";
import { readPermissionChoices, readRole } from "../data";
import { RoleForm } from "../role-form";
import { NoAccessState } from "@/components/no-access-state";
import { NotFoundState } from "@/components/not-found-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isUuid } from "@/lib/inventory";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Role",
};

export default function RolePage({ params }: PageProps<"/roles/[id]">) {
  return (
    <>
      <BackLink />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Role params={params} />
      </Suspense>
    </>
  );
}

async function Role({ params }: Pick<PageProps<"/roles/[id]">, "params">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("members.read")) return <NoAccessState reason="no-permission" />;

  const { id } = await params;
  const role = isUuid(id) ? await readRole(member.organization.id, id) : null;
  if (!role) return <NotFoundState />;

  const owner = !role.organizationId;
  const [choices, members] = await Promise.all([
    readPermissionChoices(member),
    getPrisma().membership.count({ where: { organizationId: member.organization.id, roleId: role.id } }),
  ]);

  return (
    <RoleForm
      role={role}
      members={members}
      choices={choices}
      builtIn={owner}
      readOnly={owner || !member.permissions.has("roles.manage")}
      note={
        owner
          ? "Whoever creates the organization is its owner. Owners can do everything, so this role can't be changed."
          : undefined
      }
    />
  );
}
