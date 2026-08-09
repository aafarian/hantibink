jest.mock('expo-av', () => ({ Audio: {} }));

import { downsampleWaveform } from '../AudioRecorder';

describe('downsampleWaveform', () => {
  it('returns a minimal flat waveform for empty data', () => {
    const result = downsampleWaveform([], 40);
    expect(result).toHaveLength(40);
    expect(result.every(v => v === 0.1)).toBe(true);
  });

  it('stretches sparse samples across the full bar count (no flat tail)', () => {
    // 4 samples across 8 bars: each sample owns 2 bars, preserving the
    // time axis. The old padding put [1,2,3,4,4,4,4,4] — the real audio
    // squeezed left with a false flatline over the second half.
    const result = downsampleWaveform([1, 2, 3, 4], 8);
    expect(result).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('a loud ending stays at the end when samples are sparse', () => {
    // Speaking through to the end of the message must render bars at the
    // end of the waveform, not midway
    const quietThenLoud = [0.1, 0.1, 0.1, 0.9];
    const result = downsampleWaveform(quietThenLoud, 8);
    expect(result[6]).toBe(0.9);
    expect(result[7]).toBe(0.9);
    expect(result.slice(0, 6).every(v => v === 0.1)).toBe(true);
  });

  it('keeps exact data when sample count matches bar count', () => {
    const data = Array.from({ length: 40 }, (_, i) => i / 40);
    expect(downsampleWaveform(data, 40)).toEqual(data);
  });

  it('downsamples dense data by per-chunk max, preserving peaks in place', () => {
    // 80 samples into 8 bars: each bar is the max of its 10-sample chunk
    const data = Array(80).fill(0.05);
    data[5] = 0.8; // chunk 0
    data[74] = 0.9; // chunk 7
    const result = downsampleWaveform(data, 8);
    expect(result).toHaveLength(8);
    expect(result[0]).toBe(0.8);
    expect(result[7]).toBe(0.9);
    expect(result.slice(1, 7).every(v => v === 0.05)).toBe(true);
  });
});
