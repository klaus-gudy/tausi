-- Places become each organization's own: a new organization can start from
-- Tanzania's list (lib/tanzania-places.ts) and change it without touching
-- anyone else's. Every existing organization gets a copy of the shared list,
-- so its dealers keep their region and district.

-- DropForeignKey
ALTER TABLE "super_dealers" DROP CONSTRAINT "super_dealers_region_key_fkey";
ALTER TABLE "super_dealers" DROP CONSTRAINT "super_dealers_region_key_district_key_fkey";
ALTER TABLE "regions" DROP CONSTRAINT "regions_zone_key_fkey";
ALTER TABLE "districts" DROP CONSTRAINT "districts_region_key_fkey";

-- DropIndex
DROP INDEX "super_dealers_region_key_idx";
DROP INDEX "regions_zone_key_idx";

-- The keys are unique per organization from here on.
ALTER TABLE "zones" DROP CONSTRAINT "zones_pkey", ADD COLUMN "organization_id" UUID;
ALTER TABLE "regions" DROP CONSTRAINT "regions_pkey", ADD COLUMN "organization_id" UUID;
ALTER TABLE "districts" DROP CONSTRAINT "districts_pkey", ADD COLUMN "organization_id" UUID;

-- Copy the shared rows to every organization, then drop the shared ones.
INSERT INTO "zones" ("organization_id", "key", "name", "position")
SELECT o."id", z."key", z."name", z."position"
FROM "organizations" o CROSS JOIN "zones" z
WHERE z."organization_id" IS NULL;

INSERT INTO "regions" ("organization_id", "key", "zone_key", "name")
SELECT o."id", r."key", r."zone_key", r."name"
FROM "organizations" o CROSS JOIN "regions" r
WHERE r."organization_id" IS NULL;

INSERT INTO "districts" ("organization_id", "region_key", "key", "name")
SELECT o."id", d."region_key", d."key", d."name"
FROM "organizations" o CROSS JOIN "districts" d
WHERE d."organization_id" IS NULL;

DELETE FROM "districts" WHERE "organization_id" IS NULL;
DELETE FROM "regions" WHERE "organization_id" IS NULL;
DELETE FROM "zones" WHERE "organization_id" IS NULL;

ALTER TABLE "zones" ALTER COLUMN "organization_id" SET NOT NULL,
    ADD CONSTRAINT "zones_pkey" PRIMARY KEY ("organization_id", "key");
ALTER TABLE "regions" ALTER COLUMN "organization_id" SET NOT NULL,
    ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("organization_id", "key");
ALTER TABLE "districts" ALTER COLUMN "organization_id" SET NOT NULL,
    ADD CONSTRAINT "districts_pkey" PRIMARY KEY ("organization_id", "region_key", "key");

-- CreateIndex
CREATE INDEX "regions_organization_id_zone_key_idx" ON "regions"("organization_id", "zone_key");
CREATE INDEX "super_dealers_organization_id_region_key_idx" ON "super_dealers"("organization_id", "region_key");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "regions" ADD CONSTRAINT "regions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "districts" ADD CONSTRAINT "districts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NO ACTION rather than RESTRICT: deleting an organization cascades to its
-- places and dealers together, and NO ACTION checks only once that's done.
ALTER TABLE "regions" ADD CONSTRAINT "regions_organization_id_zone_key_fkey" FOREIGN KEY ("organization_id", "zone_key") REFERENCES "zones"("organization_id", "key") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "districts" ADD CONSTRAINT "districts_organization_id_region_key_fkey" FOREIGN KEY ("organization_id", "region_key") REFERENCES "regions"("organization_id", "key") ON DELETE NO ACTION ON UPDATE CASCADE;

-- A dealer's region and district must be its own organization's. With MATCH
-- SIMPLE a dealer without a region or district isn't checked.
ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_organization_id_region_key_fkey" FOREIGN KEY ("organization_id", "region_key") REFERENCES "regions"("organization_id", "key") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_organization_id_region_key_district_key_fkey" FOREIGN KEY ("organization_id", "region_key", "district_key") REFERENCES "districts"("organization_id", "region_key", "key") ON DELETE NO ACTION ON UPDATE CASCADE;
