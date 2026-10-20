import type { PermissionChoices } from "./role-form";
import type { ActiveMember } from "@/lib/membership";
import { groupPermissions } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

// Reads shared by the roles list and a role's own page.

/** Every permission there is, by module, and which ones `member` may grant. */
export async function readPermissionChoices(member: ActiveMember): Promise<PermissionChoices> {
  const permissions = await getPrisma().permission.findMany({ select: { key: true, description: true } });
  return { modules: groupPermissions(permissions), grantable: [...member.permissions] };
}

/** The owner role or one of the organization's own, with its permission keys. */
export async function readRole(organizationId: string, id: string) {
  const role = await getPrisma().role.findFirst({
    where: { id, OR: [{ organizationId: null, key: "owner" }, { organizationId }] },
    select: {
      id: true,
      name: true,
      description: true,
      organizationId: true,
      permissions: { select: { permissionKey: true } },
    },
  });
  if (!role) return null;
  const { permissions, ...rest } = role;
  return { ...rest, permissions: permissions.map((grant) => grant.permissionKey) };
}
