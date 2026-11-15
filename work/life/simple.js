// A quiet surface over the existing graph and records. No data migration.
let simpleInstalled=false, simpleReturnFocus=null;
const simpleIcons={
 plus:'<path d="M12 5v14M5 12h14"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 arrow:'<path d="m9 5 7 7-7 7"/>', back:'<path d="m15 5-7 7 7 7"/>',
 check:'<path d="m5 12 4 4L19 6"/>', settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
 leaf:'<path d="M19 4C8 3 3 8 5 15c6 4 15-1 14-11ZM5 20 15 9"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
 sync:'<path d="M20 9a8 8 0 0 0-14-4L3 8m0-5v5h5M4 15a8 8 0 0 0 14 4l3-3m0 5v-5h-5"/>',
 archive:'<path d="M4 8h16v13H4zM3 3h18v5H3zM9 12h6"/>'
};
function simpleIcon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${simpleIcons[name]||simpleIcons.arrow}</svg>`}
function simpleAction(action,id,label,cls=''){return `<button type="button" class="${cls}" data-simple="${action}" data-id="${esc(id)}">${label}</button>`}
function simpleFocus(id){const nodes=lifeIndex();selectedNode=id;semanticSelection=id;lifeTrail=lifeOrigin(nodes,id);networkSignature='';}
// Leave room for the compact card when framing the map; selecting stays still.
semanticFit=function(instant=false){semanticUserView=false;const points=activePoints();if(!points.length)return;const box=$('#orbit'),top=190,bottom=box.clientWidth<700?360:300,left=Math.min(...points.map(p=>Math.min(p.x,p.tx??p.x))),right=Math.max(...points.map(p=>Math.max(p.x,p.tx??p.x))),upper=Math.min(...points.map(p=>Math.min(p.y,p.ty??p.y))),lower=Math.max(...points.map(p=>Math.max(p.y,p.ty??p.y))),k=Math.max(.1,Math.min(1.1,(box.clientWidth-130)/Math.max(140,right-left),Math.max(130,box.clientHeight-top-bottom-50)/Math.max(120,lower-upper))),next={k,x:box.clientWidth/2-(left+right)/2*k,y:top+Math.max(130,box.clientHeight-top-bottom)/2-(upper+lower)/2*k};if(instant||motionOff){mapView=next;viewTarget=null;applyView()}else viewTarget=next;};
lifePathHTML=nodes=>{const path=lifeTrail,button=(id,current)=>`<button data-sem="path" data-id="${esc(id)}" ${current?'aria-current="location"':''}>${esc(nodes.get(id)?.title||'总览')}</button>`;return path.length>3?button('root',false)+'<span aria-hidden="true">›</span><button data-simple="path" aria-label="查看完整路径">···</button><span aria-hidden="true">›</span>'+button(path.at(-1),true):path.map((id,i)=>button(id,i===path.length-1)).join('<span aria-hidden="true">›</span>')};
function simplePath(){const path=[...lifeTrail],nodes=lifeIndex();openDialog({title:'所在路径',fields:[],onSave:()=>{}});$('#cancelBtn').hidden=true;$('#dialogForm [type=submit]').textContent='完成';$('#dialogFields').innerHTML=path.map(id=>simpleAction('path-go',id,esc(nodes.get(id)?.title||'总览')+simpleIcon('arrow'),'simple-path-row')).join('')}

// Creation asks one question. Roles follow use, and remain reversible.
lifeCreate=function(parent='root',initial={}){
 closeDetails();const isRoot=parent==='root',p=lifeIndex().get(parent);if(!isRoot&&!p)return;
 openDialog({title:isRoot?'想靠近怎样的生活？':'添加下一步',
  fields:[{name:'title',label:isRoot?'写下一个愿望':`为了「${p.title.length>30?p.title.slice(0,30)+'…':p.title}」，先做什么？`,required:true,max:240,placeholder:isRoot?'例如：在喜欢的城市生活':'写下一件更小的事'}],initial,
  onSave:d=>{const title=d.title.trim();if(!title)return false;const id=uid(),n={id,title,stage:'now',reviewOn:''};
   if(isRoot)db.goals.push({...n,skills:[],nodes:[]});
   else {const current=lifeIndex().get(parent);if(!current)return false;const owner=current.owner||GardenLife.wishes(lifeIndex(),parent)[0]?.record;if(!owner)return false;
    (owner.nodes||=[]).push({...n,kind:'branch',parents:[parent]});if(current.kind==='action'){current.record.wasAction=true;current.record.kind='branch'}}
   simpleFocus(id);semanticRecent=[[isRoot?'root':parent,id]];semanticRecentUntil=performance.now()+1800;
  }});
 $('#overlay').classList.add('simple-compose');$('#dialogForm [type=submit]').textContent='添加';
 if(!isRoot)$('#deleteSlot').innerHTML=simpleAction('use-existing',parent,'用已有步骤','simple-inline');
};
lifeEdit=function(id){const n=lifeIndex().get(id);if(!n)return;closeDetails();openDialog({title:'改名',fields:[{name:'title',label:'名称',required:true,max:240}],initial:n.record,onSave:d=>{if(!d.title)return false;n.record.title=d.title;networkSignature=''}})};
function simpleNote(id){const n=lifeIndex().get(id);if(!n)return;closeDetails();openDialog({title:'补充一句',fields:[{name:'why',label:'备注',type:'textarea',max:1200,placeholder:'有什么想留给自己的？'}],initial:{why:n.record.why||n.record.desc||''},onSave:d=>{n.record.why=d.why;n.record.desc=''}})}
function simplePause(id){const n=lifeIndex().get(id);if(!n)return;if(n.record.stage==='later'){n.record.stage='now';n.record.reviewOn='';save();render();toast('现在推进');return}openDialog({title:'暂缓',fields:[{name:'reviewOn',label:'哪天再看（可选）',type:'date'}],initial:n.record,onSave:d=>{if(d.reviewOn&&!validDay(d.reviewOn))return false;n.record.stage='later';n.record.reviewOn=d.reviewOn||''}});$('#dialogForm [type=submit]').textContent='暂缓'}
function simpleProgress(id){closeDetails();const n=lifeIndex().get(id);if(!n)return;openDialog({title:'进展设置',fields:[{name:'finite',label:'怎样看待这件事',type:'select',options:['持续积累','完成这些步骤后达成']}],initial:{finite:n.record.finite?'完成这些步骤后达成':'持续积累'},onSave:d=>{n.record.finite=d.finite==='完成这些步骤后达成'}});$('#dialogIntro').textContent='有终点的目标，用圆弧显示已列行动的进展。'}
function simpleSchedule(id){const n=lifeIndex().get(id);if(!n)return;if(isScheduled(id)){switchView('today',{date:dayKey()});return}if(n.kind!=='action')lifeSetRole(id,'action',true);n.record.stage='now';scheduleAction(id);}

semanticDock=function(){
 const box=$('#semanticInspector');if(!box)return;const id=semanticSelection,n=semanticNodes.get(id);box.hidden=!n||id==='root';if(box.hidden)return;
 const open=box.dataset.node===id&&box.querySelector('.simple-node-more')?.open;box.dataset.node=id;
 const children=GardenLife.children(semanticNodes,id),leaf=n.kind!=='wish'&&!children.length,ready=n.kind==='action'||leaf,stats=GardenLife.progress(db,semanticNodes,id),count=stats.logs.length||stats.historyCount;
 const summary=[count?`做过 ${count} 次`:'',stats.proofs.length?`${stats.proofs.length} 条结果`:''].filter(Boolean).join(' · ');
 const note=n.record.why||n.record.desc||'',later=GardenLife.deferred(semanticNodes,id)&&!isScheduled(id);
 box.innerHTML=`<div class="simple-card-head"><span class="simple-node-seed" aria-hidden="true"></span><strong>${esc(n.title)}</strong><button class="simple-icon" data-simple="clear" aria-label="收起小卡">${simpleIcon('close')}</button></div>${note?`<p class="simple-card-note">${esc(note)}</p>`:''}${later?`<span class="simple-status">暂缓${n.record.reviewOn?' · '+esc(n.record.reviewOn):''}</span>`:''}${summary?simpleAction('records',id,esc(summary)+' '+simpleIcon('arrow'),'simple-record-summary'):''}<div class="simple-card-actions">${ready?simpleAction('schedule',id,isScheduled(id)?'查看今天':simpleIcon('plus')+'放到今天','simple-primary'):''}${simpleAction('add',id,simpleIcon('plus')+'添加下一步',ready?'simple-secondary':'simple-primary')}<details class="simple-node-more" ${open?'open':''}><summary aria-label="更多操作" title="更多操作">${simpleIcon('more')}</summary><div class="simple-node-menu"><div class="simple-menu-group">${simpleAction('rename',id,'编辑内容')}</div><div class="simple-menu-group">${simpleAction('relations',id,'关联与复用')}${simpleAction('records',id,'记录与进展')}</div><div class="simple-menu-group">${ready?simpleAction('complete',id,'已经做过了'):''}${simpleAction('delete',id,'删除','simple-danger')}</div></div></details></div>`;
};

function simpleRelations(id){
 closeDetails();const n=lifeIndex().get(id);if(!n)return;openDialog({title:'关联与复用',fields:[],onSave:()=>{}});$('#cancelBtn').hidden=true;$('#dialogForm [type=submit]').textContent='完成';$('#overlay').dataset.relations=id;simpleRelationRows(id);
}
function simpleRelationRows(id){const nodes=lifeIndex(),n=nodes.get(id);if(!n){closeDialog();return}const parents=n.parents.map(p=>nodes.get(p)).filter(Boolean),children=GardenLife.children(nodes,id);
 const row=(item,child,parent)=>`<div class="simple-relation-row"><span>${esc(item.title)}</span><button type="button" data-simple="unlink" data-child="${esc(child)}" data-parent="${esc(parent)}" aria-label="取消与${esc(item.title)}的关联">取消关联</button></div>`;
 $('#dialogFields').innerHTML=`<p class="simple-context">${esc(n.title)}</p>${parents.length?`<div class="simple-section-label">支持的愿望 / 步骤</div>${parents.map(p=>row(p,id,p.id)).join('')}`:''}${children.length?`<div class="simple-section-label">下面的步骤</div>${children.map(c=>row(c,c.id,id)).join('')}`:''}${!parents.length&&!children.length?'<p class="simple-empty-line">暂时没有关联</p>':''}<div class="simple-reuse-actions">${simpleAction('use-existing',id,'用已有步骤','simple-inline')}${simpleAction('attach-parent',id,'关联到另一个愿望','simple-inline')}</div>`;
}
renderDetails=function(){
 const nodes=lifeIndex(),n=nodes.get(selectedNode);if(!n)return;const stats=GardenLife.progress(db,nodes,n.id),proofs=[...stats.proofs].sort((a,b)=>b.created-a.created),logs=[...stats.logs].sort((a,b)=>b.created-a.created);
 $('#drawerMode').textContent='记录';$('#nodeCardTitle').textContent=n.title;
 $('#nodeCardContent').innerHTML=proofs.map(p=>`<article class="simple-proof"><time>${esc(p.date||'')}</time>${p.actionId!==n.id?`<small>${esc(nodes.get(p.actionId)?.title||p.actionTitle||'')}</small>`:''}<p>${esc(p.text)}</p>${/^https?:\/\//i.test(p.link||'')?`<a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">打开链接 ↗</a>`:''}${p.logId?`<button class="simple-inline" data-app="record-log" data-id="${esc(p.logId)}">编辑结果</button>`:''}</article>`).join('')+logs.filter(l=>!proofForLog(l.id)).map(l=>`<article class="simple-proof"><time>${esc(l.date)}</time><p>${esc(nodes.get(l.actionId)?.title||n.title)} · 已完成</p><button class="simple-inline" data-app="record-log" data-id="${esc(l.id)}">记下结果</button></article>`).join('')+(!proofs.length&&!logs.length?'<p class="simple-empty-line">做过的事，会留在这里。</p>':'');
 $('#nodeCardActions').innerHTML=simpleAction('progress',n.id,'进展设置','simple-inline');
};

// Completion stays complete. Adding a result is a separate, optional action.
const simpleCompletePlacement=completePlacement;
completePlacement=function(id){let offered=null;const prompt=promptRecord;promptRecord=logId=>{offered=logId};try{simpleCompletePlacement(id)}finally{promptRecord=prompt}if(offered){showFinished=true;if(activeView==='today')renderToday();toast('已完成')}};
const simplePromptRecord=promptRecord;
promptRecord=function(id){simplePromptRecord(id);if(!$('#overlay').classList.contains('show'))return;$('#dialogTitle').textContent='记下结果';$('label[for="field-text"]').textContent='这次做成了什么？';$('#field-text').placeholder='一句话就好。';const label=$('label[for="field-link"]'),input=$('#field-link');if(label&&input){const extra=document.createElement('details');extra.className='simple-extra';extra.open=!!input.value;extra.innerHTML='<summary>添加链接</summary>';extra.append(label,input);$('#dialogFields').appendChild(extra)}$('#cancelBtn').textContent='取消';$('#dialogForm [type=submit]').textContent='保存'};

const simpleBaseDialog=openDialog;
openDialog=function(options){simpleReturnFocus=document.activeElement;$('#overlay').classList.remove('simple-compose');delete $('#overlay').dataset.relations;$('#cancelBtn').hidden=false;simpleBaseDialog(options);$('#overlay').setAttribute('aria-hidden','false');$('.shell').inert=true;};
const simpleBaseCloseDialog=closeDialog;
closeDialog=function(){simpleBaseCloseDialog();$('#overlay').setAttribute('aria-hidden','true');if($('#detailsDrawer').hidden&&$('#appearancePanel').hidden&&!$('#simpleSettings')?.matches(':not([hidden])'))$('.shell').inert=false;if(simpleReturnFocus?.isConnected&&simpleReturnFocus.getClientRects().length)simpleReturnFocus.focus({preventScroll:true});};

const simpleBaseLink=lifeLink;
lifeLink=function(parent,actionId){simpleBaseLink(parent,actionId);if(!$('#overlay').classList.contains('show'))return;$('#dialogTitle').textContent=actionId?'支持哪个愿望？':'用已有步骤';$('#dialogIntro').textContent='共用同一步，进展也共用。';const label=$('label[for="field-choice"]');if(label)label.textContent=actionId?'选择上层':'选择一步';$('#dialogForm [type=submit]').textContent='使用'};

function simpleQuietToday(){
 const page=$('#todayContent');if(!page)return;const mode=dateMode();page.querySelector('.page-title').textContent=mode==='today'?'今天':new Date(selectedDay+'T12:00:00').toLocaleDateString('zh-CN',{month:'long',day:'numeric'});
 page.querySelector('.page-sub')?.remove();page.querySelector('.local-note')?.remove();page.querySelector('.pending-toggle')?.closest('section')?.remove();
 if($('#choreTitle'))$('#choreTitle').placeholder=mode==='future'?'那天想做什么？':'添加一件要做的事…';
 for(const summary of page.querySelectorAll('.row-menu summary')){summary.innerHTML=simpleIcon('more');summary.setAttribute('aria-label','更多操作')}
 for(const b of page.querySelectorAll('[data-app="record-log"]'))b.textContent='记下结果';
 const empty=page.querySelector('.quiet-empty');if(empty&&mode==='today')empty.innerHTML='<span class="simple-empty-mark">'+simpleIcon('leaf')+'</span><strong>今天，从一件小事开始。</strong><button class="simple-secondary" data-app="go-life">从生活图选一步 '+simpleIcon('arrow')+'</button>';
}
const simpleBaseToday=renderToday;renderToday=function(){simpleBaseToday();if(simpleInstalled)simpleQuietToday()};
const simpleBaseIdeas=renderIdeasApp;renderIdeasApp=function(){simpleBaseIdeas();if(!simpleInstalled)return;const page=$('#ideasContent');page.querySelector('.page-title').textContent='灵感';page.querySelector('.page-kicker')?.remove();page.querySelector('.page-sub')?.remove();page.querySelector('.local-note')?.remove();page.querySelector('.ideas-head-actions button').textContent='＋ 记一个想法';
 const empty=page.querySelector('.idea-empty-full .idea-detail-empty');if(empty)empty.innerHTML='<span class="simple-empty-mark">'+simpleIcon('leaf')+'</span><strong>留住一个念头。</strong><button class="simple-primary" data-app="new-idea">'+simpleIcon('plus')+'记一个想法</button>';
 for(const summary of page.querySelectorAll('.row-menu summary')){summary.innerHTML=simpleIcon('more');summary.setAttribute('aria-label','更多操作')}
};

function simpleOpenSettings(archive=false){const panel=$('#simpleSettings');simpleReturnFocus=document.activeElement;panel.hidden=false;$('.shell').inert=true;$('#simpleSettingsHome').hidden=archive;$('#simpleArchive').hidden=!archive;$('#simpleSettingsTitle').textContent=archive?'存档':'设置';$('#simpleSettingsBack').hidden=!archive;$('#backupControls').hidden=!archive;$('#simpleSyncRow').hidden=!$('#gardenSyncToggle');$('#simpleSyncCaption').textContent=typeof gardenSyncStatus==='string'?gardenSyncStatus:'';$('#simpleInstallRow').hidden=!$('#webInstall');const undo=$('#phoneUndoLife')||$('#webUndoLife')||$('#undoDesktopLife');$('#simpleUndoClear').hidden=!undo||!db.lifeClearUndo;$('#simpleClearLife').hidden=!$('#phoneClearLife')&&!$('#webClearLife')&&!$('#clearDesktopLife');$('#simpleSettingsClose').focus({preventScroll:true});}
function simpleCloseSettings(){const panel=$('#simpleSettings');if(!panel||panel.hidden)return;panel.hidden=true;$('#backupControls').hidden=true;$('.shell').inert=false;$('#simpleSettingsToggle').focus({preventScroll:true});}
function simpleInstallSettings(){
 const button=document.createElement('button');button.id='simpleSettingsToggle';button.className='simple-settings-toggle';button.type='button';button.innerHTML=simpleIcon('settings')+'<span>设置</span>';button.onclick=()=>simpleOpenSettings();$('.top-right').appendChild(button);
 const panel=document.createElement('div');panel.id='simpleSettings';panel.className='simple-modal';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','simpleSettingsTitle');
 const row=(action,icon,title,caption='')=>`<button type="button" class="simple-settings-row" data-simple="${action}" ${action==='settings-sync'?'id="simpleSyncRow"':action==='settings-install'?'id="simpleInstallRow"':''}>${simpleIcon(icon)}<span><strong>${title}</strong>${caption?`<small id="simpleSyncCaption">${caption}</small>`:''}</span>${simpleIcon('arrow')}</button>`;
 panel.innerHTML=`<section class="simple-settings-card"><header><button id="simpleSettingsBack" class="simple-icon" aria-label="返回设置">${simpleIcon('back')}</button><h2 id="simpleSettingsTitle">设置</h2><button id="simpleSettingsClose" class="simple-icon" aria-label="关闭设置">${simpleIcon('close')}</button></header><div id="simpleSettingsHome">${row('settings-appearance','sun','外观')}${row('settings-sync','sync','同步','内容保存在本机')}${row('settings-archive','archive','存档')}${row('settings-install','plus','添加到主屏幕')}</div><div id="simpleArchive" hidden><div id="simpleArchiveControls"></div><div class="simple-archive-tools"><button type="button" data-simple="reset-layout">整理生活图</button><button type="button" id="simpleClearLife" class="simple-danger" data-simple="clear-life">清空生活图</button><button type="button" id="simpleUndoClear" data-simple="undo-clear">撤回清空</button></div></div></section>`;
 document.body.appendChild(panel);$('#simpleArchiveControls').appendChild($('#backupControls'));$('#simpleSettingsClose').onclick=simpleCloseSettings;$('#simpleSettingsBack').onclick=()=>simpleOpenSettings();panel.addEventListener('click',e=>{if(e.target===panel)simpleCloseSettings()});
 const oldBack=window.phoneBack;if(oldBack)window.phoneBack=()=>{if(!panel.hidden){simpleCloseSettings();return true}return oldBack()};
}

const simpleInstallMap=installSemanticMap;
installSemanticMap=function(){simpleInstallMap();if(simpleInstalled)return;simpleInstalled=true;document.body.classList.add('simple-ui');simpleInstallSettings();
 $('#cancelBtn').onclick=()=>closeDialog();
 const intro=$('.map-intro');intro.querySelector('h1').textContent='生活图';$('#orbit').setAttribute('aria-label','生活图，拖动探索，缩放看细节，点选后添加下一步');$('#lifeAddGoal').innerHTML=simpleIcon('plus')+'<span>愿望</span>';
 for(const empty of document.querySelectorAll('.phone-life-empty,.web-life-empty,.desktop-life-empty'))empty.innerHTML='<span class="simple-empty-mark">'+simpleIcon('leaf')+'</span><h2>你想靠近怎样的生活？</h2><button class="simple-primary" data-act="add-goal">'+simpleIcon('plus')+'写下第一个愿望</button>';
 if(!document.querySelector('.phone-life-empty,.web-life-empty,.desktop-life-empty')){const empty=document.createElement('div');empty.className='simple-life-empty';empty.innerHTML='<span class="simple-empty-mark">'+simpleIcon('leaf')+'</span><h2>你想靠近怎样的生活？</h2><button class="simple-primary" data-act="add-goal">'+simpleIcon('plus')+'写下第一个愿望</button>';$('#orbit').appendChild(empty);const base=renderOrbit;renderOrbit=function(){base();empty.hidden=!!db.goals.length;document.body.classList.toggle('simple-empty-life',!db.goals.length)};empty.hidden=!!db.goals.length;document.body.classList.toggle('simple-empty-life',!db.goals.length)}
 $('#semanticInspector').addEventListener('toggle',e=>{if(e.target.matches('.simple-node-more'))$('#semanticInspector').classList.toggle('simple-menu-open',e.target.open)},true);
 const baseSync=typeof initGardenSync==='function'?initGardenSync:null;if(baseSync)initGardenSync=async function(){await baseSync();if($('#gardenSyncTitle'))$('#gardenSyncTitle').textContent='同步';const panel=$('#gardenSyncPanel');if(panel)new MutationObserver(()=>{if(panel.hidden)$('#simpleSettingsToggle').focus({preventScroll:true})}).observe(panel,{attributes:true,attributeFilter:['hidden']});};
 if(typeof syncStatus==='function'){const update=syncStatus;syncStatus=function(message){update(message);const button=$('#simpleSettingsToggle'),configured=gardenSyncConfig?.configured;button.dataset.syncState=!configured||message.startsWith('已同步')?'quiet':/^正在/.test(message)?'working':/等待|已保存本机|已连接/.test(message)?'waiting':'attention';button.title=message;button.setAttribute('aria-label','设置，'+message);$('#simpleSyncCaption').textContent=message;};}
 // Distinct data-simple actions avoid interception by earlier graph handlers.
 document.addEventListener('click',e=>{const b=e.target.closest('[data-simple]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const action=b.dataset.simple,id=b.dataset.id;const menu=b.closest('.simple-node-more');if(menu){menu.open=false;$('#semanticInspector').classList.remove('simple-menu-open')}
  if(action==='clear'){semanticClear();return}if(action==='add')lifeCreate(id);if(action==='schedule')simpleSchedule(id);if(action==='rename')lifeEdit(id);if(action==='note')simpleNote(id);if(action==='pause')simplePause(id);if(action==='progress')simpleProgress(id);if(action==='records'){semanticSelect(id);openDetails('records')}if(action==='use-existing'){closeDialog();lifeLink(id)}if(action==='relations')simpleRelations(id);if(action==='near')semanticNear(id);if(action==='delete')lifeDelete(id);if(action==='complete'){if(lifeIndex().get(id)?.kind!=='action')lifeSetRole(id,'action',true);completeOutside(id)}if(action==='attach-parent'){closeDialog();lifeLink(null,id)}
  if(action==='path')simplePath();if(action==='path-go'){closeDialog();id==='root'?semanticHome():semanticNear(id)}
  if(action==='reset-layout'){simpleCloseSettings();switchView('life');$('#fitMap').click()}
  if(action==='unlink'){const current=$('#overlay').dataset.relations;lifeUnlink(b.dataset.child,b.dataset.parent);simpleRelationRows(current)}
  if(action.startsWith('settings-')){if(action==='settings-archive'){simpleOpenSettings(true);return}simpleCloseSettings();if(action==='settings-appearance')openAppearance();if(action==='settings-sync')$('#gardenSyncToggle')?.click();if(action==='settings-install')$('#webInstall')?.click()}
  if(action==='clear-life'){simpleCloseSettings();($('#phoneClearLife')||$('#webClearLife')||$('#clearDesktopLife'))?.click()}if(action==='undo-clear'){simpleCloseSettings();($('#phoneUndoLife')||$('#webUndoLife')||$('#undoDesktopLife'))?.click()}
 },true);
 document.addEventListener('click',e=>{const more=$('.simple-node-more[open]');if(more&&!more.contains(e.target)){more.open=false;$('#semanticInspector').classList.remove('simple-menu-open')}});
 document.addEventListener('keydown',e=>{const settings=$('#simpleSettings');if(!settings.hidden){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();simpleCloseSettings()}if(e.key==='Tab')simpleTrapFocus(e,settings);return}if($('#overlay').classList.contains('show')){if(e.key==='Tab')simpleTrapFocus(e,$('#overlay'));return}if(e.key==='Escape'){const menu=$('.simple-node-more[open]');if(menu){menu.open=false;$('#semanticInspector').classList.remove('simple-menu-open');menu.querySelector('summary').focus()}else if(activeView==='life'&&$('#detailsDrawer').hidden&&$('#appearancePanel').hidden)semanticClear()}},true);
 semanticDock();if(activeView==='today')renderToday();if(activeView==='ideas')renderIdeasApp();
};
function simpleTrapFocus(e,panel){const controls=[...panel.querySelectorAll('button,input,textarea,select,a,summary')].filter(el=>el.getClientRects().length&&!el.disabled);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
