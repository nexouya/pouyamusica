#!/usr/bin/env node
/** Restart stream-core on 17321 with the latest code. */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const PORT = 17321;
const root = "C:\\Users\\NexAdmin\\Downloads\\New folder\\pouyamusica-main\\pouyamusica-main\\stream-core";
const node = "C:\\Program Files\\nodejs\\node.exe";

async function portBusy(port) {
  const { execSync } = await import("node:child_process");
  try {
    const out = execSync(`netstat -ano | findstr LISTENING | findstr :${port}`, {
      encoding: "utf8",
      windowsHide: true,
    });
    return out.trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

async function killOnPort(port) {
  const lines = await portBusy(port);
  const { execSync } = await import("node:child_process");
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (/^\d+$/.test(pid)) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { windowsHide: true });
        console.log(`killed ${pid} on :${port}`);
      } catch {
        /* ignore */
      }
    }
  }
}

await killOnPort(PORT);
await new Promise((r) => setTimeout(r, 400));

const child = spawn(node, ["server.js"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: "127.0.0.1",
    ENGINE: "auto",
    STREAM_MODE: "ytdlp",
  },
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();
console.log(`started stream-core pid=${child.pid}`);

// Wait for health
const t0 = Date.now();
for (let i = 0; i < 40; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/healthz`, {
      signal: AbortSignal.timeout(1000),
    });
    if (res.ok) {
      console.log("health", await res.text());
      process.exit(0);
    }
  } catch {
    /* retry */
  }
  await new Promise((r) => setTimeout(r, 200));
}
console.error("stream-core did not become healthy in time");
process.exit(1);
