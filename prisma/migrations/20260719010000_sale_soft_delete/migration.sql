-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Sale_deletedAt_createdAt_idx" ON "Sale"("deletedAt", "createdAt" DESC);
