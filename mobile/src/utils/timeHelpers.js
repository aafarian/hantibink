/**
 * Format timestamp as relative time (e.g., "5m ago", "2h ago")
 * @param {string|Date} timestamp - Timestamp to format
 * @returns {string|null} Formatted relative time string
 */
export const formatRelativeTime = timestamp => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // For older dates, show month and day
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Format "last seen X ago" string for user status
 * @param {Date} date - Last seen date
 * @returns {string|null} Formatted last seen string
 */
export const formatLastSeen = date => {
  if (!date) return null;
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return 'Last seen just now';
  if (diffMins < 60) return `Last seen ${diffMins}m ago`;
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;
  if (diffDays < 7) return `Last seen ${diffDays}d ago`;
  if (diffWeeks < 4) return `Last seen ${diffWeeks}w ago`;
  if (diffMonths < 12) return `Last seen ${diffMonths}mo ago`;
  return `Last seen ${Math.floor(diffMonths / 12)}y ago`;
};
