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
      let serviceAccount;
      
      // Check for base64 encoded service account first (for Cloud Run)
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64) {
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
        serviceAccount = JSON.parse(decoded);
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } else {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 is required in production');
      }
      
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

module.exports = {
  initializeFirebase,
  getAuth,
  verifyIdToken,
};
