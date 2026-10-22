import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { OnboardForm } from "./onboard-form";
import { NoAccessState } from "@/components/no-access-state";
import { Skeleton } from "@/components/ui/skeleton";
import { readActiveMember } from "@/lib/membership";
import { readPlaces } from "@/lib/places";

export const metadata: Metadata = {
  title: "Onboard a super dealer",
};

export default function OnboardDealerPage() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Onboard a super dealer</h1>
        <p className="text-muted-foreground">
          Take the dealer&apos;s details in their shop and have them sign.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Onboard />
      </Suspense>
    </div>
  );
}

async function Onboard() {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("dealers.onboard")) return <NoAccessState reason="no-permission" />;

  return <OnboardForm places={await readPlaces(member.organization.id)} organizationName={member.organization.name} />;
}
