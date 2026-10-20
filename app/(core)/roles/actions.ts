"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/lib/generated/prisma/client";
import { isUniqueViolation, memberWith, notAllowed, readText, type ActionResult } from "@/lib/inventory";
import { SYSTEM_ROLES } from "@/lib/membership";
import { withReadKeys } from "@/lib/permissions";
import { placeKey } from "@/lib/places";
import { getPrisma } from "@/lib/prisma";

// Only the organization's own roles are edited here. Owner, the one system
// role, is shared by every organization and can always do everything.

export type SaveRoleResult = ActionResult & { id?: string };

/**
 * Adds a custom role, or edits one when the form carries its id. You can
 * only grant or take away permissions you have yourself: any the role has
 * that you don't are kept as they are.
 */
export async function saveRole(_previous: SaveRoleResult, formData: FormData): Promise<SaveRoleResult> {
  const member = await memberWith("roles.manage");
  if (!member) return notAllowed;

  const id = readText(formData.get("id"));
  const name = readText(formData.get("name"), 60);
  const description = readText(formData.get("description"), 200);
  if (!name) return { message: "Enter the role's name." };

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  const [existing, roles, known] = await Promise.all([
    id
      ? prisma.role.findFirst({
          where: { id, organizationId },
          select: { permissions: { select: { permissionKey: true } } },
        })
      : null,
    prisma.role.findMany({
      where: { OR: [{ organizationId: null }, { organizationId }] },
      select: { id: true, key: true, name: true },
    }),
    prisma.permission.findMany({ select: { key: true } }),
  ]);
  if (id && !existing) return { message: "That role no longer exists." };
  if (roles.some((role) => role.id !== id && role.name.toLowerCase() === name.toLowerCase())) {
    return { message: `There's already a role called ${name}.` };
  }

  const knownKeys = new Set(known.map((permission) => permission.key));
  const requested = withReadKeys(formData.getAll("permissions").map(String));
  const kept = (existing?.permissions ?? [])
    .map((grant) => grant.permissionKey)
    .filter((key) => !member.permissions.has(key));
  const keys = [
    ...new Set([...[...requested].filter((key) => knownKeys.has(key) && member.permissions.has(key)), ...kept]),
  ];
  if (!keys.length) return { message: "Pick at least one permission." };

  let savedId = id;
  try {
    if (id) {
      await prisma.$transaction([
        prisma.role.update({ where: { id }, data: { name, description } }),
        prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        prisma.rolePermission.createMany({ data: keys.map((permissionKey) => ({ roleId: id, permissionKey })) }),
      ]);
    } else {
      // The key is only an internal handle, so it's made once and never
      // changes; it must not be a system role's, which the code checks for.
      const taken = new Set([...SYSTEM_ROLES, ...roles.map((role) => role.key)]);
      const base = placeKey(name) || "role";
      let key = base;
      for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
      const created = await prisma.role.create({
        select: { id: true },
        data: {
          organizationId,
          key,
          name,
          description,
          permissions: { create: keys.map((permissionKey) => ({ permissionKey })) },
        },
      });
      savedId = created.id;
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { message: "That role was just added. Try again in a moment." };
    throw error;
  }

  // Members with this role see the change on their next page.
  revalidatePath("/", "layout");
  return { success: true, message: id ? `${name} saved.` : `${name} added.`, id: savedId ?? undefined };
}

/**
 * Deletes a custom role nobody has. Its old accepted and revoked invitations
 * go with it: the memberships they led to are the record that matters.
 */
export async function deleteRole(id: string): Promise<ActionResult> {
  const member = await memberWith("roles.manage");
  if (!member) return notAllowed;

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  const role = await prisma.role.findFirst({
    where: { id, organizationId },
    select: {
      name: true,
      permissions: { select: { permissionKey: true } },
      _count: { select: { memberships: true, invitations: { where: { status: "pending" } } } },
    },
  });
  if (!role) return { message: "That role no longer exists." };
  if (role.permissions.some((grant) => !member.permissions.has(grant.permissionKey))) {
    return { message: "Only someone with every permission of this role can delete it." };
  }
  if (role._count.memberships) return { message: `Give the members with ${role.name} another role first.` };
  if (role._count.invitations) return { message: `Revoke the pending invitations for ${role.name} first.` };

  try {
    await prisma.$transaction([
      prisma.invitation.deleteMany({ where: { roleId: id, organizationId, status: { not: "pending" } } }),
      prisma.role.delete({ where: { id } }),
    ]);
  } catch (error) {
    // Someone was given the role, or invited with it, after the check above.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { message: `Someone was just given ${role.name}. Try again.` };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  return { success: true, message: `${role.name} deleted.` };
}
