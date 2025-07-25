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

    const notes = buildNoteSequence(counts);

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