-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('THIS_OR_THAT', 'TWO_TRUTHS', 'QUESTION_ROULETTE', 'EMOJI_RIDDLE');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DECLINED', 'FORFEITED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'GAME';

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "summaryMessageId" TEXT,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_sessions_matchId_status_idx" ON "game_sessions"("matchId", "status");

-- CreateIndex
CREATE INDEX "game_sessions_createdBy_createdAt_idx" ON "game_sessions"("createdBy", "createdAt");

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One ACTIVE session per match
CREATE UNIQUE INDEX "game_sessions_one_active_per_match" ON "game_sessions" ("matchId") WHERE status = 'ACTIVE';
