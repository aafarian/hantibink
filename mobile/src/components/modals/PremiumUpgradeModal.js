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
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getPremiumPackages,
  purchasePremium,
  restorePurchases,
  isPurchasesReady,
} from '../../utils/purchases';
import Logger from '../../utils/logger';
import { theme } from '../../styles/theme';

const PACKAGE_LABELS = {
  MONTHLY: 'Monthly',
  THREE_MONTH: '3 Months',
  ANNUAL: 'Yearly',
};

const PACKAGE_MONTHS = {
  MONTHLY: 1,
  THREE_MONTH: 3,
  ANNUAL: 12,
};

const PACKAGE_BADGES = {
  ANNUAL: 'BEST VALUE',
  THREE_MONTH: 'POPULAR',
};

const PACKAGE_PERIODS = {
  MONTHLY: '/month',
  THREE_MONTH: '/3 months',
  ANNUAL: '/year',
};

/** "$5.00/mo" equivalent for multi-month packages, null for monthly. */
const formatPerMonth = pkg => {
  const months = PACKAGE_MONTHS[pkg.packageType];
  if (!months || months === 1 || !pkg.product?.price) {
    return null;
  }
  const perMonth = pkg.product.price / months;
  if (pkg.product.currencyCode) {
    try {
      const formatted = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: pkg.product.currencyCode,
      }).format(perMonth);
      return `${formatted}/mo`;
    } catch {
      // Intl or the currency code unavailable — derive from priceString below
    }
  }
  const symbol = (pkg.product.priceString || '').replace(/[\d.,\s]/g, '');
  return `${symbol}${perMonth.toFixed(2)}/mo`;
};

/** "Save 50%" vs paying monthly, null when it doesn't apply. */
const formatSavings = (pkg, packages) => {
  const months = PACKAGE_MONTHS[pkg.packageType];
  const monthly = packages.find(p => p.packageType === 'MONTHLY');
  if (!months || months === 1 || !monthly?.product?.price || !pkg.product?.price) {
    return null;
  }
  const pct = Math.round((1 - pkg.product.price / months / monthly.product.price) * 100);
  return pct >= 5 ? `Save ${pct}%` : null;
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
  const { showSuccess } = useToast();
  const [packages, setPackages] = useState([]);
  const [buying, setBuying] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  // In-modal feedback line: toasts render beneath native modals, so any
  // message that must be read while the modal is open lands here instead
  const [notice, setNotice] = useState(null);

  const [selectedId, setSelectedId] = useState(null);

  // Live prices from RevenueCat; empty in builds without an RC key, where
  // the legacy single CTA renders instead. Monthly starts selected (the
  // most common choice); the BEST VALUE badge still points at yearly.
  useEffect(() => {
    if (visible) {
      getPremiumPackages()
        .then(pkgs => {
          setPackages(pkgs);
          const monthly = pkgs.find(p => p.packageType === 'MONTHLY');
          setSelectedId((monthly || pkgs[0])?.identifier ?? null);
        })
        .catch(error => {
          // Contained: an empty list falls back to the legacy CTA path
          Logger.error('Failed to load premium packages:', error);
          setPackages([]);
          setSelectedId(null);
        });
    }
  }, [visible]);

  const handlePurchase = useCallback(
    async pkg => {
      if (buying) {
        return;
      }
      setBuying(pkg.identifier);
      setNotice(null);
      try {
        const result = await purchasePremium(pkg);
        if (result.success && result.active) {
          // The webhook flips the server flag; refresh picks it up
          await refreshUserProfile?.();
          showSuccess('Premium is active. Enjoy!');
          onClose?.();
        } else if (!result.cancelled) {
          setNotice(result.message || 'Purchase failed. You were not charged.');
        }
      } finally {
        setBuying(null);
      }
    },
    [buying, refreshUserProfile, showSuccess, onClose]
  );

  const handleRestore = useCallback(async () => {
    if (restoring) {
      return;
    }
    setRestoring(true);
    setNotice(null);
    try {
      const result = await restorePurchases();
      if (result.active) {
        await refreshUserProfile?.();
        showSuccess('Premium restored!');
        onClose?.();
      } else {
        setNotice(result.message || 'No previous purchase found for this account.');
      }
    } finally {
      setRestoring(false);
    }
  }, [restoring, refreshUserProfile, showSuccess, onClose]);

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
      setComingSoon(false);
      setNotice(null);
    }
  }, [visible, overlayOpacity]);

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
      onClose();
      return;
    }
    // Keyless build (no RevenueCat key baked in): no purchase can start
    // here. Feedback must render INSIDE the modal — native modals sit
    // above the toast host, so a toast would be invisible.
    setComingSoon(true);
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

          {/* Only the header and feature list scroll; everything a purchase
              needs (packages, CTA, disclosure, restore) stays pinned below */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.premiumBadge}>
                <Ionicons name="diamond" size={24} color={theme.colors.premium} />
              </View>
              <Text style={styles.title}>Upgrade to Premium</Text>
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
                    <Ionicons name={feature.icon} size={20} color={feature.iconColor} />
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>{feature.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Purchase cluster pinned BELOW the scroll — the buy button and
              auto-renew disclosure are always visible. Live store prices,
              or the legacy CTA when this build has no RevenueCat key.
              Tapping a card selects; Continue confirms — no buy-on-tap. */}
          {packages.length > 0 ? (
            <>
              <View style={styles.packagesRow}>
                {packages.map(pkg => {
                  const isSelected = pkg.identifier === selectedId;
                  const badge = PACKAGE_BADGES[pkg.packageType];
                  const perMonth = formatPerMonth(pkg);
                  const savings = formatSavings(pkg, packages);
                  return (
                    <TouchableOpacity
                      key={pkg.identifier}
                      style={[styles.packageOption, isSelected && styles.packageOptionSelected]}
                      disabled={!!buying}
                      onPress={() => setSelectedId(pkg.identifier)}
                      activeOpacity={0.85}
                    >
                      {isSelected && (
                        <LinearGradient
                          colors={[theme.colors.accentLight, theme.colors.premium]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <View style={styles.packageBadgeSlot}>
                        {badge && (
                          <View
                            style={[styles.packageBadge, isSelected && styles.packageBadgeSelected]}
                          >
                            <Text style={styles.packageBadgeText}>{badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.packageLabel, isSelected && styles.packageTextSelected]}>
                        {PACKAGE_LABELS[pkg.packageType] || pkg.packageType}
                      </Text>
                      <Text style={[styles.packagePrice, isSelected && styles.packageTextSelected]}>
                        {pkg.product?.priceString || '—'}
                      </Text>
                      <Text
                        style={[styles.packageDetail, isSelected && styles.packageDetailSelected]}
                      >
                        {perMonth || ' '}
                      </Text>
                      <Text
                        style={[styles.packageSavings, isSelected && styles.packageTextSelected]}
                      >
                        {savings || ' '}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.continueButton}
                disabled={!selectedId || !!buying}
                onPress={() => {
                  const pkg = packages.find(p => p.identifier === selectedId);
                  if (pkg) {
                    handlePurchase(pkg);
                  }
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[theme.colors.accentLight, theme.colors.premium]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.continueGradient}
                >
                  {buying ? (
                    <ActivityIndicator size="small" color={theme.colors.text.white} />
                  ) : (
                    <Text style={styles.continueText}>
                      {(() => {
                        const pkg = packages.find(p => p.identifier === selectedId);
                        return pkg?.product?.priceString
                          ? `Continue • ${pkg.product.priceString}${PACKAGE_PERIODS[pkg.packageType] || ''}`
                          : 'Continue';
                      })()}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.finePrint}>
                Auto-renews until cancelled. Cancel anytime in your{' '}
                {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} settings.
              </Text>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.upgradeButton, comingSoon && styles.upgradeButtonDisabled]}
              onPress={handleUpgrade}
              activeOpacity={0.8}
              disabled={comingSoon}
            >
              <Text style={styles.upgradeButtonText}>
                {comingSoon ? 'Purchases coming soon' : 'Get Premium'}
              </Text>
            </TouchableOpacity>
          )}

          {/* In-modal feedback (purchase/restore failures) */}
          {notice && <Text style={styles.noticeText}>{notice}</Text>}

          {/* App Store requires a visible restore path wherever purchases
              can happen; keyless builds have neither, so no dead control */}
          {isPurchasesReady() && (
            <TouchableOpacity
              style={styles.laterButton}
              onPress={handleRestore}
              disabled={restoring}
            >
              <Text style={styles.laterButtonText}>
                {restoring ? 'Restoring…' : 'Restore Purchases'}
              </Text>
            </TouchableOpacity>
          )}

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
    maxHeight: '88%',
  },
  scrollArea: {
    flexShrink: 1,
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
    marginBottom: theme.spacing.lg,
  },
  premiumBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${theme.colors.premium}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.sizes.xxxl,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  featuresContainer: {
    marginBottom: theme.spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  featureIconContainer: {
    width: 38,
    height: 38,
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
    marginBottom: theme.spacing.md,
  },
  packageOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.background.primary,
    overflow: 'hidden',
  },
  packageOptionSelected: {
    borderColor: theme.colors.premium,
    ...theme.shadows.medium,
  },
  packageBadgeSlot: {
    height: 18,
    marginBottom: theme.spacing.xs,
    justifyContent: 'center',
  },
  packageBadge: {
    backgroundColor: theme.colors.premium,
    borderRadius: theme.borderRadius.round,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  packageBadgeSelected: {
    backgroundColor: theme.colors.overlay.light,
  },
  packageBadgeText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.white,
    letterSpacing: 0.5,
  },
  packageLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  packagePrice: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.premium,
    marginTop: 2,
  },
  packageDetail: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  packageDetailSelected: {
    color: theme.colors.text.white,
    opacity: 0.9,
  },
  packageSavings: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.status.success,
    marginTop: 2,
  },
  packageTextSelected: {
    color: theme.colors.text.white,
  },
  continueButton: {
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  continueGradient: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  continueText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
  },
  finePrint: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
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
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  laterButtonText: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
  },
  upgradeButtonDisabled: {
    opacity: 0.65,
  },
  noticeText: {
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.bodyMedium,
  },
});

export default PremiumUpgradeModal;
