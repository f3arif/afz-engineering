import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const productionRoot = path.join(root, 'production-site');
const manifestPath = path.join(productionRoot, 'manifest.json');

function fail(message) {
  console.error(`AFZ PRODUCTION DEPLOY BLOCKED: ${message}`);
  console.error('The repository root is not yet the reconciled AFZ production website.');
  console.error('Do not deploy the legacy Next.js starter to the Raspberry Pi.');
  process.exit(42);
}

if (!fs.existsSync(manifestPath)) {
  fail('production-site/manifest.json is missing.');
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`production manifest is invalid JSON: ${error.message}`);
}

if (manifest.reconciled !== true) {
  fail('production manifest has not been explicitly marked reconciled.');
}

const required = [
  {
    file: 'index.html',
    markers: ['afz-ai-widget.js', 'afz-ai-widget.css']
  },
  {
    file: 'contact.html',
    markers: ['AFZ AI PROJECT QUESTION PREFILL', 'AFZ LEAD SOURCE TRACKING']
  },
  {
    file: 'services.html',
    markers: ['afz-ai-widget.js', 'afz-ai-widget.css']
  },
  {
    file: 'afz-ai-widget.js',
    markers: ['AFZ CHAT SESSION PERSISTENCE', '/api/ai-chat']
  },
  {
    file: 'afz-ai-widget.css',
    markers: ['#afz-ai-launcher', '#afz-ai-panel']
  }
];

for (const item of required) {
  const filePath = path.join(productionRoot, item.file);
  if (!fs.existsSync(filePath)) {
    fail(`${item.file} is missing from production-site/.`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const marker of item.markers) {
    if (!content.includes(marker)) {
      fail(`${item.file} is missing required WebChat marker: ${marker}`);
    }
  }

  const expected = manifest.files?.[item.file]?.sha256;
  if (expected) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    if (actual !== expected) {
      fail(`${item.file} SHA-256 differs from the reconciled production manifest.`);
    }
  }
}

if (manifest.webchat?.endpoint !== '/api/ai-chat') {
  fail('manifest WebChat endpoint must remain same-origin /api/ai-chat.');
}

if (manifest.webchat?.backendOwner !== 'hpenvy') {
  fail('manifest WebChat backend owner must remain hpenvy.');
}

console.log('AFZ production deploy guard: PASS');
console.log('Production snapshot and WebChat contract are reconciled.');
