const fs=require('node:fs');
const path=require('node:path');
const util=require('node:util');
Object.assign(process.env,{BIND_HOST:'100.106.186.118',GATEWAY_IP:'100.71.26.69',PORT:'8510'});
const logPath=path.join(__dirname,'handler.log');
function log(level,args){
  if(fs.existsSync(logPath)&&fs.statSync(logPath).size>1024*1024) fs.renameSync(logPath,logPath+'.previous');
  fs.appendFileSync(logPath,new Date().toISOString()+' '+level+' '+util.format(...args)+'\n');
}
console.log=(...args)=>log('INFO',args);
console.error=(...args)=>log('ERROR',args);
const app=require('./server.js');
const server=app.listen(Number(process.env.PORT),process.env.BIND_HOST,()=>console.log(JSON.stringify({event:'listening',host:process.env.BIND_HOST,port:Number(process.env.PORT)})));
server.requestTimeout=35000;
server.headersTimeout=10000;
server.on('error',err=>{console.error(JSON.stringify({event:'startup_error',code:err.code}));process.exit(1);});
