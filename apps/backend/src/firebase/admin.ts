import admin from 'firebase-admin';

let isInitialized = false;

export function initializeFirebase() {
  if (isInitialized) {
    return;
  }

  try {
    // Check if Firebase should be initialized
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJson) {
      console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT not set. Firebase features will be disabled.');
      isInitialized = false;
      return;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    isInitialized = true;
    console.log('[Firebase] ✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('[Firebase] ❌ Failed to initialize Firebase:', error);
    isInitialized = false;
  }
}

export function isFirebaseEnabled(): boolean {
  return isInitialized;
}

export function getFirebaseAuth() {
  if (!isInitialized) {
    throw new Error('Firebase not initialized. Set FIREBASE_SERVICE_ACCOUNT environment variable.');
  }
  return admin.auth();
}

export function getFirestore() {
  if (!isInitialized) {
    throw new Error('Firebase not initialized. Set FIREBASE_SERVICE_ACCOUNT environment variable.');
  }
  return admin.firestore();
}


export default admin;
