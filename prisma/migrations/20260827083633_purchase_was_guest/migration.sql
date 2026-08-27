-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "wasGuest" BOOLEAN NOT NULL DEFAULT false;

-- Backfill. Without this every download taken before today counts as
-- signed-in, and "emails without an account" launches reading zero against
-- real data.
--
-- Safe only because of when it runs: right now a Purchase row carries an email
-- ONLY if it came from the guest endpoint — the signed-in claim passes no
-- email. That stops being true once paid checkout ships, which is exactly why
-- the column exists rather than continuing to infer this.
UPDATE "Purchase" SET "wasGuest" = true WHERE "email" IS NOT NULL;
