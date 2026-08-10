/**
 * Single source of truth for loaded font files.
 * Consumed by App.js (useFonts) and asserted by the theme integrity test so
 * every theme.typography.fontFamily value is guaranteed to be loaded.
 *
 * Typeface system: Outfit for display/headings (geometric, distinctive),
 * DM Sans for body text (clean, highly readable at small sizes).
 */
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';

export const fontMap = {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
};
