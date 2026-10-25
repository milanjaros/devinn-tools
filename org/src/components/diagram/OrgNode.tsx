import { memo } from 'react';
import { Avatar, Badge } from '@mantine/core';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { IconChevronDown, IconChevronUp, IconUserPlus, IconUserCircle } from '@tabler/icons-react';
import type { Person, Tag } from '../../domain/models';
import { contactVcard } from '../../domain/contacts';
import { avatar } from '../../data/demo';
import styles from './diagram.module.css';
export type OrgNodeData={label:string;title:string;department:string;photo:string|null;contact?:Person;showContacts:boolean;vacant:boolean;tags:Tag[];showDepartments:boolean;showTags:boolean;dimmed:boolean;inSubtree:boolean;dropTarget:boolean;collapsed:boolean;childCount:number;descendantCount:number;editable:boolean;onCollapse:()=>void};
export type OrgFlowNode=Node<OrgNodeData,'org'>;
export const OrgNode=memo(function OrgNode({id,data,selected}:NodeProps<OrgFlowNode>){return <article data-testid={`node-${id}`} className={[styles.card,selected?styles.selected:'',data.vacant?styles.vacant:'',data.dimmed?styles.dimmed:'',data.inSubtree?styles.subtree:'',data.dropTarget?styles.dropTarget:''].join(' ')}>
  <Handle type="target" position={Position.Top} isConnectable={data.editable}/>
  <div className={styles.cardHeader}><Avatar src={data.vacant?undefined:data.photo||avatar(data.label,id.charCodeAt(id.length-1))} radius="xl" size={38}>{data.vacant?<IconUserPlus size={20}/>:null}</Avatar><div className={styles.identity}><strong title={data.label}>{data.label}</strong><span title={data.title}>{data.vacant?'Neobsazená pozice':data.title}</span></div><span className={styles.dot}/></div>
  {data.showDepartments&&<div className={styles.department}>{data.department}</div>}
  {data.showTags&&<div className={styles.tags}>{data.tags.slice(0,2).map(t=><Badge key={t.id} size="xs" variant="light" color="gray">{t.name}</Badge>)}{data.tags.length>2&&<span>+{data.tags.length-2}</span>}</div>}
  {data.showContacts&&data.contact&&<div className={styles.contacts}>
    <div><span title={data.contact.email}>E-mail: {data.contact.email||'Neuveden'}</span><span title={data.contact.phone}>Tel.: {data.contact.phone||'Neuveden'}</span></div>
    <button type="button" className="nodrag nopan" aria-label={`Exportovat kontakt ${data.label}`} title="Stáhnout VCF s fotografií" onClick={event=>{
      event.stopPropagation();
      const blob=new Blob([contactVcard(data.contact!)],{type:'text/vcard;charset=utf-8'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`kontakt-${id.replace(/[^a-zA-Z0-9_-]/g,'_')}.vcf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }}><IconUserCircle size={21}/></button>
  </div>}
  {data.childCount>0&&<button className={`${styles.collapse} nodrag nopan`} aria-label={data.collapsed?'Rozbalit podstrom':'Sbalit podstrom'} onClick={e=>{e.stopPropagation();data.onCollapse();}} title="Přímí podřízení / všichni podřízení v podstromu">{data.childCount} / {data.descendantCount} {data.collapsed?<IconChevronDown size={12}/>:<IconChevronUp size={12}/>}</button>}
  <Handle type="source" position={Position.Bottom} isConnectable={data.editable}/>
</article>;});
