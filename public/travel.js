(() => {
  const dialog = document.createElement('dialog');
  dialog.id = 'travel-dialog';dialog.className = 'game-dialog travel-dialog';
  dialog.setAttribute('aria-labelledby','travel-title');
  dialog.innerHTML = `<header class="dialog-top"><span class="tiny-label">小猫的旅行小信</span><button type="button" class="close-button" aria-label="关闭旅行故事">×</button></header>
    <div class="travel-heading"><p class="travel-place"></p><h2 id="travel-title">路上的小故事</h2></div>
    <figure class="travel-moment"><button type="button" class="travel-photo-open" aria-label="放大这个旅行瞬间"><img alt="小猫的旅行瞬间"></button><figcaption></figcaption></figure>
    <nav class="travel-pages" aria-label="旅行照片"><button type="button" class="travel-prev" aria-label="上一张照片">‹</button><span class="travel-page-count" aria-live="polite"></span><button type="button" class="travel-next" aria-label="下一张照片">›</button></nav>
    <button type="button" class="travel-listen"><svg aria-hidden="true"><use href="#i-sound"/></svg><span>听小猫讲</span></button>
    <p class="travel-status" role="status"></p><audio class="travel-audio" preload="none"></audio>
    <details class="travel-reading"><summary>读这段小故事 <span>⌄</span></summary><div class="travel-prose"></div></details>
    <details class="travel-archive"><summary>以前的旅行 <span>⌄</span></summary><label for="travel-select">选一段小回忆</label><select id="travel-select"></select></details>`;
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector), listen = find('.travel-listen'), audio = find('audio');
  const shelf = document.createElement('button');shelf.type='button';shelf.className='travel-shelf';shelf.hidden=true;
  shelf.innerHTML='<span class="travel-shelf-icon" aria-hidden="true">✉</span><span><small>小猫也有故事想讲给你</small><strong>路上的小故事</strong></span><span aria-hidden="true">›</span>';
  document.getElementById('stories').before(shelf);
  let current, moment=0, session=0, controller, playing=false, loading=false, replay=false, sourceIndex=-1, latestDate;
  const sources=new Map(), sourceJobs=new Map();
  function label(text){listen.querySelector('span').textContent=text;}
  function status(text){find('.travel-status').textContent=text;}
  function halt(){playing=false;audio.pause();label('听小猫讲');}
  function cleanup(){session++;controller?.abort();halt();loading=false;replay=false;listen.disabled=false;audio.removeAttribute('src');audio.load();sourceIndex=-1;for(const value of sources.values())URL.revokeObjectURL(value);sources.clear();sourceJobs.clear();}
  function showMoment(index){
    if(!current?.photos.length)return;
    moment=Math.max(0,Math.min(index,current.photos.length-1));
    const photo=current.photos[moment];find('figure img').src=photo.url;find('figure img').alt=current.story?.scenes[moment]?.caption||photo.caption;
    find('figcaption').textContent=current.story?.scenes[moment]?.caption||photo.caption;
    find('.travel-page-count').textContent=`${moment+1} / ${current.photos.length}`;
    find('.travel-prev').disabled=moment===0;find('.travel-next').disabled=moment===current.photos.length-1;
  }
  function renderTrip(trip){
    current=trip;find('.travel-place').textContent=trip.date.replaceAll('-',' · ')+'  /  '+trip.place;
    find('h2').textContent=trip.story?.title||'在'+trip.place+'的小回忆';
    find('figure').hidden=!trip.photos.length;showMoment(moment);
    const prose=find('.travel-prose');prose.replaceChildren();
    if(trip.story)for(const text of [trip.story.intro,...trip.story.scenes.map(s=>s.narration),trip.story.ending]){const p=document.createElement('p');p.textContent=text;prose.append(p);}
    listen.disabled=trip.status!=='ready';
    find('.travel-reading').hidden=!trip.story&&trip.status!=='ready';
    if(trip.status!=='ready')status(trip.error||'照片还在准备，先看看已经带回的小回忆。');
  }
  async function fetchTrip(date,signal){const response=await fetch('/api/trips/'+date,{signal});if(!response.ok)throw Error('这段旅行暂时没打开，再试一次吧。');return response.json();}
  async function loadArchive(signal){
    const response=await fetch('/api/trips',{signal});if(!response.ok)throw Error('相册暂时没打开。');const {trips}=await response.json();
    const select=find('select');select.replaceChildren();for(const trip of trips){const option=document.createElement('option');option.value=trip.date;option.textContent=trip.date+' · '+(trip.title||trip.place);select.append(option);}
    find('.travel-archive').hidden=trips.length<2;
    return trips;
  }
  async function open(date,initialIndex=0){
    cleanup();controller=new AbortController();const token=session;moment=initialIndex;current=null;status('正在打开小猫的小回忆……');
    find('h2').textContent='路上的小故事';find('.travel-place').textContent='';find('figure').hidden=true;find('.travel-reading').open=false;find('.travel-reading').hidden=true;find('.travel-archive').open=false;listen.disabled=true;
    document.getElementById('chat-audio').pause();
    document.querySelectorAll('#stories audio').forEach(a=>a.pause());
    if(!dialog.open)dialog.showModal();
    try{const trips=await loadArchive(controller.signal);if(token!==session)return;const chosen=date||trips[0]?.date;if(!chosen)throw Error('小猫还没有带回旅行照片，明天再来看看吧。');const trip=await fetchTrip(chosen,controller.signal);if(token!==session)return;renderTrip(trip);find('select').value=chosen;if(current.status==='ready')status('点一下，听小猫讲路上发生的事。');}
    catch(error){if(token===session&&error.name!=='AbortError')status(error.message);}
  }
  async function ensureStory(token){
    if(current.story)return;
    status('小猫正在把这段小回忆整理成故事……');
    const response=await fetch('/api/trips/'+current.date+'/story',{method:'POST',signal:controller.signal});let data=await response.json();if(!response.ok)throw Error(data.error);
    while(!data.story&&data.storyStatus==='generating'&&token===session){
      status('小猫在整理旧照片里的小故事，可以先看图，稍后再来听。');
      await new Promise((resolve,reject)=>{const signal=controller.signal;const abort=()=>{clearTimeout(timer);reject(new DOMException('故事页已关闭','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1500);if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});
      if(token!==session)return;data=await fetchTrip(current.date,controller.signal);
    }
    if(token!==session)return;if(!data.story)throw Error(data.storyError||'这段故事还没整理好，请再试一次。');renderTrip(data);
  }
  async function source(index,token){
    if(sources.has(index))return sources.get(index);
    if(sourceJobs.has(index))return sourceJobs.get(index);
    const job=(async()=>{try{const response=await fetch(`/api/trips/${current.date}/audio/${index}`,{method:'POST',signal:controller.signal});if(!response.ok){const data=await response.json();throw Error(data.error);}
      const blob=await response.blob();if(token!==session)return null;const url=URL.createObjectURL(blob);sources.set(index,url);return url;
    }finally{if(token===session)sourceJobs.delete(index);}})();sourceJobs.set(index,job);return job;
  }
  async function play(index,token){
    loading=true;listen.disabled=true;label('准备声音……');status('小猫马上开口，照片会跟着故事换页。');
    const url=await source(index,token);if(token!==session||!url)return;
    audio.src=url;sourceIndex=index;showMoment(index);loading=false;listen.disabled=false;
    try{await audio.play();if(token!==session)return;playing=true;label('暂停故事');status(`正在讲第 ${index+1} 段，共 2 段`);}
    catch{playing=false;label('继续听');status('声音准备好了，再点一下就能听。');}
    if(index===0)source(1,token).catch(()=>{});
  }
  listen.onclick=async()=>{
    if(loading||!current)return;
    if(playing){halt();label('继续听');status('故事暂停了，准备好再继续。');return;}
    if(replay){replay=false;sourceIndex=-1;showMoment(0);}
    const token=session;loading=true;listen.disabled=true;
    try{await ensureStory(token);if(token!==session)return;
      if(sourceIndex===moment&&audio.src&&!audio.ended){await audio.play();if(token!==session)return;playing=true;label('暂停故事');status(`正在讲第 ${moment+1} 段，共 2 段`);}
      else await play(moment,token);
    }catch(error){if(token===session&&error.name!=='AbortError'){halt();status((error.message||'声音暂时没有接上。')+' 也可以展开文字读故事。');}}
    finally{if(token===session){loading=false;listen.disabled=false;}}
  };
  audio.onended=()=>{const token=session;if(sourceIndex===0&&playing)play(1,token).catch(error=>{if(token!==session)return;loading=false;listen.disabled=false;halt();status(error.message+'，可以读文字故事。');});else{halt();label('再听一遍');replay=true;sourceIndex=-1;status('故事讲完啦。你最喜欢哪个瞬间？');}};
  audio.onerror=()=>{if(!audio.getAttribute('src'))return;halt();loading=false;listen.disabled=false;sourceIndex=-1;status('声音这次没播出来，可以再试一次或读文字。');};
  find('.travel-prev').onclick=()=>{halt();replay=false;sourceIndex=-1;showMoment(moment-1);status('从这个瞬间开始听。');};
  find('.travel-next').onclick=()=>{halt();replay=false;sourceIndex=-1;showMoment(moment+1);status('从这个瞬间开始听。');};
  find('.travel-photo-open').onclick=()=>{halt();label(replay?'再听一遍':'继续听');if(current?.photos[moment])window.chatUI?.openPhoto(current.photos[moment]);};
  find('.travel-reading').ontoggle=async()=>{if(!find('.travel-reading').open||current?.story||!current)return;const token=session;try{await ensureStory(token);if(token===session)status('小故事已经收好啦。');}catch(error){if(token===session&&error.name!=='AbortError')status(error.message);}};
  find('select').onchange=()=>open(find('select').value);
  find('.close-button').onclick=()=>dialog.close();dialog.addEventListener('close',cleanup);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){halt();label('继续听');}});
  function update(state){const trip=state.trip;if(trip?.photos?.length){latestDate=trip.date;shelf.hidden=false;shelf.querySelector('strong').textContent=trip.story?.title||'在'+trip.place+'的小回忆';}}
  shelf.onclick=()=>open(latestDate);
  window.travelUI={open,update};
  if(pet)update(pet);
  fetch('/api/trips').then(r=>r.json()).then(data=>{if(!latestDate&&data.trips?.length){const trip=data.trips[0];latestDate=trip.date;shelf.hidden=false;shelf.querySelector('strong').textContent=trip.title||'在'+trip.place+'的小回忆';}}).catch(()=>{});
})();
