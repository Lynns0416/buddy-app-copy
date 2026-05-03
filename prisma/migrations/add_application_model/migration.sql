-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('pending', 'approved', 'rejected', 'waitlisted');

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "buddyId" TEXT NOT NULL,
    "buddyTier" "BuddyTier" NOT NULL,
    "status" "ApplicationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_tourId_buddyId_key" ON "Application"("tourId", "buddyId");

-- CreateIndex
CREATE INDEX "Application_tourId_status_idx" ON "Application"("tourId", "status");

-- CreateIndex
CREATE INDEX "Application_tourId_status_buddyTier_idx" ON "Application"("tourId", "status", "buddyTier");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "BuddyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN "mentorshipBalanced" BOOLEAN NOT NULL DEFAULT false;
