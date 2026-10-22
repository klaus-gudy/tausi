-- Stock transfers: the storekeeper sends stock from the store to a
-- salesperson. Initiating one takes the stock off hand ("transferred"
-- movements); it is then marked in transit and, when it gets there, arrived.

-- CreateEnum
CREATE TYPE "stock_transfer_status" AS ENUM ('initiated', 'in_transit', 'arrived', 'cancelled');

-- AlterEnum
ALTER TYPE "stock_movement_type" ADD VALUE 'transferred';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "transfer_id" UUID;

-- CreateTable
CREATE TABLE "salespeople" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "phone" TEXT,
    "email" CITEXT,
    "zone_key" TEXT,
    "notes" TEXT,
    "deactivated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salespeople_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "salesperson_id" UUID NOT NULL,
    "status" "stock_transfer_status" NOT NULL DEFAULT 'initiated',
    "reference" TEXT,
    "note" TEXT,
    "initiated_on" DATE NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ,
    "dispatched_by_id" UUID,
    "arrived_at" TIMESTAMPTZ,
    "arrived_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ,
    "cancelled_by_id" UUID,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salespeople_organization_id_name_key" ON "salespeople"("organization_id", "name");

-- CreateIndex
CREATE INDEX "stock_transfers_organization_id_status_idx" ON "stock_transfers"("organization_id", "status");

-- CreateIndex
CREATE INDEX "stock_transfers_salesperson_id_idx" ON "stock_transfers"("salesperson_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_organization_id_number_key" ON "stock_transfers"("organization_id", "number");

-- CreateIndex
CREATE INDEX "stock_movements_transfer_id_idx" ON "stock_movements"("transfer_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salespeople" ADD CONSTRAINT "salespeople_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salespeople" ADD CONSTRAINT "salespeople_zone_key_fkey" FOREIGN KEY ("zone_key") REFERENCES "zones"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "salespeople"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_dispatched_by_id_fkey" FOREIGN KEY ("dispatched_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_arrived_by_id_fkey" FOREIGN KEY ("arrived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Ledger rules, now with transfers: a transferred movement removes stock and
-- names its transfer; only transfers and their reversals carry one. The new
-- enum value can't be used in the transaction that adds it, so the type is
-- compared as text.
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_quantity_check";
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_check" CHECK (
    "quantity" <> 0
    AND ("type"::text <> 'received' OR "quantity" > 0)
    AND ("type"::text <> 'issued' OR ("quantity" < 0 AND "super_dealer_id" IS NOT NULL))
    AND ("type"::text <> 'transferred' OR ("quantity" < 0 AND "transfer_id" IS NOT NULL))
    AND ("transfer_id" IS NULL OR "type"::text IN ('transferred', 'reversal'))
    AND ("type"::text = 'reversal') = ("reverses_id" IS NOT NULL)
);

-- A transfer's status matches the steps recorded for it, in order.
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_status_check" CHECK (
    "number" > 0
    AND ("status" <> 'in_transit' OR "dispatched_at" IS NOT NULL)
    AND ("status" <> 'arrived' OR ("dispatched_at" IS NOT NULL AND "arrived_at" IS NOT NULL))
    AND ("status" <> 'cancelled' OR ("cancelled_at" IS NOT NULL AND "dispatched_at" IS NULL))
);

-- Seed: permissions for salespeople and transfers.
INSERT INTO "permissions" ("key", "description") VALUES
    ('salespeople.read',   'See salespeople'),
    ('salespeople.manage', 'Add, edit and deactivate salespeople'),
    ('stock.transfer',     'Send stock to salespeople and update it until it arrives');

-- Seed: a storekeeper role. Storekeepers receive stock into the store and
-- send it to salespeople; they don't issue to dealers or correct counts.
INSERT INTO "roles" ("key", "name", "description", "is_system") VALUES
    ('storekeeper', 'Storekeeper', 'Receives stock and sends it to salespeople', true);

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", p."key"
FROM "roles" r
JOIN "permissions" p ON
    (r."key" IN ('owner', 'admin') AND p."key" IN ('salespeople.read', 'salespeople.manage', 'stock.transfer'))
    OR (r."key" = 'member' AND p."key" IN ('salespeople.read', 'stock.transfer'))
    OR (r."key" = 'viewer' AND p."key" = 'salespeople.read')
    OR (r."key" = 'storekeeper' AND p."key" IN (
        'members.read', 'products.read', 'dealers.read', 'salespeople.read',
        'stock.read', 'stock.receive', 'stock.transfer'
    ))
WHERE r."organization_id" IS NULL;
