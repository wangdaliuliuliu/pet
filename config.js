require('./env');
const fs=require('node:fs'),path=require('node:path');
const enabled=name=>process.env[name]==='1'||process.env[name]==='true';
function serverConfig(){
  const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||3210),password=process.env.PET_ACCESS_PASSWORD||'';
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT 必须是 1 到 65535 的整数。');
  if(!['127.0.0.1','localhost','::1'].includes(host)&&password.length<12)throw Error('联网访问必须配置至少 12 个字符的 PET_ACCESS_PASSWORD；只在本机试玩可使用 HOST=127.0.0.1。');
  const dataDir=path.resolve(__dirname,process.env.PET_DATA_DIR||'data');
  fs.mkdirSync(dataDir,{recursive:true});fs.accessSync(dataDir,fs.constants.W_OK);
  return {host,port,password,dataDir};
}
module.exports={enabled,serverConfig};
