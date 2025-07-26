import * as Tone from 'tone';
import toWav from 'audiobuffer-to-wav';

interface CodeInput {
  code: string;
}

let currentSequence: Tone.Sequence | null = null;

// ----------------------------------
// Helper utilities
// ----------------------------------

type PatternCounts = {
  loops: number;
  variables: number;
  conditionals: number;
  functions: number;
  comments: number;
};

/**
 * Extract how many times each syntactic construct appears in the code.
 */
const extractPatternCounts = (code: string): PatternCounts => ({
  loops: (code.match(/for\s*\(/g) || []).length,
  variables: (code.match(/\b(let|const|var)\s+\w+/g) || []).length,
  conditionals: (code.match(/\bif\s*\(/g) || []).length,
  functions: (code.match(/\bfunction\b|\b=>\b/g) || []).length,
  comments: (code.match(/\/\/.*|\/\*[\s\S]*?\*\//g) || []).length,
});

/** Build an ordered array of note/instrument IDs based on counts. */
const buildNoteSequence = ({ loops, variables, conditionals, functions, comments }: PatternCounts): string[] => (
  [
    ...Array(loops).fill('drum'),
    ...Array(variables).fill('C4'),
    ...Array(conditionals).fill('chime'),
    ...Array(functions).fill('bass'),
    ...Array(comments).fill('pad'),
  ]
);

/** Create instrument instances with effects. */
const createInstruments = () => {
  const reverb = new Tone.Reverb({ decay: 2, wet: 0.3 }).toDestination();
  const delay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.2, wet: 0.2 }).toDestination();

  return {
    drum: new Tone.MembraneSynth().connect(reverb).toDestination(),
    synth: new Tone.Synth({ oscillator: { type: 'triangle' }, volume: -10 }).connect(reverb).connect(delay).toDestination(),
    chime: new Tone.MetalSynth().connect(reverb).toDestination(),
    bass: new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, volume: -12 }).connect(reverb).toDestination(),
    pad: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, volume: -8 }).connect(reverb).connect(delay).toDestination(),
  };
};

/** Trigger the appropriate instrument or chord for a given note id. */
const triggerNote = (
  note: string | { note: string; chord?: string[] },
  instruments: ReturnType<typeof createInstruments>,
  time = 0,
  duration: string = '8n',
  velocity: number = 1
) => {
  if (typeof note === 'object' && note.chord) {
    instruments.pad.triggerAttackRelease(note.chord, duration, time, velocity);
  } else {
    const noteStr = typeof note === 'object' ? note.note : note;
    switch (noteStr) {
      case 'drum':
        instruments.drum.triggerAttackRelease('C2', duration, time, velocity);
        break;
      case 'chime':
        instruments.chime.triggerAttackRelease('E5', duration, time, velocity);
        break;
      case 'bass':
        instruments.bass.triggerAttackRelease('G2', duration, time, velocity);
        break;
      case 'pad':
        instruments.pad.triggerAttackRelease(['C3', 'E3', 'G3'], duration, time, velocity);
        break;
      default:
        instruments.synth.triggerAttackRelease(noteStr, duration, time, velocity);
    }
  }
};

// Minimal typings to avoid `any` while staying framework-agnostic
interface MagentaNote {
  pitch: number;
  [key: string]: unknown;
}

interface SimpleNoteSequence {
  notes: MagentaNote[];
  totalTime: number;
  quantizationInfo: { stepsPerQuarter: number };
}

/** Convert note sequence to Magenta NoteSequence, excluding drums. */
const notesToNoteSequence = (notes: string[]): SimpleNoteSequence => {
  const noteSequence: SimpleNoteSequence = {
    notes: [],
    totalTime: 0,
    quantizationInfo: { stepsPerQuarter: 4 },
  };

  let currentTime = 0;
  const beatDuration = 0.5; // 8th note at 120 BPM
  const cMajorPitches = [60, 62, 64, 65, 67, 69, 71]; // C4, D4, E4, F4, G4, A4, B4

  for (const note of notes) {
    if (note === 'drum') continue; // Skip drum notes

    let pitch: number;
    const isDrum = false;

    switch (note) {
      case 'chime':
        pitch = 64; // E5
        break;
      case 'bass':
        pitch = 55; // G3
        break;
      case 'pad':
        pitch = 60; // C4
        break;
      default:
        pitch = cMajorPitches[Math.floor(Math.random() * cMajorPitches.length)]; // Random C major note
        break;
    }

    noteSequence.notes!.push({
      pitch,
      startTime: currentTime,
      endTime: currentTime + beatDuration,
      isDrum,
    });
    currentTime += beatDuration;
  }

  noteSequence.totalTime = currentTime;
  return noteSequence;
};

/** Enhance notes with MelodyRNN in C major. */
const enhanceWithMelodyRNN = async (notes: string[], temperature: number = 0.8): Promise<string[]> => {
  if (typeof window === 'undefined') {
    return notes; // Server-side fallback
  }

  const { MusicRNN } = await import('@magenta/music/es6/music_rnn');
  const mm = await import('@magenta/music/es6/core');

  // Runtime instance created from dynamic import
  const melodyRNNInstance = new MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
  await melodyRNNInstance.initialize();

  const drumCount = notes.filter(n => n === 'drum').length;
  const noteSequence = notesToNoteSequence(notes);

  if (!noteSequence.notes?.length) {
    melodyRNNInstance.dispose();
    return notes; // Fallback
  }

  const quantizedSequence = mm.sequences.quantizeNoteSequence(noteSequence, 4);
  const rnnSteps = 32; // 8 bars for each section

  try {
    const enhancedSequence = await melodyRNNInstance.continueSequence(quantizedSequence, rnnSteps, temperature);

    const enhancedNotes: string[] = enhancedSequence.notes!.map((n: MagentaNote) => {
      if (n.pitch >= 72) return 'chime';
      if (n.pitch <= 55) return 'bass';
      if (n.pitch >= 57 && n.pitch < 60) return 'pad';
      return Tone.Midi(n.pitch).toNote();
    });

    // Reintroduce drum notes
    for (let i = 0; i < drumCount; i++) {
      const insertIndex = Math.floor((i / drumCount) * enhancedNotes.length);
      enhancedNotes.splice(insertIndex, 0, 'drum');
    }

    // Add rhythmic variation
    const variedNotes: string[] = [];
    for (const note of enhancedNotes) {
      if (Math.random() < 0.1) continue; // 10% rest
      variedNotes.push(note);
    }

    melodyRNNInstance.dispose();
    return variedNotes;
  } catch (error) {
    console.error('MelodyRNN error:', error);
    melodyRNNInstance.dispose();
    return notes;
  }
};

/** Create song structure with verse, chorus, bridge. */
const createSongStructure = async (notes: string[]): Promise<{ note: string | { note: string; chord?: string[] }, time: number, duration: string, velocity: number }[]> => {
  const bpm = 120;
  const beatDuration = 60 / bpm / 2; // 8th note
  const introLength = 4; // 2s
  const verseLength = 16; // 8s
  const chorusLength = 16; // 8s
  const bridgeLength = 8; // 4s
  const outroLength = 4; // 2s

  const chords = [
    ['C3', 'E3', 'G3'], // C major
    ['G2', 'B2', 'D3'], // G major
    ['A2', 'C3', 'E3'], // A minor
    ['F2', 'A2', 'C3'], // F major
  ];

  const structuredNotes: { note: string | { note: string; chord?: string[] }, time: number, duration: string, velocity: number }[] = [];

  let currentTime = 0;

  // Intro: Drums and pad (C major)
  for (let i = 0; i < introLength; i++) {
    structuredNotes.push({ note: 'drum', time: currentTime, duration: '8n', velocity: 0.7 });
    if (i % 2 === 0) structuredNotes.push({ note: { note: 'pad', chord: chords[0] }, time: currentTime, duration: '2n', velocity: 0.5 });
    currentTime += beatDuration;
  }

  // Verse 1: Soft melody, sparse drums, C-G chord
  const verseNotes = await enhanceWithMelodyRNN(notes, 0.9); // Softer melody
  let noteIndex = 0;
  for (let i = 0; i < verseLength; i++) {
    if (noteIndex < verseNotes.length && verseNotes[noteIndex] !== 'drum') {
      const duration = Math.random() < 0.5 ? '8n' : '4n';
      structuredNotes.push({ note: verseNotes[noteIndex], time: currentTime, duration, velocity: 0.6 });
      noteIndex++;
    }
    if (i % 4 === 0) {
      const chordIndex = Math.floor(i / 8) % 2; // C-G
      structuredNotes.push({ note: { note: 'pad', chord: chords[chordIndex] }, time: currentTime, duration: '1n', velocity: 0.5 });
    }
    if (i % 8 === 0) structuredNotes.push({ note: 'drum', time: currentTime, duration: '8n', velocity: 0.6 });
    currentTime += beatDuration;
  }

  // Chorus 1: Bold melody, full drums, C-G-Am-F chord
  const chorusNotes = await enhanceWithMelodyRNN(notes, 0.7); // Catchier melody
  noteIndex = 0;
  for (let i = 0; i < chorusLength; i++) {
    if (noteIndex < chorusNotes.length) {
      const duration = Math.random() < 0.5 ? '8n' : '4n';
      structuredNotes.push({ note: chorusNotes[noteIndex], time: currentTime, duration, velocity: 0.9 });
      noteIndex++;
    }
    if (i % 4 === 0) {
      const chordIndex = i / 4; // C-G-Am-F
      structuredNotes.push({ note: { note: 'pad', chord: chords[chordIndex] }, time: currentTime, duration: '1n', velocity: 0.7 });
    }
    if (i % 2 === 0) structuredNotes.push({ note: 'drum', time: currentTime, duration: '8n', velocity: 0.8 });
    currentTime += beatDuration;
  }

  // Verse 2: Similar to Verse 1, slight variation
  const verseNotes2 = await enhanceWithMelodyRNN(notes, 0.9);
  noteIndex = 0;
  for (let i = 0; i < verseLength; i++) {
    if (noteIndex < verseNotes2.length && verseNotes2[noteIndex] !== 'drum') {
      const duration = Math.random() < 0.5 ? '8n' : '4n';
      structuredNotes.push({ note: verseNotes2[noteIndex], time: currentTime, duration, velocity: 0.6 });
      noteIndex++;
    }
    if (i % 4 === 0) {
      const chordIndex = Math.floor(i / 8) % 2;
      structuredNotes.push({ note: { note: 'pad', chord: chords[chordIndex] }, time: currentTime, duration: '1n', velocity: 0.5 });
    }
    if (i % 8 === 0) structuredNotes.push({ note: 'drum', time: currentTime, duration: '8n', velocity: 0.6 });
    currentTime += beatDuration;
  }

  // Bridge: Chime-led, Am-F chord, no drums
  noteIndex = 0;
  for (let i = 0; i < bridgeLength; i++) {
    if (i % 2 === 0) structuredNotes.push({ note: 'chime', time: currentTime, duration: '4n', velocity: 0.7 });
    if (i % 4 === 0) {
      const chordIndex = (i / 4) + 2; // Am-F
      structuredNotes.push({ note: { note: 'pad', chord: chords[chordIndex] }, time: currentTime, duration: '1n', velocity: 0.6 });
    }
    currentTime += beatDuration;
  }

  // Chorus 2: Repeat chorus, slightly louder
  noteIndex = 0;
  for (let i = 0; i < chorusLength; i++) {
    if (noteIndex < chorusNotes.length) {
      const duration = Math.random() < 0.5 ? '8n' : '4n';
      structuredNotes.push({ note: chorusNotes[noteIndex], time: currentTime, duration, velocity: 1.0 });
      noteIndex++;
    }
    if (i % 4 === 0) {
      const chordIndex = i / 4;
      structuredNotes.push({ note: { note: 'pad', chord: chords[chordIndex] }, time: currentTime, duration: '1n', velocity: 0.8 });
    }
    if (i % 2 === 0) structuredNotes.push({ note: 'drum', time: currentTime, duration: '8n', velocity: 0.9 });
    currentTime += beatDuration;
  }

  // Outro: Pad and chime fade
  structuredNotes.push({ note: { note: 'pad', chord: chords[0] }, time: currentTime, duration: '2n', velocity: 0.5 });
  structuredNotes.push({ note: 'chime', time: currentTime, duration: '2n', velocity: 0.5 });
  currentTime += beatDuration * outroLength;

  return structuredNotes;
};

export const parseCodeToMusic = async ({ code }: CodeInput): Promise<void> => {
  try {
    await Tone.start();
    if (currentSequence) {
      currentSequence.stop();
      currentSequence.dispose();
      currentSequence = null;
    }
    Tone.Transport.stop();
    Tone.Transport.cancel();

    const counts = extractPatternCounts(code);
    const totalEvents = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalEvents === 0) {
      throw new Error('No audio events generated. Please include loops, variables, if statements, functions, or comments.');
    }

    const instruments = createInstruments();
    const notes = buildNoteSequence(counts);

    // Create song structure
    const structuredNotes = await createSongStructure(notes);

    // Create sequence
    currentSequence = new Tone.Sequence((time, noteData: { note: string | { note: string; chord?: string[] }, duration: string, velocity: number }) => {
      triggerNote(noteData.note, instruments, time, noteData.duration, noteData.velocity);
    }, structuredNotes.map(n => ({ note: n.note, duration: n.duration, velocity: n.velocity, time: n.time })));

    Tone.Transport.bpm.value = 120;
    currentSequence.start(0).stop('40s');
    Tone.Transport.start();

    // Fade out and stop
    const master = Tone.getDestination();
    Tone.Transport.schedule(() => {
      master.volume.rampTo(-Infinity, 2);
    }, '38s');
    setTimeout(() => {
      Tone.Transport.stop();
      if (currentSequence) {
        currentSequence.dispose();
        currentSequence = null;
      }
    }, 40000);
  } catch (error) {
    console.error('Error in parseCodeToMusic:', error);
    throw error;
  }
};

export const generateAudio = async (code: string): Promise<string> => {
  try {
    const counts = extractPatternCounts(code);
    const totalEvents = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalEvents === 0) {
      throw new Error('No audio events generated. Please include loops, variables, if statements, functions, or comments.');
    }

    const notes = buildNoteSequence(counts);
    const structuredNotes = await createSongStructure(notes);

    const buffer = await Tone.Offline(({ transport }) => {
      const instruments = createInstruments();
      const master = Tone.getDestination();

      for (const { note, time, duration, velocity } of structuredNotes) {
        triggerNote(note, instruments, time, duration, velocity);
      }

      master.volume.rampTo(-Infinity, 2, 38);
      transport.start(0).stop(40);
    }, 40);

    console.log('Buffer duration:', buffer.duration, 'samples:', buffer.length);

    const audioBuffer = buffer.get();
    if (!audioBuffer) {
      throw new Error('Failed to retrieve audio buffer from Tone.Offline.');
    }
    const wavData = toWav(audioBuffer);
    const wavBlob = new Blob([wavData], { type: 'audio/wav' });
    return URL.createObjectURL(wavBlob);
  } catch (error) {
    console.error('Error generating WAV:', error);
    throw error;
  }
};