use anyhow::{anyhow, Result};
use parking_lot::Mutex;
use rodio::{OutputStream, OutputStreamHandle, Sink, Source};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use super::analyzer::spawn_analyzer;
use super::decoder::{extract_peaks, open_source};
use super::shared::{FftFrame, SharedAudioState};

/// Commands accepted by the dedicated audio thread.
pub enum AudioCmd {
    /// Load a file. `ack` receives Ok(()) or Err(msg) when the worker finishes.
    Load {
        path: PathBuf,
        ack: Option<crossbeam_channel::Sender<std::result::Result<(), String>>>,
    },
    Play {
        ack: Option<crossbeam_channel::Sender<std::result::Result<(), String>>>,
    },
    Pause,
    Toggle {
        ack: Option<crossbeam_channel::Sender<std::result::Result<(), String>>>,
    },
    Stop,
    Seek {
        secs: f64,
        ack: Option<crossbeam_channel::Sender<std::result::Result<(), String>>>,
    },
    Volume(f32),
    #[allow(dead_code)]
    Shutdown,
}

/// Handle used by Tauri commands. Safe to share across threads.
#[derive(Clone)]
pub struct AudioEngine {
    tx: crossbeam_channel::Sender<AudioCmd>,
    state: SharedAudioState,
    current_path: Arc<Mutex<Option<PathBuf>>>,
    volume: Arc<Mutex<f32>>,
    position: Arc<Mutex<f64>>,
    playing: Arc<Mutex<bool>>,
    #[allow(dead_code)]
    device_ok: Arc<AtomicBool>,
}

struct EngineCore {
    _stream: OutputStream,
    handle: OutputStreamHandle,
    sink: Sink,
    path: Option<PathBuf>,
    volume: f32,
    started_at: Option<Instant>,
    seek_offset: f64,
    playing: bool,
}

impl EngineCore {
    fn new() -> Result<Self> {
        let (stream, handle) = OutputStream::try_default().map_err(|e| anyhow!("{e}"))?;
        let sink = Sink::try_new(&handle).map_err(|e| anyhow!("{e}"))?;
        Ok(Self {
            _stream: stream,
            handle,
            sink,
            path: None,
            volume: 0.8,
            started_at: None,
            seek_offset: 0.0,
            playing: false,
        })
    }

    fn position(&self) -> f64 {
        let base = self.seek_offset;
        if let Some(start) = self.started_at {
            base + start.elapsed().as_secs_f64()
        } else {
            base
        }
    }

    fn rebuild_from_with_state(
        &mut self,
        skip_secs: f64,
        autoplay: bool,
        state: &SharedAudioState,
    ) -> Result<()> {
        let path = self
            .path
            .clone()
            .ok_or_else(|| anyhow!("no track loaded"))?;
        let mut source = open_source(&path, state.clone())?;
        let skip = std::time::Duration::from_secs_f64(skip_secs.max(0.0));
        let new_sink = Sink::try_new(&self.handle).map_err(|e| anyhow!("{e}"))?;
        new_sink.set_volume(self.volume);
        // Prefer container seek (fast on long tracks). Fall back to skip-from-zero.
        if skip > std::time::Duration::ZERO {
            if source.try_seek(skip).is_ok() {
                new_sink.append(source);
            } else {
                let fallback = open_source(&path, state.clone())?.skip_duration(skip);
                new_sink.append(fallback);
            }
        } else {
            new_sink.append(source);
        }
        if autoplay {
            new_sink.play();
            self.playing = true;
            self.started_at = Some(Instant::now());
            state.set_playing(true);
        } else {
            new_sink.pause();
            self.playing = false;
            self.started_at = None;
            state.set_playing(false);
        }
        self.sink.stop();
        self.sink = new_sink;
        self.seek_offset = skip_secs.max(0.0);
        Ok(())
    }

    fn apply_pause(
        &mut self,
        state: &SharedAudioState,
        position: &Arc<Mutex<f64>>,
        playing: &Arc<Mutex<bool>>,
    ) {
        self.sink.pause();
        if let Some(start) = self.started_at.take() {
            self.seek_offset += start.elapsed().as_secs_f64();
        }
        self.playing = false;
        state.set_playing(false);
        *playing.lock() = false;
        *position.lock() = self.seek_offset;
    }

    fn apply_play(&mut self, state: &SharedAudioState, playing: &Arc<Mutex<bool>>) -> Result<()> {
        if self.sink.empty() && self.path.is_some() {
            self.rebuild_from_with_state(0.0, true, state)?;
            *playing.lock() = self.playing;
            return Ok(());
        }
        if self.sink.empty() {
            return Err(anyhow!("no track loaded"));
        }
        self.sink.play();
        self.playing = true;
        self.started_at = Some(Instant::now());
        state.set_playing(true);
        *playing.lock() = true;
        Ok(())
    }
}

fn send_ack(ack: Option<crossbeam_channel::Sender<std::result::Result<(), String>>>, r: std::result::Result<(), String>) {
    if let Some(ack) = ack {
        let _ = ack.send(r);
    }
}

impl AudioEngine {
    pub fn start() -> Result<Self> {
        let (tx, rx) = crossbeam_channel::unbounded::<AudioCmd>();
        let state = SharedAudioState::new();
        let current_path = Arc::new(Mutex::new(None));
        let volume = Arc::new(Mutex::new(0.8));
        let position = Arc::new(Mutex::new(0.0));
        let playing = Arc::new(Mutex::new(false));
        let device_ok = Arc::new(AtomicBool::new(false));

        let state_thread = state.clone();
        let path_thread = current_path.clone();
        let volume_thread = volume.clone();
        let position_thread = position.clone();
        let playing_thread = playing.clone();
        let device_thread = device_ok.clone();

        std::thread::Builder::new()
            .name("pouya-audio".into())
            .spawn(move || {
                // Stay alive even when no output device is available so the UI
                // process never dies; retry the device every few seconds.
                let mut core: Option<EngineCore> = match EngineCore::new() {
                    Ok(c) => {
                        device_thread.store(true, Ordering::SeqCst);
                        Some(c)
                    }
                    Err(e) => {
                        device_thread.store(false, Ordering::SeqCst);
                        eprintln!("audio device unavailable: {e:#}");
                        None
                    }
                };
                let mut last_device_retry = std::time::Instant::now();
                loop {
                    let cmd = match rx.recv_timeout(std::time::Duration::from_millis(40)) {
                        Ok(c) => c,
                        Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                            if let Some(active) = core.as_mut() {
                                if active.playing && active.sink.empty() {
                                    if let Some(start) = active.started_at.take() {
                                        active.seek_offset += start.elapsed().as_secs_f64();
                                    }
                                    active.playing = false;
                                    state_thread.mark_ended();
                                    *playing_thread.lock() = false;
                                    let dur = state_thread.duration_secs();
                                    *position_thread.lock() = dur;
                                } else if active.playing {
                                    *position_thread.lock() = active.position();
                                }
                            } else if last_device_retry.elapsed()
                                >= std::time::Duration::from_secs(3)
                            {
                                match EngineCore::new() {
                                    Ok(mut recovered) => {
                                        let vol = *volume_thread.lock();
                                        recovered.volume = vol;
                                        recovered.sink.set_volume(vol);
                                        // Reload the last track so play works after recovery.
                                        if let Some(path) = path_thread.lock().clone() {
                                            recovered.path = Some(path);
                                            let pos = *position_thread.lock();
                                            if let Err(e) = recovered
                                                .rebuild_from_with_state(pos, false, &state_thread)
                                            {
                                                eprintln!("device recovery reload failed: {e:#}");
                                            }
                                        }
                                        core = Some(recovered);
                                        device_thread.store(true, Ordering::SeqCst);
                                        eprintln!("audio device recovered");
                                    }
                                    Err(e) => {
                                        eprintln!("audio device still unavailable: {e:#}");
                                    }
                                }
                                last_device_retry = std::time::Instant::now();
                            }
                            continue;
                        }
                        Err(crossbeam_channel::RecvTimeoutError::Disconnected) => break,
                    };

                    let Some(core) = core.as_mut() else {
                        match cmd {
                            AudioCmd::Volume(v) => {
                                *volume_thread.lock() = v.clamp(0.0, 1.0);
                            }
                            AudioCmd::Load { ack, .. } => {
                                send_ack(ack, Err("audio device unavailable".into()));
                            }
                            AudioCmd::Play { ack } | AudioCmd::Toggle { ack } | AudioCmd::Seek { ack, .. } => {
                                send_ack(ack, Err("audio device unavailable".into()));
                            }
                            AudioCmd::Pause | AudioCmd::Stop => {}
                            AudioCmd::Shutdown => break,
                        }
                        continue;
                    };

                    match cmd {
                        AudioCmd::Load { path, ack } => {
                            core.path = Some(path.clone());
                            *path_thread.lock() = Some(path);
                            core.seek_offset = 0.0;
                            core.started_at = None;
                            core.playing = false;
                            state_thread.clear();
                            state_thread.set_playing(false);
                            let load_result = core
                                .rebuild_from_with_state(0.0, false, &state_thread)
                                .map_err(|e| e.to_string());
                            *position_thread.lock() = 0.0;
                            *playing_thread.lock() = false;
                            if let Err(ref e) = load_result {
                                eprintln!("load error: {e}");
                            }
                            send_ack(ack, load_result);
                        }
                        AudioCmd::Play { ack } => {
                            let r = core
                                .apply_play(&state_thread, &playing_thread)
                                .map_err(|e| e.to_string());
                            send_ack(ack, r);
                        }
                        AudioCmd::Pause => {
                            core.apply_pause(&state_thread, &position_thread, &playing_thread);
                        }
                        AudioCmd::Toggle { ack } => {
                            let r = if core.playing {
                                core.apply_pause(&state_thread, &position_thread, &playing_thread);
                                Ok(())
                            } else {
                                core.apply_play(&state_thread, &playing_thread)
                                    .map_err(|e| e.to_string())
                            };
                            send_ack(ack, r);
                        }
                        AudioCmd::Stop => {
                            core.sink.stop();
                            core.playing = false;
                            core.started_at = None;
                            core.seek_offset = 0.0;
                            state_thread.set_playing(false);
                            *playing_thread.lock() = false;
                            *position_thread.lock() = 0.0;
                        }
                        AudioCmd::Seek { secs, ack } => {
                            let autoplay = core.playing;
                            let dur = state_thread.duration_secs();
                            // Clamp so dragging past EOF does not immediately end the track.
                            let max = if dur > 0.5 { (dur - 0.05).max(0.0) } else { dur.max(0.0) };
                            let secs = if dur > 0.0 { secs.clamp(0.0, max) } else { secs.max(0.0) };
                            let r = core
                                .rebuild_from_with_state(secs, autoplay, &state_thread)
                                .map_err(|e| e.to_string());
                            if r.is_ok() {
                                *position_thread.lock() = secs;
                            }
                            send_ack(ack, r);
                        }
                        AudioCmd::Volume(v) => {
                            core.volume = v.clamp(0.0, 1.0);
                            core.sink.set_volume(core.volume);
                            *volume_thread.lock() = core.volume;
                        }
                        AudioCmd::Shutdown => break,
                    }

                    if core.playing {
                        *position_thread.lock() = core.position();
                    }
                }
            })
            .map_err(|e| anyhow!("spawn audio thread: {e}"))?;

        Ok(Self {
            tx,
            state,
            current_path,
            volume,
            position,
            playing,
            device_ok,
        })
    }

    #[allow(dead_code)]
    pub fn shared_state(&self) -> SharedAudioState {
        self.state.clone()
    }

    pub fn spawn_fft(&self, emit: impl Fn(FftFrame) + Send + 'static) {
        spawn_analyzer(self.state.clone(), emit);
    }

    fn send(&self, cmd: AudioCmd) -> Result<()> {
        self.tx
            .send(cmd)
            .map_err(|_| anyhow!("audio thread unavailable"))
    }

    fn wait_ack(
        &self,
        ack_rx: crossbeam_channel::Receiver<std::result::Result<(), String>>,
    ) -> Result<()> {
        match ack_rx.recv_timeout(std::time::Duration::from_secs(8)) {
            Ok(Ok(())) => Ok(()),
            Ok(Err(msg)) => Err(anyhow!(msg)),
            Err(_) => Err(anyhow!("timed out waiting for audio engine")),
        }
    }

    pub fn load_track(&self, path: &str) -> Result<()> {
        let p = PathBuf::from(path);
        if !p.exists() {
            return Err(anyhow!("file not found: {}", p.display()));
        }
        *self.current_path.lock() = Some(p.clone());
        let (ack_tx, ack_rx) = crossbeam_channel::bounded(1);
        self.send(AudioCmd::Load {
            path: p,
            ack: Some(ack_tx),
        })?;
        self.wait_ack(ack_rx)
    }

    pub fn play(&self) -> Result<()> {
        let (ack_tx, ack_rx) = crossbeam_channel::bounded(1);
        self.send(AudioCmd::Play { ack: Some(ack_tx) })?;
        self.wait_ack(ack_rx)
    }

    pub fn pause(&self) -> Result<()> {
        self.send(AudioCmd::Pause)
    }

    pub fn toggle(&self) -> Result<()> {
        let (ack_tx, ack_rx) = crossbeam_channel::bounded(1);
        self.send(AudioCmd::Toggle { ack: Some(ack_tx) })?;
        self.wait_ack(ack_rx)
    }

    #[allow(dead_code)]
    pub fn stop(&self) -> Result<()> {
        self.send(AudioCmd::Stop)
    }

    pub fn set_volume(&self, level: f32) -> Result<()> {
        let v = level.clamp(0.0, 1.0);
        *self.volume.lock() = v;
        self.send(AudioCmd::Volume(v))
    }

    #[allow(dead_code)]
    pub fn volume(&self) -> f32 {
        *self.volume.lock()
    }

    pub fn is_playing(&self) -> bool {
        *self.playing.lock()
    }

    /// True once when a track finishes naturally; subsequent calls return false.
    pub fn take_ended(&self) -> bool {
        self.state.take_ended()
    }

    pub fn position_secs(&self) -> f64 {
        *self.position.lock()
    }

    pub fn duration_secs(&self) -> f64 {
        self.state.duration_secs()
    }

    pub fn seek(&self, position_secs: f64) -> Result<()> {
        let (ack_tx, ack_rx) = crossbeam_channel::bounded(1);
        self.send(AudioCmd::Seek {
            secs: position_secs.max(0.0),
            ack: Some(ack_tx),
        })?;
        self.wait_ack(ack_rx)
    }

    pub fn current_path(&self) -> Option<PathBuf> {
        self.current_path.lock().clone()
    }

    pub fn peaks(&self, path: &str, buckets: usize) -> Result<Vec<f32>> {
        extract_peaks(Path::new(path), buckets)
    }

    #[allow(dead_code)]
    pub fn device_available(&self) -> bool {
        self.device_ok.load(Ordering::SeqCst)
    }
}
