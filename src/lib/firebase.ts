import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_APP_ID!,
};

// Debug logging
console.log('Firebase Config:', {
  apiKey: process.env.NEXT_PUBLIC_API_KEY ? 'Set' : 'Missing',
  authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN ? 'Set' : 'Missing',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID ? 'Set' : 'Missing',
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET ? 'Set' : 'Missing',
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID ? 'Set' : 'Missing',
  appId: process.env.NEXT_PUBLIC_APP_ID ? 'Set' : 'Missing',
});

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();