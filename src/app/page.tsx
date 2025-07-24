"use client";
import { useState } from 'react';
import * as Tone from 'tone';
import { parseCodeToMusic } from '../lib/audio';
import axios from 'axios';

export default function Home() {
  const [code, setCode] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-2/3 max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">Code-to-Music Generator</h1>
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
        <audio controls id="preview" className="mt-4 w-full" />
        <button
            className={`w-full p-3 text-white rounded-md mt-4 ${
              isPaid ? 'bg-green-400 hover:bg-green-400' : 'bg-gray-400 cursor-not-allowed'
            }`}
            onClick={handlePayment}
            disabled={!isPaid}
          >
            Download MP3 ($1)
          </button>
      </div>
    </div>
  );
}