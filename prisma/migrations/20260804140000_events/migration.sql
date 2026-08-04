-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventExpense" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventProduct" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventProduct_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "eventId" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "unitCost" DECIMAL(12,2);

-- Seed Bienal event and backfill existing rows
INSERT INTO "Event" ("id", "name", "startDate", "endDate", "createdAt", "updatedAt")
VALUES (
  'event_bienal_2026',
  'Bienal de Esculturas de Resistencia',
  DATE '2026-07-17',
  DATE '2026-07-26',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "EventExpense" ("id", "eventId", "amount", "description", "date", "createdAt", "updatedAt")
VALUES (
  'expense_bienal_alquiler',
  'event_bienal_2026',
  2500000.00,
  'Alquiler',
  DATE '2026-07-17',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "EventProduct" ("id", "eventId", "productId", "cost", "price", "createdAt", "updatedAt")
SELECT
  'ep_' || p."id",
  'event_bienal_2026',
  p."id",
  ROUND(p."defaultPrice" * 0.4, 2),
  p."defaultPrice",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" p;

UPDATE "Sale" SET "eventId" = 'event_bienal_2026' WHERE "eventId" IS NULL;

UPDATE "SaleItem" si
SET "unitCost" = ROUND(si."unitPrice" * 0.4, 2)
WHERE si."unitCost" IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE "Sale" ALTER COLUMN "eventId" SET NOT NULL;
ALTER TABLE "SaleItem" ALTER COLUMN "unitCost" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Event_startDate_endDate_idx" ON "Event"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "EventExpense_eventId_date_idx" ON "EventExpense"("eventId", "date");

-- CreateIndex
CREATE INDEX "EventProduct_eventId_idx" ON "EventProduct"("eventId");

-- CreateIndex
CREATE INDEX "EventProduct_productId_idx" ON "EventProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "EventProduct_eventId_productId_key" ON "EventProduct"("eventId", "productId");

-- CreateIndex
CREATE INDEX "Sale_eventId_createdAt_idx" ON "Sale"("eventId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "EventExpense" ADD CONSTRAINT "EventExpense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventProduct" ADD CONSTRAINT "EventProduct_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventProduct" ADD CONSTRAINT "EventProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
