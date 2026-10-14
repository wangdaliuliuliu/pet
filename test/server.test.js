const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
async function freePort() { return new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); }); }
test('读书、领取、成长、幂等、保存和睡眠唤醒', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-test-'));
  const port = await freePort(); let child;
  const base = 'http://127.0.0.1:' + port;
  async function start() {
    child = spawn(process.execPath, [path.join(__dirname, '../server.js')], { env: { ...process.env, PET_SKIP_ENV: '1', PORT: String(port), PET_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); child.once('exit', code => reject(new Error('服务退出 ' + code))); });
  }
  async function stop() { if (!child || child.exitCode !== null) return; await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
  async function post(route, body) { const res = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: res.status, data: await res.json() }; }
  try {
    await start();
    assert.equal((await fetch(base + '/')).status, 200);
    assert.deepEqual((await (await fetch(base + '/api/chat/history')).json()).messages, []);
    assert.equal((await fetch(base + '/api/chat/history?before=-1')).status, 400);
    const publicState = await (await fetch(base + '/api/pet')).json();
    assert.equal('chatArchive' in publicState, false); assert.equal('memories' in publicState, false);
    assert.equal((await fetch(base + '/data/pet.json')).status, 404);
    assert.equal((await post('/api/evolve', { actionId: 'too-early-evolution' })).status, 409);
    assert.equal((await (await fetch(base + '/api/pet')).json()).evolution.level, 0);
    assert.equal((await post('/api/claim', { actionId: 'early-claim' })).status, 409);
    assert.equal((await post('/api/feed', { actionId: 'early-feed' })).status, 409);
    assert.equal((await post('/api/read', { actionId: 'manual-read-disabled' })).status, 410);
    assert.equal((await (await fetch(base + '/api/pet')).json()).readings, 0);
    assert.equal((await post('/api/story', { actionId: 'empty', transcript: '' })).status, 400);
    let result = await post('/api/story', { actionId: 'story-one', transcript: '猫' });
    assert.equal(result.data.readings, 1); assert.equal(result.data.availableRewards, 1);
    result = await post('/api/story', { actionId: 'story-one', transcript: '今天小猪和爸爸妈妈一起去植物园。' });
    assert.equal(result.data.readings, 1);
    result = await post('/api/story', { actionId: 'story-two', audio: Buffer.alloc(1500, 5).toString('base64'), audioType: 'audio/webm' });
    assert.equal(result.data.availableRewards, 2);
    const recordedStoryId=result.data.stories[0].id;
    result = await post('/api/story', { actionId: 'story-three', transcript: '小兔子在草地上看云。' });
    assert.equal(result.status,200);assert.equal(result.data.readings,3);assert.equal(result.data.stories.length,3);assert.equal(result.data.availableRewards,2);assert.equal(result.data.storyReward.granted,false);assert.match(result.data.storyReward.message,/每天讲故事最多获得 2 个/);
    result = await post('/api/story', { actionId: 'story-three', transcript: '重复提交同一个故事' });
    assert.equal(result.data.readings,3);assert.equal(result.data.storyReward.replayed,true);assert.equal(result.data.availableRewards,2);
    assert.equal((await fetch(base + '/api/recordings/' + recordedStoryId)).status, 200);
    result = await post('/api/claim', { actionId: 'claim-one', ingredients: ['fish'] }); assert.equal(result.data.ingredients.fish, 1);
    result = await post('/api/claim', { actionId: 'claim-one', ingredients: ['fish'] }); assert.equal(result.data.ingredients.fish, 1);
    result = await post('/api/cook', { actionId: 'cook-one', recipe: 'fried-fish' }); assert.equal(result.data.dishes['fried-fish'], 1);
    result = await post('/api/cook', { actionId: 'cook-one', recipe: 'fried-fish' }); assert.equal(result.data.dishes['fried-fish'], 1);
    result = await post('/api/feed', { actionId: 'feed-one' }); assert.equal(result.data.food, 0); assert.equal(result.data.feeds, 1);
    result = await post('/api/feed', { actionId: 'feed-one' }); assert.equal(result.data.feeds, 1);
    await stop(); await start();
    let state = await (await fetch(base + '/api/pet')).json(); assert.equal(state.readings, 3); assert.equal(state.feeds, 1);assert.equal(state.home.storyRewards.earned,2);
    await stop();
    state = JSON.parse(fs.readFileSync(path.join(dir, 'pet.json'), 'utf8'));
    state.lastFedAt = Date.now() - 3 * 86400000 - 1000; state.food = 1;
    fs.writeFileSync(path.join(dir, 'pet.json'), JSON.stringify(state));
    await start();
    state = await (await fetch(base + '/api/pet')).json(); assert.equal(state.sleeping, true);
    result = await post('/api/feed', { actionId: 'wake' }); assert.equal(result.data.sleeping, false); assert.equal(result.data.feeds, 2);
    assert.equal(result.data.evolution.level, 0);
    assert.equal(result.data.evolution.image, '/assets/pet/stage-0.png');
  } finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
