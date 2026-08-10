-- Pair the last-applied RevenueCat event's id with its timestamp so two
-- distinct events sharing a millisecond can be told apart from a true
-- duplicate delivery
ALTER TABLE "users" ADD COLUMN "rcLastEventId" TEXT;
