import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.mjs';
import { loadConfiguration } from '../config.mjs';
import { createProvider, browser } from './oidc-fixture.mjs';

async function listen(app) {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  return { server, url: 'http://127.0.0.1:' + server.address().port };
}
const close = server => new Promise(resolve => server.close(resolve));

test('configuration rejects unsafe origins and weak or readable private configuration', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'afz-auth-config-'));
  const path = join(directory, 'settings.json');
  const env = { PILOT_CONFIG_FILE: path, AUTH0_ISSUER_BASE_URL: 'https://tenant.example', AUTH0_CLIENT_ID: 'client', AUTH0_CLIENT_SECRET: 'secret', AUTH0_SESSION_SECRET: 'a'.repeat(64), PILOT_BASE_URL: 'http://localhost:19870' };
  try {
    assert.equal(loadConfiguration(env).ready, true);
    for (const override of [ { AUTH0_ISSUER_BASE_URL: 'http://tenant.example' }, { PILOT_BASE_URL: 'http://192.168.1.2:19870' }, { PILOT_BASE_URL: 'https://user:password@app.example' }, { PILOT_BASE_URL: 'https://app.example/unexpected' }, { AUTH0_SESSION_SECRET: 'weak' }, { AUTH0_CLIENT_SECRET: '' }, { PILOT_MEMBERSHIPS_FILE: 'relative.json' } ]) {
      assert.equal(loadConfiguration({ ...env, ...override }).ready, false);
    }
    writeFileSync(path, '{}', { mode: 0o644 });
    chmodSync(path, 0o644);
    assert.equal(loadConfiguration(env).ready, false);
    chmodSync(path, 0o600);
    writeFileSync(path, 'not JSON');
    assert.equal(loadConfiguration(env).ready, false);
    for (const value of ['null', '[]', '42']) {
      writeFileSync(path, value);
      assert.equal(loadConfiguration(env).ready, false);
    }
  } finally { rmSync(directory, { recursive: true }); }
});

test('an unconfigured pilot exposes no protected content or fake login', async () => {
  const { server, url } = await listen(createApp({ ready: false, issues: ['AUTH0_CLIENT_SECRET'] }));
  try {
    const landing = await fetch(url);
    assert.equal(landing.status, 200);
    const html = await landing.text();
    assert.match(html, /Awaiting Auth0/);
    assert.doesNotMatch(html, /Maple House|Cedar House|AUTH0_CLIENT_SECRET|href="\/login"/);
    for (const path of ['/api/projects', '/projects/sample-a', '/login', '/callback?code=forged', '/healthz']) assert.equal((await fetch(url + path)).status, 503);
  } finally { await close(server); }
});

test('real SDK authorization-code flow enforces project boundaries', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'afz-auth-access-'));
  const file = join(directory, 'memberships.json');
  const members = { 'auth0|alice': { role: 'client', projects: ['sample-a'] }, 'auth0|bob': { role: 'reviewer', projects: ['sample-b'] }, 'auth0|owner': { role: 'admin', projects: ['sample-a', 'sample-b'] } };
  const save = data => writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
  save(members);
  const provider = await createProvider();
  // Reserve a stable callback origin before creating SDK middleware.
  const { createServer } = await import('node:http');
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  server.on('request', createApp({ ready: true, baseURL: url, membershipFile: file, oidc: { issuerBaseURL: provider.issuer, clientID: 'pilot-client', clientSecret: 'pilot-secret', secret: 'b'.repeat(64) } }));
  async function login(subject, client = browser()) {
    provider.setSubject(subject);
    const start = await client.request(url + '/login?returnTo=https://evil.example');
    assert.equal(start.status, 302);
    const authorize = await client.request(start.headers.get('location'));
    assert.equal(authorize.status, 302);
    const callback = await client.request(authorize.headers.get('location'));
    return { client, callback, callbackURL: authorize.headers.get('location') };
  }
  try {
    await t.test('anonymous API access and forged identity headers are denied', async () => {
      const r = await fetch(url + '/api/projects', { headers: { 'X-User-Sub': 'auth0|owner', 'X-Forwarded-User': 'auth0|owner' } });
      assert.equal(r.status, 401);
      assert.doesNotMatch(await r.text(), /Maple|Cedar/);
    });
    let alice;
    await t.test('valid signed login uses PKCE, state, nonce and a fixed return URL', async () => {
      const result = await login('auth0|alice');
      alice = result.client;
      assert.equal(result.callback.status, 302);
      assert.equal(new URL(result.callback.headers.get('location'), url).pathname, '/projects');
      const observed = provider.observed.at(-1);
      assert.equal(observed.code_challenge_method, 'S256');
      assert.ok(observed.state && observed.nonce && observed.code_challenge);
      const session = result.callback.headers.getSetCookie().find(c => c.startsWith('afz_engineering_session='));
      assert.match(session, /HttpOnly/i); assert.match(session, /SameSite=Lax/i);
      assert.doesNotMatch(session, /auth0\|alice|test-only-access-token/);
    });
    await t.test('client sees exactly its assigned project', async () => {
      const r = await alice.request(url + '/api/projects');
      assert.equal(r.status, 200);
      assert.deepEqual((await r.json()).projects.map(p => p.id), ['sample-a']);
      const page = await alice.request(url + '/projects');
      const html = await page.text();
      assert.match(html, /Maple House/); assert.doesNotMatch(html, /Cedar House/);
      assert.equal(page.headers.get('cache-control'), 'no-store');
    });
    await t.test('direct API, HTML and query-string attempts cannot open another project', async () => {
      for (const path of ['/api/projects/sample-b?sub=auth0%7Cowner', '/projects/sample-b', '/api/projects/unknown']) {
        const r = await alice.request(url + path);
        assert.equal(r.status, 404); assert.doesNotMatch(await r.text(), /Cedar House|equipment assumptions/);
      }
    });
    await t.test('second user sees only its own assignment', async () => {
      const { client, callback } = await login('auth0|bob');
      assert.equal(callback.status, 302);
      assert.deepEqual((await (await client.request(url + '/api/projects')).json()).projects.map(p => p.id), ['sample-b']);
      assert.equal((await client.request(url + '/api/projects/sample-a')).status, 404);
    });
    await t.test('administrator also needs explicit project assignments', async () => {
      const { client } = await login('auth0|owner');
      assert.equal((await (await client.request(url + '/api/projects')).json()).projects.length, 2);
      save({ ...members, 'auth0|owner': { role: 'admin', projects: [] } });
      assert.equal((await (await client.request(url + '/api/projects')).json()).projects.length, 0);
      save(members);
    });
    await t.test('authenticated but unassigned accounts are denied', async () => {
      const { client } = await login('auth0|outsider');
      assert.equal((await client.request(url + '/api/projects')).status, 403);
    });
    await t.test('membership removal revokes access in an existing session', async () => {
      save({ ...members, 'auth0|alice': { role: 'client', projects: [] } });
      assert.equal((await alice.request(url + '/api/projects/sample-a')).status, 404);
      save({});
      assert.equal((await alice.request(url + '/api/projects')).status, 403);
      save(members);
    });
    await t.test('malformed or overly readable access files fail closed', async () => {
      writeFileSync(file, '{broken');
      assert.equal((await alice.request(url + '/api/projects')).status, 503);
      save(members); chmodSync(file, 0o644);
      assert.equal((await alice.request(url + '/api/projects')).status, 503);
      chmodSync(file, 0o600);
    });
    await t.test('forged session cookies are rejected', async () => {
      const client = browser(); client.cookies.set('afz_engineering_session', 'forged');
      assert.equal((await client.request(url + '/api/projects')).status, 401);
    });
    await t.test('callbacks without a valid transaction are rejected without leaking input', async () => {
      const r = await fetch(url + '/callback?code=private-marker&state=forged');
      assert.ok(r.status >= 400); assert.doesNotMatch(await r.text(), /private-marker|forged/);
    });
    await t.test('wrong signing key cannot establish an authenticated session', async () => {
      provider.setBadSignature(true);
      const { client, callback } = await login('auth0|alice');
      assert.ok(callback.status >= 400);
      assert.equal((await client.request(url + '/api/projects')).status, 401);
      provider.setBadSignature(false);
    });
    await t.test('wrong nonce cannot establish an authenticated session', async () => {
      provider.setWrongNonce(true);
      const { client, callback } = await login('auth0|alice');
      assert.ok(callback.status >= 400);
      assert.equal((await client.request(url + '/api/projects')).status, 401);
      provider.setWrongNonce(false);
    });
    await t.test('logout fixes its destination and clears the local session', async () => {
      const r = await alice.request(url + '/logout?returnTo=https://evil.example');
      assert.equal(r.status, 302);
      assert.doesNotMatch(r.headers.get('location'), /evil\.example/);
      assert.equal((await alice.request(url + '/api/projects')).status, 401);
    });
  } finally {
    await close(server); await provider.close(); rmSync(directory, { recursive: true });
  }
});
