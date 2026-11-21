import { createApp } from './app.mjs';
import { loadConfiguration } from './config.mjs';

const port = Number(process.env.PILOT_PORT || 19870);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PILOT_PORT must be between 1024 and 65535');
const configuration = loadConfiguration();
createApp(configuration).listen(port, '127.0.0.1', () => {
  console.log(`AFZ Engineering Auth0 pilot: loopback port ${port}; ${configuration.ready ? 'configured; tenant sign-in not yet verified' : 'awaiting private Auth0 configuration'}`);
});
