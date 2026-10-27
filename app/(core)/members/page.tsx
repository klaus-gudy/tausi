import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MailPlus, Users } from "lucide-react";
import { InviteDialog } from "./invite-dialog";
import { MemberMenu, RevokeInvitationMenu } from "./member-controls";
import {
  MobileCard,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards";
import { UrlTabs } from "@/components/url-tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { formatPhone } from "@/lib/dealers";
import { formatDate } from "@/lib/format";
import { assignableRoles, readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Members",
};

export default function MembersPage({ searchParams }: PageProps<"/members">) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground">
          Who&apos;s in your organization, and who&apos;s been invited.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Members searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Email over phone, for the contact column. */
function Contact({ email, phone }: { email: string; phone: string | null }) {
  return (
    <div className="grid">
      <span>{email}</span>
      {phone ? <span className="text-xs text-muted-foreground">{formatPhone(phone)}</span> : null}
    </div>
  );
}

async function Members({ searchParams }: Pick<PageProps<"/members">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>You&apos;re not in an organization</EmptyTitle>
          <EmptyDescription>
            Ask an organization&apos;s owner or admin for an invitation link.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { organization, permissions } = member;
  const isOwner = member.role.key === "owner";
  const canInvite = permissions.has("members.invite");
  const canUpdate = permissions.has("members.update");
  const canRemove = permissions.has("members.remove");
  const tab = canInvite && (await searchParams).tab === "invitations" ? "invitations" : "members";

  const prisma = getPrisma();
  const [memberships, invited, invitations, roles] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: organization.id, status: { not: "invited" } },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true,
        phone: true,
        status: true,
        joinedAt: true,
        user: { select: { name: true, email: true } },
        role: { select: { id: true, key: true, name: true } },
      },
    }),
    // People added but not joined yet: members already, waiting on their link.
    canInvite
      ? prisma.membership.findMany({
          where: { organizationId: organization.id, status: "invited" },
          orderBy: { joinedAt: "desc" },
          select: {
            id: true,
            phone: true,
            user: { select: { name: true, email: true } },
            role: { select: { name: true } },
            invitedBy: { select: { name: true, email: true } },
          },
        })
      : [],
    canInvite
      ? prisma.invitation.findMany({
          where: { organizationId: organization.id, status: "pending" },
          select: { email: true, expiresAt: true },
        })
      : [],
    assignableRoles(member),
  ]);
  const now = new Date();
  // A link that ran out or was replaced leaves them without a pending one.
  const expiry = new Map(invitations.map((invitation) => [invitation.email.toLowerCase(), invitation.expiresAt]));
  const invite = canInvite ? <InviteDialog roles={roles} /> : null;
  const rows = memberships.map((row) => {
    const self = row.id === member.membershipId;
    const name = row.user.name || row.user.email;
    const touchesOwner = row.role.key === "owner" && !isOwner;
    // Only a role you could give them yourself can be changed.
    const roleEditable = canUpdate && roles.some((role) => role.id === row.role.id);
    const removable = self || (canRemove && !touchesOwner);
    const menu =
      canUpdate || removable ? (
        <MemberMenu
          member={{
            id: row.id,
            name,
            email: row.user.email,
            phone: row.phone,
            roleId: row.role.id,
            roleName: row.role.name,
          }}
          roles={roles}
          editable={canUpdate && !touchesOwner}
          roleEditable={roleEditable}
          removable={removable}
          organizationName={organization.name}
          self={self}
        />
      ) : null;
    return { row, self, name, menu };
  });

  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "members", label: "Members", count: memberships.length },
        ...(canInvite
          ? [{ value: "invitations", label: "Pending invitations", count: invited.length }]
          : []),
      ]}
      actions={{ members: invite, invitations: invite }}
    >
      <TabsContent value="members">
        <Card>
          <CardContent>
            <MobileCards>
              {rows.map(({ row, self, name, menu }) => (
                <MobileCard key={row.id}>
                  <MobileCardHeader
                    title={
                      <>
                        {name}
                        {self ? <span className="text-muted-foreground"> (you)</span> : null}
                      </>
                    }
                    badge={
                      row.status === "suspended" ? <Badge variant="destructive">Suspended</Badge> : undefined
                    }
                    description={row.user.name ? row.user.email : undefined}
                    aside={menu}
                  />
                  <MobileCardFields>
                    <MobileCardField label="Role">
                      <Badge variant="secondary">{row.role.name}</Badge>
                    </MobileCardField>
                    {row.phone ? <MobileCardField label="Phone">{formatPhone(row.phone)}</MobileCardField> : null}
                    <MobileCardField label="Joined">{formatDate(row.joinedAt)}</MobileCardField>
                  </MobileCardFields>
                </MobileCard>
              ))}
            </MobileCards>
            <Table className="hidden @4xl/main:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined at</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ row, self, name, menu }) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">
                        {name}
                        {self ? <span className="text-muted-foreground"> (you)</span> : null}
                      </div>
                      {/* The contact column is hidden on small screens. */}
                      <div className="text-xs text-muted-foreground md:hidden">{row.user.email}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Contact email={row.user.email} phone={row.phone} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.role.name}</Badge>
                      {row.status === "suspended" ? (
                        <Badge variant="destructive" className="ml-2">
                          Suspended
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(row.joinedAt)}
                    </TableCell>
                    <TableCell>{menu}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {canInvite ? (
        <TabsContent value="invitations">
          {invited.length ? (
            <Card>
              <CardContent>
                <MobileCards>
                  {invited.map((row) => {
                    const expiresAt = expiry.get(row.user.email.toLowerCase());
                    return (
                      <MobileCard key={row.id}>
                        <MobileCardHeader
                          title={row.user.name || row.user.email}
                          badge={!expiresAt || expiresAt <= now ? <Badge variant="destructive">Expired</Badge> : undefined}
                          description={row.user.name ? row.user.email : undefined}
                          aside={<RevokeInvitationMenu membershipId={row.id} email={row.user.email} />}
                        />
                        <MobileCardFields>
                          <MobileCardField label="Role">
                            <Badge variant="outline">{row.role.name}</Badge>
                          </MobileCardField>
                          {row.phone ? <MobileCardField label="Phone">{formatPhone(row.phone)}</MobileCardField> : null}
                          <MobileCardField label="Invited by">
                            {row.invitedBy?.name || row.invitedBy?.email || "Someone"}
                          </MobileCardField>
                          {expiresAt && expiresAt > now ? (
                            <MobileCardField label="Expires">{formatDate(expiresAt)}</MobileCardField>
                          ) : null}
                        </MobileCardFields>
                      </MobileCard>
                    );
                  })}
                </MobileCards>
                <Table className="hidden @4xl/main:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Contact</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden sm:table-cell">Invited by</TableHead>
                      <TableHead className="hidden sm:table-cell">Expires</TableHead>
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invited.map((row) => {
                      const expiresAt = expiry.get(row.user.email.toLowerCase());
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-medium">{row.user.name || row.user.email}</div>
                            <div className="text-xs text-muted-foreground md:hidden">
                              {row.user.name ? row.user.email : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Contact email={row.user.email} phone={row.phone} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.role.name}</Badge>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            {row.invitedBy?.name || row.invitedBy?.email || "Someone"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {!expiresAt || expiresAt <= now ? (
                              <Badge variant="destructive">Expired</Badge>
                            ) : (
                              <span className="text-muted-foreground">{formatDate(expiresAt)}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <RevokeInvitationMenu membershipId={row.id} email={row.user.email} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MailPlus />
                </EmptyMedia>
                <EmptyTitle>No pending invitations</EmptyTitle>
                <EmptyDescription>
                  Each link works once. Inviting the same email again creates a new link.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </TabsContent>
      ) : null}
    </UrlTabs>
  );
}
