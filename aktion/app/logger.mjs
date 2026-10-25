import { appendFileSync, mkdirSync, existsSync, statSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Strict allowlist: callers cannot accidentally persist bodies, credentials or keys.
const fields = new Set(['trace','method','command','status','durationMs','bytes','type','length','count','fields','otherFields','errorCode','value','stage','category','demo','port']);
export function createFileLogger(directory) {
  mkdirSync(directory,{recursive:true});
  return (event, details={}) => {
    const safe=Object.fromEntries(Object.entries(details).filter(([key])=>fields.has(key)));
    const now=new Date(),file=join(directory,`aktion-${now.toISOString().slice(0,10)}.jsonl`);
    try {
      if(existsSync(file) && statSync(file).size>=5*1024*1024) {
        rmSync(file+'.previous',{force:true});renameSync(file,file+'.previous');
      }
      appendFileSync(file,JSON.stringify({time:now.toISOString(),event,...safe})+'\n','utf8');
    } catch(error) {console.error(`Log nelze zapsat (${error.code || 'IO_ERROR'}).`);}
  };
}
export function responseShape(value) {
  if(value===null)return {type:'null'};
  if(Array.isArray(value))return {type:'array',count:value.length};
  if(typeof value==='object') {
    const known=['Error','ErrorText','Modulus','Exponent','ApiVersion','UserName','OptionDoor','session','Id','Name','OperationResult'];
    const keys=Object.keys(value);
    return {type:'object',fields:keys.filter(key=>known.includes(key)),otherFields:keys.filter(key=>!known.includes(key)).length,
      ...(typeof value.Error==='number'?{errorCode:value.Error}:{})};
  }
  if(typeof value==='string')return {type:'string',length:value.length};
  return {type:typeof value,...(['boolean','number'].includes(typeof value)?{value}:{})};
}
