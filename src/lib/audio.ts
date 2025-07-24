import * as Tone from 'tone';

interface CodeInput {
  code: string;
}

export const parseCodeToMusic = async ({ code }: CodeInput): Promise<void> => {
  await Tone.start();
  const loops = (code.match(/for\s*\(/g) || []).length;
  const variables = (code.match(/let\s+\w+/g) || []).length;
  const synth = new Tone.Synth().toDestination();
  const drum = new Tone.MembraneSynth().toDestination();
  const sequence = new Tone.Sequence((time, note) => {
    if (note === 'drum') drum.triggerAttackRelease('C2', '8n', time);
    else synth.triggerAttackRelease(note, '8n', time);
  }, Array(loops).fill('drum').concat(Array(variables).fill('C4')));
  Tone.Transport.bpm.value = 120;
  sequence.start(0).stop('10s');
  Tone.Transport.start();
};

// Placeholder for MP3 generation (requires lamejs)
export const generateMP3 = async (code: string): Promise<string> => {
  const buffer = await Tone.Offline(() => parseCodeToMusic({ code }), 10);
  // Implement MP3 conversion with lamejs (not included in MVP for simplicity)
  // const mp3 = bufferToMP3(buffer);
  // return URL.createObjectURL(mp3);
  return ''; // Return empty for now, add lamejs later
};