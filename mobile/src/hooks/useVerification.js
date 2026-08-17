import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ApiDataService from '../services/ApiDataService';
import { uploadImageToFirebase } from '../utils/imageUpload';
import Logger from '../utils/logger';

/**
 * Profile verification state and submission flow.
 *
 * Exposes the user's verification status (from AuthContext) and
 * startVerification — the full explainer → front-camera selfie →
 * upload → submit → profile-refresh flow.
 *
 * @returns {{ verificationStatus: string, isVerified: boolean, isSubmitting: boolean, startVerification: Function }}
 */
const useVerification = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const verificationStatus = userProfile?.verificationStatus || 'NONE';
  const isVerified = verificationStatus === 'APPROVED' || !!userProfile?.isVerified;

  // Take a verification selfie with the FRONT CAMERA ONLY (never the gallery —
  // a live camera capture is the anti-spoof property) and submit for review.
  const takeVerificationSelfie = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showError('Camera access is needed to take your verification selfie');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        cameraType: ImagePicker.CameraType.front,
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setIsSubmitting(true);
      const photoUrl = await uploadImageToFirebase(
        result.assets[0].uri,
        user?.uid,
        'verification-selfies'
      );
      await ApiDataService.submitVerification(photoUrl);
      showSuccess('Selfie submitted! We will review it shortly.');
      await refreshUserProfile();
    } catch (error) {
      Logger.error('Verification submission failed:', error);
      showError('Failed to submit verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.uid, refreshUserProfile, showSuccess, showError]);

  // Explainer alert before opening the camera
  const startVerification = useCallback(() => {
    Alert.alert(
      'Verify your profile',
      "Take a quick selfie so we can confirm you're the person in your photos. The selfie is only used for verification and isn't shown on your profile.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Selfie', onPress: takeVerificationSelfie },
      ]
    );
  }, [takeVerificationSelfie]);

  return { verificationStatus, isVerified, isSubmitting, startVerification };
};

export default useVerification;
