import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

/**
 * Profile completion bar component
 * Shows percentage complete for key fields that improve match quality
 * Tracks: Photos, Bio, Height, Looking For
 *
 * @param {Object} userProfile - The saved user profile data
 * @param {Object} formData - Optional live form data for real-time updates during editing
 * @param {Function} onPress - Optional press handler
 * @param {boolean} compact - Whether to show compact version
 */
const ProfileCompletionBar = ({ userProfile, formData, onPress, compact = false }) => {
  // Calculate completion percentage based on high-value fields
  // Use formData if provided (for live editing), otherwise fall back to userProfile
  const { percentage, missingFields } = useMemo(() => {
    const data = formData || userProfile;
    if (!data) {
      return { percentage: 0, missingFields: [] };
    }

    // Check if user has at least one photo
    const hasPhotos =
      (data.photos && data.photos.length > 0) ||
      (data.localPhotos && data.localPhotos.some(p => p !== null));

    // Track fields that genuinely improve match quality
    const fields = [
      { key: 'photos', label: 'Photos', filled: hasPhotos },
      { key: 'bio', label: 'Bio', filled: !!data.bio },
      { key: 'profession', label: 'Work', filled: !!data.profession },
      { key: 'height', label: 'Height', filled: !!data.height },
      {
        key: 'relationshipType',
        label: 'Looking For',
        filled:
          !!data.relationshipType &&
          (Array.isArray(data.relationshipType) ? data.relationshipType.length > 0 : true),
      },
    ];

    const filledCount = fields.filter(f => f.filled).length;
    const pct = Math.round((filledCount / fields.length) * 100);
    const missing = fields.filter(f => !f.filled).map(f => f.label);

    return {
      percentage: pct,
      missingFields: missing,
    };
  }, [userProfile, formData]);

  // Don't show if profile is 100% complete
  if (percentage === 100) {
    return null;
  }

  // Determine color based on percentage
  const getProgressColor = () => {
    if (percentage >= 80) return theme.colors.status.success; // Green
    if (percentage >= 50) return theme.colors.status.warning; // Orange
    return theme.colors.primary; // Red/Pink
  };

  if (compact) {
    const Container = onPress ? TouchableOpacity : View;
    const containerProps = onPress ? { onPress, activeOpacity: 0.8 } : {};

    return (
      <Container style={styles.compactContainer} {...containerProps}>
        <View style={styles.compactHeader}>
          <View style={styles.compactLeft}>
            <Text style={[styles.compactPercentage, { color: getProgressColor() }]}>
              {percentage}%
            </Text>
            <Text style={styles.compactLabel}>Complete</Text>
          </View>
          {missingFields.length > 0 && (
            <Text style={styles.compactHint}>Add {missingFields.join(', ')}</Text>
          )}
          {onPress && <Ionicons name="chevron-forward" size={16} color={theme.colors.gray[500]} />}
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${percentage}%`, backgroundColor: getProgressColor() },
            ]}
          />
        </View>
      </Container>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${percentage}%`, backgroundColor: getProgressColor() },
            ]}
          />
        </View>
        <Text style={[styles.percentage, { color: getProgressColor() }]}>{percentage}%</Text>
      </View>
      <Text style={styles.subtitle}>
        {missingFields.length > 0
          ? `Add ${missingFields.slice(0, 2).join(', ')}${missingFields.length > 2 ? ` +${missingFields.length - 2} more` : ''} to complete your profile`
          : 'Almost there!'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.primary,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  percentage: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[500],
    marginTop: theme.spacing.xs,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  // Compact styles
  compactContainer: {
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  compactPercentage: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
    marginRight: theme.spacing.xs,
  },
  compactLabel: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[600],
    marginRight: theme.spacing.sm,
  },
  compactHint: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[500],
    textAlign: 'right',
  },
});

export default ProfileCompletionBar;
