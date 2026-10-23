-- Stock entries say what a warehouse holds, so the rough capacity estimate
-- isn't kept any more. Its check constraints go with the columns.
ALTER TABLE "warehouses" DROP COLUMN "capacity", DROP COLUMN "capacity_unit";
