-- Track the newest RevenueCat event applied per user so stale or duplicate
-- webhook deliveries can never overwrite newer entitlement state
ALTER TABLE "users" ADD COLUMN "rcLastEventAt" TIMESTAMP(3);
