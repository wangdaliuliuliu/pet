// All media callers use IDs and this adapter. An OSS adapter can keep these URLs stable.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function createMediaStore({state,save,dataDir}) {
 state.photos ||= [];const dir=path.join(dataDir,'media');fs.mkdirSync(dir,{recursive:true});
 function put(bytes,type,metadata={}){const id=crypto.randomUUID(),ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];if(!ext)throw Error('不支持的照片格式');
  const file=id+'.'+ext;fs.writeFileSync(path.join(dir,file),bytes);const item={id,file,type,url:'/api/media/'+id,createdAt:Date.now(),...metadata};state.photos.push(item);save();return item;
 }
 function get(id){return state.photos.find(p=>p.id===id);}
 function bytes(id){const p=get(id);if(!p)return null;return fs.readFileSync(path.join(dir,p.file));}
 function publicPhoto(p){return p?{id:p.id,url:p.url,caption:p.caption||'',kind:p.kind,createdAt:p.createdAt,place:p.place,date:p.date,formImage:p.formImage,selfLabeled:!!p.selfLabeled}:null;}
 return {put,get,bytes,publicPhoto,path:id=>{const p=get(id);return p?path.join(dir,p.file):null;},dataUrl:id=>{const p=get(id);return p?`data:${p.type};base64,${bytes(id).toString('base64')}`:null;}};
}
module.exports={createMediaStore};
