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
    synth: new Tone.Synth({ oscillator: { type: 'triangle' } }).connect(reverb).connect(delay).toDestination(),
    chime: new Tone.MetalSynth().connect(reverb).toDestination(),
    bass: new Tone.MonoSynth({ oscillator: { type: 'sawtooth' } }).connect(reverb).toDestination(),
    pad: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' } }).connect(reverb).connect(delay).toDestination(),
  };
};

/** Trigger the appropriate instrument or chord for a given note id. */
const triggerNote = (note: string, instruments: ReturnType<typeof createInstruments>, time = 0, duration: string = '8n') => {
  switch (note) {
    case 'drum':
      instruments.drum.triggerAttackRelease('C2', duration, time);
      break;
    case 'chime':
      instruments.chime.triggerAttackRelease('E5', duration, time);
      break;
    case 'bass':
      instruments.bass.triggerAttackRelease('G2', duration, time);
      break;
    case 'pad':
      instruments.pad.triggerAttackRelease(['C3', 'E3', 'G3'], duration, time); // C major chord
      break;
    default:
      instruments.synth.triggerAttackRelease(note, duration, time);
  }
};

/** Create song structure with intro, main melody, and outro. */
const createSongStructure = (notes: string[]): { note: string, time: number, duration: string }[] => {
  const bpm = 120;
  const beatDuration = 60 / bpm / 2; // 8th note
  const introLength = 4; // 4 beats (2 seconds)
  const outroLength = 4; // 4 beats (2 seconds)
  const mainLength = 32; // 32 beats (16 seconds)

  const structuredNotes: { note: string, time: number, duration: string }[] = [];

  // Intro: Drums and pad
  let currentTime = 0;
  for (let i = 0; i < introLength; i++) {
    structuredNotes.push({ note: 'drum', time: currentTime, duration: '8n' });
    if (i % 2 === 0) structuredNotes.push({ note: 'pad', time: currentTime, duration: '2n' });
    currentTime += beatDuration;
  }

  // Main melody: Enhanced notes
  let noteIndex = 0;
  for (let i = 0; i < mainLength; i++) {
    if (noteIndex < notes.length) {
      const duration = Math.random() < 0.5 ? '8n' : '4n';
      structuredNotes.push({ note: notes[noteIndex], time: currentTime, duration });
      noteIndex++;
    }
    if (i % 4 === 0) structuredNotes.push({ note: 'pad', time: currentTime, duration: '1n' });
    currentTime += beatDuration;
  }

  // Outro: Fade out pad
  structuredNotes.push({ note: 'pad', time: currentTime, duration: '2n' });
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
    let notes = buildNoteSequence(counts);

    // Enhance notes with MelodyRNN (client-side call)
    notes = await enhanceWithMelodyRNN(notes);

    // Create song structure
    const structuredNotes = createSongStructure(notes);

    // Create sequence
    currentSequence = new Tone.Sequence((time, noteData: { note: string, duration: string }) => {
      triggerNote(noteData.note, instruments, time, noteData.duration);
    }, structuredNotes.map(n => ({ note: n.note, duration: n.duration, time: n.time })));

    Tone.Transport.bpm.value = 120;
    currentSequence.start(0).stop('20s');
    Tone.Transport.start();

    // Fade out and stop
    const master = Tone.getDestination();
    Tone.Transport.schedule(() => {
      master.volume.rampTo(-Infinity, 2);
    }, '18s');
    setTimeout(() => {
      Tone.Transport.stop();
      if (currentSequence) {
        currentSequence.dispose();
        currentSequence = null;
      }
    }, 20000);
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

    let notes = buildNoteSequence(counts);
    // Enhance notes with MelodyRNN
    notes = await enhanceWithMelodyRNN(notes);

    // Create song structure
    const structuredNotes = createSongStructure(notes);

    const buffer = await Tone.Offline(({ transport }) => {
      const instruments = createInstruments();

      const bpm = 120;
      const master = Tone.getDestination();

      for (const { note, time, duration } of structuredNotes) {
        triggerNote(note, instruments, time, duration);
      }

      // Fade out
      master.volume.rampTo(-Infinity, 2, 18);

      transport.start(1).stop(20); // Fix transport start time to 1
    }, 20);

    console.log('Buffer duration:', buffer.duration, 'samples:', buffer.length);

    // Convert ToneAudioBuffer to native AudioBuffer for WAV encoding
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

// Client-side MelodyRNN enhancement
import type { MusicRNN as MusicRNNType } from '@magenta/music/es6/music_rnn';
// Type-only import for core types (namespace `mm`)
import type * as mm from '@magenta/music/es6/core';

export const enhanceWithMelodyRNN = async (notes: string[]): Promise<string[]> => {
  if (typeof window === 'undefined') {
    // Fallback for server-side
    return notes;
  }

  const { MusicRNN } = await import('@magenta/music/es6/music_rnn');
  // Runtime Magenta core module (avoid namespace clash with type import)
  const mmCore = await import('@magenta/music/es6/core');

  // Use a local instance to avoid global scope issues
  let melodyRNNInstance: MusicRNNType | null = null;
  if (!melodyRNNInstance) {
    melodyRNNInstance = new MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
    await melodyRNNInstance.initialize();
  }

  // Convert notes to NoteSequence, excluding drums
  const noteSequence: any = {
    notes: [],
    totalTime: 0,
    quantizationInfo: { stepsPerQuarter: 4 },
  };

  let currentTime = 0;
  const beatDuration = 0.5; // 8th note at 120 BPM
  const cMajorPitches = [60, 62, 64, 65, 67, 69, 71]; // C4, D4, E4, F4, G4, A4, B4

  const drumCount = notes.filter(n => n === 'drum').length;

  for (const note of notes) {
    if (note === 'drum') continue; // Skip drum notes

    let pitch: number;
    let isDrum = false;

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

  if (!noteSequence.notes?.length) {
    return notes; // Fallback if no melodic notes
  }

  const quantizedSequence = mmCore.sequences.quantizeNoteSequence(noteSequence, 4);
  const rnnSteps = 48; // 12 bars
  const temperature = 0.8; // Catchy melody

  try {
    const enhancedSequence = await melodyRNNInstance.continueSequence(quantizedSequence, rnnSteps, temperature);

    // Map enhanced notes back to instrument IDs
    let enhancedNotes: string[] = enhancedSequence.notes!.map(n => {
      const pitch = n.pitch;
      if (pitch == null) return 'pad';
      if (pitch >= 72) return 'chime'; // E5 range
      if (pitch <= 55) return 'bass'; // G3 range
      if (pitch >= 57 && pitch < 60) return 'pad'; // A3 range
      return Tone.Midi(pitch).toNote(); // C major scale
    });

    // Reintroduce drum notes
    for (let i = 0; i < drumCount; i++) {
      const insertIndex = Math.floor((i / drumCount) * enhancedNotes.length);
      enhancedNotes.splice(insertIndex, 0, 'drum');
    }

    // Add rhythmic variation
    const variedNotes: string[] = [];
    for (const note of enhancedNotes) {
      if (Math.random() < 0.1) continue; // 10% chance of rest
      variedNotes.push(note);
    }

    // Clean up MelodyRNN instance
    melodyRNNInstance.dispose();
    melodyRNNInstance = null;

    return variedNotes;
  } catch (error) {
    console.error('MelodyRNN error:', error);
    // Clean up on error
    if (melodyRNNInstance) {
      melodyRNNInstance.dispose();
      melodyRNNInstance = null;
    }
    return notes; // Fallback
  }
};