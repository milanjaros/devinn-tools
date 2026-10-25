import { useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, useReactFlow, useNodesState, MarkerType, type Edge, type Connection } from '@xyflow/react';
import { Button, Group, Paper, Text } from '@mantine/core';
import { IconFocus2, IconLayoutDistributeHorizontal } from '@tabler/icons-react';
import { useStore } from '../../app/store';
import { addRelationship, descendants, getPrimaryHierarchy, getVisibleRelationships, moveSubtree } from '../../domain/graph';
import { nodeIds, uid } from '../../domain/models';
import { layoutNodes, CARD_HEIGHT, CARD_WIDTH } from './layout';
import { OrgNode, type OrgFlowNode } from './OrgNode';
const nodeTypes={org:OrgNode};
const eventPoint=(event:{clientX:number;clientY:number}|{changedTouches:TouchList})=>'changedTouches'in event?event.changedTouches[0]:event;
interface Props {selected:string|null;onSelect:(id:string|null)=>void;matchIds:Set<string>;hasFilter:boolean;editing:boolean;focusId:string|null;focusTick:number;highlight:boolean;onContext:(id:string,x:number,y:number)=>void}
export function Diagram({selected,onSelect,matchIds,hasFilter,editing,focusId,focusTick,highlight,onContext}:Props){
  const {data,scenario:s,changeScenario}=useStore(),flow=useReactFlow<OrgFlowNode>();
  const [nodes,setNodes,onNodesChange]=useNodesState<OrgFlowNode>([]),[dropTarget,setDropTarget]=useState<string|null>(null);
  const [relayout,setRelayout]=useState(0);
  const hierarchy=getPrimaryHierarchy(s,s.view.layoutType),hierarchyKey=JSON.stringify(hierarchy.map(r=>[r.sourceId,r.targetId]));
  const idsKey=nodeIds(data,s).join('|');
  const collapsedKey=JSON.stringify(s.view.collapsedIds);
  const hidden=useMemo(()=>{const set=new Set<string>();for(const id of s.view.collapsedIds)for(const child of descendants(id,hierarchy))set.add(child);return set;},[collapsedKey,hierarchyKey]);
  // Supplemental edge visibility and search filters never trigger layout.
  const automatic=useMemo(()=>layoutNodes(nodeIds(data,s).filter(id=>!hidden.has(id)),s),[s.id,s.view.layoutType,hierarchyKey,idsKey,hidden,relayout,s.view.showContacts]);
  const subtree=useMemo(()=>selected&&highlight?descendants(selected,hierarchy):new Set<string>(),[selected,highlight,hierarchyKey]);
  const visibleIds=nodeIds(data,s).filter(id=>!hidden.has(id)&&(!s.view.onlyMatches||!hasFilter||matchIds.has(id)));
  const geometryKey=JSON.stringify([s.id,automatic,s.view.positions]);
  const previousGeometry=useRef('');
  useEffect(()=>{
    const reset=geometryKey!==previousGeometry.current;previousGeometry.current=geometryKey;
    setNodes(previous=>visibleIds.map<OrgFlowNode>(id=>{const p=data.people.find(p=>p.id===id),position=s.positions.find(p=>p.id===id)!,entity=p||position;const old=previous.find(n=>n.id===id);return {...old,id,type:'org',position:!reset&&old?old.position:s.view.positions[id]||automatic[id]||{x:0,y:0},selected:id===selected,data:{label:p?p.name:position.title,title:entity.title,department:entity.department,photo:p?.photo||null,contact:p,showContacts:s.view.showContacts,vacant:!p,tags:entity.tagIds.flatMap(t=>data.tags.filter(tag=>tag.id===t)),showDepartments:s.view.showDepartments,showTags:s.view.showTags,dimmed:hasFilter&&!matchIds.has(id),inSubtree:subtree.has(id),dropTarget:dropTarget===id,collapsed:s.view.collapsedIds.includes(id),childCount:hierarchy.filter(r=>r.sourceId===id).length,descendantCount:descendants(id,hierarchy).size,editable:editing,onCollapse:()=>changeScenario(s=>({...s,view:{...s.view,positions:{},collapsedIds:s.view.collapsedIds.includes(id)?s.view.collapsedIds.filter(n=>n!==id):[...s.view.collapsedIds,id]}}),false)}};}));
  },[data.people,data.tags,s.positions,s.view,automatic,selected,matchIds,hasFilter,subtree,dropTarget,editing,hidden]);
  useEffect(()=>{const timer=setTimeout(()=>{void flow.fitView({padding:.15,maxZoom:.85,duration:500});},120);return()=>clearTimeout(timer);},[s.id,s.view.layoutType,relayout]);
  useEffect(()=>{if(!focusId)return;const p=s.view.positions[focusId]||automatic[focusId];if(p){void flow.setCenter(p.x+CARD_WIDTH/2,p.y+CARD_HEIGHT/2,{zoom:1,duration:600});}},[focusTick,focusId]);
  const edges:Edge[]=getVisibleRelationships(s).filter(r=>visibleIds.includes(r.sourceId)&&visibleIds.includes(r.targetId)).map(r=>{const type=data.relationshipTypes.find(t=>t.id===r.type)!;return {id:r.id,source:r.sourceId,target:r.targetId,type:r.type===s.view.layoutType?'smoothstep':'default',style:{stroke:type.color,strokeWidth:r.type===s.view.layoutType?1.5:1.3,strokeDasharray:type.lineStyle==='dashed'?'7 5':type.lineStyle==='dotted'?'2 5':undefined,opacity:.8},markerEnd:{type:MarkerType.ArrowClosed,width:12,height:12,color:type.color},data:{relationshipId:r.id}};});
  const connect=(c:Connection)=>{if(!editing)return;changeScenario(s=>({...addRelationship(s,{id:uid(),sourceId:c.source,targetId:c.target,type:s.view.layoutType,primary:!s.relationships.some(r=>r.type===s.view.layoutType&&r.targetId===c.target),scenarioId:s.id},data.relationshipTypes),view:{...s.view,positions:{}}}));};
  function targetAt(x:number,y:number,id:string){const element=document.elementsFromPoint(x,y).find(el=>el.closest('.react-flow__node')?.getAttribute('data-id')!==id&&el.closest('.react-flow__node'));return element?.closest('.react-flow__node')?.getAttribute('data-id')||null;}
  const dragStart=useRef<Record<string,{x:number;y:number}>>({});
  return <div className="diagram-area" data-testid="diagram"><ReactFlow<OrgFlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeClick={(_,node)=>onSelect(node.id)} onPaneClick={()=>onSelect(null)} nodesDraggable={editing} nodesConnectable={editing} elementsSelectable onConnect={connect} deleteKeyCode={null} minZoom={.08} maxZoom={1.8} fitView onlyRenderVisibleElements
    onNodeContextMenu={(event,node)=>{event.preventDefault();onSelect(node.id);onContext(node.id,event.clientX,event.clientY);}}
    onNodeDragStart={(_,node)=>{const ids=new Set([node.id,...descendants(node.id,hierarchy)]);dragStart.current=Object.fromEntries(flow.getNodes().filter(n=>ids.has(n.id)).map(n=>[n.id,{...n.position}]));}}
    onNodeDrag={(event,node)=>{const start=dragStart.current[node.id];if(start){const dx=node.position.x-start.x,dy=node.position.y-start.y;setNodes(ns=>ns.map(n=>n.id!==node.id&&dragStart.current[n.id]?{...n,position:{x:dragStart.current[n.id].x+dx,y:dragStart.current[n.id].y+dy}}:n));}const point=eventPoint(event),target=targetAt(point.clientX,point.clientY,node.id);setDropTarget(target&&!descendants(node.id,s.relationships.filter(r=>r.type===s.view.layoutType)).has(target)?target:null);}}
    onNodeDragStop={(event,node)=>{const point=eventPoint(event),target=targetAt(point.clientX,point.clientY,node.id);setDropTarget(null);if(target){setNodes(ns=>ns.map(n=>({...n,position:s.view.positions[n.id]||automatic[n.id]||n.position})));changeScenario(s=>({...moveSubtree(s,node.id,target,s.view.layoutType,data.relationshipTypes),view:{...s.view,positions:{}}}));}else{const current=flow.getNodes();changeScenario(s=>({...s,view:{...s.view,positions:{...s.view.positions,...Object.fromEntries(current.filter(n=>dragStart.current[n.id]).map(n=>[n.id,n.position]))}}}));}}}
    ><Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#cbd6ce"/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor={n=>n.id===selected?'#315f4e':'#b6cbbf'} maskColor="#f4f6f3b0" style={{width:150,height:95,border:'1px solid #dce3df',borderRadius:8}}/></ReactFlow>
    <Paper className="canvas-actions" shadow="xs" p={5} radius="md"><Group gap={4}><Button size="xs" variant="subtle" color="gray" leftSection={<IconLayoutDistributeHorizontal size={15}/>} onClick={()=>{changeScenario(s=>({...s,view:{...s.view,positions:{}}}),false);setRelayout(n=>n+1);}}>Rozložit</Button><Button size="xs" variant="subtle" color="gray" aria-label="Přizpůsobit obrazovce" onClick={()=>void flow.fitView({padding:.15,maxZoom:1,duration:500})}><IconFocus2 size={17}/></Button></Group></Paper>
    <div className="canvas-caption"><span className="live-dot"/><Text size="xs" c="dimmed">{visibleIds.length} uzlů · {edges.length} vztahů</Text></div>
    {dropTarget&&<div className="drop-preview">Přesunout celou větev pod: <strong>{data.people.find(p=>p.id===dropTarget)?.name||s.positions.find(p=>p.id===dropTarget)?.title}</strong></div>}
    {visibleIds.length===0&&<div className="canvas-empty">Žádné odpovídající uzly. Upravte filtry nebo vypněte „Pouze výsledky“.</div>}
  </div>;
}
