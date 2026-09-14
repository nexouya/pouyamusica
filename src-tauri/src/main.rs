// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let log_path = std::env::current_exe()
        .map(|p| p.parent().unwrap_or(&p).join("startup_log.txt"))
        .unwrap_or_else(|_| std::path::PathBuf::from("startup_log.txt"));
    
    let _ = std::fs::write(&log_path, "Main entry point started\n");
    
    let log_clone = log_path.clone();
    std::panic::set_hook(Box::new(move |info| {
        let msg = format!("PANIC CAUGHT: {info}\n");
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_clone)
            .and_then(|mut f| std::io::Write::write_all(&mut f, msg.as_bytes()));
    }));

    pouya_music_lib::run();
    
    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .and_then(|mut f| std::io::Write::write_all(&mut f, b"Main run() exited normally\n"));
}
