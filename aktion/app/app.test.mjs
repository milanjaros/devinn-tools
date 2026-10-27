import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { AktionClient, encrypt, decrypt, SessionExpired } from './protocol.mjs';
import { startMock } from './mock.mjs';
import { createApp } from './server.mjs';
import { createFileLogger } from './logger.mjs';
import { mkdtempSync, readFileSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const close = server => new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});

test('persisted diagnostics identify unexpected response stage without secrets',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'aktion-log-test-'));
  t.after(()=>{for(const name of readdirSync(directory))unlinkSync(join(directory,name));rmdirSync(directory);});
  const logger=createFileLogger(directory),mock=await startMock();t.after(()=>close(mock.server));
  let client;
  client=new AktionClient({endpoint:mock.endpoint,username:'private-user',password:'private-password',logger,
    transport:async(url,options)=>{
      const response=await fetch(url,options);
      const data=JSON.parse(options.body).data;
      if(data.startsWith('{')&&JSON.parse(data).MethodType===-2)return new Response(JSON.stringify(encrypt('false',client.key)));
      return response;
    }});
  await assert.rejects(client.connect(),/Výměna klíče:/);
  logger('allowlist.test',{password:'must-not-appear',body:'must-not-appear',token:'must-not-appear'});
  const text=readFileSync(join(directory,readdirSync(directory)[0]),'utf8');
  for(const secret of ['private-user','private-password',client.key,client.sessionId,'must-not-appear'])assert.equal(text.includes(secret),false);
  const records=text.trim().split('\n').map(line=>JSON.parse(line));
  const failure=records.find(record=>record.event==='validation.failed');
  assert.equal(failure.method,-2);assert.equal(failure.type,'boolean');assert.equal(failure.value,false);
  assert.ok(records.some(record=>record.event==='response.headers'&&record.status===200));
});

test('key exchange accepts known string acknowledgements but rejects unknown strings',async t=>{
  const mock=await startMock();t.after(()=>close(mock.server));
  for(const acknowledgement of ['OK','ok','{}','NO']) {
    let client;
    client=new AktionClient({endpoint:mock.endpoint,username:'demo',password:'demo',transport:async(url,options)=>{
      const response=await fetch(url,options),data=JSON.parse(options.body).data;
      if(data.startsWith('{')&&JSON.parse(data).MethodType===-2)return new Response(JSON.stringify(encrypt(JSON.stringify(acknowledgement),client.key)));
      return response;
    }});
    if(acknowledgement==='NO')await assert.rejects(client.connect(),/Výměna klíče/);
    else {await client.connect();assert.equal((await client.list()).length,3);}
  }
});

test('AES interoperates in both directions with CryptoJS extracted from IPA', t=>{
  let CryptoJS;
  try{CryptoJS=createRequire(import.meta.url)('../analysis/extracted/Payload/Aktion.app/www/js/crypto-js/crypto-js.js');}
  catch{t.skip('Reference IPA is not available.');return;}
  const password='0123456789abcdef0123456789abcdef';
  for(const text of ['{}','{"MethodType":2,"MethodData":101}','Příliš žluťoučký kůň 🔑']) {
    const salt=CryptoJS.enc.Hex.parse('02194da96c51ebac');
    const reference=CryptoJS.AES.encrypt(text,password,{salt}).toString();
    assert.equal(encrypt(text,password,Buffer.from(reference,'base64').subarray(8,16)),reference);
    assert.equal(decrypt(reference,password),text);
    assert.equal(CryptoJS.AES.decrypt(encrypt(text,password),password).toString(CryptoJS.enc.Utf8),text);
  }
  assert.throws(()=>decrypt('invalid',password));
});
test('RSA session, authentication, door IDs and no command replay', async t=>{
  const mock=await startMock();t.after(()=>close(mock.server));
  const client=new AktionClient({endpoint:mock.endpoint,username:'demo',password:'demo'});
  await client.connect();const doors=await client.list();assert.equal(doors[0].Name,'Vjezdová vrata');
  await client.open('101');const opening=mock.calls.filter(c=>c.MethodType===2);
  assert.equal(opening.length,1);assert.equal(opening[0].MethodData,101);
  assert.equal(opening[0].LoginName,'demo');assert.equal(opening[0].Version,3);
  await assert.rejects(client.open('unknown'),/aktuálního seznamu/);
  mock.sessions.clear();await assert.rejects(client.open(101),SessionExpired);
  assert.equal(mock.calls.filter(c=>c.MethodType===2).length,1);
  const bad=new AktionClient({endpoint:mock.endpoint,username:'demo',password:'bad'});
  await assert.rejects(bad.connect(),/Nesprávné/);assert.equal(bad.ready,false);
});
test('uncertain open is sent once, and requires a known door',async()=>{
  let calls=0;
  const client=new AktionClient({endpoint:'http://127.0.0.1:1',username:'demo',password:'demo',transport:async()=>{calls++;throw new Error('timeout');}});
  client.ready=true;client.key='secret';client.sessionId='0'.repeat(32);client.doors=[{Id:1,Name:'Test'}];
  await assert.rejects(client.open(1),/už mohl být proveden/);assert.equal(calls,1);
});
test('open accepts encrypted true and objects, rejects other scalars without replay',async()=>{
  for(const result of [true,{},false,null,'true',1,{Error:5}]) {
    let calls=0;
    const client=new AktionClient({endpoint:'http://127.0.0.1:1',username:'demo',password:'demo',transport:async()=>{
      calls++;
      return new Response(JSON.stringify(encrypt(JSON.stringify(result),client.key)));
    }});
    client.ready=true;client.key='secret';client.sessionId='0'.repeat(32);client.doors=[{Id:1,Name:'Test'}];
    if(result===true || (result && typeof result==='object' && !result.Error))assert.deepEqual(await client.open(1),result);
    else await assert.rejects(client.open(1),/Otevření:/);
    assert.equal(calls,1);
    // Boolean success must not become valid for authentication or key exchange.
    assert.throws(()=>client.validate(true,'Přihlášení',true),/Přihlášení:/);
    assert.throws(()=>client.validate(true,'Výměna klíče'),/Výměna klíče:/);
  }
});
test('local web API enforces origin/CSRF and completes a demo flow',async t=>{
  const mock=await startMock(),app=createApp({demoEndpoint:mock.endpoint});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await close(app);await close(mock.server);});
  const base=`http://127.0.0.1:${app.address().port}`;
  assert.equal((await fetch(base)).status,200);
  const initial=await fetch(base+'/api/state'), state=await initial.json();
  const cookie=initial.headers.get('set-cookie').split(';')[0];
  const headers={'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':state.csrf};
  const post=(path,body,extra={})=>fetch(base+path,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
  assert.equal((await post('/api/open',{id:101},{'X-CSRF-Token':'bad'})).status,403);
  assert.equal((await post('/api/connect',{},{Origin:'http://evil.example'})).status,403);
  assert.equal((await post('/api/open',{id:101})).status,401);
  const connected=await post('/api/connect',{endpoint:'http://example.invalid',username:'demo',password:'demo'});
  assert.equal(connected.status,200);assert.equal((await connected.json()).doors.length,3);
  assert.equal((await post('/api/open',{id:999})).status,400);
  const opened=await post('/api/open',{id:101});assert.equal(opened.status,200);
  assert.match((await opened.json()).message,/Ukázkový/);
  assert.equal(mock.calls.filter(c=>c.MethodType===2).length,1);
  const renew=await fetch(base+'/api/state',{headers:{Cookie:cookie}}), renewState=await renew.json();
  assert.equal(renewState.connected,true);assert.equal(JSON.stringify(renewState).includes('Password'),false);
  assert.equal((await post('/api/logout',{})).status,200);
  assert.equal((await post('/api/open',{id:101})).status,401);
});
