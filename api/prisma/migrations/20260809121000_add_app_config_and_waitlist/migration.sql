-- CreateTable
CREATE TABLE "app_config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "waitlist" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_email_key" ON "waitlist"("email");


-- Backfill: registration used to hardcode isDiscoverable=false "until email
-- verified" while verification emails never sent, so complete profiles are
-- stuck undiscoverable. Recompute using the same rule as
-- utils/discoveryUtils.updateDiscoverableStatus (profile completeness).
UPDATE "users" SET "isDiscoverable" = true
WHERE "birthDate" IS NOT NULL
  AND "gender" IS NOT NULL
  AND cardinality("interestedIn") > 0
  AND EXISTS (SELECT 1 FROM "photos" WHERE "photos"."userId" = "users"."id");
