const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const settings=require('./config');
const THRESHOLDS = [3, 8, 15, 25];
const ORIGINAL_IMAGE = '/assets/pet/stage-0.png';

function promptFor(level) {
  return `Create evolution ${level} of 4 for DefaultPet, the SAME pink gemstone ballet cat in this mobile pet game.
Reference image 1 is the CURRENT form: use it as the direct starting point. Reference image 2 is the ORIGINAL identity anchor: preserve its face, pink fluffy fur, ruby pink eyes, white muzzle, heart-shaped pink gemstone crown, elegant pink ballet tutu and ballet identity.
This is a coherent fantasy evolution, NOT a new pet, baby form, costume replacement or mere enlargement. Keep all recognizable features from the current form. Add a meaningful, attractive transformation that develops its existing gemstone and ballet motifs. Increase the visual progression gradually: early evolutions refine the crown silhouette, layered tutu and flowing jewel ribbons; later evolutions may develop delicate heart-crystal fairy wings and a regal gemstone aura. At evolution ${level}, match the magnitude of change to its position in this four-step journey, building on the previous form without losing the pink ballet cat identity. Do not use any other franchise's characters or distinctive designs.
One full-body character only. Consistent exquisite soft 3D storybook rendering, pink-and-rose-gold palette, jewel highlights, fine fur, and clear silhouette. Keep ears, crown, tail, wings and feet entirely within the square canvas with 8% padding. The pose may evolve but should remain suitable for a front-facing game sprite. No typography, watermark, scenery, floor, ground shadow or separate floating particles.
Use an opaque, entirely flat solid chroma green #00FF00 background across all empty pixels, with no gradient or shadows. Background removal is handled separately by the game. Do not attempt to depict transparency: no checkerboard, white background or gray squares. No green inside the character, accessories or wings. Keep costume edges and wings clearly separate from the background for clean extraction.`;
}

function run(command, args, env, stage = '进化工具', timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
    const timer = setTimeout(() => { child.kill(); const error = new Error(`${stage}等得有点久，这次先停一下。请稍后再试。`); error.diagnostic = { stage, timeout: true, timeoutMs }; reject(error); }, timeoutMs);
    child.once('error', () => { clearTimeout(timer); reject(new Error('进化工具暂时没有准备好，请大人检查配置。')); });
    child.once('exit', (code, signal) => { clearTimeout(timer); if (code === 0) resolve(); else { const error = new Error(`${stage}没有完成，原来的小猫和成长进度都还在。`); error.diagnostic = { stage, exitCode: code, signal }; reject(error); } });
  });
}

async function generateForm({ level, previousFile, originalFile, dir, jobId }) {
  if(!settings.enabled('PET_ENABLE_GENERATION'))throw new Error('后续 AI 进化是选配项，当前未启用。');
  if (!process.env.PET_IMAGE_API_KEY || !process.env.PET_IMAGE_BASE_URL) throw new Error('进化图片服务还没接通，请大人先完成配置。');
  const python = process.env.PET_IMAGE_PYTHON || ((process.env.PET_IMAGE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')));
  const cli = process.env.PET_IMAGE_CLI || path.join(__dirname, 'scripts/image_gen.py');
  const ffmpeg = process.env.PET_IMAGE_FFMPEG || 'ffmpeg';
  if (!fs.existsSync(cli)) throw new Error('进化工具还没安装好，请大人检查配置。');
  await run(python, ['-c', 'import openai; from PIL import Image'], process.env, '检查图片工具');
  await run(ffmpeg, ['-version'], process.env, '检查背景处理工具');
  const workDir = path.join(dir, 'work', jobId);
  fs.mkdirSync(workDir, { recursive: true });
  const promptFile = path.join(workDir, 'prompt.txt');
  const raw = path.join(workDir, 'source.png');
  const output = path.join(dir, `${jobId}.png`);
  fs.writeFileSync(promptFile, promptFor(level));
  // Only the explicitly selected image provider receives this key. Do not log SDK output.
  const env = { ...process.env, OPENAI_API_KEY: process.env.PET_IMAGE_API_KEY, OPENAI_BASE_URL: process.env.PET_IMAGE_BASE_URL, PYTHONUTF8: '1' };
  await run(python, [cli, 'edit', '--model', process.env.PET_IMAGE_MODEL || 'gpt-image-2', '--image', previousFile, '--image', originalFile, '--prompt-file', promptFile, '--size', '1024x1024', '--quality', 'high', '--output-format', 'png', '--out', raw], env, '生成进化图片');
  const inspect = path.join(__dirname, 'scripts/inspect-evolution.py');
  // Keep an existing usable alpha; otherwise require a green screen before extraction.
  let hasAlpha = true;
  try { await run(python, [inspect, raw, 'alpha'], process.env, '检查透明背景'); } catch { hasAlpha = false; }
  if (hasAlpha) fs.copyFileSync(raw, output);
  else {
    try { await run(python, [inspect, raw, 'green'], process.env, '检查可去除的背景'); }
    catch (cause) {
      const error = new Error('新形态图片已经生成，但背景无法去除。原来的小猫和成长进度都还在。');
      error.diagnostic = { ...cause.diagnostic, stage: '检查图片背景', reason: 'neither_valid_alpha_nor_chroma_green', sourceSaved: true };
      throw error;
    }
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-vf', 'format=rgba,colorkey=0x00FF00:0.24:0.10,despill=green:mix=0.8:expand=0.1', '-frames:v', '1', output], process.env, '去除图片背景');
  }
  try { await run(python, [inspect, output, 'alpha'], process.env, '检查最终图片'); }
  catch (cause) {
    const error = new Error('新形态的透明背景没有处理好，这次先保留原来的小猫。');
    error.diagnostic = { ...cause.diagnostic, stage: '检查最终图片', sourceSaved: true };
    throw error;
  }
  return output;
}

function createEvolution({ state, save, dataDir, generator = generateForm, onForm = () => {}, animationView = () => ({ status: 'unavailable' }) }) {
  const dir = path.join(dataDir, 'evolutions');
  fs.mkdirSync(dir, { recursive: true });
  state.evolution ||= { level: 0, status: 'idle', forms: [] };
  // A server restart never silently retries a paid image request.
  if (state.evolution.status === 'generating') {
    state.evolution.status = 'failed'; state.evolution.error = '上次进化准备中断了，想继续时可以再试一次。'; save();
  }
  let active = false;
  let completion = Promise.resolve();
  function view() {
    const e = state.evolution;
    const image = e.forms.at(-1)?.image || ORIGINAL_IMAGE;
    const animation = animationView();
    const complete = e.level === 0 || (animation.status === 'ready' && animation.formImage === image);
    const total=generator!==generateForm||settings.enabled('PET_ENABLE_GENERATION')?THRESHOLDS.length:2;
    return { level: e.level, totalEvolutions: total, status: e.status, error: e.error || '', image: e.forms.at(-1)?.image || ORIGINAL_IMAGE,
      complete, completedLevel: Math.max(0, e.level - (complete ? 0 : 1)),
      preparation: e.status === 'generating' ? 'image' : complete ? 'ready' : 'animation',
      nextAt: e.level<total?THRESHOLDS[e.level]:null, eligible: complete && e.level < total && state.feeds >= THRESHOLDS[e.level],
      forms: e.forms.map(f => ({ level: f.level, image: f.image, createdAt: f.createdAt })) };
  }
  function start() {
    const e = state.evolution;
    if (active || !view().eligible) return false;
    active = true;
    const jobId = crypto.randomUUID();
    const level = e.level + 1;
    const previous = e.forms.at(-1);
    e.status = 'generating'; e.error = ''; delete e.diagnostic; e.jobId = jobId; save();
    completion = (async () => {
      try {
        if(generator===generateForm&&level<=2){
          const image=`/assets/pet/stage-${level}.png`;
          const pack=path.join(__dirname,`public/assets/pet/animations/stage-${level}`);
          if(!fs.existsSync(path.join(__dirname,'public',image))||!require('./animation-service').inspectPack(pack,image))throw new Error('预制形态或它的完整动作素材缺失。');
          e.forms.push({level,image,file:null,bundled:true,createdAt:Date.now()});e.level=level;e.status='idle';e.error='';return;
        }
        const output = await generator({ level, previousFile: previous?.bundled ? path.join(__dirname,'public',previous.image) : previous ? path.join(dir, previous.file) : path.join(__dirname, 'public/assets/pet/stage-0.png'), originalFile: path.join(__dirname, 'public/assets/pet/stage-0.png'), dir, jobId });
        if (!fs.existsSync(output) || path.resolve(output) !== path.join(dir, `${jobId}.png`)) throw new Error('新形态文件没有保存好，请再试一次。');
        e.forms.push({ level, file: `${jobId}.png`, image: `/api/evolutions/${jobId}.png`, createdAt: Date.now() });
        e.level = level; e.status = 'idle'; e.error = '';
        // Keep image/progress on binding failure, but view() cannot mark it complete or start another evolution.
        try { onForm(e.forms.at(-1)); }
        catch { e.diagnostic = { stage: '启动当前形态动作', animationPending: true }; }
      } catch (error) { e.status = 'failed'; e.error = error.message; e.diagnostic = error.diagnostic || { stage: '保存进化形态' }; }
      finally { active = false; save(); }
    })();
    return true;
  }
  return { view, start, settled: () => completion };
}

module.exports = { createEvolution, generateForm, promptFor, THRESHOLDS, run };
