-- One record per person: a name and email on the user, a phone and role on
-- the membership, and a salesperson is a membership plus the zone they cover.

-- Pending invitations become invited members, each with a user (no password
-- yet) holding the name they were invited with.
INSERT INTO "users" ("email", "name")
SELECT DISTINCT ON ("email") "email", "name"
FROM "invitations"
WHERE "status" = 'pending'
ORDER BY "email", "created_at" DESC
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "memberships" ("organization_id", "user_id", "role_id", "status", "phone", "invited_by_id", "joined_at")
SELECT i."organization_id", u."id", i."role_id", 'invited', i."phone", i."invited_by_id", i."created_at"
FROM "invitations" i
JOIN "users" u ON u."email" = i."email"
WHERE i."status" = 'pending'
ON CONFLICT ("organization_id", "user_id") DO NOTHING;

-- A name given by the organization fills in a user who has none.
UPDATE "users" u
SET "name" = m."name"
FROM "memberships" m
WHERE m."user_id" = u."id" AND m."name" IS NOT NULL AND u."name" IS NULL;

-- Salespeople without a login can't become members. Drop the ones with no
-- history; any with transfers or deliveries must be linked by hand first.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "salespeople" s
    WHERE s."user_id" IS NULL
      AND (EXISTS (SELECT 1 FROM "stock_transfers" t WHERE t."salesperson_id" = s."id")
        OR EXISTS (SELECT 1 FROM "deliveries" d WHERE d."salesperson_id" = s."id"))
  ) THEN
    RAISE EXCEPTION 'Salespeople without a login have transfers or deliveries. Link each one to a member, then migrate again.';
  END IF;
END $$;

DELETE FROM "salespeople" WHERE "user_id" IS NULL;

ALTER TABLE "salespeople" ADD COLUMN "membership_id" UUID;

UPDATE "salespeople" s
SET "membership_id" = m."id"
FROM "memberships" m
WHERE m."organization_id" = s."organization_id" AND m."user_id" = s."user_id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "salespeople" WHERE "membership_id" IS NULL) THEN
    RAISE EXCEPTION 'Some salespeople sign in as someone who is not a member of their organization. Fix their login, then migrate again.';
  END IF;
END $$;

-- Their phone and name move to the member when the member has none.
UPDATE "memberships" m
SET "phone" = s."phone"
FROM "salespeople" s
WHERE s."membership_id" = m."id" AND m."phone" IS NULL AND s."phone" IS NOT NULL;

UPDATE "users" u
SET "name" = s."name"
FROM "salespeople" s
JOIN "memberships" m ON m."id" = s."membership_id"
WHERE m."user_id" = u."id" AND u."name" IS NULL;

ALTER TABLE "salespeople" ALTER COLUMN "membership_id" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_role_id_fkey";
ALTER TABLE "salespeople" DROP CONSTRAINT "salespeople_invitation_id_fkey";
ALTER TABLE "salespeople" DROP CONSTRAINT "salespeople_user_id_fkey";

-- DropIndex
DROP INDEX "invitations_role_id_idx";
DROP INDEX "salespeople_invitation_id_key";
DROP INDEX "salespeople_organization_id_name_key";
DROP INDEX "salespeople_organization_id_user_id_key";

-- AlterTable
ALTER TABLE "invitations" DROP COLUMN "name",
DROP COLUMN "phone",
DROP COLUMN "role_id";

ALTER TABLE "memberships" DROP COLUMN "name";

ALTER TABLE "salespeople" DROP COLUMN "email",
DROP COLUMN "invitation_id",
DROP COLUMN "name",
DROP COLUMN "phone",
DROP COLUMN "user_id";

-- CreateIndex
CREATE UNIQUE INDEX "salespeople_membership_id_key" ON "salespeople"("membership_id");

-- AddForeignKey
ALTER TABLE "salespeople" ADD CONSTRAINT "salespeople_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
