-- Custody ledger: every stock movement now says who holds the stock (a
-- warehouse or a super dealer), supplier deliveries get a receipts table of
-- their own, and transfers to salespeople leave from a named warehouse.

-- CreateEnum
CREATE TYPE "stock_holder" AS ENUM ('warehouse', 'super_dealer');

-- The ledger check is rebuilt at the end, once the new columns are filled.
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_quantity_check";

-- CreateTable
CREATE TABLE "stock_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "supplier_name" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "received_on" DATE NOT NULL,
    "received_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_receipts_pkey" PRIMARY KEY ("id")
);

-- AlterTable. holder and the transfers' warehouse_id are filled in below
-- before they become NOT NULL; the supplier moves to the receipts and is
-- dropped at the end.
ALTER TABLE "stock_movements"
ADD COLUMN     "holder" "stock_holder",
ADD COLUMN     "warehouse_id" UUID,
ADD COLUMN     "move_id" UUID,
ADD COLUMN     "receipt_id" UUID;

ALTER TABLE "stock_transfers" ADD COLUMN "warehouse_id" UUID;

-- CreateIndex
CREATE INDEX "stock_receipts_organization_id_received_on_idx" ON "stock_receipts"("organization_id", "received_on");

-- CreateIndex
CREATE INDEX "stock_receipts_warehouse_id_idx" ON "stock_receipts"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_holder_idx" ON "stock_movements"("organization_id", "holder");

-- CreateIndex
CREATE INDEX "stock_movements_warehouse_id_idx" ON "stock_movements"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_movements_move_id_idx" ON "stock_movements"("move_id");

-- CreateIndex
CREATE INDEX "stock_movements_receipt_id_idx" ON "stock_movements"("receipt_id");

-- CreateIndex
CREATE INDEX "stock_transfers_warehouse_id_idx" ON "stock_transfers"("warehouse_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "stock_receipts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Backfill. Stock wasn't tracked per warehouse until now, so everything
-- recorded so far happened at the organization's first warehouse, made here
-- for organizations with stock history but no warehouse yet.
INSERT INTO "warehouses" ("organization_id", "name")
SELECT DISTINCT used."organization_id", 'Main warehouse'
FROM (
    SELECT "organization_id" FROM "stock_movements"
    UNION
    SELECT "organization_id" FROM "stock_transfers"
) used
WHERE NOT EXISTS (SELECT 1 FROM "warehouses" w WHERE w."organization_id" = used."organization_id");

UPDATE "stock_movements" m
SET "holder" = 'warehouse',
    "warehouse_id" = (
        SELECT w."id" FROM "warehouses" w
        WHERE w."organization_id" = m."organization_id"
        ORDER BY w."created_at", w."id"
        LIMIT 1
    );

UPDATE "stock_transfers" t
SET "warehouse_id" = (
    SELECT w."id" FROM "warehouses" w
    WHERE w."organization_id" = t."organization_id"
    ORDER BY w."created_at", w."id"
    LIMIT 1
);

-- One receipt per delivery recorded: the rows of one receive form were
-- inserted together, so they share their details and created_at.
INSERT INTO "stock_receipts" ("organization_id", "warehouse_id", "supplier_name", "reference", "note", "received_on", "received_by_id", "created_at")
SELECT DISTINCT "organization_id", "warehouse_id", "supplier", "reference", "note", "occurred_on", "created_by_id", "created_at"
FROM "stock_movements"
WHERE "type" = 'received';

UPDATE "stock_movements" m
SET "receipt_id" = r."id", "reference" = NULL, "note" = NULL
FROM "stock_receipts" r
WHERE m."type" = 'received'
    AND r."organization_id" = m."organization_id"
    AND r."warehouse_id" = m."warehouse_id"
    AND r."supplier_name" IS NOT DISTINCT FROM m."supplier"
    AND r."reference" IS NOT DISTINCT FROM m."reference"
    AND r."note" IS NOT DISTINCT FROM m."note"
    AND r."received_on" = m."occurred_on"
    AND r."received_by_id" IS NOT DISTINCT FROM m."created_by_id"
    AND r."created_at" = m."created_at";

-- Issues (and their reversals) were one row taking stock out of the store.
-- That row stays as the warehouse's side of the move, and the dealer's side
-- is added: the same quantity with the opposite sign, sharing a move_id.
UPDATE "stock_movements" SET "move_id" = gen_random_uuid() WHERE "super_dealer_id" IS NOT NULL;

INSERT INTO "stock_movements" ("organization_id", "product_id", "type", "holder", "quantity", "super_dealer_id", "move_id", "reference", "note", "occurred_on", "created_by_id", "created_at")
SELECT "organization_id", "product_id", "type", 'super_dealer', -"quantity", "super_dealer_id", "move_id", "reference", "note", "occurred_on", "created_by_id", "created_at"
FROM "stock_movements"
WHERE "super_dealer_id" IS NOT NULL AND "holder" = 'warehouse';

-- A reversal's dealer side reverses the original's dealer side.
UPDATE "stock_movements" reversal
SET "reverses_id" = original_dealer."id"
FROM "stock_movements" reversal_store, "stock_movements" original_store, "stock_movements" original_dealer
WHERE reversal."type" = 'reversal' AND reversal."holder" = 'super_dealer'
    AND reversal_store."move_id" = reversal."move_id" AND reversal_store."holder" = 'warehouse'
    AND original_store."id" = reversal_store."reverses_id"
    AND original_dealer."move_id" = original_store."move_id" AND original_dealer."holder" = 'super_dealer';

ALTER TABLE "stock_movements" ALTER COLUMN "holder" SET NOT NULL;
ALTER TABLE "stock_movements" DROP COLUMN "supplier";
ALTER TABLE "stock_transfers" ALTER COLUMN "warehouse_id" SET NOT NULL;

-- Ledger rules Prisma can't express: no empty movements; receipts add to a
-- warehouse and name their receipt; issues name the dealer and pair up;
-- transfers take stock out of a warehouse and name their transfer, and only
-- transfers and their reversals carry one.
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_check" CHECK (
    "quantity" <> 0
    AND ("type" <> 'received' OR ("quantity" > 0 AND "holder" = 'warehouse' AND "receipt_id" IS NOT NULL))
    AND ("type" <> 'issued' OR ("super_dealer_id" IS NOT NULL AND "move_id" IS NOT NULL))
    AND ("type" <> 'transferred' OR ("quantity" < 0 AND "holder" = 'warehouse' AND "transfer_id" IS NOT NULL))
    AND ("transfer_id" IS NULL OR "type" IN ('transferred', 'reversal'))
    AND ("type" = 'reversal') = ("reverses_id" IS NOT NULL)
);

-- The holder's own id is always set.
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_holder_check" CHECK (
    ("holder" <> 'warehouse' OR "warehouse_id" IS NOT NULL)
    AND ("holder" <> 'super_dealer' OR "super_dealer_id" IS NOT NULL)
);
