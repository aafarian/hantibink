/**
 * Patch notes shown once per version by WhatsNewModal.
 *
 * Add an entry when a release ships something users should hear about.
 * Versions without an entry stay silent — the modal only fires when the
 * running version has notes AND the user hasn't seen them yet.
 * Newest first.
 */
export const PATCH_NOTES = [
  {
    version: '1.0.0',
    headline: 'Welcome to Hantibink',
    notes: [
      'Discover people and match with a swipe',
      'Real-time chat with GIFs, voice messages, and reactions',
      'Premium: see who liked you and super-like your favorites',
    ],
  },
];

/**
 * Notes for a specific app version, or null when that version has none.
 */
export const notesForVersion = version =>
  PATCH_NOTES.find(entry => entry.version === version) || null;
