const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const data = fs.readFileSync(process.argv[2] || 'captures/plusportal.mitm');
let pos = 0;
function read() {
  const colon = data.indexOf(58, pos);
  if (colon < 0) throw Error('Incomplete length at ' + pos);
  const n = Number(data.toString('ascii', pos, colon));
  const start = colon + 1, end = start + n;
  if (!Number.isSafeInteger(n) || end >= data.length) throw Error('Incomplete record at ' + pos);
  const type = String.fromCharCode(data[end]);
  pos = end + 1;
  if (type === ',' || type === ';') return data.subarray(start, end);
  if (type === '#' || type === '^') return Number(data.toString('ascii', start, end));
  if (type === '~') return null;
  if (type === '!') return data.toString('ascii', start, end) === 'true';
  if (type === '}' || type === ']') {
    pos = start;
    const result = type === '}' ? {} : [];
    while (pos < end) {
      if (type === '}') { const key = read().toString(); result[key] = read(); }
      else result.push(read());
    }
    pos = end + 1;
    return result;
  }
  throw Error('Unknown type ' + type);
}
const out = 'captures/decoded';
fs.mkdirSync(out, {recursive:true});
const index = [];
while (pos < data.length) {
  let f;
  try { f = read(); } catch(e) { console.error(e.message); break; }
  if (!f.request) continue;
  const id = index.length;
  const req = f.request, res = f.response;
  const headers = Object.fromEntries((res?.headers || []).map(([k,v])=>[k.toString().toLowerCase(),v.toString()]));
  let body = res?.content;
  if (Buffer.isBuffer(body)) {
    try {
      if (headers['content-encoding'] === 'gzip') body = zlib.gunzipSync(body);
      if (headers['content-encoding'] === 'br') body = zlib.brotliDecompressSync(body);
      if (headers['content-encoding'] === 'deflate') body = zlib.inflateSync(body);
    } catch(e) { console.error(id, e.message); }
    fs.writeFileSync(path.join(out, id + '.body'), body);
  }
  index.push({id,host:req.host?.toString(),method:req.method?.toString(),path:req.path?.toString(),status:res?.status_code,type:headers['content-type'],bytes:body?.length || 0});
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index,null,2));
console.log(JSON.stringify(index,null,2));
