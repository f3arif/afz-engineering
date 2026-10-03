'use strict';
// Authentication-only check. Never calls a mail-sending endpoint.
const path = require('node:path');
async function main() {
  const file = process.env.AFZ_CONTACT_ENV_FILE || path.join(process.env.CREDENTIALS_DIRECTORY || '', 'mail.env');
  process.loadEnvFile(file);
  const keys = ['TENANT_ID','CLIENT_ID','CLIENT_SECRET','MAIL_FROM','MAIL_TO'];
  if (!keys.every(key => process.env[key])) throw new Error('Missing configuration');
  const body = new URLSearchParams({grant_type:'client_credentials', client_id:process.env.CLIENT_ID,
    client_secret:process.env.CLIENT_SECRET, scope:'https://graph.microsoft.com/.default'});
  const url = 'https://login.microsoftonline.com/' + encodeURIComponent(process.env.TENANT_ID) + '/oauth2/v2.0/token';
  const response = await fetch(url, {method:'POST',body,signal:AbortSignal.timeout(12000)});
  if (!response.ok) {
    await response.arrayBuffer();
    console.log(JSON.stringify({token_http_status:response.status,token_obtained:false,mail_sent:false}));
    process.exitCode=1; return;
  }
  const result=await response.json();
  const claims=JSON.parse(Buffer.from(result.access_token.split('.')[1],'base64url').toString('utf8'));
  const mailSend=(claims.roles || []).includes('Mail.Send');
  const route=process.env.MAIL_FROM==='design@afzeng.ca' && process.env.MAIL_TO==='faiz@afzeng.ca';
  console.log(JSON.stringify({token_http_status:response.status,token_obtained:true,mail_send_permission:mailSend,
    original_mail_route_preserved:route,mail_sent:false,secrets_displayed:false}));
  if (!mailSend || !route) process.exitCode=1;
}
main().catch(error=>{console.log(JSON.stringify({check_failed:true,error_type:error.name,mail_sent:false,secrets_displayed:false}));process.exitCode=1;});
