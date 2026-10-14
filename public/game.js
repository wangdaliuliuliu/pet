(() => {
  const el = id => document.getElementById(id);
  let soundOn = localStorage.getItem('pet-sound') === 'on', audioContext;
  function sound(notes = [659, 880], duration = .1) {
    if (!soundOn) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext ||= new Audio(); audioContext.resume().catch(() => {});
      notes.forEach((frequency, i) => { const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), start = audioContext.currentTime + i * duration;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.065, start + .008); gain.gain.exponentialRampToValueAtTime(.001, start + duration * 1.7); oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + duration * 1.8); });
    } catch {}
  }
  function updateSound() { el('toggle-sound').setAttribute('aria-pressed', String(soundOn)); el('toggle-sound').setAttribute('aria-label', soundOn ? '关闭游戏音效' : '打开游戏音效'); }
  updateSound();
  el('toggle-sound').onclick = () => { soundOn = !soundOn; localStorage.setItem('pet-sound', soundOn ? 'on' : 'off'); updateSound(); sound([523, 784]); };
  function closeOthers() { document.querySelectorAll('dialog[open]').forEach(d => { if (d.id === 'story-dialog') closeStory(); else d.close(); }); }
  function show(id) { closeOthers(); el(id).showModal(); sound([523], .05); }
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => { el(button.dataset.close).close(); sound([440], .04); });
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { if (dialog.id === 'story-dialog') closeStory(); else dialog.close(); } }));
  el('show-bag').onclick = () => show('bag-dialog');
  el('show-stories').onclick = () => show('memories-dialog');
  el('show-about').onclick = el('show-growth').onclick = el('dock-growth').onclick = () => show('growth-dialog');
  el('show-mission').onclick = el('bag-quest').onclick = () => show('mission-dialog');
  el('home').onclick = () => { closeOthers(); sound([523], .05); petHello(); };
  el('memory-tell').onclick = el('mission-tell').onclick = () => { closeOthers(); el('open-story').click(); };
  el('bag-feed').onclick = el('reward-feed').onclick = () => { closeOthers(); el('feed').click(); };
  el('mission-claim').onclick = () => el('claim').click();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effects = el('effects');
  function transient(node, lifetime = 1800) { effects.append(node); setTimeout(() => node.remove(), lifetime); }
  function hearts(x, y, count = 5) {
    if (reducedMotion) return;
    for (let i = 0; i < count; i++) { const heart = document.createElement('span'); heart.className = 'flying-heart'; heart.textContent = i % 2 ? '♡' : '♥'; heart.style.left = x + (Math.random() - .5) * 70 + 'px'; heart.style.top = y + (Math.random() - .5) * 35 + 'px'; heart.style.setProperty('--drift', (Math.random() - .5) * 100 + 'px'); heart.style.animationDelay = i * .065 + 's'; transient(heart, 2300); }
  }
  function petHello(event) {
    if (!pet) return;
    const rect = el('cat-wrap').getBoundingClientRect();
    hearts(event?.clientX || rect.x + rect.width / 2, event?.clientY || rect.y + rect.height / 3);
    el('scene').classList.remove('petting'); void el('scene').offsetWidth; el('scene').classList.add('petting'); setTimeout(() => el('scene').classList.remove('petting'), 500);
    el('speech').textContent = pet.sleeping ? '呼呼……我在做一个甜甜的梦' : ['最喜欢和你一起玩啦 ♡', '今天的小故事，我想听！', '摸摸头，好开心～', '朋友，你来啦！'][Math.floor(Math.random() * 4)];
    sound([659, 784, 988], .075);
  }
  el('cat-wrap').onclick = petHello;
  if (!reducedMotion) for (let i = 0; i < 26; i++) { const star = document.createElement('i'); star.className = 'ambient-star' + (i % 4 === 0 ? ' cross' : ''); star.textContent = i % 4 === 0 ? '✧' : ''; star.style.left = 8 + Math.random() * 84 + '%'; star.style.top = 16 + Math.random() * 60 + '%'; star.style.setProperty('--duration', 5 + Math.random() * 7 + 's'); star.style.setProperty('--delay', -Math.random() * 12 + 's'); el('ambient-stars').append(star); }
  window.gameEffects = {
    feed(icon = '🍓') { if (!reducedMotion) { const food = document.createElement('span'); food.className = 'food-flight'; food.textContent = icon; transient(food, 1000); } const rect = el('cat-wrap').getBoundingClientRect(); setTimeout(() => hearts(rect.x + rect.width / 2, rect.y + rect.height / 3, 8), 500); sound([523, 659, 784, 1047], .095); },
    reward() { show('reward-dialog'); sound([523, 659, 784, 1047], .13); if (!reducedMotion) { for (let i = 0; i < 30; i++) { const spark = document.createElement('i'); spark.className = 'spark-burst'; spark.style.setProperty('--color', ['#ffdca1','#e6a4c9','#fff6d9','#b7a3d7'][i % 4]); const angle = i * Math.PI * 2 / 30; spark.style.setProperty('--dx', Math.cos(angle) * (100 + Math.random() * 90) + 'px'); spark.style.setProperty('--dy', Math.sin(angle) * (100 + Math.random() * 90) + 'px'); transient(spark); } } },
    story() { sound([659, 784, 1047], .09); const rect = el('cat-wrap').getBoundingClientRect(); hearts(rect.x + rect.width / 2, rect.y + rect.height / 3, 4); }
  };
})();

