-- A member's name and phone as the organization knows them, captured on the
-- invitation and copied to the membership when it's accepted.
ALTER TABLE "memberships" ADD COLUMN "name" TEXT, ADD COLUMN "phone" TEXT;
ALTER TABLE "invitations" ADD COLUMN "name" TEXT, ADD COLUMN "phone" TEXT;
