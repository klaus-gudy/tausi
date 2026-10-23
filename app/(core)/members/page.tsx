import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MailPlus, Users } from "lucide-react";
import { InviteDialog } from "./invite-dialog";
import { MemberMenu, RevokeInvitationMenu } from "./member-controls";
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
  const [memberships, invitations, roles] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: organization.id },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        joinedAt: true,
        user: { select: { name: true, email: true } },
        role: { select: { id: true, key: true, name: true } },
      },
    }),
    canInvite
      ? prisma.invitation.findMany({
          where: { organizationId: organization.id, status: "pending" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            expiresAt: true,
            role: { select: { name: true } },
            invitedBy: { select: { name: true, email: true } },
          },
        })
      : [],
    assignableRoles(member),
  ]);
  const now = new Date();
  const invite = canInvite ? <InviteDialog roles={roles} /> : null;

  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "members", label: "Members", count: memberships.length },
        ...(canInvite
          ? [{ value: "invitations", label: "Pending invitations", count: invitations.length }]
          : []),
      ]}
      actions={{ members: invite, invitations: invite }}
    >
      <TabsContent value="members">
        <Card>
          <CardContent>
            <Table>
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
                {memberships.map((row) => {
                  const self = row.id === member.membershipId;
                  const name = row.name || row.user.name || row.user.email;
                  const touchesOwner = row.role.key === "owner" && !isOwner;
                  // Only a role you could give them yourself can be changed.
                  const roleEditable = canUpdate && roles.some((role) => role.id === row.role.id);
                  const removable = self || (canRemove && !touchesOwner);
                  return (
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
                      <TableCell>
                        {canUpdate || removable ? (
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
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {canInvite ? (
        <TabsContent value="invitations">
          {invitations.length ? (
            <Card>
              <CardContent>
                <Table>
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
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div className="font-medium">{invitation.name || invitation.email}</div>
                          <div className="text-xs text-muted-foreground md:hidden">
                            {invitation.name ? invitation.email : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Contact email={invitation.email} phone={invitation.phone} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{invitation.role.name}</Badge>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {invitation.invitedBy?.name || invitation.invitedBy?.email || "Someone"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {invitation.expiresAt <= now ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              {formatDate(invitation.expiresAt)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <RevokeInvitationMenu
                            invitationId={invitation.id}
                            email={invitation.email}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
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
