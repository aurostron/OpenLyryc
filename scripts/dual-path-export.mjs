#!/usr/bin/env node
/**
 * Dual-path export mirroring — makes BOTH URL forms resolve with a direct 200.
 *
 * Next.js `output: 'export'` emits one file per route:
 *   - trailingSlash: false -> `studio.html`   (Cloudflare serves /studio)
 *   - trailingSlash: true  -> `studio/index.html` (Pages 308-redirects /studio)
 *
 * We build with trailingSlash: false so existing links (`/studio`,
 * `/studio#export`) keep working untouched, then mirror each route HTML into a
 * sibling directory index:
 *   studio.html  ->  studio/index.html
 *
 * Result on Cloudflare Pages (and any static host):
 *   /studio   -> 200 (clean URL → studio.html, no redirect)
 *   /studio/  -> 200 (directory → studio/index.html)
 *   /studio#export -> 200, fragment re-attached by the browser, zero hops.
 *
 * Profile route alias mirroring:
 *   u/aurostron.html -> @aurostron.html AND @aurostron/index.html
 *   Result: /@aurostron serves direct 200 without redirects!
 *
 * The hash-routing UI (#search/#export/#paste/…) never hits the server, so this
 * mirrors only the HTML documents; _next assets are served by their own paths.
 *
 * Usage: node scripts/dual-path-export.mjs [outDir]   (default: apps/web/out)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'apps/web/out');

if (!fs.existsSync(OUT)) {
  console.error(`[dual-path-export] no export directory at ${OUT}`);
  process.exit(0); // nothing to mirror; not fatal
}

/** Collect route HTML documents from the export root (skipping _next assets). */
function routeHtmlFiles(dir, base = OUT) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_next') continue;
      // recurse one level into route folders (404/, _not-found/) but they will
      // already be handled via their own index.html — nothing to add.
      found.push(...routeHtmlFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      found.push(full);
    }
  }
  return found;
}

const files = routeHtmlFiles(OUT);
let copied = 0;
for (const file of files) {
  const rel = path.relative(OUT, file);          // e.g. studio.html
  const stem = rel.slice(0, -'.html'.length);    // e.g. studio
  if (!stem || stem === 'index') {
    // index.html is the site root; nothing to mirror.
    continue;
  }
  const targetDir = path.join(OUT, stem);
  const target = path.join(targetDir, 'index.html');
  // Skip if a real directory with its own index already exists (nested routes).
  if (fs.existsSync(target) && fs.readFileSync(target).length !== fs.readFileSync(file).length) {
    // Pre-existing different index (a genuine nested route) — leave it alone.
    continue;
  }
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(file, target);
  copied++;

  // Also mirror user profile routes: /u/<user> -> /@<user>
  // e.g. u/aurostron.html -> @aurostron.html & @aurostron/index.html
  const normalizedStem = stem.replace(/\\/g, '/');
  if (normalizedStem.startsWith('u/')) {
    const user = normalizedStem.slice('u/'.length);
    if (user && !user.includes('/')) {
      const atDir = path.join(OUT, `@${user}`);
      const atIndex = path.join(atDir, 'index.html');
      const atHtml = path.join(OUT, `@${user}.html`);
      fs.mkdirSync(atDir, { recursive: true });
      fs.copyFileSync(file, atIndex);
      fs.copyFileSync(file, atHtml);
      copied += 2;
    }
  }
}

// Sync announcements.json and announcement.json in the export directory
const exportAnnouncements = path.join(OUT, 'announcements.json');
const exportAnnouncement = path.join(OUT, 'announcement.json');
if (fs.existsSync(exportAnnouncements)) {
  fs.copyFileSync(exportAnnouncements, exportAnnouncement);
} else if (fs.existsSync(exportAnnouncement)) {
  fs.copyFileSync(exportAnnouncement, exportAnnouncements);
}

console.log(`[dual-path-export] mirrored ${copied}/${files.length} route documents into /<route>/index.html`);
