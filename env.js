const fs=require('node:fs'),path=require('node:path');
if(process.env.PET_SKIP_ENV!=='1'){
  const file=path.join(__dirname,'.env');
  if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
    const m=/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
  }
}
