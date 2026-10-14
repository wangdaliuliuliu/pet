"""Small image-edit CLI for the optional provider; never echoes keys or provider errors."""
import argparse, base64, io, os, sys
from contextlib import ExitStack
from pathlib import Path

def main():
    from openai import OpenAI
    from PIL import Image
    p=argparse.ArgumentParser()
    p.add_argument('action',choices=['edit'])
    for name in ['model','prompt-file','out']:p.add_argument('--'+name,required=True)
    p.add_argument('--image',action='append',required=True)
    p.add_argument('--size',default='1024x1024')
    p.add_argument('--quality',default='high')
    p.add_argument('--output-format',default='png')
    a=p.parse_args()
    if not os.getenv('OPENAI_API_KEY') or not os.getenv('OPENAI_BASE_URL'):raise ValueError('Missing image provider configuration')
    client=OpenAI(api_key=os.environ['OPENAI_API_KEY'],base_url=os.environ['OPENAI_BASE_URL'],timeout=600,max_retries=0)
    with ExitStack() as stack:
        images=[stack.enter_context(open(file,'rb')) for file in a.image]
        result=client.images.edit(model=a.model,image=images,prompt=Path(a.prompt_file).read_text(encoding='utf8'),size=a.size,quality=a.quality,output_format=a.output_format)
    if not result.data or not result.data[0].b64_json:raise ValueError('Provider must return base64 image content')
    content=base64.b64decode(result.data[0].b64_json,validate=True)
    if len(content)>32*1024*1024:raise ValueError('Image exceeds size limit')
    with Image.open(io.BytesIO(content)) as image:image.verify()
    dest=Path(a.out);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(content)
    print('IMAGE_SAVED')

if __name__=='__main__':
    try:main()
    except Exception:
        print('Image editing failed; check provider configuration and quota.',file=sys.stderr)
        sys.exit(1)
