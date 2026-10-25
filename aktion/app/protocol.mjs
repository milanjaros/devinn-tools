import { randomBytes, createHash, createCipheriv, createDecipheriv, createPublicKey, publicEncrypt, constants } from 'node:crypto';
import { responseShape } from './logger.mjs';

// CryptoJS AES.encrypt(text, passphrase): OpenSSL EVP_BytesToKey, MD5,
// one iteration, AES-256-CBC, PKCS#7, 8-byte salt. The hex key is a TEXT password.
function derive(password, salt) {
  const chunks = []; let previous = Buffer.alloc(0), length = 0;
  while (length < 48) {
    previous = createHash('md5').update(Buffer.concat([previous, Buffer.from(password, 'utf8'), salt])).digest();
    chunks.push(previous); length += previous.length;
  }
  const bytes = Buffer.concat(chunks);
  return [bytes.subarray(0, 32), bytes.subarray(32, 48)];
}
export function encrypt(text, password, salt = randomBytes(8)) {
  const [key, iv] = derive(password, salt);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([Buffer.from('Salted__'), salt, cipher.update(text, 'utf8'), cipher.final()]).toString('base64');
}
export function decrypt(encoded, password) {
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 32 || bytes.subarray(0, 8).toString() !== 'Salted__' || (bytes.length - 16) % 16) throw new Error('Neznámý formát šifrované odpovědi.');
  const [key, iv] = derive(password, bytes.subarray(8, 16));
  const cipher = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([cipher.update(bytes.subarray(16)), cipher.final()]).toString('utf8');
}
export class SessionExpired extends Error {}
export function checkResult(value, login = false) {
  if (value && typeof value === 'object' && (login ? Object.hasOwn(value, 'Error') : Boolean(value.Error))) {
    const code = value.Error;
    const names = {5:'Relé je zablokované.',11:'Účet je uzamčený.',12:'Účet je zakázaný.'};
    throw new Error(`${value.ErrorText || names[code] || 'Aktion požadavek zamítl.'} (kód ${code})`);
  }
  if (!value || typeof value !== 'object') throw new Error('Server nevrátil očekávanou odpověď.');
  return value;
}
export class AktionClient {
  constructor({ endpoint, username, password, loginType = 0, hwId, transport = fetch, logger = () => {} }) {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Zadej HTTP nebo HTTPS adresu serveru bez přihlašovacích údajů.');
    url.pathname = url.pathname.replace(/\/$/, '').replace(/\/GetMobileData$/i, '') + '/GetMobileData';
    Object.assign(this, { endpoint: url.href, username, password, loginType, hwId: hwId || randomBytes(16).toString('hex'), transport });
    this.command = 0; this.doors = []; this.ready = false;
    this.logger=logger;this.trace=randomBytes(6).toString('hex');
  }
  log(event,details={}) {this.logger(event,{trace:this.trace,method:this.method,command:this.command,...details});}
  validate(value,stage,login=false) {
    try{return checkResult(value,login);}catch(error){this.log('validation.failed',{stage,...responseShape(value)});throw new Error(`${stage}: ${error.message}`);}
  }
  envelope(method, data, credentials = true) {
    return {LoginName:credentials ? this.username : '', Password:credentials ? this.password : '', LoginType:credentials ? this.loginType : 0,
      MethodType:method, ...(method === 0 ? {HwId:this.hwId} : {}), Version:3, Language:0, CommandId:++this.command, MethodData:data};
  }
  async post(data,method) {
    this.method=method;
    const started=Date.now();this.log('request.sent',{bytes:Buffer.byteLength(data)});
    let response;
    try {
      response = await this.transport(this.endpoint, {method:'POST', headers:{'Content-Type':'application/json; charset=utf-8','Accept':'application/json'}, body:JSON.stringify({data}), signal:AbortSignal.timeout(12000), redirect:'error'});
    } catch(error) {this.log('request.failed',{category:error.cause?.code || error.name,durationMs:Date.now()-started});throw new Error('Server neodpovídá nebo spojení selhalo.'); }
    this.log('response.headers',{status:response.status,durationMs:Date.now()-started});
    if (!response.ok) throw new Error(`Server vrátil HTTP ${response.status}.`);
    const text = await response.text();
    this.log('response.body',{bytes:Buffer.byteLength(text),durationMs:Date.now()-started});
    if (text.length > 2_000_000) throw new Error('Odpověď serveru je příliš velká.');
    let result;
    try { result = JSON.parse(text); } catch {this.log('response.invalid_json');throw new Error('Server nevrátil platný JSON.'); }
    this.log('response.parsed',responseShape(result));
    if (result === 'sessionRenew') {this.log('session.expired');this.ready = false; throw new SessionExpired('Relace vypršela. Přihlas se znovu.'); }
    return result;
  }
  decode(result) {
    if (typeof result !== 'string' || !result.startsWith('U2FsdGVkX1')) throw new Error('Server nevrátil šifrovanou odpověď.');
    try {const value=JSON.parse(decrypt(result, this.key));this.log('response.decrypted',responseShape(value));return value;}
    catch {this.log('response.decode_failed');throw new Error('Odpověď serveru nelze dešifrovat nebo přečíst.'); }
  }
  async connect() {
    this.ready = false;
    this.sessionId = randomBytes(16).toString('hex'); this.key = randomBytes(16).toString('hex');
    const raw = await this.post(JSON.stringify(this.envelope(-1, this.sessionId, false)),-1);
    let rsa;
    try { rsa = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { throw new Error('Server neposkytl veřejný RSA klíč.'); }
    if (!rsa?.Modulus || !rsa?.Exponent) throw new Error('Server nepodporuje očekávanou výměnu RSA klíče.');
    const key = createPublicKey({format:'jwk', key:{kty:'RSA', n:Buffer.from(rsa.Modulus,'base64').toString('base64url'), e:Buffer.from(rsa.Exponent,'base64').toString('base64url')}});
    const aesKey = publicEncrypt({key, padding:constants.RSA_PKCS1_PADDING}, Buffer.from(this.key)).toString('base64');
    const exchange = await this.post(JSON.stringify(this.envelope(-2, JSON.stringify({SessionId:this.sessionId,AesKey:aesKey}), false)),-2);
    const acknowledgement=this.decode(exchange);
    // This endpoint may acknowledge the exchange with a string rather than
    // the object returned by normal methods. Do not relax login/open checks.
    if(['OK','ok','{}'].includes(acknowledgement)) {
      this.log('exchange.acknowledged',{category:acknowledgement==='{}'?'json_object_string':'ok'});
    } else {
      this.validate(acknowledgement,'Výměna klíče');
    }
    const login = this.validate(await this.request(0, ''),'Přihlášení',true);
    this.ready = true;
    return login;
  }
  async request(method, data) {
    return this.decode(await this.post(this.sessionId + encrypt(JSON.stringify(this.envelope(method, data)), this.key),method));
  }
  async list() {
    if (!this.ready) throw new SessionExpired('Nejdřív se přihlas.');
    const result = this.validate(await this.request(1, ''),'Seznam vstupů');
    if (!Array.isArray(result) || result.some(d => !d || !['string','number'].includes(typeof d.Id) || typeof d.Name !== 'string')) throw new Error('Neznámý formát seznamu dveří.');
    this.doors = result;
    return result;
  }
  async open(id) {
    if (!this.ready) throw new SessionExpired('Relace vypršela. Přihlas se znovu.');
    const door = this.doors.find(d => String(d.Id) === String(id));
    if (!door) throw new Error('Vyber dveře z aktuálního seznamu.');
    // Never retry an actuator command: a lost response does not mean it failed.
    try { return this.validate(await this.request(2, door.Id),'Otevření'); }
    catch (error) {
      if (error instanceof SessionExpired) throw error;
      throw new Error(`${error.message} Pokud se ztratila odpověď, příkaz už mohl být proveden. Zkontroluj vrata před dalším pokusem.`);
    }
  }
}
