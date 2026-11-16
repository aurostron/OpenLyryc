import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const openapiModulePath = path.resolve(__dirname, '../src/routes/openapi.ts');
  // Dynamic import using tsx or jiti if needed, or read from ts
  const content = fs.readFileSync(openapiModulePath, 'utf-8');
  
  // Find OPENAPI_SPEC JSON
  const match = content.match(/export const OPENAPI_SPEC = (\{[\s\S]*?\n\};)/);
  if (!match) {
    console.error('Could not find OPENAPI_SPEC in openapi.ts');
    process.exit(1);
  }

  // Evaluate safely
  const specStr = match[1].replace(/;\s*$/, '');
  const specObj = new Function(`return (${specStr});`)();

  const targetPath = path.resolve(__dirname, '../../../apps/web/public/openapi.json');
  fs.writeFileSync(targetPath, JSON.stringify(specObj, null, 2) + '\n', 'utf-8');
  console.log(`Successfully synced OPENAPI_SPEC to ${targetPath}`);
  console.log(`Total documented paths: ${Object.keys(specObj.paths).length}`);
  console.log(`Paths: ${Object.keys(specObj.paths).join(', ')}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
