import assert from 'node:assert/strict';
import { createApp } from '../app.mjs';
import { loadConfiguration } from '../config.mjs';

const config = loadConfiguration();
assert.equal(config.ready, true, 'Private Auth0 configuration is not ready');
const issuer = new URL(config.oidc.issuerBaseURL);
const discoveryResponse = await fetch(issuer.origin + '/.well-known/openid-configuration');
assert.equal(discoveryResponse.status, 200, 'Tenant discovery is unavailable');
const discovery = await discoveryResponse.json();
assert.equal(new URL(discovery.issuer).origin, issuer.origin);
assert.ok(discovery.id_token_signing_alg_values_supported.includes('RS256'));
const keyResponse = await fetch(issuer.origin + '/.well-known/jwks.json');
assert.equal(keyResponse.status, 200, 'Tenant signing keys are unavailable');
const keys = await keyResponse.json();
assert.ok(keys.keys.length > 0);
const result = {
  checkedAtUTC: new Date().toISOString(),
  tenant: issuer.hostname,
  configurationReady: true,
  discoveryVerified: true,
  signingKeyCount: keys.keys.length,
  realUserSessionVerified: false
};
const server = await new Promise(resolve => {
  const s = createApp(config).listen(0, '127.0.0.1', () => resolve(s));
});
try {
  const local = 'http://127.0.0.1:' + server.address().port;
  const response = await fetch(local + '/login?returnTo=https://invalid.example', {
    redirect: 'manual', headers: { 'X-Forwarded-Proto': 'https' }
  });
  assert.equal(response.status, 302);
  const authorize = new URL(response.headers.get('location'));
  assert.equal(authorize.origin, issuer.origin);
  assert.equal(authorize.searchParams.get('client_id'), config.oidc.clientID);
  assert.equal(authorize.searchParams.get('redirect_uri'), config.baseURL + '/callback');
  assert.equal(authorize.searchParams.get('response_type'), 'code');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(authorize.searchParams.get('state') && authorize.searchParams.get('nonce'));
  const transactionCookies = response.headers.getSetCookie();
  assert.ok(transactionCookies.length > 0 && transactionCookies.every(c => /; Secure/i.test(c)));
  result.authorizationCodeAndPKCE = true;
  result.secureTransactionCookies = true;
  result.exactCallback = config.baseURL + '/callback';
  const jar = new Map();
  let cursor = authorize, reachedLogin = false;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(cursor, {
      redirect: 'manual',
      headers: { Cookie: [...jar].map(([k,v]) => k+'='+v).join('; '),
        'User-Agent': 'AFZ-Engineering-Pilot-Connection-Check' }
    });
    for (const cookie of r.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], at = pair.indexOf('=');
      if (at > 0) jar.set(pair.slice(0, at), pair.slice(at+1));
    }
    const next = r.headers.get('location');
    if (!next) {
      assert.equal(r.status, 200, 'Tenant sign-in page did not load');
      assert.ok((r.headers.get('content-type') || '').includes('html'));
      reachedLogin = true;
      result.tenantLoginPageStatus = r.status;
      break;
    }
    const target = new URL(next, cursor);
    assert.equal(target.origin, issuer.origin, 'Unexpected redirect outside configured tenant');
    cursor = target;
  }
  assert.ok(reachedLogin, 'Tenant sign-in page was not reached within six redirects');
  const api = await fetch(local + '/api/projects');
  assert.equal(api.status, 401);
  result.anonymousAPIStatus = api.status;
  // Do not emit private settings, tokens, cookies, state, nonce or login URLs.
  console.log(JSON.stringify(result, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
}
