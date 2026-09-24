-- Each session goes to exactly one place; sessions of one tour may differ
-- (docs/decisions.md 2026-09-24, "A place belongs to a session, not a tour").

-- AlterTable: nullable first so existing sessions can be backfilled.
ALTER TABLE "TourSession" ADD COLUMN     "placeId" TEXT;

-- Backfill: each session takes its tour's first place by sortOrder. Nothing is
-- in production; this only keeps development databases migratable.
UPDATE "TourSession" s
SET "placeId" = (
  SELECT tp."placeId"
  FROM "TourPlace" tp
  JOIN "Place" p ON p."id" = tp."placeId"
  WHERE tp."tourId" = s."tourId"
  ORDER BY p."sortOrder", p."id"
  LIMIT 1
);

ALTER TABLE "TourSession" ALTER COLUMN "placeId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "TourPlace" DROP CONSTRAINT "TourPlace_placeId_fkey";

-- DropForeignKey
ALTER TABLE "TourPlace" DROP CONSTRAINT "TourPlace_tourId_fkey";

-- DropTable
DROP TABLE "TourPlace";

-- CreateIndex
CREATE INDEX "TourSession_placeId_idx" ON "TourSession"("placeId");

-- AddForeignKey
ALTER TABLE "TourSession" ADD CONSTRAINT "TourSession_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
