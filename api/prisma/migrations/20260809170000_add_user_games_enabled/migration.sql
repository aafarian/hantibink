-- Per-user in-chat games toggle. Games are playable in a chat only when
-- BOTH members have this enabled; disabling ends the user's active games.
ALTER TABLE "users" ADD COLUMN "gamesEnabled" BOOLEAN NOT NULL DEFAULT true;
