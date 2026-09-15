/**
 * Thin façade over the buffer-based Sound Lab engine.
 * Keeps the same call surface the stores already use.
 */

import * as engine from "./engine";
import type { SoundLabPresetId } from "./types";

export function setWebPlaybackHandlers(
  p: ((position: number, duration: number, playing: boolean) => void) | null,
  e: (() => void) | null,
) {
  engine.setHandlers(p, e);
}

export function getLastError(): string | null {
  return null;
}

export async function ensureWebGraph(): Promise<void> {
  await engine.initEngine();
}

export async function loadWebTrack(path: string, startAt = 0): Promise<void> {
  await engine.loadTrack(path);
  if (startAt > 0) engine.seek(startAt);
}

export async function playWeb(): Promise<void> {
  await engine.play();
}

export function pauseWeb() {
  engine.pause();
}

export function seekWeb(secs: number) {
  engine.seek(secs);
}

export function setWebVolume(v: number) {
  engine.setVolume(v);
}

export function webPosition(): number {
  return engine.getPosition();
}

export function webDuration(): number {
  return engine.getDuration();
}

export function isWebPlaying(): boolean {
  return engine.isPlaying();
}

export function isWebReady(): boolean {
  return engine.getDuration() > 0;
}

export async function engageWebAudio(
  path: string,
  startAt: number,
  volume: number,
  preset: SoundLabPresetId,
  spatial: boolean,
  orbitPeriod: number,
  autoplay: boolean,
): Promise<void> {
  await engine.initEngine();
  await engine.applyPreset(preset);
  await engine.setSpatial(spatial, orbitPeriod);
  engine.setVolume(volume);
  await engine.loadTrack(path);
  if (startAt > 0) engine.seek(startAt);
  if (autoplay) await engine.play();
}

export async function updatePreset(preset: SoundLabPresetId) {
  await engine.initEngine();
  await engine.applyPreset(preset);
}

export async function updateSpatial(spatial: boolean, orbitPeriod: number) {
  await engine.initEngine();
  await engine.setSpatial(spatial, orbitPeriod);
}

export function liveSpectrum(): number[] {
  return engine.getSpectrum();
}

export function setEq(gainsDb: number[]) {
  engine.setEqGains(gainsDb);
}

export function getEq(): number[] {
  return engine.getEqGains();
}

export function disposeWebAudio() {
  engine.pause();
  // Keep AudioContext — can't reliably rebuild; just stop sources
}

export function engineDebug() {
  return engine.getState();
}
