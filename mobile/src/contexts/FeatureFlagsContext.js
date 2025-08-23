import React, { createContext, useContext, useState, useMemo } from 'react';
import { useAuth } from './AuthContext';
import Logger from '../utils/logger';

const FeatureFlagsContext = createContext();

// Define all premium features in one place
const PREMIUM_FEATURES = {
  READ_RECEIPTS: 'read_receipts',
  TYPING_INDICATORS_LIST: 'typing_indicators_list',
  UNLIMITED_LIKES: 'unlimited_likes',
  SUPER_LIKES: 'super_likes',
  ADVANCED_FILTERS: 'advanced_filters',
  LOCATION_HISTORY: 'location_history',
  MESSAGE_PRIORITY: 'message_priority',
  PROFILE_BOOST: 'profile_boost',
  // Add more premium features here as needed
};

export const FeatureFlagsProvider = ({ children }) => {
  const { userProfile } = useAuth();

  // Use the actual premium status from user profile, with override for testing
  const [premiumOverride, setPremiumOverride] = useState(null);

  // Memoize the premium status to prevent unnecessary re-renders
  const isPremiumUser = useMemo(() => {
    return premiumOverride !== null ? premiumOverride : userProfile?.isPremium || false;
  }, [premiumOverride, userProfile?.isPremium]);

  // Memoize hasFeature to prevent recreation on every render
  const hasFeature = useMemo(
    () => _featureName => {
      // 🎯 Future: Could add per-feature subscription tiers here
      // For now, all premium features require premium subscription
      // Note: _featureName parameter preserved for API compatibility but not used yet
      return isPremiumUser;
    },
    [isPremiumUser]
  );

  // Memoize premium status object
  const premiumStatus = useMemo(
    () => ({
      isPremium: isPremiumUser,
      // 📝 Future: Add subscription details
      // plan: subscription?.plan,
      // expiresAt: subscription?.expiresAt,
      // features: subscription?.features || [],
    }),
    [isPremiumUser]
  );

  // 🧪 Development helper - Remove in production
  const togglePremiumForTesting = useMemo(
    () =>
      __DEV__
        ? () => {
            const currentValue = isPremiumUser;
            const newValue = !currentValue;
            setPremiumOverride(newValue);
            Logger.info(`🎛️  Premium status override set to: ${newValue}`);
          }
        : undefined,
    [isPremiumUser]
  );

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      // Feature checking
      hasFeature,

      // Premium status
      isPremium: isPremiumUser,
      premiumStatus,

      // Feature constants (for easy reference)
      FEATURES: PREMIUM_FEATURES,

      // 🧪 Development helpers
      togglePremiumForTesting,

      // 📝 Future: Premium upgrade actions
      // upgradePrompt: showUpgradePrompt,
      // purchasePremium: handlePremiumPurchase,
    }),
    [hasFeature, isPremiumUser, premiumStatus, togglePremiumForTesting]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
};

// 🎯 Convenience hooks for common checks
export const usePremiumFeature = featureName => {
  const { hasFeature } = useFeatureFlags();
  return hasFeature(featureName);
};

export const useIsPremium = () => {
  const { isPremium } = useFeatureFlags();
  return isPremium;
};

export default FeatureFlagsContext;
