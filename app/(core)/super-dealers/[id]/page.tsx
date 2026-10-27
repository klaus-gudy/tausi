import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, MapPin } from "lucide-react";

import { DetailHeader } from "@/components/detail-header";
import { NoAccessState } from "@/components/no-access-state";
import { NotFoundState } from "@/components/not-found-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dealerName, formatPhone } from "@/lib/dealers";
import { formatDate } from "@/lib/format";
import { isUuid } from "@/lib/inventory";
import { readActiveMember } from "@/lib/membership";
import { PLACE } from "@/lib/places";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Super dealer",
};

export default function SuperDealerPage({ params }: PageProps<"/super-dealers/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/super-dealers">
            <ArrowLeft data-icon="inline-start" />
            Super dealers
          </Link>
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Dealer params={params} />
      </Suspense>
    </div>
  );
}

async function Dealer({ params }: Pick<PageProps<"/super-dealers/[id]">, "params">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("dealers.read")) return <NoAccessState reason="no-permission" />;

  const { id } = await params;
  const dealer = isUuid(id)
    ? await getPrisma().superDealer.findFirst({
        where: { id, organizationId: member.organization.id },
        select: {
          id: true,
          shopName: true,
          contactName: true,
          phone: true,
          email: true,
          tin: true,
          businessLicence: true,
          address: true,
          latitude: true,
          longitude: true,
          notes: true,
          signedByName: true,
          signedAt: true,
          deactivatedAt: true,
          createdAt: true,
          ...PLACE,
          onboardedBy: { select: { name: true, email: true } },
        },
      })
    : null;
  if (!dealer) return <NotFoundState />;

  const place = [dealer.district?.name, dealer.district?.region.name].filter(Boolean).join(", ");
  const map =
    dealer.latitude !== null && dealer.longitude !== null
      ? `https://www.openstreetmap.org/?mlat=${dealer.latitude}&mlon=${dealer.longitude}#map=18/${dealer.latitude}/${dealer.longitude}`
      : null;

  return (
    <>
      <DetailHeader
        title={dealerName(dealer)}
        badges={dealer.deactivatedAt ? <Badge variant="outline">Inactive</Badge> : null}
        description={
          dealer.onboardedBy
            ? `Onboarded by ${dealer.onboardedBy.name || dealer.onboardedBy.email} on ${formatDate(dealer.createdAt)}`
            : `Added on ${formatDate(dealer.createdAt)}`
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
          </CardHeader>
          <CardContent>
            <Details
              rows={[
                ["Shop name", dealer.shopName],
                ["Owner / contact", dealer.contactName],
                ["Phone", dealer.phone && formatPhone(dealer.phone)],
                ["Email", dealer.email],
                ["TIN", dealer.tin],
                ["Business licence", dealer.businessLicence],
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Details
              rows={[
                ["District, region", place || null],
                ["Zone", dealer.district?.region.zone.name ?? null],
                ["Address", dealer.address],
              ]}
            />
            {map ? (
              <Button asChild variant="outline" size="sm" className="justify-self-start">
                <a href={map} target="_blank" rel="noreferrer">
                  <MapPin data-icon="inline-start" />
                  Open on map
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {dealer.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-sm">{dealer.notes}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Signature</CardTitle>
          <CardDescription>
            {dealer.signedAt
              ? `Signed by ${dealer.signedByName} on ${formatDate(dealer.signedAt)}, confirming these details and agreeing to be supplied as a super dealer.`
              : "Added in the office, so not signed."}
          </CardDescription>
        </CardHeader>
        {dealer.signedAt ? (
          <CardContent>
            {/* Served by ./signature with the same permission check as this page. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/super-dealers/${dealer.id}/signature`}
              alt={`Signature of ${dealer.signedByName}`}
              className="h-44 w-full max-w-md rounded-lg border bg-white object-contain"
            />
          </CardContent>
        ) : null}
      </Card>
    </>
  );
}

function Details({ rows }: { rows: [string, string | null][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
