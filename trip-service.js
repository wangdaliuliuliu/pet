const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { run } = require('./evolution-service');
const { python } = require('./photo-service');
const voice = require('./voice-service');
const { planStory, planStoryFromPhotos, publicStory, segmentText } = require('./travel-story');
const {personalizeStory}=require('./child-name');
const PLACES = [['萤光森林','沿着苔藓小路找发光的蘑菇'],['贝壳海湾','在沙滩上收集漂亮的贝壳'],['花朵山谷','在花丛间看蝴蝶飞舞'],['星光湖边','在湖边看星星的倒影'],['彩虹花园','在花架下听小鸟唱歌'],['云朵城堡','在城堡露台看软软的云'],['秋叶小径','把落叶摆成一颗爱心'],['雪花小镇','在暖暖的小屋外看雪花']];
function day(now = Date.now()) { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(now)); }
function yesterday(now = Date.now()) { return day(now - 86400000); }
function promptForPhoto(trip, index, feedback = '') {
  const scene = trip.story.scenes[index];
  return `Create one cinematic storybook travel moment starring DefaultPet, the SAME CURRENT evolved pink gemstone ballet kitten in the reference. The reference is an IDENTITY AND COSTUME guide ONLY, NOT a pose or composition template. Preserve recognizable face, pink fur, crown, costume, wings if present, and current accessories. Do not invent/remove wings or change evolution. Completely re-pose the body, head, limbs and expression for the story action; no default front-facing ballet showcase.\nLocation: ${trip.place}. Story: ${trip.story.title}.\nTHIS SPECIFIC MOMENT: ${scene.imagePrompt}\nCaption meaning to depict (do not render text): ${scene.caption}\nMoment narration: ${scene.narration}\nBody action: ${scene.actionKey}. Camera: ${scene.cameraKey}.\nOther moment in this trip (for continuity and contrast, do NOT depict it): ${trip.story.scenes[1-index].imagePrompt}\n${feedback ? 'Previous candidate rejected; correct these visible problems: '+feedback : ''}\nThe character is absorbed in this experience, with gaze directed at the story object, not posing for the viewer unless explicitly motivated by the scene. Scene details and props must make the event readable. One kitten only, no humans. Polished exquisite 3D fairytale illustration, natural light, full scenic background, NOT transparent. No typography, watermark, frame or split panels.`;
}
async function generateTripPhoto({ formFile, trip, index, dir, feedback }) {
  if (!process.env.PET_IMAGE_API_KEY) throw Error('图片服务尚未配置');
  fs.mkdirSync(dir,{recursive:true});
  const prompt = path.join(dir,'prompt.txt'), raw = path.join(dir,'source.png'), final = path.join(dir,'photo.jpg');
  fs.writeFileSync(prompt,promptForPhoto(trip,index,feedback));
  const env = { ...process.env,OPENAI_API_KEY:process.env.PET_IMAGE_API_KEY,OPENAI_BASE_URL:process.env.PET_IMAGE_BASE_URL,PYTHONUTF8:'1' };
  await run(python(),[process.env.PET_IMAGE_CLI||path.join(__dirname,'scripts/image_gen.py'),'edit','--model',process.env.PET_IMAGE_MODEL||'gpt-image-2','--image',formFile,'--prompt-file',prompt,'--size','1024x1024','--quality','high','--output-format','png','--out',raw],env,'拍摄旅行照片',900000);
  await run(python(),[path.join(__dirname,'scripts/normalize-photo.py'),raw,final],process.env,'保存旅行照片');
  return fs.readFileSync(final);
}
function createTrips({ state,save,dataDir,media,memory,generator=generateTripPhoto,planner=planStory,legacyPlanner=planner===planStory?planStoryFromPhotos:planner,reviewer=voice.reviewTravelPhoto,describe=voice.describePhoto,speaker=voice.speak,now=()=>Date.now() }) {
  state.trips ||= {};
  for (const trip of Object.values(state.trips)) {
    if (trip.status==='generating') { trip.status='failed';trip.error='上次旅行准备中断了，可以继续准备。'; }
    if (trip.storyStatus==='generating') trip.storyStatus='failed';
  }
  let active=false,completion=Promise.resolve();
  const storyJobs = new Map(), audioJobs = new Map();
  function eligible() { return state.stories.some(s=>day(s.createdAt)===yesterday(now())); }
  function recent() { return Object.values(state.trips).filter(t=>t.status==='ready').sort((a,b)=>a.date.localeCompare(b.date)).slice(-5).map(t=>({ date:t.date,place:t.place,title:t.story?.title,scenes:t.story?.scenes.map(s=>({actionKey:s.actionKey,cameraKey:s.cameraKey,caption:s.caption})),observedActions:t.photos.map(id=>media.get(id)?.observedAction||media.get(id)?.caption) })); }
  function view(date=day(now())) {
    const t=state.trips[date];
    return { eligible:date===day(now())&&eligible(),date,status:t?.status||'none',error:t?.error||'',place:t?.place,
      storyStatus:t?.storyStatus||(t?.story?'ready':'none'),storyError:t?.storyError||'',story:publicStory(t?.story),
      photos:(t?.photos||[]).map((id,index)=>{const p=media.publicPhoto(media.get(id));return p&&t.story?{...p,caption:t.story.scenes[index]?.caption||p.caption}:p;}).filter(Boolean) };
  }
  function storeStoryMemory(trip) {
    memory.put({type:'trip',key:'trip-'+trip.date,text:`${trip.date}小猫去了${trip.place}。${trip.story ? trip.story.title+'：'+trip.story.intro+' '+trip.story.scenes.map(s=>s.narration).join(' ')+' '+trip.story.ending : trip.activity}。照片编号：${trip.photos.join('、')}`},'trip-'+trip.date);
  }
  function start(retry=false) {
    const date=day(now());let trip=state.trips[date];
    if(active||trip?.status==='ready'||trip?.status==='generating'||(trip?.status==='failed'&&!retry)||!eligible())return false;
    if(!trip){const [place,activity]=PLACES[Math.abs(Math.floor(new Date(date+'T00:00:00+08:00').getTime()/86400000))%PLACES.length];trip={date,place,activity,photos:[],status:'generating'};state.trips[date]=trip;}
    active=true;trip.status='generating';trip.error='';delete trip.diagnostic;save();
    completion=(async()=>{
      let stage='创作旅行故事';
      try {
        if(!trip.story){
          if(trip.photos.length)await ensureStory(date);
          else {trip.story=personalizeStory(await planner({owner:state.owner,ownerNickname:state.ownerNickname,place:trip.place,activity:trip.activity,recent:recent()}),state);trip.storyStatus='ready';save();}
        }
        for(let index=trip.photos.length;index<2;index++) {
          let approved=false;
          for(let attempt=0;attempt<2&&!approved;attempt++) {
            let candidate=trip.pendingPhoto,bytes;
            if(candidate?.index===index&&!candidate.feedback&&candidate.file&&fs.existsSync(candidate.file)) bytes=fs.readFileSync(candidate.file);
            else {
              const form=state.evolution?.forms.at(-1),formImage=form?.image||'/assets/pet/stage-0.png';
              const formFile=form?.bundled?path.join(__dirname,'public',form.image):form?path.join(dataDir,'evolutions',form.file):path.join(__dirname,'public/assets/pet/stage-0.png');
              const dir=path.join(dataDir,'trip-work',date,crypto.randomUUID());
              candidate={index,formImage,formLevel:form?.level||0,startedAt:now(),file:path.join(dir,'candidate.jpg'),feedback:candidate?.index===index?candidate.feedback:''};
              trip.pendingPhoto=candidate;save();stage='拍摄旅行照片';
              bytes=await generator({formFile,formImage,trip,index,dir,feedback:candidate.feedback});
              fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(candidate.file,bytes);delete candidate.feedback;save();
            }
            stage='核对旅行照片';
            const previous=Object.values(state.trips).filter(t=>t.date<=date).sort((a,b)=>a.date.localeCompare(b.date)).flatMap(t=>t.photos).slice(-3).map(id=>media.get(id)).filter(Boolean);
            const review=await reviewer([`data:image/jpeg;base64,${bytes.toString('base64')}`,...previous.map(p=>media.dataUrl(p.id))],trip.story.scenes[index],previous.map(p=>({date:p.date,caption:p.caption,observedAction:p.observedAction})));
            if(!review.matches||review.duplicate){candidate.feedback=review.issues||'核心动作不符或与近期姿势重复，请按情节重新设计姿态和视角。';save();if(attempt===1)throw Error('旅行照片两次未通过画面核对。');continue;}
            const scene=trip.story.scenes[index];
            const photo=media.put(bytes,'image/jpeg',{kind:'trip',date,place:trip.place,activity:trip.activity,caption:scene.caption,storyTitle:trip.story.title,sceneIndex:index,actionKey:scene.actionKey,observedAction:review.observedAction,formImage:candidate.formImage,formLevel:candidate.formLevel});
            trip.photos.push(photo.id);delete trip.pendingPhoto;save();approved=true;
          }
        }
        trip.status='ready';
        if(!state.chatArchive.some(m=>m.tripDate===date))state.chatArchive.push({id:crypto.randomUUID(),role:'assistant',content:`喵！今天在${trip.place}发生了一件小事，叫《${trip.story.title}》。我带回了两张照片，想讲给你听。`,createdAt:now(),tripDate:date,photoIds:[...trip.photos]});
        storeStoryMemory(trip);
      } catch(error) { trip.status='failed';trip.error='这次旅行还没准备完整，已经收好的故事和照片会留下。可以继续准备。';trip.diagnostic=error.diagnostic||{stage}; }
      finally {active=false;save();}
    })();return true;
  }
  function getTrip(date) { const trip=state.trips[date];if(!trip) { const e=Error('这段旅行还没有收进相册。');e.status=404;throw e; } return trip; }
  function ensureStory(date) {
    const trip=getTrip(date);
    if(trip.story)return Promise.resolve(view(date));
    if(storyJobs.has(date))return storyJobs.get(date);
    if(!trip.photos.length){const e=Error('照片还在准备中。');e.status=409;return Promise.reject(e);}
    const job=(async()=>{
      trip.storyStatus='generating';trip.storyError='';save();
      let stage='理解旧照片';
      try {
        const images=trip.photos.map(id=>media.dataUrl(id));
        const observations=await Promise.all(images.map(image=>describe([image],'客观描述小猫的身体姿态、视线、表情、接触的物件与场景。不要编故事，不能假设画面之外发生的事。')));
        let accepted,feedback='';
        for(let attempt=0;attempt<2;attempt++){
          stage='为旧照片创作故事';
          const proposed=personalizeStory(await legacyPlanner({owner:state.owner,ownerNickname:state.ownerNickname,images,place:trip.place,activity:trip.activity,recent:recent(),observations,feedback}),state);
          trip.pendingStory={story:proposed};save();
          stage='核对旧照片与故事';const issues=[];
          for(let index=0;index<trip.photos.length;index++){
            const {caption,narration}=proposed.scenes[index];
            const review=await reviewer([images[index]],{caption,narration},[]);
            if(!review.matches)issues.push(`第${index+1}个瞬间：${review.issues}`);
          }
          if(!issues.length){accepted=proposed;break;}feedback='不能更换旧照片。请修改故事、配文和导演描述以忠实匹配实际照片，纠正：'+issues.join('；');trip.pendingStory.feedback=feedback;save();
        }
        if(!accepted)throw Error('旧照片与故事没有对应好。');
        trip.story=accepted;trip.storyStatus='ready';delete trip.storyDiagnostic;delete trip.pendingStory;
        trip.photos.forEach((id,index)=>{const photo=media.get(id);if(photo){photo.originalCaption ||= photo.caption;photo.caption=trip.story.scenes[index].caption;photo.storyTitle=trip.story.title;photo.sceneIndex=index;photo.observedAction=observations[index];}});
        storeStoryMemory(trip);save();return view(date);
      } catch(error) {trip.storyStatus='failed';trip.storyError='小猫这次还没把故事讲好，照片还在，可以再试一次。';trip.storyDiagnostic={stage,reason:error instanceof voice.VoiceError?'provider_unavailable':'story_validation'};save();throw error;}
      finally {storyJobs.delete(date);}
    })();storyJobs.set(date,job);return job;
  }
  function audio(date,index) {
    const trip=getTrip(date);if(!trip.story||trip.photos.length!==2||trip.status!=='ready') {const e=Error('旅行故事还在准备中。');e.status=409;throw e;}
    if(index!==0&&index!==1){const e=Error('没有找到这段故事。');e.status=400;throw e;}
    const text=segmentText(trip.story,index),key=crypto.createHash('sha256').update(date+'\n'+text).digest('hex');
    const dir=path.join(dataDir,'trip-audio'),file=path.join(dir,key+'.mp3');
    if(fs.existsSync(file))return Promise.resolve(fs.readFileSync(file));
    if(audioJobs.has(key))return audioJobs.get(key);
    const job=(async()=>{try{const bytes=await speaker(text);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file+'.tmp',bytes);fs.renameSync(file+'.tmp',file);return bytes;}finally{audioJobs.delete(key);}})();
    audioJobs.set(key,job);return job;
  }
  return { view,start,ensureStory,audio,settled:()=>completion,
    list:()=>Object.values(state.trips).filter(t=>t.photos.length).sort((a,b)=>b.date.localeCompare(a.date)).map(t=>({date:t.date,place:t.place,title:t.story?.title,cover:media.publicPhoto(media.get(t.photos[0])),status:t.status})),
    context:()=>Object.values(state.trips).sort((a,b)=>a.date.localeCompare(b.date)).slice(-14).map(t=>({date:t.date,place:t.place,activity:t.activity,status:t.status,photoIds:t.photos,story:publicStory(t.story)})) };
}
module.exports={createTrips,day,yesterday,generateTripPhoto,promptForPhoto};
