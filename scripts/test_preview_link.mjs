import assert from 'node:assert';

function encodeDraftToHash(doc) {
  try {
    const jsonStr = JSON.stringify(doc);
    return Buffer.from(jsonStr, 'utf-8').toString('base64');
  } catch {
    return '';
  }
}

function decodeHashToDraft(hashStr) {
  try {
    const clean = hashStr.replace(/^[#?]/, '').replace(/^draft=/, '');
    const jsonStr = Buffer.from(clean, 'base64').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function generatePreviewLink({ document, songId, theme, origin = 'https://openlyryc.dev' }) {
  const themeParam = theme && theme !== 'fluid_glow' ? `&theme=${theme}` : '';

  if (songId) {
    return `${origin}/preview?id=${encodeURIComponent(songId)}${themeParam}`;
  }

  if (document.metadata.canonicalKey) {
    const key = document.metadata.canonicalKey.replace(/:/g, '_');
    return `${origin}/preview?id=${encodeURIComponent(key)}${themeParam}`;
  }

  const draftHash = encodeDraftToHash(document);
  return `${origin}/preview#draft=${draftHash}${theme && theme !== 'fluid_glow' ? `&theme=${theme}` : ''}`;
}

// ─── EXECUTE TESTS ────────────────────────────────────────────────────────────

console.log('🧪 Starting Share Preview Route & Link Generation Tests...\n');

const sampleDoc = {
  version: '1.0.0',
  metadata: {
    title: 'Midnight City',
    artist: 'M83',
    canonicalKey: 'yt:kJQP7kiw5Fk',
    youtubeId: 'kJQP7kiw5Fk',
    duration: 243,
  },
  lines: [
    { id: 1, text: 'Waiting in a car', start: 0.5, end: 3.2 },
    { id: 2, text: 'Waiting for a ride in the dark', start: 3.5, end: 6.8 },
  ],
};

// Test 1: Generate Catalog Song Preview URL
const urlCatalog = generatePreviewLink({ document: sampleDoc, songId: 's_m83_midnight', theme: 'vaporwave_neon' });
console.log(`✓ Test 1 [Catalog Song Link]: ${urlCatalog}`);
assert.strictEqual(urlCatalog, 'https://openlyryc.dev/preview?id=s_m83_midnight&theme=vaporwave_neon');

// Test 2: Generate Platform Canonical Key Preview URL
const urlCanonical = generatePreviewLink({ document: sampleDoc, theme: 'monochrome_oled' });
console.log(`✓ Test 2 [Canonical Key Link]: ${urlCanonical}`);
assert.strictEqual(urlCanonical, 'https://openlyryc.dev/preview?id=yt_kJQP7kiw5Fk&theme=monochrome_oled');


// Test 3: Generate Unpublished Local Draft Hash Preview URL
const unpublishedDoc = {
  version: '1.0.0',
  metadata: { title: 'My Local Jam', artist: 'Indie Artist' },
  lines: [{ id: 1, text: 'Test draft line', start: 1.0, end: 4.0 }],
};
const urlDraft = generatePreviewLink({ document: unpublishedDoc });
console.log(`✓ Test 3 [Unpublished Draft Link]: ${urlDraft.slice(0, 60)}...`);
assert.ok(urlDraft.includes('/preview#draft='), 'Draft URL should contain #draft= hash');

// Test 4: Decode Draft Hash
const hash = urlDraft.split('#')[1];
const decoded = decodeHashToDraft(hash);
assert.strictEqual(decoded.metadata.title, 'My Local Jam');
assert.strictEqual(decoded.lines[0].text, 'Test draft line');
console.log(`✓ Test 4 [Draft Hash Roundtrip Decoded]: Title="${decoded.metadata.title}", Lines=${decoded.lines.length}`);

console.log('\n🎉 ALL 4 SHARE PREVIEW TESTS PASSED CLEANLY!\n');
