import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import ApiDataService from '../../services/ApiDataService';
import Logger from '../../utils/logger';

const { width } = Dimensions.get('window');
const photoSize = (width - 60) / 3; // 3 photos per row with spacing

const PhotoSelectionScreen = ({ navigation, route }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();

  // Get data from Step 1 (passed via navigation params)
  const step1Data = route?.params?.step1Data || {};
  const isOnboarding = route?.params?.isOnboarding || false;

  const pickImages = async () => {
    try {
      setLoading(true);
      Logger.info('📸 Opening image picker with Expo cropping...');

      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showError('Permission to access photos is required!');
        return;
      }

      // Use expo-image-picker with single photo + cropping interface
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false, // Single photo to enable cropping UI
        allowsEditing: true, // This enables the interactive cropping interface
        aspect: [1, 1], // Square aspect ratio
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]; // Single photo
        Logger.info(`📸 Selected and cropped 1 photo with user interaction`);

        // Convert to our photo format
        const newPhoto = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          uri: asset.uri, // User-cropped by expo-image-picker interface
          width: asset.width,
          height: asset.height,
          cropped: true, // User cropped via interactive interface
          size: asset.fileSize,
          type: asset.type,
        };

        // Add the single cropped photo to state
        setPhotos(prev => [...prev, newPhoto]);
        Logger.success(`✅ Added 1 user-cropped photo (${photos.length + 1}/6)`);
      } else {
        Logger.info('📸 User cancelled image selection');
      }
    } catch (error) {
      Logger.error('❌ Error picking images:', error);
      showError('Failed to pick images. Please try again.');
    } finally {
      setLoading(false);
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
        Logger.info(`📸 Uploading ${photos.length} photos to existing account...`);

        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const isMain = i === 0; // First photo is main

          try {
            await ApiDataService.addUserPhoto(photo.uri, isMain);
            Logger.info(`✅ Photo ${i + 1}/${photos.length} uploaded`);
          } catch (photoError) {
            Logger.error(`❌ Failed to upload photo ${i + 1}:`, photoError);
            // Continue with other photos
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
            <MaterialIcons name="arrow-back" size={24} color="#333" />
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
            disabled={loading || photos.length >= 6}
          >
            <MaterialIcons
              name="add-a-photo"
              size={24}
              color={photos.length >= 6 ? '#999' : '#4ECDC4'}
            />
            <Text style={[styles.addButtonText, photos.length >= 6 && styles.disabledText]}>
              {photos.length === 0
                ? 'Add Photo & Crop Interactively'
                : `Add Another Photo (${photos.length}/6)`}
            </Text>
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
                    <MaterialIcons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                  {/* Cropped indicator */}
                  <View style={styles.croppedBadge}>
                    <MaterialIcons name="check-circle" size={16} color="#4ECDC4" />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>📱 How it works:</Text>
            <Text style={styles.instructionText}>
              • Tap "Add Photo" to select from your gallery
            </Text>
            <Text style={styles.instructionText}>• Interactive crop interface appears</Text>
            <Text style={styles.instructionText}>• Pinch, zoom, and drag to crop perfectly</Text>
            <Text style={styles.instructionText}>• Repeat to add up to 6 photos</Text>
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
    backgroundColor: '#fff',
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
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#333',
    marginBottom: 5,
    fontWeight: '500',
  },
  requirement: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#4ECDC4',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 40,
    marginBottom: 30,
    gap: 10,
  },
  addButtonText: {
    fontSize: 16,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  disabledText: {
    color: '#999',
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
    backgroundColor: '#F8F9FA',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  continueButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#E8E8E8',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PhotoSelectionScreen;
