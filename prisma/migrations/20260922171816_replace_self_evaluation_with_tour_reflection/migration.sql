/*
  Warnings:

  - You are about to drop the `SelfEvaluation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SelfEvaluation" DROP CONSTRAINT "SelfEvaluation_buddyId_fkey";

-- DropForeignKey
ALTER TABLE "SelfEvaluation" DROP CONSTRAINT "SelfEvaluation_tourId_fkey";

-- DropTable
DROP TABLE "SelfEvaluation";

-- CreateTable
CREATE TABLE "TourReflection" (
    "id" TEXT NOT NULL,
    "buddyId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "didWell" TEXT,
    "couldImprove" TEXT,
    "memorableMoment" TEXT,
    "notesForOthers" TEXT,
    "openQuestions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourReflection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TourReflection_sessionId_idx" ON "TourReflection"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TourReflection_buddyId_sessionId_key" ON "TourReflection"("buddyId", "sessionId");

-- AddForeignKey
ALTER TABLE "TourReflection" ADD CONSTRAINT "TourReflection_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "BuddyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourReflection" ADD CONSTRAINT "TourReflection_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TourSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
