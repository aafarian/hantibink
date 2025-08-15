const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 */
const initializeFirebase = () => {
  try {
    if (firebaseApp) {
      return firebaseApp;
    }

    // Check if we're in development and use service account key
    if (process.env.NODE_ENV === 'development') {
      // For development, skip Firebase initialization if no credentials
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        logger.warn('⚠️ Firebase Admin SDK not initialized - no service account key provided');
        logger.warn('🔧 Authentication endpoints will work with JWT only');
        return null;
      }

      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    } else {
      // Production configuration with service account key
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required in production');
      }

      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    }

    logger.info('🔥 Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
};

/**
 * Get Firebase Auth instance
 */
const getAuth = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  if (!firebaseApp) {
    throw new Error('Firebase not initialized - cannot get Auth instance');
  }
  return admin.auth();
};

/**
 * Get Firestore instance
 */
const getFirestore = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  if (!firebaseApp) {
    throw new Error('Firebase not initialized - cannot get Firestore instance');
  }
  return admin.firestore();
};

/**
 * Verify Firebase ID token
 */
const verifyIdToken = async (idToken) => {
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    logger.error('❌ Failed to verify Firebase ID token:', error);
    throw error;
  }
};

/**
 * Get user by UID
 */
const getUserByUid = async (uid) => {
  try {
    const auth = getAuth();
    const userRecord = await auth.getUser(uid);
    return userRecord;
  } catch (error) {
    logger.error('❌ Failed to get user by UID:', error);
    throw error;
  }
};

/**
 * Create Firebase user
 */
const createFirebaseUser = async (userData) => {
  try {
    const auth = getAuth();
    const userRecord = await auth.createUser(userData);
    logger.info(`✅ Firebase user created: ${userRecord.uid}`);
    return userRecord;
  } catch (error) {
    logger.error('❌ Failed to create Firebase user:', error);
    throw error;
  }
};

/**
 * Update Firebase user
 */
const updateFirebaseUser = async (uid, userData) => {
  try {
    const auth = getAuth();
    const userRecord = await auth.updateUser(uid, userData);
    logger.info(`✅ Firebase user updated: ${uid}`);
    return userRecord;
  } catch (error) {
    logger.error('❌ Failed to update Firebase user:', error);
    throw error;
  }
};

/**
 * Delete Firebase user
 */
const deleteFirebaseUser = async (uid) => {
  try {
    const auth = getAuth();
    await auth.deleteUser(uid);
    logger.info(`✅ Firebase user deleted: ${uid}`);
  } catch (error) {
    logger.error('❌ Failed to delete Firebase user:', error);
    throw error;
  }
};

module.exports = {
  initializeFirebase,
  getAuth,
  getFirestore,
  verifyIdToken,
  getUserByUid,
  createFirebaseUser,
  updateFirebaseUser,
  deleteFirebaseUser,
};
