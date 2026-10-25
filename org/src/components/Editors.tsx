import { useState } from 'react';
import { Alert, Button, Checkbox, ColorInput, FileInput, Group, Modal, Select, Stack, TagsInput, Text, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { z } from 'zod';
import { useStore } from '../app/store';
import { type Person, type Position, type Relationship, type RelationshipType, uid } from '../domain/models';
import { addRelationship, assertEditable, removeRelationship } from '../domain/graph';
import { departmentNames } from '../domain/people';
import { DepartmentInput } from './DepartmentInput';

interface EntityEditorProps {entity?:Person|Position;kind:'person'|'position';onClose:()=>void}
export function EntityEditor({entity,kind,onClose}:EntityEditorProps){
  const {data,scenario,change}=useStore();
  const schema=z.object({name:kind==='person'?z.string().trim().min(1,'Vyplňte jméno.'):z.string(),title:z.string().trim().min(1,'Vyplňte pozici.'),department:z.string().trim(),email:z.string().trim().refine(value=>!value||z.email().safeParse(value).success,'Zadejte platný e-mail.')});
  const form=useForm({initialValues:{name:entity&&'name'in entity?entity.name:'',title:entity?.title||'',department:entity?.department||'',email:entity&&'email'in entity?entity.email:'',phone:entity&&'phone'in entity?entity.phone:'',employer:entity&&'employer'in entity?entity.employer:'',description:entity?.description||'',tagNames:entity?.tagIds.map(id=>data.tags.find(t=>t.id===id)?.name||id)||[],photo:entity&&'photo'in entity?entity.photo||'':''},validate:values=>{const result=schema.safeParse(values);return result.success?{}:Object.fromEntries(result.error.issues.map(i=>[i.path[0],i.message]));}});
  const [photoError,setPhotoError]=useState('');
  const save=form.onSubmit(values=>{if(photoError)return;change(d=>{
    assertEditable(d.scenarios.find(s=>s.id===d.activeScenarioId)!);
    const tagIds=values.tagNames.map(name=>{const existing=d.tags.find(t=>t.name.toLocaleLowerCase()===name.toLocaleLowerCase());if(existing)return existing.id;const id=uid();d.tags.push({id,name,category:'Vlastní'});return id;});
    const shared={id:entity?.id||uid(),title:values.title.trim(),department:values.department.trim(),description:values.description,tagIds};
    if(kind==='person'){const p:Person={...shared,name:values.name.trim(),email:values.email.trim(),phone:values.phone.trim(),employer:values.employer.trim(),photo:values.photo||null};d.people=entity?d.people.map(old=>old.id===p.id?p:old):[...d.people,p];}
    else{const position:Position={...shared,status:entity&&'status'in entity?entity.status:'vacant'};d.scenarios=d.scenarios.map(s=>s.id===scenario.id?{...s,updatedAt:new Date().toISOString(),positions:entity?s.positions.map(p=>p.id===position.id?position:p):[...s.positions,position]}:s);}
    return d;
  });onClose();});
  return <Modal opened onClose={onClose} title={entity?'Upravit údaje':kind==='person'?'Přidat zaměstnance':'Nová neobsazená pozice'} centered><form onSubmit={save}><Stack gap="sm">
    {kind==='person'&&<><Alert color="gray" variant="light">Údaje zaměstnance jsou společné pro všechny varianty.</Alert><TextInput label="Jméno a příjmení" required {...form.getInputProps('name')}/></>}
    <TextInput label="Pracovní pozice" required {...form.getInputProps('title')}/><DepartmentInput label="Oddělení" suggestions={departmentNames(data)} {...form.getInputProps('department')}/>
    {kind==='person'&&<><TextInput label="E-mail" type="email" {...form.getInputProps('email')}/><TextInput label="Telefon" type="tel" {...form.getInputProps('phone')}/><TextInput label="Zaměstnavatel" {...form.getInputProps('employer')}/></>}
    <TagsInput label="Štítky" description="Vyberte existující nebo napište nový a stiskněte Enter." data={data.tags.map(t=>t.name)} {...form.getInputProps('tagNames')}/>
    <Textarea label="Poznámka" minRows={3} {...form.getInputProps('description')}/>
    {kind==='person'&&<><TextInput label="URL fotografie" placeholder="https://…" {...form.getInputProps('photo')} error={photoError||undefined} onChange={e=>{const value=e.currentTarget.value;form.setFieldValue('photo',value);setPhotoError(value&&!/^https?:\/\//i.test(value)&&!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)?'Zadejte HTTP(S) adresu nebo nahrajte obrázek.':'');}}/><FileInput label="Nebo lokální fotografie" accept="image/png,image/jpeg,image/webp,image/gif" onChange={file=>{if(!file)return;if(file.size>3*1024*1024){setPhotoError('Fotografie smí mít nejvýše 3 MB.');return;}const reader=new FileReader();reader.onload=()=>{form.setFieldValue('photo',String(reader.result));setPhotoError('');};reader.onerror=()=>setPhotoError('Obrázek nelze načíst.');reader.readAsDataURL(file);}}/><Text size="xs" c="dimmed">Nahraný obrázek se uloží přímo do prohlížeče a zahrne do JSON zálohy.</Text></>}
    <Group justify="flex-end" mt="sm"><Button variant="default" onClick={onClose}>Zrušit</Button><Button type="submit" disabled={!!photoError}>Uložit</Button></Group>
  </Stack></form></Modal>;
}

export function RelationshipEditor({sourceId,targetId,relationship,onClose}:{sourceId?:string;targetId?:string;relationship?:Relationship;onClose:()=>void}){
  const {data,scenario,changeScenario}=useStore();const [source,setSource]=useState(relationship?.sourceId||sourceId||null),[target,setTarget]=useState(relationship?.targetId||targetId||null),[type,setType]=useState(relationship?.type||scenario.view.layoutType),[primary,setPrimary]=useState(relationship?.primary??true);
  const options=[...data.people.map(p=>({value:p.id,label:p.name})),...scenario.positions.filter(p=>p.status==='vacant').map(p=>({value:p.id,label:`○ ${p.title}`}))];
  return <Modal opened onClose={onClose} title={relationship?'Upravit vztah':'Vytvořit vztah'} centered><Stack><Select label="Vedoucí / zdroj" searchable data={options} value={source} onChange={setSource}/><Select label="Člen týmu / cíl" searchable data={options} value={target} onChange={setTarget}/><Select label="Typ vztahu" data={data.relationshipTypes.map(t=>({value:t.id,label:t.name}))} value={type} onChange={value=>value&&setType(value)}/><Checkbox label="Primární vztah pro rozložení" checked={primary} onChange={e=>setPrimary(e.currentTarget.checked)}/><Text c="dimmed" size="xs">U každého typu může mít uzel jeden primární vztah. Ostatní vazby zůstanou zobrazené jako doplňkové.</Text><Button disabled={!source||!target} onClick={()=>{changeScenario(s=>{const base=relationship?removeRelationship(s,relationship.id):s;return {...addRelationship(base,{id:relationship?.id||uid(),scenarioId:s.id,sourceId:source!,targetId:target!,type,primary},data.relationshipTypes),view:{...s.view,positions:{}}};});onClose();}}>Uložit vztah</Button></Stack></Modal>;
}
export function TypeEditor({type,onClose}:{type?:RelationshipType;onClose:()=>void}){
  const {data,change}=useStore(),[name,setName]=useState(type?.name||''),[color,setColor]=useState(type?.color||'#658aad'),[lineStyle,setLineStyle]=useState<RelationshipType['lineStyle']>(type?.lineStyle||'dashed'),[multiple,setMultiple]=useState(type?.allowMultipleParents??true);
  return <Modal opened onClose={onClose} title={type?'Pravidla typu vztahu':'Vlastní typ vztahu'} centered><Stack><TextInput label="Název" value={name} onChange={e=>setName(e.currentTarget.value)} required/><ColorInput label="Barva" value={color} onChange={setColor} format="hex"/><Select label="Styl čáry" data={[{value:'solid',label:'Plná'},{value:'dashed',label:'Přerušovaná'},{value:'dotted',label:'Tečkovaná'}]} value={lineStyle} onChange={v=>setLineStyle(v as RelationshipType['lineStyle'])}/><Checkbox label="Povolit více nadřízených" checked={multiple} onChange={e=>setMultiple(e.currentTarget.checked)}/><Text c="dimmed" size="xs">Katalog typů je sdílený. Změna pravidel se ověří proti všem variantám.</Text><Button disabled={!name.trim()||!/^#[\da-f]{6}$/i.test(color)||data.relationshipTypes.some(t=>t.id!==type?.id&&t.name===name.trim())} onClick={()=>{change(d=>{const next={id:type?.id||uid(),name:name.trim(),color,lineStyle,allowMultipleParents:multiple};return {...d,relationshipTypes:type?d.relationshipTypes.map(t=>t.id===type.id?next:t):[...d.relationshipTypes,next]};});onClose();}}>Uložit typ vztahu</Button></Stack></Modal>;
}
