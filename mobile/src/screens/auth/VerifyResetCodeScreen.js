import React, { useState, useRef, useEffect } from 'react';
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

const CODE_LENGTH = 6;
const EXPIRY_MINUTES = 15;

const VerifyResetCodeScreen = ({ navigation, route }) => {
  const { email } = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXPIRY_MINUTES * 60);
  const inputRefs = useRef([]);

  const { showError, showSuccess } = useToast();

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = (value, index) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (value && index === CODE_LENGTH - 1) {
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace - move to previous input
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (codeString = null) => {
    const fullCode = codeString || code.join('');

    if (fullCode.length !== CODE_LENGTH) {
      showError('Please enter the complete 6-digit code');
      return;
    }

    if (timeLeft <= 0) {
      showError('Code has expired. Please request a new one.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.verifyResetCode(email, fullCode);

      if (response.success) {
        Logger.info('Reset code verified successfully');
        navigation.replace('SetNewPassword', {
          email,
          resetToken: response.data.resetToken,
        });
      } else {
        showError(response.message || 'Invalid code. Please try again.');
        // Clear the code on error
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      Logger.error('Verify reset code error:', error);
      showError('Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      const response = await apiClient.forgotPassword(email);

      if (response.success) {
        showSuccess('A new code has been sent to your email');
        setTimeLeft(EXPIRY_MINUTES * 60);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        showError(response.message || 'Failed to resend code');
      }
    } catch (error) {
      Logger.error('Resend code error:', error);
      showError('Failed to resend code. Please try again.');
    } finally {
      setResending(false);
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
          <Ionicons name="mail-open" size={80} color={theme.colors.primary} />
        </View>

        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.emailText}>{email}</Text>
        </Text>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => (inputRefs.current[index] = ref)}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled,
                timeLeft <= 0 && styles.codeInputExpired,
              ]}
              value={digit}
              onChangeText={value => handleCodeChange(value, index)}
              onKeyPress={e => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={timeLeft > 0 && !loading}
            />
          ))}
        </View>

        <View style={styles.timerContainer}>
          {timeLeft > 0 ? (
            <Text style={styles.timerText}>
              Code expires in <Text style={styles.timerValue}>{formatTime(timeLeft)}</Text>
            </Text>
          ) : (
            <Text style={styles.expiredText}>Code has expired</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, (loading || timeLeft <= 0) && styles.buttonDisabled]}
          onPress={() => handleVerify()}
          disabled={loading || timeLeft <= 0}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify Code</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code?</Text>
          <TouchableOpacity onPress={handleResendCode} disabled={resending}>
            {resending ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={styles.resendLink}>Resend Code</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.backToLogin} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.backToLoginText}>Back to Login</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
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
  emailText: {
    fontWeight: '600',
    color: '#333',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  codeInputFilled: {
    borderColor: theme.colors.primary,
  },
  codeInputExpired: {
    borderColor: '#ccc',
    backgroundColor: '#f0f0f0',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerText: {
    fontSize: 14,
    color: '#666',
  },
  timerValue: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  expiredText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: '500',
  },
  verifyButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  backToLogin: {
    alignItems: 'center',
  },
  backToLoginText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VerifyResetCodeScreen;
