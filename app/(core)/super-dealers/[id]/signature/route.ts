import { isUuid, memberWith } from "@/lib/inventory";
import { getPrisma } from "@/lib/prisma";

/**
 * A dealer's signature PNG, for members who can see dealers. Only ever from
 * the signed-in member's own organization, and kept out of shared caches.
 */
export async function GET(_: Request, ctx: RouteContext<"/super-dealers/[id]/signature">) {
  const member = await memberWith("dealers.read");
  if (!member) return new Response(null, { status: 403 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response(null, { status: 404 });

  const dealer = await getPrisma().superDealer.findFirst({
    where: { id, organizationId: member.organization.id },
    select: { signature: true },
  });
  if (!dealer?.signature) return new Response(null, { status: 404 });

  return new Response(dealer.signature, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
