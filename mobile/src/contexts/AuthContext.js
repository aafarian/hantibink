import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
    const unsubscribe = onAuthStateChanged(auth, async user => {
      setUser(user);

      if (user) {
        // Fetch user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Register new user
  const register = async userData => {
    try {
      Logger.auth('Registering user:', userData.email);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );
      const user = userCredential.user;

      // Update display name
      await updateProfile(user, {
        displayName: userData.name,
      });

      // Create user profile in Firestore with enhanced structure
      const userProfile = {
        id: user.uid,
        email: user.email,
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
            .filter(([key, value]) => value !== undefined)
            .map(([key, value]) => [key, cleanObject(value)])
        );
      };

      const cleanUserProfile = cleanObject(userProfile);

      Logger.firebase('Saving user profile to Firestore');
      await setDoc(doc(db, 'users', user.uid), cleanUserProfile);
      Logger.firebase('User profile saved successfully');
      setUserProfile(userProfile);
      return { success: true, user };
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      return { success: false, error: error.message };
    }
  };

  // Login user
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  // Logout user
  const logout = async () => {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // Reset password
  const resetPassword = async email => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
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
      console.error('Profile update error:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    register,
    login,
    logout,
    resetPassword,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
