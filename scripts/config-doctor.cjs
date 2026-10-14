const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
require('../env');const root=path.resolve(__dirname,'..');
const yes=k=>Boolean(process.env[k]?.trim()),enabled=k=>['1','true'].includes(process.env[k]);
function run(cmd,args){return cp.spawnSync(cmd,args,{stdio:'ignore',windowsHide:true,timeout:15000}).status===0;}
function check(){
 const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||3210),online=!['127.0.0.1','localhost','::1'].includes(host);
 const required=[];if(Number(process.versions.node.split('.')[0])<22)required.push('Node.js 22+');if(!Number.isInteger(port)||port<1||port>65535)required.push('PORT（1–65535）');if(online&&(process.env.PET_ACCESS_PASSWORD||'').length<12)required.push('PET_ACCESS_PASSWORD（联网必填，至少12字符）');
 let ancestor=path.resolve(root,process.env.PET_DATA_DIR||'data');while(!fs.existsSync(ancestor)&&path.dirname(ancestor)!==ancestor)ancestor=path.dirname(ancestor);try{fs.accessSync(ancestor,fs.constants.W_OK);if(!fs.statSync(ancestor).isDirectory())required.push('可写的 PET_DATA_DIR');}catch{required.push('可写的 PET_DATA_DIR');}
 const python=process.env.PET_IMAGE_PYTHON||(process.platform==='win32'?'python':'python3'),pillow=run(python,['-c','from PIL import Image']),sdk=pillow&&run(python,['-c','import openai']),ffmpeg=run(process.env.PET_IMAGE_FFMPEG||'ffmpeg',['-version']);
 const shared=yes('PET_AI_API_KEY')||yes('OPENAI_API_KEY'),optional=[];
 function add(id,label,missing,on=true){optional.push({id,label,status:!on?'disabled':missing.length?'missing':'configured-unverified',missing,requiredForBase:false});}
 for(const [kind,id,label] of [['CHAT','chat','聊天'],['ASR','transcription','转文字'],['TTS','speech','发声']]){
  const missing=[];if(!yes(`PET_${kind}_API_KEY`)&&!shared)missing.push(`PET_${kind}_API_KEY 或共享 key`);
  const base=process.env[`PET_${kind}_BASE_URL`]||process.env.PET_AI_BASE_URL||'https://api.openai.com/v1';try{const u=new URL(base);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error();}catch{missing.push('有效服务地址');}
  if(kind==='ASR'&&!ffmpeg)missing.push('FFmpeg');if(kind!=='CHAT'&&!['openai','bailian'].includes(process.env[`PET_${kind}_PROVIDER`]||'openai'))missing.push('受支持的 PROVIDER');add(id,label,missing);
 }
 add('upload','照片上传',pillow?[]:['Python + Pillow']);
 add('vision','看图',yes('PET_VISION_API_KEY')||yes('PET_ASR_API_KEY')?[]:['百炼 PET_VISION_API_KEY（不使用共享 key）']);
 const imageMissing=[];for(const k of ['PET_IMAGE_API_KEY','PET_IMAGE_BASE_URL'])if(!yes(k))imageMissing.push(k);if(!sdk)imageMissing.push('Python + openai + Pillow');if(!ffmpeg)imageMissing.push('FFmpeg');add('generation','后续 AI 进化/额外动作',imageMissing,enabled('PET_ENABLE_GENERATION'));
 const tripMissing=optional.filter(f=>['chat','vision','generation'].includes(f.id)&&f.status!=='configured-unverified').map(f=>f.label);add('trips','旅行',tripMissing,enabled('PET_ENABLE_TRIPS'));
 return {basicReady:required.length===0,mode:online?'network':'local',requiredMissing:required,optional,notes:['本机基础版无需填写任何 AI key；默认使用空存档和两次预制进化。','选配项缺失只影响对应功能。已填不代表模型、余额或网络实测通过。','联网访问密码必须填写；本机可以不填。所有 key 只存服务器。','本检查不请求服务、不写存档、不输出密钥。免费临时云盘不能保证保留进度。']};
}
if(require.main===module){const result=check();if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));else{console.log('硬性条件：'+(result.basicReady?'已满足；本机无需必填配置。':result.requiredMissing.join('、')));for(const f of result.optional)console.log('选配 '+f.label+'：'+({'disabled':'未启用','missing':'缺少 '+f.missing.join('、'),'configured-unverified':'已填，尚未实测'}[f.status]));for(const note of result.notes)console.log(note);}process.exitCode=result.basicReady?0:1;}
module.exports={check};
