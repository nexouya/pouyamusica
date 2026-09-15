/**
 * Sound Lab Web Audio engine — buffer-based (no MediaElementSource).
 *
 * Pipeline:
 *   decodeAudioData(file) → AudioBufferSourceNode
 *     → [preset wet chain] → head-shadow LPF → HRTF panner → depth gain
 *     → limiter → analyser → destination
 *
 * Why buffer: WebView2 asset URLs + MediaElementSource are unreliable here.
 * decodeAudioData + BufferSource always runs DSP on real samples.
 */

import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { SoundLabPresetId } from "./types";

const RAMP = 0.2;

type Chain = {
  ctx: AudioContext;
  input: GainNode;
  presetIn: AudioNode;
  presetOut: AudioNode;
  /** 10-band graphic EQ always present (gains in dB). */
  eqBands: BiquadFilterNode[];
  eqIn: GainNode;
  eqOut: GainNode;
  shadowLp: BiquadFilterNode;
  panner: PannerNode;
  pannerGain: GainNode;
  limiter: DynamicsCompressorNode;
  analyser: AnalyserNode;
  master: GainNode;
  buffer: AudioBuffer | null;
  bufferPath: string | null;
  source: AudioBufferSourceNode | null;
  startedAt: number;
  offset: number;
  playing: boolean;
  baseRate: number;
  wowTimer: number | null;
  orbitRaf: number | null;
  vinyl: AudioBufferSourceNode | null;
  workletNode: AudioWorkletNode | null;
  theta: number;
  orbitPeriod: number;
  spatial: boolean;
  preset: SoundLabPresetId;
  onEnded: (() => void) | null;
  onProgress: ((pos: number, dur: number, playing: boolean) => void) | null;
  progressTimer: number | null;
};

/** Classic 10-band graphic EQ center frequencies. */
export const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

/** Refuse decoding multi-hour files into a single AudioBuffer (OOM). */
const MAX_WEB_DURATION_SEC = 45 * 60;
const MAX_WEB_BYTES = 80 * 1024 * 1024;

let chain: Chain | null = null;

function softSaturationCurve(amount = 0.35): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = amount * 40;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function makeHallIr(ctx: AudioContext, seconds = 2.4): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, 2.4) * (1 - Math.exp(-i / (rate * 0.02)));
      const white = Math.random() * 2 - 1;
      lp = lp * 0.72 + white * 0.28;
      data[i] = lp * env * 0.55;
    }
  }
  return buf;
}

function makeVinylNoise(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * 2);
  const buf = ctx.createBuffer(1, len, rate);
  const data = buf.getChannelData(0);
  let dust = 0;
  for (let i = 0; i < len; i++) {
    let s = (Math.random() * 2 - 1) * 0.04;
    if (Math.random() < 0.0004) dust = 1;
    dust *= 0.96;
    s += dust * (Math.random() * 2 - 1) * 0.35;
    data[i] = s;
  }
  return buf;
}

const BITCRUSH_WORKLET = `
class BitCrushProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 8, minValue: 2, maxValue: 16 },
      { name: 'reduction', defaultValue: 4, minValue: 1, maxValue: 32 }
    ];
  }
  constructor() {
    super();
    this.hold = [0, 0];
    this.step = 0;
  }
  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length) return true;
    const bits = params.bits;
    const reduction = params.reduction;
    for (let ch = 0; ch < output.length; ch++) {
      const inp = input[ch] || input[0];
      const out = output[ch];
      for (let i = 0; i < out.length; i++) {
        const red = reduction.length > 1 ? reduction[i] : reduction[0];
        const b = bits.length > 1 ? bits[i] : bits[0];
        this.step++;
        if (this.step % Math.max(1, Math.floor(red)) === 0) {
          this.hold[ch] = inp[i] || 0;
        }
        const step = Math.pow(2, b);
        out[i] = Math.round((this.hold[ch] || 0) * step) / step;
      }
    }
    return true;
  }
}
registerProcessor('bitcrush', BitCrushProcessor);
`;

async function ensureWorklet(ctx: AudioContext) {
  const key = "sl-bitcrush";
  const any = ctx.audioWorklet as AudioWorklet & { __sl?: string };
  if (any.__sl === key) return;
  const blob = new Blob([BITCRUSH_WORKLET], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  try {
    await ctx.audioWorklet.addModule(url);
    any.__sl = key;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function peaking(ctx: AudioContext, freq: number, gain: number, q = 0.9) {
  const f = ctx.createBiquadFilter();
  f.type = "peaking";
  f.frequency.value = freq;
  f.gain.value = gain;
  f.Q.value = q;
  return f;
}

function lowpass(ctx: AudioContext, freq: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function highshelf(ctx: AudioContext, freq: number, gain: number) {
  const f = ctx.createBiquadFilter();
  f.type = "highshelf";
  f.frequency.value = freq;
  f.gain.value = gain;
  return f;
}

function highpass(ctx: AudioContext, freq: number) {
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = freq;
  return f;
}

function chainNodes(nodes: AudioNode[]) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return { in: nodes[0], out: nodes[nodes.length - 1] };
}

function stopWow(c: Chain) {
  if (c.wowTimer != null) {
    window.clearInterval(c.wowTimer);
    c.wowTimer = null;
  }
}

function stopOrbit(c: Chain) {
  if (c.orbitRaf != null) {
    cancelAnimationFrame(c.orbitRaf);
    c.orbitRaf = null;
  }
}

function stopProgress(c: Chain) {
  if (c.progressTimer != null) {
    window.clearInterval(c.progressTimer);
    c.progressTimer = null;
  }
}

function currentPosition(c: Chain): number {
  if (!c.buffer) return c.offset;
  if (!c.playing || c.source == null) return c.offset;
  const elapsed = (c.ctx.currentTime - c.startedAt) * c.baseRate;
  return Math.min(c.buffer.duration, c.offset + elapsed);
}

function startProgress(c: Chain) {
  stopProgress(c);
  c.progressTimer = window.setInterval(() => {
    c.onProgress?.(currentPosition(c), c.buffer?.duration ?? 0, c.playing);
  }, 120);
}

function applyRate(c: Chain, rate: number) {
  c.baseRate = rate;
  if (c.source) {
    try {
      c.source.playbackRate.setValueAtTime(rate, c.ctx.currentTime);
    } catch {
      c.source.playbackRate.value = rate;
    }
  }
}

function startWow(c: Chain) {
  stopWow(c);
  let phase = 0;
  c.wowTimer = window.setInterval(() => {
    if (!c.playing || !c.source) return;
    phase += 0.5 * 0.05;
    const detune = 1 + Math.sin(phase * Math.PI * 2) * 0.004;
    try {
      c.source.playbackRate.setTargetAtTime(
        c.baseRate * detune,
        c.ctx.currentTime,
        0.02,
      );
    } catch {
      /* ignore */
    }
  }, 50);
}

function startOrbit(c: Chain) {
  stopOrbit(c);
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    c.theta += ((Math.PI * 2) / c.orbitPeriod) * dt;
    const r = 1.4;
    const x = r * Math.cos(c.theta);
    const z = r * Math.sin(c.theta);
    const t = c.ctx.currentTime;
    const tau = 0.04;
    c.panner.positionX.setTargetAtTime(x, t, tau);
    c.panner.positionZ.setTargetAtTime(z, t, tau);
    c.panner.positionY.setTargetAtTime(0, t, tau);
    const behind = Math.max(0, -z) / r;
    c.shadowLp.frequency.setTargetAtTime(18000 - behind * 11000, t, tau);
    const g = Math.pow(10, (-2 * behind) / 20);
    c.pannerGain.gain.setTargetAtTime(g, t, tau);
    c.orbitRaf = requestAnimationFrame(tick);
  };
  c.orbitRaf = requestAnimationFrame(tick);
}

async function buildPreset(
  ctx: AudioContext,
  id: Exclude<SoundLabPresetId, "off">,
  c: Chain,
): Promise<{ in: AudioNode; out: AudioNode }> {
  const t = ctx.currentTime;
  switch (id) {
    case "funk": {
      const shaper = ctx.createWaveShaper();
      shaper.curve = softSaturationCurve(0.35);
      shaper.oversample = "2x";
      const bass = peaking(ctx, 120, 4, 1.1);
      const air = highshelf(ctx, 10000, -6);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 3;
      comp.attack.value = 0.01;
      comp.release.value = 0.18;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(1, t + RAMP);
      const r = chainNodes([shaper, bass, air, comp]);
      r.out.connect(g);
      return { in: r.in, out: g };
    }
    case "lofi": {
      const hp = highpass(ctx, 40);
      const lp = lowpass(ctx, 5000, 0.8);
      await ensureWorklet(ctx);
      let crushOut: AudioNode = lp;
      try {
        const w = new AudioWorkletNode(ctx, "bitcrush", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        });
        w.parameters.get("bits")!.value = 8;
        w.parameters.get("reduction")!.value = 4;
        lp.connect(w);
        crushOut = w;
        c.workletNode = w;
      } catch {
        /* LPF only */
      }
      const sum = ctx.createGain();
      crushOut.connect(sum);
      const noise = ctx.createBufferSource();
      noise.buffer = makeVinylNoise(ctx);
      noise.loop = true;
      const nG = ctx.createGain();
      nG.gain.setValueAtTime(0.0001, t);
      nG.gain.linearRampToValueAtTime(0.05, t + RAMP);
      noise.connect(nG);
      nG.connect(sum);
      noise.start();
      c.vinyl = noise;
      hp.connect(lp);
      return { in: hp, out: sum };
    }
    case "bass": {
      const boost = peaking(ctx, 80, 9, 0.9);
      const boost2 = peaking(ctx, 55, 3, 1.2);
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -6;
      lim.knee.value = 2;
      lim.ratio.value = 12;
      lim.attack.value = 0.003;
      lim.release.value = 0.12;
      return chainNodes([boost, boost2, lim]);
    }
    case "nightcore":
      return chainNodes([ctx.createGain()]);
    case "slowed": {
      const dry = ctx.createGain();
      dry.gain.value = 0.75;
      const wet = ctx.createGain();
      wet.gain.setValueAtTime(0.0001, t);
      wet.gain.linearRampToValueAtTime(0.25, t + RAMP);
      const conv = ctx.createConvolver();
      conv.buffer = makeHallIr(ctx, 2.4);
      const sum = ctx.createGain();
      dry.connect(sum);
      conv.connect(wet);
      wet.connect(sum);
      const split = ctx.createGain();
      split.connect(dry);
      split.connect(conv);
      return { in: split, out: sum };
    }
    case "vocal": {
      const presence = peaking(ctx, 2200, 5, 1.0);
      const mud = peaking(ctx, 180, -4, 0.9);
      const hp = highpass(ctx, 90);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -28;
      comp.knee.value = 16;
      comp.ratio.value = 4;
      comp.attack.value = 0.008;
      comp.release.value = 0.2;
      return chainNodes([hp, mud, presence, comp]);
    }
    case "hall": {
      const dry = ctx.createGain();
      dry.gain.value = 0.72;
      const wet = ctx.createGain();
      wet.gain.setValueAtTime(0.0001, t);
      wet.gain.linearRampToValueAtTime(0.28, t + RAMP);
      const conv = ctx.createConvolver();
      conv.buffer = makeHallIr(ctx, 2.8);
      const sum = ctx.createGain();
      dry.connect(sum);
      conv.connect(wet);
      wet.connect(sum);
      const split = ctx.createGain();
      split.connect(dry);
      split.connect(conv);
      return { in: split, out: sum };
    }
    case "night": {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -36;
      comp.knee.value = 20;
      comp.ratio.value = 8;
      comp.attack.value = 0.01;
      comp.release.value = 0.25;
      const makeup = ctx.createGain();
      makeup.gain.value = 1.35;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -3;
      lim.knee.value = 0;
      lim.ratio.value = 20;
      lim.attack.value = 0.002;
      lim.release.value = 0.08;
      return chainNodes([comp, makeup, lim]);
    }
  }
}

function ensureCtx(): Chain {
  if (chain) return chain;
  const ctx = new AudioContext({ latencyHint: "interactive" });
  const input = ctx.createGain();
  input.gain.value = 1;
  const unity = ctx.createGain();
  // 10-band EQ: input → eqIn → [peaking…] → eqOut
  const eqIn = ctx.createGain();
  eqIn.gain.value = 1;
  const eqOut = ctx.createGain();
  eqOut.gain.value = 1;
  const eqBands: BiquadFilterNode[] = EQ_FREQS.map((freq, i) => {
    const f = ctx.createBiquadFilter();
    f.type = "peaking";
    f.frequency.value = freq;
    f.Q.value = 1.0;
    f.gain.value = 0;
    if (i === 0) f.type = "lowshelf";
    if (i === EQ_FREQS.length - 1) f.type = "highshelf";
    return f;
  });
  for (let i = 0; i < eqBands.length - 1; i++) eqBands[i].connect(eqBands[i + 1]);
  eqIn.connect(eqBands[0]);
  eqBands[eqBands.length - 1].connect(eqOut);

  const shadowLp = ctx.createBiquadFilter();
  shadowLp.type = "lowpass";
  shadowLp.frequency.value = 18000;
  const panner = ctx.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 1;
  panner.maxDistance = 10000;
  panner.rolloffFactor = 1;
  panner.coneInnerAngle = 360;
  panner.positionX.value = 0;
  panner.positionY.value = 0;
  panner.positionZ.value = 1;
  const pannerGain = ctx.createGain();
  pannerGain.gain.value = 1;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.08;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.75;
  const master = ctx.createGain();
  master.gain.value = 1;

  // preset wet path is patched into eqIn; EQ always runs after preset
  input.connect(unity);
  unity.connect(eqIn);
  eqOut.connect(shadowLp);
  shadowLp.connect(panner);
  panner.connect(pannerGain);
  pannerGain.connect(limiter);
  limiter.connect(analyser);
  analyser.connect(master);
  master.connect(ctx.destination);

  chain = {
    ctx,
    input,
    presetIn: unity,
    presetOut: unity,
    eqBands,
    eqIn,
    eqOut,
    shadowLp,
    panner,
    pannerGain,
    limiter,
    analyser,
    master,
    buffer: null,
    bufferPath: null,
    source: null,
    startedAt: 0,
    offset: 0,
    playing: false,
    baseRate: 1,
    wowTimer: null,
    orbitRaf: null,
    vinyl: null,
    workletNode: null,
    theta: 0,
    orbitPeriod: 10,
    spatial: false,
    preset: "off",
    onEnded: null,
    onProgress: null,
    progressTimer: null,
  };
  return chain;
}

async function rebuildPreset(c: Chain, id: SoundLabPresetId) {
  stopWow(c);
  if (c.vinyl) {
    try {
      c.vinyl.stop();
    } catch {
      /* ignore */
    }
    c.vinyl.disconnect();
    c.vinyl = null;
  }
  c.workletNode = null;
  // Disconnect input from old wet chain; keep EQ + shadowLp onward
  try {
    c.input.disconnect();
  } catch {
    /* ignore */
  }
  try {
    c.presetOut.disconnect();
  } catch {
    /* ignore */
  }

  if (id === "off") {
    const g = c.ctx.createGain();
    g.gain.value = 1;
    c.presetIn = g;
    c.presetOut = g;
    c.input.connect(g);
    g.connect(c.eqIn);
    applyRate(c, 1);
  } else {
    const built = await buildPreset(c.ctx, id as Exclude<SoundLabPresetId, "off">, c);
    c.presetIn = built.in;
    c.presetOut = built.out;
    c.input.connect(built.in);
    built.out.connect(c.eqIn);
    if (id === "nightcore") applyRate(c, 1.2);
    else if (id === "slowed") applyRate(c, 0.8);
    else if (id === "lofi") {
      applyRate(c, 1);
      startWow(c);
    } else applyRate(c, 1);
  }
  c.preset = id;
}

function stopSource(c: Chain, keepOffset: boolean) {
  if (c.source) {
    try {
      c.source.onended = null;
      c.source.stop();
    } catch {
      /* ignore */
    }
    try {
      c.source.disconnect();
    } catch {
      /* ignore */
    }
    c.source = null;
  }
  if (keepOffset) c.offset = currentPosition(c);
  c.playing = false;
}

function startSource(c: Chain, offset: number) {
  if (!c.buffer) throw new Error("no decoded buffer");
  stopSource(c, false);
  const src = c.ctx.createBufferSource();
  src.buffer = c.buffer;
  src.playbackRate.value = c.baseRate;
  src.connect(c.input);
  src.onended = () => {
    // Natural end only (not manual stop)
    if (c.source === src && c.playing) {
      c.playing = false;
      c.offset = c.buffer?.duration ?? 0;
      stopProgress(c);
      c.onProgress?.(c.offset, c.buffer?.duration ?? 0, false);
      c.onEnded?.();
    }
  };
  const off = Math.min(Math.max(0, offset), Math.max(0, c.buffer.duration - 0.05));
  src.start(0, off);
  c.source = src;
  c.offset = off;
  c.startedAt = c.ctx.currentTime;
  c.playing = true;
  startProgress(c);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function fetchArrayBuffer(path: string): Promise<ArrayBuffer> {
  // 1) asset protocol via fetch
  try {
    const url = convertFileSrc(path);
    const res = await fetch(url);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 0) return buf;
    }
  } catch (e) {
    console.warn("[SoundLab] convertFileSrc fetch failed", e);
  }
  // 2) IPC base64
  const b64 = await invoke<string>("read_audio_b64", { path });
  return base64ToArrayBuffer(b64);
}

export async function initEngine(): Promise<void> {
  const c = ensureCtx();
  if (c.ctx.state === "suspended") await c.ctx.resume();
}

export async function loadTrack(path: string): Promise<number> {
  const c = ensureCtx();
  if (c.ctx.state === "suspended") await c.ctx.resume();

  // Reuse already-decoded buffer when switching tools on the same track (8D / preset).
  if (c.buffer && c.bufferPath === path && c.buffer.duration > 0) {
    return c.buffer.duration;
  }

  stopSource(c, false);
  c.offset = 0;
  const raw = await fetchArrayBuffer(path);
  if (raw.byteLength > MAX_WEB_BYTES) {
    throw new Error(
      `File too large for Sound Lab DSP (${Math.round(raw.byteLength / 1024 / 1024)} MB). Native playback still works.`,
    );
  }
  const buffer = await c.ctx.decodeAudioData(raw.slice(0));
  if (buffer.duration > MAX_WEB_DURATION_SEC) {
    throw new Error(
      `Track is ${Math.round(buffer.duration / 60)} min — Sound Lab buffers only up to 45 min. Native playback still works.`,
    );
  }
  c.buffer = buffer;
  c.bufferPath = path;
  return buffer.duration;
}

/** Apply 10-band EQ gains in dB (length 10). */
export function setEqGains(gainsDb: number[]): void {
  const c = ensureCtx();
  const t = c.ctx.currentTime;
  for (let i = 0; i < c.eqBands.length; i++) {
    const g = Math.max(-12, Math.min(12, gainsDb[i] ?? 0));
    try {
      c.eqBands[i].gain.setTargetAtTime(g, t, 0.03);
    } catch {
      c.eqBands[i].gain.value = g;
    }
  }
}

export function getEqGains(): number[] {
  if (!chain) return new Array(10).fill(0);
  return chain.eqBands.map((f) => f.gain.value);
}

export function hasBuffer(path?: string): boolean {
  if (!chain?.buffer) return false;
  if (path) return chain.bufferPath === path;
  return true;
}

export async function applyPreset(id: SoundLabPresetId): Promise<void> {
  const c = ensureCtx();
  if (c.ctx.state === "suspended") await c.ctx.resume();
  await rebuildPreset(c, id);
}

export async function setSpatial(enabled: boolean, orbitPeriod: number): Promise<void> {
  const c = ensureCtx();
  c.orbitPeriod = Math.min(14, Math.max(8, orbitPeriod));
  const was = c.spatial;
  c.spatial = enabled;
  if (enabled) {
    if (c.ctx.state === "suspended") await c.ctx.resume();
    // If we already have audio and were playing, keep it running while orbit starts.
    startOrbit(c);
    if (was !== enabled) {
      // Nudge orbit so 8D is immediately audible after a switch.
      c.theta = c.theta || 0;
    }
  } else {
    stopOrbit(c);
    const t = c.ctx.currentTime;
    c.panner.positionX.setTargetAtTime(0, t, 0.08);
    c.panner.positionY.setTargetAtTime(0, t, 0.08);
    c.panner.positionZ.setTargetAtTime(1, t, 0.08);
    c.shadowLp.frequency.setTargetAtTime(18000, t, 0.08);
    c.pannerGain.gain.setTargetAtTime(1, t, 0.08);
  }
}

export function setOrbitPeriod(period: number) {
  if (!chain) return;
  chain.orbitPeriod = Math.min(14, Math.max(8, period));
}

export function setVolume(level: number) {
  if (!chain) return;
  chain.master.gain.setTargetAtTime(
    Math.min(1, Math.max(0, level)),
    chain.ctx.currentTime,
    0.03,
  );
}

export async function play(from?: number): Promise<void> {
  const c = ensureCtx();
  if (c.ctx.state === "suspended") await c.ctx.resume();
  if (!c.buffer) throw new Error("no track loaded");
  const off = from != null ? from : c.offset;
  startSource(c, off);
}

export function pause() {
  if (!chain) return;
  stopSource(chain, true);
  stopProgress(chain);
  chain.onProgress?.(currentPosition(chain), chain.buffer?.duration ?? 0, false);
}

export function seek(secs: number) {
  if (!chain?.buffer) return;
  const wasPlaying = chain.playing;
  const pos = Math.min(Math.max(0, secs), chain.buffer.duration);
  chain.offset = pos;
  if (wasPlaying) {
    startSource(chain, pos);
  } else {
    chain.onProgress?.(pos, chain.buffer.duration, false);
  }
}

export function getPosition(): number {
  return chain ? currentPosition(chain) : 0;
}

export function getDuration(): number {
  return chain?.buffer?.duration ?? 0;
}

export function isPlaying(): boolean {
  return !!chain?.playing;
}

export function getSpectrum(): number[] {
  if (!chain) return new Array(32).fill(0);
  const bins = new Uint8Array(chain.analyser.frequencyBinCount);
  chain.analyser.getByteFrequencyData(bins);
  const bands = new Array(32).fill(0);
  const n = bins.length;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(Math.pow(i / 32, 1.6) * n * 0.7);
    const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / 32, 1.6) * n * 0.7));
    let peak = 0;
    for (let j = a; j < b && j < n; j++) peak = Math.max(peak, bins[j]);
    bands[i] = peak / 255;
  }
  return bands;
}

export function setHandlers(
  onProgress: Chain["onProgress"],
  onEnded: Chain["onEnded"],
) {
  const c = ensureCtx();
  c.onProgress = onProgress;
  c.onEnded = onEnded;
}

export function getState() {
  if (!chain) return null;
  return {
    ctxState: chain.ctx.state,
    hasBuffer: !!chain.buffer,
    playing: chain.playing,
    preset: chain.preset,
    spatial: chain.spatial,
    rate: chain.baseRate,
  };
}
