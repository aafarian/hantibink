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
    if (percentage >= 80) return '#4CAF50'; // Green
    if (percentage >= 50) return '#FF9800'; // Orange
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
          {onPress && <Ionicons name="chevron-forward" size={16} color="#999" />}
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
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  // Compact styles
  compactContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  compactPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 4,
  },
  compactLabel: {
    fontSize: 13,
    color: '#666',
    marginRight: 10,
  },
  compactHint: {
    flex: 1,
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
});

export default ProfileCompletionBar;
