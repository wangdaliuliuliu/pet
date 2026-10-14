const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createAnimation,atlasPrompt}=require('../animation-service');
function fixturePart(dir,name){const image=fs.readFileSync(path.join(__dirname,'../public/assets/pet/animations/stage-1/head.png'));fs.writeFileSync(path.join(dir,name+'.png'),image);return {file:name+'.png',width:image.readUInt32BE(16),height:image.readUInt32BE(20)};}
test('动作绑定当前形态；无翅膀可用；并发、重启不会重复付费，失败不覆盖成长',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-animation-'));try{
  fs.mkdirSync(path.join(dataDir,'evolutions'));fs.writeFileSync(path.join(dataDir,'evolutions','new.png'),'fixture');
  const form={file:'new.png',image:'/api/evolutions/new.png',level:2};const state={feeds:8,evolution:{forms:[form]}};let calls=0,release;
  const generator=async({sourceFile,dir,formImage})=>{calls++;assert.equal(sourceFile,path.join(dataDir,'evolutions','new.png'));assert.equal(formImage,form.image);await new Promise(r=>release=r);fs.mkdirSync(dir,{recursive:true});const layers={};for(const n of ['head','blink','torso','armLeft','armRight','legLeft','legRight'])layers[n]=fixturePart(dir,n);return {version:1,rig:'front-cat-v1',layers};};
  const svc=createAnimation({state,save:()=>{},dataDir,generator});assert.equal(calls,0);assert.equal(svc.start(),true);assert.equal(svc.start(),false);assert.equal(svc.view().status,'generating');release();await svc.settled();assert.equal(svc.view().status,'ready');assert.equal(svc.start(),false);assert.equal(calls,1);
  const manifest=JSON.parse(fs.readFileSync(svc.asset(svc.view().manifest),'utf8'));assert.equal(manifest.formImage,form.image);assert.equal(manifest.layers.backAccessory,undefined);assert.equal(svc.asset('/api/animations/../../pet.json'),null);
  state.evolution.forms.push({file:'new.png',image:'/api/evolutions/newer.png',level:3});assert.equal(svc.view().manifest,null);assert.equal(svc.view().status,'unavailable');
  state.animationPacks['/api/evolutions/newer.png']={status:'generating',jobId:'interrupted'};const restart=createAnimation({state,save:()=>{},dataDir,generator});assert.equal(restart.view().status,'failed');assert.equal(calls,1);assert.equal(state.feeds,8);
  const failed=createAnimation({state,save:()=>{},dataDir,generator:async()=>({version:1,rig:'front-cat-v1',layers:{}})});failed.start();await failed.settled();assert.equal(failed.view().status,'failed');assert.equal(failed.view().manifest,null);assert.equal(state.evolution.forms.at(-1).level,3);
  assert.match(atlasPrompt(),/Do not restore any old wings/);
 }finally{fs.rmSync(dataDir,{recursive:true,force:true});}
});

test('恢复存档漏掉动作回调时仅补首次准备，失败与重启不自动再请求；手动重试复用候选',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-motion-recovery-'));
 try{
  fs.mkdirSync(path.join(dataDir,'evolutions'));fs.writeFileSync(path.join(dataDir,'evolutions','restored.png'),'fixture');
  const form={file:'restored.png',image:'/api/evolutions/restored.png',level:2};
  const state={feeds:10,evolution:{forms:[form]}};let calls=0,firstDir;
  const service=createAnimation({state,save:()=>{},dataDir,generator:async({dir})=>{
   calls++;firstDir=dir;fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'source.png'),'paid-candidate');throw Error('packing failed');
  }});
  assert.equal(service.ensureCurrent(),true);assert.equal(service.ensureCurrent(),false);await service.settled();
  assert.equal(calls,1);assert.equal(service.ensureCurrent(),false);
  const restarted=createAnimation({state,save:()=>{},dataDir,generator:async({dir})=>{
   calls++;assert.equal(dir,firstDir);assert.equal(fs.readFileSync(path.join(dir,'source.png'),'utf8'),'paid-candidate');
   const layers={};for(const name of ['head','blink','torso','armLeft','armRight','legLeft','legRight'])layers[name]=fixturePart(dir,name);
   return {version:1,rig:'front-cat-v1',layers};
  }});
  assert.equal(restarted.ensureCurrent(),false);assert.equal(calls,1);
  assert.equal(restarted.start(),true);await restarted.settled();assert.equal(restarted.view().status,'ready');assert.equal(calls,2);
  assert.equal(restarted.ensureCurrent(),false);assert.equal(state.feeds,10);
 }finally{fs.rmSync(dataDir,{recursive:true,force:true});}
});
