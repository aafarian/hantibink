-- AlterTable
ALTER TABLE "users" ADD COLUMN     "superLikeAccruedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "superLikeBalance" INTEGER NOT NULL DEFAULT 0;

-- Seed existing premium users with a starting bank so they aren't empty
-- until the first daily accrual
UPDATE "users" SET "superLikeBalance" = 2 WHERE "isPremium" = true;
