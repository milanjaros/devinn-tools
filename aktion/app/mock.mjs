import http from 'node:http';
import { generateKeyPairSync, privateDecrypt, constants } from 'node:crypto';
import { encrypt, decrypt } from './protocol.mjs';

// Local test double. No connection to a real Aktion server or physical device.
export async function startMock() {
  const {publicKey,privateKey} = generateKeyPairSync('rsa',{modulusLength:2048});
  const jwk = publicKey.export({format:'jwk'}), sessions = new Map(), calls = [];
  const server = http.createServer(async (req,res) => {
    const send = value => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(value)); };
    try {
      let text=''; for await (const chunk of req) text+=chunk;
      const {data} = JSON.parse(text);
      if (data.startsWith('{')) {
        const request=JSON.parse(data); calls.push(request);
        if (request.MethodType === -1) return send(JSON.stringify({Exponent:Buffer.from(jwk.e,'base64url').toString('base64'),Modulus:Buffer.from(jwk.n,'base64url').toString('base64'),ApiVersion:3}));
        const exchange=JSON.parse(request.MethodData);
        // Raw RSA + explicit v1.5 decoding is only for this test double.
        const block=privateDecrypt({key:privateKey,padding:constants.RSA_NO_PADDING},Buffer.from(exchange.AesKey,'base64'));
        const separator=block.indexOf(0,2);
        if(block[0]!==0 || block[1]!==2 || separator<10) throw new Error('padding');
        const key=block.subarray(separator+1).toString(); sessions.set(exchange.SessionId,{key,authenticated:false});
        return send(encrypt('{}',key));
      }
      const session=sessions.get(data.slice(0,32)); if(!session) return send('sessionRenew');
      const request=JSON.parse(decrypt(data.slice(32),session.key)); calls.push(request);
      let result;
      if(request.MethodType===0) {session.authenticated=request.LoginName==='demo'&&request.Password==='demo'; result=session.authenticated?{UserName:'Ukázkový účet',OptionDoor:true}:{Error:1,ErrorText:'Nesprávné přihlášení.'};}
      else if(!session.authenticated || request.LoginName!=='demo' || request.Password!=='demo') result={Error:1};
      else if(request.MethodType===1) result=[{Id:101,Name:'Vjezdová vrata',IsRele:false},{Id:102,Name:'Vstup do budovy',IsRele:false},{Id:103,Name:'Osvětlení dvora',IsRele:true,IsEnabled:true,SwitchOperationEnabled:true}];
      else if(request.MethodType===2) result={};
      else result={Error:99};
      send(encrypt(JSON.stringify(result),session.key));
    } catch {res.statusCode=400;send({error:'Mock odmítl požadavek.'});}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,endpoint:`http://127.0.0.1:${server.address().port}`,calls,sessions};
}
