import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../contexts/ToastContext';
import { theme } from '../../styles/theme';
import apiClient from '../../services/ApiClient';
import Logger from '../../utils/logger';

const SetNewPasswordScreen = ({ navigation, route }) => {
  const { resetToken } = route.params;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { showError, showSuccess } = useToast();

  // Password strength validation
  const getPasswordStrength = pwd => {
    if (!pwd) return { strength: 0, label: '', color: '#ccc' };

    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    if (strength <= 1) return { strength: 1, label: 'Weak', color: '#D32F2F' };
    if (strength <= 2) return { strength: 2, label: 'Fair', color: '#FF9800' };
    if (strength <= 3) return { strength: 3, label: 'Good', color: '#FFC107' };
    if (strength <= 4) return { strength: 4, label: 'Strong', color: '#4CAF50' };
    return { strength: 5, label: 'Very Strong', color: '#2E7D32' };
  };

  const passwordStrength = getPasswordStrength(password);

  const validatePassword = () => {
    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return false;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) return;

    setLoading(true);
    try {
      const response = await apiClient.resetPassword(resetToken, password);

      if (response.success) {
        Logger.info('Password reset successful');
        showSuccess('Password updated successfully!');
        // Navigate to login and clear the stack
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        showError(response.message || 'Failed to reset password. Please try again.');
      }
    } catch (error) {
      Logger.error('Reset password error:', error);
      showError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="key" size={80} color={theme.colors.primary} />
        </View>

        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>
          Create a strong password for your account. Make sure it's at least 6 characters.
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons
            name="lock-closed"
            size={20}
            color={theme.colors.primary}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="New Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#999" />
          </TouchableOpacity>
        </View>

        {password.length > 0 && (
          <View style={styles.strengthContainer}>
            <View style={styles.strengthBars}>
              {[1, 2, 3, 4, 5].map(level => (
                <View
                  key={level}
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor:
                        level <= passwordStrength.strength ? passwordStrength.color : '#e0e0e0',
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
              {passwordStrength.label}
            </Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Ionicons
            name="lock-closed"
            size={20}
            color={theme.colors.primary}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={22} color="#999" />
          </TouchableOpacity>
        </View>

        {confirmPassword.length > 0 && (
          <View style={styles.matchIndicator}>
            <Ionicons
              name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={password === confirmPassword ? '#4CAF50' : '#D32F2F'}
            />
            <Text
              style={[
                styles.matchText,
                { color: password === confirmPassword ? '#4CAF50' : '#D32F2F' },
              ]}
            >
              {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.resetButton,
            (loading || !password || !confirmPassword) && styles.buttonDisabled,
          ]}
          onPress={handleResetPassword}
          disabled={loading || !password || !confirmPassword}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.resetButtonText}>Update Password</Text>
          )}
        </TouchableOpacity>

        <View style={styles.requirements}>
          <Text style={styles.requirementsTitle}>Password requirements:</Text>
          <View style={styles.requirementItem}>
            <Ionicons
              name={password.length >= 6 ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={password.length >= 6 ? '#4CAF50' : '#999'}
            />
            <Text style={styles.requirementText}>At least 6 characters</Text>
          </View>
          <View style={styles.requirementItem}>
            <Ionicons
              name={/[A-Z]/.test(password) ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={/[A-Z]/.test(password) ? '#4CAF50' : '#999'}
            />
            <Text style={styles.requirementText}>One uppercase letter (recommended)</Text>
          </View>
          <View style={styles.requirementItem}>
            <Ionicons
              name={/[0-9]/.test(password) ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={/[0-9]/.test(password) ? '#4CAF50' : '#999'}
            />
            <Text style={styles.requirementText}>One number (recommended)</Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 0,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 80,
    textAlign: 'right',
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  matchText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resetButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requirements: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 13,
    color: '#666',
  },
});

export default SetNewPasswordScreen;
