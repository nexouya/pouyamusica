//! Local YouTube stream core (haste-strim) sidecar lifecycle.

use parking_lot::Mutex;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU16, Ordering};

pub const DEFAULT_PORT: u16 = 17321;

static PORT: AtomicU16 = AtomicU16::new(DEFAULT_PORT);

pub struct StreamCore {
    child: Mutex<Option<Child>>,
}

impl StreamCore {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }

    pub fn port() -> u16 {
        PORT.load(Ordering::SeqCst)
    }

    pub fn base_url() -> String {
        format!("http://127.0.0.1:{}", Self::port())
    }

    fn resolve_core_dir() -> Option<PathBuf> {
        // Dev: project/stream-core next to src-tauri
        let candidates = [
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../stream-core"),
            PathBuf::from("stream-core"),
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.join("stream-core")))
                .unwrap_or_default(),
            dirs::config_dir()
                .map(|d| d.join("pouya-music").join("stream-core"))
                .unwrap_or_default(),
        ];
        for c in candidates {
            if c.join("server.js").exists() {
                return Some(c);
            }
        }
        None
    }

    pub fn find_node_public() -> Option<String> {
        Self::find_node()
    }

    fn find_node() -> Option<String> {
        // Prefer absolute paths — GUI apps often lack a full shell PATH.
        let home = dirs::home_dir().unwrap_or_default();
        let mut candidates: Vec<PathBuf> = vec![
            PathBuf::from(r"C:\Program Files\nodejs\node.exe"),
            PathBuf::from(r"C:\Program Files (x86)\nodejs\node.exe"),
            home.join(".volta").join("bin").join("node.exe"),
            home.join("scoop").join("apps").join("nodejs").join("current").join("node.exe"),
            home.join("AppData").join("Roaming").join("nvm").join("node.exe"),
            PathBuf::from(r"C:\ProgramData\nvm\nodejs\node.exe"),
        ];
        if let Ok(nvm_home) = std::env::var("NVM_HOME") {
            candidates.insert(0, PathBuf::from(nvm_home).join("node.exe"));
        }
        for c in &candidates {
            if c.exists() {
                return Some(c.to_string_lossy().to_string());
            }
        }
        for name in ["node", "node.exe"] {
            if let Ok(out) = Command::new(name).arg("--version").output() {
                if out.status.success() {
                    return Some(name.to_string());
                }
            }
        }
        None
    }

    pub fn is_running(&self) -> bool {
        let mut guard = self.child.lock();
        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(None) => true,
                Ok(Some(_)) => {
                    *guard = None;
                    false
                }
                Err(_) => false,
            }
        } else {
            false
        }
    }

    pub fn start(&self, port: u16) -> Result<u16, String> {
        let port = if port == 0 { DEFAULT_PORT } else { port };
        PORT.store(port, Ordering::SeqCst);

        // Reuse a healthy server already listening (app restart, manual start).
        let url = format!("http://127.0.0.1:{port}/healthz");
        if let Ok(resp) = ureq_get(&url) {
            if resp.contains("\"ok\"") || resp.contains("ok") {
                return Ok(port);
            }
        }

        if self.is_running() {
            return Ok(Self::port());
        }
        let core_dir = Self::resolve_core_dir().ok_or_else(|| {
            "stream-core/server.js not found. Keep the stream-core folder next to the app.".to_string()
        })?;
        let node = Self::find_node().ok_or_else(|| {
            "Node.js is required for YouTube streaming. Install Node 18+ and restart.".to_string()
        })?;

        // Ensure dependencies exist (first run / bundled resource).
        if !core_dir.join("node_modules").join("express").exists() {
            let npm = if cfg!(windows) { "npm.cmd" } else { "npm" };
            let _ = Command::new(npm)
                .current_dir(&core_dir)
                .args(["install", "--omit=dev"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }

        let server = core_dir.join("server.js");
        let mut cmd = Command::new(&node);
        cmd.current_dir(&core_dir)
            .arg(&server)
            .env("PORT", port.to_string())
            .env("HOST", "127.0.0.1")
            .env("STREAM_MODE", "auto")
            .env("ENGINE", "ytdlp")
            .env("STRICT_YOUTUBE", "true")
            .env("BROWSER_COOKIES", "chrome")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .stdin(Stdio::null());

        // Prefer live browser cookies (Chrome first) for bot-check bypass.
        if std::env::var("NO_BROWSER_COOKIES").is_err() {
            cmd.env("BROWSER_COOKIES", "chrome");
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("failed to start stream core: {e}"))?;
        *self.child.lock() = Some(child);

        // Wait briefly for healthz
        let url = format!("{}/healthz", Self::base_url());
        for _ in 0..60 {
            std::thread::sleep(std::time::Duration::from_millis(150));
            if let Ok(resp) = ureq_get(&url) {
                if resp.contains("ok") {
                    return Ok(port);
                }
            }
            if !self.is_running() {
                return Err("stream core exited immediately — check Node.js install".into());
            }
        }
        Ok(port)
    }

    pub fn stop(&self) {
        let mut guard = self.child.lock();
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

pub fn probe_http_ok(url: &str) -> bool {
    match ureq_get(url) {
        Ok(body) => body.contains("ok"),
        Err(_) => false,
    }
}

fn ureq_get(url: &str) -> Result<String, String> {
    // Minimal blocking HTTP GET without extra deps.
    use std::io::Read;
    let url = url.to_string();
    let without_scheme = url
        .strip_prefix("http://")
        .or_else(|| url.strip_prefix("https://"))
        .unwrap_or(&url)
        .to_string();
    let (host_port, path) = match without_scheme.split_once('/') {
        Some((hp, p)) => (hp.to_string(), format!("/{p}")),
        None => (without_scheme, "/".to_string()),
    };
    let (host, port) = match host_port.split_once(':') {
        Some((h, p)) => (
            h.to_string(),
            p.parse::<u16>().map_err(|e| e.to_string())?,
        ),
        None => (host_port, 80u16),
    };
    let mut stream = std::net::TcpStream::connect((host.as_str(), port))
        .map_err(|e| e.to_string())?;
    let req = format!(
        "GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\n\r\n"
    );
    use std::io::Write;
    stream
        .write_all(req.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut buf = String::new();
    stream.read_to_string(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}

impl Drop for StreamCore {
    fn drop(&mut self) {
        self.stop();
    }
}
