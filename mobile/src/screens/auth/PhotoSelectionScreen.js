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
import * as ImageManipulator from 'expo-image-manipulator';
import { useToast } from '../../contexts/ToastContext';
import Logger from '../../utils/logger';

const { width } = Dimensions.get('window');
const photoSize = (width - 60) / 3; // 3 photos per row with spacing

const PhotoSelectionScreen = ({ navigation, route }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showError } = useToast();

  // Get data from Step 1 (passed via navigation params)
  const step1Data = route?.params?.step1Data || {};

  const pickImages = async () => {
    try {
      setLoading(true);
      Logger.info('📸 Opening image picker...');

      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showError('Permission to access photos is required!');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, 6 - photos.length), // Up to 6 total photos
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets) {
        Logger.info(`📸 Selected ${result.assets.length} photos`);

        // Process each selected image
        const processedPhotos = [];
        for (const asset of result.assets) {
          try {
            // Crop/resize image to square and optimize
            const manipulatedImage = await ImageManipulator.manipulateAsync(
              asset.uri,
              [
                { resize: { width: 1080, height: 1080 } }, // Square format
              ],
              {
                compress: 0.8,
                format: ImageManipulator.SaveFormat.JPEG,
              }
            );

            processedPhotos.push({
              id: Date.now() + Math.random(), // Unique ID
              uri: manipulatedImage.uri,
              width: manipulatedImage.width,
              height: manipulatedImage.height,
            });
          } catch (error) {
            Logger.error('❌ Error processing image:', error);
          }
        }

        // Add processed photos to state
        setPhotos(prev => [...prev, ...processedPhotos]);
        Logger.success(`✅ Added ${processedPhotos.length} photos`);
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
      Logger.info(
        `🔄 Step 2 complete - proceeding to profile details with ${photos.length} photos`
      );

      // Prepare data for Step 3
      const step2Data = {
        ...step1Data,
        photos: photos,
      };

      // Navigate to Step 3 with all collected data
      navigation.navigate('ProfileDetails', { step2Data });
    } catch (error) {
      Logger.error('❌ Step 2 error:', error);
      showError('An unexpected error occurred. Please try again.');
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

          {/* Photo Grid */}
          <View style={styles.photoGrid}>
            {photos.map(photo => (
              <View key={photo.id} style={styles.photoContainer}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(photo.id)}>
                  <MaterialIcons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Photo Button */}
            {photos.length < 6 && (
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={pickImages}
                disabled={loading}
              >
                <MaterialIcons name="add-a-photo" size={32} color={loading ? '#ccc' : '#FF6B6B'} />
                <Text style={[styles.addPhotoText, loading && styles.disabledText]}>
                  {photos.length === 0 ? 'Add Photos' : 'Add More'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Photo Count */}
          <Text style={styles.photoCount}>{photos.length} of 6 photos selected</Text>

          {/* Next Button */}
          <TouchableOpacity
            style={[
              styles.nextButton,
              (loading || photos.length === 0) && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={loading || photos.length === 0}
          >
            <Text style={styles.nextButtonText}>
              {loading ? 'Processing...' : 'Next: Profile Details'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Your photos will be reviewed to ensure they meet our community guidelines.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  subtitle: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  requirement: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  photoContainer: {
    width: photoSize,
    height: photoSize,
    marginBottom: 15,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  addPhotoButton: {
    width: photoSize,
    height: photoSize,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  addPhotoText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  disabledText: {
    color: '#ccc',
  },
  photoCount: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
  },
  nextButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonDisabled: {
    backgroundColor: '#FFB6B6',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default PhotoSelectionScreen;
