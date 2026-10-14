const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('服务器自动切分素材，缺少尾巴或背部饰品不会沿用旧饰品；缺失必要部件会拒绝绑定',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pet-pack-'));const python=(process.env.PET_IMAGE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'));
 try{
  const fixture="from PIL import Image,ImageDraw\nimport sys\nim=Image.new('RGBA',(1200,1200));d=ImageDraw.Draw(im)\nfor i in [0,1,2,3,4,5,8]:\n x=(i%3)*400+200;y=(i//3)*400+200;d.rectangle((x-80,y-80,x+80,y+80),fill=(240,100,180,255))\nim.save(sys.argv[1])";
  assert.equal(spawnSync(python,['-c',fixture,path.join(tmp,'atlas.png')]).status,0);
  const pack=spawnSync(python,[path.resolve('scripts/pack-animation.py'),path.join(tmp,'atlas.png'),path.join(tmp,'pack')]);assert.equal(pack.status,0,pack.stderr.toString());
  const manifest=JSON.parse(fs.readFileSync(path.join(tmp,'pack/manifest.json')));assert.equal(manifest.layers.backAccessory,undefined);assert.equal(manifest.layers.tail,undefined);assert.ok(manifest.layers.head);assert.ok(manifest.layers.legRight);
  assert.equal(spawnSync(python,['-c',"from PIL import Image\nimport sys\nim=Image.open(sys.argv[1]);im.paste((0,0,0,0),(0,0,400,400));im.save(sys.argv[1])",path.join(tmp,'atlas.png')]).status,0);
  assert.notEqual(spawnSync(python,[path.resolve('scripts/pack-animation.py'),path.join(tmp,'atlas.png'),path.join(tmp,'failed')]).status,0);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
