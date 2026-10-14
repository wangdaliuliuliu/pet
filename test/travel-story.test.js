const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.PET_SKIP_ENV='1';
const {createTrips,promptForPhoto}=require('../trip-service'),{createMediaStore}=require('../media-store');
const {validateStory,planStory}=require('../travel-story'),fixture=require('./travel-fixture');
function setup(options={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-travel-story-'));
  const now=Date.parse('2026-10-13T10:00:00+08:00');
  const state={stories:[{createdAt:now-86400000}],chatArchive:[],evolution:{forms:[]}};
  const media=createMediaStore({state,save:()=>{},dataDir:dir});
  const dependencies={state,save:()=>{},dataDir:dir,media,memory:{put:()=>{}},now:()=>now,planner:async()=>fixture(),reviewer:async()=>({matches:true,duplicate:false,observedAction:'侧身看海螺'}),generator:async()=>Buffer.from('photo'),...options};
  return {dir,state,media,dependencies,trips:createTrips(dependencies),clean:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('故事决定两种具体动作和配文，提示词只锁定身份；拒绝缺失和重复瞬间',()=>{
  const story=validateStory(fixture());const prompt=promptForPhoto({place:'海湾',story},0);
  assert.match(prompt,/IDENTITY AND COSTUME guide ONLY/);assert.match(prompt,/ear tilted toward a shell/);assert.match(prompt,/这只海螺/);assert.doesNotMatch(prompt,/Close-up playful selfie/);
  const bad=fixture();bad.scenes[1].actionKey=bad.scenes[0].actionKey;assert.throws(()=>validateStory(bad),/重复/);assert.throws(()=>validateStory({}),/两个/);
  const wrongIdentity=fixture();wrongIdentity.scenes[0].imagePrompt+=' No clothing or accessories.';assert.throws(()=>validateStory(wrongIdentity),/外观/);
  const inventedHistory=fixture();inventedHistory.ending='我用主人教我的舞步跳了起来。';assert.throws(()=>validateStory(inventedHistory),/共同经历/);
});
test('不符或重复的候选最多纠正一次，传入近期真实照片对比，未通过不能登记',async()=>{
  let generated=0,reviews=0;const c=setup({generator:async args=>{generated++;if(generated===2)assert.match(args.feedback,/姿势重复/);return Buffer.from('candidate-'+generated);},reviewer:async(images,scene)=>{reviews++;if(reviews===1)return {matches:true,duplicate:true,observedAction:'摆拍',issues:'姿势重复，请蹲下侧身'};if(reviews===3)assert.equal(images.length,2);return {matches:true,duplicate:false,observedAction:scene.actionKey};}});
  try{assert.equal(c.trips.start(),true);await c.trips.settled();assert.equal(generated,3);assert.equal(c.trips.view().status,'ready');assert.equal(c.state.photos.length,2);assert.equal(c.state.photos[0].caption,fixture().scenes[0].caption);assert.equal(c.state.chatArchive.length,1);assert.equal(c.trips.context()[0].story.title,fixture().title);assert.equal(c.trips.view().story.scenes[0].imagePrompt,undefined);}
  finally{c.clean();}
});
test('看图服务中断后重试或重启复用已付费候选和故事，不再次出图',async()=>{
  let generated=0,planned=0,offline=true;
  const c=setup({planner:async()=>{planned++;return fixture();},generator:async()=>{generated++;return Buffer.from('photo');},reviewer:async()=>{if(offline)throw Error('vision offline');return {matches:true,duplicate:false,observedAction:'故事动作'};}});
  try{c.trips.start();await c.trips.settled();assert.equal(c.state.photos.length,0);assert.equal(c.trips.view().status,'failed');assert.equal(generated,1);assert.equal(c.trips.start(),false);
    const restarted=createTrips({...c.dependencies});offline=false;assert.equal(restarted.start(true),true);await restarted.settled();assert.equal(restarted.view().status,'ready');assert.equal(generated,2);assert.equal(planned,1);
  }finally{c.clean();}
});
test('两次画面不符停止，保留故事且不发布候选，不自动无限重试',async()=>{
  let count=0;const c=setup({generator:async()=>{count++;return Buffer.from('bad');},reviewer:async()=>({matches:false,duplicate:false,observedAction:'摆拍',issues:'没有核心动作'})});
  try{c.trips.start();await c.trips.settled();assert.equal(count,2);assert.equal(c.trips.view().status,'failed');assert.equal(c.state.photos.length,0);assert.ok(c.trips.view().story);assert.equal(c.trips.start(),false);assert.equal(c.state.chatArchive.length,0);}finally{c.clean();}
});
test('旧照片按实际画面补故事；并发只补一次；声音按段缓存、重启后继续复用',async()=>{
  let plans=0,descriptions=0,speeches=0;
  const c=setup({planner:async args=>{plans++;assert.deepEqual(args.observations,['照片1实际姿态','照片2实际姿态']);return fixture();},describe:async()=>`照片${++descriptions}实际姿态`,speaker:async text=>{speeches++;assert.ok(text.length>10);return Buffer.from('ID3-audio');}});
  try{const p0=c.media.put(Buffer.from('original-1'),'image/jpeg',{kind:'trip',date:'2026-10-12',caption:'旧配文'}),p1=c.media.put(Buffer.from('original-2'),'image/jpeg',{kind:'trip',date:'2026-10-12'});
    c.state.trips['2026-10-12']={date:'2026-10-12',place:'贝壳海湾',activity:'收集贝壳',photos:[p0.id,p1.id],status:'ready'};
    await Promise.all([c.trips.ensureStory('2026-10-12'),c.trips.ensureStory('2026-10-12')]);assert.equal(plans,1);assert.equal(descriptions,2);assert.equal(c.media.bytes(p0.id).toString(),'original-1');
    await Promise.all([c.trips.audio('2026-10-12',0),c.trips.audio('2026-10-12',0)]);assert.equal(speeches,1);await c.trips.audio('2026-10-12',1);assert.equal(speeches,2);
    const restart=createTrips({...c.dependencies,speaker:async()=>{throw Error('must use cache');}});assert.equal((await restart.audio('2026-10-12',0)).toString(),'ID3-audio');assert.equal(restart.list()[0].title,fixture().title);
    assert.throws(()=>c.trips.audio('2026-10-12',2),e=>e.status===400);
  }finally{c.clean();}
});
test('旅行创作和看图核对使用现有服务、传入历史，解析结构化结果',async()=>{
  const voice=require('../voice-service'),original=global.fetch;process.env.PET_CHAT_API_KEY='fixture';process.env.PET_CHAT_BASE_URL='https://api.deepseek.com';process.env.PET_VISION_API_KEY='fixture';
  try{global.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);if(url.endsWith('/chat/completions')){assert.equal(body.response_format.type,'json_object');assert.match(body.messages[0].content,/不要固定发现\+意外/);assert.equal(JSON.parse(body.messages[1].content).recent[0].title,'昨天的小事');return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(fixture())}}]}));}
    assert.equal(body.input.messages[1].content[0].image,'data:image/jpeg;base64,first');assert.equal(body.input.messages[1].content[1].image,'data:image/jpeg;base64,previous');return new Response(JSON.stringify({output:{choices:[{message:{content:[{text:'```json\n{"matches":true,"duplicate":false,"observedAction":"侧身听海螺","issues":""}\n```'}]}}]}}));};
    const story=await planStory({place:'海湾',recent:[{title:'昨天的小事'}]});assert.equal(story.title,fixture().title);assert.equal((await voice.reviewTravelPhoto(['data:image/jpeg;base64,first','data:image/jpeg;base64,previous'],story.scenes[0],[])).matches,true);
  }finally{global.fetch=original;delete process.env.PET_CHAT_API_KEY;delete process.env.PET_CHAT_BASE_URL;delete process.env.PET_VISION_API_KEY;}
});
test('补旧故事也核对真实画面，不能把附近飞的蝴蝶编成停在爪子上',async()=>{
  let plans=0,reviews=0;const c=setup({describe:async()=> '蝴蝶在爪子附近飞',planner:async args=>{plans++;if(plans===2)assert.match(args.feedback,/蝴蝶没有停在爪子上/);return fixture();},reviewer:async()=>({matches:++reviews>1,duplicate:false,observedAction:'蝴蝶飞着',issues:'蝴蝶没有停在爪子上'})});
  try{const p=c.media.put(Buffer.from('legacy'),'image/jpeg',{kind:'trip',date:'2026-10-12'});c.state.trips['2026-10-12']={date:'2026-10-12',place:'花谷',photos:[p.id],status:'failed'};await c.trips.ensureStory('2026-10-12');assert.equal(plans,2);assert.equal(c.state.trips['2026-10-12'].storyStatus,'ready');assert.equal(c.media.bytes(p.id).toString(),'legacy');}finally{c.clean();}
});
