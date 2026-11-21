import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const webDir = path.resolve(rootDir, 'apps/web');
const outputDir = path.resolve(webDir, 'public/visuals');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// React & shared libs shim to guarantee single-instance execution
const sharedShimPlugin = {
  name: 'shared-shim',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|react\/jsx-runtime)$/ }, (args) => ({
      path: args.path,
      namespace: 'shared-shim',
    }));
    build.onLoad({ filter: /.*/, namespace: 'shared-shim' }, (args) => {
      if (args.path === 'react') {
        return { contents: 'module.exports = window.React || globalThis.React;', loader: 'js' };
      }
      if (args.path === 'react-dom') {
        return { contents: 'module.exports = window.ReactDOM || globalThis.ReactDOM;', loader: 'js' };
      }
      if (args.path === 'react/jsx-runtime') {
        return {
          contents: `
            const React = window.React || globalThis.React;
            export const jsx = React.createElement;
            export const jsxs = React.createElement;
            export const Fragment = React.Fragment;
          `,
          loader: 'js',
        };
      }
    });
  },
};

const visualizers = [
  'stage',
  'kinetic',
  'editorial',
  'peak',
  'colors',
  'flythrough',
  'flow',
];

console.log('⚡ Compiling OpenLyryc Visuals (.oviz) bundles...');

// Remove skipped/copyrighted Alve bundles if present
for (const stale of ['alve.ovis', 'alve.oviz']) {
  const stalePath = path.resolve(outputDir, stale);
  if (fs.existsSync(stalePath)) {
    fs.unlinkSync(stalePath);
  }
}

for (const name of visualizers) {
  const entryFile = path.resolve(webDir, `visuals/${name}/index.tsx`);
  const outOviz = path.resolve(outputDir, `${name}.oviz`);
  const outOvis = path.resolve(outputDir, `${name}.ovis`);

  if (!fs.existsSync(entryFile)) {
    console.warn(`[skip] Entry file not found: ${entryFile}`);
    continue;
  }

  try {
    await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      outfile: outOviz,
      format: 'esm',
      target: ['es2020', 'chrome90', 'safari14', 'firefox90'],
      minify: true,
      sourcemap: false,
      plugins: [sharedShimPlugin],
      loader: {
        '.png': 'dataurl',
        '.svg': 'dataurl',
        '.jpg': 'dataurl',
        '.webp': 'dataurl',
      },
      alias: {
        '@': path.resolve(webDir),
      },
      banner: {
        js: `/* OpenLyryc Visual (.oviz) v1.0 — ${name} */\n`,
      },
    });

    // Provide .ovis alias copy for universal compatibility
    fs.copyFileSync(outOviz, outOvis);

    const stats = fs.statSync(outOviz);
    const sizeKb = (stats.size / 1024).toFixed(1);
    console.log(`  ✓ ${name}.oviz / ${name}.ovis (${sizeKb} KB) -> public/visuals/`);
  } catch (err) {
    console.error(`  ✗ Failed to build ${name}.oviz:`, err);
    process.exitCode = 1;
  }
}

console.log('✨ All .oviz visualizers compiled successfully (Alve skipped).');
