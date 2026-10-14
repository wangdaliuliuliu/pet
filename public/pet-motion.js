(() => {
  const wrap=document.getElementById('cat-wrap'),cat=document.getElementById('cat');
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=740;canvas.className='pet-motion';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');wrap.append(canvas);
  const ctx=canvas.getContext('2d');const button=document.createElement('button');button.className='dance-button';button.textContent='🩰 跳舞';button.hidden=true;button.setAttribute('aria-label','让小猫跳舞');document.querySelector('.pet-presence').append(button);
  let key='',generation=0,images=null,manifest=null,mode='idle',start=performance.now(),sleeping=false,raf=null;
  const retry=document.createElement('button');retry.className='story-button';retry.textContent='重新准备动作';retry.hidden=true;document.getElementById('evolve').after(retry);
  retry.onclick=async()=>{retry.disabled=true;try{await simpleAction('animate');}finally{retry.disabled=false;}};
  const loopSeconds=4.0536679401,loops=3;
  function idle(){mode='idle';start=performance.now();button.disabled=sleeping;button.textContent='🩰 跳舞';}
  button.onclick=()=>{if(!images||sleeping||mode==='dance')return;mode='dance';start=performance.now();button.disabled=true;button.textContent='跳舞中';};
  function part(name,x,y,w,h,angle=0,ax=.5,ay=.5){const image=images[name];if(!image)return;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(image,-w*ax,-h*ay,w,h);ctx.restore();}
  function draw(t){ctx.clearRect(0,0,600,740);const dance=mode==='dance',beat=Math.sin(t*3.1),breath=Math.sin(t*1.8),jump=dance?Math.max(0,beat)*16:0;
    ctx.save();ctx.translate(300+(dance?Math.sin(t*1.55)*20:0),-jump);ctx.translate(0,445);ctx.rotate(dance?beat*.055:0);ctx.translate(0,-445);
    part('backAccessory',0,355,350+Math.sin(t*2)*4,265);
    part('tail',-100,440,155,185,sleeping?0:Math.sin(t*2.2)*.17,.85,.85);
    part('legLeft',-49,462,67,194,dance?-.18+beat*.34:0,.5,.07);
    part('legRight',49,462,67,194,dance?.18-beat*.34:0,.5,.07);
    part('torso',0,384+(!dance?breath*1.5:0),290,255);
    part('armLeft',-73,305,65,174,dance?.85+beat*.65:.12+breath*.025,.5,.08);
    part('armRight',73,305,65,174,dance?-.85-beat*.65:-.12-breath*.025,.5,.08);
    const blink=sleeping || t%4.7>4.48 || t%4.7<.10;
    part(blink?'blink':'head',0,280,250,222,dance?beat*.045:breath*.018,.5,.94);ctx.restore();
  }
  function frame(now){if(!images){raf=null;return;}if(mode==='dance'&&(now-start)/1000>=loopSeconds*loops)idle();if(!document.hidden)draw((now-start)/1000);raf=requestAnimationFrame(frame);}
  async function update(state){sleeping=state.sleeping;if(sleeping&&mode==='dance')idle();button.disabled=sleeping||mode==='dance';
    retry.hidden=!state.features?.generationEnabled || !(state.animation?.status==='failed'||(state.animation?.status==='unavailable'&&state.evolution?.level>0));
    retry.textContent=state.animation?.status==='unavailable'?'准备动作':'重新准备动作';
    const animation=state.animation,formImage=state.evolution?.image||'/assets/pet/stage-0.png';
    const next=animation?.status==='ready'&&animation.formImage===formImage?animation.manifest:'';
    if(next===key)return;key=next;const ticket=++generation;images=null;manifest=null;canvas.hidden=true;cat.hidden=false;button.hidden=true;wrap.classList.remove('animated-pet');if(raf!==null){cancelAnimationFrame(raf);raf=null;}if(!next)return;
    try{const res=await fetch(next);if(!res.ok)throw Error();const m=await res.json();if(m.version!==1||m.rig!=='front-cat-v1'||m.formImage!==formImage)throw Error();
      const loaded={};await Promise.all(Object.entries(m.layers).map(([name,layer])=>new Promise((resolve,reject)=>{if(!/^[A-Za-z]+\.png$/.test(layer.file))return reject(Error());const image=new Image();image.onload=()=>{loaded[name]=image;resolve();};image.onerror=reject;image.src=new URL(layer.file,new URL(next,location.href)).href;})));
      if(!['head','blink','torso','armLeft','armRight','legLeft','legRight'].every(n=>loaded[n]))throw Error();if(ticket!==generation)return;images=loaded;manifest=m;idle();canvas.hidden=false;cat.hidden=true;button.hidden=false;wrap.classList.add('animated-pet');raf=requestAnimationFrame(frame);
    }catch{if(ticket===generation){key='';images=null;canvas.hidden=true;cat.hidden=false;button.hidden=true;}}
  }
  window.petMotion={update};
})();
