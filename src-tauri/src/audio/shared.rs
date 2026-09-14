use parking_lot::Mutex;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

/// Circular mono sample buffer shared between the audio callback and FFT thread.
#[derive(Clone)]
pub struct SharedAudioState {
    inner: Arc<Inner>,
}

struct Inner {
    samples: Mutex<VecDeque<f32>>,
    sample_rate: AtomicU64,
    playing: AtomicBool,
    ended: AtomicBool,
    #[allow(dead_code)]
    position_secs: AtomicU64,
    duration_secs: AtomicU64,
    capacity: usize,
}

impl SharedAudioState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Inner {
                samples: Mutex::new(VecDeque::with_capacity(8192)),
                sample_rate: AtomicU64::new(44_100),
                playing: AtomicBool::new(false),
                ended: AtomicBool::new(false),
                position_secs: AtomicU64::new(0),
                duration_secs: AtomicU64::new(0),
                capacity: 8192,
            }),
        }
    }

    pub fn push_sample(&self, sample: f32) {
        let mut samples = self.inner.samples.lock();
        if samples.len() >= self.inner.capacity {
            samples.pop_front();
        }
        samples.push_back(sample);
    }

    #[allow(dead_code)]
    pub fn push_samples(&self, items: &[f32]) {
        let mut samples = self.inner.samples.lock();
        for &s in items {
            if samples.len() >= self.inner.capacity {
                samples.pop_front();
            }
            samples.push_back(s);
        }
    }

    /// Copy the most recent `n` mono samples (left channel interleaved source already mixed).
    pub fn latest_window(&self, n: usize) -> Vec<f32> {
        let samples = self.inner.samples.lock();
        let len = samples.len();
        if len == 0 {
            return vec![0.0; n];
        }
        let mut out = vec![0.0; n];
        if len >= n {
            let start = len - n;
            for (i, s) in samples.iter().skip(start).enumerate() {
                out[i] = *s;
            }
        } else {
            let offset = n - len;
            for (i, s) in samples.iter().enumerate() {
                out[offset + i] = *s;
            }
        }
        out
    }

    pub fn set_sample_rate(&self, rate: u32) {
        self.inner.sample_rate.store(rate as u64, Ordering::Relaxed);
    }

    pub fn sample_rate(&self) -> u32 {
        self.inner.sample_rate.load(Ordering::Relaxed) as u32
    }

    pub fn set_playing(&self, playing: bool) {
        self.inner.playing.store(playing, Ordering::Relaxed);
        if playing {
            self.inner.ended.store(false, Ordering::Relaxed);
        }
    }

    pub fn is_playing(&self) -> bool {
        self.inner.playing.load(Ordering::Relaxed)
    }

    /// Latch set once when the sink finishes a track; cleared on next play/load.
    pub fn take_ended(&self) -> bool {
        self.inner.ended.swap(false, Ordering::Relaxed)
    }

    pub fn mark_ended(&self) {
        self.inner.ended.store(true, Ordering::Relaxed);
        self.inner.playing.store(false, Ordering::Relaxed);
    }

    #[allow(dead_code)]
    pub fn set_position_secs(&self, secs: f64) {
        self.inner
            .position_secs
            .store(secs.max(0.0) as u64, Ordering::Relaxed);
    }

    #[allow(dead_code)]
    pub fn position_secs_f64(&self) -> f64 {
        // Store as whole seconds only for atomic simplicity; high-res progress is sent separately.
        self.inner.position_secs.load(Ordering::Relaxed) as f64
    }

    pub fn set_duration_secs(&self, secs: f64) {
        self.inner
            .duration_secs
            .store(secs.max(0.0) as u64, Ordering::Relaxed);
    }

    pub fn duration_secs(&self) -> f64 {
        self.inner.duration_secs.load(Ordering::Relaxed) as f64
    }

    pub fn clear(&self) {
        self.inner.samples.lock().clear();
    }
}

impl Default for SharedAudioState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct FftFrame {
    pub bands: Vec<f32>,
    pub rms: f32,
    pub sample_rate: u32,
}
