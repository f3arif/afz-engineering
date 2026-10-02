'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'run-hpenvy.cjs'),'utf8');
function boot(directory='/private-test') {
  const r={signals:{},events:{},logs:[],env:{CREDENTIALS_DIRECTORY:directory}};
  const server={on:(name,fn)=>r.events[name]=fn,close:fn=>{r.closed=true;fn();}};
  const process={env:r.env,loadEnvFile:p=>{r.loaded=p;Object.assign(r.env,{PORT:'9000',BIND_HOST:'0.0.0.0',GATEWAY_IP:'remote'});},
    on:(name,fn)=>r.signals[name]=fn,exit:code=>r.exit=code};
  const app={listen:(port,host,fn)=>{r.listen={port,host};fn();return server;}};
  vm.runInNewContext(code,{process,require:name=>name==='node:path'?path:app,
    console:{log:x=>r.logs.push(x),error:x=>r.logs.push(x)},setTimeout:()=>({unref(){}})});
  return r;
}
test('HP launcher requires a service-private credential directory',()=>assert.throws(()=>boot(''),/credential directory/));
test('HP launcher pins loopback and its local gateway after loading config',()=>{const r=boot();assert.equal(r.listen.host,'127.0.0.1');assert.equal(r.listen.port,8510);assert.equal(r.env.GATEWAY_IP,'127.0.0.1');});
test('HP launcher loads only the named local service credential',()=>assert.equal(boot().loaded,'/private-test/mail.env'));
test('HP launcher gracefully closes connections on shutdown',()=>{const r=boot();r.signals.SIGTERM();assert.equal(r.closed,true);assert.equal(r.exit,0);});
test('HP startup errors log code without sensitive message',()=>{const r=boot();r.events.error({code:'EADDRINUSE',message:'SECRET_SENTINEL'});assert.equal(r.exit,1);assert.equal(r.logs.join('').includes('SECRET_SENTINEL'),false);});
test('HP service has local credentials, boot startup and failure recovery',()=>{
 const unit=fs.readFileSync(path.join(__dirname,'afz-contact-handler.service'),'utf8');
 assert.match(unit,/LoadCredential=mail.env:\/home\/coolyo\/\.afz\/contact-handler\/private\/form-handler.env/);
 assert.match(unit,/Restart=on-failure/);assert.match(unit,/WantedBy=default.target/);
 assert.equal(/100\.106\.|I:\\|EnvironmentFile=/.test(unit),false);
});
