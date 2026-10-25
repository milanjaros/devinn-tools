import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, FileInput, Group, Modal, SegmentedControl, Select, Stack, Text, Textarea } from '@mantine/core';
import { IconDownload, IconUpload } from '@tabler/icons-react';
import { useStore } from '../../app/store';
import { countConflicts, exportDataset, importDataset, parseImport } from '../../domain/validation';
export function TransferDialog({tab,onClose}:{tab:'import'|'export';onClose:()=>void}){
  const {data,change}=useStore(),[text,setText]=useState(''),[mode,setMode]=useState<'merge'|'replace'>('merge'),[overwrite,setOverwrite]=useState(false),[confirmed,setConfirmed]=useState(false),[scope,setScope]=useState<'all'|'people'|'scenario'>('all');
  const preview=useMemo(()=>{if(!text.trim())return null;try{const raw=JSON.parse(text),input=parseImport(raw),result=importDataset(data,raw,mode,overwrite);return {input,result,conflicts:countConflicts(data,input),error:null};}catch(e){return {error:e instanceof Error?e.message:String(e)};}},[text,data,mode,overwrite]);
  const download=()=>{const blob=new Blob([exportDataset(data,scope)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`organization-${scope}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <Modal opened onClose={onClose} title={tab==='import'?'Import JSON':'Export dat'} size="lg" centered><Stack>
    {tab==='export'?<><Text size="sm" c="dimmed">Přenosná záloha obsahuje i lokálně nahrané fotografie. Data zůstanou v tomto prohlížeči.</Text><Select label="Rozsah exportu" data={[{value:'all',label:'Kompletní záloha'},{value:'people',label:'Zaměstnanci a štítky'},{value:'scenario',label:'Aktivní varianta včetně sdílených zaměstnanců'}]} value={scope} onChange={v=>setScope(v as typeof scope)}/><Button leftSection={<IconDownload size={16}/>} onClick={download}>Stáhnout JSON</Button></>:<>
    <FileInput label="Soubor JSON" accept=".json,application/json" leftSection={<IconUpload size={16}/>} onChange={file=>{if(file)void file.text().then(setText).catch(e=>setText(String(e)));}}/>
    <Textarea label="Nebo vložte JSON" value={text} onChange={e=>setText(e.currentTarget.value)} minRows={5} maxRows={10} autosize/>
    <SegmentedControl data={[{value:'merge',label:'Sloučit'},{value:'replace',label:'Nahradit vše'}]} value={mode} onChange={v=>{setMode(v as typeof mode);setConfirmed(false);}}/>
    {mode==='merge'&&<Checkbox label="Výslovně povolit přepsání záznamů se shodným ID" checked={overwrite} onChange={e=>setOverwrite(e.currentTarget.checked)}/>}
    {preview?.error&&<Alert color="red" title="Import není platný"><Text size="xs" style={{whiteSpace:'pre-wrap'}}>{preview.error}</Text></Alert>}
    {preview&&!preview.error&&'input'in preview&&<><Alert color="green" title="Náhled importu"><Text size="sm">{preview.input!.people?.length||0} zaměstnanců · {preview.input!.tags?.length||0} štítků · {preview.input!.scenarios?.length||0} variant · {(preview.input!.relationships?.length||0)+(preview.input!.scenarios||[]).reduce((n,s)=>n+s.relationships.length,0)} vztahů · {(preview.input!.scenarios||[]).reduce((n,s)=>n+s.positions.length,0)} pozic · {preview.input!.relationshipTypes?.length||0} typů</Text>{mode==='merge'&&<Text size="xs" mt={8}>{preview.conflicts} shodných ID. {overwrite?'Existující záznamy budou přepsány.':'Existující záznamy zůstanou zachované, konfliktní importované záznamy se přeskočí. Varianta se slučuje jako celek.'}</Text>}</Alert>{mode==='replace'&&<Checkbox color="red" label="Potvrzuji nahrazení všech současných dat" checked={confirmed} onChange={e=>setConfirmed(e.currentTarget.checked)}/>}</>}
    <Group justify="flex-end"><Button variant="default" onClick={onClose}>Zrušit</Button><Button disabled={!preview||!!preview.error||(mode==='replace'&&!confirmed)} onClick={()=>{if(preview&&'result'in preview&&preview.result){const result=preview.result;change(()=>result);onClose();}}}>Importovat data</Button></Group>
    </>}
  </Stack></Modal>;
}
