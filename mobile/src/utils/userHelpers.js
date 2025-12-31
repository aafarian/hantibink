/**
 * Check if user is online (active within last 5 minutes)
 * Heartbeats are sent every 60 seconds, so 5 minutes gives buffer for network delays
 * @param {string|Date} lastActive - Last active timestamp
 * @returns {boolean} Whether user is considered online
 */
export const isUserOnline = lastActive => {
  if (!lastActive) return false;
  const lastActiveDate = new Date(lastActive);
  const now = new Date();
  const minutesSinceActive = (now - lastActiveDate) / (1000 * 60);
  return minutesSinceActive < 5;
};
