-- A salesperson added from Salespeople is invited as a member; accepting the
-- invitation links their login. Revoked or expired invitations keep the link.
ALTER TABLE "salespeople" ADD COLUMN "invitation_id" UUID;

CREATE UNIQUE INDEX "salespeople_invitation_id_key" ON "salespeople"("invitation_id");

ALTER TABLE "salespeople" ADD CONSTRAINT "salespeople_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
