-- One-shot: bring the Neon staging database up to prisma/schema.prisma before
-- baselining it onto Prisma Migrate (#142). Not a Prisma migration.
--
-- Generated on 2026-09-12, after scripts/staging-enum-remap.sql, by:
--   docker-compose exec api pnpm exec prisma migrate diff \
--     --from-url "$STG" --to-schema-datamodel prisma/schema.prisma --script
--
-- Applied to Neon staging on 2026-09-12. Frozen at what was executed — do not
-- re-run it.
--
-- It is not a copy of any single migration. onboardingSeenAt belongs to
-- 0_init (staging predates that column); the MemberType enum and column are
-- the whole of 20260912032858_add_member_type.
--
-- Run ($STG is the Neon staging connection string; psql is not installed on
-- the dev machine, so it comes from the db container):
--   docker-compose run --rm -T db psql "$STG" -v ON_ERROR_STOP=1 \
--     --single-transaction -f /dev/stdin < scripts/staging-drift.sql

-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('buddy', 'plab_member');

-- AlterTable
ALTER TABLE "BuddyProfile" ADD COLUMN     "memberType" "MemberType" NOT NULL DEFAULT 'buddy',
ADD COLUMN     "onboardingSeenAt" TIMESTAMP(3);
