(() => {
  const el = id => document.getElementById(id);
  const chip = document.createElement('button'); chip.className = 'chat-chip'; chip.textContent = '♡ 和小猫聊天'; chip.setAttribute('aria-label', '和小猫聊天'); el('scene').append(chip);
  let caps = {}, stream, recorder, recording = false, busy = false, audioUrl, timeout, requestController, session = 0;
  let nextBefore = null, historyLoading = false;
  let selectedPhoto=null,uploadedPhoto=null,uploadActionId=null,referencePhoto=null,previewUrl=null;
  const photoTools=document.createElement('div');photoTools.className='chat-photo-tools';photoTools.innerHTML='<button type="button" class="secondary-button" id="chat-camera">📷 拍照</button><button type="button" class="secondary-button" id="chat-album">🖼 发图片</button>';
  const camera=document.createElement('input'),album=document.createElement('input');for(const input of [camera,album]){input.type='file';input.accept='image/*';input.hidden=true;photoTools.append(input);}camera.setAttribute('capture','user');
  const preview=document.createElement('div');preview.className='photo-preview';preview.hidden=true;preview.innerHTML='<img alt="待发送照片"><label><input type="checkbox" id="photo-is-me"> 这是我<br><small>选中后，小猫会记下这张参考照片。</small></label><button type="button" aria-label="取消照片">×</button>';
  const reference=document.createElement('div');reference.className='photo-reference';reference.hidden=true;
  const tripBanner=document.createElement('div');tripBanner.className='trip-banner';
  el('chat-form').before(photoTools,preview,reference);el('chat-messages').before(tripBanner);
  const viewer=document.createElement('dialog');viewer.className='game-dialog photo-viewer';viewer.innerHTML='<div class="dialog-top"><span class="tiny-label">小猫的小相册</span><button class="close-button" aria-label="关闭照片">×</button></div><img alt="照片大图"><p class="dialog-copy"></p><button class="secondary-button photo-view-cite">聊聊这张照片</button>';document.body.append(viewer);viewer.querySelector('.close-button').onclick=()=>viewer.close();
  function openPhoto(photo){viewer.querySelector('img').src=photo.url;viewer.querySelector('p').textContent=photo.caption||'我们分享的照片';viewer.querySelector('.photo-view-cite').onclick=()=>{viewer.close();if(!el('chat-dialog').open)chip.onclick().then(()=>cite(photo));else cite(photo);};viewer.showModal();}
  el('chat-camera').onclick=()=>camera.click();el('chat-album').onclick=()=>album.click();
  function clearPhoto(){selectedPhoto=null;uploadedPhoto=null;uploadActionId=null;preview.hidden=true;camera.value=album.value='';if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;}
  preview.querySelector('button').onclick=clearPhoto;
  function selectPhoto(input){const file=input.files?.[0];if(!file)return;if(file.size>8*1024*1024){el('chat-error').textContent='选一张8MB以内的照片吧。';return;}clearPhoto();selectedPhoto=file;uploadActionId=uuid();previewUrl=URL.createObjectURL(file);preview.querySelector('img').src=previewUrl;el('photo-is-me').checked=false;preview.hidden=false;referencePhoto=null;reference.hidden=true;}
  camera.onchange=()=>selectPhoto(camera);album.onchange=()=>selectPhoto(album);
  function cite(photo){referencePhoto=photo;reference.hidden=false;reference.replaceChildren(document.createTextNode('正在聊这张照片：'+(photo.caption||'照片').slice(0,35)));const cancel=document.createElement('button');cancel.textContent='×';cancel.type='button';cancel.onclick=()=>{referencePhoto=null;reference.hidden=true;};reference.append(cancel);el('chat-text').focus();}
  function bubble(m){const p=document.createElement('article');p.className='chat-bubble '+(m.role==='user'?'my-message':'pet-reply');p.textContent=m.content;p.dataset.messageId=m.id||'';if(m.referencePhoto){const quote=document.createElement('button');quote.type='button';quote.className='secondary-button';quote.textContent='↪ 引用的照片';quote.onclick=()=>openPhoto(m.referencePhoto);p.append(quote);}const travelPhotos=(m.photos||[]).filter(photo=>photo.kind==='trip');if(travelPhotos.length){const gallery=document.createElement('div');gallery.className='travel-chat-photos';for(const photo of travelPhotos){const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',photo.caption);const image=document.createElement('img');image.src=photo.url;image.alt=photo.caption;image.loading='lazy';button.append(image);button.onclick=()=>window.travelUI?.open(photo.date);gallery.append(button);}const listen=document.createElement('button');listen.type='button';listen.className='secondary-button travel-chat-listen';listen.textContent='听小猫讲这段旅行';listen.onclick=()=>window.travelUI?.open(travelPhotos[0].date);p.append(gallery,listen);}for(const photo of (m.photos||[]).filter(photo=>photo.kind!=='trip')){const image=document.createElement('img');image.className='chat-photo';image.src=photo.url;image.alt=photo.caption||'聊天照片';image.loading='lazy';image.onclick=()=>openPhoto(photo);const button=document.createElement('button');button.type='button';button.className='secondary-button';button.textContent='聊聊这张照片';button.onclick=()=>cite(photo);p.append(image,button);}return p;}
  async function preparePhoto(file){const image=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(image.width,image.height));const c=document.createElement('canvas');c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);const context=c.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,c.width,c.height);context.drawImage(image,0,0,c.width,c.height);image.close();return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('照片没有读出来。')),'image/jpeg',.9));}
  function updateTrip(state){const t=state.trip;if(!t)return;tripBanner.replaceChildren();const text=document.createElement('div');text.textContent=t.status==='ready'?`小猫今天去了${t.place}，带回两张照片啦！`:t.status==='generating'?`小猫正在${t.place}玩，照片准备中……`:t.status==='failed'?t.error:t.eligible?'小猫今天会带回两张旅行照片。':'今天先在小屋玩。今天讲个故事，明天小猫就能带回旅行照片。';tripBanner.append(text);
    if(t.photos?.length){const button=document.createElement('button');button.type='button';button.textContent=t.story?.title?'听《'+t.story.title+'》':'打开旅行小故事';button.onclick=()=>window.travelUI?.open(t.date);tripBanner.append(button);}
    if(t.status==='failed'){const retry=document.createElement('button');retry.textContent='继续准备剩下的照片';retry.onclick=async()=>{retry.disabled=true;try{await mutate('/api/trip/retry',{actionId:uuid()});}catch(e){el('chat-error').textContent=e.message;}finally{retry.disabled=false;}};tripBanner.append(retry);}
  }
  window.chatUI={updateTrip,openPhoto};
  const older = document.createElement('button'); older.className = 'secondary-button'; older.textContent = '看看更早的聊天'; older.hidden = true; el('chat-messages').before(older);
  fetch('/api/capabilities').then(r => r.json()).then(data => { caps = data; }).catch(() => {});
  function controls() { el('chat-send').disabled = busy || recording; el('chat-text').disabled = busy || recording; el('chat-record').disabled = busy; el('chat-camera').disabled=busy||recording;el('chat-album').disabled=busy||recording;el('photo-is-me').disabled=busy||recording;preview.querySelector('button').disabled=busy||recording; }
  function message(text, mine) { const p = document.createElement('p'); p.className = 'chat-bubble ' + (mine ? 'my-message' : 'pet-reply'); p.textContent = text; el('chat-messages').append(p); el('chat-messages').scrollTop = el('chat-messages').scrollHeight; }
  function status(text) { el('chat-status').textContent = text; }
  async function api(route, body) { const res = await fetch('/api/voice/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: requestController.signal }); const result = await res.json(); if (!res.ok) throw new Error(result.error || '刚才没有听清，再试一次吧。'); return result; }
  async function loadHistory(currentSession, earlier = false) {
    if (historyLoading || (earlier && nextBefore === null)) return;
    historyLoading = true; older.disabled = true;
    try {
      const res = await fetch('/api/chat/history' + (earlier ? '?before=' + nextBefore : ''), { signal: requestController.signal });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); if (currentSession !== session) return;
      const area = el('chat-messages'), fragment = document.createDocumentFragment();
      for (const m of data.messages) fragment.append(bubble(m));
      const height = area.scrollHeight;
      if (earlier) { area.prepend(fragment); area.scrollTop += area.scrollHeight - height; }
      else { area.replaceChildren(fragment); if (!data.messages.length) message('想聊聊今天读的书，还是别的有趣事情？', false); area.scrollTop = area.scrollHeight; }
      nextBefore = data.nextBefore; older.hidden = nextBefore === null;
    } catch(e) { if (currentSession === session && e.name !== 'AbortError') el('chat-error').textContent = '之前的聊天暂时没加载出来，重新打开聊天再试一下。'; }
    finally { if (currentSession === session) { historyLoading = false; older.disabled = false; } }
  }
  chip.onclick = async () => {
    document.querySelectorAll('dialog[open]').forEach(d => { if (d.id === 'story-dialog') closeStory(); else d.close(); });
    el('chat-dialog').showModal(); el('chat-error').textContent = caps.chatConfigured ? '' : '小猫的聊天服务还没接通，请大人先完成服务配置。';
    if(pet)updateTrip(pet);
    busy = true; controls(); requestController = new AbortController(); const currentSession = session;
    await loadHistory(currentSession);
    if (currentSession === session) { busy = false; controls(); }
  };
  older.onclick = async () => { if (busy || recording) return; busy = true; controls(); requestController = new AbortController(); const currentSession = session; await loadHistory(currentSession, true); if (currentSession === session) { busy = false; controls(); } };
  function stop() { clearTimeout(timeout); if (recording && recorder?.state === 'recording') recorder.stop(); recording = false; el('chat-record').classList.remove('recording'); el('chat-record').textContent = '开始说话'; }
  function close() { session++; requestController?.abort(); stop(); stream?.getTracks().forEach(t => t.stop()); el('chat-audio').pause(); busy = false; historyLoading = false; clearPhoto();referencePhoto=null;reference.hidden=true;controls(); el('chat-dialog').close(); }
  el('close-chat').onclick = close;
  el('chat-dialog').addEventListener('cancel', close);
  el('chat-dialog').addEventListener('close', () => { if (recording || busy) close(); });
  async function playReply(text, currentSession) {
    if (!caps.speechConfigured) { status('文字回答已经收好，声音服务还没接通。'); return; }
    status('小猫准备开口啦……');
    try { const res = await fetch('/api/voice/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: requestController.signal }); if (!res.ok) { const result = await res.json(); throw new Error(result.error); } const blob = await res.blob(); if (session !== currentSession) return; if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = URL.createObjectURL(blob); el('chat-audio').src = audioUrl; el('chat-audio').hidden = false; try { await el('chat-audio').play(); status('小猫在和你说话。'); } catch { status('点一下播放器，就能听小猫的回答。'); } }
    catch(e) { if (session === currentSession && e.name !== 'AbortError') status('回答已经显示，声音这次没有播放出来。' + (e.message || '')); }
  }
  async function reply(text, currentSession) {
    status(selectedPhoto?'照片保存中，小猫在看一看……':'小猫在想一想……');
    if(selectedPhoto&&!uploadedPhoto){const prepared=await preparePhoto(selectedPhoto);const response=await fetch('/api/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:await toBase64(prepared),selfLabeled:el('photo-is-me').checked,actionId:uploadActionId}),signal:requestController.signal});const data=await response.json();if(!response.ok)throw Error(data.error);if(session!==currentSession)return;uploadedPhoto=data.photo;}
    const photo=uploadedPhoto,ref=referencePhoto;const messageText=text||(photo?.selfLabeled?'这是我，看看我今天的照片吧！':'小猫，看看这张照片吧！');
    const result=await api('chat',{message:messageText,actionId:uuid(),...(photo?{photoId:photo.id}:ref?{referencePhotoId:ref.id}:{})});if(session!==currentSession)return;
    el('chat-messages').append(bubble({role:'user',content:messageText,photos:photo?[photo]:[]}));clearPhoto();referencePhoto=null;reference.hidden=true;message(result.reply,false);el('speech').textContent=result.reply.length>23?result.reply.slice(0,22)+'…':result.reply;await playReply(result.reply,currentSession);
  }
  el('chat-form').onsubmit = async event => { event.preventDefault(); const text = el('chat-text').value.trim(); if ((!text&&!selectedPhoto&&!referencePhoto) || busy || recording) return; busy = true; controls(); el('chat-error').textContent = ''; requestController = new AbortController(); const currentSession = session; try { await reply(text, currentSession); if (session === currentSession) el('chat-text').value = ''; } catch(e) { if (session === currentSession && e.name !== 'AbortError') { el('chat-error').textContent = e.message || '暂时没有接上，请再试一次。'; status(''); } } finally { if (session === currentSession) { busy = false; controls(); } } };
  el('chat-record').onclick = async () => {
    if (recording) { stop(); return; } if (busy) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { el('chat-error').textContent = '手机录音需要 HTTPS 网址。请大人用安全网址打开小屋。'; return; }
    if (!caps.transcriptionConfigured || !caps.chatConfigured) { el('chat-error').textContent = '语音转文字和聊天服务还没接通，请大人先完成配置。'; return; }
    el('chat-error').textContent = ''; busy = true; controls(); el('chat-audio').pause(); const currentSession = session;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (session !== currentSession || !el('chat-dialog').open) { stream.getTracks().forEach(t => t.stop()); return; }
      const chunks = []; const currentStream = stream; recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        currentStream.getTracks().forEach(t => t.stop()); if (session !== currentSession) return;
        busy = true; controls(); status('把你的声音变成文字……'); requestController = new AbortController();
        try { const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); const result = await api('transcribe', { audio: await toBase64(blob), audioType: blob.type }); if (session !== currentSession) return; await reply(result.text, currentSession); }
        catch(e) { if (session === currentSession && e.name !== 'AbortError') { el('chat-error').textContent = e.message || '这次没有听清，试试再说一次。'; status(''); } }
        finally { if (session === currentSession) { busy = false; controls(); } }
      };
      recorder.onerror = () => { stop(); currentStream.getTracks().forEach(t => t.stop()); el('chat-error').textContent = '这次录音没完成，请再试一次。'; };
      recorder.start(); recording = true; busy = false; controls(); el('chat-record').classList.add('recording'); el('chat-record').textContent = '讲完啦，停一下'; status('我在听，讲完再点一下按钮。'); timeout = setTimeout(stop, 60000);
    } catch { stream?.getTracks().forEach(t => t.stop()); el('chat-error').textContent = '麦克风没有打开，请允许录音后再试。'; busy = false; controls(); }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && recording) close(); });
})();
