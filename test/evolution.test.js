const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createEvolution, promptFor, THRESHOLDS } = require('../evolution-service');

test('进化仅在满足喂食条件后调用；并发不重复，保存后沿用上一形态和原始参考', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-evolution-'));
  try {
    const state = { feeds: 0 }; const calls = []; let release;
    const generator = async args => {
      calls.push(args);
      await new Promise(resolve => { release = resolve; });
      const file = path.join(args.dir, `${args.jobId}.png`);
      fs.writeFileSync(file, 'fixture-png'); return file;
    };
    const save = () => fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
    let service = createEvolution({ state, save, dataDir: dir, generator, animationView:()=>({status:'ready',formImage:state.evolution?.forms.at(-1)?.image}) });
    assert.equal(service.view().image, '/assets/pet/stage-0.png');
    assert.equal(service.start(), false); assert.equal(calls.length, 0);
    state.feeds = 3;
    assert.equal(service.start(), true); assert.equal(service.start(), false);
    assert.equal(calls.length, 1); assert.equal(service.view().level, 0);
    assert.equal(service.view().status, 'generating');
    assert.equal(service.view().image, '/assets/pet/stage-0.png');
    assert.equal(calls[0].previousFile, calls[0].originalFile);
    release(); await service.settled();
    assert.equal(service.view().level, 1); assert.match(service.view().image, /^\/api\/evolutions\/.*\.png$/);
    const restored = JSON.parse(fs.readFileSync(path.join(dir, 'state.json')));
    service = createEvolution({ state: restored, save: () => {}, dataDir: dir, generator, animationView:()=>({status:'ready',formImage:restored.evolution?.forms.at(-1)?.image}) });
    assert.equal(calls.length, 1); assert.equal(service.view().level, 1);
    assert.equal(service.start(), false);
    restored.feeds = 8; service.start();
    assert.equal(calls[1].previousFile, path.join(dir, 'evolutions', restored.evolution.forms[0].file));
    assert.equal(calls[1].originalFile, calls[0].originalFile);
    release(); await service.settled(); assert.equal(service.view().level, 2);
    for (const threshold of THRESHOLDS.slice(2)) { restored.feeds = threshold; service.start(); release(); await service.settled(); }
    assert.equal(service.view().level, 4); assert.equal(service.view().nextAt, null);
    restored.feeds = 100; assert.equal(service.start(), false); assert.equal(calls.length, 4);
    assert.ok(promptFor(1).includes('CURRENT form')); assert.ok(promptFor(4).includes('ORIGINAL identity anchor'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('失败不丢进度、不换图；重启中断任务不自动重试或扣费', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-evolution-failure-'));
  try {
    const state = { feeds: 3, food: 2 }; let calls = 0;
    const service = createEvolution({ state, save: () => {}, dataDir: dir, generator: async () => { calls++; throw new Error('fixture failure'); } });
    service.start(); await service.settled();
    assert.equal(state.feeds, 3); assert.equal(state.food, 2); assert.equal(service.view().level, 0);
    assert.equal(service.view().image, '/assets/pet/stage-0.png'); assert.equal(service.view().status, 'failed');
    assert.equal(calls, 1);
    state.evolution.status = 'generating';
    const restored = createEvolution({ state, save: () => {}, dataDir: dir, generator: async () => { calls++; } });
    assert.equal(restored.view().status, 'failed'); assert.equal(calls, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
