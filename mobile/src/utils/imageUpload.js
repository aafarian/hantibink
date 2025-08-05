import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

    // Create a unique filename with timestamp
    const timestamp = Date.now();
    const filename = `${userId}_${timestamp}.jpg`;
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
