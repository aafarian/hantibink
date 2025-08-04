import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  // fetchSignInMethodsForEmail, // Currently unused but keeping for potential future use
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import Logger from '../utils/logger';

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

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async authUser => {
      setUser(authUser);

      if (authUser) {
        // Fetch user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', authUser.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
            Logger.auth('User profile loaded from Firestore');
          } else {
            Logger.warn('No user profile found in Firestore');
          }
        } catch (error) {
          Logger.error('Error fetching user profile:', error);
        }
      } else {
        setUserProfile(null);
        Logger.auth('User signed out');
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Function to refresh user profile (for location updates)
  const refreshUserProfile = async () => {
    Logger.info('🔄 refreshUserProfile called, user uid:', user?.uid);

    if (user?.uid) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const profileData = userDoc.data();
          Logger.info('🔄 Profile data from Firestore:', {
            photosCount: profileData.photos?.length || 0,
            hasPhotos: !!profileData.photos?.length,
          });
          setUserProfile(profileData);
          Logger.auth('User profile refreshed');
          return profileData;
        } else {
          Logger.warn('User document does not exist in Firestore');
        }
      } catch (error) {
        Logger.error('Error refreshing user profile:', error);
      }
    } else {
      Logger.warn('refreshUserProfile called but no user.uid available');
    }
    return null;
  };

  // Function to refresh user profile with specific userId (for registration flow)
  const refreshUserProfileWithId = async userId => {
    Logger.info('🔄 refreshUserProfileWithId called for userId:', userId);

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const profileData = userDoc.data();
        Logger.info('🔄 Profile data from Firestore (by ID):', {
          photosCount: profileData.photos?.length || 0,
          hasPhotos: !!profileData.photos?.length,
        });
        setUserProfile(profileData);
        Logger.auth('User profile refreshed with ID');
        return profileData;
      } else {
        Logger.warn('User document does not exist in Firestore for ID:', userId);
      }
    } catch (error) {
      Logger.error('Error refreshing user profile with ID:', error);
    }
    return null;
  };

  // Mark onboarding as complete
  const completeOnboarding = async () => {
    if (user?.uid) {
      const updatedProfile = {
        ...userProfile,
        hasCompletedOnboarding: true,
        onboardingStep: 4, // Completed all steps
      };
      await updateDoc(doc(db, 'users', user.uid), {
        hasCompletedOnboarding: true,
        onboardingStep: 4,
      });
      setUserProfile(updatedProfile);
      Logger.auth('Onboarding completed');
    }
  };

  // Check if email already exists (simplified - no temp user creation)
  const checkEmailExists = async email => {
    try {
      Logger.info('🔍 Checking if email exists:', email);

      // For now, we'll skip the email check and handle duplicates during registration
      // This prevents creating temporary users that trigger auth state changes
      Logger.info('📧 Email check skipped - will handle duplicates during registration');
      return false;
    } catch (error) {
      Logger.error('Error checking email:', error);
      return false;
    }
  };

  // Register new user
  const register = async userData => {
    try {
      Logger.auth('Registering user:', userData.email);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );
      const registeredUser = userCredential.user;

      // Update display name
      await updateProfile(registeredUser, {
        displayName: userData.name,
      });

      // Create user profile in Firestore with enhanced structure
      const newUserProfile = {
        id: registeredUser.uid,
        email: registeredUser.email,
        name: userData.name,
        age: userData.age,
        birthDate: userData.birthDate,
        gender: userData.gender,
        bio: userData.bio,
        photos: userData.photos,
        mainPhoto: userData.mainPhoto,
        location: userData.location,
        armenianLanguage: userData.armenianLanguage,
        profession: userData.profession,
        education: userData.education,
        religion: userData.religion,
        height: userData.height,
        smoking: userData.smoking,
        drinking: userData.drinking,
        pets: userData.pets,
        travel: userData.travel,
        interests: userData.interests,
        hobbies: userData.hobbies,
        preferences: userData.preferences,
        settings: userData.settings,
        isActive: userData.isActive,
        isPremium: userData.isPremium,
        profileViews: userData.profileViews,
        totalLikes: userData.totalLikes,
        totalMatches: userData.totalMatches,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };

      // Remove undefined values before saving to Firestore (including nested objects)
      const cleanObject = obj => {
        if (obj === null || typeof obj !== 'object') {
          return obj;
        }

        if (Array.isArray(obj)) {
          return obj.filter(item => item !== undefined).map(cleanObject);
        }

        return Object.fromEntries(
          Object.entries(obj)
            .filter(([_key, value]) => value !== undefined)
            .map(([key, value]) => [key, cleanObject(value)])
        );
      };

      // Process images after user is created (upload local images to Firebase Storage)
      if (userData.photos && userData.photos.length > 0) {
        try {
          const { processImageUris } = await import('../utils/imageUpload');
          Logger.info('Processing images after user creation...');
          const uploadedPhotos = await processImageUris(userData.photos, registeredUser.uid);
          newUserProfile.photos = uploadedPhotos;
          newUserProfile.mainPhoto = uploadedPhotos[0] || null;
          Logger.success('Images uploaded successfully');
        } catch (imageError) {
          Logger.error('Error uploading images:', imageError);
          // Continue with registration even if image upload fails
          newUserProfile.photos = [];
          newUserProfile.mainPhoto = null;
        }
      }

      // Add onboarding tracking to profile
      newUserProfile.hasCompletedOnboarding = false;
      newUserProfile.onboardingStep = 1; // Start at basic info step

      const cleanUserProfile = cleanObject(newUserProfile);

      Logger.firebase('Saving user profile to Firestore');
      await setDoc(doc(db, 'users', registeredUser.uid), cleanUserProfile);
      Logger.firebase('User profile saved successfully');

      // Set user in context immediately - normal flow
      setUser(registeredUser);
      setUserProfile(cleanUserProfile);

      return { success: true, user: registeredUser, profile: cleanUserProfile };
    } catch (error) {
      Logger.error('Registration error:', error);
      Logger.error('Error code:', error.code);
      Logger.error('Error message:', error.message);
      return { success: false, error: error.message, errorCode: error.code };
    }
  };

  // Login user
  const login = async (email, password) => {
    try {
      Logger.auth('Attempting login for:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      Logger.auth('Login successful for:', email);
      return { success: true, user: userCredential.user };
    } catch (error) {
      Logger.error('Login error:', error);
      Logger.error('Login error code:', error.code);
      Logger.error('Login error message:', error.message);
      return { success: false, error: error.message, errorCode: error.code };
    }
  };

  // Logout user
  const logout = async () => {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      Logger.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // Reset password
  const resetPassword = async email => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      Logger.error('Password reset error:', error);
      return { success: false, error: error.message };
    }
  };

  // Update user profile
  const updateUserProfile = async updates => {
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      const updatedProfile = {
        ...userProfile,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
      setUserProfile(updatedProfile);

      return { success: true, profile: updatedProfile };
    } catch (error) {
      Logger.error('Profile update error:', error);
      return { success: false, error: error.message };
    }
  };

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
