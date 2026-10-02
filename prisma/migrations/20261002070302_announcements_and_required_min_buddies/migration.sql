-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('rule', 'selected');

-- Backfill minBuddies before it becomes required, from the session's maximum
-- buddies (capacity): up to 5 → all of them, 6–10 → 2 fewer, more → 3 fewer.
-- A 0 asks for no buddies, so it is replaced the same way.
UPDATE "TourSession"
SET "minBuddies" = CASE
    WHEN "capacity" <= 5 THEN "capacity"
    WHEN "capacity" <= 10 THEN "capacity" - 2
    ELSE "capacity" - 3
END
WHERE "minBuddies" IS NULL OR "minBuddies" < 1;

-- AlterTable
ALTER TABLE "TourSession" ALTER COLUMN "minBuddies" SET NOT NULL;

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "titleJa" TEXT NOT NULL,
    "bodyJa" TEXT NOT NULL,
    "titleEn" TEXT,
    "bodyEn" TEXT,
    "audience" "AnnouncementAudience" NOT NULL,
    "statuses" "BuddyStatus"[],
    "tiers" "BuddyTier"[],
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "position" INTEGER NOT NULL,
    "tourId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRecipient" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "buddyId" TEXT NOT NULL,

    CONSTRAINT "AnnouncementRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_startDate_endDate_idx" ON "Announcement"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Announcement_tourId_idx" ON "Announcement"("tourId");

-- CreateIndex
CREATE INDEX "AnnouncementRecipient_buddyId_idx" ON "AnnouncementRecipient"("buddyId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRecipient_announcementId_buddyId_key" ON "AnnouncementRecipient"("announcementId", "buddyId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRecipient" ADD CONSTRAINT "AnnouncementRecipient_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRecipient" ADD CONSTRAINT "AnnouncementRecipient_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "BuddyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
