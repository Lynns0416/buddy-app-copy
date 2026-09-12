-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('buddy', 'plab_member');

-- AlterTable
ALTER TABLE "BuddyProfile" ADD COLUMN     "memberType" "MemberType" NOT NULL DEFAULT 'buddy';
