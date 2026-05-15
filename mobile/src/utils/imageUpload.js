import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { storage } from '../config/firebase';
import Logger from './logger';

/**
 * Upload an image to Firebase Storage and return the download URL
 * @param {string} imageUri - Local image URI from image picker
 * @param {string} userId - User ID for organizing images
 * @param {string} folder - Folder name (e.g., 'profile-photos')
 * @returns {Promise<string>} - Firebase Storage download URL
 */
export const uploadImageToFirebase = async (imageUri, userId, folder = 'profile-photos') => {
  try {
    Logger.info(`Starting image upload for user ${userId}`);

    // Unique filename. Timestamp alone is NOT enough — parallel uploads
    // started in the same millisecond (common when callers use Promise.all
    // over .map) would otherwise collide on the same Storage path, with
    // later uploads overwriting earlier ones and getDownloadURL returning
    // duplicate URLs. The random suffix gives ~40 bits of entropy per pair.
    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const filename = `${userId}_${uniqueId}.jpg`;
    const storagePath = `${folder}/${filename}`;

    // Create a reference to the file location
    const imageRef = ref(storage, storagePath);

    // Convert the image URI to a blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    Logger.info(`Uploading image to path: ${storagePath}`);

    // Upload the blob to Firebase Storage
    const snapshot = await uploadBytes(imageRef, blob);

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    Logger.success(`Image uploaded successfully: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    Logger.error('Error uploading image to Firebase:', error);
    Logger.error('Storage error details:', {
      code: error.code,
      message: error.message,
      customData: error.customData,
      serverResponse: error.serverResponse,
    });
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

/**
 * Upload multiple images and return their download URLs
 * @param {string[]} imageUris - Array of local image URIs
 * @param {string} userId - User ID for organizing images
 * @param {string} folder - Folder name
 * @returns {Promise<string[]>} - Array of Firebase Storage download URLs
 */
export const uploadMultipleImages = async (imageUris, userId, folder = 'profile-photos') => {
  try {
    Logger.info(`Uploading ${imageUris.length} images for user ${userId}`);

    const uploadPromises = imageUris.map(uri => uploadImageToFirebase(uri, userId, folder));
    const downloadURLs = await Promise.all(uploadPromises);

    Logger.success(`Successfully uploaded ${downloadURLs.length} images`);
    return downloadURLs;
  } catch (error) {
    Logger.error('Error uploading multiple images:', error);
    throw error;
  }
};

/**
 * Check if a URI is a local file path or already a Firebase URL
 * @param {string} uri - Image URI to check
 * @returns {boolean} - True if it's a local file, false if it's already a cloud URL
 */
export const isLocalImageUri = uri => {
  if (!uri) return false;
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');
};

/**
 * Process an array of image URIs, uploading local ones and keeping cloud URLs
 * @param {string[]} imageUris - Mixed array of local and cloud URIs
 * @param {string} userId - User ID for organizing images
 * @returns {Promise<string[]>} - Array of all cloud URLs
 */
export const processImageUris = async (imageUris, userId) => {
  try {
    const processedUris = [];

    for (const uri of imageUris) {
      if (isLocalImageUri(uri)) {
        // Upload local image and get cloud URL
        const cloudUrl = await uploadImageToFirebase(uri, userId);
        processedUris.push(cloudUrl);
      } else {
        // Already a cloud URL, keep as-is
        processedUris.push(uri);
      }
    }

    return processedUris;
  } catch (error) {
    Logger.error('Error processing image URIs:', error);
    throw error;
  }
};

/**
 * Auto-crop an image to a specific aspect ratio (center crop)
 * @param {string} imageUri - Local image URI
 * @param {number} aspectRatio - Target aspect ratio (width/height), e.g., 0.8 for 4:5
 * @param {number} quality - Output quality (0-1), default 0.8
 * @returns {Promise<string>} - Cropped image URI
 */
export const autoCropImage = async (imageUri, aspectRatio = 0.8, quality = 0.8) => {
  try {
    Logger.info(`Auto-cropping image to aspect ratio ${aspectRatio}`);

    // First, get the image dimensions
    const imageInfo = await ImageManipulator.manipulateAsync(imageUri, [], {});
    const { width, height } = imageInfo;

    // Calculate crop dimensions to achieve target aspect ratio
    const currentAspect = width / height;
    let cropWidth, cropHeight, originX, originY;

    if (currentAspect > aspectRatio) {
      // Image is wider than target - crop sides
      cropHeight = height;
      cropWidth = Math.round(height * aspectRatio);
      originX = Math.round((width - cropWidth) / 2);
      originY = 0;
    } else {
      // Image is taller than target - crop top/bottom
      cropWidth = width;
      cropHeight = Math.round(width / aspectRatio);
      originX = 0;
      originY = Math.round((height - cropHeight) / 2);
    }

    // Apply the crop
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          crop: {
            originX,
            originY,
            width: cropWidth,
            height: cropHeight,
          },
        },
      ],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );

    Logger.success(`Image cropped: ${width}x${height} → ${cropWidth}x${cropHeight}`);
    return result.uri;
  } catch (error) {
    Logger.error('Error auto-cropping image:', error);
    // Return original if cropping fails
    return imageUri;
  }
};

/**
 * Process multiple images with auto-crop
 * @param {Array} assets - Array of image picker assets with uri, width, height
 * @param {number} aspectRatio - Target aspect ratio (width/height)
 * @param {Function} onProgress - Progress callback (index, total)
 * @returns {Promise<Array>} - Array of cropped image URIs
 */
export const processMultipleImagesWithCrop = async (assets, aspectRatio = 0.8, onProgress) => {
  const croppedUris = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    onProgress?.(i + 1, assets.length);

    try {
      const croppedUri = await autoCropImage(asset.uri, aspectRatio);
      croppedUris.push({
        uri: croppedUri,
        originalUri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
    } catch (error) {
      Logger.error(`Failed to crop image ${i + 1}:`, error);
      // Include original if crop fails
      croppedUris.push({
        uri: asset.uri,
        originalUri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
    }
  }

  return croppedUris;
};
