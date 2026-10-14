const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {normalizeRecording}=require('../audio-service');
test('合成测试音频转换为16k单声道WAV，错误音频拒绝且清理临时文件',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-audio-')),old=process.env.PET_DATA_DIR;process.env.PET_DATA_DIR=dir;
 try{
  for(const ext of ['m4a','webm','mp3']){
   const file=path.join(dir,'tone.'+ext),r=spawnSync(process.env.PET_IMAGE_FFMPEG||'ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=1','-y',file]);assert.equal(r.status,0,'FFmpeg required');
   const wav=await normalizeRecording(fs.readFileSync(file));assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.equal(wav.subarray(8,12).toString(),'WAVE');assert.equal(wav.readUInt16LE(22),1);assert.equal(wav.readUInt32LE(24),16000);assert.ok(wav.length>1000);
  }
  await assert.rejects(normalizeRecording(Buffer.alloc(1200,1)),/没有读出来/);assert.equal(fs.readdirSync(path.join(dir,'audio-work')).length,0);
 }finally{if(old===undefined)delete process.env.PET_DATA_DIR;else process.env.PET_DATA_DIR=old;fs.rmSync(dir,{recursive:true,force:true});}
});
