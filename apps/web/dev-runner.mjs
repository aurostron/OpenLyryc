import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

// 1. Start the YouTube proxy
const proxyScript = path.resolve(rootDir, 'scripts', 'yt-proxy.mjs');
const proxy = spawn('node', [proxyScript], { 
  cwd: rootDir,
  stdio: 'inherit' 
});

// 2. Start local WebRTC signaling server on port 4444
const signalingScript = path.resolve(rootDir, 'node_modules', 'y-webrtc', 'bin', 'server.js');
const signaling = spawn('node', [signalingScript], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: '4444' },
});

// 3. Start Next.js dev server explicitly inside apps/web
const isWin = /^win/.test(process.platform);
const nextCmd = isWin ? 'npx.cmd' : 'npx';
const next = spawn(nextCmd, ['next', 'dev'], { 
  cwd: __dirname,
  stdio: 'inherit',
  shell: isWin 
});

// Handle termination gracefully
['SIGINT', 'SIGTERM'].forEach(sig => {
  process.on(sig, () => {
    proxy.kill(sig);
    signaling.kill(sig);
    next.kill(sig);
    process.exit();
  });
});
