/**
 * AFZ Engineering — contact form handler
 * Receives the website contact form and sends it to your Microsoft 365 mailbox
 * using OAuth 2.0 + Microsoft Graph (no basic auth, no app passwords).
 */
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
// Only the HP Envy edge is trusted to supply a visitor IP.
const GATEWAY_IP = process.env.GATEWAY_IP || '100.71.26.69';
const HOST = process.env.BIND_HOST || '127.0.0.1';
const normalizeIp = ip => String(ip || '').replace(/^::ffff:/, '');
app.disable('x-powered-by');
app.set('trust proxy', ip => normalizeIp(ip) === GATEWAY_IP);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const peer = normalizeIp(req.socket.remoteAddress);
  const health = req.method === 'GET' && req.path === '/api/health';
  if (peer !== GATEWAY_IP && !(health && [HOST, '127.0.0.1', '::1'].includes(peer))) {
    return res.status(403).json({ok:false,error:'Forbidden'});
  }
  const origin = req.get('Origin');
  if (origin && !['https://afzeng.ca','https://www.afzeng.ca'].includes(origin)) {
    return res.status(403).json({ok:false,error:'Invalid origin'});
  }
  next();
});
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));

const {
  TENANT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  MAIL_FROM,          // mailbox that sends, e.g. info@afzengineering.ca
  MAIL_TO,            // where enquiries land (can be the same)
  PORT = 3000
} = process.env;

for (const k of ['TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET', 'MAIL_FROM', 'MAIL_TO']) {
  if (!process.env[k]) throw new Error(`Missing required configuration: ${k}`);
}

/* ---------- token cache ---------- */
let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(12000),
    body
  });

  if (!res.ok) {
    await res.arrayBuffer();
    throw new Error(`token request failed (${res.status})`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

/* ---------- helpers ---------- */
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const clean = (s = '', max = 4000) => typeof s === 'string' ? s.trim().slice(0, max) : '';

const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/* ---------- rate limit: 5 submissions / 15 min / IP ---------- */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many submissions. Please try again later.' }
});

/* ---------- health check ---------- */
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'afz-contact', revision: '20261002-r1', mail_configured: true }));

/* ---------- contact endpoint ---------- */
app.post('/api/contact', limiter, async (req, res) => {
  let sendAttempted = false;
  try {
    const b = req.body || {};
    if (Array.isArray(b) || typeof b !== 'object') return res.status(400).json({ok:false,error:'Invalid request body.'});

    // Honeypot: bots fill hidden fields. Humans never see it.
    if (b.company) return res.json({ ok: true });

    const name = clean(b.name, 120);
    const email = clean(b.email, 160);
    const phone = clean(b.phone, 60);
    const projectType = clean(b.project_type, 120);
    const services = clean(b.services, 160);
    const location = clean(b.location, 160);
    const message = clean(b.message, 4000);

    // AFZ LEAD SOURCE TRACKING
    const requestedLeadSource = clean(b.lead_source, 40);
    const leadSource =
      requestedLeadSource === 'AFZ AI'
        ? 'AFZ AI'
        : 'Website';

    if (!name || !email) {
      return res.status(400).json({ ok: false, error: 'Name and email are required.' });
    }
    if (!validEmail(email)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    }

    const rows = [
      ['Lead source', leadSource],
      ['Name', name],
      ['Email', email],
      ['Phone', phone],
      ['Project type', projectType],
      ['Services needed', services],
      ['Location', location]
    ]
      .filter(([, v]) => v)
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 14px 6px 0;color:#53657A;font-size:13px;white-space:nowrap">${k}</td>
               <td style="padding:6px 0;color:#16283B;font-size:14px"><b>${esc(v)}</b></td></tr>`
      )
      .join('');

    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px">
        <div style="background:#22548F;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.75">AFZ Engineering — website</div>
          <div style="font-size:19px;font-weight:700;margin-top:2px">New project enquiry</div>
        </div>
        <div style="border:1px solid #E3E9EF;border-top:0;border-radius:0 0 10px 10px;padding:20px">
          <table style="border-collapse:collapse;margin-bottom:16px">${rows}</table>
          ${
            message
              ? `<div style="color:#53657A;font-size:12px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Project details</div>
                 <div style="background:#F5F8FB;border:1px solid #E3E9EF;border-radius:8px;padding:14px;color:#16283B;font-size:14px;white-space:pre-wrap">${esc(message)}</div>`
              : ''
          }
          <div style="margin-top:18px;font-size:12px;color:#8496A6">
            Reply directly to this email to respond to ${esc(name)}.
          </div>
        </div>
      </div>`;

    const token = await getToken();

    sendAttempted = true;
    const graphRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MAIL_FROM)}/sendMail`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(18000),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            subject: `${leadSource} enquiry — ${name}${projectType ? ` (${projectType})` : ''}`,
            body: { contentType: 'HTML', content: html },
            toRecipients: [{ emailAddress: { address: MAIL_TO } }],
            replyTo: [{ emailAddress: { address: email, name } }]
          },
          saveToSentItems: true
        })
      }
    );

    if (graphRes.status !== 202) {
      await graphRes.arrayBuffer();
      console.error('[graph rejected]', graphRes.status);
      return res
        .status(502)
        .json({ ok: false, error: 'Could not send your message right now. Please try again shortly.' });
    }

    console.log(JSON.stringify({event:'mail_accepted',lead_source:leadSource,at:new Date().toISOString()}));
    return res.json({ ok: true });
  } catch (err) {
    console.error(JSON.stringify({event:'delivery_error',type:err.name,send_attempted:sendAttempted,at:new Date().toISOString()}));
    return res
      .status(sendAttempted ? 504 : 502)
      .json({ ok: false, error: sendAttempted ? 'Delivery could not be confirmed. Please email design@afzeng.ca or call 647-812-4119 before trying again.' : 'Your enquiry was not sent. Please email design@afzeng.ca or call 647-812-4119.' });
  }
});

app.all('/api/contact', (_req,res) => res.set('Allow','POST').status(405).json({ok:false,error:'POST required.'}));
app.use((err,_req,res,_next) => res.status(err.status === 413 ? 413 : 400).json({ok:false,error:err.status === 413 ? 'Request too large.' : 'Invalid request.'}));
if (require.main === module) {
  const server = app.listen(PORT, HOST, () => console.log(JSON.stringify({event:'listening',host:HOST,port:Number(PORT)})));
  server.requestTimeout = 35000;
  server.headersTimeout = 10000;
}
module.exports = app;
