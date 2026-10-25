import { useState } from 'react';
import { ActionIcon, Avatar, Badge, Button, Divider, Group, Modal, Select, Stack, Text, Tooltip } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight, IconEdit, IconLink, IconStar, IconTrash, IconUsers, IconX } from '@tabler/icons-react';
import { useStore } from '../app/store';
import { assertEditable, descendants, fillPosition, getPrimaryHierarchy, moveSubtree, removePosition, removeRelationship, setPrimary } from '../domain/graph';
import { uid, type Person, type Relationship } from '../domain/models';
import { avatar } from '../data/demo';
import { EntityEditor, RelationshipEditor } from './Editors';
import { InlineField, InlineTags, ProfilePhoto } from './InlineDetail';
import { departmentNames, removePerson } from '../domain/people';

export function Detail({id,editing,onClose,onFocus,onMoveRequest}:{id:string;editing:boolean;onClose:()=>void;onFocus:(id:string)=>void;onMoveRequest:(id:string)=>void}){
  const {data,scenario:s,changeScenario,change}=useStore();const person=data.people.find(p=>p.id===id),position=s.positions.find(p=>p.id===id),entity=person||position;
  const [editor,setEditor]=useState(false),[relation,setRelation]=useState<Relationship|'new'|null>(null),[fill,setFill]=useState(false),[occupant,setOccupant]=useState<string|null>(null),[deleting,setDeleting]=useState(false);
  if(!entity)return null;
  const name=person?.name||position!.title,label=(nodeId:string)=>data.people.find(p=>p.id===nodeId)?.name||s.positions.find(p=>p.id===nodeId)?.title||nodeId;
  const direct=getPrimaryHierarchy(s,s.view.layoutType).filter(r=>r.sourceId===id);
  const editable=editing&&!s.protected;
  const saveFields=(patch:Partial<Pick<Person,'name'|'title'|'department'|'description'|'photo'|'email'|'phone'|'employer'>>)=>change(d=>{
    assertEditable(d.scenarios.find(v=>v.id===s.id)!);
    if(person)d.people=d.people.map(p=>p.id===id?{...p,...patch}:p);
    else d.scenarios=d.scenarios.map(v=>v.id===s.id?{...v,updatedAt:new Date().toISOString(),positions:v.positions.map(p=>p.id===id?{...p,...patch}:p)}:v);
    return d;
  });
  const saveTags=(names:string[])=>change(d=>{
    assertEditable(d.scenarios.find(v=>v.id===s.id)!);
    const tagIds=[...new Set(names.map(value=>value.trim()).filter(Boolean).map(name=>{
      const existing=d.tags.find(t=>t.name.toLocaleLowerCase()===name.toLocaleLowerCase());
      if(existing)return existing.id;
      const tag={id:uid(),name,category:'Vlastní'};d.tags.push(tag);return tag.id;
    }))];
    if(person)d.people=d.people.map(p=>p.id===id?{...p,tagIds}:p);
    else d.scenarios=d.scenarios.map(v=>v.id===s.id?{...v,updatedAt:new Date().toISOString(),positions:v.positions.map(p=>p.id===id?{...p,tagIds}:p)}:v);
    return d;
  });
  return <aside className="detail-panel"><div className="panel-heading"><span>DETAIL {person?'ZAMĚSTNANCE':'POZICE'}</span><ActionIcon variant="subtle" color="gray" aria-label="Zavřít detail" onClick={onClose}><IconX size={17}/></ActionIcon></div>
    <div className="profile">
      {person?<ProfilePhoto name={name} photo={person.photo} editing={editable} index={id.length} onSave={photo=>saveFields({photo})}/>:<Avatar size={76} radius="xl"><IconUsers/></Avatar>}
      {editable?<>
        <InlineField className="inline-name" label={person?'Jméno a příjmení':'Název pozice'} value={name} required onSave={value=>saveFields(person?{name:value}:{title:value})}/>
        {person?<InlineField className="inline-title" label="Pracovní pozice" value={person.title} required onSave={title=>saveFields({title})}/>:<Text size="sm" c="dimmed">Neobsazená pozice</Text>}
        <InlineField className="inline-department" label="Oddělení" value={entity.department} suggestions={departmentNames(data)} onSave={department=>saveFields({department})}/>
        <Text size="xs" c="dimmed" mt="xs">Enter nebo opuštění pole uloží změnu. Esc ji zruší.{person?' Údaje jsou sdílené mezi variantami.':''}</Text>
      </>:<><h2>{name}</h2><Text size="sm" c="dimmed">{person?person.title:'Neobsazená pozice'}</Text>{entity.department&&<Badge mt="md" variant="light" color="gray">{entity.department}</Badge>}</>}
    </div>
    {editing&&<Group grow px="lg" gap={7}><Button variant="default" size="xs" leftSection={<IconEdit size={14}/>} onClick={()=>setEditor(true)}>Upravit</Button><Button variant="light" size="xs" onClick={()=>onMoveRequest(id)}>Přesunout pod</Button></Group>}
    <div className="detail-content">{person&&<><h3>KONTAKTNÍ INFORMACE</h3>{editable?<Stack gap="xs"><InlineField label="E-mail" value={person.email} onSave={email=>saveFields({email})}/><InlineField label="Telefon" value={person.phone} onSave={phone=>saveFields({phone})}/><InlineField label="Zaměstnavatel" value={person.employer} onSave={employer=>saveFields({employer})}/></Stack>:<Stack gap="xs"><Text size="sm">E-mail: {person.email||'Neuveden'}</Text><Text size="sm">Telefon: {person.phone||'Neuveden'}</Text><Text size="sm">Zaměstnavatel: {person.employer||'Neuveden'}</Text></Stack>}</>}<h3>ODBORNOSTI A TECHNOLOGIE</h3>{editable?<InlineTags names={entity.tagIds.flatMap(id=>data.tags.filter(t=>t.id===id).map(t=>t.name))} catalog={data.tags.map(t=>t.name)} onSave={saveTags}/>:<Group gap={6}>{entity.tagIds.map(id=>{const tag=data.tags.find(t=>t.id===id);return tag&&<Badge key={id} color="gray" variant="light" radius="sm" tt="none">{tag.name}</Badge>;})}{!entity.tagIds.length&&<Text size="xs" c="dimmed">Bez štítků</Text>}</Group>}
    {(entity.description||editable)&&<><h3>POZNÁMKA</h3>{editable?<InlineField label="Poznámka" value={entity.description||''} multiline onSave={description=>saveFields({description})}/>:<Text size="sm" c="dimmed" lh={1.7}>{entity.description}</Text>}</>}
    <Divider my="lg"/><Group justify="space-between"><h3 style={{margin:0}}>VZTAHY</h3>{editing&&<ActionIcon variant="subtle" aria-label="Přidat vztah" onClick={()=>setRelation('new')}><IconLink size={17}/></ActionIcon>}</Group>
    {data.relationshipTypes.map(type=>{const incoming=s.relationships.filter(r=>r.type===type.id&&r.targetId===id);return <div key={type.id} className="relationship-group"><Text size="xs" fw={600} c={type.color}>{type.name}</Text>{!incoming.length&&<Text size="xs" c="dimmed" mt={6}>Bez nadřízeného</Text>}{incoming.map(r=><div className="relation-row" key={r.id}><IconArrowUpRight size={15} color={type.color}/><button className="text-button" onClick={()=>onFocus(r.sourceId)}>{label(r.sourceId)}</button>{r.primary?<Tooltip label="Primární vztah"><IconStar size={13} fill="#d3b477" color="#d3b477"/></Tooltip>:editing&&<ActionIcon variant="subtle" size="xs" aria-label="Nastavit primární vztah" onClick={()=>changeScenario(s=>({...setPrimary(s,r.id),view:{...s.view,positions:{}}}))}><IconStar size={13}/></ActionIcon>}{editing&&<><ActionIcon size="xs" variant="subtle" aria-label="Upravit vztah" onClick={()=>setRelation(r)}><IconEdit size={13}/></ActionIcon><ActionIcon size="xs" variant="subtle" color="red" aria-label="Odstranit vztah" onClick={()=>changeScenario(s=>({...removeRelationship(s,r.id),view:{...s.view,positions:{}}}))}><IconX size={13}/></ActionIcon></>}</div>)}</div>;})}
    <Divider my="lg"/><Group justify="space-between"><h3 style={{margin:0}}>PŘÍMÍ PODŘÍZENÍ</h3><Badge size="sm" color="gray" variant="light">{direct.length}</Badge></Group><Text size="xs" c="dimmed" my={8}>{data.relationshipTypes.find(t=>t.id===s.view.layoutType)?.name}</Text>{direct.map(r=><button key={r.id} className="report-row" onClick={()=>onFocus(r.targetId)}><Avatar size={29} radius="xl" src={avatar(label(r.targetId),r.targetId.length)}/><span>{label(r.targetId)}</span><IconArrowDownRight size={15}/></button>)}
    {person&&editable&&<Button mt="xl" color="red" variant="subtle" leftSection={<IconTrash size={15}/>} onClick={()=>setDeleting(true)}>Odstranit zaměstnance</Button>}
    {!person&&editing&&<Stack mt="xl"><Button variant="light" onClick={()=>setFill(true)}>Obsadit zaměstnancem</Button><Button color="red" variant="subtle" leftSection={<IconTrash size={15}/>} onClick={()=>setDeleting(true)}>Odstranit pozici</Button></Stack>}
    </div>
    {editor&&<EntityEditor entity={entity} kind={person?'person':'position'} onClose={()=>setEditor(false)}/>}
    {relation&&<RelationshipEditor targetId={id} relationship={relation==='new'?undefined:relation} onClose={()=>setRelation(null)}/>}
    <Modal opened={fill} onClose={()=>setFill(false)} title="Obsadit pozici" centered><Stack><Text size="sm">Všechny vazby pozice převezme vybraný zaměstnanec. V diagramu bude zobrazen jednou. Konfliktní vazby budou odmítnuty.</Text><Select label="Zaměstnanec" searchable data={data.people.map(p=>({value:p.id,label:p.name}))} value={occupant} onChange={setOccupant}/><Button disabled={!occupant} onClick={()=>{changeScenario(s=>fillPosition(data,s,id,occupant!));setFill(false);}}>Obsadit pozici</Button></Stack></Modal>
    <Modal opened={deleting} onClose={()=>setDeleting(false)} title={person?'Odstranit zaměstnance?':'Odstranit neobsazenou pozici?'} centered><Stack><Text size="sm">{person?`Zaměstnanec „${person.name}“ a všechny jeho vazby budou odstraněny ze všech variant včetně referenční. Ostatní zaměstnanci zůstanou zachováni, podřízení ztratí vazbu na tohoto vedoucího. Jeho obsazené pozice se uvolní. Akci lze vrátit tlačítkem Zpět.`:`Odstraní se tato pozice a její vztahy. Všichni potomci (${descendants(id,s.relationships).size}) zůstanou ve variantě; přímí potomci zůstanou bez této nadřazené vazby. Akci lze vrátit.`}</Text><Group justify="flex-end"><Button variant="default" onClick={()=>setDeleting(false)}>Zrušit</Button><Button color="red" disabled={!editable} onClick={()=>{if(person)change(d=>removePerson(d,id));else changeScenario(s=>removePosition(s,id));setDeleting(false);onClose();}}>{person?'Odstranit zaměstnance ze všech variant':'Odstranit pozici a odpojit vazby'}</Button></Group></Stack></Modal>
  </aside>;
}
export function MoveDialog({id,onClose}:{id:string;onClose:()=>void}){
  const {data,scenario,changeScenario}=useStore(),[parent,setParent]=useState<string|null>(null);
  const banned=descendants(id,scenario.relationships.filter(r=>r.type===scenario.view.layoutType));banned.add(id);
  const options=[...data.people.map(p=>({value:p.id,label:p.name})),...scenario.positions.filter(p=>p.status==='vacant').map(p=>({value:p.id,label:`○ ${p.title}`}))].filter(p=>!banned.has(p.value));
  return <Modal opened onClose={onClose} title="Přesunout celou větev pod" centered><Stack><Text size="sm">Změní se pouze primární vztah typu <strong>{data.relationshipTypes.find(t=>t.id===scenario.view.layoutType)?.name}</strong>. Vztahy potomků a ostatní typy vztahů zůstanou zachované.</Text><Select label="Nový vedoucí" searchable data={options} value={parent} onChange={setParent}/><Button disabled={!parent} onClick={()=>{changeScenario(s=>({...moveSubtree(s,id,parent!,s.view.layoutType,data.relationshipTypes),view:{...s.view,positions:{}}}));onClose();}}>Přesunout pod vedoucího</Button></Stack></Modal>;
}
