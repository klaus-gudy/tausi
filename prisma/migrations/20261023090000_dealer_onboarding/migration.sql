-- Dealer onboarding: dealers don't sign in, so a salesperson visits them,
-- takes their details and has them sign on the salesperson's screen.

-- AlterTable
ALTER TABLE "super_dealers" ADD COLUMN     "business_licence" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "onboarded_by_id" UUID,
ADD COLUMN     "signature" BYTEA,
ADD COLUMN     "signed_at" TIMESTAMPTZ,
ADD COLUMN     "signed_by_name" TEXT,
ADD COLUMN     "tin" TEXT;

-- AddForeignKey
ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_onboarded_by_id_fkey" FOREIGN KEY ("onboarded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A signature comes with the signer's name and time; a location has both
-- coordinates, inside their ranges; a TIN is nine digits as 123-456-789.
ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_onboarding_check" CHECK (
    ("signature" IS NULL) = ("signed_by_name" IS NULL)
    AND ("signature" IS NULL) = ("signed_at" IS NULL)
    AND ("latitude" IS NULL) = ("longitude" IS NULL)
    AND ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180))
    AND ("tin" IS NULL OR "tin" ~ '^\d{3}-\d{3}-\d{3}$')
);

-- Seed: salespeople onboard dealers in the field; owners and admins can too.
INSERT INTO "permissions" ("key", "description") VALUES
    ('dealers.onboard', 'Sign up new super dealers in person, with their signature');

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", 'dealers.onboard'
FROM "roles" r
WHERE r."organization_id" IS NULL AND r."key" IN ('owner', 'admin', 'salesperson');
