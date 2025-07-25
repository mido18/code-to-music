declare module 'audiobuffer-to-wav' {
  /**
   * Convert a Web Audio `AudioBuffer` into a WAV-formatted `ArrayBuffer`.
   *
   * @param buffer The source `AudioBuffer` to serialise.
   * @param options Optional settings.
   * @param options.float32 When `true`, encode the WAV file as 32-bit floating-point PCM. Defaults to 16-bit PCM when omitted or `false`.
   * @returns An `ArrayBuffer` containing WAV-encoded audio data.
   */
  export default function audioBufferToWav(
    buffer: AudioBuffer,
    options?: {
      float32?: boolean;
    }
  ): ArrayBuffer;
}
