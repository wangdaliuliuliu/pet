(() => {
  const el = id => document.getElementById(id);
  let selected = {}, homeBusy = false, pending = null, bagKey = '', voiceRecorder, voiceStream, voiceTimer, voiceSession = 0, birthdayDirty = false, rewardResetTimer, rewardResetAt;
  function button(text, fn, className = 'secondary-button') { const b = document.createElement('button'); b.textContent = text; b.className = className; b.onclick = fn; return b; }
  function dialog(id, title, copy, content) {
    const d = document.createElement('dialog'); d.id = id; d.className = 'game-dialog home-dialog';
    d.innerHTML = `<div class="dialog-top"><span class="tiny-label">小猫的童话小屋</span><button class="close-button" aria-label="关闭${title}">×</button></div><h2>${title}</h2><p class="dialog-copy">${copy}</p>${content}`;
    d.querySelector('.close-button').onclick = () => d.close(); document.body.append(d); return d;
  }
  function show(id) { document.querySelectorAll('dialog[open]').forEach(d => d.id === 'story-dialog' ? closeStory() : d.close()); el(id).showModal(); if (pet) update(pet); }
  const tools = document.createElement('nav'); tools.className = 'home-tools'; tools.setAttribute('aria-label', '小屋活动');
  tools.append(button('🍳 厨房', () => openKitchen()), button('🏠 房间', () => show('rooms-dialog')), button('🎂 生日', () => show('birthday-dialog'))); el('scene').append(tools);
  const clock = document.createElement('span'); clock.className = 'home-clock'; tools.append(clock);
  const tick = () => clock.textContent = '🕰 ' + new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()); tick(); setInterval(tick, 30000);
  dialog('kitchen-dialog', '小猫的小厨房', '读书换食材，点一点做一道好吃的。', `<div class="kitchen-banner"><img src="/assets/rooms/kitchen.webp" alt="粉色厨房"><span>🍳 今天的小厨师：朋友</span></div><div class="kitchen-tabs"><button id="tab-ingredients">① 领食材</button><button id="tab-recipes">② 做好吃的</button><button id="tab-dishes">③ 喂小猫</button></div><section id="ingredient-section"><div class="credit-banner" id="credit-banner"></div><div class="reading-actions"><button id="kitchen-story" class="secondary-button">🎙 讲一个故事</button></div><p class="small-note">讲完一个故事，点“讲完啦，记一次读书”，就能领取一个食材。</p><div id="ingredient-picker" class="ingredient-grid"></div><button id="ingredient-voice" class="secondary-button">🎙 说说想要的食材</button><p id="ingredient-voice-status" class="small-note" role="status"></p><button id="claim-ingredients" class="story-button">选好啦，领取食材</button></section><section id="recipe-section" hidden><div class="cook-wish" id="cook-wish"></div><div id="pantry" class="pantry"></div><div id="recipe-list" class="recipe-list"></div><p class="small-note">小猫说想吃什么只是建议，做哪道菜都能喂它。一道成品菜算一次成长。</p></section><section id="dish-section" hidden><div id="kitchen-dishes" class="dish-list"></div></section><p id="kitchen-error" class="dialog-error" role="alert"></p><div id="cooking-overlay" class="cooking-overlay" hidden><span>🍳</span><strong>锅里香香的……</strong><small>好吃的马上就来</small></div>`);
  dialog('rooms-dialog', '今天住哪一间？', '每个房间，都是小猫的小天地。', '<div id="room-list" class="room-grid"></div>');
  dialog('birthday-dialog', '小猫的生日', '每年同一天，一起吹蜡烛。', '<div class="birthday-cake">🎂</div><form id="birthday-form"><label class="story-label" for="birthday-month">选一个生日</label><div class="birthday-selects"><select id="birthday-month" aria-label="生日月份" required><option value="">几月</option></select><select id="birthday-day" aria-label="生日日期" required><option value="">几日</option></select></div><p class="small-note">选月份和日期就好，每年都会记得。</p><button class="story-button" type="submit">记住这个生日</button></form><p id="birthday-message" class="dialog-copy"></p><button id="celebrate-birthday" class="story-button">一起吹蜡烛 ✨</button>');
  for (const [id, count] of [['birthday-month', 12], ['birthday-day', 31]]) { for (let n = 1; n <= count; n++) { const option = document.createElement('option'); option.value = String(n).padStart(2, '0'); option.textContent = n + (id.endsWith('month') ? '月' : '日'); el(id).append(option); } el(id).onchange = () => birthdayDirty = true; }
  const bagItems = document.createElement('div'); bagItems.id = 'bag-dishes'; bagItems.className = 'dish-list'; el('bag-dialog').insertBefore(bagItems, el('bag-feed'));
  el('bag-dialog').querySelector('.food-item').hidden = true; el('bag-feed').hidden = true;
  el('bag-dialog').querySelector('h2').textContent = '小猫的好吃背包';
  el('bag-dialog').querySelector('.dialog-copy').textContent = '做好的菜会收在这里，选一份喂给小猫。';
  el('bag-quest').textContent = '去厨房做一道菜'; el('bag-quest').onclick = () => openKitchen('recipe');
  el('feed').onclick = el('show-bag').onclick = () => show('bag-dialog');
  el('claim').onclick = el('mission-claim').onclick = () => openKitchen();
  document.querySelector('.quest-inner h1').textContent = '读书，做一份好吃的';
  document.querySelector('.quest-inner > p').textContent = '讲一个故事，领一个食材。';
  document.querySelector('.reward-hint').textContent = '每天讲故事，最多奖励 2 个食材';
  el('mission-dialog').querySelector('h2').textContent = '读书换食材';
  el('mission-dialog').querySelector('.dialog-copy').textContent = '讲完一个故事并保存，获得一个食材额度。每天最多奖励 2 个，北京时间零点刷新。故事可以继续讲，小猫都会收好。';
  el('story-dialog').querySelector('.honesty').id='story-reward-note';
  function tab(which) { ['ingredient', 'recipe', 'dish'].forEach(name => { el(name + '-section').hidden = name !== which; }); ['ingredients', 'recipes', 'dishes'].forEach((name, index) => el('tab-' + name).classList.toggle('selected', ['ingredient', 'recipe', 'dish'][index] === which)); }
  function openKitchen(which = 'ingredient') { show('kitchen-dialog'); tab(which); }
  el('tab-ingredients').onclick = () => tab('ingredient'); el('tab-recipes').onclick = () => tab('recipe'); el('tab-dishes').onclick = () => tab('dish');
  async function doAction(kind, data, success) {
    if (homeBusy || busy) return false;
    homeBusy = true; busy = true; update(pet);
    const signature = JSON.stringify({ kind, data });
    if (!pending || pending.signature !== signature) pending = { signature, id: uuid() };
    try {
      await mutate('/api/' + kind, { ...data, actionId: pending.id }); pending = null;
      if (success) toast(success); return true;
    } catch (e) { el('kitchen-error').textContent = e.message; toast(e.message || '这次没连上，再点一次试试。'); return false; }
    finally { homeBusy = false; busy = false; render(pet); }
  }
  el('kitchen-story').onclick = () => { el('kitchen-dialog').close(); el('open-story').click(); };
  el('claim-ingredients').onclick = async () => {
    const ids = Object.entries(selected).flatMap(([id, count]) => Array(count).fill(id));
    if (!ids.length) return toast('先点加号，选想要的食材吧。');
    if (await doAction('claim', { ingredients: ids }, '食材领好啦，放进锅里做菜吧！')) { selected = {}; update(pet); tab('recipe'); }
  };
  function updateSelection() {
    const count = Object.values(selected).reduce((a, b) => a + b, 0);
    el('claim-ingredients').textContent = count ? `领取 ${count} 个食材` : '先选想要的食材';
    el('claim-ingredients').disabled = homeBusy || !count || count > (pet?.availableRewards || 0);
    document.querySelectorAll('[data-ingredient-count]').forEach(node => node.textContent = selected[node.dataset.ingredientCount] || 0);
    document.querySelectorAll('[data-ingredient-plus]').forEach(node => node.disabled = homeBusy || count >= (pet?.availableRewards || 0));
    document.querySelectorAll('[data-ingredient-minus]').forEach(node => node.disabled = homeBusy || !(selected[node.dataset.ingredientMinus] > 0));
  }
  function populateIngredients(state) {
    const list = el('ingredient-picker'); if (list.childElementCount) return;
    for (const item of state.home.ingredients) {
      const card = document.createElement('div'); card.className = 'ingredient-card';
      const icon = document.createElement('span'); icon.className = 'food-emoji'; icon.textContent = item.icon;
      const name = document.createElement('strong'); name.textContent = item.name;
      const controls = document.createElement('div'); controls.className = 'quantity-controls';
      const minus = button('−', () => { selected[item.id] = Math.max(0, (selected[item.id] || 0) - 1); updateSelection(); }, 'quantity-button'); minus.dataset.ingredientMinus = item.id;
      const count = document.createElement('b'); count.dataset.ingredientCount = item.id; count.textContent = '0';
      const plus = button('＋', () => { if (Object.values(selected).reduce((a, b) => a + b, 0) < pet.availableRewards) selected[item.id] = (selected[item.id] || 0) + 1; updateSelection(); }, 'quantity-button'); plus.dataset.ingredientPlus = item.id;
      controls.append(minus, count, plus); card.append(icon, name, controls); list.append(card);
    }
  }
  function dishList(target, state) {
    target.replaceChildren();
    const dishes = state.home.recipes.filter(r => state.dishes[r.id] > 0).map(r => ({ ...r, count: state.dishes[r.id] }));
    if (state.food > 0) dishes.push({ id: 'strawberry', icon: '🍓', name: '甜甜草莓', count: state.food });
    if (!dishes.length) { const p = document.createElement('p'); p.className = 'empty-home'; p.textContent = '锅还在等你呢！先领食材，再做一道菜。'; target.append(p, button('去厨房做菜', () => openKitchen('recipe'))); }
    for (const dish of dishes) {
      const row = document.createElement('div'); row.className = 'dish-card';
      const label = document.createElement('strong'); label.textContent = `${dish.icon} ${dish.name} × ${dish.count}`;
      const feed = button('喂给小猫', async () => { if (await doAction('feed', { dish: dish.id }, '吃饱啦！这份菜算一次成长。')) { window.gameEffects?.feed(dish.icon); el('speech').textContent = '好香呀，谢谢朋友！'; } }); feed.disabled = homeBusy;
      row.append(label, feed); target.append(row);
    }
  }
  function update(state) {
    if (!state?.home) return;
    const room = state.home.rooms.find(r => r.id === state.room);
    const art = document.querySelector('.room-art'); if (art.getAttribute('src') !== room.image) art.src = room.image;
    document.querySelector('.world').style.setProperty('--room-image', `url("${room.image}")`);
    document.querySelector('.room-title > span:nth-child(2)').textContent = room.name;
    const quota=state.home.storyRewards;
    if(quota&&rewardResetAt!==quota.resetAt){
      clearTimeout(rewardResetTimer);rewardResetAt=quota.resetAt;
      const reset=()=>{if(busy){rewardResetTimer=setTimeout(reset,500);return;}rewardResetAt=null;refresh();};
      rewardResetTimer=setTimeout(reset,Math.max(100,Date.parse(quota.resetAt)-Date.now()+100));
    }
    el('credit-banner').textContent = `📖 可领 ${state.availableRewards} 个食材`+(quota?` · 今日奖励 ${quota.earned} / ${quota.limit}`:'');
    el('story-reward-note').textContent=quota?.remaining===0?'今天的 2 个食材奖励已拿满，故事仍会收好。明天零点刷新。':`今天还可获得 ${quota?.remaining??2} 个食材奖励 · 每天零点刷新`;
    populateIngredients(state); updateSelection();
    el('kitchen-story').disabled = homeBusy;
    el('cook-wish').textContent = `小猫：今天想吃${state.home.wish.name}～ 你也可以选别的菜！`;
    el('pantry').textContent = '食材篮：' + state.home.ingredients.map(i => `${i.icon}${state.ingredients[i.id] || 0}`).join('  ');
    const recipes = el('recipe-list'); recipes.replaceChildren();
    for (const recipe of state.home.recipes) {
      const missing = recipe.needs.filter(id => !(state.ingredients[id] > 0)), row = document.createElement('div'); row.className = 'recipe-card';
      const info = document.createElement('div'), name = document.createElement('strong'); name.textContent = `${recipe.icon} ${recipe.name}`;
      const need = document.createElement('small'); need.textContent = recipe.needs.map(id => { const i = state.home.ingredients.find(i => i.id === id); return `${i.icon}${i.name}`; }).join(' ＋ ');
      info.append(name, need);
      const cook = button(missing.length ? '去领食材' : '下锅做菜', async () => {
        if (missing.length) { selected = Object.fromEntries(missing.map(id => [id, 1])); tab('ingredient'); updateSelection(); return; }
        el('cooking-overlay').hidden = false;
        const result = await doAction('cook', { recipe: recipe.id });
        await new Promise(resolve => setTimeout(resolve, 900)); el('cooking-overlay').hidden = true;
        if (result) { toast(`${recipe.name}做好啦，收进背包了！`); tab('dish'); }
      }); cook.disabled = homeBusy; row.append(info, cook); recipes.append(row);
    }
    const nextBagKey = JSON.stringify([state.food, state.dishes, homeBusy]);
    if (bagKey !== nextBagKey) { bagKey = nextBagKey; dishList(el('bag-dishes'), state); dishList(el('kitchen-dishes'), state); }
    if (!el('room-list').childElementCount) for (const item of state.home.rooms) {
      const card = button('', async () => { if (await doAction('room', { room: item.id }, `来到${item.name}啦！`)) el('rooms-dialog').close(); }, 'room-card'); card.dataset.room = item.id;
      const image = document.createElement('img'); image.src = item.image; image.alt = item.name; image.loading = 'lazy';
      const label = document.createElement('strong'); label.textContent = item.name; card.append(image, label); el('room-list').append(card);
    }
    document.querySelectorAll('[data-room]').forEach(b => { b.classList.toggle('selected', b.dataset.room === state.room); b.disabled = homeBusy; });
    if (!birthdayDirty) { el('birthday-month').value = state.birthday?.slice(0, 2) || ''; el('birthday-day').value = state.birthday?.slice(3) || ''; }
    const birthday = state.home.birthday;
    el('birthday-message').textContent = !birthday.date ? '先为小猫选一个生日吧。' : birthday.today ? birthday.celebrated ? '今年的生日愿望，已经一起许好啦！' : '今天是小猫的生日，一起吹蜡烛吧！' : `每年 ${Number(birthday.date.slice(0, 2))} 月 ${Number(birthday.date.slice(3))} 日，都是小猫的生日。`;
    el('celebrate-birthday').hidden = false; el('celebrate-birthday').disabled = homeBusy;
  }
  el('birthday-form').onsubmit = async e => { e.preventDefault(); if (await doAction('birthday', { date: el('birthday-month').value + '-' + el('birthday-day').value }, '记住小猫的生日啦！')) { birthdayDirty = false; update(pet); } };
  const cake=el('birthday-dialog').querySelector('.birthday-cake');cake.textContent='🍰';cake.classList.add('candle-stage');
  const candles=document.createElement('div');candles.className='cake-candles';candles.setAttribute('aria-hidden','true');candles.innerHTML='<span><i></i><b></b></span><span><i></i><b></b></span><span><i></i><b></b></span>';cake.append(candles);
  const candleNote=document.createElement('p');candleNote.className='small-note';candleNote.textContent='每天都可以玩吹蜡烛，生日那天也会记下我们的庆祝。';el('celebrate-birthday').before(candleNote);
  let extinguished=false;
  el('celebrate-birthday').onclick = async () => {
    if(extinguished){cake.classList.remove('candles-out');extinguished=false;el('celebrate-birthday').textContent='一起吹蜡烛 ✨';return;}
    const birthday=pet?.home?.birthday;
    if(birthday?.today&&!birthday.celebrated&&!(await doAction('celebrate',{},'生日快乐，小猫！✨')))return;
    cake.classList.add('candles-out');extinguished=true;el('celebrate-birthday').textContent='再点亮一次 🕯';window.gameEffects?.story();toast('呼——蜡烛吹灭啦！许一个小愿望吧。');
  };
  function stopIngredientVoice() { clearTimeout(voiceTimer); if (voiceRecorder?.state === 'recording') voiceRecorder.stop(); }
  el('ingredient-voice').onclick = async () => {
    if (voiceRecorder?.state === 'recording') { stopIngredientVoice(); return; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('这个浏览器暂时不能录音，可以直接点食材加号。');
    const session = ++voiceSession; el('ingredient-voice').disabled = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); voiceStream = stream;
      if (session !== voiceSession || !el('kitchen-dialog').open) { stream.getTracks().forEach(t => t.stop()); return; }
      const recorder = new MediaRecorder(stream), chunks = []; voiceRecorder = recorder;
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); if (session !== voiceSession) return;
        el('ingredient-voice').textContent = '🎙 说说想要的食材'; el('ingredient-voice').disabled = true; el('ingredient-voice-status').textContent = '听一听你选了什么……';
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const res = await fetch('/api/voice/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: await toBase64(blob), audioType: blob.type }), signal: AbortSignal.timeout(65000) });
          const data = await res.json(); if (!res.ok) throw new Error(data.error); if (session !== voiceSession) return;
          const names = { tomato: ['西红柿', '番茄'], egg: ['鸡蛋', '蛋'], fish: ['鱼'], carrot: ['胡萝卜'], potato: ['土豆'], rice: ['米饭', '饭'] };
          const ids = Object.keys(names).filter(id => names[id].some(name => data.text.includes(name)));
          if (ids.length) { selected = Object.fromEntries(ids.map(id => [id, 1])); updateSelection(); el('ingredient-voice-status').textContent = `听到：${data.text}。每种先选一个，看一看数量，再点领取。`; }
          else el('ingredient-voice-status').textContent = `听到：${data.text}。没找到食材名字，可以直接点加号选。`;
        } catch (e) { if (session === voiceSession) el('ingredient-voice-status').textContent = (e.message || '这次没听清。') + '也可以点加号选。'; }
        finally { if (session === voiceSession) el('ingredient-voice').disabled = false; }
      };
      recorder.start(); el('ingredient-voice').textContent = '讲完啦，停一下'; el('ingredient-voice-status').textContent = '说“我要西红柿和鸡蛋”就好。'; voiceTimer = setTimeout(stopIngredientVoice, 30000);
    } catch { toast('麦克风没有打开，先用加号选食材也可以。'); }
    finally { el('ingredient-voice').disabled = false; }
  };
  el('kitchen-dialog').addEventListener('close', () => { voiceSession++; stopIngredientVoice(); voiceStream?.getTracks().forEach(t => t.stop()); el('ingredient-voice').textContent = '🎙 说说想要的食材'; el('ingredient-voice').disabled = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopIngredientVoice(); });
  window.homeUI = { render: update }; if (pet) update(pet);
})();
