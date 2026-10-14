const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
test('接受接近不透明的主体；仍拒绝无背景透明和幽灵状半透明主体', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-alpha-'));
  const python = (process.env.PET_IMAGE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'));
  try {
    const fixture = spawnSync(python, ['-c', `from PIL import Image
import sys
from pathlib import Path
dir=Path(sys.argv[1])
for name,alpha in [('near',249),('opaque',255),('ghost',80)]:
 im=Image.new('RGBA',(600,600),(0,0,0,0))
 im.paste((230,100,160,alpha),(100,100,500,500))
 im.save(dir/(name+'.png'))
Image.new('RGB',(600,600),'pink').save(dir/'background.png')`, dir], { encoding: 'utf8' });
    assert.equal(fixture.status, 0, fixture.stderr);
    for (const [name, expected] of [['near',0],['opaque',0],['ghost',1],['background',1]]) {
      const result = spawnSync(python, [path.join(__dirname, '../scripts/inspect-evolution.py'),path.join(dir,name+'.png'),'alpha']);
      assert.equal(result.status, expected, name);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
