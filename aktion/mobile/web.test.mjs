import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const transportSource=await readFile(new URL('../app/public/transport.js',import.meta.url),'utf8');
const appSource=await readFile(new URL('../app/public/app.js',import.meta.url),'utf8');

test('iOS transport uses the bridge without HTTP and normalizes native errors',async()=>{
  const calls=[];
  const window={webkit:{messageHandlers:{aktion:{async postMessage(input){calls.push(input);if(input.path==='/fail')throw 'Klíčenka není dostupná.';return {ok:true};}}}}};
  vm.runInNewContext(transportSource,{window,fetch(){assert.fail('Native UI must not use fetch');}});
  assert.equal(window.aktionTransport.native,true);
  await window.aktionTransport.request('/api/open',{id:'101'});
  assert.equal(calls[0].path,'/api/open');assert.equal(calls[0].body.id,'101');
  await assert.rejects(window.aktionTransport.request('/fail'),/Klíčenka/);
});

test('Windows transport retains CSRF and HTTP error status',async()=>{
  const calls=[],window={};
  vm.runInNewContext(transportSource,{window,async fetch(path,options){calls.push({path,options});return {ok:path!=='/fail',status:401,async json(){return {error:'Nejdřív se přihlas.'};}};}});
  assert.equal(window.aktionTransport.native,false);
  await window.aktionTransport.request('/api/state');
  await window.aktionTransport.request('/api/open',{id:101},'csrf-secret');
  assert.equal(calls[0].options.method,undefined);
  assert.equal(calls[1].options.headers['X-CSRF-Token'],'csrf-secret');
  assert.equal(JSON.parse(calls[1].options.body).id,101);
  await assert.rejects(window.aktionTransport.request('/fail',{},'csrf-secret'),error=>error.status===401);
});

// Minimal DOM fixture to exercise the shared controller without browser packages.
class Element {
  constructor(tag='div'){this.tag=tag;this.value='';this.children=[];this.listeners={};this.hidden=false;this.disabled=false;this.checked=false;}
  get options(){return this.children;}
  append(...items){this.children.push(...items);if(this.tag==='select'&&!this.value&&this.children.length)this.value=this.children[0].value;}
  replaceChildren(){this.children=[];if(this.tag==='select')this.value='';}
  setAttribute(){}
  addEventListener(name,handler){this.listeners[name]=handler;}
}
test('shared UI restores a saved gate, excludes relays and clears saved state on logout',async()=>{
  const elements=new Map();
  for(const match of (await readFile(new URL('../app/public/index.html',import.meta.url),'utf8')).matchAll(/<(\w+)[^>]*\bid="([^"]+)"/g))elements.set(match[2],new Element(match[1]));
  const calls=[];
  const state={csrf:'',demo:false,connected:true,endpoint:'https://mock.invalid',doors:[{Id:101,Name:'Vrata'},{Id:103,Name:'Relé',IsRele:true}],saved:{id:'101',name:'Vrata',username:'demo',hwId:'device',loginType:0,allowLocked:true}};
  const document={getElementById:id=>{assert.ok(elements.has(id),id);return elements.get(id);},createElement:tag=>new Element(tag),querySelectorAll:()=>[...elements.values()].filter(e=>e.tag==='button')};
  const window={aktionTransport:{native:true,async request(path,body){calls.push({path,body});if(path==='/api/state')return state;if(path==='/api/shortcut')return {id:body.id,name:'Vrata'};return {ok:true};}}};
  vm.runInNewContext(appSource,{document,window});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements.get('shortcut-panel').hidden,false);
  assert.equal(elements.get('shortcut-door').options.length,1);
  assert.equal(elements.get('shortcut-door').value,'101');
  assert.equal(elements.get('allow-locked').checked,true);
  assert.equal(elements.get('save-shortcut').disabled,false);
  await elements.get('save-shortcut').listeners.click();
  assert.equal(calls.at(-1).path,'/api/shortcut');
  assert.equal(calls.at(-1).body.id,'101');
  assert.equal(calls.at(-1).body.allowLocked,true);
  await elements.get('logout').listeners.click();
  assert.equal(calls.at(-1).path,'/api/logout');
  assert.equal(elements.get('shortcut-state').textContent,'Není uloženo.');
  assert.equal(elements.get('allow-locked').checked,false);
  assert.equal(elements.get('save-shortcut').disabled,true);
});
