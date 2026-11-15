// One owner for graph input. Camera coordinates are screen pixels; poses are world units.
let gardenGesturesInstalled=false,gestureMotionClock=0,gestureMotionLast=0,gestureMotionMigrated=false;
// The old middle setting becomes the gentle, bounded version of the full effect.
const gestureNormalizePreferences=normalizePreferences;
normalizePreferences=function(){gestureNormalizePreferences();if(db.preferences.motion==='reduced'){db.preferences.motion='full';gestureMotionMigrated=true}};
const gestureApplyAppearance=applyAppearance;
applyAppearance=function(){const before=motionOff,targets=new Map([...scene.values()].map(p=>[p.id,{x:p.tx,y:p.ty}]));gestureApplyAppearance();if(motionOff&&!before)for(const p of scene.values()){const target=targets.get(p.id);if(target&&Number.isFinite(target.x)&&Number.isFinite(target.y)){p.tx=p.x=target.x;p.ty=p.y=target.y;p.vx=p.vy=0}}if(gestureMotionMigrated){gestureMotionMigrated=false;save()}};
const gesturePresent=semanticPresent;
semanticPresent=function(){
 const now=performance.now(),dt=Math.min(50,Math.max(0,now-(gestureMotionLast||now)));gestureMotionLast=now;
 if(!motionOff&&!pointers.size&&!drag?.moved)gestureMotionClock+=dt;
 // Visible, slow movement is measured in screen pixels, including at strong zoom.
 // Freeze the phase during input so a node remains under the pointer when grabbed.
 for(const p of scene.values()){if(p.exiting)continue;const k=Math.max(1e-9,mapView.k),swayX=0,swayY=0;p.rx=p.x+swayX/k;p.ry=p.y+swayY/k}
 gesturePresent();
 for(const group of document.querySelectorAll('[data-semantic-edge]')){const from=group.dataset.from,to=group.dataset.to,moving=!motionOff&&!!drag?.moved&&!!drag.id&&(from===drag.id||to===drag.id||(drag.positions?.has(from)&&drag.positions?.has(to)));group.classList.toggle('gesture-moving-link',!!moving);if(moving&&Number(group.style.opacity)>0)group.style.opacity=String(Math.max(.64,Number(group.style.opacity)));}
};
function gesturePose(){const pose={};for(const p of scene.values())if(!p.exiting)pose[p.id]={x:p.tx??p.x,y:p.ty??p.y};db.graphPoses??={};db.graphPoses[networkKey()]=pose;save();}
persistNetworkPose=gesturePose;
function gestureBranch(id){const ids=id==='root'?new Set(scene.keys()):GardenLife.descendants(lifeIndex(),id);return new Map([...ids].filter(id=>scene.has(id)).map(id=>{const p=scene.get(id);return[id,{x:p.x,y:p.y}]}))}
moveBranch=function(dx,dy){if(!drag?.id)return;const shiftX=dx-(drag.dx||0),shiftY=dy-(drag.dy||0);drag.dx=dx;drag.dy=dy;for(const[id,start]of drag.positions||[]){const p=scene.get(id);if(!p)continue;p.tx=start.x+dx;p.ty=start.y+dy;if(id===drag.id||motionOff){p.x=p.tx;p.y=p.ty;p.rx=p.x;p.ry=p.y;p.vx=p.vy=0}else{p.x+=shiftX*.82;p.y+=shiftY*.82}}scene.get(drag.id)?.el.classList.add('being-dragged');$('#orbit').classList.add('dragging-branch','has-moved');};
releaseBranch=function(d){$('#orbit').classList.remove('dragging-branch');scene.get(d?.id)?.el.classList.remove('being-dragged');if(!d?.id||!d.moved)return;clearTimeout(networkSaveTimer);networkSaveTimer=null;for(const link of networkLinks){const a=scene.get(link.aId),b=scene.get(link.bId);if(a&&b){link.dx=b.tx-a.tx;link.dy=b.ty-a.ty;link.length=Math.hypot(link.dx,link.dy)}}gesturePose();};
// Elastic followers settle on the chosen position. Old link limits must not pull it back.
stepNetwork=function(t,dt){const seconds=Math.min(dt,40)/1000,held=drag?.moved?drag.id:null;for(const p of scene.values()){if(p.exiting)continue;if(p.id===held||motionOff){p.x=p.tx;p.y=p.ty;p.vx=p.vy=0;continue}let remaining=seconds;p.vx??=0;p.vy??=0;while(remaining>0){const h=Math.min(remaining,1/120);remaining-=h;const damping=Math.exp(-23*h);p.vx=(p.vx+(p.tx-p.x)*170*h)*damping;p.vy=(p.vy+(p.ty-p.y)*170*h)*damping;p.x+=p.vx*h;p.y+=p.vy*h}if(Math.hypot(p.tx-p.x,p.ty-p.y)*mapView.k<.08&&Math.hypot(p.vx,p.vy)*mapView.k<.1){p.x=p.tx;p.y=p.ty;p.vx=p.vy=0}}networkResetUntil=0;};
const gestureInstallMap=installSemanticMap;
installSemanticMap=function(){gestureInstallMap();if(gardenGesturesInstalled)return;gardenGesturesInstalled=true;const box=$('#orbit');
 for(const button of document.querySelectorAll('[data-preference="motion"][data-value="reduced"]'))button.remove();$('#preference-motion')?.querySelector('option[value="reduced"]')?.remove();
 const hit=lifeNearestMapNode;lifeNearestMapNode=function(e){if(Number.isFinite(e.clientX)&&Number.isFinite(e.clientY)){let best=null,distance=12;for(const p of scene.values()){if(p.exiting||p.el.style.visibility==='hidden')continue;const r=p.el.getBoundingClientRect(),d=Math.hypot(e.clientX-r.x-r.width/2,e.clientY-r.y-r.height/2);if(d<distance){best=p.el;distance=d}}if(best)return best}return hit(e)};
 const edit=lifeEdit;lifeEdit=function(id){edit(id);const n=lifeIndex().get(id);if(!n)return;const note=n.record.why||n.record.desc||'',paused=n.record.stage==='later';$('#dialogTitle').textContent='编辑内容';$('#dialogFields').insertAdjacentHTML('beforeend',`<details class="simple-extra" ${note?'open':''}><summary>补充一句</summary><label class="field" for="field-why">备注</label><textarea name="why" id="field-why" maxlength="1200">${esc(note)}</textarea></details><details class="simple-extra" ${paused||n.record.reviewOn?'open':''}><summary>暂缓${paused?' · 已开启':''}</summary><label class="gesture-pause-switch" for="field-paused"><span>暂缓</span><input type="checkbox" name="paused" id="field-paused" value="1" ${paused?'checked':''}></label><label class="field" for="field-reviewOn">哪天再看（可选）</label><input type="date" class="input" name="reviewOn" id="field-reviewOn" value="${esc(n.record.reviewOn||'')}"></details>`);const submit=dialogSubmit;dialogSubmit=d=>{if(d.reviewOn&&!validDay(d.reviewOn)){toast('请选择有效日期');return false}const result=submit(d);if(result!==false){n.record.why=d.why||'';n.record.desc='';n.record.stage=d.paused==='1'?'later':'now';n.record.reviewOn=d.reviewOn||''}return result};};
 const fitMenu=()=>{const opened=$('.simple-node-more[open]');if(!opened)return;const menu=opened.querySelector('.simple-node-menu');menu.style.maxHeight=Math.max(80,Math.min(304,opened.getBoundingClientRect().top-100))+'px';};
 box.addEventListener('toggle',e=>{if(e.target.matches('.simple-node-more'))fitMenu()},true);window.addEventListener('resize',fitMenu);
 if(typeof constrainPhoneNodes==='function')constrainPhoneNodes=()=>{};
 const interactive='.map-controls,.life-path,.semantic-inspector,.phone-map-actions,.web-life-actions,.desktop-life-menu,.phone-life-empty,.web-life-empty,.desktop-life-empty,.simple-life-empty';
 const stop=e=>{e.preventDefault();e.stopImmediatePropagation()};
 const begin=(id,at,node,moved=false)=>{viewTarget=null;semanticUserView=true;if(typeof phoneAutoBounds!=='undefined')phoneAutoBounds=false;drag={id:node?.id,pointerId:id,startX:at.x,startY:at.y,viewX:mapView.x,viewY:mapView.y,x:node?.x,y:node?.y,moved,positions:node?gestureBranch(node.id):null,dx:0,dy:0};};
 const reset=()=>{releaseBranch(drag);drag=null;pinch=null;semanticPinch=null;const ids=[...pointers.keys()];pointers.clear();for(const id of ids)try{box.releasePointerCapture(id)}catch{}box.classList.remove('is-panning','dragging-branch');};
 box.addEventListener('pointerdown',e=>{if(activeView!=='life'||e.target.closest(interactive)||![0,1].includes(e.button))return;
  const nodeEl=lifeNearestMapNode(e);if(!nodeEl&&e.target.closest('button,input,summary,a'))return;stop(e);if(e.pointerType==='mouse'&&pointers.size)reset();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{box.setPointerCapture(e.pointerId)}catch{}
  if(pointers.size===1)begin(e.pointerId,{x:e.clientX,y:e.clientY},e.button===1?null:scene.get(nodeEl?.dataset.mapId));
  else if(pointers.size===2){releaseBranch(drag);drag=null;const[a,b]=[...pointers.values()],r=box.getBoundingClientRect();pinch=Math.hypot(a.x-b.x,a.y-b.y);semanticPinch={x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top};}
 },true);
 box.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;stop(e);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const[a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),r=box.getBoundingClientRect();if(pinch&&distance>0)zoomMap(distance/pinch,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch=distance;return}
  if(!drag)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.hypot(dx,dy)>4)drag.moved=true;if(!drag.moved)return;if(drag.id)moveBranch(dx/mapView.k,dy/mapView.k);else{box.classList.add('is-panning');mapView.x=drag.viewX+dx;mapView.y=drag.viewY+dy;applyView()}semanticPresent();
 },true);
 const finish=e=>{if(!pointers.has(e.pointerId))return;stop(e);const d=drag,wasPinch=pointers.size>1||!!pinch;releaseBranch(d);pointers.delete(e.pointerId);drag=null;try{box.releasePointerCapture(e.pointerId)}catch{}box.classList.remove('is-panning','dragging-branch');
  if(pointers.size===1){const[id,at]=[...pointers][0];pinch=null;semanticPinch=null;begin(id,at,null,true)}else if(!pointers.size){pinch=null;semanticPinch=null}
  if(e.type==='pointerup'&&!wasPinch&&d&&!d.moved&&d.id)activateNode(d.id);
 };
 for(const type of ['pointerup','pointercancel','lostpointercapture'])box.addEventListener(type,finish,true);
 box.addEventListener('wheel',e=>{if(e.target.closest(interactive)){e.stopImmediatePropagation();return}stop(e);const r=box.getBoundingClientRect();if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){viewTarget=null;semanticUserView=true;mapView.x-=e.deltaX||e.deltaY;mapView.y-=e.deltaX?e.deltaY:0;applyView()}else zoomMap(Math.exp(Math.max(-.65,Math.min(.65,-e.deltaY*.001))),e.clientX-r.left,e.clientY-r.top);
  if(drag&&pointers.size===1){const[id,at]=[...pointers][0],node=scene.get(drag.id),moved=drag.moved;releaseBranch(drag);begin(id,at,node,moved)}semanticPresent();
 },{capture:true,passive:false});
 window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
};
