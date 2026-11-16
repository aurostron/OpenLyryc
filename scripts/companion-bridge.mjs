#!/usr/bin/env node

/**
 * OpenLyryc Companion Bridge
 * Simple local bridge connecting OpenLyryc Studio in your browser to your desktop.
 * - Streams lossless audio directly from YouTube
 * - Smooth seeking with real audio waveforms
 * - Simple 4-digit pairing with "Remember Me"
 * - Zero extra npm dependencies needed!
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4040;
const HOST = '127.0.0.1';

// Setup directories
const USER_DATA_DIR = path.join(os.homedir(), '.openlyryc');
const CACHE_DIR = path.join(USER_DATA_DIR, 'audio-cache');
const CONFIG_FILE = path.join(USER_DATA_DIR, 'bridge.json');

try {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch {}

// ANSI Colors for clean terminal UI
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
  green: '\x1b[32m',
  brightGreen: '\x1b[92m',
  amber: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// ----------------------------------------------------------------------------
// Configuration & Remember Me
// ----------------------------------------------------------------------------
function generatePairCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

let config = {
  pairCode: generatePairCode(),
  isPaired: false,
  rememberMe: true,
  lastUsed: new Date().toISOString(),
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (data && typeof data === 'object') {
        config = {
          ...config,
          ...data,
        };
        // If Remember Me was on and previously paired, stay paired!
        if (config.rememberMe && data.isPaired) {
          config.isPaired = true;
        }
      }
    }
  } catch {}
}

function saveConfig() {
  try {
    config.lastUsed = new Date().toISOString();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch {}
}

loadConfig();

// ----------------------------------------------------------------------------
// Resolve yt-dlp binary
// ----------------------------------------------------------------------------
function resolveYtDlp() {
  const repoRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(repoRoot, 'apps', 'desktop', 'release', 'yt-dlp.exe'),
    path.join(repoRoot, 'apps', 'desktop', 'src-tauri', 'binaries', 'yt-dlp-x86_64-pc-windows-msvc.exe'),
    path.join(repoRoot, 'yt-dlp.exe'),
    path.join(USER_DATA_DIR, 'bin', 'yt-dlp.exe'),
    path.join(os.homedir(), '.stacher', 'yt-dlp.exe'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return 'yt-dlp';
}

const ytDlpPath = resolveYtDlp();

// ----------------------------------------------------------------------------
// Terminal UI Header & ASCII Art
// ----------------------------------------------------------------------------
let lastMessage = 'Ready and waiting for Studio to connect.';

function clearAndDrawUI() {
  // Clear screen and scrollback
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');

  // Load ascii art
  const asciiPath = path.join(__dirname, 'ascii-art.txt');
  let art = '';
  try {
    if (fs.existsSync(asciiPath)) {
      art = fs.readFileSync(asciiPath, 'utf-8');
    }
  } catch {}

  if (art) {
    console.log(`${C.cyan}${art}${C.reset}`);
  } else {
    console.log(`\n  ${C.bold}${C.white}OPENLYRYC${C.reset} ${C.dim}Companion Bridge${C.reset}\n`);
  }

  const statusText = config.isPaired
    ? `${C.brightGreen}${C.bold}● PAIRED & CONNECTED${C.reset}`
    : `${C.amber}${C.bold}○ WAITING TO PAIR${C.reset}`;

  const rememberText = config.rememberMe
    ? `${C.brightGreen}Active (Remembers this computer)${C.reset}`
    : `${C.gray}Single Session${C.reset}`;

  console.log(`  ${C.dim}───────────────────────────────────────────────────────────────────${C.reset}`);
  console.log(`  ${C.bold}Status:${C.reset}          ${statusText}`);
  console.log(`  ${C.bold}Pairing Code:${C.reset}    ${C.brightCyan}${C.bold}[ ${config.pairCode.split('').join(' ')} ]${C.reset}  ${C.dim}(Enter in Studio > Track Metadata)${C.reset}`);
  console.log(`  ${C.bold}Remember Me:${C.reset}     ${rememberText}`);
  console.log(`  ${C.bold}Bridge Address:${C.reset}  http://${HOST}:${PORT}`);
  console.log(`  ${C.bold}Audio Cache:${C.reset}     ${C.dim}${CACHE_DIR}${C.reset}`);
  console.log(`  ${C.dim}───────────────────────────────────────────────────────────────────${C.reset}`);
  console.log(`  ${C.bold}Activity:${C.reset}        ${lastMessage}`);
  console.log(`  ${C.dim}───────────────────────────────────────────────────────────────────${C.reset}`);
  console.log(`  ${C.dim}Shortcuts: [O] Open Studio in Browser | [F] Open Audio Folder | [R] New Code | [Q] Quit${C.reset}\n`);
}

function updateActivity(msg) {
  lastMessage = msg;
  clearAndDrawUI();
}

// ----------------------------------------------------------------------------
// Helpers for Opening Explorer and Browser
// ----------------------------------------------------------------------------
function openFolder(folderPath) {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWin) {
    spawn('explorer.exe', [folderPath], { detached: true, stdio: 'ignore' });
  } else if (isMac) {
    spawn('open', [folderPath], { detached: true, stdio: 'ignore' });
  } else {
    spawn('xdg-open', [folderPath], { detached: true, stdio: 'ignore' });
  }
}

function openStudioBrowser(targetUrl = 'https://openlyryc.pages.dev/studio') {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWin) {
    spawn('cmd.exe', ['/C', 'start', '', targetUrl], { detached: true, stdio: 'ignore' });
  } else if (isMac) {
    spawn('open', [targetUrl], { detached: true, stdio: 'ignore' });
  } else {
    spawn('xdg-open', [targetUrl], { detached: true, stdio: 'ignore' });
  }
}

// ----------------------------------------------------------------------------
// YouTube Search Helper (yt-dlp flat playlist)
// ----------------------------------------------------------------------------
function searchYouTube(query) {
  return new Promise((resolve) => {
    const proc = spawn(ytDlpPath, [
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
      `ytsearch5:${query}`,
    ]);

    let output = '';
    proc.stdout.on('data', (d) => (output += d));
    proc.on('close', (code) => {
      if (code !== 0 || !output.trim()) {
        return resolve([]);
      }
      try {
        const parsed = JSON.parse(output);
        const entries = parsed.entries || [];
        const results = entries.map((e) => {
          const sec = Number(e.duration || 0);
          const mins = Math.floor(sec / 60);
          const rem = Math.floor(sec % 60);
          return {
            id: e.id,
            title: e.title || 'Untitled',
            uploader: e.uploader || e.channel || 'Artist',
            duration: sec,
            durationFormatted: `${mins}:${String(rem).padStart(2, '0')}`,
            thumbnail: (e.thumbnails && e.thumbnails[0]?.url) || '',
          };
        });
        resolve(results);
      } catch {
        resolve([]);
      }
    });
  });
}

// ----------------------------------------------------------------------------
// Audio Download & Caching Helper
// ----------------------------------------------------------------------------
function downloadAudio(rawTarget, format = 'opus', title = '') {
  return new Promise((resolve) => {
    let cleanId = '';
    let target = rawTarget.trim();

    if (target.includes('v=')) {
      cleanId = target.split('v=')[1]?.split('&')[0] || '';
    } else if (target.includes('youtu.be/')) {
      cleanId = target.split('youtu.be/')[1]?.split('?')[0] || '';
    } else if (target.length === 11 && !target.includes(' ')) {
      cleanId = target;
      target = `https://www.youtube.com/watch?v=${target}`;
    } else if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `ytsearch1:${target}`;
    }

    // 1. Check if already in cache
    if (cleanId) {
      try {
        const existing = fs.readdirSync(CACHE_DIR);
        const found = existing.find(
          (f) =>
            f.startsWith(cleanId) &&
            (f.endsWith('.opus') || f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.webm'))
        );
        if (found) {
          updateActivity(`✓ Using cached audio: ${title || found}`);
          return resolve({
            ok: true,
            filename: found,
            streamUrl: `http://${HOST}:${PORT}/audio/${encodeURIComponent(found)}`,
            format,
          });
        }
      } catch {}
    }

    updateActivity(`⬇ Downloading audio: ${title || rawTarget} ...`);

    const template = path.join(CACHE_DIR, '%(id)s.%(ext)s');
    const args = ['--no-playlist', '--no-warnings', '-o', template];

    if (format === 'mp3') {
      args.push('-x', '--audio-format', 'mp3');
    } else if (format === 'm4a') {
      args.push('-x', '--audio-format', 'm4a');
    } else {
      args.push('-f', 'ba/ba*', '-x', '--audio-format', 'opus');
    }

    args.push(target);

    const proc = spawn(ytDlpPath, args);

    proc.on('close', (code) => {
      if (code !== 0) {
        updateActivity(`✗ Could not download audio for: ${title || rawTarget}`);
        return resolve({ ok: false, error: 'Download failed' });
      }

      // Find downloaded file
      let foundFile = null;
      try {
        const files = fs.readdirSync(CACHE_DIR);
        if (cleanId) {
          foundFile = files.find(
            (f) =>
              f.startsWith(cleanId) &&
              (f.endsWith('.opus') || f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.webm'))
          );
        }

        // Fallback: newest file in cache directory
        if (!foundFile) {
          let latestMtime = 0;
          for (const f of files) {
            if (f.endsWith('.opus') || f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.webm')) {
              const stat = fs.statSync(path.join(CACHE_DIR, f));
              if (stat.mtimeMs > latestMtime) {
                latestMtime = stat.mtimeMs;
                foundFile = f;
              }
            }
          }
        }
      } catch {}

      const finalName = foundFile || `${cleanId || 'audio'}.opus`;
      updateActivity(`✓ Ready to stream: ${title || finalName}`);

      resolve({
        ok: true,
        filename: finalName,
        streamUrl: `http://${HOST}:${PORT}/audio/${encodeURIComponent(finalName)}`,
        format,
      });
    });
  });
}

// ----------------------------------------------------------------------------
// HTTP Server (127.0.0.1:4040)
// ----------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const method = req.method?.toUpperCase() || 'GET';
  const parsedUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = parsedUrl.pathname;

  // CORS and Private Network Access (PNA) Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-Requested-With');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse JSON Body for POST requests
  let body = {};
  if (method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (raw) body = JSON.parse(raw);
    } catch {}
  }

  // Routes
  if ((method === 'GET' && pathname === '/health') || (method === 'GET' && pathname === '/status')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        status: 'online',
        port: PORT,
        version: '0.1.0',
        ytdlp: true,
        cacheDir: CACHE_DIR,
        paired: config.isPaired,
        code: config.pairCode,
      })
    );
    return;
  }

  if (method === 'GET' && pathname === '/pair') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        paired: config.isPaired,
        code: config.pairCode,
        message: config.isPaired ? 'Connected to OpenLyryc Studio' : 'Pairing required',
      })
    );
    return;
  }

  if (method === 'POST' && pathname === '/pair') {
    const inputCode = String(body.code || '').trim();
    if (inputCode === config.pairCode) {
      config.isPaired = true;
      config.rememberMe = true;
      saveConfig();
      updateActivity('● Successfully paired with OpenLyryc Studio in your browser!');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          paired: true,
          code: config.pairCode,
          message: 'Paired successfully',
        })
      );
    } else {
      updateActivity(`⚠ Pairing attempt failed (code entered was incorrect)`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: false,
          paired: false,
          message: 'Incorrect 4-digit code. Check your terminal screen.',
        })
      );
    }
    return;
  }

  if (method === 'POST' && pathname === '/unpair') {
    config.isPaired = false;
    saveConfig();
    updateActivity('Disconnected / Unpaired.');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, paired: false }));
    return;
  }

  if (method === 'GET' && pathname === '/search') {
    const query = parsedUrl.searchParams.get('q') || '';
    if (!query) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, results: [] }));
      return;
    }
    updateActivity(`Searching YouTube for: "${query}" ...`);
    const results = await searchYouTube(query);
    updateActivity(`Found ${results.length} results for: "${query}"`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, results }));
    return;
  }

  if (method === 'POST' && pathname === '/download') {
    const url = body.url || '';
    const format = body.format || 'opus';
    const title = body.title || '';
    if (!url) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Missing url' }));
      return;
    }

    const result = await downloadAudio(url, format, title);
    res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // Range-seek Audio Streaming
  if (method === 'GET' && pathname.startsWith('/audio/')) {
    const fileName = decodeURIComponent(pathname.replace('/audio/', ''));
    const filePath = path.join(CACHE_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Audio file not found');
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    let contentType = 'application/octet-stream';
    if (fileName.endsWith('.opus') || fileName.endsWith('.webm')) {
      contentType = 'audio/ogg; codecs=opus';
    } else if (fileName.endsWith('.m4a') || fileName.endsWith('.mp4')) {
      contentType = 'audio/mp4';
    } else if (fileName.endsWith('.mp3')) {
      contentType = 'audio/mpeg';
    }

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        res.end();
        return;
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
    return;
  }

  if (method === 'GET' && pathname === '/library') {
    try {
      const files = fs.readdirSync(CACHE_DIR);
      const items = files
        .filter((f) => f.endsWith('.opus') || f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.webm'))
        .map((f) => {
          const s = fs.statSync(path.join(CACHE_DIR, f));
          const mb = (s.size / (1024 * 1024)).toFixed(1);
          return {
            filename: f,
            title: f.replace(/\.[^/.]+$/, ''),
            size_bytes: s.size,
            size_formatted: `${mb} MB`,
          };
        });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, items }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, items: [] }));
    }
    return;
  }

  if (method === 'POST' && pathname === '/open-cache') {
    openFolder(CACHE_DIR);
    updateActivity('Opened audio cache folder in file explorer');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (method === 'POST' && pathname === '/open-url') {
    const targetUrl = body.url || 'https://openlyryc.pages.dev/studio';
    openStudioBrowser(targetUrl);
    updateActivity(`Opened Studio in browser: ${targetUrl}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  clearAndDrawUI();
});

// ----------------------------------------------------------------------------
// Interactive CLI Keyboard Shortcuts
// ----------------------------------------------------------------------------
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf-8');

  process.stdin.on('data', (key) => {
    // Ctrl+C or 'q' to quit
    if (key === '\u0003' || key.toLowerCase() === 'q') {
      console.log(`\n  ${C.gray}Bridge stopped. Goodbye!${C.reset}\n`);
      process.exit(0);
    }

    // 'o' to open studio
    if (key.toLowerCase() === 'o') {
      openStudioBrowser();
      updateActivity('Opening OpenLyryc Studio in your default browser...');
    }

    // 'f' to open cache folder
    if (key.toLowerCase() === 'f') {
      openFolder(CACHE_DIR);
      updateActivity('Opening downloaded audio folder...');
    }

    // 'r' to generate new pairing code
    if (key.toLowerCase() === 'r') {
      config.pairCode = generatePairCode();
      config.isPaired = false;
      saveConfig();
      updateActivity('Generated new 4-digit pairing code. Enter it in Studio.');
    }
  });
}
