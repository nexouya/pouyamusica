use rodio::Source;
use std::path::PathBuf;

#[test]
fn decodes_user_music_wavs() {
    let dir = PathBuf::from(std::env::var("USERPROFILE").unwrap_or_default())
        .join("Music")
        .join("pouya-music");
    if !dir.is_dir() {
        eprintln!("skip: no test music at {}", dir.display());
        return;
    }
    let mut count = 0;
    for entry in std::fs::read_dir(&dir).unwrap().flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("wav") {
            continue;
        }
        let meta = crate::library::scanner::read_track(&path).expect("read_track");
        assert!(meta.duration_secs > 1.0, "duration for {:?}", path);
        let file = std::fs::File::open(&path).expect("open");
        let decoder =
            rodio::Decoder::new(std::io::BufReader::new(file)).expect("decode wav");
        assert!(decoder.channels() >= 1);
        count += 1;
        let _ = crate::library::scanner::scan_folder(&dir).expect("scan");
    }
    assert!(count > 0, "expected at least one wav");
}
