import express from 'express';
import helmet from 'helmet';
import { auth } from 'express-openid-connect';
import { readFileSync } from 'node:fs';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { readMemberships } from './config.mjs';

// Synthetic, read-only data. Real drawings and the hosted HVAC workspace are not connected.
const projects = [
  { id: 'sample-a', name: 'Maple House', label: 'Sample project A', status: 'HOLD FINAL ISSUE', nextAction: 'Reconcile the room loads with the supply schedule.', items: [
    { sheet: 'M-101', title: 'Ground-floor supply and return', state: 'needs-recheck', note: 'Confirm grille locations against the architectural reference points.' },
    { sheet: 'M-102', title: 'Basement duct routing', state: 'untested', note: 'Record elevations and crossings before accepting the route.' }
  ] },
  { id: 'sample-b', name: 'Cedar House', label: 'Sample project B', status: 'HOLD FINAL ISSUE', nextAction: 'Confirm the equipment assumptions against the calculated load.', items: [
    { sheet: 'M-201', title: 'Equipment review', state: 'blocked', note: 'Sample evidence only; equipment selection remains unapproved.' }
  ] }
];
const style = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · AFZ Engineering</title><link rel="stylesheet" href="/style.css"></head><body><header><a class="brand" href="/">AFZ <span>Engineering</span></a><span class="tag">Access pilot</span></header><main>${body}</main><footer>AFZ Engineering · Synthetic projects · HOLD FINAL ISSUE</footer></body></html>`;
const card = p => `<a class="project" href="/projects/${encodeURIComponent(p.id)}"><small>${esc(p.label)}</small><h2>${esc(p.name)}</h2><span class="hold">${esc(p.status)}</span><p>${esc(p.nextAction)}</p><strong>Open review</strong></a>`;

export function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  // Backend binds only to loopback. Trust only a local TLS reverse proxy.
  app.set('trust proxy', 'loopback');
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], styleSrc: ["'self'"], baseUri: ["'none'"], formAction: ["'self'"], frameAncestors: ["'none'"] } } }));
  app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/style.css', (req, res) => res.type('css').send(style));
  app.get('/healthz', (req, res) => res.status(config.ready ? 200 : 503).json({ service: 'AFZ Engineering Auth0 pilot', status: config.ready ? 'configured' : 'needs-configuration', realTenantVerified: false }));
  if (!config.ready) {
    app.get('/', (req, res) => res.send(page('Connect your AFZ account', `<section class="intro"><p class="eyebrow">PRIVATE DRAWING REVIEW</p><h1>One account.<br>Only your projects.</h1><p>Sign in to review assigned drawings, evidence and coordination decisions.</p></section><section class="setup"><span class="hold">Awaiting Auth0 connection</span><h2>The pilot is prepared.</h2><p>An Auth0 application must be connected before sign-in is available. Project pages and APIs remain locked.</p><p class="muted">No real drawings are loaded in this pilot.</p></section>`)));
    app.use((req, res) => res.status(503).json({ error: 'authentication_not_configured' }));
    return app;
  }
  const signingKeys = createRemoteJWKSet(new URL('/.well-known/jwks.json', config.oidc.issuerBaseURL), { timeoutDuration: 5000 });
  app.use(auth({
    ...config.oidc, baseURL: config.baseURL, authRequired: false,
    auth0Logout: true, idpLogout: true,
    authorizationParams: { response_type: 'code', response_mode: 'query', scope: 'openid profile email' },
    routes: { login: false, logout: false, callback: '/callback' },
    session: { name: 'afz_engineering_session', rolling: true, rollingDuration: 3600, absoluteDuration: 28800, cookie: { httpOnly: true, secure: config.baseURL.startsWith('https:'), sameSite: 'Lax' } },
    legacySameSiteCookie: false, httpTimeout: 5000,
    enableTelemetry: false,
    // The code flow can rely on the authenticated token endpoint instead of
    // checking a JWS signature. Enforce RS256 verification before saving a session.
    afterCallback: async (req, res, session) => {
      await jwtVerify(session.id_token, signingKeys, {
        issuer: [config.oidc.issuerBaseURL, config.oidc.issuerBaseURL + '/'],
        audience: config.oidc.clientID, algorithms: ['RS256']
      });
      return session;
    }
  }));
  // Fixed destinations: query strings cannot turn these into open redirects.
  app.get('/login', (req, res) => res.oidc.login({ returnTo: '/projects' }));
  app.get('/logout', (req, res) => res.oidc.logout({ returnTo: config.baseURL + '/' }));
  app.get('/', (req, res) => res.send(page('Project access', `<section class="intro"><p class="eyebrow">PRIVATE DRAWING REVIEW</p><h1>One account.<br>Only your projects.</h1><p>Review assigned drawings and coordination evidence in a protected workspace.</p><a class="button" href="${req.oidc.isAuthenticated() ? '/projects' : '/login'}">${req.oidc.isAuthenticated() ? 'Open assigned projects' : 'Sign in with Auth0'}</a></section><section class="setup"><h2>A clear review boundary</h2><p>Access is assigned per project. All sample projects remain on hold for final issue.</p><p class="muted">Synthetic data · Read-only pilot</p></section>`)));
  app.use((req, res, next) => {
    if (!req.oidc.isAuthenticated()) {
      if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'sign_in_required' });
      return res.redirect('/login');
    }
    try {
      const memberships = readMemberships(config.membershipFile);
      const sub = req.oidc.user?.sub;
      req.member = typeof sub === 'string' && Object.hasOwn(memberships, sub) ? memberships[sub] : undefined;
    } catch { return res.status(503).json({ error: 'project_access_unavailable' }); }
    if (!req.member) return res.status(403).send(page('Access not assigned', '<h1>Access is not assigned.</h1><p>Contact the project administrator to request access.</p><a href="/logout">Sign out</a>'));
    next();
  });
  const visible = req => projects.filter(p => req.member.projects.includes(p.id));
  const allowedProject = (req, res, next) => {
    req.project = visible(req).find(p => p.id === req.params.id);
    if (!req.project) return res.status(404).json({ error: 'project_not_found' });
    next();
  };
  app.get('/api/projects', (req, res) => res.json({ projects: visible(req).map(({ items, ...summary }) => summary) }));
  app.get('/api/projects/:id', allowedProject, (req, res) => res.json(req.project));
  app.get('/projects', (req, res) => res.send(page('Assigned projects', `<div class="toolbar"><span>Signed in · ${esc(req.member.role)}</span><a href="/logout">Sign out</a></div><p class="eyebrow">YOUR WORKSPACE</p><h1>Assigned projects</h1><p class="muted">Only projects granted to this account appear here.</p><div class="projects">${visible(req).map(card).join('') || '<p>No projects are assigned.</p>'}</div>`)));
  app.get('/projects/:id', allowedProject, (req, res) => res.send(page(req.project.name, `<div class="toolbar"><a href="/projects">All assigned projects</a><a href="/logout">Sign out</a></div><p class="eyebrow">${esc(req.project.label)}</p><h1>${esc(req.project.name)}</h1><span class="hold">${esc(req.project.status)}</span><h2>Next action</h2><p>${esc(req.project.nextAction)}</p><div class="sheets">${req.project.items.map(i => `<article><small>${esc(i.sheet)}</small><h2>${esc(i.title)}</h2><span class="state">${esc(i.state)}</span><p>${esc(i.note)}</p></article>`).join('')}</div><p class="muted">Sample records only. This pilot cannot issue drawings, approve equipment or edit source evidence.</p>`)));
  app.use((req, res) => res.status(404).json({ error: 'not_found' }));
  // Avoid reflecting OAuth errors, tokens, callback query strings or configuration.
  app.use((error, req, res, next) => { res.status(error.status >= 400 && error.status < 500 ? error.status : 503).json({ error: 'authentication_failed' }); });
  return app;
}
