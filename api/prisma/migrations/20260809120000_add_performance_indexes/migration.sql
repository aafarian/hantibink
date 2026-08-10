-- CreateIndex
CREATE INDEX "blocked_users_blockedId_idx" ON "blocked_users"("blockedId");

-- CreateIndex
CREATE INDEX "matches_user2Id_isActive_idx" ON "matches"("user2Id", "isActive");

-- CreateIndex
CREATE INDEX "messages_matchId_createdAt_idx" ON "messages"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_receiverId_isRead_idx" ON "messages"("receiverId", "isRead");

-- CreateIndex
CREATE INDEX "muted_matches_matchId_idx" ON "muted_matches"("matchId");

-- CreateIndex
CREATE INDEX "photos_userId_order_idx" ON "photos"("userId", "order");

-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "reports_reportedId_idx" ON "reports"("reportedId");

-- CreateIndex
CREATE INDEX "user_actions_receiverId_action_createdAt_idx" ON "user_actions"("receiverId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "users_isActive_isProfilePaused_isDiscoverable_idx" ON "users"("isActive", "isProfilePaused", "isDiscoverable");

-- CreateIndex
CREATE INDEX "users_lastActive_idx" ON "users"("lastActive");

-- CreateIndex
CREATE INDEX "users_pushToken_idx" ON "users"("pushToken");

