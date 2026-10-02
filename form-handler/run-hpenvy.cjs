'use strict';
const path = require('node:path');
// systemd supplies a private, read-only credential copy on this host.
const credentialDirectory = process.env.CREDENTIALS_DIRECTORY;
if (!credentialDirectory) throw new Error('Private service credential directory is required');
process.loadEnvFile(path.join(credentialDirectory, 'mail.env'));
// Pin production transport after loading the recovered mail-only settings.
Object.assign(process.env, {BIND_HOST:'127.0.0.1', GATEWAY_IP:'127.0.0.1', PORT:'8510'});
const app = require('./server.js');
const server = app.listen(8510, '127.0.0.1', () => {
  console.log(JSON.stringify({event:'listening', host:'127.0.0.1', port:8510, deployment:'hpenvy-local-r1'}));
});
server.requestTimeout = 35000;
server.headersTimeout = 10000;
server.on('error', error => {
  console.error(JSON.stringify({event:'startup_error', code:error.code}));
  process.exit(1);
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  console.log(JSON.stringify({event:'graceful_stop'}));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 40000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
