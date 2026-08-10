import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getPremiumPackages, purchasePremium, restorePurchases } from '../../utils/purchases';
import { theme } from '../../styles/theme';

const PACKAGE_LABELS = {
  MONTHLY: 'Monthly',
  THREE_MONTH: '3 Months',
  ANNUAL: 'Yearly',
};

/**
 * Premium features:
 * - See who liked you (free users cannot see at all)
 * - Unlimited likes (free: 10/day)
 * - 5 Super Likes per day (free: 0)
 * - Undo your last swipe (free: cannot undo)
 * - Read receipts, online status, typing indicators
 */
const PREMIUM_FEATURES = [
  {
    icon: 'eye',
    iconColor: theme.colors.secondary,
    title: 'See Who Likes You',
    description: 'Know who is interested before you swipe',
  },
  {
    icon: 'infinite',
    iconColor: theme.colors.primary,
    title: 'Unlimited Likes',
    description: 'Swipe right as much as you want',
  },
  {
    icon: 'star',
    iconColor: theme.colors.premium,
    title: '2 Super Likes a Day',
    description: 'Bank up to 5 and use them when it counts',
  },
  {
    icon: 'arrow-undo',
    iconColor: theme.colors.accent,
    title: 'Undo Swipes',
    description: 'Made a mistake? Go back and try again',
  },
  {
    icon: 'chatbubbles',
    iconColor: theme.colors.status.info,
    title: 'Enhanced Messaging',
    description: 'Read receipts, typing indicators & online status',
  },
];

const PremiumUpgradeModal = ({ visible, onClose, onUpgrade }) => {
  const insets = useSafeAreaInsets();
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const { refreshUserProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [packages, setPackages] = useState([]);
  const [buying, setBuying] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Live prices from RevenueCat; empty in builds without an RC key, where
  // the legacy single CTA renders instead
  useEffect(() => {
    if (visible) {
      getPremiumPackages().then(setPackages);
    }
  }, [visible]);

  const handlePurchase = useCallback(
    async pkg => {
      if (buying) {
        return;
      }
      setBuying(pkg.identifier);
      try {
        const result = await purchasePremium(pkg);
        if (result.success && result.active) {
          // The webhook flips the server flag; refresh picks it up
          await refreshUserProfile?.();
          showSuccess('Premium is active. Enjoy!');
          onClose?.();
        } else if (!result.cancelled) {
          showError(result.message || 'Purchase failed. You were not charged.');
        }
      } finally {
        setBuying(null);
      }
    },
    [buying, refreshUserProfile, showSuccess, showError, onClose]
  );

  const handleRestore = useCallback(async () => {
    if (restoring) {
      return;
    }
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.active) {
        await refreshUserProfile?.();
        showSuccess('Premium restored!');
        onClose?.();
      } else {
        showError(result.message || 'No previous purchase found for this account.');
      }
    } finally {
      setRestoring(false);
    }
  }, [restoring, refreshUserProfile, showSuccess, showError, onClose]);

  useEffect(() => {
    if (visible) {
      // Fade in overlay after modal starts sliding up
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        delay: 100,
        useNativeDriver: true,
      }).start();
    } else {
      overlayOpacity.setValue(0);
    }
  }, [visible, overlayOpacity]);

  const handleUpgrade = () => {
    onUpgrade?.();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Animated overlay that fades in after modal slides up */}
        <Animated.View style={[styles.overlayBackground, { opacity: overlayOpacity }]} />

        {/* Tappable background to dismiss */}
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.premiumBadge}>
              <Ionicons name="diamond" size={32} color={theme.colors.premium} />
            </View>
            <Text style={styles.title}>Upgrade to Premium</Text>
            <Text style={styles.subtitle}>Get the most out of your experience</Text>
          </View>

          {/* Features list */}
          <View style={styles.featuresContainer}>
            {PREMIUM_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <View
                  style={[
                    styles.featureIconContainer,
                    { backgroundColor: `${feature.iconColor}15` },
                  ]}
                >
                  <Ionicons name={feature.icon} size={22} color={feature.iconColor} />
                </View>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Purchase options (live store prices) or the legacy CTA when
              this build has no RevenueCat key */}
          {packages.length > 0 ? (
            <View style={styles.packagesRow}>
              {packages.map(pkg => (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.packageOption, buying === pkg.identifier && styles.packageBuying]}
                  disabled={!!buying}
                  onPress={() => handlePurchase(pkg)}
                  activeOpacity={0.8}
                >
                  {buying === pkg.identifier ? (
                    <ActivityIndicator size="small" color={theme.colors.premium} />
                  ) : (
                    <>
                      <Text style={styles.packageLabel}>
                        {PACKAGE_LABELS[pkg.packageType] || pkg.packageType}
                      </Text>
                      <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={handleUpgrade}
              activeOpacity={0.8}
            >
              <Text style={styles.upgradeButtonText}>Get Premium</Text>
            </TouchableOpacity>
          )}

          {/* App Store requires a visible restore path */}
          <TouchableOpacity style={styles.laterButton} onPress={handleRestore} disabled={restoring}>
            <Text style={styles.laterButtonText}>
              {restoring ? 'Restoring…' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>

          {/* Secondary action */}
          <TouchableOpacity style={styles.laterButton} onPress={onClose}>
            <Text style={styles.laterButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay.medium,
  },
  dismissArea: {
    flex: 1,
  },
  container: {
    backgroundColor: theme.colors.background.primary,
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
  },
  closeIcon: {
    position: 'absolute',
    top: theme.spacing.lg,
    right: theme.spacing.lg,
    padding: theme.spacing.xs,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  premiumBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${theme.colors.premium}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.sizes.xxxl,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  featuresContainer: {
    marginBottom: theme.spacing.xxl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  packagesRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  packageOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.premium,
    backgroundColor: `${theme.colors.premium}10`,
    minHeight: 64,
  },
  packageBuying: {
    opacity: 0.7,
  },
  packageLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
  },
  packagePrice: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.premium,
    marginTop: 2,
  },
  upgradeButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  upgradeButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
  },
  laterButton: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  laterButtonText: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
  },
});

export default PremiumUpgradeModal;
