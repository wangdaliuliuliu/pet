"""Pack generated cutout art and joint metadata. Never designs or paints art."""
import json, sys, pathlib
from PIL import Image

source, destination = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
legacy = '--sample' in sys.argv
im = Image.open(source).convert('RGBA')
w, h = im.size
if min(w, h) < 512 or im.getchannel('A').histogram()[0] < w*h*.1:
    raise ValueError('Atlas must have a transparent background and sufficient resolution')
alpha = im.getchannel('A')
def gap(axis, start, end, bounds):
    x0,y0,x1,y1=bounds
    scores=[]
    for n in range(start,end):
        line=alpha.crop((x0,n,x1,n+1) if axis=='y' else (n,y0,n+1,y1))
        scores.append(sum(line.histogram()[64:]))
    # Choose a seven-pixel low-occupancy band rather than a fur-edge notch.
    values=[sum(scores[max(0,i-3):i+4]) for i in range(len(scores))]
    return start+min(range(len(values)),key=lambda i:values[i])
if legacy:
    regions=[[0,0,425,400],[425,0,840,400],[840,0,1254,478],[100,488,365,865],[490,488,780,865],[920,478,1160,868],[0,868,413,1254],[413,868,920,1254],[920,868,1254,1254]]
    regions=[tuple(round(v/1254*(w if i%2==0 else h)) for i,v in enumerate(r)) for r in regions]
else:
    ys=[0,gap('y',int(h*.29),int(h*.42),(0,0,w,h)),gap('y',int(h*.62),int(h*.76),(0,0,w,h)),h]
    regions=[]
    for y0,y1 in zip(ys,ys[1:]):
        xs=[0,gap('x',int(w*.28),int(w*.40),(0,y0,w,y1)),gap('x',int(w*.61),int(w*.74),(0,y0,w,y1)),w]
        regions.extend((x0,y0,x1,y1) for x0,x1 in zip(xs,xs[1:]))
names=['head','blink','torso','armLeft','armRight','legLeft','tail','backAccessory','legRight']
destination.mkdir(parents=True,exist_ok=True)
layers={}
for name,region in zip(names,regions):
    cell=im.crop(region); mask=cell.getchannel('A').point(lambda a:255 if a>=64 else 0)
    box=mask.getbbox()
    if box is None or sum(mask.histogram()[1:]) < cell.width*cell.height*.004:
        if name not in ('tail','backAccessory'): raise ValueError('Missing required part: '+name)
        continue
    if not legacy and (box[0]<2 or box[1]<2 or box[2]>cell.width-2 or box[3]>cell.height-2):
        raise ValueError('Part crosses atlas boundary: '+name)
    # Keep a small alpha margin, preserving the generated PNG instead of repainting.
    box=(max(0,box[0]-2),max(0,box[1]-2),min(cell.width,box[2]+2),min(cell.height,box[3]+2))
    sprite=cell.crop(box); sprite.save(destination/(name+'.png'))
    layers[name]={'file':name+'.png','width':sprite.width,'height':sprite.height}
if abs(layers['head']['width']/layers['head']['height']-layers['blink']['width']/layers['blink']['height'])>.12:
    raise ValueError('Blink head does not match open head')
(destination/'manifest.json').write_text(json.dumps({'version':1,'rig':'front-cat-v1','canvas':[600,740],'layers':layers,'danceLoops':3,'loopSeconds':4.0536679401},ensure_ascii=False),encoding='utf8')
print('ANIMATION_PACK_READY')
