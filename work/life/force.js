// The same damped spring and cooling behavior as the approved graph preview.
let forceRemaining=0,forceDeadline=0,forcePendingSave=false,forceRest=new Map();
function forceWake(seconds=3.5){forceRemaining=seconds;forceDeadline=performance.now()+seconds*1000;forceRest=new Map();for(const[a,b]of edges){const p=scene.get(a),q=scene.get(b);if(p&&q)forceRest.set(a+'|'+b,Math.max(a==='root'?160:140,Math.hypot(q.tx-p.tx,q.ty-p.ty)))}}
const forceToggle=branchToggle;branchToggle=function(id){forceToggle(id);forceWake()};
const forceMove=moveBranch;
moveBranch=function(dx,dy){if(!drag?.id)return;if(motionOff){forceMove(dx,dy);return}if(!drag.forceStarted){forceWake();drag.forceStarted=true}forceRemaining=2;forceDeadline=performance.now()+2000;
 const sx=dx-(drag.dx||0),sy=dy-(drag.dy||0);drag.dx=dx;drag.dy=dy;
 for(const[id,start]of drag.positions||[]){const p=scene.get(id);if(!p)continue;p.tx=start.x+dx;p.ty=start.y+dy;if(id===drag.id){p.x=p.tx;p.y=p.ty;p.vx=p.vy=0}else{p.x+=sx*.56;p.y+=sy*.56;p.vx=(p.vx||0)+sx*5;p.vy=(p.vy||0)+sy*5}}
 scene.get(drag.id)?.el.classList.add('being-dragged');$('#orbit').classList.add('dragging-branch','has-moved');
};
const forceRelease=releaseBranch;releaseBranch=function(d){forceRelease(d);if(!d?.id||!d.moved||motionOff)return;forceRemaining=3;forceDeadline=performance.now()+3000;forcePendingSave=true;const p=scene.get(d.id);if(p)p.forcePin=3.2};
function forceFreeze(){for(const p of scene.values()){if(!Number.isFinite(p.x)||!Number.isFinite(p.y)){p.x=p.tx;p.y=p.ty}p.vx=p.vy=0;p.forcePin=0;if(forcePendingSave){p.tx=p.x;p.ty=p.y}p.rx=p.x;p.ry=p.y}if(forcePendingSave){forcePendingSave=false;gesturePose()}}
stepNetwork=function(t,dt){
 if(motionOff){for(const p of scene.values()){p.x=p.tx;p.y=p.ty;p.vx=p.vy=0}forceRemaining=0;forcePendingSave=false;return}
 if(forceRemaining<=0){for(const p of scene.values()){p.vx=p.vy=0}return}
 const seconds=Math.min(40,dt)/1000;forceRemaining=Math.max(0,(forceDeadline-performance.now())/1000);if(forceRemaining===0){forceFreeze();return}
 const exposed=branchCompute().exposed,ps=[...scene.values()].filter(p=>!p.exiting&&exposed.has(p.id)),held=drag?.moved?drag.id:null;
 for(const p of scene.values())if(!exposed.has(p.id)){p.x=p.tx;p.y=p.ty;p.vx=p.vy=0}
 for(let sub=0;sub<2;sub++){
  const h=seconds/2,heat=Math.min(1,forceRemaining/1.3),f=new Map(ps.map(p=>[p.id,{x:0,y:0}]));
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
   const a=ps[i],b=ps[j];let dx=b.x-a.x,dy=b.y-a.y,dd=dx*dx+dy*dy;if(dd<1){dx=i%2?.3:-.3;dy=.3;dd=.2}const distance=Math.sqrt(dd),push=Math.min(220,300000/(dd+1600)),fx=dx/distance*push,fy=dy/distance*push;f.get(a.id).x-=fx;f.get(a.id).y-=fy;f.get(b.id).x+=fx;f.get(b.id).y+=fy;
   if(Math.abs(dx)<Math.min(220,Math.max(a.title.length,b.title.length)*9+40)&&Math.abs(dy)<72){const push=(72-Math.abs(dy))*2.2,sign=dy>=0?1:-1;f.get(a.id).y-=push*sign;f.get(b.id).y+=push*sign}
  }
  for(const[a,b]of edges){const p=scene.get(a),q=scene.get(b);if(!p||!q||!f.has(a)||!f.has(b))continue;const dx=q.x-p.x,dy=q.y-p.y,d=Math.max(1,Math.hypot(dx,dy)),rest=forceRest.get(a+'|'+b)??Math.max(a==='root'?160:140,Math.hypot(q.tx-p.tx,q.ty-p.ty)),spring=(d-rest)*4.5,fx=dx/d*spring,fy=dy/d*spring;f.get(a).x+=fx;f.get(a).y+=fy;f.get(b).x-=fx;f.get(b).y-=fy}
  for(const p of ps){if(p.id===held){p.vx=p.vy=0;continue}const v=f.get(p.id),anchor=p.forcePin>0?4:p.id==='root'?.75:.12;p.forcePin=Math.max(0,(p.forcePin||0)-h);v.x+=(p.tx-p.x)*anchor;v.y+=(p.ty-p.y)*anchor;const damping=Math.exp(-(3.1+(1-heat)*8)*h);p.vx=((p.vx||0)+v.x*heat*h)*damping;p.vy=((p.vy||0)+v.y*heat*h)*damping;p.x+=Math.max(-650,Math.min(650,p.vx))*h;p.y+=Math.max(-650,Math.min(650,p.vy))*h}
 }
 networkResetUntil=0;
};
const forceRender=renderOrbit;renderOrbit=function(){const signature=()=>[...scene.values()].filter(p=>!p.exiting).map(p=>p.id+':'+p.tx+':'+p.ty).join('|'),before=signature();forceRender();if(activeView==='life'&&signature()!==before)queueMicrotask(()=>forceWake())};
