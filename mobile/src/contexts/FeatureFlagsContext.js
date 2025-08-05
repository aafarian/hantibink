import React, { createContext, useContext, useState } from 'react';
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
  // 🚀 TEMPORARY FLAG - Replace this with actual subscription logic later
  // For now, set to false to test premium gating, true to test features
  const [isPremiumUser, setIsPremiumUser] = useState(false);

  // 📝 Future: This will be replaced with actual subscription status
  // const { user, subscription } = useAuth();
  // const isPremiumUser = subscription?.status === 'active' && subscription?.plan === 'premium';

  // Check if a specific premium feature is enabled
  const hasFeature = _featureName => {
    // 🎯 Future: Could add per-feature subscription tiers here
    // For now, all premium features require premium subscription
    // Note: _featureName parameter preserved for API compatibility but not used yet
    return isPremiumUser;
  };

  // Get user's premium status
  const getPremiumStatus = () => ({
    isPremium: isPremiumUser,
    // 📝 Future: Add subscription details
    // plan: subscription?.plan,
    // expiresAt: subscription?.expiresAt,
    // features: subscription?.features || [],
  });

  // 🧪 Development helper - Remove in production
  const togglePremiumForTesting = () => {
    setIsPremiumUser(prev => {
      const newValue = !prev;
      Logger.info(`🎛️  Premium status toggled to: ${newValue}`);
      return newValue;
    });
  };

  const value = {
    // Feature checking
    hasFeature,

    // Premium status
    isPremium: isPremiumUser,
    premiumStatus: getPremiumStatus(),

    // Feature constants (for easy reference)
    FEATURES: PREMIUM_FEATURES,

    // 🧪 Development helpers
    togglePremiumForTesting: __DEV__ ? togglePremiumForTesting : undefined,

    // 📝 Future: Premium upgrade actions
    // upgradePrompt: showUpgradePrompt,
    // purchasePremium: handlePremiumPurchase,
  };

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
