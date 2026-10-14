const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createTrips,day,yesterday}=require('../trip-service'),{createMediaStore}=require('../media-store');
process.env.PET_SKIP_ENV='1';
const fixture=require('./travel-fixture');
test('昨天的故事才有今天旅行；仅两张、部分失败只补剩余；拍摄采用最新形态并永久记住',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-trip-'));try{
 const now=Date.parse('2026-10-11T00:05:00+08:00');assert.equal(day(now),'2026-10-11');assert.equal(yesterday(now),'2026-10-10');
 const state={stories:[],chatArchive:[],evolution:{forms:[{image:'/api/evolutions/a.png',file:'a.png',level:1}]}};const save=()=>{};const media=createMediaStore({state,save,dataDir:dir});let count=0,failSecond=true;const memories=[];
 const trips=createTrips({state,save,dataDir:dir,media,memory:{put:e=>memories.push(e)},planner:async()=>fixture(),reviewer:async()=>({matches:true,duplicate:false,observedAction:'不同的旅行动作'}),now:()=>now,generator:async args=>{count++;if(count===1){assert.equal(args.formImage,'/api/evolutions/a.png');state.evolution.forms.push({image:'/api/evolutions/b.png',file:'b.png',level:2});}else assert.equal(args.formImage,'/api/evolutions/b.png');if(args.index===1&&failSecond)throw Error('fixture');return Buffer.from('fixture-image');}});
 assert.equal(trips.start(),false);state.stories.push({createdAt:now});assert.equal(trips.start(),false);state.stories.push({createdAt:Date.parse('2026-10-10T08:00:00+08:00')});assert.equal(trips.start(),true);assert.equal(trips.start(),false);await trips.settled();assert.equal(trips.view().status,'failed');assert.equal(trips.view().photos.length,1);assert.equal(trips.start(),false);
 failSecond=false;assert.equal(trips.start(true),true);await trips.settled();assert.equal(count,3);assert.equal(trips.view().photos.length,2);assert.equal(trips.view().status,'ready');assert.equal(trips.start(true),false);assert.equal(state.chatArchive.length,1);assert.equal(memories.length,1);assert.equal(trips.context()[0].photoIds.length,2);
 const restored=JSON.parse(JSON.stringify(state));const restart=createTrips({state:restored,save,dataDir:dir,media,memory:{put:()=>{}},generator:async()=>{throw Error('must not run');},now:()=>now});assert.equal(restart.start(),false);assert.equal(restart.view().status,'ready');assert.equal(restart.view().photos[1].formImage,'/api/evolutions/b.png');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
