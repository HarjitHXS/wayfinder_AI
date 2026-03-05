// Firebase configuration - values populated from runtime window.__env__
// For Cloud Run deployment, set these environment variables:
// FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET,
// FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID

interface FirebaseConfigType {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Helper to get config from window object (populated at runtime) or environment
function getConfigValue(key: string, defaultValue: string = ''): string {
  // Check if running in browser and window.__env__ exists (allows runtime configuration)
  if (typeof window !== 'undefined' && (window as any).__env__ && (window as any).__env__[key]) {
    return (window as any).__env__[key];
  }
  return defaultValue;
}

export const firebaseConfig: FirebaseConfigType = {
  apiKey: getConfigValue('FIREBASE_API_KEY'),
  authDomain: getConfigValue('FIREBASE_AUTH_DOMAIN'),
  projectId: getConfigValue('FIREBASE_PROJECT_ID'),
  storageBucket: getConfigValue('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getConfigValue('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getConfigValue('FIREBASE_APP_ID'),
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
};
