"use client";
import { useState } from 'react';
import * as Tone from 'tone';

export default function Home() {
  const [code, setCode] = useState<string>('');
  const handleGenerate = async () => {
    await parseCodeToMusic({ code });
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
          className="w-full p-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-300 focus:outline-none focus:ring focus:ring-blue-200"
          onClick={handleGenerate}
        >
          Generate Music
        </button>
        <audio controls id="preview" className="mt-4 w-full" />
        <button
          className="w-full p-3 bg-gray-400 text-white rounded-md mt-4 cursor-not-allowed"
          disabled
        >
          Download MP3 ($1)
        </button>
      </div>
    </div>
  );
}