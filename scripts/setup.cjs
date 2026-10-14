// Interactive local onboarding; optional secrets are hidden and never sent to providers.
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline/promises');
const target=path.resolve(__dirname,'../.env');
function encode(value){if(/[\r\n"]/.test(value))throw Error('配置值不能包含换行或双引号。');return '"'+value+'"';}
async function main(){
 const rl=readline.createInterface({input:process.stdin,output:process.stdout});
 async function ask(prompt,fallback=''){const answer=(await rl.question(prompt)).trim();return answer||fallback;}
 async function secret(prompt){
  if(!process.stdin.isTTY)return ask(prompt);
  const write=rl._writeToOutput;process.stdout.write(prompt);rl._writeToOutput=()=>{};
  try{return (await rl.question('')).trim();}finally{rl._writeToOutput=write;process.stdout.write('\n');}
 }
 try{
  console.log('硬性条件：Node.js 22+、可写存档目录。默认本机玩法没有必须手填的信息。\n联网访问时访问密码必填；聊天/语音/看图/生图都选填，不填只关闭对应功能。');
  if(fs.existsSync(target)&&await ask('已有 .env，要覆盖吗？输入 yes 才覆盖：')!=='yes'){console.log('保留原配置。');return;}
  const mode=await ask('使用方式：1 本机（默认） / 2 联网或云部署：','1');const env={HOST:mode==='2'?'0.0.0.0':'127.0.0.1',PORT:'3210',PET_DATA_DIR:'./data',PET_ENABLE_GENERATION:'0',PET_ENABLE_TRIPS:'0',PET_DISABLE_TRIPS:'1'};
  if(mode==='2'){while(true){const value=await secret('【必填】自己的访问密码（至少12字符，不会显示）：');if(value.length>=12){env.PET_ACCESS_PASSWORD=value;break;}console.log('联网密码不能留空或少于12字符。');}}
  const name=await ask('【选填】称呼昵称（留空使用“朋友”，不用真实姓名）：');if(name)env.PET_OWNER_NICKNAME=name;
  console.log('下面的服务全部选配，API 可能收费。所有 key 输入不显示，也不会进行测试请求。');
  for(const [kind,label] of [['CHAT','聊天'],['ASR','转文字（需FFmpeg）'],['TTS','发声'],['VISION','百炼看图']]){
   if(await ask('【选配】启用'+label+'？y / 留空跳过：')!=='y')continue;
   const key=await secret('自己的 '+kind+' key（留空跳过此功能）：');if(!key)continue;env[`PET_${kind}_API_KEY`]=key;
   env[`PET_${kind}_BASE_URL`]=await ask('服务地址（留空用默认，必须匹配提供商）：');
   const model=await ask('模型名称（留空用默认）：');if(model)env[`PET_${kind}_MODEL`]=model;
   if(['ASR','TTS'].includes(kind))env[`PET_${kind}_PROVIDER`]=await ask('接口类型 openai / bailian（默认openai）：','openai');
   if(kind==='TTS'){const voice=await ask('声音名称（留空用默认）：');if(voice)env.PET_TTS_VOICE=voice;}
  }
  if(await ask('【选配，可能收费】启用后续图片进化？y / 留空跳过：')==='y'){
   const key=await secret('自己的图片服务 key（留空跳过）：'),base=await ask('图片编辑服务地址（不能为空，留空跳过）：');
   if(key&&base){env.PET_ENABLE_GENERATION='1';env.PET_IMAGE_API_KEY=key;env.PET_IMAGE_BASE_URL=base;const model=await ask('图片编辑模型（留空用默认）：');if(model)env.PET_IMAGE_MODEL=model;
    if(await ask('【选配】同时启用旅行？需聊天+百炼看图+图片服务；y / 留空跳过：')==='y'){env.PET_ENABLE_TRIPS='1';env.PET_DISABLE_TRIPS='0';}}
  }
  fs.writeFileSync(target,'# 私密配置：不要提交到 GitHub\n'+Object.entries(env).map(([k,v])=>k+'='+encode(v)).join('\n')+'\n',{mode:0o600});
  console.log('配置已保存。运行 npm run doctor 检查缺项，再运行 npm start。没有调用收费服务。');
 }finally{if(process.stdin.isTTY&&process.stdin.isRaw)process.stdin.setRawMode(false);rl.close();}
}
if(require.main===module)main().catch(()=>{console.error('配置未完成；请检查输入或目标文件权限。');process.exitCode=1;});
module.exports={encode};
