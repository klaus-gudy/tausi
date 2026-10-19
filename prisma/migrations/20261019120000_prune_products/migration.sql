-- Products keep only a code, name, size and selling price, plus who created
-- and last changed them. Renames keep existing values.
ALTER TABLE "products" RENAME COLUMN "sku" TO "code";
ALTER TABLE "products" RENAME COLUMN "price" TO "selling_price";
ALTER INDEX "products_organization_id_sku_key" RENAME TO "products_organization_id_code_key";

ALTER TABLE "products"
    DROP COLUMN "unit",
    DROP COLUMN "reorder_level",
    ADD COLUMN "size" TEXT,
    ADD COLUMN "created_by_id" UUID,
    ADD COLUMN "updated_by_id" UUID;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
