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
                  <Ionicons name="close" size={24} color="#666" />
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
                      placeholderTextColor="#999"
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
                    <ActivityIndicator color="#fff" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  reasonsContainer: {
    paddingHorizontal: 20,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reasonOptionSelected: {
    backgroundColor: `${theme.colors.primary}08`,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  reasonText: {
    fontSize: 16,
    color: '#333',
  },
  reasonTextSelected: {
    fontWeight: '500',
    color: theme.colors.primary,
  },
  descriptionContainer: {
    marginTop: 16,
    marginBottom: 20,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#333',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  submitButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ReportReasonModal;
