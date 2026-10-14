const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
async function normalizeRecording(bytes){
 const root=path.join(process.env.PET_DATA_DIR||path.join(__dirname,'data'),'audio-work');fs.mkdirSync(root,{recursive:true});const dir=fs.mkdtempSync(path.join(root,'asr-')),source=path.join(dir,'recording'),output=path.join(dir,'speech.wav');
 try{fs.writeFileSync(source,bytes);await new Promise((resolve,reject)=>{const child=spawn(process.env.PET_IMAGE_FFMPEG||'ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-i',source,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le','-t','90',output],{windowsHide:true,stdio:'ignore'});const timer=setTimeout(()=>{child.kill();reject(Error('录音处理等得有点久，请重新录一小段。'));},20000);child.once('error',()=>{clearTimeout(timer);reject(Error('录音处理工具暂时没准备好。'));});child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('这段录音没有读出来，靠近手机重新讲几秒吧。'));});});const converted=fs.readFileSync(output);if(converted.length<1000)throw Error('录音太短啦，讲几秒后再点停止。');return converted;}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
}
module.exports={normalizeRecording};
