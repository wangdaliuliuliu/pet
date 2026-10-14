const $ = id => document.getElementById(id);
let pet, busy = false, recording = false, recorder, recognition, mediaStream;
let audioBlob = null, audioUrl = null, chunks = [], startedAt = 0, stopTimer, toastTimer;
let storyActionId = null, lastStoriesKey = '';
let voiceCapabilities = {};
fetch('/api/capabilities').then(r => r.json()).then(c => { voiceCapabilities = c; }).catch(() => {});
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const dayFormat = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' });
function recordLabel(text) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-mic'); icon.append(use);
  $('record').replaceChildren(icon, document.createTextNode(text));
}
$('date').textContent = dayFormat.format(new Date()) + ' · ' + new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(new Date());
function toast(message, duration = 4000) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), duration);
}
function render(state) {
  pet = state;
  document.querySelector('.player-plaque small').textContent = (state.owner || '朋友') + '的小伙伴';
  const evolution = state.evolution || { level: 0, nextAt: 3, totalEvolutions: 4, image: '/assets/pet/stage-0.png', status: 'idle' };
  const stage = evolution.level;
  const target = evolution.nextAt;
  const previous = [0, 3, 8, 15, 25][stage];
  const motionPending = stage > 0 && evolution.complete === false;
  $('stage').textContent = stage ? `小猫 · 第 ${stage} 次进化${motionPending ? '准备中' : ''}` : '宝石芭蕾猫 · 小猫';
  const formImage = evolution.image;
  if ($('cat').getAttribute('src') !== formImage) $('cat').src = formImage;
  $('cat').alt = stage ? `小猫第 ${stage} 次进化后的形象` : '戴宝石皇冠、穿粉色芭蕾裙的小猫';
  $('cat').classList.toggle('evolved-art', stage > 0);
  const portrait = document.querySelector('.growth-portrait img');
  portrait.src = formImage; portrait.classList.toggle('evolved-art', stage > 0);
  document.querySelector('.avatar img').src = formImage;
  $('growth-stage').textContent = $('stage').textContent;
  $('level').textContent = stage + 1;
  $('together-days').textContent = Math.max(1, Math.floor((Date.now() - state.createdAt) / 86400000) + 1);
  $('total-stories').textContent = state.stories.length;
  $('food-counter').textContent = state.home?.totalFood ?? state.food;
  $('dock-food-count').textContent = state.home?.totalFood ?? state.food;
  $('cat-wrap').style.transform = 'none';
  $('scene').classList.toggle('sleeping', state.sleeping);
  $('speech').textContent = state.sleeping ? '呼呼……喂我就能醒来哦' : state.home ? `今天想吃${state.home.wish.name}～` : '给我讲一个故事吧～';
  $('mood').textContent = state.sleeping ? '☾ 睡个小觉' : state.daysHungry >= 1 ? '♡ 想吃点东西' : '♡ 开开心心';
  $('feed-count').textContent = `吃过 ${state.feeds} 份食物`;
  $('food-badge').textContent = `背包里 ${state.food} 份`;
  $('growth-text').textContent = evolution.status === 'generating' ? '小猫正在准备新模样……' : motionPending ? '这次进化还在准备动作' : target === null ? '预制成长完成啦！' : evolution.eligible ? '小猫已经可以进化啦' : `再吃 ${Math.max(0, target - state.feeds)} 份，就能进化`;
  $('growth-bar').style.width = target === null ? '100%' : `${Math.max(0, Math.min(100, (state.feeds - previous) / (target - previous) * 100))}%`;
  $('mini-growth').style.width = $('growth-bar').style.width;
  $('evolution-progress').textContent = `已完成 ${evolution.completedLevel ?? stage} / ${evolution.totalEvolutions} 次进化`;
  $('evolution-status').textContent = evolution.status === 'failed' ? evolution.error : evolution.status === 'generating' ? '新模样需要一点时间，你可以先去讲故事。' : '';
  if (evolution.status === 'idle' && state.animation?.status === 'generating') $('evolution-status').textContent = '正在为新模样准备待机和跳舞动作，完成后才算准备齐全。';
  if (evolution.status === 'idle' && state.animation?.status === 'unavailable' && stage > 0) $('evolution-status').textContent = '新模样的动作还没准备好，可以点“准备动作”继续。';
  if (evolution.status === 'idle' && state.animation?.status === 'failed') $('evolution-status').textContent = state.animation.error;
  $('evolve').hidden = !evolution.eligible || evolution.status === 'generating';
  $('evolve').disabled = busy;
  $('evolve').textContent = evolution.status === 'failed' ? '再试一次进化' : '让小猫进化';
  $('feed').disabled = busy;
  $('bag-feed').disabled = busy || (state.home?.totalFood ?? state.food) < 1;
  $('reward-feed').disabled = busy || (state.home?.totalFood ?? state.food) < 1;
  $('claim').disabled = busy || state.availableRewards < 1;
  $('mission-claim').disabled = $('claim').disabled;
  $('claim').textContent = state.availableRewards ? `领取食材 · 可以选 ${state.availableRewards} 个` : state.home?.storyRewards?.remaining===0 ? '今日奖励已拿满 · 明天再来' : '讲一个故事，就能领取食材';
  $('mission-claim').textContent = $('claim').textContent;
  $('reading-count').textContent = `读书 ${state.readings} 次 · 讲故事 ${state.stories.length} 次`;
  const progress = Math.min(2, state.availableRewards);
  $('mission-counter').textContent = `${state.availableRewards} 个待领`;
  $('mission-progress').textContent = `可领 ${state.availableRewards} 个食材`;
  $('dot1').classList.toggle('done', progress >= 1);
  $('dot2').classList.toggle('done', progress >= 2);
  document.querySelector('.reward-dot').classList.toggle('ready', state.availableRewards > 0);
  const key = state.stories.map(s => s.id).join(',');
  if (key !== lastStoriesKey) {
    lastStoriesKey = key;
    $('stories').replaceChildren();
    for (const story of state.stories.slice(0, 20)) {
      const entry = document.createElement('article'); entry.className = 'story-entry';
      const time = document.createElement('time'); time.textContent = dayFormat.format(story.createdAt) + ' · 读书的小脚印'; entry.append(time);
      const text = document.createElement('p'); text.textContent = story.transcript || '🎙 讲给小猫听的一段小故事'; entry.append(text);
      if (story.audioType) { const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.src = '/api/recordings/' + story.id; entry.append(audio); }
      $('stories').append(entry);
    }
  }
  window.homeUI?.render(state);
  window.petMotion?.update(state);
  window.chatUI?.updateTrip(state);
  window.travelUI?.update(state);
}
async function refresh() {
  try { const res = await fetch('/api/pet'); if (!res.ok) throw new Error(); render(await res.json()); }
  catch { toast('暂时连不上小猫的小家，检查一下网络再试吧。'); }
}
async function mutate(endpoint, body) {
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const state = await res.json();
  if (!res.ok) throw new Error(state.error || '刚才没保存成功，再试一次吧。');
  render(state);
  return state;
}
async function simpleAction(kind) {
  if (busy) return;
  const previousForm = pet.evolution?.level || 0;
  busy = true; render(pet);
  try {
    await mutate('/api/' + kind, { actionId: uuid() });
    if (kind === 'feed') { window.gameEffects?.feed(); $('scene').classList.add('celebrate'); $('speech').textContent = '好好吃！谢谢朋友 ♡'; setTimeout(() => $('scene').classList.remove('celebrate'), 1500); toast(pet.evolution?.status === 'generating' ? '吃饱啦！小猫开始准备进化的新模样。' : previousForm !== (pet.evolution?.level || 0) ? '小猫进化啦！' : '小猫吃饱啦，谢谢你！'); }
    else if (kind === 'evolve') { toast('小猫开始准备新模样啦！'); }
    else { window.gameEffects?.reward(); }
  } catch (err) { toast(err.message || '网络没连上，再试一次吧。'); }
  finally { busy = false; render(pet); if (kind === 'feed' && pet.lastFedAt && Date.now() - pet.lastFedAt < 3000) $('speech').textContent = '好好吃！谢谢朋友 ♡'; }
}
$('feed').onclick = () => simpleAction('feed');
$('claim').onclick = () => simpleAction('claim');
$('evolve').onclick = () => simpleAction('evolve');
$('open-story').onclick = () => { $('dialog-error').textContent = ''; $('story-dialog').showModal(); };
function stopRecording() {
  if (!recording) return;
  recording = false;
  clearTimeout(stopTimer);
  if (recognition) { try { recognition.stop(); } catch {} }
  if (recorder && recorder.state === 'recording') recorder.stop();
  recordLabel('重新讲一次');
  $('record').classList.remove('recording');
  $('record-status').textContent = '录好啦，听一听，再点“讲完啦”。';
  $('submit-story').disabled = true;
}
function closeStory() { stopRecording(); $('story-dialog').close(); }
$('close-story').onclick = closeStory;
$('story-dialog').addEventListener('cancel', stopRecording);
function preview(blob) {
  audioBlob = blob;
  storyActionId = null;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(blob);
  $('audio-preview').src = audioUrl;
  $('audio-preview').hidden = false;
}
async function transcribeStory(blob) {
  if (!voiceCapabilities.transcriptionConfigured) { $('record-status').textContent = '声音已经录好啦，暂时还不能变成文字。'; return; }
  $('submit-story').disabled = true;
  $('record-status').textContent = '正在把你讲的故事变成文字……';
  try {
    const res = await fetch('/api/voice/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: await toBase64(blob), audioType: blob.type }), signal: AbortSignal.timeout(65000) });
    const result = await res.json(); if (!res.ok) throw new Error(result.error);
    if (audioBlob !== blob) return;
    $('transcript').value = result.text; $('story-options').open = true; storyActionId = null;
    $('record-status').textContent = '变成文字啦！听一听，看一看，再点“讲完啦”。';
  } catch (e) { if (audioBlob === blob) $('record-status').textContent = (e.message || '这次没有变成文字。') + '录音仍然可以保存。'; }
  finally { if (audioBlob === blob) $('submit-story').disabled = false; }
}
$('record').onclick = async () => {
  if (recording) { stopRecording(); return; }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    $('record-status').textContent = '这个地址暂时不能直接录音，请大人用 HTTPS 网址打开小屋。也可以先选一段录好的声音。';
    return;
  }
  $('record').disabled = true;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!$('story-dialog').open) { mediaStream.getTracks().forEach(t => t.stop()); return; }
    chunks = []; startedAt = Date.now(); $('transcript').value = ''; storyActionId = null;
    recorder = new MediaRecorder(mediaStream);
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => { const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); preview(blob); mediaStream.getTracks().forEach(t => t.stop()); $('submit-story').disabled = false; $('audio-file').disabled = false; transcribeStory(blob); };
    recorder.onerror = () => { stopRecording(); mediaStream.getTracks().forEach(t => t.stop()); $('record-status').textContent = '这次没有录好，可以再试一次或选一段录音。'; };
    recorder.start(); recording = true; $('audio-file').disabled = true;
    recordLabel('讲完，停一下'); $('record').classList.add('recording');
    $('record-status').textContent = '小猫在听哦……讲讲谁去了哪里，发生了什么。';
    $('submit-story').disabled = true;
    stopTimer = setTimeout(stopRecording, 90000);
  } catch {
    mediaStream?.getTracks().forEach(t => t.stop());
    $('record-status').textContent = '麦克风没打开。请允许录音，或在下面选一段录好的声音。';
  } finally { $('record').disabled = false; }
};
$('audio-file').onchange = () => {
  const file = $('audio-file').files[0]; if (!file) return;
  if (file.size > 8 * 1024 * 1024) { $('dialog-error').textContent = '录音有点大，请选 8 MB 以内的小故事。'; return; }
  if (!file.type.startsWith('audio/')) { $('dialog-error').textContent = '请选一段声音文件。'; return; }
  stopRecording(); preview(file); $('dialog-error').textContent = ''; $('record-status').textContent = '选好录音啦，听一听自己的故事吧。';
  transcribeStory(file);
};
$('transcript').oninput = () => { storyActionId = null; };
function toBase64(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); }); }
$('submit-story').onclick = async () => {
  if (busy || recording) return;
  const transcript = $('transcript').value.trim();
  if (!transcript && (!audioBlob || audioBlob.size < 1000)) { $('dialog-error').textContent = '先讲一小段书里的故事，再点“讲完啦”哦。'; return; }
  busy = true; $('submit-story').disabled = true; $('submit-story').textContent = '把故事放进小本子……'; $('dialog-error').textContent = '';
  try {
    storyActionId ||= uuid();
    const saved = await mutate('/api/story', { actionId: storyActionId, transcript, audio: audioBlob ? await toBase64(audioBlob) : null, audioType: audioBlob?.type || null });
    $('story-dialog').close(); $('transcript').value = ''; $('audio-file').value = ''; audioBlob = null; storyActionId = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = null; $('audio-preview').removeAttribute('src'); $('audio-preview').hidden = true;
    recordLabel('开始讲故事'); $('record-status').textContent = '点一下，说给小猫听。';
    window.gameEffects?.story();
    toast(saved.storyReward?.message || '故事收好啦！', saved.storyReward?.granted===false ? 7000 : 4000);
  } catch (err) { $('dialog-error').textContent = err.message || '没有保存成功，故事还在这里，再试一次吧。'; }
  finally { busy = false; $('submit-story').disabled = false; $('submit-story').textContent = '讲完啦，记一次读书 ✓'; if (pet) render(pet); }
};
refresh();
setInterval(() => { if (!busy && !document.hidden && !$('story-dialog').open) refresh(); }, 3000);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopRecording(); else if (!busy) refresh(); });

