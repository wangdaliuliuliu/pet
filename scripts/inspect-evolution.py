"""Validate generated assets. This script does not draw or modify the character."""
import sys
from PIL import Image

with Image.open(sys.argv[1]) as source:
    image = source.convert('RGBA')
    width, height = image.size
    if width < 512 or height < 512:
        sys.exit(1)
    corners = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    if sys.argv[2] == 'green':
        if not all((lambda c: c[1] > 180 and c[1] > c[0] * 2 and c[1] > c[2] * 2)(image.getpixel(p)) for p in corners):
            sys.exit(1)
    else:
        alpha = image.getchannel('A')
        hist = alpha.histogram()
        pixels = width * height
        # Generated PNGs may have a nearly opaque subject (e.g. 249) rather than
        # large areas exactly equal to 255. Keep rejecting ghost-like subjects.
        if hist[0] < pixels * 0.1 or sum(hist[240:]) < pixels * 0.1 or not all(alpha.getpixel(p) < 10 for p in corners):
            sys.exit(1)
