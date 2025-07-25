import * as Tone from 'tone';
import toWav from 'audiobuffer-to-wav';

interface CodeInput {
  code: string;
}

let currentSequence: Tone.Sequence | null = null;

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

    // Parse code for patterns
    const loops = (code.match(/for\s*\(/g) || []).length;
    const variables = (code.match(/\b(let|const|var)\s+\w+/g) || []).length;
    const conditionals = (code.match(/\bif\s*\(/g) || []).length;
    const functions = (code.match(/\bfunction\b|\b=>\b/g) || []).length;
    const comments = (code.match(/\/\/.*|\/\*[\s\S]*?\*\//g) || []).length;

    const totalEvents = loops + variables + conditionals + functions + comments;
    if (totalEvents === 0) {
      throw new Error('No audio events generated. Please include loops, variables, if statements, functions, or comments.');
    }

    // Create instruments
    const drum = new Tone.MembraneSynth().toDestination(); // For loops
    const synth = new Tone.Synth().toDestination(); // For variables
    const chime = new Tone.MetalSynth().toDestination(); // For condition Miranda statements
    const bass = new Tone.MonoSynth().toDestination(); // For functions
    const pad = new Tone.PolySynth(Tone.Synth).toDestination(); // For comments

    // Create sequence of notes
    const notes = [
      ...Array(loops).fill('drum'),
      ...Array(variables).fill('C4'),
      ...Array(conditionals).fill('chime'),
      ...Array(functions).fill('bass'),
      ...Array(comments).fill('pad'),
    ];

    currentSequence = new Tone.Sequence((time, note) => {
      if (note === 'drum') drum.triggerAttackRelease('C2', '8n', time);
      else if (note === 'chime') chime.triggerAttackRelease('E5', '8n', time);
      else if (note === 'bass') bass.triggerAttackRelease('G2', '8n', time);
      else if (note === 'pad') pad.triggerAttackRelease('A3', '8n', time);
      else synth.triggerAttackRelease(note, '8n', time);
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
    const loops = (code.match(/for\s*\(/g) || []).length;
    const variables = (code.match(/\b(let|const|var)\s+\w+/g) || []).length;
    const conditionals = (code.match(/\bif\s*\(/g) || []).length;
    const functions = (code.match(/\bfunction\b|\b=>\b/g) || []).length;
    const comments = (code.match(/\/\/.*|\/\*[\s\S]*?\*\//g) || []).length;

    const totalEvents = loops + variables + conditionals + functions + comments;
    if (totalEvents === 0) {
      throw new Error('No audio events generated. Please include loops, variables, if statements, functions, or comments.');
    }

    const buffer = await Tone.Offline(({ transport }) => {
      const drum = new Tone.MembraneSynth().toDestination();
      const synth = new Tone.Synth().toDestination();
      const chime = new Tone.MetalSynth().toDestination();
      const bass = new Tone.MonoSynth().toDestination();
      const pad = new Tone.PolySynth(Tone.Synth).toDestination();

      const notes = [
        ...Array(loops).fill('drum'),
        ...Array(variables).fill('C4'),
        ...Array(conditionals).fill('chime'),
        ...Array(functions).fill('bass'),
        ...Array(comments).fill('pad'),
      ];

      const bpm = 120;
      const beatDuration = 60 / bpm / 2; // 8th note duration

      let time = 0;
      const maxTime = 10;
      while (time < maxTime) {
        for (const note of notes) {
          if (time >= maxTime) break;
          if (note === 'drum') {
            drum.triggerAttackRelease('C2', '8n', time);
          } else if (note === 'chime') {
            chime.triggerAttackRelease('E5', '8n', time);
          } else if (note === 'bass') {
            bass.triggerAttackRelease('G2', '8n', time);
          } else if (note === 'pad') {
            pad.triggerAttackRelease('A3', '8n', time);
          } else {
            synth.triggerAttackRelease(note, '8n', time);
          }
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