import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

const REPORT_REASONS = [
  { value: 'INAPPROPRIATE_PHOTOS', label: 'Inappropriate Photos' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'FAKE_PROFILE', label: 'Fake Profile' },
  { value: 'UNDERAGE', label: 'Underage User' },
  { value: 'OTHER', label: 'Other' },
];

const ReportReasonModal = ({ visible, userName, onSubmit, onCancel, isSubmitting = false }) => {
  const [selectedReason, setSelectedReason] = useState(null);
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit(selectedReason, description.trim() || null);
  };

  const handleCancel = () => {
    setSelectedReason(null);
    setDescription('');
    onCancel();
  };

  const isOtherSelected = selectedReason === 'OTHER';
  const canSubmit = selectedReason && (!isOtherSelected || description.trim());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>Report {userName}</Text>
                <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                  <Ionicons
                    name="close"
                    size={theme.icons.md}
                    color={theme.colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.subtitle}>Why are you reporting this user?</Text>

              <ScrollView style={styles.reasonsContainer} showsVerticalScrollIndicator={false}>
                {REPORT_REASONS.map(reason => (
                  <TouchableOpacity
                    key={reason.value}
                    style={[
                      styles.reasonOption,
                      selectedReason === reason.value && styles.reasonOptionSelected,
                    ]}
                    onPress={() => setSelectedReason(reason.value)}
                  >
                    <View style={styles.radioOuter}>
                      {selectedReason === reason.value && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.reasonText,
                        selectedReason === reason.value && styles.reasonTextSelected,
                      ]}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                {selectedReason && (
                  <View style={styles.descriptionContainer}>
                    <Text style={styles.descriptionLabel}>
                      {isOtherSelected
                        ? 'Please describe (required)'
                        : 'Additional details (optional)'}
                    </Text>
                    <TextInput
                      style={styles.descriptionInput}
                      placeholder="Tell us more about what happened..."
                      placeholderTextColor={theme.colors.text.muted}
                      multiline
                      numberOfLines={4}
                      maxLength={500}
                      value={description}
                      onChangeText={setDescription}
                      textAlignVertical="top"
                    />
                    <Text style={styles.charCount}>{description.length}/500</Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={theme.colors.text.white} />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Report</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background.primary,
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.tertiary,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.secondary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
  },
  reasonsContainer: {
    paddingHorizontal: theme.spacing.xl,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.tertiary,
  },
  reasonOptionSelected: {
    backgroundColor: `${theme.colors.primary}08`,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  reasonText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text.primary,
  },
  reasonTextSelected: {
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.primary,
  },
  descriptionContainer: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  descriptionLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: 15,
    color: theme.colors.text.primary,
    minHeight: 100,
  },
  charCount: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.muted,
    textAlign: 'right',
    marginTop: theme.spacing.xs,
  },
  footer: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.colors.background.tertiary,
  },
  submitButton: {
    backgroundColor: theme.colors.status.error,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.white,
  },
});

export default ReportReasonModal;
