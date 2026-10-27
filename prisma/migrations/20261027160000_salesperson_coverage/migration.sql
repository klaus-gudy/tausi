-- A salesperson can cover a zone, a region or a district. Only the smallest
-- place picked is stored; the larger ones follow from it. Existing zones stay.
ALTER TABLE "salespeople" ADD COLUMN "district_id" UUID,
ADD COLUMN "region_key" TEXT;

ALTER TABLE "salespeople" ADD CONSTRAINT "salespeople_one_coverage"
CHECK (num_nonnulls("zone_key", "region_key", "district_id") <= 1);

-- CreateIndex
CREATE INDEX "salespeople_organization_id_region_key_idx" ON "salespeople"("organization_id", "region_key");
CREATE INDEX "salespeople_district_id_idx" ON "salespeople"("district_id");

-- AddForeignKey
ALTER TABLE "salespeople" ADD CONSTRAINT "salespeople_organization_id_region_key_fkey" FOREIGN KEY ("organization_id", "region_key") REFERENCES "regions"("organization_id", "key") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "salespeople" ADD CONSTRAINT "salespeople_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
