pub mod analyzer;
pub mod decoder;
pub mod engine;
pub mod shared;

pub use engine::AudioEngine;

#[cfg(test)]
mod user_music_tests;

// Machine-local audio samples (e.g. D:\a) are opt-in via env var.
#[cfg(test)]
#[path = "d_drive_tests.rs"]
mod env_audio_tests;
