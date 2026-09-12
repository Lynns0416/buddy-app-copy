-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('buddy', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "BuddyStatus" AS ENUM ('pending', 'trainee', 'active', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "BuddyTier" AS ENUM ('junior', 'buddy', 'star', 'blackstar');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('school', 'company', 'community', 'other');

-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('draft', 'published', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('confirmed', 'maybe', 'waitlist', 'declined');

-- CreateEnum
CREATE TYPE "CancellationCategory" AS ENUM ('health', 'emergency', 'personal', 'work', 'other');

-- CreateEnum
CREATE TYPE "NotifEventType" AS ENUM ('new_signup', 'new_booking', 'cancellation', 'maybe_resolved', 'maybe_deadline_missed');

-- CreateEnum
CREATE TYPE "EmailMode" AS ENUM ('immediate', 'digest');

-- CreateEnum
CREATE TYPE "BookingPool" AS ENUM ('junior', 'non_junior', 'anyone');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ja', 'en');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email', 'slack');

-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('pending', 'sent', 'failed', 'dead');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'ja',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuddyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "BuddyStatus" NOT NULL,
    "tier" "BuddyTier",
    "displayName" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "bio" TEXT,
    "contactInfo" TEXT,
    "languages" TEXT[],
    "skills" TEXT[],
    "internalNotes" TEXT,
    "onboardingSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuddyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tour" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "status" "TourStatus" NOT NULL,
    "tourDate" DATE NOT NULL,
    "bookingOpen" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "adminMemo" TEXT,
    "cancellationDeadline" DATE NOT NULL,
    "maybeDeadline" DATE,
    "notificationOffsets" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "staffInChargeId" TEXT,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourAdminAssignment" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TourAdminAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourSession" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT,
    "meetingTime" TIME NOT NULL,
    "startTime" TIME,
    "endTime" TIME,
    "capacity" INTEGER NOT NULL,
    "minBuddies" INTEGER,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierCapacity" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pool" "BookingPool" NOT NULL,
    "percent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "buddyId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "buddyTier" "BuddyTier" NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationReason" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "category" "CancellationCategory" NOT NULL,
    "freeText" TEXT,
    "unavoidable" BOOLEAN,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminEvaluation" (
    "id" TEXT NOT NULL,
    "buddyId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "overallRating" INTEGER,
    "overallRatingNote" TEXT,
    "reliability" INTEGER,
    "reliabilityNote" TEXT,
    "communication" INTEGER,
    "communicationNote" TEXT,
    "groupEngagement" INTEGER,
    "groupEngagementNote" TEXT,
    "memory" INTEGER,
    "memoryNote" TEXT,
    "knowledge" INTEGER,
    "knowledgeNote" TEXT,
    "dedication" INTEGER,
    "dedicationNote" TEXT,
    "dialogue" INTEGER,
    "dialogueNote" TEXT,
    "adaptability" INTEGER,
    "adaptabilityNote" TEXT,
    "emotionNote" TEXT,
    "confidence" INTEGER,
    "confidenceNote" TEXT,
    "absentWithoutReport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfileEvaluation" (
    "id" TEXT NOT NULL,
    "buddyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "overallRating" INTEGER,
    "overallRatingNote" TEXT,
    "reliability" INTEGER,
    "reliabilityNote" TEXT,
    "communication" INTEGER,
    "communicationNote" TEXT,
    "groupEngagement" INTEGER,
    "groupEngagementNote" TEXT,
    "memory" INTEGER,
    "memoryNote" TEXT,
    "knowledge" INTEGER,
    "knowledgeNote" TEXT,
    "dedication" INTEGER,
    "dedicationNote" TEXT,
    "dialogue" INTEGER,
    "dialogueNote" TEXT,
    "adaptability" INTEGER,
    "adaptabilityNote" TEXT,
    "emotionNote" TEXT,
    "confidence" INTEGER,
    "confidenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfileEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfEvaluation" (
    "id" TEXT NOT NULL,
    "buddyId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "overallRating" INTEGER,
    "overallRatingNote" TEXT,
    "communication" INTEGER,
    "communicationNote" TEXT,
    "groupEngagement" INTEGER,
    "groupEngagementNote" TEXT,
    "memory" INTEGER,
    "memoryNote" TEXT,
    "knowledge" INTEGER,
    "knowledgeNote" TEXT,
    "dedication" INTEGER,
    "dedicationNote" TEXT,
    "dialogue" INTEGER,
    "dialogueNote" TEXT,
    "adaptability" INTEGER,
    "adaptabilityNote" TEXT,
    "emotionNote" TEXT,
    "confidence" INTEGER,
    "confidenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuddyCancellationDeadlineOverride" (
    "id" TEXT NOT NULL,
    "buddyId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "deadline" DATE NOT NULL,
    "setBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuddyCancellationDeadlineOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "eventType" "NotifEventType" NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL,
    "emailMode" "EmailMode" NOT NULL,
    "slackEnabled" BOOLEAN NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestQueue" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "flushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigestQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "eventType" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "payload" JSONB NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'ja',
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDispatchLog" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDispatchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "BuddyProfile_userId_key" ON "BuddyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE INDEX "AdminProfile_deletedAt_idx" ON "AdminProfile"("deletedAt");

-- CreateIndex
CREATE INDEX "Tour_status_tourDate_idx" ON "Tour"("status", "tourDate");

-- CreateIndex
CREATE UNIQUE INDEX "TourAdminAssignment_tourId_adminId_key" ON "TourAdminAssignment"("tourId", "adminId");

-- CreateIndex
CREATE INDEX "TourSession_tourId_idx" ON "TourSession"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "TourSession_tourId_order_key" ON "TourSession"("tourId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TierCapacity_sessionId_pool_key" ON "TierCapacity"("sessionId", "pool");

-- CreateIndex
CREATE INDEX "Booking_tourId_status_idx" ON "Booking"("tourId", "status");

-- CreateIndex
CREATE INDEX "Booking_sessionId_status_idx" ON "Booking"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Booking_sessionId_status_buddyTier_idx" ON "Booking"("sessionId", "status", "buddyTier");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_buddyId_sessionId_key" ON "Booking"("buddyId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationReason_bookingId_key" ON "CancellationReason"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminEvaluation_buddyId_tourId_createdBy_key" ON "AdminEvaluation"("buddyId", "tourId", "createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfileEvaluation_buddyId_createdBy_key" ON "AdminProfileEvaluation"("buddyId", "createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "SelfEvaluation_buddyId_tourId_key" ON "SelfEvaluation"("buddyId", "tourId");

-- CreateIndex
CREATE UNIQUE INDEX "BuddyCancellationDeadlineOverride_buddyId_tourId_key" ON "BuddyCancellationDeadlineOverride"("buddyId", "tourId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_adminId_eventType_key" ON "NotificationPreference"("adminId", "eventType");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "DigestQueue_adminId_flushedAt_idx" ON "DigestQueue"("adminId", "flushedAt");

-- CreateIndex
CREATE INDEX "NotificationJob_status_scheduledFor_idx" ON "NotificationJob"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationJob_recipientUserId_idx" ON "NotificationJob"("recipientUserId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDispatchLog_eventKey_key" ON "NotificationDispatchLog"("eventKey");

-- CreateIndex
CREATE INDEX "NotificationDispatchLog_createdAt_idx" ON "NotificationDispatchLog"("createdAt");

-- AddForeignKey
ALTER TABLE "BuddyProfile" ADD CONSTRAINT "BuddyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_staffInChargeId_fkey" FOREIGN KEY ("staffInChargeId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourAdminAssignment" ADD CONSTRAINT "TourAdminAssignment_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourAdminAssignment" ADD CONSTRAINT "TourAdminAssignment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourSession" ADD CONSTRAINT "TourSession_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierCapacity" ADD CONSTRAINT "TierCapacity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TourSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "BuddyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TourSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationReason" ADD CONSTRAINT "CancellationReason_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationReason" ADD CONSTRAINT "CancellationReason_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminEvaluation" ADD CONSTRAINT "AdminEvaluation_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "BuddyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminEvaluation" ADD CONSTRAINT "AdminEvaluation_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminEvaluation" ADD CONSTRAINT "AdminEvaluation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfileEvaluation" ADD CONSTRAINT "AdminProfileEvaluation_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "BuddyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfileEvaluation" ADD CONSTRAINT "AdminProfileEvaluation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfEvaluation" ADD CONSTRAINT "SelfEvaluation_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "BuddyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfEvaluation" ADD CONSTRAINT "SelfEvaluation_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuddyCancellationDeadlineOverride" ADD CONSTRAINT "BuddyCancellationDeadlineOverride_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "BuddyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuddyCancellationDeadlineOverride" ADD CONSTRAINT "BuddyCancellationDeadlineOverride_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuddyCancellationDeadlineOverride" ADD CONSTRAINT "BuddyCancellationDeadlineOverride_setBy_fkey" FOREIGN KEY ("setBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigestQueue" ADD CONSTRAINT "DigestQueue_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

