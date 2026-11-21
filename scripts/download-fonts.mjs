// scripts/download-fonts.mjs
import fs from 'fs';
import path from 'path';

const FONTS = [
  { id: 'inter', name: 'Inter', query: 'family=Inter:wght@300;400;500;600;700;800;900&display=swap' },
  { id: 'outfit', name: 'Outfit', query: 'family=Outfit:wght@300;400;500;600;700;800;900&display=swap' },
  { id: 'manrope', name: 'Manrope', query: 'family=Manrope:wght@300;400;500;600;700;800&display=swap' },
  { id: 'poppins', name: 'Poppins', query: 'family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&display=swap' },
  { id: 'sora', name: 'Sora', query: 'family=Sora:wght@300;400;500;600;700;800&display=swap' },
  { id: 'space-grotesk', name: 'Space Grotesk', query: 'family=Space+Grotesk:wght@300;400;500;600;700&display=swap' },
  { id: 'archivo', name: 'Archivo', query: 'family=Archivo:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&display=swap' },
  { id: 'montserrat', name: 'Montserrat', query: 'family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&display=swap' },
  { id: 'figtree', name: 'Figtree', query: 'family=Figtree:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&display=swap' },
  { id: 'instrument-sans', name: 'Instrument Sans', query: 'family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap' },
  { id: 'ibm-plex-sans', name: 'IBM Plex Sans', query: 'family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&display=swap' },
  { id: 'oswald', name: 'Oswald', query: 'family=Oswald:wght@300;400;500;600;700&display=swap' },
  { id: 'roboto-condensed', name: 'Roboto Condensed', query: 'family=Roboto+Condensed:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400;1,600&display=swap' },
  { id: 'bebas-neue', name: 'Bebas Neue', query: 'family=Bebas+Neue&display=swap' },
  { id: 'anton', name: 'Anton', query: 'family=Anton&display=swap' },
  { id: 'league-gothic', name: 'League Gothic', query: 'family=League+Gothic&display=swap' },
  { id: 'playfair-display', name: 'Playfair Display', query: 'family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&display=swap' },
  { id: 'fraunces', name: 'Fraunces', query: 'family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,800;0,9..144,900;1,9..144,400;1,9..144,700&display=swap' },
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const OUT_DIR = path.resolve('apps/web/public/fonts/vendor');
const CSS_FILE = path.resolve('apps/web/public/fonts/self-hosted-fonts.css');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log(`Starting self-hosted font download for ${FONTS.length} font families...`);
  let fullCss = '/* OpenLyryc Self-Hosted Font Bundle — Served via Cloudflare Static Assets */\n\n';
  let totalDownloadedFiles = 0;
  let totalBytes = 0;

  for (const font of FONTS) {
    console.log(`\nFetching ${font.name} (${font.id})...`);
    const fontDir = path.join(OUT_DIR, font.id);
    if (!fs.existsSync(fontDir)) {
      fs.mkdirSync(fontDir, { recursive: true });
    }

    const cssUrl = `https://fonts.googleapis.com/css2?${font.query}`;
    let cssText = '';
    try {
      const res = await fetch(cssUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) {
        console.error(`Failed to fetch CSS for ${font.name}: ${res.status}`);
        continue;
      }
      cssText = await res.text();
    } catch (e) {
      console.error(`Error fetching CSS for ${font.name}:`, e.message);
      continue;
    }

    // Extract all unique font URLs
    const urlMatches = [...cssText.matchAll(/url\((https:[^)]+)\)/g)];
    const uniqueUrls = [...new Set(urlMatches.map((m) => m[1]))];

    console.log(`Found ${uniqueUrls.length} font binary files for ${font.name}`);

    // Map each remote URL to a local relative path
    const urlMap = new Map();
    let fileIdx = 1;
    for (const remoteUrl of uniqueUrls) {
      const parsed = path.parse(new URL(remoteUrl).pathname);
      const ext = parsed.ext || '.woff2';
      const cleanBase = parsed.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${font.id}-${fileIdx}-${cleanBase}${ext}`;
      fileIdx++;
      const localFilePath = path.join(fontDir, filename);
      const publicPath = `/fonts/vendor/${font.id}/${filename}`;

      urlMap.set(remoteUrl, publicPath);

      if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
        // Already downloaded
        totalBytes += fs.statSync(localFilePath).size;
        continue;
      }

      try {
        const binRes = await fetch(remoteUrl);
        if (!binRes.ok) {
          console.error(`Failed to download binary: ${remoteUrl}`);
          continue;
        }
        const buffer = Buffer.from(await binRes.arrayBuffer());
        fs.writeFileSync(localFilePath, buffer);
        totalDownloadedFiles++;
        totalBytes += buffer.length;
        console.log(`  Downloaded ${filename} (${Math.round(buffer.length / 1024)} KB)`);
      } catch (err) {
        console.error(`Error downloading ${remoteUrl}:`, err.message);
      }
    }

    // Rewrite URLs in cssText
    let rewrittenCss = cssText;
    for (const [remoteUrl, publicPath] of urlMap.entries()) {
      rewrittenCss = rewrittenCss.replaceAll(remoteUrl, publicPath);
    }

    fullCss += `/* --- ${font.name} (${font.id}) --- */\n` + rewrittenCss + '\n\n';
  }

  fs.writeFileSync(CSS_FILE, fullCss, 'utf-8');
  console.log(`\nAll fonts downloaded!`);
  console.log(`Total binary bytes: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`CSS stylesheet written to: ${CSS_FILE} (${Math.round(fullCss.length / 1024)} KB)`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
