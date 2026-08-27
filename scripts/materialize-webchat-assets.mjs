import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const root = process.cwd();
const sourceRoot = path.join(root, 'webchat-source');
const outputRoot = path.join(root, 'webchat-dist');
const manifest = JSON.parse(
  fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8')
);

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

for (const [name, spec] of Object.entries(manifest.files)) {
  const bundlePath = path.join(root, spec.bundle);
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Missing WebChat source bundle: ${spec.bundle}`);
  }

  const encoded = fs.readFileSync(bundlePath, 'utf8').replace(/\s+/g, '');
  const compressed = Buffer.from(encoded, 'base64');
  const raw = zlib.gunzipSync(compressed);
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');

  if (sha256 !== spec.sha256) {
    throw new Error(`${name} SHA-256 mismatch: expected ${spec.sha256}, got ${sha256}`);
  }

  const text = raw.toString('utf8');
  for (const marker of spec.requiredMarkers || []) {
    if (!text.includes(marker)) {
      throw new Error(`${name} is missing required marker: ${marker}`);
    }
  }

  fs.writeFileSync(path.join(outputRoot, name), raw);
  console.log(`PASS ${name} ${sha256}`);
}

fs.writeFileSync(
  path.join(outputRoot, 'manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceManifest: 'webchat-source/manifest.json',
      runtimeContract: manifest.runtimeContract,
      files: Object.fromEntries(
        Object.entries(manifest.files).map(([name, spec]) => [name, { sha256: spec.sha256 }])
      )
    },
    null,
    2
  ) + '\n'
);

console.log('AFZ WebChat Git source materialization: PASS');
