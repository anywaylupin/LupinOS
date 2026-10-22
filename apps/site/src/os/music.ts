// The music player behind the Music app, the music widget and the volume slider. The tracks are
// placeholders played live by a tiny Web Audio synth, so there are no audio files to ship.
// Nothing makes a sound until someone presses play.
import { useSyncExternalStore } from "react";

type Track = { title: string; artist: string; bpm: number; root: number; scale: number[]; wave: OscillatorType; seconds: number };

export const TRACKS: Track[] = [
  { title: "track-01.mp3", artist: "Hive Corporation", bpm: 92, root: 57, scale: [0, 3, 5, 7, 10], wave: "triangle", seconds: 96 },
  { title: "track-02.mp3", artist: "Night Shift Choir", bpm: 112, root: 60, scale: [0, 2, 3, 7, 9], wave: "sawtooth", seconds: 88 },
  { title: "track-03.mp3", artist: "Sector 7 Radio", bpm: 78, root: 53, scale: [0, 2, 4, 7, 11], wave: "sine", seconds: 104 },
  { title: "track-04.mp3", artist: "Compliance Beats", bpm: 128, root: 62, scale: [0, 3, 5, 6, 10], wave: "square", seconds: 80 },
];

type State = { playing: boolean; index: number; elapsed: number; volume: number };
let state: State = { playing: false, index: 0, elapsed: 0, volume: 0.6 };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => {
  state = { ...state, ...p };
  for (const s of subs) s();
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let noise: AudioBuffer | null = null;
let timer = 0;
let step = 0;
let nextAt = 0;
let startedAt = 0;

function audio() {
  if (ctx) return ctx;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = state.volume * 0.5;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  master.connect(analyser).connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function note(at: number, midi: number, len: number, wave: OscillatorType, level: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = wave;
  o.frequency.value = freq(midi);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(level, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + len + 0.05);
}

function hat(at: number) {
  if (!ctx || !master || !noise) return;
  const src = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = noise;
  hp.type = "highpass";
  hp.frequency.value = 7000;
  g.gain.setValueAtTime(0.12, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  src.connect(hp).connect(g).connect(master);
  src.start(at);
  src.stop(at + 0.06);
}

/** Schedules a little ahead of the clock, a step at a time, so timing stays tight. */
function schedule() {
  if (!ctx) return;
  const t = TRACKS[state.index];
  const sixteenth = 60 / t.bpm / 4;
  while (nextAt < ctx.currentTime + 0.12) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = [0, 3, 4, 2][bar % 4];
    if (s % 4 === 0) note(nextAt, t.root - 24 + t.scale[chord % t.scale.length], sixteenth * 3.5, "sine", 0.35);
    if (s % 2 === 0) {
      const k = (s / 2 + chord + bar) % t.scale.length;
      note(nextAt, t.root + t.scale[k] + (s % 8 === 6 ? 12 : 0), sixteenth * 1.8, t.wave, t.wave === "sine" ? 0.16 : 0.06);
    }
    if (s % 4 === 2) hat(nextAt);
    nextAt += sixteenth;
    step++;
  }
  const elapsed = ctx.currentTime - startedAt;
  if (elapsed >= t.seconds) return next();
  if (Math.floor(elapsed) !== Math.floor(state.elapsed)) set({ elapsed });
}

export function play() {
  const c = audio();
  void c.resume();
  if (state.playing) return;
  startedAt = c.currentTime - state.elapsed;
  nextAt = c.currentTime + 0.05;
  timer = window.setInterval(schedule, 25);
  set({ playing: true });
}

export function pause() {
  clearInterval(timer);
  set({ playing: false });
}

export const toggle = () => (state.playing ? pause() : play());

/** Stops and rewinds to the first track: closing the Music app ends its session. */
export function stop() {
  pause();
  step = 0;
  set({ index: 0, elapsed: 0 });
}

function jump(index: number) {
  const was = state.playing;
  pause();
  step = 0;
  set({ index: (index + TRACKS.length) % TRACKS.length, elapsed: 0 });
  if (was) play();
}
export const next = () => jump(state.index + 1);
export const prev = () => jump(state.elapsed > 3 ? state.index : state.index - 1);
export const pick = (index: number) => {
  jump(index);
  play();
};

export function setVolume(volume: number) {
  if (master && ctx) master.gain.setTargetAtTime(volume * 0.5, ctx.currentTime, 0.05);
  set({ volume });
}

/** Loudness per frequency band, 0 to 1, for visualisers. Silent bars while paused. */
export function levels(bands: number): number[] {
  if (!analyser || !state.playing) return Array(bands).fill(0);
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  return Array.from({ length: bands }, (_, i) => data[Math.floor((i / bands) * data.length * 0.8)] / 255);
}

export function useMusic() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
  );
}
