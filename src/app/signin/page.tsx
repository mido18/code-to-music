'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';

export default function SignInPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // If user already signed in, redirect to home
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/');
      } else {
        setIsCheckingAuth(false);
      }
    });
    return () => unsub();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      // Ensure a user doc exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, { isPaid: false, createdAt: Date.now() });
      }
      router.replace('/');
    } catch (err) {
      // Most common error is popup blocked.
      console.error('Google sign-in failed:', err);
      alert('Failed to sign in. Please disable popup blockers and try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-600 text-lg">Checking authentication…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white w-full max-w-md p-8 rounded shadow-md text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome To</h1>
        <h1 className="text-3xl font-bold mb-4">Code To Music</h1>
        <p className="text-gray-600 mb-6">Transform your code into beautiful music. Sign in to continue.</p>
        <button
          className={`w-full py-3 rounded text-white bg-blue-600 hover:bg-blue-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2`}
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
        >
          {isSigningIn ? (
            <span>Signing in…</span>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M21.35 11.1h-9.17v2.99h5.27c-.23 1.26-1.41 3.7-5.27 3.7-3.17 0-5.77-2.63-5.77-5.8s2.6-5.8 5.77-5.8c1.8 0 3 .77 3.7 1.44l2.52-2.44C16.86 3.31 14.83 2.4 12 2.4 6.87 2.4 2.67 6.62 2.67 11.7S6.87 21 12 21c6.35 0 8.67-4.44 8.67-6.61 0-.44-.05-.8-.14-1.29-.09-.48-.18-.86-.18-.99z" />
              </svg>
              <span>Sign in with Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}