import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Prefer explicit service-account credentials (sa key JSON is stored in env vars)
// but fall back to GOOGLE_APPLICATION_CREDENTIALS / default credentials in local dev.
const adminConfig = process.env.FIREBASE_PRIVATE_KEY
  ? {
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines in the private key
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    }
  : {
      credential: applicationDefault(),
    };

export const adminApp = getApps().length ? getApps()[0] : initializeApp(adminConfig);
export const adminDb = getFirestore(adminApp);
