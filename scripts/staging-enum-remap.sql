-- One-shot: remap BuddyTier on the Neon staging database before baselining it
-- onto Prisma Migrate (#142). Not a Prisma migration — 0_init already declares
-- the final enum, so this file must never live in prisma/migrations/.
--
-- Applied to Neon staging on 2026-09-12. Frozen at what was executed — do not
-- re-run it and do not update it. The live guidance, the rationale, and why
-- ALTER TYPE ... ADD VALUE is not used are in DEPLOYMENT.md under "Renaming
-- enum values on a populated database"; edit that, not this.
--
-- Verified against staging on 2026-09-12: the live type held six values
-- (junior, mid, senior, expert, instructor, organizer) and exactly two columns
-- depended on it, neither with a default. No row held expert, instructor or
-- organizer, so the CASE below loses nothing.
--
-- Run ($STG is the Neon staging connection string; psql is not installed on
-- the dev machine, so it comes from the db container):
--   docker-compose run --rm -T db psql "$STG" -v ON_ERROR_STOP=1 \
--     --single-transaction -f /dev/stdin < scripts/staging-enum-remap.sql

-- 1. the new type, with the dead values already gone
CREATE TYPE "BuddyTier_new" AS ENUM ('junior', 'buddy', 'star', 'blackstar');

-- 2. every column of the old type. Miss one and the DROP in step 3 fails.
--    The CASE is the rename; NULL stays NULL.
ALTER TABLE "BuddyProfile" ALTER COLUMN "tier" TYPE "BuddyTier_new"
  USING (CASE WHEN "tier"::text IN ('mid', 'senior') THEN 'buddy'
              ELSE "tier"::text END)::"BuddyTier_new";

ALTER TABLE "Booking" ALTER COLUMN "buddyTier" TYPE "BuddyTier_new"
  USING (CASE WHEN "buddyTier"::text IN ('mid', 'senior') THEN 'buddy'
              ELSE "buddyTier"::text END)::"BuddyTier_new";

-- 3. retire the old type and take its name
DROP TYPE "BuddyTier";
ALTER TYPE "BuddyTier_new" RENAME TO "BuddyTier";
