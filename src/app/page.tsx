"use client";
import { useState, useEffect } from 'react';
import * as Tone from 'tone';
import { parseCodeToMusic,generateAudio } from '../lib/audio';
import axios from 'axios';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';


export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [code, setCode] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoadingAuth(false);
      if (!user) {
        // Redirect to sign-in page if not authenticated
        router.push('/signin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch payment status whenever user changes or after Stripe redirect
  useEffect(() => {
    if (!user) return;

    const fetchPaymentStatus = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        setIsPaid(!!snap.data()?.isPaid);
      } catch (err) {
        console.error('Failed to fetch payment status', err);
      }
    };

    fetchPaymentStatus();

    if (searchParams.get('success') === 'true') {
      // Poll once more after checkout success to reflect status quickly
      fetchPaymentStatus();
    }
  }, [user, searchParams]);


  const handleGenerate = async () => {
    if (!code.trim()) {
      alert('Please enter some code!');
      return;
    }
    setIsGenerating(true);
    try {
      await parseCodeToMusic({ code });
    } catch (error) {
      alert('Failed to generate music. Try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePayment = async () => {
    if (!user) {
      alert('Please sign in to proceed with payment.');
      return;
    }
    // Persist code so it's not lost after Stripe redirect
    if (code.trim()) {
      try {
        localStorage.setItem('pendingCode', code);
      } catch (e) {
        console.warn('Unable to access localStorage:', e);
      }
    }
    try {
      const response = await axios.post('/api/checkout', {
        userId: user.uid,
      });
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Try again.');
    }
  };

  const handleDownload = async () => {
    try {
      console.log(`Attempting to download WAV file... for code = ${code}`)
      const wavUrl = await generateAudio(code);
      if (wavUrl) {
        const link = document.createElement('a');
        link.href = wavUrl;
        link.download = 'code-to-music.wav';
        link.click();
        URL.revokeObjectURL(wavUrl);
      } else {
        alert('Failed to generate WAV. Try again.');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to generate WAV. Try again.');
    }
  };

  // Restore code saved before Stripe redirect
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pendingCode');
      if (saved) {
        setCode(saved);
        localStorage.removeItem('pendingCode');
      }
    } catch (e) {
      console.warn('Unable to access localStorage:', e);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-2/3 max-w-md">
        <div className="flex justify-center items-center mb-4">
          <h1 className="text-2xl font-bold text-center">Code-To-Music Generator</h1>
        </div>
        <div className="flex justify-center items-center mb-4">
        <p className="text-center mb-4">
          Welcome, {user?.displayName}! 
          <button 
            onClick={() => auth.signOut()} 
            className="text-sm text-blue-500 hover:text-blue-700 underline ml-2"
          >
            Sign Out
          </button></p>
        </div>
        
        <p className="text-center mb-4">Paste your code, hear it as music, and download as WAV for $1!</p>
        <textarea
          className="w-full p-3 mb-4 border rounded-md focus:ring focus:ring-blue-200 transition duration-300"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste JavaScript or Python code (max 1000 characters). Try for loops (drums), variables (piano), if statements (chimes), functions (bass), or comments (pads) for unique sounds!"
          maxLength={1000}
          rows={5}
        />
        <button
          className={`w-full p-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-300 focus:outline-none focus:ring focus:ring-blue-200 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          Generate Music
        </button>
        <button
            className="w-full p-3 text-white rounded-md mt-4 bg-green-400 hover:bg-green-400"
            onClick={isPaid ? handleDownload : handlePayment}
          >
            {isPaid ? 'Download WAV' : 'Pay $1 to Download'}
          </button>
      </div>
    </div>
  );
}
