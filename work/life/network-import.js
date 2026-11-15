(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x)),safe=id=>typeof id==='string'&&/^[\w-]{1,128}$/.test(id),fail=message=>{throw Error(message)};
function namespace(title){let h=2166136261;for(const c of title){h^=c.codePointAt(0);h=Math.imul(h,16777619)}return 'net-'+(h>>>0).toString(16)}
function convert(raw,selectedIds){
 if(!raw||!Array.isArray(raw.nodes)||!Array.isArray(raw.edges))fail('不是节点与连线文件');
 const index=new Map(),parents=new Map();for(const n of raw.nodes){if(!n||!safe(n.id)||index.has(n.id)||typeof n.title!=='string'||!n.title.trim()||!Number.isInteger(n.level)||n.level<1||n.level>6)fail('节点编号、标题或层级无效');index.set(n.id,n);parents.set(n.id,[])}
 const roots=raw.nodes.filter(n=>n.level===1);if(roots.length!==1)fail('需要一个人生愿望总节点');const rootNode=roots[0],dedup=new Set(),cross=[];
 for(const e of raw.edges){if(!index.has(e.source)||!index.has(e.target)||e.source===e.target||!['decomposes','supports','enables'].includes(e.kind))fail('存在无效连线');const key=e.kind+'|'+e.source+'|'+e.target;if(dedup.has(key))fail('存在重复连线');dedup.add(key);if(e.kind==='decomposes'){if(index.get(e.target).level!==index.get(e.source).level+1)fail('拆解连线层级不连续');parents.get(e.target).push(e.source)}else cross.push(e)}
 for(const n of raw.nodes)if(n.id!==rootNode.id&&!parents.get(n.id).length)fail('有节点缺少上层拆解路径');
 const hasChildren=new Set(raw.edges.filter(e=>e.kind==='decomposes').map(e=>e.source));for(const n of raw.nodes)if(n.level===6&&(hasChildren.has(n.id)||n.can_add_to_today!==true))fail('最小行动必须是末端且明确允许加入今天');
 const selected=selectedIds?new Set(selectedIds):new Set(index.keys());for(const id of [...selected])if(!index.has(id))fail('试验分支节点不存在');for(const n of [...raw.nodes].sort((a,b)=>b.level-a.level))if(selected.has(n.id))for(const id of parents.get(n.id))selected.add(id);
 const title=String(raw.meta?.title||rootNode.title),dataset=namespace(title),mapped=id=>dataset+'-'+id,record=n=>({id:mapped(n.id),title:n.title,kind:n.level===6?'action':'branch',parents:parents.get(n.id).map(mapped),stage:n.phase==='later'?'later':'now',reviewOn:'',why:n.description||'',description:n.description||'',doneCriteria:n.done_criteria||'',durationMinutes:n.duration_minutes??null,evidenceHint:n.evidence||'',priority:n.phase||'',networkImport:{dataset,documentTitle:title,sourceId:n.id,level:n.level,canAddToToday:n.level===6&&n.can_add_to_today===true,raw:copy(n)}});
 const goal={...record(rootNode),skills:[],nodes:raw.nodes.filter(n=>n.id!==rootNode.id&&selected.has(n.id)).sort((a,b)=>a.level-b.level||a.id.localeCompare(b.id)).map(record),networkDocument:copy(raw.meta||{}),networkRelations:cross.filter(e=>selected.has(e.source)&&selected.has(e.target)).map(e=>({id:dataset+'-'+e.kind+'-'+e.source+'-'+e.target,source:mapped(e.source),target:mapped(e.target),kind:e.kind,reason:e.reason||''}))};delete goal.kind;goal.networkImportedRelations=goal.networkRelations.map(e=>({id:e.id}));
 return {format:'mind-garden-network-import-v1',version:1,source:{dataset,title,rootId:mapped(rootNode.id)},goals:[goal]};
}
function validatePacket(packet,model){
 if(packet?.format!=='mind-garden-network-import-v1'||packet.version!==1||!Array.isArray(packet.goals)||!packet.goals.length||!safe(packet.source?.dataset))fail('不是兼容的生活图导入文件');
 const nodes=model.validate({goals:packet.goals,chores:[],ideas:[]});for(const n of nodes.values()){const mark=n.record.networkImport;if(mark?.dataset!==packet.source.dataset||!safe(mark.sourceId)||!Number.isInteger(mark.level)||mark.level<1||mark.level>6||n.id!==mark.dataset+'-'+mark.sourceId)fail('导入来源或节点层级不完整');if(mark.level===6&&(n.kind!=='action'||model.children(nodes,n.id).length||mark.canAddToToday!==true))fail('行动节点不是合法末端');if(mark.level<6&&n.kind==='action')fail('只有第六层能标记为行动');for(const p of n.parents)if(nodes.get(p).record.networkImport.level!==mark.level-1)fail('拆解路径的层级不正确')}
 const relations=new Set();for(const g of packet.goals){if(g.networkImport.level!==1||!Array.isArray(g.skills)||g.skills.length)fail('总节点格式无效');for(const r of g.networkRelations||[]){if(!safe(r.id)||relations.has(r.id)||!nodes.has(r.source)||!nodes.has(r.target)||r.source===r.target||!['supports','enables'].includes(r.kind)||typeof r.reason!=='string')fail('交叉关联无效');relations.add(r.id)}}return nodes;
}
function merge(current,packet,model){
 const incoming=validatePacket(packet,model),next=copy(current);next.goals||=[];const existing=model.validate(next);let added=0,skipped=0,relationsAdded=0;
 for(const n of incoming.values()){const prior=existing.get(n.id);if(prior&&(prior.record.networkImport?.dataset!==n.record.networkImport.dataset||prior.record.networkImport?.sourceId!==n.record.networkImport.sourceId||prior.record.networkImport?.documentTitle!==n.record.networkImport.documentTitle))fail('编号与已有内容冲突，未导入任何内容')}
 for(const goal of packet.goals){let owner=next.goals.find(g=>g.id===goal.id);if(!owner){owner=copy(goal);owner.nodes=[];owner.networkRelations=[];owner.networkImportedRelations=[];next.goals.push(owner);added++}else skipped++;
  for(const n of goal.nodes){if(existing.has(n.id)){skipped++;continue}owner.nodes.push(copy(n));added++}
  const seen=new Set([...(owner.networkImportedRelations||[]).map(r=>r.id),...(owner.networkRelations||[]).map(r=>r.id)]);for(const r of goal.networkRelations||[])if(!seen.has(r.id)){(owner.networkRelations||=[]).push(copy(r));(owner.networkImportedRelations||=[]).push({id:r.id});seen.add(r.id);relationsAdded++}
 }
 model.validate(next);return {data:next,added,skipped,relationsAdded};
}
function canSchedule(model,db,id){const nodes=model.index(db),n=nodes.get(id);if(!n)return true;if(n.kind==='wish'||model.children(nodes,id).length)return false;const source=n.record.networkImport;return !source||(source.level===6&&source.canAddToToday===true&&n.kind==='action')}
root.GardenNetwork={convert,validatePacket,merge,canSchedule};if(typeof module!=='undefined'&&module.exports)module.exports=root.GardenNetwork;
})(typeof globalThis!=='undefined'?globalThis:this);
