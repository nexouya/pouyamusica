use rustfft::{num_complex::Complex, FftPlanner};
use std::f32::consts::PI;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use super::shared::{FftFrame, SharedAudioState};

pub const BAND_COUNT: usize = 32;
pub const FFT_SIZE: usize = 1024;

/// Spawn a background FFT loop that emits 32 log-spaced bands at ~60fps.
pub fn spawn_analyzer(
    state: SharedAudioState,
    emit: impl Fn(FftFrame) + Send + 'static,
) -> thread::JoinHandle<()> {
    thread::Builder::new()
        .name("pouya-fft".into())
        .spawn(move || {
            let mut planner = FftPlanner::<f32>::new();
            let fft: Arc<dyn rustfft::Fft<f32>> = planner.plan_fft_forward(FFT_SIZE);
            let mut buffer: Vec<Complex<f32>> = vec![Complex::new(0.0, 0.0); FFT_SIZE];
            let mut window = vec![0.0f32; FFT_SIZE];
            for (i, w) in window.iter_mut().enumerate() {
                *w = 0.5 - 0.5 * (2.0 * PI * i as f32 / (FFT_SIZE - 1) as f32).cos();
            }
            let mut magnitudes = vec![0.0f32; FFT_SIZE / 2];
            let mut smoothed = vec![0.0f32; BAND_COUNT];
            let tick = Duration::from_millis(33);

            loop {
                if !state.is_playing() {
                    let max_val = smoothed.iter().cloned().fold(0.0f32, f32::max);
                    if max_val > 0.005 {
                        // Smooth decay when just paused
                        for v in smoothed.iter_mut() {
                            *v *= 0.82;
                        }
                        emit(FftFrame {
                            bands: smoothed.clone(),
                            rms: 0.0,
                            sample_rate: state.sample_rate(),
                        });
                    }
                    thread::sleep(Duration::from_millis(60));
                    continue;
                }

                let samples = state.latest_window(FFT_SIZE);
                for (i, s) in samples.iter().enumerate() {
                    buffer[i] = Complex::new(*s * window[i], 0.0);
                }
                fft.process(&mut buffer);

                let mut rms = 0.0f32;
                for s in &samples {
                    rms += *s * *s;
                }
                rms = (rms / samples.len().max(1) as f32).sqrt();

                for (i, m) in magnitudes.iter_mut().enumerate() {
                    let c = buffer[i];
                    *m = (c.re * c.re + c.im * c.im).sqrt();
                }

                let sr = state.sample_rate().max(8000) as f32;
                let nyquist = sr / 2.0;
                let min_freq = 30.0f32;
                let max_freq = (nyquist * 0.92).min(16_000.0);

                let mut bands = vec![0.0f32; BAND_COUNT];
                for b in 0..BAND_COUNT {
                    let f0 = min_freq * (max_freq / min_freq).powf(b as f32 / BAND_COUNT as f32);
                    let f1 = min_freq
                        * (max_freq / min_freq).powf((b + 1) as f32 / BAND_COUNT as f32);
                    let bin0 = ((f0 / nyquist) * (FFT_SIZE / 2) as f32) as usize;
                    let bin1 = (((f1 / nyquist) * (FFT_SIZE / 2) as f32) as usize)
                        .max(bin0 + 1)
                        .min(FFT_SIZE / 2);
                    let mut acc = 0.0f32;
                    let mut count = 0usize;
                    for m in magnitudes.iter().take(bin1).skip(bin0) {
                        acc += *m;
                        count += 1;
                    }
                    let avg = if count > 0 { acc / count as f32 } else { 0.0 };
                    // Perceptual-ish curve + clamp
                    bands[b] = (avg * 18.0).powf(0.65).clamp(0.0, 1.0);
                }

                // lerp 0.3 toward new frame for smooth motion
                for i in 0..BAND_COUNT {
                    smoothed[i] += (bands[i] - smoothed[i]) * 0.3;
                }

                emit(FftFrame {
                    bands: smoothed.clone(),
                    rms,
                    sample_rate: state.sample_rate(),
                });

                thread::sleep(tick);
            }
        })
        .expect("failed to spawn FFT analyzer thread")
}
