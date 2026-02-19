import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

// Initialize Firebase Admin SDK
// Using default credentials from GOOGLE_APPLICATION_CREDENTIALS env var
// or initialize with service account if needed
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: 'hydgo-3c94d',
      // For production, you should use a service account JSON file
      // credential: admin.credential.cert(serviceAccount),
    });
    logger.info('Firebase Admin SDK initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', { error });
    throw error;
  }
}

export const firebaseAdmin = admin;
export const firebaseAuth = admin.auth();
