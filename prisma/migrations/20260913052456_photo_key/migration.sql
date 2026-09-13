-- Photos move to a private Azure Blob container: the column holds the blob
-- name, and the api signs a link for every response. Prisma generates a drop
-- and add for a rename, so this is written by hand. See docs/decisions.md
-- 2026-09-13, "Photos are stored as blob names".
ALTER TABLE "BuddyProfile" RENAME COLUMN "photoUrl" TO "photoKey";

-- R2 object keys become blob names unchanged; #155 copies the objects under the
-- same names. Anything else, such as a Google profile picture URL saved at
-- sign-up, has no blob behind it and is cleared.
UPDATE "BuddyProfile"
SET "photoKey" = substring("photoKey" from '(buddy-photos/.+)$')
WHERE "photoKey" IS NOT NULL;
