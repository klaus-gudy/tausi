-- CreateEnum
CREATE TYPE "stock_movement_type" AS ENUM ('received', 'issued', 'adjustment', 'reversal');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "sku" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "price" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_dealers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" CITEXT,
    "region" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "deactivated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_dealers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "stock_movement_type" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" INTEGER,
    "super_dealer_id" UUID,
    "supplier" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "occurred_on" DATE NOT NULL,
    "reverses_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_sku_key" ON "products"("organization_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "super_dealers_organization_id_name_key" ON "super_dealers"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_reverses_id_key" ON "stock_movements"("reverses_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_occurred_on_idx" ON "stock_movements"("organization_id", "occurred_on");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_idx" ON "stock_movements"("product_id");

-- CreateIndex
CREATE INDEX "stock_movements_super_dealer_id_idx" ON "stock_movements"("super_dealer_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_super_dealer_id_fkey" FOREIGN KEY ("super_dealer_id") REFERENCES "super_dealers"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "stock_movements"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ledger rules Prisma can't express: no empty movements, receipts add,
-- issues remove and name the dealer.
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_check" CHECK (
    "quantity" <> 0
    AND ("type" <> 'received' OR "quantity" > 0)
    AND ("type" <> 'issued' OR ("quantity" < 0 AND "super_dealer_id" IS NOT NULL))
    AND ("type" = 'reversal') = ("reverses_id" IS NOT NULL)
);

-- Seed: inventory permissions. Owners and admins get all of them; members
-- record receipts and issues; viewers only look.
INSERT INTO "permissions" ("key", "description") VALUES
    ('products.read',    'See products and stock on hand'),
    ('products.manage',  'Add, edit and archive products'),
    ('dealers.read',     'See super dealers'),
    ('dealers.manage',   'Add, edit and deactivate super dealers'),
    ('stock.read',       'See stock movements'),
    ('stock.receive',    'Record stock received from suppliers'),
    ('stock.issue',      'Record stock issued to super dealers'),
    ('stock.adjust',     'Correct stock after a count and reverse movements');

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", p."key"
FROM "roles" r
JOIN "permissions" p ON p."key" IN (
    'products.read', 'products.manage', 'dealers.read', 'dealers.manage',
    'stock.read', 'stock.receive', 'stock.issue', 'stock.adjust'
) AND (
    r."key" IN ('owner', 'admin')
    OR (r."key" = 'member' AND p."key" IN ('products.read', 'dealers.read', 'stock.read', 'stock.receive', 'stock.issue'))
    OR (r."key" = 'viewer' AND p."key" IN ('products.read', 'dealers.read', 'stock.read'))
)
WHERE r."organization_id" IS NULL;
