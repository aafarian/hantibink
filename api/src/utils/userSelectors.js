/**
 * Shared Prisma `select` objects for exposing OTHER users' profiles.
 *
 * Anything not listed here is withheld by construction — notably password,
 * email, firebaseUid, verification/reset tokens, push tokens, raw
 * latitude/longitude, quotas, and notification preferences. Always prefer
 * these selectors over `include` when returning another user's row.
 */

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  bio: true,
  birthDate: true, // callers compute age and must drop the raw date
  gender: true,
  education: true,
  profession: true,
  height: true,
  relationshipType: true,
  religion: true,
  smoking: true,
  drinking: true,
  travel: true,
  pets: true,
  location: true,
  languages: true,
  lastActive: true,
  mainPhotoUrl: true,
  isPremium: true,
  isVerified: true,
  createdAt: true,
};

const PUBLIC_USER_WITH_MEDIA_SELECT = {
  ...PUBLIC_USER_SELECT,
  photos: {
    orderBy: { order: 'asc' },
    select: { id: true, url: true, isMain: true, order: true },
  },
  interests: {
    include: { interest: true },
  },
};

module.exports = {
  PUBLIC_USER_SELECT,
  PUBLIC_USER_WITH_MEDIA_SELECT,
};
