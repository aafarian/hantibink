import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VerifiedBadge from '../shared/VerifiedBadge';
import useVerification from '../../hooks/useVerification';
import { theme } from '../../styles/theme';

/**
 * Verification call-to-action card.
 *
 * Default (banner) variant: prominent tappable card when the user is
 * unverified (NONE/REJECTED), subdued non-tappable card while PENDING,
 * nothing when APPROVED (the badge next to the name already shows it).
 *
 * Compact variant (edit-profile photos section): only shown for
 * NONE/REJECTED.
 */
const VerificationPrompt = ({ compact = false, verification }) => {
  // A caller rendering several prompts (banner + settings row) passes ONE
  // hook instance so the submit lock is shared; the own instance is the
  // standalone fallback (hooks must be called unconditionally)
  const own = useVerification();
  const { verificationStatus, isVerified, isSubmitting, startVerification } = verification || own;

  if (isVerified) {
    return null;
  }

  if (verificationStatus === 'PENDING') {
    if (compact) {
      return null;
    }
    return (
      <View style={[styles.card, styles.cardPending]}>
        <View style={[styles.iconCircle, styles.iconCirclePending]}>
          <Ionicons name="hourglass-outline" size={22} color={theme.colors.text.muted} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.pendingTitle}>Verification in review — we'll notify you</Text>
        </View>
      </View>
    );
  }

  // NONE or REJECTED
  const title =
    verificationStatus === 'REJECTED' ? 'Verification declined — try again' : 'Get verified';

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={startVerification}
      disabled={isSubmitting}
      activeOpacity={0.7}
    >
      <View style={styles.iconCircle}>
        <VerifiedBadge size={22} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{isSubmitting ? 'Submitting verification…' : title}</Text>
        <Text style={styles.subtitle}>
          Show people you're real — verified profiles get more matches
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.border.medium} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondaryLight,
    borderWidth: 1,
    borderColor: theme.colors.secondaryTint,
  },
  cardCompact: {
    marginHorizontal: 0,
    marginTop: 16,
    marginBottom: 0,
    padding: 12,
  },
  cardPending: {
    borderLeftColor: theme.colors.border.medium,
    borderColor: theme.colors.border.light,
    opacity: 0.8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.secondaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePending: {
    backgroundColor: theme.colors.background.tertiary,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 2,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
    fontFamily: theme.typography.fontFamily.regular,
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.muted,
    fontFamily: theme.typography.fontFamily.medium,
  },
});

export default VerificationPrompt;
