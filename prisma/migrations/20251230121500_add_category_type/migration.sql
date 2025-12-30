-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('OPERATIONAL', 'ADMINISTRATIVE');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "type" "CategoryType" NOT NULL DEFAULT 'OPERATIONAL';

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_type_name_key" ON "Category"("organizationId", "type", "name");

