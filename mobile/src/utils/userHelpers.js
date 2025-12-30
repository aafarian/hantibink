/**
 * Check if user is online (active within last 2 minutes)
 * @param {string|Date} lastActive - Last active timestamp
 * @returns {boolean} Whether user is considered online
 */
export const isUserOnline = lastActive => {
  if (!lastActive) return false;
  const lastActiveDate = new Date(lastActive);
  const now = new Date();
  const minutesSinceActive = (now - lastActiveDate) / (1000 * 60);
  return minutesSinceActive < 2;
};
