"use client";
import { useState, useEffect } from 'react';
import * as Tone from 'tone';
import { parseCodeToMusic,generateAudio } from '../lib/audio';
import axios from 'axios';

export default function Home() {
  const [code, setCode] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Check for successful payment on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success')) {
      setIsPaid(true);
      localStorage.setItem('isPaid', 'true'); // Persist for MVP
    }
    // Load from localStorage (temporary for MVP)
    if (localStorage.getItem('isPaid') === 'true') {
      setIsPaid(true);
    }
  }, []);

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
    try {
      const response = await axios.post('/api/checkout');
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Try again.');
    }
  };

  const handleDownload = async () => {
    try {
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-2/3 max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">Code-To-Music Generator</h1>
        <textarea
          className="w-full p-3 mb-4 border rounded-md focus:ring focus:ring-blue-200 transition duration-300"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste your code here..."
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
            {isPaid ? 'Download MP3' : 'Pay $1 to Download'}
          </button>
      </div>
    </div>
  );
}
