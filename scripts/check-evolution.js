// Read-only, checks bundled forms and optional current save; never calls providers.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
require('../env');
const {inspectPack}=require('../animation-service');
try{
 const root=path.resolve(__dirname,'..'),python=process.env.PET_IMAGE_PYTHON||(process.platform==='win32'?'python':'python3');
 const checks=[];
 function verify(level,image,pack){
  if(!inspectPack(pack,image))throw Error('Current form binding or part files are invalid');
  const file=path.join(root,'public',image);
  for(const args of [[path.join(root,'scripts/inspect-evolution.py'),file,'alpha'],[path.join(root,'scripts/inspect-animation-pack.py'),pack]]){
   const r=spawnSync(python,args,{stdio:'ignore',windowsHide:true});if(r.error||r.status!==0)throw Error('Decoded image/rig inspection failed; install Python and Pillow');
  }
  checks.push({level,complete:true,bindingAndPartFiles:true,imageAlpha:true});
 }
 for(const level of [1,2])verify(level,`/assets/pet/stage-${level}.png`,path.join(root,`public/assets/pet/animations/stage-${level}`));
 const dir=path.resolve(process.argv[2]||process.env.PET_DATA_DIR||path.join(root,'data')),file=path.join(dir,'pet.json');
 if(fs.existsSync(file)){
  const state=JSON.parse(fs.readFileSync(file,'utf8')),form=state.evolution?.forms.at(-1);
  if(form&&!form.bundled){
   const record=state.animationPacks?.[form.image];if(!record||record.status!=='ready'||!/^[a-f0-9-]+$/.test(record.jobId))throw Error('Current generated form animation is incomplete');
   const pack=path.join(dir,'animations',record.jobId);if(!inspectPack(pack,form.image))throw Error('Current generated form binding invalid');
   if(path.basename(form.file)!==form.file)throw Error('Invalid form filename');
   const result=spawnSync(python,[path.join(root,'scripts/inspect-evolution.py'),path.join(dir,'evolutions',form.file),'alpha'],{stdio:'ignore'});if(result.status!==0)throw Error('Current generated image alpha invalid');
  }
 }
 console.log(JSON.stringify({complete:true,bundled:checks,browserVisualCheck:'required_separately'}));
}catch{console.error('EVOLUTION_INCOMPLETE: verify assets and Python/Pillow installation.');process.exitCode=1;}
