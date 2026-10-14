const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createEvolution}=require('../evolution-service');
const {createAnimation}=require('../animation-service');

test('每次进化图片成功后必须等当前绑定通过；缺失、错形态、损坏部件均不得完成或开启下次',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-completion-'));
 try{
  const state={feeds:25},save=()=>{};let release,requests=0;
  const animation=createAnimation({state,save,dataDir,generator:async({dir})=>{
   await new Promise(r=>release=r);fs.mkdirSync(dir,{recursive:true});const layers={};
   const png=fs.readFileSync(path.join(__dirname,'../public/assets/pet/animations/stage-1/head.png'));
   for(const name of ['head','blink','torso','armLeft','armRight','legLeft','legRight']){fs.writeFileSync(path.join(dir,name+'.png'),png);layers[name]={file:name+'.png',width:png.readUInt32BE(16),height:png.readUInt32BE(20)};}
   return {version:1,rig:'front-cat-v1',layers};
  }});
  const evolution=createEvolution({state,save,dataDir,animationView:animation.view,onForm:animation.start,generator:async({dir,jobId})=>{requests++;const file=path.join(dir,jobId+'.png');fs.writeFileSync(file,'image-fixture');return file;}});
  for(let level=1;level<=4;level++){
   assert.equal(evolution.start(),true);await evolution.settled();
   assert.equal(evolution.view().level,level);assert.equal(evolution.view().complete,false);assert.equal(evolution.view().completedLevel,level-1);
   assert.equal(evolution.start(),false);assert.equal(requests,level);
   release();await animation.settled();assert.equal(evolution.view().complete,true);assert.equal(evolution.view().completedLevel,level);
  }
  const form=state.evolution.forms.at(-1),record=state.animationPacks[form.image];
  const dir=path.join(dataDir,'animations',record.jobId),manifestFile=path.join(dir,'manifest.json');
  const correct=fs.readFileSync(manifestFile,'utf8'),manifest=JSON.parse(correct);
  manifest.formImage=state.evolution.forms[0].image;fs.writeFileSync(manifestFile,JSON.stringify(manifest));
  assert.equal(evolution.view().complete,false);assert.equal(animation.view().status,'failed');
  fs.writeFileSync(manifestFile,correct);assert.equal(evolution.view().complete,true);
  fs.writeFileSync(path.join(dir,'armLeft.png'),'corrupt');assert.equal(evolution.view().complete,false);
  assert.equal(animation.view().manifest,null);assert.equal(state.feeds,25);assert.equal(state.evolution.level,4);
 }finally{fs.rmSync(dataDir,{recursive:true,force:true});}
});

test('人工恢复绕过动作回调时不会被默认为完成；即使达到喂食阈值也不能跨级',()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-recovered-incomplete-'));
 try{
  const state={feeds:25,evolution:{level:2,status:'idle',forms:[{level:2,file:'restored.png',image:'/api/evolutions/restored.png'}]}};
  const evolution=createEvolution({state,save:()=>{},dataDir});
  assert.equal(evolution.view().complete,false);assert.equal(evolution.view().preparation,'animation');assert.equal(evolution.start(),false);assert.equal(state.evolution.level,2);
 }finally{fs.rmSync(dataDir,{recursive:true,force:true});}
});
