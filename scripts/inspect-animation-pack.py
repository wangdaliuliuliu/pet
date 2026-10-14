"""Decode every final rig part for the read-only release check."""
import json, sys
from pathlib import Path
from PIL import Image
directory=Path(sys.argv[1])
manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
for name,layer in manifest['layers'].items():
    assert layer['file']==name+'.png' and name.isalpha()
    with Image.open(directory/layer['file']) as source:
        source.load()
        assert source.size==(layer['width'],layer['height'])
        image=source.convert('RGBA')
        hist=image.getchannel('A').histogram()
        assert hist[0]>0 and sum(hist[240:])>image.width*image.height*.1
print('ALL_RIG_PARTS_DECODED_WITH_ALPHA')
