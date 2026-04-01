export const theme = {
  colors: {
    primary: '#D32F2F', // Armenian red
    secondary: '#1565C0', // Armenian blue
    accent: '#F57C00', // Armenian orange
    premium: '#FFD700', // Gold for premium features
    text: {
      primary: '#333',
      secondary: '#666',
      muted: '#999',
      white: '#fff',
    },
    background: {
      primary: '#fff',
      secondary: '#f8f9fa',
      tertiary: '#f0f0f0',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    status: {
      success: '#4CAF50',
      error: '#F44336',
      warning: '#FF9800',
      info: '#2196F3',
    },
    border: {
      light: '#e0e0e0',
      medium: '#ccc',
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
