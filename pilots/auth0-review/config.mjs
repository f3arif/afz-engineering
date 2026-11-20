import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';

export const privateDirectory = join(homedir(), '.config', 'afz-engineering-auth0');

function origin(value, allowLoopback = false) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('origin');
  if (url.protocol !== 'https:' && !(allowLoopback && local && url.protocol === 'http:')) throw Error('https');
  return url.origin;
}

export function loadConfiguration(env = process.env) {
  let saved = {};
  const file = env.PILOT_CONFIG_FILE || join(privateDirectory, 'settings.json');
  try {
    if ((statSync(file).mode & 0o077) !== 0) throw Error('private permissions');
    saved = JSON.parse(readFileSync(file, 'utf8'));
    if (!saved || Array.isArray(saved) || typeof saved !== 'object') throw Error('configuration shape');
  } catch (error) {
    if (error.code !== 'ENOENT') return { ready: false, issues: ['Private configuration is invalid or not owner-only.'] };
  }
  const get = key => env[key] ?? saved[key];
  const issues = [];
  const values = {};
  for (const key of ['AUTH0_ISSUER_BASE_URL', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_SESSION_SECRET', 'PILOT_BASE_URL']) {
    values[key] = get(key);
    if (typeof values[key] !== 'string' || !values[key].trim()) issues.push(key);
  }
  if (issues.length) return { ready: false, issues };
  try {
    values.AUTH0_ISSUER_BASE_URL = origin(values.AUTH0_ISSUER_BASE_URL);
    values.PILOT_BASE_URL = origin(values.PILOT_BASE_URL, true);
  } catch { return { ready: false, issues: ['Use an HTTPS issuer and an HTTPS application origin (HTTP is allowed only on loopback).'] }; }
  if (!/^[a-f0-9]{64,}$/i.test(values.AUTH0_SESSION_SECRET)) return { ready: false, issues: ['AUTH0_SESSION_SECRET must contain at least 32 random bytes encoded as hex.'] };
  const membershipFile = get('PILOT_MEMBERSHIPS_FILE') || join(privateDirectory, 'memberships.json');
  if (!isAbsolute(membershipFile)) return { ready: false, issues: ['PILOT_MEMBERSHIPS_FILE must be an absolute path.'] };
  return {
    ready: true,
    baseURL: values.PILOT_BASE_URL,
    membershipFile,
    oidc: {
      issuerBaseURL: values.AUTH0_ISSUER_BASE_URL,
      clientID: values.AUTH0_CLIENT_ID,
      clientSecret: values.AUTH0_CLIENT_SECRET,
      secret: values.AUTH0_SESSION_SECRET
    }
  };
}

export function readMemberships(file) {
  const info = statSync(file);
  if ((info.mode & 0o077) !== 0 || info.size > 256000) throw Error('membership file');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (!data || Array.isArray(data) || typeof data !== 'object') throw Error('membership shape');
  for (const [sub, entry] of Object.entries(data)) {
    if (!sub || !entry || !['admin', 'reviewer', 'client'].includes(entry.role) || !Array.isArray(entry.projects) || entry.projects.some(p => typeof p !== 'string')) throw Error('membership entry');
  }
  return data;
}
