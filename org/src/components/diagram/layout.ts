import dagre from '@dagrejs/dagre';
import type { Scenario } from '../../domain/models';
import { getPrimaryHierarchy } from '../../domain/graph';
export const CARD_WIDTH=236,CARD_HEIGHT=114;
export function layoutNodes(ids:string[],s:Scenario):Record<string,{x:number;y:number}>{
  const cardHeight=CARD_HEIGHT+(s.view.showContacts?65:0);
  const edges=getPrimaryHierarchy(s,s.view.layoutType).filter(r=>ids.includes(r.sourceId)&&ids.includes(r.targetId));
  const connected=new Set(edges.flatMap(r=>[r.sourceId,r.targetId])),orphans=ids.filter(id=>!connected.has(id));
  const graph=new dagre.graphlib.Graph().setDefaultEdgeLabel(()=>({}));graph.setGraph({rankdir:'TB',nodesep:32,ranksep:78,marginx:50,marginy:50});
  [...connected].forEach(id=>graph.setNode(id,{width:CARD_WIDTH,height:cardHeight}));
  edges.forEach(r=>graph.setEdge(r.sourceId,r.targetId));
  if(connected.size)dagre.layout(graph);
  const result:Record<string,{x:number;y:number}>=Object.fromEntries([...connected].map(id=>{const p=graph.node(id);return [id,{x:p.x-CARD_WIDTH/2,y:p.y-cardHeight/2}];}));
  const bottom=connected.size?Math.max(...Object.values(result).map(p=>p.y))+cardHeight+100:50;
  const columns=Math.min(5,Math.max(1,Math.ceil(Math.sqrt(orphans.length))));
  orphans.forEach((id,index)=>{result[id]={x:50+(index%columns)*(CARD_WIDTH+32),y:bottom+Math.floor(index/columns)*(cardHeight+55)};});
  return result;
}
