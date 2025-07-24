import * as Tone from 'tone';

interface CodeInput {
  code: string;
}
let currentSequence: Tone.Sequence | null = null;

export const parseCodeToMusic = async ({ code }: CodeInput): Promise<void> => {
    try {
      // Ensure audio context is started
      await Tone.start();
  
      // Stop and clear previous sequence and transport
      if (currentSequence) {
        currentSequence.stop();
        currentSequence.dispose();
        currentSequence = null;
      }
      Tone.Transport.stop();
      Tone.Transport.cancel();
  
      // Parse code for patterns
      const loops = (code.match(/for\s*\(/g) || []).length;
      const variables = (code.match(/let\s+\w+/g) || []).length;
  
      // Create instruments
      const synth = new Tone.Synth().toDestination();
      const drum = new Tone.MembraneSynth().toDestination();
  
      // Create new sequence
      currentSequence = new Tone.Sequence((time, note) => {
        if (note === 'drum') drum.triggerAttackRelease('C2', '8n', time);
        else synth.triggerAttackRelease(note, '8n', time);
      }, Array(loops).fill('drum').concat(Array(variables).fill('C4')));
  
      // Set BPM and start sequence
      Tone.Transport.bpm.value = 120;
      currentSequence.start(0).stop('10s');
      Tone.Transport.start();
  
      // Stop transport after 10 seconds and wait for it
      await new Promise<void>(resolve => {
        setTimeout(() => {
          Tone.Transport.stop();
          if (currentSequence) {
            currentSequence.dispose();
            currentSequence = null;
          }
          resolve();
        }, 10000);
      });
    } catch (error) {
      console.error('Error in parseCodeToMusic:', error);
      throw error;
    }
  };

// Placeholder for MP3 generation (requires lamejs)
export const generateMP3 = async (code: string): Promise<string> => {
  const buffer = await Tone.Offline(() => parseCodeToMusic({ code }), 10);
  // Implement MP3 conversion with lamejs (not included in MVP for simplicity)
  // const mp3 = bufferToMP3(buffer);
  // return URL.createObjectURL(mp3);
  return ''; // Return empty for now, add lamejs later
};
