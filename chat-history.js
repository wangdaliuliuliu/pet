const crypto = require('node:crypto');
function migrate(state) {
  if (Array.isArray(state.chatArchive)) return;
  state.chatArchive = (state.chatMessages || []).map(m => ({ ...m, id: crypto.randomUUID(), createdAt: null }));
}
function append(state, message, reply, actionId) {
  const createdAt = Date.now();
  state.chatArchive.push({ id: crypto.randomUUID(), role: 'user', content: message, actionId, createdAt },
    { id: crypto.randomUUID(), role: 'assistant', content: reply, actionId, createdAt });
}
function page(state, cursor) {
  const before = cursor === null ? state.chatArchive.length : Number(cursor);
  if (!Number.isInteger(before) || before < 0 || before > state.chatArchive.length) { const err = new Error('聊天记录位置不正确，请重新打开聊天。'); err.status = 400; throw err; }
  const start = Math.max(0, before - 50);
  return { messages: state.chatArchive.slice(start, before).map(({ id, role, content, createdAt, photoIds, referencePhotoId }) => ({ id, role, content, createdAt, ...(photoIds?.length?{photoIds}:{}),...(referencePhotoId?{referencePhotoId}:{}) })), nextBefore: start > 0 ? start : null };
}
module.exports = { migrate, append, page };
