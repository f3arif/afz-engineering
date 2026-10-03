const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
Object.assign(process.env,{TENANT_ID:'test',CLIENT_ID:'test',CLIENT_SECRET:'test',MAIL_FROM:'sender@example.test',MAIL_TO:'fixed@example.test',GATEWAY_IP:'127.0.0.1',BIND_HOST:'127.0.0.1'});
let mode='ok', calls=[],sequence=0;
global.fetch=async(url,options)=>{
  calls.push({url,options});
  if(url.startsWith('https://login.microsoftonline.com/')){
    if(mode==='tokenfail') return new Response('{}',{status:401});
    return new Response(JSON.stringify({access_token:'mock-only',expires_in:3600}),{status:200});
  }
  assert.ok(url.startsWith('https://graph.microsoft.com/v1.0/users/'));
  if(mode==='timeout') {const e=new Error('mock timeout');e.name='TimeoutError';throw e;}
  return new Response(null,{status:mode==='reject'?403:202});
};
const app=require('./server.js');
const server=app.listen(0,'127.0.0.1');
after(()=>new Promise(resolve=>server.close(resolve)));
async function request(body={},extra={}) {
  if(!server.listening) await new Promise(resolve=>server.once('listening',resolve));
  const raw=extra.raw!==undefined?extra.raw:JSON.stringify(body);
  return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:server.address().port,path:extra.path||'/api/contact',method:extra.method||'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw),'X-Forwarded-For':extra.ip||`192.0.2.${++sequence}`,...extra.headers}},res=>{
      let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text),headers:res.headers}));
    });req.on('error',reject);req.end(raw);
  });
}
const valid={name:'Review Test',email:'visitor@example.test',message:'Test only'};
test('health exposes no mail credentials',async()=>{const r=await request({}, {method:'GET',path:'/api/health'});assert.equal(r.status,200);assert.equal(r.body.service,'afz-contact');assert.equal(JSON.stringify(r.body).includes('CLIENT'),false);});
test('missing fields rejected before any mail call',async()=>{const before=calls.length;assert.equal((await request({})).status,400);assert.equal(calls.length,before);});
test('invalid email rejected',async()=>assert.equal((await request({...valid,email:'bad'})).status,400));
test('object name rejected',async()=>assert.equal((await request({...valid,name:{x:1}})).status,400));
test('array body rejected',async()=>assert.equal((await request([])).status,400));
test('malformed JSON returns structured error',async()=>{const r=await request({}, {raw:'{'});assert.equal(r.status,400);assert.equal(r.body.ok,false);});
test('oversized body rejected',async()=>assert.equal((await request({...valid,message:'x'.repeat(34000)})).status,413));
test('cross-origin submissions rejected',async()=>assert.equal((await request(valid,{headers:{Origin:'https://not-afz.example'}})).status,403));
test('GET contact is method-not-allowed',async()=>{const r=await request({}, {method:'GET'});assert.equal(r.status,405);assert.equal(r.headers.allow,'POST');});
test('honeypot does not send mail',async()=>{const before=calls.length;assert.equal((await request({...valid,company:'bot'})).status,200);assert.equal(calls.length,before);});
test('token failure reports unsent',async()=>{mode='tokenfail';const r=await request(valid);assert.equal(r.status,502);assert.match(r.body.error,/not sent/);mode='ok';});
test('Graph rejection cannot produce success',async()=>{mode='reject';const r=await request(valid);assert.equal(r.status,502);assert.equal(r.body.ok,false);mode='ok';});
test('valid form accepted and fixed recipient preserved',async()=>{const r=await request({...valid,to:'attacker@example.test'});assert.equal(r.status,200);assert.equal(r.body.ok,true);const message=JSON.parse(calls.at(-1).options.body);assert.equal(message.message.toRecipients[0].emailAddress.address,'fixed@example.test');assert.equal(message.message.replyTo[0].emailAddress.address,valid.email);assert.equal(message.saveToSentItems,true);});
test('AI lead source and qualification included',async()=>{await request({...valid,lead_source:'AFZ AI',project_type:'Renovation',services:'HVAC',location:'Toronto'});const m=JSON.parse(calls.at(-1).options.body).message;assert.match(m.subject,/^AFZ AI enquiry/);assert.match(m.body.content,/HVAC/);assert.match(m.body.content,/Toronto/);});
test('untrusted lead source normalized',async()=>{await request({...valid,lead_source:'anything'});assert.match(JSON.parse(calls.at(-1).options.body).message.subject,/^Website enquiry/);});
test('HTML from visitors is escaped',async()=>{await request({...valid,message:'<script>alert(1)</script>'});const html=JSON.parse(calls.at(-1).options.body).message.body.content;assert.equal(html.includes('<script>'),false);assert.match(html,/&lt;script&gt;/);});
test('send timeout is uncertain and never retried automatically',async()=>{mode='timeout';const before=calls.length;const r=await request(valid);assert.equal(r.status,504);assert.match(r.body.error,/could not be confirmed/);assert.equal(calls.length,before+1);mode='ok';});
test('responses are not cacheable',async()=>assert.equal((await request({})).headers['cache-control'],'no-store'));
test('express identification header disabled',async()=>assert.equal((await request({})).headers['x-powered-by'],undefined));
test('rate limit returns structured 429',async()=>{for(let i=0;i<5;i++)assert.equal((await request({}, {ip:'198.51.100.100'})).status,400);const r=await request({}, {ip:'198.51.100.100'});assert.equal(r.status,429);assert.equal(r.body.ok,false);});
