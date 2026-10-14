const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net'),{spawn}=require('node:child_process');
const {segmentText}=require('../travel-story'),fixture=require('./travel-fixture');
test('旅行历史、故事与按段声音接口可用；重启后保留，公开接口不泄漏导演提示词或文件路径',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-travel-http-'));let child;
  const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
  const base='http://127.0.0.1:'+port,story=fixture(),date='2026-10-12';
  const state={owner:'验收',name:'小猫',createdAt:Date.now(),lastFedAt:Date.now(),readings:0,food:0,feeds:0,claimedRewards:0,stories:[],actions:[],chatArchive:[],memoryBackfilled:true,photos:[0,1].map(i=>({id:'fixture-'+i,file:'fixture-'+i+'.jpg',url:'/api/media/fixture-'+i,type:'image/jpeg',kind:'trip',date,caption:story.scenes[i].caption})),trips:{[date]:{date,place:'贝壳海湾',status:'ready',photos:['fixture-0','fixture-1'],story}}};
  fs.mkdirSync(path.join(dir,'trip-audio'));for(let index=0;index<2;index++){const hash=crypto.createHash('sha256').update(date+'\n'+segmentText(story,index)).digest('hex');fs.writeFileSync(path.join(dir,'trip-audio',hash+'.mp3'),Buffer.from('ID3-fixture-'+index));}
  fs.writeFileSync(path.join(dir,'pet.json'),JSON.stringify(state));
  async function start(){child=spawn(process.execPath,[path.resolve('server.js')],{env:{...process.env,PET_SKIP_ENV:'1',PET_DATA_DIR:dir,PORT:String(port)},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('server stopped')));});}
  async function stop(){if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
  try{await start();let result=await (await fetch(base+'/api/trips')).json();assert.equal(result.trips[0].title,story.title);
    const response=await fetch(base+'/api/trips/'+date);result=await response.json();assert.equal(result.photos.length,2);assert.equal(result.story.scenes[0].imagePrompt,undefined);assert.equal(result.photos[0].file,undefined);
    assert.equal((await fetch(base+'/api/trips/'+date+'/story',{method:'POST'})).status,200);
    const sound=await fetch(base+'/api/trips/'+date+'/audio/0',{method:'POST'});assert.equal(sound.status,200);assert.equal(sound.headers.get('content-type'),'audio/mpeg');assert.equal(await sound.text(),'ID3-fixture-0');
    assert.equal((await fetch(base+'/api/trips/2026-10-01')).status,404);assert.equal((await fetch(base+'/api/trips/'+date+'/audio',{method:'POST'})).status,400);
    await stop();await start();assert.equal((await (await fetch(base+'/api/trips/'+date)).json()).story.title,story.title);assert.equal(await (await fetch(base+'/api/trips/'+date+'/audio/1',{method:'POST'})).text(),'ID3-fixture-1');
  }finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}
});
