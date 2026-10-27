-- A place is stored as its district alone: every district is in one region,
-- every region in one zone, so those follow from it.

-- A region without a district can't be kept that way; stop rather than lose it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "warehouses" WHERE "region_key" IS NOT NULL AND "district_key" IS NULL)
    OR EXISTS (SELECT 1 FROM "super_dealers" WHERE "region_key" IS NOT NULL AND "district_key" IS NULL) THEN
    RAISE EXCEPTION 'Some warehouses or super dealers have a region but no district. Pick their district, then migrate again.';
  END IF;
END $$;

-- Districts get an id of their own to point at; their keys stay unique
-- within a region for the place pickers.
ALTER TABLE "districts" ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "districts_organization_id_region_key_key_key" ON "districts"("organization_id", "region_key", "key");

ALTER TABLE "warehouses" ADD COLUMN "district_id" UUID;
ALTER TABLE "super_dealers" ADD COLUMN "district_id" UUID;

UPDATE "warehouses" w
SET "district_id" = d."id"
FROM "districts" d
WHERE d."organization_id" = w."organization_id" AND d."region_key" = w."region_key" AND d."key" = w."district_key";

UPDATE "super_dealers" s
SET "district_id" = d."id"
FROM "districts" d
WHERE d."organization_id" = s."organization_id" AND d."region_key" = s."region_key" AND d."key" = s."district_key";

-- DropForeignKey
ALTER TABLE "super_dealers" DROP CONSTRAINT "super_dealers_organization_id_region_key_district_key_fkey";
ALTER TABLE "super_dealers" DROP CONSTRAINT "super_dealers_organization_id_region_key_fkey";
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_organization_id_region_key_district_key_fkey";
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_organization_id_region_key_fkey";

-- DropIndex
DROP INDEX "super_dealers_organization_id_region_key_idx";
DROP INDEX "warehouses_organization_id_region_key_idx";

-- AlterTable
ALTER TABLE "super_dealers" DROP COLUMN "district_key", DROP COLUMN "region_key";
ALTER TABLE "warehouses" DROP COLUMN "district_key", DROP COLUMN "region_key";

-- Nothing leans on the old key any more, so the id takes its place.
ALTER TABLE "districts" DROP CONSTRAINT "districts_pkey",
ADD CONSTRAINT "districts_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "super_dealers_district_id_idx" ON "super_dealers"("district_id");
CREATE INDEX "warehouses_district_id_idx" ON "warehouses"("district_id");

-- AddForeignKey
ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
