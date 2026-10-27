-- Suppliers get a table of their own and every receipt points at one. Each
-- organization starts with "Manufactured", which receipts recorded without a
-- supplier are filed under; names already typed on receipts become suppliers.

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organization_id_name_key" ON "suppliers"("organization_id", "name");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "suppliers" ("organization_id", "name")
SELECT "id", 'Manufactured' FROM "organizations";

-- Names differing only in case become one supplier.
INSERT INTO "suppliers" ("organization_id", "name")
SELECT DISTINCT "organization_id", btrim("supplier_name")::CITEXT
FROM "stock_receipts"
WHERE btrim(coalesce("supplier_name", '')) <> ''
ON CONFLICT DO NOTHING;

-- AlterTable
ALTER TABLE "stock_receipts" ADD COLUMN "supplier_id" UUID;

UPDATE "stock_receipts" r
SET "supplier_id" = s."id"
FROM "suppliers" s
WHERE s."organization_id" = r."organization_id"
  AND s."name" = coalesce(nullif(btrim(r."supplier_name"), ''), 'Manufactured')::CITEXT;

ALTER TABLE "stock_receipts" ALTER COLUMN "supplier_id" SET NOT NULL;
ALTER TABLE "stock_receipts" DROP COLUMN "supplier_name";

-- CreateIndex
CREATE INDEX "stock_receipts_supplier_id_idx" ON "stock_receipts"("supplier_id");

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
