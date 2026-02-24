import admin from 'firebase-admin';
import fs from 'fs';

let app: admin.app.App | null = null;

function loadServiceAccount(): admin.ServiceAccount {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (base64) {
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  }

  if (path) {
    const json = fs.readFileSync(path, 'utf8');
    return JSON.parse(json);
  }

  throw new Error('Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_BASE64');
}

export function initFirebase(): admin.app.App {
  if (app) return app;

  const serviceAccount = loadServiceAccount();
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return app;
}

export function getFirestore(): admin.firestore.Firestore {
  if (!app) initFirebase();
  return admin.firestore();
}

export const FieldValue = admin.firestore.FieldValue;
