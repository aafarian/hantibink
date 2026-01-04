import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import Logger from './logger';

/**
 * Upload an audio file to Firebase Storage and return the download URL
 * @param {string} audioUri - Local audio file URI
 * @param {string} userId - User ID for organizing audio files
 * @returns {Promise<string>} - Firebase Storage download URL
 */
export const uploadAudioToFirebase = async (audioUri, userId) => {
  try {
    Logger.info(`Starting audio upload for user ${userId}`);

    // Create a unique filename with timestamp
    const timestamp = Date.now();
    const filename = `${userId}_${timestamp}.m4a`;
    const storagePath = `voice-messages/${filename}`;

    // Create a reference to the file location
    const audioRef = ref(storage, storagePath);

    // Convert the audio URI to a blob
    const response = await fetch(audioUri);
    const blob = await response.blob();

    Logger.info(`Uploading audio to path: ${storagePath}, size: ${blob.size}`);

    // Upload the blob to Firebase Storage
    const snapshot = await uploadBytes(audioRef, blob);

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    Logger.success(`Audio uploaded successfully: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    Logger.error('Error uploading audio to Firebase:', error);
    Logger.error('Error details:', {
      code: error.code,
      message: error.message,
      serverResponse: error.serverResponse,
    });
    throw new Error(`Failed to upload audio: ${error.message}`);
  }
};
