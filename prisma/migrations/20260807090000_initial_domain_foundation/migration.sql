-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PropertyRole" AS ENUM ('OWNER', 'MANAGER', 'EMPLOYEE', 'VIEWER');

-- CreateEnum
CREATE TYPE "AreaType" AS ENUM ('FIELD', 'PASTURE', 'VEGETABLE_GARDEN', 'ORCHARD', 'GREENHOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('SEED', 'FERTILIZER', 'PESTICIDE', 'FUEL', 'FEED', 'PART', 'TOOL', 'OTHER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('WEB', 'WHATSAPP', 'SYSTEM', 'API');

-- CreateEnum
CREATE TYPE "FarmRecordType" AS ENUM ('SPRAYING', 'PLANTING', 'HARVEST', 'PURCHASE', 'STOCK_ENTRY', 'MAINTENANCE', 'INSPECTION', 'PAYMENT', 'NOTE');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMember" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PropertyRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PropertyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "type" "AreaType" NOT NULL,
    "size" DECIMAL(14,4),
    "sizeUnit" TEXT,
    "note" TEXT,
    "currentCrop" TEXT,
    "harvest" TEXT,
    "soilType" TEXT,
    "irrigation" TEXT,
    "estimatedProductivity" DECIMAL(14,4),
    "productivityUnit" TEXT,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaAlias" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AreaAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockProduct" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "minimumStock" DECIMAL(18,4),
    "storageLocation" TEXT,
    "note" TEXT,
    "supplier" TEXT,
    "unitValue" DECIMAL(18,4),
    "expirationDate" DATE,
    "batchNumber" TEXT,
    "purchaseDate" DATE,
    "technicalNote" TEXT,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StockProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAlias" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "areaId" TEXT,
    "farmRecordId" TEXT,
    "type" "StockMovementType" NOT NULL,
    "quantityChange" DECIMAL(18,4) NOT NULL,
    "unitSnapshot" TEXT NOT NULL,
    "balanceBefore" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "createdByUserId" TEXT,
    "performedByUserId" TEXT,
    "source" "RecordSource" NOT NULL DEFAULT 'WEB',
    "reason" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversesMovementId" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmRecord" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "areaId" TEXT,
    "productId" TEXT,
    "createdByUserId" TEXT,
    "performedByUserId" TEXT,
    "type" "FarmRecordType" NOT NULL,
    "description" TEXT NOT NULL,
    "locationDescription" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" DECIMAL(18,4),
    "quantityUnit" TEXT,
    "value" DECIMAL(18,2),
    "responsibleName" TEXT,
    "productNameSnapshot" TEXT,
    "appliedDose" DECIMAL(18,4),
    "doseUnit" TEXT,
    "harvest" TEXT,
    "supplier" TEXT,
    "productBatch" TEXT,
    "technicalNote" TEXT,
    "source" "RecordSource" NOT NULL DEFAULT 'WEB',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FarmRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "source" "RecordSource" NOT NULL DEFAULT 'WEB',
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_slug_key" ON "Property"("slug");

-- CreateIndex
CREATE INDEX "Property_archivedAt_idx" ON "Property"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_deactivatedAt_idx" ON "User"("deactivatedAt");

-- CreateIndex
CREATE INDEX "PropertyMember_userId_idx" ON "PropertyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyMember_propertyId_userId_key" ON "PropertyMember"("propertyId", "userId");

-- CreateIndex
CREATE INDEX "Area_propertyId_createdAt_idx" ON "Area"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "Area_propertyId_archivedAt_idx" ON "Area"("propertyId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Area_propertyId_normalizedName_key" ON "Area"("propertyId", "normalizedName");

-- CreateIndex
CREATE INDEX "AreaAlias_areaId_idx" ON "AreaAlias"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaAlias_propertyId_normalizedName_key" ON "AreaAlias"("propertyId", "normalizedName");

-- CreateIndex
CREATE INDEX "StockProduct_propertyId_createdAt_idx" ON "StockProduct"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "StockProduct_propertyId_archivedAt_idx" ON "StockProduct"("propertyId", "archivedAt");

-- CreateIndex
CREATE INDEX "StockProduct_propertyId_expirationDate_idx" ON "StockProduct"("propertyId", "expirationDate");

-- CreateIndex
CREATE UNIQUE INDEX "StockProduct_propertyId_normalizedName_key" ON "StockProduct"("propertyId", "normalizedName");

-- CreateIndex
CREATE INDEX "ProductAlias_productId_idx" ON "ProductAlias"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAlias_propertyId_normalizedName_key" ON "ProductAlias"("propertyId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_reversesMovementId_key" ON "StockMovement"("reversesMovementId");

-- CreateIndex
CREATE INDEX "StockMovement_propertyId_createdAt_idx" ON "StockMovement"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_areaId_createdAt_idx" ON "StockMovement"("areaId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_farmRecordId_idx" ON "StockMovement"("farmRecordId");

-- CreateIndex
CREATE INDEX "StockMovement_createdByUserId_createdAt_idx" ON "StockMovement"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_performedByUserId_createdAt_idx" ON "StockMovement"("performedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FarmRecord_propertyId_occurredAt_idx" ON "FarmRecord"("propertyId", "occurredAt");

-- CreateIndex
CREATE INDEX "FarmRecord_areaId_occurredAt_idx" ON "FarmRecord"("areaId", "occurredAt");

-- CreateIndex
CREATE INDEX "FarmRecord_productId_occurredAt_idx" ON "FarmRecord"("productId", "occurredAt");

-- CreateIndex
CREATE INDEX "FarmRecord_createdByUserId_occurredAt_idx" ON "FarmRecord"("createdByUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "FarmRecord_performedByUserId_occurredAt_idx" ON "FarmRecord"("performedByUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_propertyId_createdAt_idx" ON "AuditLog"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_propertyId_entityType_entityId_createdAt_idx" ON "AuditLog"("propertyId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "PropertyMember" ADD CONSTRAINT "PropertyMember_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMember" ADD CONSTRAINT "PropertyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaAlias" ADD CONSTRAINT "AreaAlias_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaAlias" ADD CONSTRAINT "AreaAlias_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockProduct" ADD CONSTRAINT "StockProduct_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_farmRecordId_fkey" FOREIGN KEY ("farmRecordId") REFERENCES "FarmRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reversesMovementId_fkey" FOREIGN KEY ("reversesMovementId") REFERENCES "StockMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmRecord" ADD CONSTRAINT "FarmRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmRecord" ADD CONSTRAINT "FarmRecord_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmRecord" ADD CONSTRAINT "FarmRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmRecord" ADD CONSTRAINT "FarmRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmRecord" ADD CONSTRAINT "FarmRecord_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restrições de domínio que complementam as validações dos services.
ALTER TABLE "User"
  ADD CONSTRAINT "User_phone_e164_check"
  CHECK ("phone" ~ '^\+[1-9][0-9]{7,14}$');

ALTER TABLE "Area"
  ADD CONSTRAINT "Area_size_non_negative_check"
  CHECK ("size" IS NULL OR "size" >= 0),
  ADD CONSTRAINT "Area_productivity_non_negative_check"
  CHECK ("estimatedProductivity" IS NULL OR "estimatedProductivity" >= 0);

ALTER TABLE "StockProduct"
  ADD CONSTRAINT "StockProduct_quantity_non_negative_check"
  CHECK ("quantity" >= 0),
  ADD CONSTRAINT "StockProduct_minimum_non_negative_check"
  CHECK ("minimumStock" IS NULL OR "minimumStock" >= 0),
  ADD CONSTRAINT "StockProduct_unit_value_non_negative_check"
  CHECK ("unitValue" IS NULL OR "unitValue" >= 0);

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_balances_non_negative_check"
  CHECK ("balanceBefore" >= 0 AND "balanceAfter" >= 0),
  ADD CONSTRAINT "StockMovement_balance_equation_check"
  CHECK ("balanceAfter" = "balanceBefore" + "quantityChange"),
  ADD CONSTRAINT "StockMovement_change_sign_check"
  CHECK (
    ("type" = 'IN' AND "quantityChange" > 0) OR
    ("type" = 'OUT' AND "quantityChange" < 0) OR
    ("type" IN ('ADJUSTMENT', 'REVERSAL') AND "quantityChange" <> 0)
  );

ALTER TABLE "FarmRecord"
  ADD CONSTRAINT "FarmRecord_quantity_non_negative_check"
  CHECK ("quantity" IS NULL OR "quantity" >= 0),
  ADD CONSTRAINT "FarmRecord_value_non_negative_check"
  CHECK ("value" IS NULL OR "value" >= 0),
  ADD CONSTRAINT "FarmRecord_dose_non_negative_check"
  CHECK ("appliedDose" IS NULL OR "appliedDose" >= 0);
