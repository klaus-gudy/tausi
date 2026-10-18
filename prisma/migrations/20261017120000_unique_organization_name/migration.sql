-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "name" SET DATA TYPE CITEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name") WHERE (deleted_at IS NULL);

