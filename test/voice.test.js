const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.PET_SKIP_ENV = '1';
const voice = require('../voice-service');
test('转文字、聊天、发声请求格式与错误处理', async () => {
  const oldFetch = global.fetch;
  const keys = ['PET_AI_API_KEY', 'OPENAI_API_KEY', 'PET_ASR_API_KEY', 'PET_CHAT_API_KEY', 'PET_TTS_API_KEY', 'PET_AI_BASE_URL', 'PET_CHAT_BASE_URL', 'PET_CHAT_MODEL'];
  const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(voice.capabilities().chatConfigured, false);
    await assert.rejects(voice.chat('你好', [], { feeds: 0 }), e => e.status === 503);
    process.env.PET_AI_API_KEY = 'fixture-key'; process.env.PET_AI_BASE_URL = 'https://fixture.invalid/v1';
    global.fetch = async (url, opts) => {
      assert.equal(opts.headers.Authorization, 'Bearer fixture-key');
      if (url.endsWith('/audio/transcriptions')) { assert.ok(opts.body instanceof FormData); assert.equal(opts.body.get('language'), 'zh'); assert.ok(opts.body.get('file').size > 100); return new Response(JSON.stringify({ text: '小兔子种了一朵花。' })); }
      if (url.endsWith('/chat/completions')) { const body = JSON.parse(opts.body); assert.equal(body.messages.at(-1).content, '小猫你好'); assert.ok(body.messages[0].content.includes('朋友')); return new Response(JSON.stringify({ choices: [{ message: { content: '你好呀，今天读到了什么故事？' } }] })); }
      assert.ok(url.endsWith('/audio/speech')); assert.equal(JSON.parse(opts.body).input, '你好呀'); return new Response(Buffer.from('fixture-mp3'), { headers: { 'Content-Type': 'audio/mpeg' } });
    };
    const text = await voice.transcribe({ audio: Buffer.alloc(1200, 1).toString('base64'), audioType: 'audio/webm;codecs=opus' }); assert.equal(text, '小兔子种了一朵花。');
    assert.match(await voice.chat('小猫你好', [], { feeds: 2 }), /你好/);
    assert.equal((await voice.speak('你好呀')).toString(), 'fixture-mp3');
    process.env.PET_CHAT_BASE_URL = 'https://api.deepseek.com'; process.env.PET_CHAT_MODEL = 'deepseek-flash';
    global.fetch = async (url, opts) => { const body = JSON.parse(opts.body); assert.equal(url, 'https://api.deepseek.com/chat/completions'); assert.equal(body.model, 'deepseek-flash'); assert.deepEqual(body.thinking, { type: 'disabled' }); return new Response(JSON.stringify({ choices: [{ message: { content: '你好呀！' } }] })); };
    assert.equal(await voice.chat('你好', [], { feeds: 0 }), '你好呀！');
    global.fetch = async () => new Response('{}', { status: 401 });
    await assert.rejects(voice.chat('你好', [], { feeds: 0 }), e => e.message.includes('密钥') && !e.message.includes('fixture-key'));
    global.fetch = async () => new Response(JSON.stringify({ error: { code: 'insufficient_balance' } }), { status: 402 });
    await assert.rejects(voice.chat('你好', [], { feeds: 0 }), e => e.status === 503 && e.message.includes('额度'));
    global.fetch = async () => new Response(JSON.stringify({ code: 'AllocationQuota.FreeTierOnly' }), { status: 403 });
    await assert.rejects(voice.speak('你好'), e => e.status === 503 && e.message.includes('额度'));
    global.fetch = async () => new Response('{}', { status: 429 });
    await assert.rejects(voice.chat('你好', [], { feeds: 0 }), e => e.message.includes('忙') && !e.message.includes('额度'));
    await assert.rejects(voice.transcribe({ audio: '', audioType: 'audio/webm' }), e => e.status === 400);
    global.fetch = async () => { throw new Error('network'); };
    await assert.rejects(voice.speak('你好'), e => e.message.includes('连不上'));
  } finally { global.fetch = oldFetch; for (const key of keys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; } }
});

test('百炼接收手机录音，读取原生识别结果，并下载 MP3 而非返回 JSON', async () => {
  const oldFetch = global.fetch;
  const keys = ['PET_ASR_PROVIDER', 'PET_TTS_PROVIDER', 'PET_ASR_API_KEY', 'PET_TTS_API_KEY', 'PET_ASR_BASE_URL', 'PET_TTS_BASE_URL', 'PET_ASR_MODEL', 'PET_TTS_MODEL', 'PET_TTS_VOICE'];
  const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const kind of ['ASR', 'TTS']) {
      process.env[`PET_${kind}_PROVIDER`] = 'bailian';
      process.env[`PET_${kind}_API_KEY`] = 'fixture-key';
      process.env[`PET_${kind}_BASE_URL`] = 'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1';
    }
    process.env.PET_ASR_MODEL = 'qwen-audio-3.1-asr-flash';
    process.env.PET_TTS_MODEL = 'qwen-audio-3.0-tts-flash';
    process.env.PET_TTS_VOICE = 'longanhuan_v3.6';
    let downloads = 0;
    global.fetch = async (url, opts) => {
      if (String(url).includes('oss-cn-beijing')) {
        downloads++;
        assert.equal(new URL(url).protocol, 'https:');
        assert.equal(opts.headers, undefined);
        return new Response(Buffer.from('ID3fixture-mp3'));
      }
      assert.equal(opts.headers.Authorization, 'Bearer fixture-key');
      const body = JSON.parse(opts.body);
      if (String(url).endsWith('/multimodal-generation/generation')) {
        assert.equal(body.model, 'qwen-audio-3.1-asr-flash');
        assert.equal(body.input.messages[0].content[0].type, 'input_audio');
        assert.match(body.input.messages[0].content[0].input_audio.data, /^data:audio\/wav;base64,/);
        assert.equal(body.parameters.format, 'wav');
        return new Response(JSON.stringify({ output: { text: '小兔子种花。' } }));
      }
      assert.ok(String(url).endsWith('/tts/SpeechSynthesizer'));
      assert.equal(body.input.text, '你好呀');
      assert.equal(body.input.format, 'mp3');
      return new Response(JSON.stringify({ output: { audio: { url: 'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/audio.mp3' } } }));
    };
    assert.equal(await voice.transcribe({ audio: Buffer.alloc(1200, 1).toString('base64'), audioType: 'audio/mp4' }, async bytes => bytes), '小兔子种花。');
    assert.equal((await voice.speak('你好呀')).toString(), 'ID3fixture-mp3');
    assert.equal(downloads, 1);
    global.fetch = async () => new Response(JSON.stringify({ output: { audio: { url: 'https://untrusted.invalid/audio.mp3' } } }));
    await assert.rejects(voice.speak('你好呀'), /地址不正确/);
    global.fetch = async () => new Response(JSON.stringify({ output: { text: '' } }));
    await assert.rejects(voice.transcribe({ audio: Buffer.alloc(1200, 1).toString('base64'), audioType: 'audio/webm' }, async bytes => bytes), e => e.status === 422);
  } finally {
    global.fetch = oldFetch;
    for (const key of keys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }
  }
});
