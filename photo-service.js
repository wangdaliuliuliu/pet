const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {run}=require('./evolution-service');
function python(){return process.env.PET_IMAGE_PYTHON||((process.env.PET_IMAGE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')));}
async function uploadPhoto(body,media,dataDir){
 if(typeof body.image!=='string'||body.image.length>12*1024*1024)throw Error('选一张8MB以内的照片吧。');
 const bytes=Buffer.from(body.image,'base64');if(bytes.length<100||bytes.length>8*1024*1024)throw Error('照片文件太小或太大了。');
 const work=path.join(dataDir,'photo-work',crypto.randomUUID());fs.mkdirSync(work,{recursive:true});const source=path.join(work,'upload'),final=path.join(work,'photo.jpg');
 try{fs.writeFileSync(source,bytes);await run(python(),[path.join(__dirname,'scripts/normalize-photo.py'),source,final],process.env,'检查照片');return media.put(fs.readFileSync(final),'image/jpeg',{kind:'child',caption:'孩子分享的一张照片',selfLabeled:body.selfLabeled===true});}
 finally{fs.rmSync(work,{recursive:true,force:true});}
}
module.exports={uploadPhoto,python};
