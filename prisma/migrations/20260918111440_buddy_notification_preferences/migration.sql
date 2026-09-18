-- AlterEnum
-- The four buddy events a buddy may mute. The unmutable ones
-- (tour_cancelled, waitlist_promoted, account_approved, account_rejected) are
-- deliberately absent: with no enum value there is no row to store, so the
-- opt-out is unreachable rather than merely hidden in the UI.
ALTER TYPE "NotifEventType" ADD VALUE 'tour_published';
ALTER TYPE "NotifEventType" ADD VALUE 'tour_details_changed';
ALTER TYPE "NotifEventType" ADD VALUE 'tour_reminder';
ALTER TYPE "NotifEventType" ADD VALUE 'maybe_reminder';

-- AlterTable
-- Renamed, not dropped and re-added: the table now holds buddy rows as well as
-- admin rows, and existing admin preferences must survive. `prisma migrate
-- diff` emits DROP COLUMN + ADD COLUMN for a rename, which would discard them.
ALTER TABLE "NotificationPreference" RENAME COLUMN "adminId" TO "userId";
ALTER TABLE "NotificationPreference" RENAME CONSTRAINT "NotificationPreference_adminId_fkey" TO "NotificationPreference_userId_fkey";
ALTER INDEX "NotificationPreference_adminId_eventType_key" RENAME TO "NotificationPreference_userId_eventType_key";
