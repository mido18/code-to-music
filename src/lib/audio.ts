import * as Tone from 'tone';
import toWav from 'audiobuffer-to-wav';
import { MusicRNN } from '@magenta/music/es6/music_rnn';
import * as mm from '@magenta/music/es6/core';

interface CodeInput {
  code: string;
}

let currentSequence: Tone.Sequence | null = null;
let melodyRNN: MusicRNN | null = null;

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

/** Create instrument instances routed to destination. */
const createInstruments = () => ({
  drum: new Tone.MembraneSynth().toDestination(),
  synth: new Tone.Synth().toDestination(),
  chime: new Tone.MetalSynth().toDestination(),
  bass: new Tone.MonoSynth().toDestination(),
  pad: new Tone.PolySynth(Tone.Synth).toDestination(),
});

/** Trigger the appropriate instrument for a given note id. */
const triggerNote = (note: string, instruments: ReturnType<typeof createInstruments>, time = 0) => {
  switch (note) {
    case 'drum':
      instruments.drum.triggerAttackRelease('C2', '8n', time);
      break;
    case 'chime':
      instruments.chime.triggerAttackRelease('E5', '8n', time);
      break;
    case 'bass':
      instruments.bass.triggerAttackRelease('G2', '8n', time);
      break;
    case 'pad':
      instruments.pad.triggerAttackRelease('A3', '8n', time);
      break;
    default:
      instruments.synth.triggerAttackRelease(note, '8n', time);
  }
};

/** Convert note sequence to Magenta NoteSequence. */
const notesToNoteSequence = (notes: string[]): mm.INoteSequence => {
  const noteSequence: mm.INoteSequence = {
    notes: [],
    totalTime: 0,
    quantizationInfo: { stepsPerQuarter: 4 },
  };

  let currentTime = 0;
  const beatDuration = 0.5; // 8th note at 120 BPM

  for (const note of notes) {
    let pitch: number;
    let isDrum: boolean;

    switch (note) {
      case 'drum':
        pitch = 36; // C2
        isDrum = true;
        break;
      case 'chime':
        pitch = 64; // E5
        isDrum = false;
        break;
      case 'bass':
        pitch = 43; // G2
        isDrum = false;
        break;
      case 'pad':
        pitch = 57; // A3
        isDrum = false;
        break;
      default:
        pitch = Tone.Frequency(note).toMidi(); // e.g., C4
        isDrum = false;
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

/** Enhance notes with MelodyRNN. */
const enhanceWithMelodyRNN = async (notes: string[]): Promise<string[]> => {
  if (!melodyRNN) {
    melodyRNN = new MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
    await melodyRNN.initialize();
  }

  const noteSequence = notesToNoteSequence(notes);
  const quantizedSequence = mm.sequences.quantizeNoteSequence(noteSequence, 4);
  const rnnSteps = 32; // Generate 32 steps (8 bars)
  const temperature = 1.0; // Moderate randomness

  try {
    const enhancedSequence = await melodyRNN.continueSequence(quantizedSequence, rnnSteps, temperature);

    // Map enhanced notes back to instrument IDs
    const enhancedNotes: string[] = enhancedSequence.notes!.map(note => {
      if (note.isDrum) return 'drum';
      if (note.pitch >= 60 && note.pitch < 72) return Tone.Midi(note.pitch).toNote();
      if (note.pitch >= 72) return 'chime'; // E5 range
      if (note.pitch < 48) return 'bass'; // G2 range
      return 'pad'; // A3 range
    });

    return enhancedNotes;
  } catch (error) {
    console.error('MelodyRNN error:', error);
    return notes; // Fallback to original notes
  }
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

    // Enhance notes with MelodyRNN
    notes = await enhanceWithMelodyRNN(notes);

    currentSequence = new Tone.Sequence((time, note) => {
      triggerNote(note as string, instruments, time);
    }, notes);

    Tone.Transport.bpm.value = 120;
    currentSequence.start(0).stop('10s');
    Tone.Transport.start();

    setTimeout(() => {
      Tone.Transport.stop();
      if (currentSequence) {
        currentSequence.dispose();
        currentSequence = null;
      }
    }, 10000);
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

    const buffer = await Tone.Offline(({ transport }) => {
      const instruments = createInstruments();

      const bpm = 120;
      const beatDuration = 60 / bpm / 2; // 8th note duration

      let time = 0;
      const maxTime = 10;
      while (time < maxTime) {
        for (const note of notes) {
          if (time >= maxTime) break;
          triggerNote(note as string, instruments, time);
          time += beatDuration;
        }
      }

      transport.start(0).stop(10);
    }, 10);

    console.log('Buffer duration:', buffer.duration, 'samples:', buffer.length);

    const wavData = toWav(buffer);
    const wavBlob = new Blob([wavData], { type: 'audio/wav' });
    return URL.createObjectURL(wavBlob);
  } catch (error) {
    console.error('Error generating WAV:', error);
    throw error;
  }
};