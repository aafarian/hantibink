import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Logger from '../../utils/logger';
import OAuthService from '../../services/OAuthService';
import ApiClient from '../../services/ApiClient';

// Email validation regex
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(''); // API error state for persistent display

  const scrollViewRef = useRef(null);
  const passwordInputRef = useRef(null);

  const { login, setUser, setToken } = useAuth();
  const { showSuccess, showError } = useToast();

  // Real-time field validation
  const validateField = (field, value) => {
    let error = null;

    switch (field) {
      case 'email':
        if (!value) {
          error = 'Email is required';
        } else if (!EMAIL_REGEX.test(value)) {
          error = 'Please enter a valid email address';
        }
        break;

      case 'password':
        if (!value) {
          error = 'Password is required';
        }
        break;
    }

    if (error) {
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    } else {
      setFieldErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const updateField = (field, value) => {
    if (field === 'email') setEmail(value);
    else if (field === 'password') setPassword(value);

    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: null }));
    }

    // Clear API error when user starts typing
    if (apiError) {
      setApiError('');
    }
  };

  const handleLogin = async () => {
    // Clear any existing API error
    setApiError('');

    // Validate all fields using existing validation function
    validateField('email', email);
    validateField('password', password);

    // Check if there are any errors
    const hasErrors = !email || !EMAIL_REGEX.test(email) || !password;

    if (hasErrors) {
      setApiError('Please fill in all required fields correctly');
      return;
    }

    setLoading(true);

    try {
      const result = await login(email, password);

      if (!result || !result.success) {
        // Handle login errors and set persistent error message
        let errorMessage = '';

        if (
          result?.error?.includes('Invalid email or password') ||
          result?.errorCode === 'auth/wrong-password' ||
          result?.errorCode === 'auth/user-not-found'
        ) {
          errorMessage = 'Invalid email or password combination.';
        } else if (result?.errorCode === 'auth/invalid-email') {
          errorMessage = 'Please enter a valid email address.';
        } else if (result?.error?.includes('Network') || result?.error?.includes('connect')) {
          errorMessage = 'Connection error. Please check your internet and try again.';
        } else if (result?.error?.includes('server') || result?.error?.includes('500')) {
          errorMessage = 'Server error. Please try again later.';
        } else if (result?.error?.includes('rate') || result?.error?.includes('429')) {
          errorMessage = 'Too many login attempts. Please wait a moment and try again.';
        } else {
          // Generic fallback for any other errors
          errorMessage = result?.error || 'Login failed. Please try again.';
        }

        // Set the error to display in UI (no toast needed)
        setApiError(errorMessage);
      } else {
        showSuccess('Welcome back!');
        // Clear any errors on success
        setApiError('');
      }
    } catch (error) {
      // Safety net for any unexpected errors
      Logger.error('Login error:', error);
      const errorMessage = 'Login failed. Please check your connection and try again.';
      setApiError(errorMessage);
    } finally {
      setLoading(false);
    }
    // AppNavigator will handle navigation based on user's onboarding status
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      Logger.info('Starting Google sign-in...');

      // Get Google OAuth token (OAuthService is already instantiated)
      const googleResult = await OAuthService.signInWithGoogle();

      if (!googleResult || (!googleResult.idToken && !googleResult.accessToken)) {
        throw new Error('Failed to get Google authentication token');
      }

      // Send tokens to our backend (ApiClient is already instantiated)
      const response = await ApiClient.post('/auth/oauth/google', {
        idToken: googleResult.idToken,
        accessToken: googleResult.accessToken,
      });

      if (response.success && response.data) {
        const { user, token, refreshToken, isNewUser, requiresSetup, missingFields } =
          response.data.data;

        // Store tokens
        await setToken(token);
        if (refreshToken) {
          await ApiClient.setRefreshToken(refreshToken);
        }

        // Set user in auth context
        await setUser(user);

        if (isNewUser || requiresSetup) {
          // OAuth users need to complete profile (usually birthDate)
          if (missingFields && missingFields.includes('birthDate')) {
            Logger.info('OAuth user needs to provide birthdate');
            navigation.navigate('OAuthComplete', {
              user,
              missingFields,
            });
          } else {
            // Show setup modal for other missing fields
            Logger.info('OAuth user needs profile setup');
          }
        } else {
          // Existing user, login successful
          showSuccess('Welcome back!');
        }
      } else {
        throw new Error(response.message || 'OAuth authentication failed');
      }
    } catch (error) {
      Logger.error('Google sign-in error:', error);

      if (error.message === 'User cancelled') {
        // User cancelled, don't show error
        return;
      }

      showError(error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar backgroundColor="#f8f9fa" barStyle="dark-content" />
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContainer}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 50}
        extraHeight={Platform.OS === 'ios' ? 50 : 80}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableResetScrollToCoords={false}
        keyboardOpeningTime={Number.MAX_SAFE_INTEGER}
        viewIsInsideTabBar={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your journey</Text>
        </View>

        <View style={styles.form}>
          {/* API Error Display */}
          {apiError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#FF6B6B" style={styles.errorIcon} />
              <Text style={styles.errorMessage}>{apiError}</Text>
            </View>
          ) : null}

          <View style={styles.fieldWrapper}>
            <View style={[styles.inputContainer, fieldErrors.email && styles.inputError]}>
              <Ionicons name="mail" size={20} color="#FF6B6B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={value => updateField('email', value)}
                onBlur={() => validateField('email', email)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => {
                  // Focus password field when "next" is pressed
                  passwordInputRef.current?.focus();
                }}
              />
            </View>
            {fieldErrors.email && <Text style={styles.errorText}>{fieldErrors.email}</Text>}
          </View>

          <View style={styles.fieldWrapper}>
            <View style={[styles.inputContainer, fieldErrors.password && styles.inputError]}>
              <Ionicons name="lock-closed" size={20} color="#FF6B6B" style={styles.inputIcon} />
              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={value => updateField('password', value)}
                onBlur={() => validateField('password', password)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
              </TouchableOpacity>
            </View>
            {fieldErrors.password && <Text style={styles.errorText}>{fieldErrors.password}</Text>}
          </View>

          <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <View>
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, loading && styles.googleButtonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#666" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Extra space at bottom for keyboard */}
        <View style={styles.keyboardSpacer} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
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
  passwordToggle: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  footerLink: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: 'bold',
  },
  keyboardSpacer: {
    height: 50,
  },
  fieldWrapper: {
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFD1D1',
  },
  errorIcon: {
    marginRight: 10,
  },
  errorMessage: {
    flex: 1,
    color: '#D32F2F',
    fontSize: 14,
    lineHeight: 18,
  },
});

export default LoginScreen;
