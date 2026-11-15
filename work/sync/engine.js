(function(root){
 'use strict';const C=root.GardenSyncCore;
 const from64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
 const to64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text)};
 const hash=async blob=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const files=state=>state.data.ideas.flatMap(i=>i.files||[]);
 function tidy(state){const ids=new Set(files(state).map(f=>f.id));state.files=Object.fromEntries(Object.entries(state.files).filter(([id])=>ids.has(id)));return C.validate(state)}
 class Engine {
  constructor(adapter){this.a=adapter;this.blobs=new Map();this.known=new Set();this.busy=false;this.paused=false;this.closed=false;this.generation=0;}
  async local(){const state={format:'mind-garden-sync-v1',data:C.data(this.a.read()),files:{}};for(const file of files(state)){const blob=await this.a.getBlob(file.id);if(!blob||blob.size!==file.size)throw Error('文件「'+file.name+'」未找到，暂未覆盖云端');const digest=await hash(blob);this.blobs.set(digest,blob);state.files[file.id]=digest;}return C.validate(state)}
  note(){try{return JSON.parse(this.a.storage.getItem('note')||'{}')}catch{throw Error('同步记录暂未读完整，请先保留本地备份')}}
  remember(value){this.a.storage.setItem('note',JSON.stringify(value));}
  unchanged(state){return C.equal(C.data(this.a.read()),state.data)}
  async blob(state,file){const digest=state.files[file.id];let blob=this.blobs.get(digest);if(blob)return blob;const existing=await this.a.getBlob(file.id);if(existing&&existing.size===file.size&&await hash(existing)===digest)blob=existing;else{const response=await this.a.call({action:'getFile',key:digest});if(response.status!==200)throw Error('云端附件「'+file.name+'」未找到，本地内容已保留');blob=new Blob([from64(response.content)],{type:file.type||'application/octet-stream'});if(blob.size!==file.size||await hash(blob)!==digest)throw Error('云端附件没有读完整，本地内容已保留');}this.blobs.set(digest,blob);return blob;}
  async snapshot(state){const attachments=[];for(const file of files(state)){const blob=await this.blob(state,file);attachments.push({id:file.id,type:file.type||blob.type,data:to64(new Uint8Array(await blob.arrayBuffer()))})}return {...C.copy(this.a.read()),...C.copy(state.data),attachments};}
  async safety(local,other){await this.a.call({action:'safety',side:'before',snapshot:await this.snapshot(local)});if(other)await this.a.call({action:'safety',side:'other',snapshot:await this.snapshot(other)});}
  async decide(local,remote,paths=[]){this.a.status('两边都有改动，需要选择');await this.safety(local,remote);const choice=await this.a.conflict(local,remote,paths);if(choice!=='local'&&choice!=='remote'){this.paused=true;throw Error('两份内容都已保留，点同步后可以继续选择')}if(!this.unchanged(local))throw Error('本机内容刚刚变化，稍后会重新检查');return C.copy(choice==='local'?local:remote);}
  async apply(local,target){
   const wanted=tidy(C.copy(target));if(!this.unchanged(local)||!this.a.canApply())throw Error('等待当前编辑完成，再继续同步');
   const staged=[];for(const file of files(wanted))staged.push([file,await this.blob(wanted,file)]);
   if(!this.unchanged(local)||!this.a.canApply())throw Error('等待当前编辑完成，再继续同步');
   // Hydration may yield to another edit; check again before replacing any records.
   for(const [file,blob]of staged)await this.a.putBlob(file.id,blob);
   if(!this.unchanged(local)||!this.a.canApply())throw Error('等待当前编辑完成，再继续同步');
   this.a.write(C.copy(wanted.data));await this.a.save();
  }
  async upload(state){for(const file of files(state)){const digest=state.files[file.id];if(this.known.has(digest))continue;const existing=await this.a.call({action:'getFile',key:digest});if(existing.status===200){const blob=new Blob([from64(existing.content)]);if(blob.size!==file.size||await hash(blob)!==digest)throw Error('云端附件校验未通过，暂未覆盖');this.known.add(digest);continue}if(existing.status!==404)throw Error('附件暂时没有同步完成');const blob=await this.blob(state,file),response=await this.a.call({action:'putFile',key:digest,content:to64(new Uint8Array(await blob.arrayBuffer()))});if(response.status===409||response.status===422){const raced=await this.a.call({action:'getFile',key:digest});if(raced.status!==200||await hash(new Blob([from64(raced.content)]))!==digest)throw Error('附件正在另一台设备更新，稍后会重试')}else if(response.status!==200&&response.status!==201)throw Error('附件暂时没有同步完成');this.known.add(digest);}}
  async finish(note,local){const pending=note.pending;let result=C.merge(pending.start,local,pending.target);let target=result.conflicts.length?await this.decide(local,pending.target,result.conflicts):tidy(result.value);if(!this.unchanged(local))throw Error('本机内容刚刚变化，稍后会重新检查');if(!C.equal(local,target)){await this.safety(local);await this.apply(local,target);}else await this.a.save();note.base=pending.target;delete note.pending;this.remember(note);return target;}
  async run(manual=false){if(this.busy||this.closed||this.paused&&!manual)return false;this.busy=true;if(manual)this.paused=false;const generation=this.generation;try{
   if(!this.a.canApply()){this.a.status('等待当前编辑完成，再继续同步');return false;}this.a.status('正在更新…');await this.a.save();await this.a.call({action:'verify'});
   for(let attempt=0;attempt<3;attempt++){
    if(this.closed||generation!==this.generation)return false;
    let local=await this.local(),note=this.note();const response=await this.a.call({action:'getState'});
    let remote=response.status===404?C.empty():C.validate(JSON.parse(new TextDecoder().decode(from64(response.content))));
    if(response.status!==200&&response.status!==404)throw Error('暂时没有读到云端内容');
    if(note.base&&response.status===404)throw Error('云端同步文件不见了，本地内容已保留，请检查仓库');
    if(note.pending&&(note.pending.confirmed||C.equal(note.pending.target,remote))){local=await this.finish(note,local);note=this.note();}
    else if(note.pending){delete note.pending;this.remember(note);}
    if(!this.unchanged(local))continue;
    const result=C.merge(note.base||C.empty(),local,remote);let target=result.conflicts.length?await this.decide(local,remote,result.conflicts):tidy(result.value);
    if(!this.unchanged(local))continue;
    this.a.status('正在同步…');
    if(response.status===404||!C.equal(target,remote)){
     await this.upload(target);if(!this.unchanged(local))continue;
     note.pending={start:local,target,confirmed:false};this.remember(note);
     const put=await this.a.call({action:'putState',sha:response.status===200?response.sha:'',content:to64(new TextEncoder().encode(JSON.stringify(target)))});
     if(put.status===409||put.status===422){delete note.pending;this.remember(note);continue;}if(put.status!==200&&put.status!==201)throw Error('暂时没有同步完成');note.pending.confirmed=true;this.remember(note);
    }else{note.pending={start:local,target,confirmed:true};this.remember(note);}
    if(this.closed||generation!==this.generation)return false;
    const latest=await this.local(),finished=await this.finish(note,latest);if(!C.equal(finished,target)||!this.unchanged(finished))continue;this.a.status('已同步 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));return true;
   }
   throw Error('内容还在变化，稍后会继续同步');
  }catch(error){this.a.status(error.message);return false;}finally{this.busy=false;}}
 }
 root.GardenSyncEngine={Engine,hash,from64,to64,tidy};if(typeof module!=='undefined'&&module.exports)module.exports=root.GardenSyncEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
