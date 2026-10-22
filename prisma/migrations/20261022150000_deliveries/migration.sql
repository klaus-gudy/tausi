-- Salespeople sign in: each can be linked to a member's login. They
-- acknowledge the transfers they receive, and supply what they hold to super
-- dealers as deliveries.

-- AlterTable
ALTER TABLE "salespeople" ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "stock_transfers" ADD COLUMN     "acknowledged_at" TIMESTAMPTZ,
ADD COLUMN     "acknowledged_by_id" UUID;

-- CreateTable
CREATE TABLE "deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "salesperson_id" UUID NOT NULL,
    "super_dealer_id" UUID NOT NULL,
    "delivered_on" DATE NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "delivery_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "delivery_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deliveries_salesperson_id_idx" ON "deliveries"("salesperson_id");

-- CreateIndex
CREATE INDEX "deliveries_super_dealer_id_idx" ON "deliveries"("super_dealer_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_organization_id_number_key" ON "deliveries"("organization_id", "number");

-- CreateIndex
CREATE INDEX "delivery_lines_product_id_idx" ON "delivery_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_lines_delivery_id_product_id_key" ON "delivery_lines"("delivery_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "salespeople_organization_id_user_id_key" ON "salespeople"("organization_id", "user_id");

-- AddForeignKey
ALTER TABLE "salespeople" ADD CONSTRAINT "salespeople_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "salespeople"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_super_dealer_id_fkey" FOREIGN KEY ("super_dealer_id") REFERENCES "super_dealers"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


-- Only a transfer that got there can be acknowledged.
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_acknowledged_check" CHECK (
    "acknowledged_at" IS NULL OR ("status" = 'arrived' AND "arrived_at" IS NOT NULL)
);

ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_number_check" CHECK ("number" > 0);
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_quantity_check" CHECK ("quantity" > 0);

-- Seed: delivery permissions and a salesperson role. Salespeople see products
-- and dealers, acknowledge their transfers and record their deliveries; they
-- don't see the store's stock.
INSERT INTO "permissions" ("key", "description") VALUES
    ('deliveries.read',   'See every salesperson''s deliveries to super dealers'),
    ('deliveries.record', 'Acknowledge stock sent to you and supply it to super dealers');

INSERT INTO "roles" ("key", "name", "description", "is_system") VALUES
    ('salesperson', 'Salesperson', 'Receives stock from the store and supplies super dealers', true);

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", p."key"
FROM "roles" r
JOIN "permissions" p ON
    (r."key" IN ('owner', 'admin') AND p."key" IN ('deliveries.read', 'deliveries.record'))
    OR (r."key" IN ('member', 'viewer') AND p."key" = 'deliveries.read')
    OR (r."key" = 'salesperson' AND p."key" IN (
        'members.read', 'products.read', 'dealers.read', 'deliveries.record'
    ))
WHERE r."organization_id" IS NULL;
