// Firebase configuration - values populated from environment variables at build time or runtime
// For Cloud Run deployment, set these environment variables:
// NG_APP_FIREBASE_API_KEY, NG_APP_FIREBASE_AUTH_DOMAIN, NG_APP_FIREBASE_PROJECT_ID, etc.

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
  apiKey: getConfigValue('FIREBASE_API_KEY', 'AIzaSyC6Ww5ipt_2j0dn142ivIlx3KVcr9L48dQ'),
  authDomain: getConfigValue('FIREBASE_AUTH_DOMAIN', 'wayfinder-ui-d87e8.firebaseapp.com'),
  projectId: getConfigValue('FIREBASE_PROJECT_ID', 'wayfinder-ui-d87e8'),
  storageBucket: getConfigValue('FIREBASE_STORAGE_BUCKET', 'wayfinder-ui-d87e8.firebasestorage.app'),
  messagingSenderId: getConfigValue('FIREBASE_MESSAGING_SENDER_ID', '468644110623'),
  appId: getConfigValue('FIREBASE_APP_ID', '1:468644110623:web:4f6ab14196f74c98c2902a'),
};
