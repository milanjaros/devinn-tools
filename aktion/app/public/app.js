const $ = id => document.getElementById(id);
let csrf='', busy=false, connected=false, demo=false, doors=[];
let savedDoor=null;
const transport=window.aktionTransport;
function status(message,kind='') {$('status').textContent=message;$('status').className=`status ${kind}`;}
function setBusy(value) {busy=value;document.querySelectorAll('button').forEach(button=>button.disabled=value);$('refresh').disabled=value||!connected;$('save-shortcut').disabled=value||!connected||!$('shortcut-door').options.length;$('connect').textContent=value?'Připojuji…':'Přihlásit a načíst vstupy →';}
function setConnected(value) {connected=value;$('login-form').hidden=value;$('account').hidden=!value;$('connection').textContent=value?'Připojeno':'Nepřipojeno';$('connection').className=`connection ${value?'online':''}`;$('refresh').disabled=!value||busy;}
function render(items) {
  doors=items;$('doors').replaceChildren();$('empty').hidden=connected;
  const previous=$('shortcut-door').value||savedDoor;
  $('shortcut-door').replaceChildren();
  for(const door of items.filter(d=>!d.IsRele)){const option=document.createElement('option');option.value=String(door.Id);option.textContent=door.Name;$('shortcut-door').append(option);}
  if(previous!==null&&[...$('shortcut-door').options].some(o=>o.value===previous))$('shortcut-door').value=previous;
  $('save-shortcut').disabled=busy||!connected||!$('shortcut-door').options.length;
  if(connected&&!items.length) {const p=document.createElement('p');p.className='hint';p.textContent='Účet nemá žádné dostupné vstupy.';$('doors').append(p);}
  for(const door of items) {
    const row=document.createElement('article');row.className='door';
    const icon=document.createElement('span');icon.className='door-icon';icon.textContent='▥';icon.setAttribute('aria-hidden','true');
    const info=document.createElement('div');info.className='door-info';
    const title=document.createElement('h3');title.textContent=door.Name;
    const detail=document.createElement('p');detail.textContent=door.IsRele?`Relé · ${door.IsEnabled?'zapnuto':'vypnuto'}`:'Vstup';info.append(title,detail);
    const button=document.createElement('button');button.className='open';button.textContent=door.IsRele?(door.SwitchOperationEnabled?'Přepnout':'Zapnout'):'Otevřít';button.setAttribute('aria-label',`${button.textContent}: ${door.Name}`);
    button.addEventListener('click',()=>openDoor(door,button));row.append(icon,info,button);$('doors').append(row);
  }
}
async function api(path,body) {
  try{return await transport.request(path,body,csrf);}
  catch(error){if(error.status===401){setConnected(false);render([]);}throw error;}
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const input=Object.fromEntries(new FormData(event.currentTarget));setBusy(true);status('Připojuji k Aktionu a načítám vstupy…');
  try{const result=await api('/api/connect',input);$('account-name').textContent=input.username;setConnected(true);render(result.doors);$('password').value='';status(demo?'Demo je připravené. Skutečná vrata se neovládají.':'Připojeno. Vyber vstup, který chceš otevřít.','success');}
  catch(error){setConnected(false);render([]);status(error.message,'error');}
  finally{setBusy(false);}
});
async function refresh() {if(busy)return;setBusy(true);status('Obnovuji seznam vstupů…');try{render((await api('/api/doors',{})).doors);status('Seznam vstupů byl aktualizován.');}catch(error){status(error.message,'error');}finally{setBusy(false);}}
$('refresh').addEventListener('click',refresh);
$('logout').addEventListener('click',async()=>{if(busy)return;setBusy(true);try{await api('/api/logout',{});setConnected(false);render([]);$('password').value='';savedDoor=null;$('allow-locked').checked=false;$('shortcut-state').textContent='Není uloženo.';status(transport.native?'Odhlášeno. Uložené údaje pro Zkratky byly smazány.':'Odhlášeno. Přihlašovací údaje byly odstraněny z relace.');}catch(error){status(error.message,'error');}finally{setBusy(false);}});
async function openDoor(door,button) {
  if(busy)return;setBusy(true);button.textContent='Odesílám…';status(`Odesílám příkaz: ${door.Name}…`);
  try{const result=await api('/api/open',{id:door.Id});status(`${door.Name}: ${result.message}`,'success');}
  catch(error){status(error.message,'error');}
  finally{render(connected?doors:[]);setBusy(false);}
}
$('save-shortcut').addEventListener('click',async()=>{
  if(busy||!connected||!$('shortcut-door').value)return;
  setBusy(true);
  try{const result=await api('/api/shortcut',{id:$('shortcut-door').value,allowLocked:$('allow-locked').checked});savedDoor=String(result.id);$('shortcut-state').textContent=`Uloženo: ${result.name}. V aplikaci Zkratky přidej akci Aktion Vrata.`;status('Účet a vrata byly uloženy do Klíčenky.','success');}
  catch(error){status(error.message,'error');}finally{setBusy(false);}
});
$('forget-shortcut').addEventListener('click',async()=>{
  if(busy)return;setBusy(true);
  try{await api('/api/forget',{});savedDoor=null;$('allow-locked').checked=false;$('shortcut-state').textContent='Není uloženo.';status('Uložený účet a výběr vrat byly smazány.');}
  catch(error){status(error.message,'error');}finally{setBusy(false);}
});
async function init(){setBusy(true);try{
  const state=await api('/api/state');csrf=state.csrf;demo=state.demo;$('demo').hidden=!demo;$('endpoint').value=state.endpoint;
  if(transport.native){$('shortcut-panel').hidden=false;$('runtime-label').textContent='BĚŽÍ V TOMTO IPHONU';$('storage-hint').textContent='Přihlášení zůstává v paměti. Tlačítkem pro Zkratky můžeš účet a jedny vrata výslovně uložit do Klíčenky.';}
  if(state.saved){savedDoor=String(state.saved.id);$('allow-locked').checked=state.saved.allowLocked;$('shortcut-state').textContent=`Uloženo: ${state.saved.name}. Zkratka je připravena.`;$('username').value=state.saved.username;$('hwId').value=state.saved.hwId;$('loginType').value=String(state.saved.loginType);}
  if(demo){$('username').value='demo';$('password').value='demo';$('endpoint').readOnly=true;}
  setConnected(state.connected);if(state.connected)$('account-name').textContent='aktivní účet';render(state.doors);
}catch(error){status(error.message,'error');}finally{setBusy(false);}}
init();
