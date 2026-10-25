import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAlarmSound } from './sound.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createAlarmSound', () => {
  it('returns false when the browser has no Web Audio API', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);

    const sound = createAlarmSound();
    expect(sound.unlock()).toBe(false);
    expect(sound.isUnlocked()).toBe(false);
  });

  it('unlocks audio, plays repeating beeps, and stops on request', () => {
    vi.useFakeTimers();
    const oscillators = [];
    const resume = vi.fn();
    class AudioContextMock {
      state = 'suspended';
      currentTime = 1;
      destination = {};

      resume = resume;
      createOscillator() {
        const oscillator = {
          frequency: { value: 0 },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        oscillators.push(oscillator);
        return oscillator;
      }
      createGain() {
        return {
          gain: {
            exponentialRampToValueAtTime: vi.fn(),
            setValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
    }
    vi.stubGlobal('AudioContext', AudioContextMock);

    const sound = createAlarmSound();
    expect(sound.unlock()).toBe(true);
    expect(sound.isUnlocked()).toBe(true);
    expect(resume).toHaveBeenCalledOnce();

    sound.start();
    sound.start();
    expect(oscillators).toHaveLength(2);
    vi.advanceTimersByTime(900);
    expect(oscillators).toHaveLength(4);
    expect(oscillators[0].frequency.value).toBe(880);

    sound.stop();
    vi.advanceTimersByTime(1800);
    expect(oscillators).toHaveLength(4);
  });

  it('uses the prefixed browser API and stops automatically after the maximum ring duration', () => {
    vi.useFakeTimers();
    const oscillators = [];
    class AudioContextMock {
      state = 'running';
      currentTime = 0;
      destination = {};

      createOscillator() {
        const oscillator = {
          frequency: { value: 0 },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        oscillators.push(oscillator);
        return oscillator;
      }
      createGain() {
        return {
          gain: {
            exponentialRampToValueAtTime: vi.fn(),
            setValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
    }
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', AudioContextMock);

    const sound = createAlarmSound();
    expect(sound.unlock()).toBe(true);
    sound.start();
    vi.advanceTimersByTime(60_000);
    const countWhenStopped = oscillators.length;
    vi.advanceTimersByTime(1800);
    expect(oscillators).toHaveLength(countWhenStopped);
  });

  it('returns false when creating the audio context fails', () => {
    class BrokenAudioContext {
      constructor() {
        throw new Error('Audio is unavailable');
      }
    }
    vi.stubGlobal('AudioContext', BrokenAudioContext);

    expect(createAlarmSound().unlock()).toBe(false);
  });
});
