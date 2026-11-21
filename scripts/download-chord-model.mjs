// Download the chord-generation model assets into apps/web/public/models/.
// Mirrors scripts/download-fonts.mjs. Run via `npm run models:chords`.
//
// Files are gitignored (see .gitignore). Production builds must run this first.

const REVISION = '8ab85fc0f61439900cd07ac21257a43eac57075c';
const BASE = `https://huggingface.co/musetric/chordmini-onnx/resolve/${REVISION}`;

const FILES = [
  { name: 'chordnet.onnx', size: 17080550 },
  { name: 'cqt-plan.bin', size: 23896 },
  { name: 'config.json', size: 3009 },
];

const OUT_DIR = 'apps/web/public/models';

import { mkdirSync, existsSync, statSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';

mkdirSync(OUT_DIR, { recursive: true });

for (const file of FILES) {
  const dest = join(OUT_DIR, file.name);
  if (existsSync(dest) && statSync(dest).size === file.size) {
    console.log(`[models:chords] ${file.name} already present (${file.size} B), skip`);
    continue;
  }
  console.log(`[models:chords] downloading ${file.name}…`);
  const res = await fetch(`${BASE}/${file.name}`);
  if (!res.ok) throw new Error(`download failed: ${file.name} ${res.status}`);
  const total = Number(res.headers.get('content-length') || file.size);
  const reader = res.body.getReader();
  const ws = createWriteStream(dest);
  let received = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    ws.write(value);
    received += value.byteLength;
    if (total > 0) {
      const pct = ((received / total) * 100).toFixed(1);
      process.stdout.write(`\r[models:chords] ${file.name} ${pct}% (${received}/${total})`);
    }
  }
  ws.end();
  await new Promise((resolve, reject) => {
    ws.on('finish', resolve);
    ws.on('error', reject);
  });
  process.stdout.write('\n');
  const actual = statSync(dest).size;
  if (actual !== file.size) {
    throw new Error(`${file.name}: size mismatch ${actual} vs ${file.size}`);
  }
  console.log(`[models:chords] ${file.name} OK (${actual} B)`);
}

console.log('[models:chords] all assets ready in', OUT_DIR);
