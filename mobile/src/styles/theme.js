/**
 * Design tokens for Hantibink.
 *
 * Every component color must flow through theme.colors.* — enforced by the
 * no-restricted-syntax hex-literal lint rule (theme.js is the only exempt
 * file). This keeps the palette swappable: dark mode later means a second
 * palette object behind a useTheme provider, with zero component changes.
 */
export const theme = {
  colors: {
    // Armenian tricolor — premium shades
    primary: '#C0392B', // Warm crimson (Armenian red)
    primaryLight: '#E74C3C', // Lighter red for hover states, soft accents
    primaryTint: '#FDEDEC', // Blush background tint
    secondary: '#1A3A8A', // Deep royal blue (Armenian blue)
    secondaryLight: '#2D62C4', // Links, secondary buttons
    secondaryTint: '#E8EEF8', // Info backgrounds
    accent: '#D97706', // Golden amber (Armenian apricot/orange)
    accentLight: '#FBBF24', // Badges, highlights — amber-400
    accentTint: '#FEF3C7', // Premium/special backgrounds
    premium: '#F59E0B', // Rich amber gold for premium features
    text: {
      primary: '#1E293B', // Slate-800
      secondary: '#64748B', // Slate-500
      muted: '#94A3B8', // Slate-400
      white: '#fff',
      shadow: 'rgba(0, 0, 0, 0.5)', // Text shadow on photos
    },
    background: {
      primary: '#FFFFFF', // Pure white to avoid scroll strobe with off-white
      secondary: '#F9FAFB', // Gray-50, neutral
      tertiary: '#F3F4F6', // Gray-100, neutral
      dark: '#000000', // Photo viewers, media surfaces, transition underlay
    },
    overlay: {
      light: 'rgba(255, 255, 255, 0.2)',
      medium: 'rgba(0, 0, 0, 0.5)',
      heavy: 'rgba(0, 0, 0, 0.7)',
      glass: 'rgba(255, 255, 255, 0.15)',
    },
    status: {
      success: '#4CAF50',
      successDark: '#2E7D32', // strongest tier of success ramps
      error: '#F44336',
      warning: '#FF9800',
      info: '#2196F3',
    },
    // Swipe action buttons (discovery deck)
    action: {
      nope: '#FF5252',
      like: '#4CAF50',
      superlike: '#00BCD4',
      rewind: '#FFB300',
    },
    // Destructive actions (delete account, sign out, remove photo)
    destructive: '#FF3B30',
    destructiveTint: 'rgba(255, 59, 48, 0.08)',
    // Form feedback backgrounds and borders
    feedback: {
      successTint: '#E8F5E9',
      successBorder: '#C8E6C9',
      errorTint: '#FFF5F5',
      errorBorder: '#FFD1D1',
    },
    // Presence indicator (semantically distinct from status.success)
    online: '#4CAF50',
    // Shadow color for shadowColor styles
    shadow: '#000',
    border: {
      light: '#E5E7EB', // Gray-200, neutral
      medium: '#D1D5DB', // Gray-300, neutral
      primary: 'rgba(192, 57, 43, 0.15)', // Primary red tint for borders
    },
    gray: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
  },
  icons: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 48,
    xxl: 64,
  },
  typography: {
    // Typeface system: Outfit (display/headings) + DM Sans (body).
    // Use the SEMANTIC roles in new code; the legacy weight-named aliases
    // exist so the 70+ existing call sites migrated without a sweep.
    fontFamily: {
      // Semantic roles
      display: 'Outfit_700Bold', // hero text, celebrations, screen titles
      heading: 'Outfit_600SemiBold', // section titles, card names, modal titles
      headingLight: 'Outfit_500Medium', // sub-headings
      body: 'DMSans_400Regular',
      bodyMedium: 'DMSans_500Medium',
      label: 'DMSans_600SemiBold', // buttons, badges, form labels
      // Legacy aliases (weight-named) — resolve to DM Sans
      regular: 'DMSans_400Regular',
      medium: 'DMSans_500Medium',
      semibold: 'DMSans_600SemiBold',
      bold: 'DMSans_700Bold',
    },
    sizes: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 18,
      xxl: 20,
      xxxl: 24,
      huge: 32,
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 40,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20,
    round: 999,
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 8,
    },
  },
  /**
   * Animation configuration tokens for consistent motion throughout the app.
   * Use these values with react-native-reanimated for performant animations.
   */
  animation: {
    /**
     * Duration values in milliseconds for timing-based animations.
     * Use with withTiming() from react-native-reanimated.
     */
    durations: {
      /** Micro-interactions, quick feedback (100ms) */
      quick: 100,
      /** Standard transitions, most UI animations (200ms) */
      normal: 200,
      /** Deliberate animations, modals appearing (300ms) */
      slow: 300,
      /** Page transitions, significant state changes (400ms) */
      transition: 400,
      /** Celebration animations, success states (600ms) */
      celebration: 600,
    },
    /**
     * Easing curves for timing-based animations.
     * Use with withTiming(value, { easing }) from react-native-reanimated.
     * Note: Import Easing from react-native-reanimated to use these.
     */
    easings: {
      /** Standard ease for most animations - cubic-bezier(0.4, 0, 0.2, 1) */
      standard: { x1: 0.4, y1: 0, x2: 0.2, y2: 1 },
      /** Ease out for elements entering - cubic-bezier(0, 0, 0.2, 1) */
      decelerate: { x1: 0, y1: 0, x2: 0.2, y2: 1 },
      /** Ease in for elements exiting - cubic-bezier(0.4, 0, 1, 1) */
      accelerate: { x1: 0.4, y1: 0, x2: 1, y2: 1 },
      /** Sharp ease for quick transitions - cubic-bezier(0.4, 0, 0.6, 1) */
      sharp: { x1: 0.4, y1: 0, x2: 0.6, y2: 1 },
    },
    /**
     * Spring configuration presets for react-native-reanimated withSpring().
     * Use with withSpring(value, config) for physics-based animations.
     */
    springs: {
      /** Bouncy spring for playful interactions (swipe cards, likes) */
      bouncy: {
        damping: 8,
        stiffness: 100,
        mass: 0.5,
      },
      /** Stiff spring for snappy feedback (button presses) */
      stiff: {
        damping: 20,
        stiffness: 300,
        mass: 0.5,
      },
      /** Smooth spring for gentle transitions (modals, sheets) */
      smooth: {
        damping: 15,
        stiffness: 120,
        mass: 0.8,
      },
      /** Gentle spring for subtle movements (tooltips, hints) */
      gentle: {
        damping: 12,
        stiffness: 80,
        mass: 0.6,
      },
    },
    /**
     * Scale values for press feedback and interactive states.
     * Use with transform: [{ scale: value }] in animations.
     */
    scales: {
      /** Scale down on press for tactile feedback */
      pressed: 0.96,
      /** Scale up slightly for active/highlighted state */
      active: 1.02,
      /** No scale - resting state */
      resting: 1,
      /** Subtle press for small elements */
      subtlePress: 0.98,
    },
  },
};
