-- CreateEnum
CREATE TYPE "LateReason" AS ENUM ('transport_delay', 'other');

-- CreateEnum
CREATE TYPE "AttendanceChangeKind" AS ENUM ('finish_time', 'attendance', 'month_locked', 'month_unlocked');

-- CreateTable
CREATE TABLE "AttendanceDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "finishTime" TIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "buddyId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "absenceReported" BOOLEAN,
    "arrivalTime" TIME,
    "lateReason" "LateReason",
    "lateNote" TEXT,
    "lateExcused" BOOLEAN,
    "leaveTime" TIME,
    "leaveNote" TEXT,
    "breakStart" TIME,
    "breakEnd" TIME,
    "breakMinutes" INTEGER,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceChange" (
    "id" TEXT NOT NULL,
    "kind" "AttendanceChangeKind" NOT NULL,
    "date" DATE NOT NULL,
    "buddyId" TEXT,
    "tourId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceMonthLock" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceMonthLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceFlag" (
    "id" TEXT NOT NULL,
    "buddyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "AttendanceFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDay_date_key" ON "AttendanceDay"("date");

-- CreateIndex
CREATE INDEX "Attendance_tourId_idx" ON "Attendance"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_buddyId_tourId_key" ON "Attendance"("buddyId", "tourId");

-- CreateIndex
CREATE INDEX "AttendanceChange_date_idx" ON "AttendanceChange"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMonthLock_month_key" ON "AttendanceMonthLock"("month");

-- CreateIndex
CREATE INDEX "AttendanceFlag_date_idx" ON "AttendanceFlag"("date");

-- CreateIndex
CREATE INDEX "AttendanceFlag_buddyId_idx" ON "AttendanceFlag"("buddyId");

-- AddForeignKey
ALTER TABLE "AttendanceDay" ADD CONSTRAINT "AttendanceDay_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "BuddyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceChange" ADD CONSTRAINT "AttendanceChange_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMonthLock" ADD CONSTRAINT "AttendanceMonthLock_lockedBy_fkey" FOREIGN KEY ("lockedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceFlag" ADD CONSTRAINT "AttendanceFlag_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "BuddyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceFlag" ADD CONSTRAINT "AttendanceFlag_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Absence moves from the evaluation to the attendance record. A tour any
-- PLAB member marked "absent without report" becomes an absent, unreported
-- attendance row, attributed to the earliest such evaluation's author.
INSERT INTO "Attendance" ("id", "buddyId", "tourId", "absent", "absenceReported", "updatedBy", "updatedAt")
SELECT DISTINCT ON ("buddyId", "tourId")
    gen_random_uuid()::text, "buddyId", "tourId", true, false, "createdBy", CURRENT_TIMESTAMP
FROM "AdminEvaluation"
WHERE "absentWithoutReport"
ORDER BY "buddyId", "tourId", "createdAt";

-- AlterTable
ALTER TABLE "AdminEvaluation" DROP COLUMN "absentWithoutReport";
