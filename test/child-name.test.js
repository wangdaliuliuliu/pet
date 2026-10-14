const {test}=require('node:test'),assert=require('node:assert/strict');
process.env.PET_SKIP_ENV='1';
const {childNames,personalizeText}=require('../child-name'),{validateStory}=require('../travel-story'),{migrateTravelNames}=require('../travel-name-migration'),fixture=require('./travel-fixture');
test('称呼取自存档；不猜姓氏，显式昵称优先；主人及小主人不能出现在回复里',()=>{
  assert.deepEqual(childNames({owner:'朋友'}),{fullName:'朋友',nickname:'朋友'});
  assert.equal(childNames({owner:'欧阳小雨'}).nickname,'欧阳小雨');assert.equal(childNames({owner:'陈星星',ownerNickname:'星星'}).nickname,'星星');
  assert.equal(personalizeText('小主人，我想把照片送给主人看！',{owner:'朋友'}),'朋友，我想把照片送给朋友看！');
  assert.equal(personalizeText('主人，这个故事的主人公是一只猫。',{owner:'朋友'}),'朋友，这个故事的主人公是一只猫。');
  const raw=fixture();raw.intro='我想把海螺的声音带给主人听。';assert.equal(validateStory(raw,{owner:'朋友'}).intro,'我想把海螺的声音带给朋友听。');
  raw.ending='朋友教我跳过这个舞。';assert.throws(()=>validateStory(raw,{owner:'朋友'}),/共同经历/);
});
test('修订已有旅行故事、配文、旅行记忆与公告，保留孩子原话、图像引用和奖励存档',()=>{
  const story=fixture();story.intro='我想送给主人看。';story.ending='希望主人喜欢！';story.scenes[0].caption='主人，听一听。';
  const state={owner:'朋友',readings:3,storyRewards:{balance:2},stories:[{transcript:'孩子原文里的主人'}],trips:{'2026-10-13':{date:'2026-10-13',story,photos:['photo-1','photo-2']}},photos:[{id:'photo-1',kind:'trip',caption:'主人，看看这张',file:'existing.jpg'},{id:'upload',kind:'chat',caption:'孩子分享的主人公照片'}],memories:[{type:'trip',text:'我想给主人讲故事'},{type:'story',text:'孩子原文里的主人'}],chatArchive:[{role:'assistant',tripDate:'2026-10-13',content:'主人，我回来啦'},{role:'user',content:'这本书的主人公是谁'}]};
  const before=JSON.parse(JSON.stringify(state)),report=migrateTravelNames(state);
  assert.deepEqual(report.dates,['2026-10-13']);assert.equal(report.photos,1);assert.equal(report.memories,1);assert.equal(report.announcements,1);
  assert.doesNotMatch(JSON.stringify(state.trips),/主人/);assert.equal(state.photos[0].file,'existing.jpg');assert.deepEqual(state.trips['2026-10-13'].photos,before.trips['2026-10-13'].photos);
  assert.deepEqual(state.stories,before.stories);assert.deepEqual(state.storyRewards,before.storyRewards);assert.deepEqual(state.photos[1],before.photos[1]);assert.deepEqual(state.memories[1],before.memories[1]);assert.deepEqual(state.chatArchive[1],before.chatArchive[1]);assert.equal(migrateTravelNames(state).dates.length,0);
});
test('聊天提示使用虚构测试称呼，模型误用主人时输出仍改为朋友',async()=>{
  const voice=require('../voice-service'),original=global.fetch,keys=['PET_CHAT_API_KEY','PET_CHAT_BASE_URL'];const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  process.env.PET_CHAT_API_KEY='fixture';process.env.PET_CHAT_BASE_URL='https://fixture.invalid/v1';
  try{global.fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.match(body.messages[0].content,/朋友/);assert.match(body.messages[0].content,/朋友/);assert.match(body.messages[0].content,/禁止使用/);return new Response(JSON.stringify({choices:[{message:{content:'主人，想听我讲旅行故事吗？'}}]}));};assert.equal(await voice.chat('讲故事',[],{owner:'朋友',feeds:0}),'朋友，想听我讲旅行故事吗？');}
  finally{global.fetch=original;for(const key of keys){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}}
});
