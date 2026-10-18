"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

/** Makes another of the user's organizations the active one for this session. */
export async function switchOrganization(organizationId: string) {
  const session = await readSession();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.userId } },
    select: { status: true, organization: { select: { name: true, deletedAt: true } } },
  });
  if (!membership || membership.status !== "active" || membership.organization.deletedAt) {
    return { success: false, message: "You're not a member of that organization." };
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { activeOrganizationId: organizationId },
  });
  // Everything on screen belongs to the old organization: drop the client cache.
  revalidatePath("/", "layout");
  return { success: true, message: `Switched to ${membership.organization.name}.` };
}
