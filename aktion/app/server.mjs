import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { AktionClient, SessionExpired } from './protocol.mjs';
import { startMock } from './mock.mjs';
import { createFileLogger } from './logger.mjs';

export function createApp({demoEndpoint, defaultEndpoint='http://213.168.177.207:8090', logger=()=>{}} = {}) {
  const sessions = new Map();
  const staticFiles = new Map([['/',['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/transport.js',['transport.js','text/javascript; charset=utf-8']],['/style.css',['style.css','text/css; charset=utf-8']]]);
  const server = http.createServer(async (req,res) => {
    const reply = (code,value) => {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const expectedHost = `127.0.0.1:${server.address().port}`;
    if(req.headers.host !== expectedHost) return reply(403,{error:'Použij adresu 127.0.0.1 zobrazenou při spuštění.'});
    if(req.headers.origin && req.headers.origin !== `http://${expectedHost}`) return reply(403,{error:'Cizí původ požadavku.'});
    if(req.headers['sec-fetch-site'] === 'cross-site') return reply(403,{error:'Cizí původ požadavku.'});
    for(const [key,value] of sessions) if(Date.now()-value.last>30*60*1000 && !value.busy) sessions.delete(key);
    const path = new URL(req.url,`http://${expectedHost}`).pathname;
    try {
      if(req.method==='GET' && staticFiles.has(path)) {
        const [file,type]=staticFiles.get(path);res.setHeader('Content-Type',type);return res.end(await readFile(new URL(`./public/${file}`,import.meta.url)));
      }
      const cookie = /(?:^|;\s*)aktion=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
      let session = sessions.get(cookie);
      if(path==='/api/state' && req.method==='GET') {
        if(!session) {
          if(sessions.size>=30) return reply(429,{error:'Příliš mnoho relací. Restartuj aplikaci nebo počkej.'});
          const token=randomBytes(32).toString('hex');session={csrf:randomBytes(32).toString('hex'),last:Date.now(),client:null,busy:false};sessions.set(token,session);
          res.setHeader('Set-Cookie',`aktion=${token}; HttpOnly; SameSite=Strict; Path=/`);
        }
        session.last=Date.now();return reply(200,{csrf:session.csrf,demo:Boolean(demoEndpoint),endpoint:defaultEndpoint,connected:Boolean(session.client?.ready),doors:session.client?.doors||[]});
      }
      if(req.method!=='POST' || !['/api/connect','/api/doors','/api/open','/api/logout'].includes(path)) return reply(404,{error:'Nenalezeno.'});
      if(!session || req.headers['x-csrf-token']!==session.csrf) return reply(403,{error:'Obnov stránku a zkus to znovu.'});
      if(!req.headers['content-type']?.startsWith('application/json')) return reply(415,{error:'Očekáván JSON.'});
      if(session.busy) return reply(409,{error:'Probíhá jiný požadavek. Počkej na výsledek.'});
      let body='',length=0;
      for await(const chunk of req) {length+=chunk.length;if(length>16_384) return reply(413,{error:'Příliš velký požadavek.'});body+=chunk;}
      let input;try{input=JSON.parse(body);}catch{return reply(400,{error:'Neplatný JSON.'});}
      if(!input || typeof input!=='object') return reply(400,{error:'Neplatný požadavek.'});
      if(session.busy) return reply(409,{error:'Probíhá jiný požadavek. Počkej na výsledek.'});
      session.last=Date.now();session.busy=true;
      try {
        if(path==='/api/logout') {session.client=null;return reply(200,{ok:true});}
        if(path==='/api/connect') {
          session.client=null;
          if(typeof input.username!=='string'||!input.username.trim()||typeof input.password!=='string'||!input.password) return reply(400,{error:'Vyplň přihlašovací jméno a heslo nebo PIN.'});
          const loginType=Number(input.loginType??0);if(![0,4].includes(loginType)) return reply(400,{error:'Nepodporovaný typ přihlášení.'});
          if(typeof input.endpoint!=='string' || (input.hwId && typeof input.hwId!=='string')) return reply(400,{error:'Neplatná adresa nebo ID zařízení.'});
          const client=new AktionClient({endpoint:demoEndpoint||input.endpoint,username:input.username.trim(),password:input.password,loginType,hwId:input.hwId,logger});
          await client.connect();const doors=await client.list();session.client=client;
          return reply(200,{doors});
        }
        if(!session.client) return reply(401,{error:'Nejdřív se přihlas.'});
        if(path==='/api/doors') return reply(200,{doors:await session.client.list()});
        if(!['string','number'].includes(typeof input.id)) return reply(400,{error:'Vyber vrata.'});
        await session.client.open(input.id);
        return reply(200,{ok:true,message:demoEndpoint?'Ukázkový příkaz byl přijat. Skutečná vrata se neovládají.':'Server přijal příkaz. Pohyb vrat ověř na místě.'});
      } catch(error) {
        logger('api.failed',{stage:path,category:error.name});
        if(error instanceof SessionExpired) {session.client=null;return reply(401,{error:error.message});}
        return reply(400,{error:error.message || 'Požadavek se nezdařil.'});
      } finally {session.busy=false;}
    } catch {if(!res.headersSent) reply(500,{error:'Lokální server nemohl zpracovat požadavek.'});else res.end();}
  });
  server.requestTimeout=20_000;
  return server;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  const demo=process.argv.includes('--demo'), mock=demo?await startMock():null;
  const port=Number(process.env.PORT||8787);
  const logDirectory=fileURLToPath(new URL('./logs/',import.meta.url));
  const logger=createFileLogger(logDirectory);
  const server=createApp({demoEndpoint:mock?.endpoint,logger});
  server.on('error',error=>{console.error(`Spuštění selhalo: ${error.message}`);mock?.server.close();process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{logger('server.started',{demo,port:server.address().port});console.log(`Aktion ${demo?'DEMO ':''}běží na http://127.0.0.1:${server.address().port}\nLogy: ${logDirectory}\nUkončení: Ctrl+C`);});
}
