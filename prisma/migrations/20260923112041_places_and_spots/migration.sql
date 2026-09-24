/*
  Warnings:

  - You are about to drop the column `location` on the `Tour` table. All the data in the column will be lost.
  - You are about to drop the column `memorableMoment` on the `TourReflection` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Tour" DROP COLUMN "location";

-- AlterTable
ALTER TABLE "TourReflection" DROP COLUMN "memorableMoment";

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "nameJa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spot" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "nameJa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Spot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourPlace" (
    "tourId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,

    CONSTRAINT "TourPlace_pkey" PRIMARY KEY ("tourId","placeId")
);

-- CreateTable
CREATE TABLE "TourReflectionMoment" (
    "id" TEXT NOT NULL,
    "reflectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "spotId" TEXT,
    "placeNote" TEXT,
    "description" TEXT NOT NULL,

    CONSTRAINT "TourReflectionMoment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Spot_placeId_idx" ON "Spot"("placeId");

-- CreateIndex
CREATE INDEX "TourPlace_placeId_idx" ON "TourPlace"("placeId");

-- CreateIndex
CREATE INDEX "TourReflectionMoment_reflectionId_idx" ON "TourReflectionMoment"("reflectionId");

-- CreateIndex
CREATE INDEX "TourReflectionMoment_spotId_idx" ON "TourReflectionMoment"("spotId");

-- AddForeignKey
ALTER TABLE "Spot" ADD CONSTRAINT "Spot_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourPlace" ADD CONSTRAINT "TourPlace_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourPlace" ADD CONSTRAINT "TourPlace_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourReflectionMoment" ADD CONSTRAINT "TourReflectionMoment_reflectionId_fkey" FOREIGN KEY ("reflectionId") REFERENCES "TourReflection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourReflectionMoment" ADD CONSTRAINT "TourReflectionMoment_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
