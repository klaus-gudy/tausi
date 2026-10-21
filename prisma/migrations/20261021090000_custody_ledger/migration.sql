-- Custody ledger: every stock movement now says who holds the stock (a
-- warehouse, a dispatch in transit, a salesperson or a super dealer), and the
-- documents behind the movements get tables of their own: supplier receipts,
-- dispatches to salespeople, sales to super dealers and dealer payments.

-- CreateEnum
CREATE TYPE "stock_holder" AS ENUM ('warehouse', 'in_transit', 'salesperson', 'super_dealer');

-- CreateEnum
CREATE TYPE "dispatch_status" AS ENUM ('in_transit', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "payment_terms" AS ENUM ('cash', 'credit');

-- The movement types are recreated rather than extended: values added with
-- ALTER TYPE ... ADD VALUE can't be used in the checks below until this
-- transaction commits. The old ledger check refers to the old type, so it goes
-- first and is rebuilt at the end.
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_quantity_check";
ALTER TYPE "stock_movement_type" RENAME TO "stock_movement_type_old";
CREATE TYPE "stock_movement_type" AS ENUM ('received', 'issued', 'dispatched', 'delivered', 'distributed', 'returned', 'adjustment', 'reversal');
ALTER TABLE "stock_movements" ALTER COLUMN "type" TYPE "stock_movement_type" USING "type"::text::"stock_movement_type";
DROP TYPE "stock_movement_type_old";

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

-- CreateTable
CREATE TABLE "dispatches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "number" CITEXT NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "salesperson_id" UUID NOT NULL,
    "region_key" TEXT NOT NULL,
    "status" "dispatch_status" NOT NULL DEFAULT 'in_transit',
    "carrier" TEXT,
    "note" TEXT,
    "dispatched_by_id" UUID NOT NULL,
    "dispatched_at" TIMESTAMPTZ NOT NULL,
    "received_by_id" UUID,
    "received_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "number" CITEXT NOT NULL,
    "salesperson_id" UUID NOT NULL,
    "super_dealer_id" UUID NOT NULL,
    "terms" "payment_terms" NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "due_on" DATE,
    "note" TEXT,
    "sold_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "super_dealer_id" UUID NOT NULL,
    "sale_id" UUID,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "collected_by_id" UUID NOT NULL,
    "received_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- AlterTable. holder is filled in below before it becomes NOT NULL; the
-- supplier moves to the receipts and is dropped at the end.
ALTER TABLE "stock_movements"
ADD COLUMN     "holder" "stock_holder",
ADD COLUMN     "unit_price" INTEGER,
ADD COLUMN     "warehouse_id" UUID,
ADD COLUMN     "salesperson_id" UUID,
ADD COLUMN     "transfer_id" UUID,
ADD COLUMN     "receipt_id" UUID,
ADD COLUMN     "dispatch_id" UUID,
ADD COLUMN     "sale_id" UUID;

-- CreateIndex
CREATE INDEX "stock_receipts_organization_id_received_on_idx" ON "stock_receipts"("organization_id", "received_on");

-- CreateIndex
CREATE INDEX "stock_receipts_warehouse_id_idx" ON "stock_receipts"("warehouse_id");

-- CreateIndex
CREATE INDEX "dispatches_organization_id_status_idx" ON "dispatches"("organization_id", "status");

-- CreateIndex
CREATE INDEX "dispatches_warehouse_id_idx" ON "dispatches"("warehouse_id");

-- CreateIndex
CREATE INDEX "dispatches_salesperson_id_idx" ON "dispatches"("salesperson_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_organization_id_number_key" ON "dispatches"("organization_id", "number");

-- CreateIndex
CREATE INDEX "sales_super_dealer_id_idx" ON "sales"("super_dealer_id");

-- CreateIndex
CREATE INDEX "sales_salesperson_id_idx" ON "sales"("salesperson_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_organization_id_number_key" ON "sales"("organization_id", "number");

-- CreateIndex
CREATE INDEX "payments_organization_id_received_on_idx" ON "payments"("organization_id", "received_on");

-- CreateIndex
CREATE INDEX "payments_super_dealer_id_idx" ON "payments"("super_dealer_id");

-- CreateIndex
CREATE INDEX "payments_sale_id_idx" ON "payments"("sale_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_holder_idx" ON "stock_movements"("organization_id", "holder");

-- CreateIndex
CREATE INDEX "stock_movements_warehouse_id_idx" ON "stock_movements"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_movements_salesperson_id_idx" ON "stock_movements"("salesperson_id");

-- CreateIndex
CREATE INDEX "stock_movements_transfer_id_idx" ON "stock_movements"("transfer_id");

-- CreateIndex
CREATE INDEX "stock_movements_receipt_id_idx" ON "stock_movements"("receipt_id");

-- CreateIndex
CREATE INDEX "stock_movements_dispatch_id_idx" ON "stock_movements"("dispatch_id");

-- CreateIndex
CREATE INDEX "stock_movements_sale_id_idx" ON "stock_movements"("sale_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "stock_receipts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_organization_id_region_key_fkey" FOREIGN KEY ("organization_id", "region_key") REFERENCES "regions"("organization_id", "key") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_dispatched_by_id_fkey" FOREIGN KEY ("dispatched_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_super_dealer_id_fkey" FOREIGN KEY ("super_dealer_id") REFERENCES "super_dealers"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_super_dealer_id_fkey" FOREIGN KEY ("super_dealer_id") REFERENCES "super_dealers"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill. Stock wasn't tracked per warehouse until now, so everything
-- recorded so far happened at the organization's first warehouse, made here
-- for organizations with stock history but no warehouse yet.
INSERT INTO "warehouses" ("organization_id", "name")
SELECT DISTINCT m."organization_id", 'Main warehouse'
FROM "stock_movements" m
WHERE NOT EXISTS (SELECT 1 FROM "warehouses" w WHERE w."organization_id" = m."organization_id");

UPDATE "stock_movements" m
SET "holder" = 'warehouse',
    "warehouse_id" = (
        SELECT w."id" FROM "warehouses" w
        WHERE w."organization_id" = m."organization_id"
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
-- is added: the same quantity with the opposite sign, sharing a transfer_id.
UPDATE "stock_movements" SET "transfer_id" = gen_random_uuid() WHERE "super_dealer_id" IS NOT NULL;

INSERT INTO "stock_movements" ("organization_id", "product_id", "type", "holder", "quantity", "super_dealer_id", "transfer_id", "reference", "note", "occurred_on", "created_by_id", "created_at")
SELECT "organization_id", "product_id", "type", 'super_dealer', -"quantity", "super_dealer_id", "transfer_id", "reference", "note", "occurred_on", "created_by_id", "created_at"
FROM "stock_movements"
WHERE "super_dealer_id" IS NOT NULL AND "holder" = 'warehouse';

-- A reversal's dealer side reverses the original's dealer side.
UPDATE "stock_movements" reversal
SET "reverses_id" = original_dealer."id"
FROM "stock_movements" reversal_store, "stock_movements" original_store, "stock_movements" original_dealer
WHERE reversal."type" = 'reversal' AND reversal."holder" = 'super_dealer'
    AND reversal_store."transfer_id" = reversal."transfer_id" AND reversal_store."holder" = 'warehouse'
    AND original_store."id" = reversal_store."reverses_id"
    AND original_dealer."transfer_id" = original_store."transfer_id" AND original_dealer."holder" = 'super_dealer';

ALTER TABLE "stock_movements" ALTER COLUMN "holder" SET NOT NULL;
ALTER TABLE "stock_movements" DROP COLUMN "supplier";

-- Ledger rules Prisma can't express: no empty movements; receipts add to a
-- warehouse and name their receipt; issues name the dealer and pair up;
-- dispatch and sale movements name their document.
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_check" CHECK (
    "quantity" <> 0
    AND ("type" <> 'received' OR ("quantity" > 0 AND "holder" = 'warehouse' AND "receipt_id" IS NOT NULL))
    AND ("type" <> 'issued' OR ("super_dealer_id" IS NOT NULL AND "transfer_id" IS NOT NULL))
    AND ("type" NOT IN ('dispatched', 'delivered') OR "dispatch_id" IS NOT NULL)
    AND ("type" <> 'distributed' OR "sale_id" IS NOT NULL)
    AND ("type" = 'reversal') = ("reverses_id" IS NOT NULL)
);

-- The holder's own id is always set.
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_holder_check" CHECK (
    ("holder" <> 'warehouse' OR "warehouse_id" IS NOT NULL)
    AND ("holder" <> 'in_transit' OR "dispatch_id" IS NOT NULL)
    AND ("holder" <> 'salesperson' OR "salesperson_id" IS NOT NULL)
    AND ("holder" <> 'super_dealer' OR "super_dealer_id" IS NOT NULL)
);

-- A dispatch is received exactly when it has been acknowledged.
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_received_check" CHECK (
    ("status" = 'received') = ("received_at" IS NOT NULL)
);

-- Only credit sales have a due date.
ALTER TABLE "sales" ADD CONSTRAINT "sales_amount_check" CHECK (
    "total_amount" >= 0 AND ("terms" = 'credit' OR "due_on" IS NULL)
);

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK (
    "amount" <> 0 AND "method" IN ('cash', 'mobile_money', 'bank')
);
