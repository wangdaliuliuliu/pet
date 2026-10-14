"""Decode/validate photos; strip metadata and bound dimensions for storage/vision."""
from PIL import Image, ImageOps
import sys
Image.MAX_IMAGE_PIXELS=40000000
with Image.open(sys.argv[1]) as source:
    if source.width*source.height>40000000: raise ValueError('Photo too large')
    rgba=ImageOps.exif_transpose(source).convert('RGBA')
    image=Image.new('RGBA',rgba.size,'white');image.alpha_composite(rgba);image=image.convert('RGB');image.thumbnail((1600,1600))
    image.save(sys.argv[2],format='JPEG',quality=90)
