-- Per-chat games mute: either member can turn games off with a specific
-- person; games are playable only when nobody in the match has muted them.
CREATE TABLE "game_mutes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,

    CONSTRAINT "game_mutes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_mutes_userId_matchId_key" ON "game_mutes"("userId", "matchId");
CREATE INDEX "game_mutes_matchId_idx" ON "game_mutes"("matchId");

ALTER TABLE "game_mutes" ADD CONSTRAINT "game_mutes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_mutes" ADD CONSTRAINT "game_mutes_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
