const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),{spawn,spawnSync}=require('node:child_process');
async function port(){return new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});}
function clean(){const env={...process.env,PET_SKIP_ENV:'1',HOST:'127.0.0.1',PET_ENABLE_GENERATION:'0',PET_ENABLE_TRIPS:'0'};for(const k of Object.keys(env))if(/(?:API_KEY|ACCESS_PASSWORD)$/.test(k))delete env[k];return env;}
async function start(env){const child=spawn(process.execPath,[path.resolve(__dirname,'../server.js')],{env,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('Startup failed')));});return child;}
async function stop(c){if(c&&c.exitCode===null)await new Promise(r=>{c.once('exit',r);c.kill();});}
test('无 key 空存档可完成两次预制进化和动作，重启恢复；不会开启后续生成',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-clean-'));const p=await port(),env={...clean(),PORT:String(p),PET_DATA_DIR:dir};let child;
 try{
  child=await start(env);const base='http://127.0.0.1:'+p;
  let state=await(await fetch(base+'/api/pet')).json();assert.deepEqual(state.stories,[]);assert.equal(state.owner,'朋友');assert.equal(state.evolution.level,0);assert.deepEqual((await(await fetch(base+'/api/chat/history')).json()).messages,[]);
  const caps=await(await fetch(base+'/api/capabilities')).json();assert.equal(caps.chatConfigured,false);assert.equal(caps.generationEnabled,false);
  await stop(child);state=JSON.parse(fs.readFileSync(path.join(dir,'pet.json')));state.food=30;fs.writeFileSync(path.join(dir,'pet.json'),JSON.stringify(state));child=await start(env);
  for(let n=1;n<=25;n++){
   const response=await fetch(base+'/api/feed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actionId:'fixture-feed-'+n,dish:'strawberry'})});assert.equal(response.status,200);state=await response.json();
   if([3,8].includes(n)){const level=n===3?1:2;assert.equal(state.evolution.level,level);assert.equal(state.evolution.complete,true);assert.equal(state.animation.status,'ready');assert.equal(state.animation.formImage,state.evolution.image);const manifest=await(await fetch(base+state.animation.manifest)).json();assert.equal(manifest.formImage,state.evolution.image);assert.equal(Object.keys(manifest.layers).length,9);}
  }
  assert.equal(state.evolution.level,2);assert.equal(state.evolution.nextAt,null);assert.equal(state.evolution.totalEvolutions,2);assert.equal(state.evolution.eligible,false);
  assert.equal((await fetch(base+'/api/trip/retry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actionId:'fixture-trip'})})).status,503);
  await stop(child);child=await start(env);state=await(await fetch(base+'/api/pet')).json();assert.equal(state.evolution.level,2);assert.equal(state.evolution.complete,true);assert.equal(state.animation.status,'ready');
 }finally{await stop(child);fs.rmSync(dir,{recursive:true,force:true});}
});
test('联网无密码拒绝启动；错误密码无法看页面、历史或修改；跨站请求拒绝',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-access-'));const p=await port();let child;
 try{
  const missing=spawnSync(process.execPath,[path.resolve(__dirname,'../server.js')],{env:{...clean(),HOST:'0.0.0.0',PORT:String(p),PET_DATA_DIR:dir},encoding:'utf8'});assert.notEqual(missing.status,0);assert.match(missing.stderr,/PET_ACCESS_PASSWORD/);
  const password='fixture-access-secret-123';child=await start({...clean(),HOST:'0.0.0.0',PORT:String(p),PET_DATA_DIR:dir,PET_ACCESS_PASSWORD:password});const base='http://127.0.0.1:'+p,authorization='Basic '+Buffer.from('pet:'+password).toString('base64');
  assert.equal((await fetch(base+'/healthz')).status,200);for(const route of ['/','/api/pet','/api/chat/history'])assert.equal((await fetch(base+route)).status,401);
  assert.equal((await fetch(base+'/api/story',{method:'POST',body:'{}'})).status,401);assert.equal((await fetch(base+'/api/pet',{headers:{authorization:'Basic '+Buffer.from('pet:wrong').toString('base64')}})).status,401);
  assert.equal((await fetch(base+'/api/pet',{headers:{authorization}})).status,200);
  assert.equal((await fetch(base+'/api/story',{method:'POST',headers:{authorization,Origin:'https://fixture.invalid'},body:'{}'})).status,403);
  const capabilities=await(await fetch(base+'/api/capabilities',{headers:{authorization}})).text();assert.ok(!capabilities.includes(password));
 }finally{await stop(child);fs.rmSync(dir,{recursive:true,force:true});}
});
test('配置检查区分硬性与选配，不暴露模拟 key，不把共享 key 当生图或看图配置',()=>{
 const script=path.resolve(__dirname,'../scripts/config-doctor.cjs'),secret='fixture-private-key-123456';
 const result=spawnSync(process.execPath,[script,'--json'],{env:{...clean(),PET_AI_API_KEY:secret},encoding:'utf8'});assert.equal(result.status,0);assert.ok(!result.stdout.includes(secret));const r=JSON.parse(result.stdout);assert.equal(r.basicReady,true);assert.deepEqual(r.requiredMissing,[]);assert.equal(r.optional.find(f=>f.id==='chat').status,'configured-unverified');assert.equal(r.optional.find(f=>f.id==='vision').status,'missing');assert.equal(r.optional.find(f=>f.id==='generation').status,'disabled');
 const network=spawnSync(process.execPath,[script,'--json'],{env:{...clean(),HOST:'0.0.0.0'},encoding:'utf8'});assert.equal(network.status,1);assert.ok(JSON.parse(network.stdout).requiredMissing.some(v=>v.includes('PET_ACCESS_PASSWORD')));
});
