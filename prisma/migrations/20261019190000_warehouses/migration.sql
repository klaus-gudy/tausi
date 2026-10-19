-- Warehouses: where the organization keeps its stock. A name, a place picked
-- from the zone/region/district lists, a rough capacity and who to call.
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "region_key" TEXT,
    "district_key" TEXT,
    "address" TEXT,
    "capacity" INTEGER,
    "capacity_unit" TEXT NOT NULL DEFAULT 'units',
    "contact_name" TEXT,
    "phone" TEXT,
    "deactivated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "warehouses_capacity_check" CHECK ("capacity" IS NULL OR "capacity" > 0),
    CONSTRAINT "warehouses_capacity_unit_check" CHECK (
        "capacity_unit" IN ('units', 'cartons', 'pallets', 'tonnes', 'sqm')
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_organization_id_name_key" ON "warehouses"("organization_id", "name");

-- CreateIndex
CREATE INDEX "warehouses_organization_id_region_key_idx" ON "warehouses"("organization_id", "region_key");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A warehouse's region and district must be its own organization's, and the
-- district in that region. NO ACTION, not RESTRICT, so deleting an
-- organization cascades to its places and warehouses together. With MATCH
-- SIMPLE a warehouse without a region or district isn't checked.
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_region_key_fkey" FOREIGN KEY ("organization_id", "region_key") REFERENCES "regions"("organization_id", "key") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_region_key_district_key_fkey" FOREIGN KEY ("organization_id", "region_key", "district_key") REFERENCES "districts"("organization_id", "region_key", "key") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Seed: warehouse permissions. Owners and admins manage them; members and
-- viewers only look.
INSERT INTO "permissions" ("key", "description") VALUES
    ('warehouses.read',   'See warehouses'),
    ('warehouses.manage', 'Add, edit and deactivate warehouses');

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", p."key"
FROM "roles" r
JOIN "permissions" p ON p."key" IN ('warehouses.read', 'warehouses.manage') AND (
    r."key" IN ('owner', 'admin')
    OR (r."key" IN ('member', 'viewer') AND p."key" = 'warehouses.read')
)
WHERE r."organization_id" IS NULL;
