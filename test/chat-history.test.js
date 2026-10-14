const { test } = require('node:test');
const assert = require('node:assert/strict');
const history = require('../chat-history');
test('迁移旧聊天一次，新聊天独立保存，不随模型近期上下文截断，分页重启可恢复', () => {
  const state = { chatMessages: [{ role: 'user', content: '以前的小故事' }, { role: 'assistant', content: '喵，我听着呢' }] };
  history.migrate(state); history.migrate(state); assert.equal(state.chatArchive.length, 2);
  for (let i = 0; i < 35; i++) history.append(state, `故事${i}`, `回应${i}`, `action-${i}`);
  state.chatMessages = state.chatArchive.slice(-24);
  const restored = JSON.parse(JSON.stringify(state)); history.migrate(restored);
  const latest = history.page(restored, null); assert.equal(latest.messages.length, 50); assert.equal(latest.nextBefore, 22);
  const earlier = history.page(restored, String(latest.nextBefore)); assert.equal(earlier.messages.length, 22); assert.equal(earlier.nextBefore, null);
  const all = [...earlier.messages, ...latest.messages]; assert.equal(all.length, 72); assert.equal(all[0].content, '以前的小故事'); assert.equal(all.at(-1).content, '回应34');
  assert.equal(new Set(all.map(m => m.id)).size, 72); assert.equal(all.some(m => 'actionId' in m), false);
  assert.throws(() => history.page(restored, '-1'), /位置/); assert.throws(() => history.page(restored, '100000'), /位置/);
});
