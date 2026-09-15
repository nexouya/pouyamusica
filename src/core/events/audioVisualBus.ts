/**
 * High-performance audio visualizer bus.
 * Decouples 30-60Hz FFT audio events from React component re-renders.
 */

const bandsBuffer = new Float32Array(32);
type FftListener = (bands: Float32Array, rms: number) => void;
const listeners = new Set<FftListener>();

export function updateAudioVisualData(bands: number[], rms = 0) {
  const len = Math.min(bands.length, bandsBuffer.length);
  for (let i = 0; i < len; i++) {
    bandsBuffer[i] = bands[i];
  }
  for (const listener of listeners) {
    listener(bandsBuffer, rms);
  }
}

export function getAudioVisualBands(): Float32Array {
  return bandsBuffer;
}

export function subscribeAudioVisual(fn: FftListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
