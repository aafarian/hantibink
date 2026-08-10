import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import ApiDataService from '../../services/ApiDataService';
import { processMultipleImagesWithCrop, uploadImageToFirebase } from '../../utils/imageUpload';
import Logger from '../../utils/logger';
import { theme } from '../../styles/theme';

const MAX_PHOTOS = 6;
const ASPECT_RATIO = 0.8; // 4:5 portrait ratio

const { width } = Dimensions.get('window');
const photoSize = (width - 60) / 3; // 3 photos per row with spacing

const PhotoSelectionScreen = ({ navigation, route }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();

  // Get data from Step 1 (passed via navigation params)
  const step1Data = route?.params?.step1Data || {};
  const isOnboarding = route?.params?.isOnboarding || false;

  const remainingSlots = MAX_PHOTOS - photos.length;

  const pickImages = async () => {
    try {
      if (remainingSlots <= 0) {
        showError(`Maximum ${MAX_PHOTOS} photos allowed`);
        return;
      }

      // Request permissions before opening picker
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showError('Permission to access photos is required!');
        return;
      }

      Logger.info(`📸 Opening image picker (multi-select, limit: ${remainingSlots})`);

      // Multi-select picker - no interactive crop (iOS limitation)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        Logger.info(`📸 Selected ${result.assets.length} photos, processing...`);

        // Auto-crop all selected images to 4:5 portrait ratio
        setProcessingStatus(`Processing 1/${result.assets.length}`);
        const croppedImages = await processMultipleImagesWithCrop(
          result.assets,
          ASPECT_RATIO,
          (current, total) => setProcessingStatus(`Processing ${current}/${total}`)
        );

        // Convert to our photo format
        const newPhotos = croppedImages.map((img, index) => ({
          id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          uri: img.uri,
          width: img.width,
          height: img.height,
          cropped: true,
        }));

        setPhotos(prev => [...prev, ...newPhotos]);
        setProcessingStatus('');
        Logger.success(
          `✅ Added ${newPhotos.length} photos (${photos.length + newPhotos.length}/${MAX_PHOTOS})`
        );
        showSuccess(`Added ${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''}`);
      } else {
        Logger.info('📸 User cancelled image selection');
      }
    } catch (error) {
      Logger.error('❌ Error picking images:', error);
      showError('Failed to pick images. Please try again.');
    } finally {
      setLoading(false);
      setProcessingStatus('');
    }
  };

  const removePhoto = photoId => {
    setPhotos(prev => prev.filter(photo => photo.id !== photoId));
    Logger.info('🗑️ Photo removed');
  };

  const handleNext = async () => {
    if (photos.length === 0) {
      showError('Please add at least one photo to continue.');
      return;
    }

    setLoading(true);
    try {
      if (isOnboarding && user?.uid) {
        // Upload photos to existing account
        const photoCount = photos.length;
        Logger.info(`📸 Uploading ${photoCount} photos to existing account...`);

        // Upload all photos to Firebase in parallel for speed
        Logger.info(`⬆️ Uploading ${photoCount} photos to Firebase in parallel...`);
        const uploadPromises = photos.map(photo => uploadImageToFirebase(photo.uri, user.uid));
        const uploadResults = await Promise.allSettled(uploadPromises);

        // Filter successful uploads and preserve order
        const uploadedPhotos = uploadResults
          .map((result, index) => ({ result, index }))
          .filter(({ result }) => result.status === 'fulfilled')
          .map(({ result, index }) => ({ url: result.value, index }));

        Logger.info(`✅ ${uploadedPhotos.length}/${photoCount} photos uploaded to Firebase`);

        // Add to API sequentially to maintain order
        for (const { url, index } of uploadedPhotos) {
          try {
            const isMain = index === 0;
            await ApiDataService.addUserPhoto(url, isMain);
            Logger.info(`✅ Photo ${index + 1}/${photoCount} added to profile`);
          } catch (apiError) {
            Logger.error(`❌ Failed to add photo ${index + 1} to API:`, apiError);
          }
        }

        showSuccess("Photos uploaded! Let's complete your profile");
        Logger.success('✅ All photos processed for onboarding');

        // Navigate to final profile details step
        navigation.navigate('ProfileDetails', {
          isOnboarding: true,
          userId: route.params?.userId, // Pass user ID for onboarding
          step2Data: { photos }, // Keep for compatibility
        });
      } else {
        // Legacy flow - pass data to next step
        Logger.info(
          `🔄 Step 2 complete - proceeding to profile details with ${photos.length} photos`
        );

        const step2Data = {
          ...step1Data,
          photos: photos,
        };

        navigation.navigate('ProfileDetails', { step2Data });
      }
    } catch (error) {
      Logger.error('❌ Step 2 error:', error);
      showError('Failed to upload photos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Step 2: Add Photos</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>Show your best self! Add up to 6 photos.</Text>
          <Text style={styles.requirement}>At least 1 photo is required to continue.</Text>

          {/* Add Photos Button */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={pickImages}
            disabled={loading || remainingSlots <= 0}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.secondary} />
                <Text style={styles.addButtonText}>{processingStatus || 'Processing...'}</Text>
              </View>
            ) : (
              <>
                <MaterialIcons
                  name="add-photo-alternate"
                  size={24}
                  color={remainingSlots <= 0 ? theme.colors.text.muted : theme.colors.secondary}
                />
                <Text style={[styles.addButtonText, remainingSlots <= 0 && styles.disabledText]}>
                  {photos.length === 0
                    ? 'Select Photos'
                    : `Add More Photos (${photos.length}/${MAX_PHOTOS})`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Photo Grid */}
          {photos.length > 0 && (
            <View style={styles.photoGrid}>
              {photos.map(photo => (
                <View key={photo.id} style={styles.photoContainer}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePhoto(photo.id)}
                  >
                    <MaterialIcons name="close" size={20} color={theme.colors.text.white} />
                  </TouchableOpacity>
                  {/* Cropped indicator */}
                  <View style={styles.croppedBadge}>
                    <MaterialIcons name="check-circle" size={16} color={theme.colors.secondary} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>📱 How it works:</Text>
            <Text style={styles.instructionText}>• Tap "Select Photos" to open your gallery</Text>
            <Text style={styles.instructionText}>• Select multiple photos at once (up to 6)</Text>
            <Text style={styles.instructionText}>
              • Photos are automatically cropped to portrait
            </Text>
            <Text style={styles.instructionText}>
              • Tap the X to remove any photo you don't like
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, photos.length === 0 && styles.disabledButton]}
          onPress={handleNext}
          disabled={loading || photos.length === 0}
        >
          <Text style={[styles.continueButtonText, photos.length === 0 && styles.disabledText]}>
            {loading ? 'Processing...' : 'Continue to Profile Details'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary,
    marginBottom: 5,
    fontWeight: '500',
  },
  requirement: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginBottom: 30,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.secondary,
    borderWidth: 2,
    borderColor: theme.colors.secondary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 40,
    marginBottom: 30,
    gap: 10,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.secondary,
    fontWeight: '600',
  },
  disabledText: {
    color: theme.colors.text.muted,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  photoImage: {
    width: photoSize,
    height: photoSize,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  croppedBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionsContainer: {
    backgroundColor: theme.colors.background.secondary,
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semibold,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginBottom: 5,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  continueButton: {
    backgroundColor: theme.colors.secondary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: theme.colors.gray[200],
  },
  continueButtonText: {
    color: theme.colors.text.white,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: 'bold',
  },
});

export default PhotoSelectionScreen;
