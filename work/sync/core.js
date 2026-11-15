(function(root){
  'use strict';
  const keys=['goals','ideas','evidence','placements','chores','logs'];
  const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
  function stable(v){if(v===undefined)return 'undefined';if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}'}
  const equal=(a,b)=>stable(a)===stable(b);
  function data(db){const value={};for(const key of keys)value[key]=copy(db[key]||[]);return value;}
  function graph(data){const nodes=new Map(),add=(n,parent)=>{if(nodes.has(n.id))throw Error('生活图有重复节点');const parents=n.parents===undefined?(parent?[parent]:[]):n.parents;if(!Array.isArray(parents)||parents.some(p=>typeof p!=='string'))throw Error('关联没有读完整');nodes.set(n.id,parents)};for(const g of data.goals||[]){add(g);for(const s of g.skills||[]){add(s,g.id);for(const a of s.actions||[])add(a,s.id)}for(const n of g.nodes||[])add(n,g.id)}for(const a of [...(data.chores||[]),...(data.ideas||[]).flatMap(i=>i.actions||[])])if(a.parents?.some(p=>nodes.has(p)))add(a);const state=new Map();for(const [id,parents]of nodes){for(const parent of parents)if(!nodes.has(parent))throw Error('关联的上层已变化，请选择保留的内容');if(state.get(id)===2)continue;const stack=[[id,false]];while(stack.length){const [at,exit]=stack.pop();if(exit){state.set(at,2);continue}if(state.get(at)===1)throw Error('两边的关联绕回了自身，请选择保留的内容');if(state.get(at)===2)continue;state.set(at,1);stack.push([at,true]);for(const p of nodes.get(at)||[])stack.push([p,false])}}}
  function validate(state){
    if(!state||state.format!=='mind-garden-sync-v1'||!state.data||!state.files||typeof state.files!=='object'||Array.isArray(state.files))throw Error('云端内容不是心之林的同步文件');
    function list(items){if(!Array.isArray(items))throw Error('同步内容不完整');const seen=new Set();for(const item of items){if(!item||typeof item!=='object'||typeof item.id!=='string'||!/^[\w-]{1,128}$/.test(item.id)||seen.has(item.id))throw Error('同步内容里有重复或无效编号');seen.add(item.id)}}
    for(const key of keys)list(state.data[key]);
    for(const goal of state.data.goals){if(typeof goal.title!=='string')throw Error('愿望没有读完整');list(goal.skills);list(goal.nodes||[]);for(const node of goal.nodes||[])if(typeof node.title!=='string'||!['branch','action'].includes(node.kind))throw Error('分支内容没有读完整');for(const skill of goal.skills){if(typeof skill.title!=='string')throw Error('能力没有读完整');list(skill.actions);for(const action of skill.actions)if(typeof action.title!=='string')throw Error('行动没有读完整')}}
    for(const idea of state.data.ideas){if(typeof idea.title!=='string')throw Error('灵感没有读完整');list(idea.files||[]);list(idea.actions||[]);list(idea.blocks||[]);for(const file of idea.files||[]){if(!Number.isSafeInteger(file.size)||file.size<0||file.size>20*1024*1024||!/^[a-f0-9]{64}$/.test(state.files[file.id]||''))throw Error('附件信息没有读完整')}}
    graph(state.data);return state;
  }
  function merge(base,local,remote){
    const conflicts=[];
    function visit(b,l,r,path){
      if(equal(l,r))return copy(l);if(equal(l,b))return copy(r);if(equal(r,b))return copy(l);
      if(Array.isArray(l)&&Array.isArray(r)&&(!b||Array.isArray(b))&&[...(b||[]),...l,...r].every(v=>v&&typeof v==='object'&&typeof v.id==='string')){
        const bm=new Map((b||[]).map(v=>[v.id,v])),lm=new Map(l.map(v=>[v.id,v])),rm=new Map(r.map(v=>[v.id,v]));const ids=[...new Set([...(b||[]).map(v=>v.id),...[...new Set([...lm.keys(),...rm.keys()])].filter(id=>!bm.has(id)).sort()])];const result=[];
        for(const id of ids){const value=visit(bm.get(id),lm.get(id),rm.get(id),path.concat(id));if(value!==undefined)result.push(value)}return result;
      }
      if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)&&(b===undefined||(b&&typeof b==='object'&&!Array.isArray(b)))){
        const result=Object.create(null);for(const key of [...new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])].sort()){const value=visit(b?.[key],l[key],r[key],path.concat(key));if(value!==undefined)result[key]=value}return result;
      }
      conflicts.push(path.join('/'));return copy(l);
    }
    const value=visit(base,local,remote,[]);
    // Concurrently deleting an action while the other device records it needs a decision.
    const actionIds=d=>new Set([...(d?.goals||[]).flatMap(g=>[g.id,...g.skills.flatMap(s=>[s.id,...s.actions.map(a=>a.id)]),...(g.nodes||[]).map(n=>n.id)]),...(d?.ideas||[]).flatMap(i=>(i.actions||[]).map(a=>a.id)),...(d?.chores||[]).map(a=>a.id)]);
    if(value?.data){const mergedIds=actionIds(value.data),either=new Set([...actionIds(local.data),...actionIds(remote.data)]);for(const key of ['placements','logs','evidence']){const original=new Map((base?.data?.[key]||[]).map(v=>[v.id,v]));for(const record of value.data[key]||[])if(record.actionId&&!mergedIds.has(record.actionId)&&either.has(record.actionId)&&!equal(record,original.get(record.id)))conflicts.push('data/'+key+'/'+record.id)}}
    if(value?.data)try{graph(value.data)}catch{conflicts.push('data/goals')}
    return {value,conflicts};
  }
  const empty=()=>({format:'mind-garden-sync-v1',data:Object.fromEntries(keys.map(k=>[k,[]])),files:{}});
  const api={keys,copy,stable,equal,data,validate,merge,empty};root.GardenSyncCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
