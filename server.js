const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const settings=require('./config');
const runtime=settings.serverConfig();
const {authorize}=require('./access');
const voice = require('./voice-service');
const { createEvolution } = require('./evolution-service');
const { createAnimation } = require('./animation-service');
const home = require('./home-service');
const storyRewards = require('./story-rewards');
const { createMemory } = require('./memory-service');
const chatHistory = require('./chat-history');
const {createMediaStore}=require('./media-store');
const {uploadPhoto}=require('./photo-service');
const {createTrips}=require('./trip-service');
const root = path.join(__dirname, 'public');
const dataDir = runtime.dataDir;
fs.mkdirSync(dataDir, { recursive: true });
const stateFile = path.join(dataDir, 'pet.json');
let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {
  owner: process.env.PET_OWNER_NICKNAME||'朋友', name: '小猫', createdAt: Date.now(), lastFedAt: null,
  readings: 0, food: 0, claimedRewards: 0, feeds: 0, stories: [], actions: []
};
function save() {
  fs.writeFileSync(stateFile + '.tmp', JSON.stringify(state, null, 2));
  fs.renameSync(stateFile + '.tmp', stateFile);
}
const animation = createAnimation({ state, save, dataDir });
const evolution = createEvolution({ state, save, dataDir, onForm: form => animation.start(form), animationView: () => animation.view() });
home.migrate(state);
chatHistory.migrate(state);
const memory = createMemory({ state, save, extract: voice.extractMemory });
const media=createMediaStore({state,save,dataDir});
const trips=createTrips({state,save,dataDir,media,memory});
if (!state.memoryBackfilled) {
  for (const story of [...state.stories].reverse().slice(-60)) memory.story(story);
  const pastChat = (state.chatMessages || []).filter(m => m.role === 'user').map(m => m.content).join('\n').slice(-2000);
  if (pastChat) memory.learn(pastChat, 'previous-chat');
  state.memoryBackfilled = true;
}
save();
// Only the current day's earned outing runs. Failed/interrupted paid work needs a manual retry.
if(process.env.PET_SKIP_ENV!=='1'&&settings.enabled('PET_ENABLE_GENERATION')) setTimeout(()=>animation.ensureCurrent(),1000).unref();
if(process.env.PET_SKIP_ENV!=='1'&&settings.enabled('PET_ENABLE_TRIPS')&&settings.enabled('PET_ENABLE_GENERATION')&&process.env.PET_DISABLE_TRIPS!=='1'){setTimeout(()=>trips.start(),1500).unref();setInterval(()=>trips.start(),15*60*1000).unref();}
function view() {
  const daysHungry = Math.floor((Date.now() - (state.lastFedAt || state.createdAt)) / 86400000);
  const { memories, memoryRevision, memoryBackfilled, chatMessages, chatArchive, animationPacks, photos, trips:privateTrips, storyRewards:privateRewards, ownerPhotoId, ...publicState } = state;
  return { ...publicState, evolution: evolution.view(), animation: animation.view(), trip: trips.view(), actions: undefined, daysHungry, sleeping: daysHungry >= 3,
    features:{generationEnabled:settings.enabled('PET_ENABLE_GENERATION'),tripsEnabled:settings.enabled('PET_ENABLE_TRIPS')&&settings.enabled('PET_ENABLE_GENERATION')},
    availableRewards: home.available(state), home: home.view(state) };
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if(req.method==='GET'&&url.pathname==='/healthz')return json(res,200,{ok:true});
  if(!authorize(req,res,runtime.password))return;
  if(req.method==='POST'&&req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'请从当前小屋页面提交操作。'});}catch{return json(res,403,{error:'来源地址不正确。'});}}
  if (req.method === 'POST' && url.pathname === '/api/read') return json(res, 410, { error: '现在要讲一个故事并保存，才能领取食材啦。' });
  if (req.method === 'GET' && url.pathname === '/api/chat/history') {
    try { const result=chatHistory.page(state, url.searchParams.get('before'));result.messages=result.messages.map(m=>({...m,photos:(m.photoIds||[]).map(id=>media.publicPhoto(media.get(id))).filter(Boolean),...(m.referencePhotoId?{referencePhoto:media.publicPhoto(media.get(m.referencePhotoId))}:{})}));return json(res, 200,result); }
    catch (err) { return json(res, err.status || 500, { error: err.message }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/capabilities') return json(res, 200, voice.capabilities());
  if (req.method === 'GET' && url.pathname === '/api/trips') return json(res, 200, { trips: trips.list() });
  const tripRoute = url.pathname.match(/^\/api\/trips\/(\d{4}-\d{2}-\d{2})(?:\/(story|audio)(?:\/([01]))?)?$/);
  if (tripRoute) {
    const [,date,action,index] = tripRoute;
    if (req.method === 'GET' && !action) {
      const trip = trips.view(date);return json(res, trip.status === 'none' ? 404 : 200, trip);
    }
    if (req.method === 'POST' && action) {
      try {
        if (action === 'story') {
          const existing=trips.view(date);
          if(existing.status==='none')return json(res,404,{error:'这段旅行还没有收进相册。'});
          if(existing.story)return json(res,200,existing);
          if(!existing.photos.length)return json(res,409,{error:'照片还在准备中。'});
          trips.ensureStory(date).catch(()=>{});
          return json(res,202,trips.view(date));
        }
        const bytes = await trips.audio(date, index === undefined ? -1 : Number(index));
        res.writeHead(200, { 'Content-Type':'audio/mpeg','Cache-Control':'private, max-age=86400' });return res.end(bytes);
      } catch(err) { return json(res, err.status || 502, { error: err instanceof voice.VoiceError ? err.message : '这次旅行故事没准备好，可以稍后再试。' }); }
    }
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/media/')){const id=url.pathname.split('/').pop(),p=media.get(id);if(!p)return json(res,404,{error:'照片没有找到。'});res.writeHead(200,{'Content-Type':p.type,'Cache-Control':'private, max-age=3600'});return res.end(media.bytes(id));}
  if(req.method==='POST'&&url.pathname==='/api/photos'){
    try{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>12*1024*1024)return json(res,413,{error:'选一张8MB以内的照片吧。'});chunks.push(chunk);}
      const body=JSON.parse(Buffer.concat(chunks).toString());if(typeof body.actionId!=='string'||body.actionId.length>100)return json(res,400,{error:'重新选一次照片吧。'});
      const old=state.photos.find(p=>p.uploadActionId===body.actionId);if(old)return json(res,200,{photo:media.publicPhoto(old)});
      const p=await uploadPhoto(body,media,dataDir);p.uploadActionId=body.actionId;if(p.selfLabeled)state.ownerPhotoId=p.id;save();return json(res,200,{photo:media.publicPhoto(p)});
    }catch{return json(res,400,{error:'照片没能保存。请选择 JPG、PNG 或 WebP 图片再试一次。'});}
  }
  if (req.method === 'POST' && ['/api/voice/transcribe', '/api/voice/chat', '/api/voice/speak'].includes(url.pathname)) {
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 12 * 1024 * 1024) return json(res, 413, { error: '声音文件太长啦，请讲短一点。' }); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      if (url.pathname.endsWith('/transcribe')) return json(res, 200, { text: await voice.transcribe(body) });
      if (url.pathname.endsWith('/speak')) { const audio = await voice.speak(body.text); res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }); return res.end(audio); }
      if (body.actionId && state.chatArchive.some(m => m.actionId === body.actionId && m.role === 'assistant')) return json(res, 200, { reply: state.chatArchive.find(m => m.actionId === body.actionId && m.role === 'assistant').content });
      const message=typeof body.message==='string'?body.message.trim():'';
      if(message.length>2000||(!message&&!body.photoId&&!body.referencePhotoId))return json(res,400,{error:'说一句话或选一张照片吧。'});
      const photo=media.get(body.photoId||body.referencePhotoId);
      if((body.photoId||body.referencePhotoId)&&!photo)return json(res,404,{error:'这张照片没有找到。'});
      const text=message||(photo?.selfLabeled?'这是我，看看我今天的照片吧！':'小猫，看看这张照片吧！');
      const memoryRevision = state.memoryRevision;
      let visualContext='';
      if(photo){if(photo.kind==='trip'){visualContext=photo.caption+' 地点：'+photo.place+'，日期：'+photo.date+'。这是一张小猫的旅行照片。 '+await voice.describePhoto([media.dataUrl(photo.id)],text);if(!photo.visualDescription)photo.visualDescription=visualContext;save();}
        else{visualContext=await voice.describePhoto([media.dataUrl(photo.id)],text);if(!photo.analyzedAt){photo.caption=visualContext;photo.analyzedAt=Date.now();}if(photo.selfLabeled)state.ownerPhotoId=photo.id;
          memory.put({type:'photo',key:photo.selfLabeled?'owner-reference':'photo-'+photo.id,text:(photo.selfLabeled?'孩子主动标记这是自己。':'孩子分享了照片。')+photo.caption.slice(0,150)},photo.id);save();}}
      const photoContext={referencedPhoto:photo?{id:photo.id,description:visualContext,selfLabeled:!!photo.selfLabeled,date:photo.date,place:photo.place,activity:photo.activity,formLevel:photo.formLevel,formImage:photo.formImage}:null,ownerReference:media.get(state.ownerPhotoId)?.caption||null,trips:trips.context()};
      const reply = await voice.chat(text, state.chatMessages || [], {...view(),photoContext}, memory.relevant(text));
      state.chatMessages ||= [];
      chatHistory.append(state, text, reply, body.actionId);
      const userRecord=state.chatArchive.at(-2);if(body.photoId)userRecord.photoIds=[photo.id];if(body.referencePhotoId)userRecord.referencePhotoId=photo.id;
      if (memoryRevision === state.memoryRevision) {
        state.chatMessages.push({ role: 'user', content: text+(photo?' [照片内容：'+visualContext+']':''), actionId: body.actionId }, { role: 'assistant', content: reply, actionId: body.actionId });
        state.chatMessages = state.chatMessages.slice(-24); save();
        memory.learn(text, body.actionId || crypto.randomUUID());
      }
      save();
      return json(res, 200, { reply });
    } catch (err) { return json(res, err.status || 502, { error: err instanceof voice.VoiceError ? err.message : '刚才没有完成，请再试一次。' }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/pet') return json(res, 200, view());
  if (req.method === 'GET' && url.pathname.startsWith('/api/animations/')) {
    const file=animation.asset(url.pathname);
    if(!file)return json(res,404,{error:'动作还没准备好。'});
    res.writeHead(200,{'Content-Type':file.endsWith('.json')?'application/json; charset=utf-8':'image/png','Cache-Control':'public, max-age=31536000, immutable'});
    return fs.createReadStream(file).pipe(res);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/evolutions/')) {
    const form = state.evolution.forms.find(f => f.image === url.pathname);
    if (!form) return json(res, 404, { error: '这个形态还没有准备好。' });
    const file = path.join(dataDir, 'evolutions', form.file);
    if (!fs.existsSync(file)) return json(res, 404, { error: '这个形态暂时没有找到。' });
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' });
    return fs.createReadStream(file).pipe(res);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/recordings/')) {
    const id = url.pathname.split('/').pop();
    const story = state.stories.find(s => s.id === id && s.audioType);
    if (!story) return json(res, 404, { error: '这段录音没有找到。' });
    res.writeHead(200, { 'Content-Type': story.audioType, 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(path.join(dataDir, id + '.audio')));
  }
  if (req.method === 'POST' && ['/api/story', '/api/claim', '/api/cook', '/api/feed', '/api/evolve', '/api/animate', '/api/trip/retry', '/api/room', '/api/birthday', '/api/celebrate', '/api/memory/delete'].includes(url.pathname)) {
    try {
      let chunks = [], size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 12 * 1024 * 1024) { json(res, 413, { error: '录音太长啦，请讲一个短一点的故事。' }); return; }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      if (!body.actionId || typeof body.actionId !== 'string' || body.actionId.length > 100) return json(res, 400, { error: '请重新试一次。' });
      if(url.pathname==='/api/story'){
        const oldStory=state.stories.find(story=>story.actionId===body.actionId);
        if(oldStory)return json(res,200,{...view(),storyReward:storyRewards.result(state,oldStory,Date.now(),true)});
      }
      if (state.actions.includes(body.actionId)) return json(res, 200, view());
      let submittedStory;
      if (url.pathname === '/api/story') {
        const transcript = typeof body.transcript === 'string' ? body.transcript.trim().slice(0, 2000) : '';
        const allowedTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac', 'audio/x-wav'];
        const audioType = typeof body.audioType === 'string' ? body.audioType.split(';')[0] : '';
        const audio = typeof body.audio === 'string' ? Buffer.from(body.audio, 'base64') : null;
        if (!transcript && !(audio && audio.length >= 1000 && allowedTypes.includes(audioType))) return json(res, 400, { error: '先讲一小段故事，再告诉小猫吧。' });
        if (audio && !allowedTypes.includes(audioType)) return json(res, 400, { error: '请选一段录音文件。' });
        const id = crypto.randomUUID();
        if (audio) fs.writeFileSync(path.join(dataDir, id + '.audio'), audio);
        submittedStory={id,actionId:body.actionId,transcript,createdAt:Date.now(),audioType:audio?audioType:null};
        state.stories.unshift(submittedStory);
        state.readings++;
        storyRewards.grant(state,submittedStory);
        memory.story(state.stories[0]);
      } else if (url.pathname === '/api/memory/delete') {
        if (!memory.remove(body.id)) return json(res, 404, { error: '这条记忆已经不在啦。' });
      } else if (url.pathname === '/api/trip/retry') {
        if(!settings.enabled('PET_ENABLE_TRIPS')||!settings.enabled('PET_ENABLE_GENERATION'))return json(res,503,{error:'旅行是选配项，需要启用旅行和图片生成并配置相关服务。'});
        if(!trips.start(true))return json(res,409,{error:'今天没有待补的旅行照片，或照片正在准备。'});
      } else if (url.pathname === '/api/animate') {
        if(!settings.enabled('PET_ENABLE_GENERATION')&&animation.view().status!=='ready')return json(res,503,{error:'额外动作生成是选配项，当前未启用。预制形态自带完整动作。'});
        if (animation.view().status==='ready') return json(res,409,{error:'小猫的动作已经准备好啦。'});
        if (!animation.start()) return json(res,409,{error:'动作正在准备，或还没有可以绑定的新形态。'});
      } else if (url.pathname === '/api/evolve') {
        if (!evolution.view().complete) return json(res, 409, { error: '这次进化的动作还没准备齐全，请先完成动作，再进行下一次进化。' });
        if (!evolution.view().eligible) return json(res, 409, { error: '还没到进化的时候，继续喂小猫吧。' });
        evolution.start();
      } else {
        home.action(state, url.pathname.slice(5), body);
        if (url.pathname === '/api/feed' && state.evolution.status === 'idle') evolution.start();
      }
      state.actions.push(body.actionId);
      state.actions = state.actions.slice(-500);
      save();
      return json(res, 200, {...view(),...(submittedStory?{storyReward:storyRewards.result(state,submittedStory)}:{})});
    } catch (err) {
      console.error('请求未完成:', err.message);
      return json(res, err.status || 400, { error: err.status ? err.message : '刚才没有保存成功，请再试一次。' });
    }
  }
  if (req.method !== 'GET') return json(res, 405, { error: '这个操作暂时不能用。' });
  let filename;
  try { filename = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
  catch { return json(res, 400, { error: '地址不正确。' }); }
  if (!filename.startsWith(root + path.sep)) return json(res, 403, { error: '这里不能打开。' });
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return json(res, 404, { error: '没有找到这个页面。' });
  res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(filename).pipe(res);
});
server.listen(runtime.port,runtime.host,()=>console.log('小猫的小家已打开：http://localhost:'+runtime.port+'（配置检查：npm run doctor）'));

