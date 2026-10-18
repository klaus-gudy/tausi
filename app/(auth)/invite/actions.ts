"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { claimInvitation, findOpenInvitation } from "@/lib/invitations";
import { getPrisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { setFlash } from "@/lib/set-flash";

export async function acceptInvitation(token: string) {
  const page = `/invite/${encodeURIComponent(token)}`;
  const session = await readSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(page)}`);

  const invitation = await findOpenInvitation(token);
  // The page explains what's wrong; just show it again.
  if (!invitation || invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    redirect(page);
  }

  const prisma = getPrisma();
  const joined = await prisma.$transaction(async (tx) => {
    if (!(await claimInvitation(tx, invitation, session.userId))) return false;
    await tx.session.update({
      where: { id: session.id },
      data: { activeOrganizationId: invitation.organization.id },
    });
    return true;
  });
  if (!joined) redirect(page);

  revalidatePath("/", "layout");
  await setFlash({ type: "success", message: `You joined ${invitation.organization.name}.` });
  redirect("/dashboard");
}
