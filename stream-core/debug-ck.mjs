import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const userData = path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data');
const src = path.join(userData, 'Default/Network/Cookies');
const tmp = path.join(os.tmpdir(), 'dbg-ck.db');
fs.copyFileSync(src, tmp);
const db = new DatabaseSync(tmp, { readOnly: true });
const rows = db
  .prepare(
    `SELECT name, length(encrypted_value) AS len, host_key FROM cookies
      WHERE host_key LIKE '%google.com' OR host_key LIKE '%youtube.com' ORDER BY name`
  )
  .all();
for (const r of rows) console.log(r.name, r.len, r.host_key);
db.close();
fs.rmSync(tmp, { force: true });
