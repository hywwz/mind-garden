// Expansion is view state. Canonical nodes, records and saved world poses stay shared.
let branchInstalled=false,branchExpanded=new Set(['root']),branchView=null,branchNodesRef=null,branchDirty=true,branchLastTime=0;
const branchAmounts=new Map(),branchOrigins=new Map();
function branchChildren(id){return GardenLife.children(semanticNodes,id)}
function branchInvalidate(){branchDirty=true;}
function branchCompute(){
 if(!branchDirty&&branchNodesRef===semanticNodes&&branchView)return branchView;
 branchDirty=false;branchNodesRef=semanticNodes;const exposed=new Set(['root']),queue=['root'];
 for(let i=0;i<queue.length;i++){const id=queue[i];if(!branchExpanded.has(id))continue;for(const n of branchChildren(id))if(!exposed.has(n.id)){exposed.add(n.id);queue.push(n.id)}}
 const anchors=new Map(),groups=new Map();
 for(const n of semanticNodes.values())if(!exposed.has(n.id)){const seen=new Set([n.id]),parents=n.parents.length?n.parents:['root'],q=parents.map(id=>({id,depth:1}));let found=null;
  for(let i=0;i<q.length;i++){const at=q[i];if(exposed.has(at.id)){found=at;break}if(seen.has(at.id))continue;seen.add(at.id);for(const id of semanticNodes.get(at.id)?.parents||['root'])q.push({id,depth:at.depth+1})}
  found??={id:'root',depth:1};anchors.set(n.id,found.id);if(!groups.has(found.id))groups.set(found.id,[]);groups.get(found.id).push({id:n.id,depth:found.depth});
 }
 const hints=new Map();for(const[anchor,list]of groups){list.sort((a,b)=>a.depth-b.depth||a.id.localeCompare(b.id));list.forEach((item,i)=>hints.set(item.id,{anchor,index:i,shown:i<6,count:list.length}))}
 if(branchView)for(const id of exposed)if(!branchView.exposed.has(id)&&branchView.anchors.has(id))branchOrigins.set(id,branchView.anchors.get(id));
 branchView={exposed,anchors,hints};return branchView;
}
function branchRevealPath(id){if(id==='root'||branchCompute().exposed.has(id))return;const path=lifeOrigin(semanticNodes,id);for(const ancestor of path.slice(0,-1))branchExpanded.add(ancestor);branchInvalidate();}
function branchResolve(id){const view=branchCompute();return view.exposed.has(id)?id:view.anchors.get(id)||id;}
const branchRawProjection=readableProjection;
function branchCompact(p){const view=branchCompute(),hint=view.hints.get(p.id),anchorId=hint?.anchor||branchOrigins.get(p.id)||p.parent||'root',anchor=scene.get(anchorId)||scene.get('root'),q=anchor?branchRawProjection(anchor):branchRawProjection(p),index=hint?.index??0,angle=-Math.PI*.8+index*.61,radius=26+Math.floor(index/5)*8;return{x:q.x+Math.cos(angle)*radius,y:q.y+Math.sin(angle)*radius};}
readableProjection=function(p){if(!branchInstalled)return branchRawProjection(p);const view=branchCompute(),amount=branchAmounts.get(p.id)??(view.exposed.has(p.id)?1:0);if(p.id==='root')return branchRawProjection(p);if(!view.exposed.has(p.id)&&amount===0&&!view.hints.get(p.id)?.shown)return{x:NaN,y:NaN};const full=branchRawProjection(p),compact=branchCompact(p);return{x:compact.x+(full.x-compact.x)*amount,y:compact.y+(full.y-compact.y)*amount};};
const branchPriorPresent=semanticPresent;
semanticPresent=function(){
 if(!branchInstalled){branchPriorPresent();return}if(activeView!=='life')return;const view=branchCompute(),now=performance.now(),dt=Math.min(50,Math.max(0,now-(branchLastTime||now-16)));branchLastTime=now;
 for(const p of scene.values()){const desired=view.exposed.has(p.id)?1:0,old=branchAmounts.get(p.id)??desired;let amount=motionOff?desired:old+(desired-old)*(1-Math.exp(-dt/90));if(Math.abs(desired-amount)<.003)amount=desired;branchAmounts.set(p.id,amount);p.branchLabelled=!!desired&&amount>.35;p.branchLabelOpacity=amount;}
 branchPriorPresent();
 for(const p of scene.values()){if(p.exiting)continue;const exposed=view.exposed.has(p.id),amount=branchAmounts.get(p.id)??0,hint=view.hints.get(p.id),shown=exposed||amount>0||hint?.shown;p.el.dataset.branchState=exposed?(branchExpanded.has(p.id)?'expanded':'collapsed'):shown?'hint':'hidden';p.el.style.transform=`translate(-50%,-50%) scale(${.32+.68*amount})`;p.el.style.opacity=String(Math.max(!exposed&&shown?p.alpha*.26:0,Number(p.el.style.opacity||1)*(.3+.7*amount)));p.el.tabIndex=exposed?0:-1;p.el.setAttribute('aria-hidden',String(!exposed));
  const children=p.id==='root'?branchChildren('root'):branchChildren(p.id);if(exposed&&children.length){p.el.setAttribute('aria-expanded',String(branchExpanded.has(p.id)));p.el.setAttribute('aria-label',p.title+'，'+(branchExpanded.has(p.id)?'点击收起':'点击展开')+'，'+children.length+' 个下级步骤');}else p.el.removeAttribute('aria-expanded');
  let badge=p.el.querySelector('.branch-disclosure');if(!badge){badge=document.createElement('span');badge.className='branch-disclosure';badge.setAttribute('aria-hidden','true');p.el.appendChild(badge)}badge.hidden=!exposed||!children.length||amount<.9;badge.textContent=branchExpanded.has(p.id)?'−':'+';
  if(!exposed){const anchor=semanticNodes.get(view.anchors.get(p.id));p.el.title=(anchor?.title||'我想要的生活')+' · 点击展开后续步骤';if(!shown)p.el.style.visibility='hidden'}
  if(!p.branchLabelled){const label=readableLabels.get(p.id);if(label)label.style.display='none'}
 }
 for(const group of document.querySelectorAll('[data-semantic-edge]')){const a=group.dataset.from,b=group.dataset.to,amount=Math.min(branchAmounts.get(a)??0,branchAmounts.get(b)??0);group.style.opacity=String(Number(group.style.opacity||0)*amount);if(amount===0)group.style.opacity='0';}
};
function branchPlaceChildren(id,oldExposed){const box=$('#orbit'),parent=scene.get(id);if(!parent)return;const q=branchRawProjection(parent),left=46,right=box.clientWidth-46,top=205,card=$('#semanticInspector'),cardTop=card&&!card.hidden?card.getBoundingClientRect().top-box.getBoundingClientRect().top-65:Infinity,bottom=Math.max(top+60,Math.min(cardTop,box.clientHeight-(box.clientWidth<700?350:270))),nodes=branchChildren(id).filter(n=>!oldExposed.has(n.id)),taken=[...scene.values()].filter(p=>oldExposed.has(p.id)&&!p.exiting).map(branchRawProjection).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 for(let i=0;i<nodes.length;i++){const p=scene.get(nodes[i].id);if(!p)continue;const raw=branchRawProjection(p);if(db.graphPoses?.[networkKey()]?.[p.id]){taken.push(raw);continue}if(raw.x>left&&raw.x<right&&raw.y>top&&raw.y<bottom&&taken.every(t=>Math.hypot(t.x-raw.x,t.y-raw.y)>=68)){taken.push(raw);continue}const toward=Math.atan2((top+bottom)/2-q.y,box.clientWidth/2-q.x),spread=nodes.length===1?0:(i-(nodes.length-1)/2)*Math.min(.55,Math.PI*1.5/Math.max(1,nodes.length-1)),radius=125+Math.floor(i/7)*38;let point={x:Math.max(left,Math.min(right,q.x+Math.cos(toward+spread)*radius)),y:Math.max(top,Math.min(bottom,q.y+Math.sin(toward+spread)*radius))};
  for(let attempt=0;attempt<24&&taken.some(t=>Math.hypot(t.x-point.x,t.y-point.y)<68);attempt++)point={x:left+((i*83+attempt*43)%Math.max(1,right-left)),y:top+((i*61+attempt*29)%Math.max(1,bottom-top))};taken.push(point);const dx=(point.x-raw.x)/mapView.k,dy=(point.y-raw.y)/mapView.k;
  for(const at of gestureBranch(p.id).keys()){const child=scene.get(at);if(!child||oldExposed.has(at))continue;child.x+=dx;child.y+=dy;child.tx+=dx;child.ty+=dy;child.rx+=dx;child.ry+=dy;}
 }
}
function branchToggle(id){viewTarget=null;id=branchResolve(id);const old=new Set(branchCompute().exposed);let opening=false;branchRevealPath(id);if(branchChildren(id).length){if(branchExpanded.has(id)){branchExpanded.delete(id);branchInvalidate();const kept=branchCompute().exposed;for(const child of GardenLife.descendants(semanticNodes,id))if(child!==id&&!kept.has(child))branchExpanded.delete(child)}else{branchExpanded.add(id);branchInvalidate();opening=true}}branchInvalidate();semanticSelect(id);if(opening){branchPlaceChildren(id,old);semanticPresent()}scene.get(id)?.el.focus({preventScroll:true});}
const branchPriorFit=semanticFit;
function branchFit(instant=false){if(!branchInstalled)return branchPriorFit(instant);const view=branchCompute(),points=[...scene.values()].filter(p=>!p.exiting&&view.exposed.has(p.id));if(!points.length)return;const box=$('#orbit'),top=200,bottom=box.clientWidth<700?360:300,left=Math.min(...points.map(p=>Math.min(p.x,p.tx))),right=Math.max(...points.map(p=>Math.max(p.x,p.tx))),upper=Math.min(...points.map(p=>Math.min(p.y,p.ty))),lower=Math.max(...points.map(p=>Math.max(p.y,p.ty))),k=Math.max(.1,Math.min(1.1,(box.clientWidth-170)/Math.max(180,right-left),Math.max(130,box.clientHeight-top-bottom-60)/Math.max(150,lower-upper))),next={k,x:box.clientWidth/2-(left+right)/2*k,y:top+Math.max(130,box.clientHeight-top-bottom)/2-(upper+lower)/2*k};semanticUserView=false;if(instant||motionOff){mapView=next;viewTarget=null;applyView()}else viewTarget=next;}
const branchInstall=installSemanticMap;
installSemanticMap=function(){branchInstall();if(branchInstalled)return;branchInstalled=true;const initial=branchCompute();for(const p of scene.values())branchAmounts.set(p.id,initial.exposed.has(p.id)?1:0);
 const select=semanticSelect;semanticSelect=function(id){branchRevealPath(id);select(id)};
 activateNode=function(id){branchToggle(id)};
 const hit=lifeNearestMapNode;lifeNearestMapNode=function(e){if(Number.isFinite(e.clientX)&&Number.isFinite(e.clientY)){let nearest=null,distance=12;const exposed=branchCompute().exposed;for(const p of scene.values()){if(p.exiting||!exposed.has(p.id)||p.el.style.visibility==='hidden')continue;const r=p.el.getBoundingClientRect(),d=Math.hypot(e.clientX-r.x-r.width/2,e.clientY-r.y-r.height/2);if(d<distance){distance=d;nearest=p.el}}if(nearest)return nearest}const el=hit(e);if(!el)return el;return scene.get(branchResolve(el.dataset.mapId))?.el||el};
 const renderMap=renderOrbit;renderOrbit=function(){const before=new Set(['root',...semanticNodes.keys()]),beforeExposed=new Set(branchCompute().exposed);renderMap();branchInvalidate();if(semanticSelection&&semanticSelection!=='root'&&semanticNodes.has(semanticSelection)&&!branchCompute().exposed.has(semanticSelection))branchRevealPath(semanticSelection);const parents=new Set();for(const p of scene.values())if(!before.has(p.id)&&branchCompute().exposed.has(p.id)){branchAmounts.set(p.id,motionOff?1:0);parents.add(p.parent||'root')}for(const id of parents)branchPlaceChildren(id,beforeExposed);semanticPresent()};
 const home=semanticHome;semanticHome=function(){branchExpanded=new Set(['root']);branchInvalidate();home()};$('#lifeHome').onclick=semanticHome;
 const near=semanticNear;semanticNear=function(id){branchRevealPath(id);branchExpanded.add(id);branchInvalidate();near(id)};
 semanticFit=branchFit;
 // Newly revealed labels are keyboard targets as well as drag handles.
 const labelFactory=readableLabel;readableLabel=function(id,title){const el=labelFactory(id,title);if(!el.dataset.branchClick){el.dataset.branchClick='yes';el.addEventListener('click',e=>{if(e.detail===0)activateNode(id)})}return el};
 semanticPresent();if(activeView==='life')semanticFit(true);
};
