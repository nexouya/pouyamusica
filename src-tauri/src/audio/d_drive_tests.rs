//! Optional integration test against a local folder of real audio files.
//! Enable by setting POUYA_TEST_AUDIO_DIR to a directory containing mp3/wav/m4a/flac.

#[test]
fn loads_env_audio_dir_track() {
    let Ok(dir) = std::env::var("POUYA_TEST_AUDIO_DIR") else {
        eprintln!("skip: POUYA_TEST_AUDIO_DIR not set");
        return;
    };
    let path = std::path::PathBuf::from(dir);
    let mut found = None;
    if let Ok(rd) = std::fs::read_dir(&path) {
        for e in rd.flatten() {
            let p = e.path();
            if p.extension()
                .and_then(|x| x.to_str())
                .map(|x| {
                    x.eq_ignore_ascii_case("mp3")
                        || x.eq_ignore_ascii_case("wav")
                        || x.eq_ignore_ascii_case("m4a")
                        || x.eq_ignore_ascii_case("flac")
                })
                .unwrap_or(false)
            {
                found = Some(p);
                break;
            }
        }
    }
    let Some(file) = found else {
        eprintln!("no audio in POUYA_TEST_AUDIO_DIR");
        return;
    };
    let meta = crate::library::scanner::read_track(&file).expect("read_track");
    println!("meta title={} dur={}", meta.title, meta.duration_secs);
    assert!(meta.duration_secs > 1.0);
    let engine = crate::audio::AudioEngine::start().expect("engine");
    engine
        .load_track(&file.to_string_lossy())
        .expect("load_track waits for decode");
    engine.play().expect("play");
    std::thread::sleep(std::time::Duration::from_millis(400));
    assert!(engine.is_playing() || engine.duration_secs() > 0.0);
}
