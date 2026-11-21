// Test-only OIDC provider. Not imported by the application or server entrypoint.
import express from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

export async function createProvider() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const app = express();
  const codes = new Map();
  const observed = [];
  let subject = 'auth0|alice';
  let issuer;
  let corruptSignature = false;
  let wrongNonce = false;
  app.use(express.urlencoded({ extended: false }));
  app.get('/.well-known/openid-configuration', (req, res) => res.json({
    issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token', jwks_uri: issuer + '/.well-known/jwks.json',
    end_session_endpoint: issuer + '/logout', response_types_supported: ['code'], response_modes_supported: ['query'],
    subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic'], code_challenge_methods_supported: ['S256']
  }));
  app.get('/.well-known/jwks.json', (req, res) => res.json({ keys: [jwk] }));
  app.get('/authorize', (req, res) => {
    observed.push({ ...req.query });
    const code = randomBytes(24).toString('hex');
    codes.set(code, { subject, ...req.query, corruptSignature, wrongNonce });
    const target = new URL(req.query.redirect_uri);
    target.searchParams.set('code', code);
    target.searchParams.set('state', req.query.state);
    res.redirect(target.href);
  });
  app.post('/token', async (req, res) => {
    const transaction = codes.get(req.body.code);
    codes.delete(req.body.code);
    const encoded = (req.get('Authorization') || '').replace(/^Basic /i, '');
    const credentials = Buffer.from(encoded, 'base64').toString().split(':').map(decodeURIComponent);
    if (!transaction || credentials[0] !== 'pilot-client' || credentials[1] !== 'pilot-secret' || req.body.grant_type !== 'authorization_code' || req.body.redirect_uri !== transaction.redirect_uri) return res.status(400).json({ error: 'invalid_grant' });
    const challenge = createHash('sha256').update(req.body.code_verifier || '').digest('base64url');
    if (!transaction.code_challenge || transaction.code_challenge_method !== 'S256' || challenge !== transaction.code_challenge) return res.status(400).json({ error: 'invalid_grant' });
    const key = transaction.corruptSignature ? (await generateKeyPair('RS256')).privateKey : privateKey;
    const token = await new SignJWT({ nonce: transaction.wrongNonce ? 'invalid-nonce' : transaction.nonce })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer(issuer).setAudience('pilot-client')
      .setSubject(transaction.subject).setIssuedAt().setExpirationTime('5m').sign(key);
    res.json({ access_token: 'test-only-access-token', token_type: 'Bearer', expires_in: 300, id_token: token });
  });
  const logout = (req, res) => res.redirect(req.query.post_logout_redirect_uri || req.query.returnTo || issuer + '/');
  app.get('/logout', logout);
  app.get('/v2/logout', logout);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  issuer = 'http://127.0.0.1:' + server.address().port;
  return { issuer, observed, setSubject(value) { subject = value; }, setBadSignature(value) { corruptSignature = value; }, setWrongNonce(value) { wrongNonce = value; }, close: () => new Promise(resolve => server.close(resolve)) };
}

export function browser() {
  const cookies = new Map();
  return {
    cookies,
    async request(url, headers = {}) {
      const response = await fetch(url, { redirect: 'manual', headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...headers } });
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(';');
        const split = pair.indexOf('=');
        const key = pair.slice(0, split), value = pair.slice(split + 1);
        if (!value || /Max-Age=0/i.test(cookie)) cookies.delete(key); else cookies.set(key, value);
      }
      return response;
    }
  };
}
