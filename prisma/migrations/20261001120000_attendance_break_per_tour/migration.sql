-- AlterEnum
ALTER TYPE "AttendanceChangeKind" ADD VALUE 'tour_break';

-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "breakEnd",
DROP COLUMN "breakMinutes",
DROP COLUMN "breakStart";

-- CreateTable
CREATE TABLE "AttendanceBreak" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "breakStart" TIME,
    "breakEnd" TIME,
    "breakMinutes" INTEGER NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceBreak_tourId_key" ON "AttendanceBreak"("tourId");

-- AddForeignKey
ALTER TABLE "AttendanceBreak" ADD CONSTRAINT "AttendanceBreak_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceBreak" ADD CONSTRAINT "AttendanceBreak_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

