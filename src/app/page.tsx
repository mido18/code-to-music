import { useState } from 'react';
import * as Tone from 'tone';

export default function Home() {
  const [code, setCode] = useState<string>('');
  const handleGenerate = async () => {
    await parseCodeToMusic({ code });
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl">Code-to-Music Generator</h1>
      <textarea
        className="w-full p-2 border"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Paste your code here..."
        maxLength={1000}
      />
      <button className="p-2 bg-blue-500 text-white" onClick={handleGenerate}>
        Generate Music
      </button>
      <audio controls id="preview" />
      <button className="p-2 bg-gray-500 text-white" disabled>
        Download MP3 ($1)
      </button>
    </div>
  );
}