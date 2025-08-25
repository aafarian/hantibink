import React, { createContext, useContext, useState, useEffect } from 'react';
import ApiDataService from '../services/ApiDataService';
import apiClient from '../services/ApiClient';
import SocketService from '../services/SocketService';
import Logger from '../utils/logger';
import { uploadImageToFirebase } from '../utils/imageUpload';

/**
 * Transform API profile format to Firebase format
 * Ensures compatibility with existing UI components
 */
const transformApiProfileToFirebaseFormat = apiProfile => {
  if (!apiProfile) return null;

  // Transform photos - keep photo objects with IDs for management operations
  // but ensure they have the expected structure
  const photos = apiProfile.photos
    ? apiProfile.photos.map(photo => ({
        id: photo.id,
        url: photo.url,
        isMain: photo.isMain || false,
        order: photo.order || 0,
      }))
    : [];

  // Transform other fields as needed
  return {
    ...apiProfile,
    photos, // Array of photo objects with IDs
    // Add any other field transformations here
  };
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  // Initialize API client and check for existing session
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        Logger.info('🚀 Initializing Hybrid Auth (API-based)...');

        // Initialize API client
        await ApiDataService.initialize();

        // Check if user is already authenticated
        if (apiClient.isAuthenticated()) {
          Logger.info('🔑 Found existing API session, loading user profile...');

          // Load user profile from API
          const profile = await ApiDataService.getUserProfile();
          if (profile) {
            // Transform profile data to match Firebase format
            const transformedProfile = transformApiProfileToFirebaseFormat(profile);

            // Create user object compatible with existing interface
            setUser({
              uid: profile.id,
              email: profile.email,
              displayName: profile.name,
            });
            setUserProfile(transformedProfile);

            // Connect to WebSocket for session restoration
            SocketService.connect(profile.id);
            SocketService.updateOnlineStatus(profile.id, true);

            Logger.success('✅ User session restored from API');
          } else {
            Logger.warn('⚠️ API session exists but no profile found');
            await apiClient.clearTokens();
          }
        } else {
          Logger.info('ℹ️ No existing API session found');
        }
      } catch (error) {
        Logger.error('❌ Error initializing hybrid auth:', error);
        // Don't clear tokens here - let user try to login if needed
        // await apiClient.clearTokens();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // ============ PROFILE METHODS ============

  /**
   * Refresh user profile from API
   * Maintains compatibility with existing interface
   */
  const refreshUserProfile = async () => {
    Logger.info('🔄 refreshUserProfile called, user uid:', user?.uid);

    if (user?.uid && apiClient.isAuthenticated()) {
      try {
        const profile = await ApiDataService.getUserProfile();
        if (profile) {
          const transformedProfile = transformApiProfileToFirebaseFormat(profile);
          Logger.info('🔄 Profile data from API:', {
            photosCount: transformedProfile.photos?.length || 0,
            hasPhotos: !!transformedProfile.photos?.length,
          });
          setUserProfile(transformedProfile);
          Logger.auth('✅ User profile refreshed from API');
          return transformedProfile;
        } else {
          Logger.warn('⚠️ User profile not found in API');
        }
      } catch (error) {
        Logger.error('❌ Error refreshing user profile from API:', error);
      }
    } else {
      Logger.warn('⚠️ refreshUserProfile called but user not authenticated with API');
    }
    return null;
  };

  /**
   * Refresh user profile by ID (for backward compatibility)
   */
  const refreshUserProfileWithId = async userId => {
    Logger.info('🔄 refreshUserProfileWithId called for userId:', userId);

    if (apiClient.isAuthenticated()) {
      try {
        const profile = await ApiDataService.getUserProfile();
        if (profile) {
          const transformedProfile = transformApiProfileToFirebaseFormat(profile);
          Logger.info('🔄 Profile data from API (by ID):', {
            photosCount: transformedProfile.photos?.length || 0,
            hasPhotos: !!transformedProfile.photos?.length,
          });
          setUserProfile(transformedProfile);
          Logger.auth('✅ User profile refreshed with ID from API');
          return { success: true, photosCount: transformedProfile.photos?.length || 0 };
        } else {
          Logger.warn('⚠️ User profile not found in API');
          return { success: false };
        }
      } catch (error) {
        Logger.error('❌ Error refreshing user profile by ID from API:', error);
        return { success: false };
      }
    } else {
      Logger.warn('⚠️ refreshUserProfileWithId called but user not authenticated with API');
      return { success: false };
    }
  };

  /**
   * Update user profile via API
   */
  const updateUserProfile = async profileData => {
    try {
      Logger.info('📝 Updating user profile via API...');

      if (apiClient.isAuthenticated()) {
        const success = await ApiDataService.updateUserProfile(profileData);

        if (success) {
          // Refresh profile to get updated data
          await refreshUserProfile();
          Logger.success('✅ User profile updated via API');
          return { success: true };
        } else {
          Logger.error('❌ Failed to update user profile via API');
          return { success: false, error: 'Update failed' };
        }
      } else {
        Logger.warn('⚠️ User not authenticated with API');
        return { success: false, error: 'Not authenticated' };
      }
    } catch (error) {
      Logger.error('❌ Error updating user profile:', error);
      return { success: false, error: error.message };
    }
  };

  // ============ AUTHENTICATION METHODS ============

  /**
   * Register new user via API
   * Maintains compatibility with existing interface
   */
  const register = async userData => {
    try {
      setLoading(true);
      Logger.info('📝 Registering user via API...');

      // Upload photos first if provided
      const uploadedPhotoUrls = [];
      if (userData.photos && userData.photos.length > 0) {
        try {
          Logger.info('📸 Uploading photos before account creation...');

          // Generate a temporary userId for photo upload path
          const tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

          for (let i = 0; i < userData.photos.length; i++) {
            const photo = userData.photos[i];
            Logger.info(`📸 Uploading photo ${i + 1} of ${userData.photos.length}...`);

            const downloadURL = await uploadImageToFirebase(
              photo.uri,
              tempUserId,
              'profile-photos'
            );
            uploadedPhotoUrls.push(downloadURL);
            Logger.success(`✅ Uploaded photo ${i + 1}: ${downloadURL}`);
          }

          Logger.success(`✅ All ${uploadedPhotoUrls.length} photos uploaded successfully`);
        } catch (photoError) {
          Logger.error('❌ Failed to upload photos before registration:', photoError);
          throw new Error('Photo upload failed. Please try again.');
        }
      }

      // Transform data to match API format
      const apiUserData = {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        birthDate: userData.birthDate,
        // Pass gender and interestedIn directly - backend handles conversion
        gender: userData.gender,
        // Ensure interestedIn is always an array, handle null/undefined
        // Convert EVERYONE to array of all genders
        interestedIn: userData.interestedIn
          ? userData.interestedIn === 'EVERYONE'
            ? ['MALE', 'FEMALE', 'OTHER']
            : Array.isArray(userData.interestedIn)
              ? userData.interestedIn
              : [userData.interestedIn]
          : [],
        // Use uploaded photo URLs
        photos: uploadedPhotoUrls,
        // Extract coordinates from userData.coordinates (coordinates object)
        location: {
          latitude: userData.coordinates?.latitude,
          longitude: userData.coordinates?.longitude,
        },
        // Include location text for display (userData.location is the text string)
        locationText: userData.location,
        // Include all profile detail fields
        bio: userData.bio || null,
        education: userData.education || null,
        profession: userData.profession || null,
        height: userData.height || null,
        relationshipType: Array.isArray(userData.relationshipType)
          ? userData.relationshipType
          : userData.relationshipType
            ? [userData.relationshipType]
            : [],
        religion: userData.religion || null,
        smoking: userData.smoking || null,
        drinking: userData.drinking || null,
        travel: userData.travel || null,
        pets: userData.pets || null,
        interests: Array.isArray(userData.interests) ? userData.interests : [],
      };

      const result = await ApiDataService.registerUser(apiUserData);

      if (result) {
        const userId = result.user.id;
        Logger.success('✅ User registered successfully via API:', userId);

        // Set user data compatible with existing interface
        setUser({
          uid: result.user.id,
          email: result.user.email,
          displayName: result.user.name,
        });

        // Load fresh profile from API to get photos
        try {
          Logger.info('🔄 Loading fresh profile after registration to get photos...');
          const freshProfile = await ApiDataService.getUserProfile();
          if (freshProfile) {
            const transformedProfile = transformApiProfileToFirebaseFormat(freshProfile);
            setUserProfile(transformedProfile);
            Logger.success('✅ Fresh profile loaded with photos:', {
              photosCount: transformedProfile.photos?.length || 0,
            });
          } else {
            // Fallback to registration data
            const transformedProfile = transformApiProfileToFirebaseFormat(result.user);
            setUserProfile(transformedProfile);
            Logger.warn('⚠️ Could not load fresh profile, using registration data');
          }
        } catch (error) {
          Logger.error('❌ Failed to load fresh profile:', error);
          // Fallback to registration data
          const transformedProfile = transformApiProfileToFirebaseFormat(result.user);
          setUserProfile(transformedProfile);
        }

        // Connect to WebSocket for real-time features
        SocketService.connect(result.user.id);

        // Update online status
        SocketService.updateOnlineStatus(result.user.id, true);

        Logger.success('✅ User registered via API');
        return { success: true, user: { uid: result.user.id, ...result.user } };
      }
    } catch (error) {
      Logger.error('❌ API registration failed:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Login user via API
   * Maintains compatibility with existing interface
   */
  const login = async (email, password) => {
    try {
      // Don't set global loading state - let LoginScreen handle its own loading
      Logger.info('🔐 Logging in via API...');

      const result = await ApiDataService.loginUser(email, password);

      if (result) {
        // Set user data compatible with existing interface
        const transformedProfile = transformApiProfileToFirebaseFormat(result.user);
        setUser({
          uid: result.user.id,
          email: result.user.email,
          displayName: result.user.name,
        });
        // Ensure existing users have completed onboarding flag set
        if (
          transformedProfile &&
          !Object.prototype.hasOwnProperty.call(transformedProfile, 'hasCompletedOnboarding')
        ) {
          Logger.info('🔄 Setting hasCompletedOnboarding for existing user...');
          transformedProfile.hasCompletedOnboarding = true;
        }

        setUserProfile(transformedProfile);

        // Connect to WebSocket for real-time features
        SocketService.connect(result.user.id);

        // Update online status
        SocketService.updateOnlineStatus(result.user.id, true);

        Logger.success('✅ User logged in via API');
        return { success: true };
      } else {
        // API didn't return a result - treat as login failure
        Logger.error('❌ API login failed: No result returned');
        return { success: false, error: 'Login failed. Please try again.' };
      }
    } catch (error) {
      Logger.error('❌ API login failed:', error);

      // Return error in format expected by existing screens
      if (error.message.includes('Invalid email or password')) {
        return { success: false, errorCode: 'auth/wrong-password', error: error.message };
      } else if (error.message.includes('email')) {
        return { success: false, errorCode: 'auth/invalid-email', error: error.message };
      } else {
        return { success: false, error: error.message };
      }
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      Logger.info('👋 Logging out from API...');

      // Logout from API
      await ApiDataService.logout();

      // Update offline status and disconnect WebSocket
      if (user?.uid) {
        SocketService.updateOnlineStatus(user.uid, false);
      }
      SocketService.disconnect();

      // Clear state
      setUser(null);
      setUserProfile(null);

      Logger.success('✅ User logged out successfully');
      return { success: true };
    } catch (error) {
      Logger.error('❌ Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Reset password (placeholder - needs API endpoint)
   */
  const resetPassword = async email => {
    try {
      Logger.info('📧 Password reset requested for:', email);
      // TODO: Implement password reset API endpoint
      Logger.warn('⚠️ Password reset not yet implemented in API');
      return { success: false, error: 'Password reset not yet available' };
    } catch (error) {
      Logger.error('❌ Password reset error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Complete onboarding (placeholder)
   */
  const completeOnboarding = async () => {
    try {
      Logger.info('✅ Completing onboarding...');
      // TODO: Update onboarding status via API
      Logger.warn('⚠️ Onboarding completion not yet implemented in API');
      return { success: true };
    } catch (error) {
      Logger.error('❌ Complete onboarding error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Check if email exists (placeholder)
   */
  const checkEmailExists = async email => {
    try {
      Logger.info('📧 Checking if email exists:', email);

      // Call the API to check if email exists
      const response = await apiClient.checkEmailExists(email);

      if (response.success) {
        Logger.info(`📧 Email check result: ${response.data.exists ? 'exists' : 'available'}`);
        return response.data.exists;
      } else {
        Logger.warn('⚠️ Email check failed:', response.message);
        return false;
      }
    } catch (error) {
      Logger.error('❌ Email check error:', error);
      return false;
    }
  };

  // ============ CONTEXT VALUE ============

  const value = {
    user,
    userProfile,
    loading,

    register,

    completeOnboarding,
    login,
    logout,
    resetPassword,
    updateUserProfile,
    refreshUserProfile,
    refreshUserProfileWithId,
    checkEmailExists,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
