-- Paged lists read newest first, so their indexes hold the sort order:
-- movement history and the deliveries list (everyone's or one salesperson's)
-- read a page without sorting the whole history.

-- DropIndex
DROP INDEX "deliveries_salesperson_id_idx";

-- DropIndex
DROP INDEX "stock_movements_organization_id_holder_idx";

-- CreateIndex
CREATE INDEX "deliveries_organization_id_delivered_on_number_idx" ON "deliveries"("organization_id", "delivered_on" DESC, "number" DESC);

-- CreateIndex
CREATE INDEX "deliveries_salesperson_id_delivered_on_number_idx" ON "deliveries"("salesperson_id", "delivered_on" DESC, "number" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_holder_created_at_id_idx" ON "stock_movements"("organization_id", "holder", "created_at" DESC, "id" DESC);
