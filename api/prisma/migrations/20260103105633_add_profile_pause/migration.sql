-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isProfilePaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pausedAt" TIMESTAMP(3);
