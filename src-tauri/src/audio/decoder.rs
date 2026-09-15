use anyhow::{anyhow, Context, Result};
use rodio::{Decoder, Source};
use std::fs::File;
use std::path::Path;
use std::time::Duration;

use super::shared::SharedAudioState;

/// Decodes a local audio file into a rodio source that also taps samples for FFT.
pub fn open_source(
    path: &Path,
    state: SharedAudioState,
) -> Result<impl Source<Item = i16> + Send + 'static> {
    let file = File::open(path)
        .with_context(|| format!("cannot open audio file {}", path.display()))?;
    let decoder = Decoder::new(std::io::BufReader::new(file))
        .map_err(|e| anyhow!("decode failed for {}: {e}", path.display()))?;

    let sample_rate = decoder.sample_rate();
    let channels = decoder.channels();
    let duration = decoder
        .total_duration()
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    state.set_sample_rate(sample_rate);
    state.set_duration_secs(duration);

    Ok(SampleTap {
        inner: decoder,
        state,
        channels: channels.max(1) as usize,
        frame: Vec::new(),
    })
}

/// Mixes down to mono into shared state while passing samples through unchanged.
struct SampleTap<S> {
    inner: S,
    state: SharedAudioState,
    channels: usize,
    frame: Vec<i16>,
}

impl<S> Iterator for SampleTap<S>
where
    S: Iterator<Item = i16>,
{
    type Item = i16;

    fn next(&mut self) -> Option<i16> {
        let sample = self.inner.next()?;
        self.frame.push(sample);
        if self.frame.len() >= self.channels {
            let sum: f32 = self.frame.iter().map(|s| *s as f32).sum();
            let mono = sum / self.frame.len() as f32 / 32768.0;
            self.state.push_sample(mono.clamp(-1.0, 1.0));
            self.frame.clear();
        }
        Some(sample)
    }
}

impl<S> Source for SampleTap<S>
where
    S: Source<Item = i16>,
{
    fn current_frame_len(&self) -> Option<usize> {
        self.inner.current_frame_len()
    }

    fn channels(&self) -> u16 {
        self.inner.channels()
    }

    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }
}

/// Extract waveform peaks for the seek bar (normalized 0..1).
pub fn extract_peaks(path: &Path, buckets: usize) -> Result<Vec<f32>> {
    let file = File::open(path)?;
    let decoder = Decoder::new(std::io::BufReader::new(file))?;
    let channels = decoder.channels().max(1) as usize;
    let b = buckets.max(1);

    // Stream samples in chunks without accumulating massive memory in RAM
    let mut intermediate = Vec::new();
    let mut cur_max = 0.0f32;
    let mut count = 0usize;
    let chunk_size = 2048 * channels;

    for s in decoder {
        let val = (s as f32 / 32768.0).abs();
        if val > cur_max {
            cur_max = val;
        }
        count += 1;
        if count >= chunk_size {
            intermediate.push(cur_max);
            cur_max = 0.0;
            count = 0;
        }
    }
    if count > 0 {
        intermediate.push(cur_max);
    }

    if intermediate.is_empty() {
        return Ok(vec![0.0; b]);
    }

    // Resample intermediate down to exactly `b` buckets
    let mut peaks = Vec::with_capacity(b);
    let step = intermediate.len() as f32 / b as f32;
    for i in 0..b {
        let start = (i as f32 * step).floor() as usize;
        let end = (((i + 1) as f32 * step).ceil() as usize).min(intermediate.len()).max(start + 1);
        let mut p = 0.0f32;
        for &v in &intermediate[start..end] {
            if v > p {
                p = v;
            }
        }
        peaks.push(p);
    }

    let max = peaks.iter().cloned().fold(0.0f32, f32::max).max(0.001);
    for p in peaks.iter_mut() {
        *p = (*p / max).clamp(0.0, 1.0);
    }
    Ok(peaks)
}
