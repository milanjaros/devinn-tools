const $ = id => document.getElementById(id);
let csrf='', busy=false, connected=false, demo=false, doors=[];
function status(message,kind='') {$('status').textContent=message;$('status').className=`status ${kind}`;}
function setBusy(value) {busy=value;document.querySelectorAll('button').forEach(button=>button.disabled=value);$('refresh').disabled=value||!connected;$('connect').textContent=value?'Připojuji…':'Přihlásit a načíst vstupy →';}
function setConnected(value) {connected=value;$('login-form').hidden=value;$('account').hidden=!value;$('connection').textContent=value?'Připojeno':'Nepřipojeno';$('connection').className=`connection ${value?'online':''}`;$('refresh').disabled=!value||busy;}
function render(items) {
  doors=items;$('doors').replaceChildren();$('empty').hidden=connected;
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
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok) {
    if(response.status===401){setConnected(false);render([]);}
    throw new Error(result.error||'Požadavek se nezdařil.');
  }
  return result;
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
$('logout').addEventListener('click',async()=>{if(busy)return;setBusy(true);try{await api('/api/logout',{});setConnected(false);render([]);$('password').value='';status('Odhlášeno. Přihlašovací údaje byly odstraněny z relace.');}catch(error){status(error.message,'error');}finally{setBusy(false);}});
async function openDoor(door,button) {
  if(busy)return;setBusy(true);button.textContent='Odesílám…';status(`Odesílám příkaz: ${door.Name}…`);
  try{const result=await api('/api/open',{id:door.Id});status(`${door.Name}: ${result.message}`,'success');}
  catch(error){status(error.message,'error');}
  finally{render(connected?doors:[]);setBusy(false);}
}
async function init(){setBusy(true);try{const response=await fetch('/api/state');const state=await response.json();if(!response.ok)throw new Error(state.error);csrf=state.csrf;demo=state.demo;$('demo').hidden=!demo;$('endpoint').value=state.endpoint;if(demo){$('username').value='demo';$('password').value='demo';$('endpoint').readOnly=true;}setConnected(state.connected);if(state.connected)$('account-name').textContent='aktivní účet';render(state.doors);}catch(error){status(error.message,'error');}finally{setBusy(false);}}
init();
