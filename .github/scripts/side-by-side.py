#!/usr/bin/env python3
"""Puts each real-app screenshot next to its mockup phone, at the same width.

Usage: side-by-side.py <smoke-dir> <mockup-png> <out-dir>

For every screen with smoke/clean-<screen>.png writes <out-dir>/compare-<screen>.png
(mockup on the left, app on the right, under a small "Mockup" / "App" header),
and compare-today-dark.png from clean-today-dark.png (the phone in dark mode:
it must look the same as the light one). Missing files are skipped with a
warning; this script never exits non-zero for missing or unreadable inputs,
because the screenshots are evidence only.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

# The mockup, docs/design/clean-plus.png, is 1360 x 1060 (the HTML body, 1px per
# CSS px) with three 390 x 844 phones side by side. Measured with Pillow by
# finding the runs of pure white (255,255,255) pixels along a row through the
# middle of the image (x: 55-444, 485-874, 915-1304) and down a column through
# a phone (y: 136-979, 844 rows). Re-measure if the mockup is redrawn.
PHONE_W = 390
PHONE_H = 844
PHONE_TOP = 136
MOCKUP_CROPS = {
    'today': 55,   # left edge of the phone
    'food': 485,
    'walk': 915,
    # The mockup has no detail screen (steps detail): no compare-detail.png is made.
}

SHOT_W = 780   # both images are scaled to this width
GAP = 40       # between the two images, and around them
HEADER_H = 48
BG = (243, 244, 246)
INK = (17, 24, 39)


def font(size):
    for name in ('arial.ttf', 'DejaVuSans.ttf', 'LiberationSans-Regular.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def scaled(img, width):
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def compare(mockup, app_path, left_x, out_path):
    left = scaled(mockup.crop((left_x, PHONE_TOP, left_x + PHONE_W, PHONE_TOP + PHONE_H)), SHOT_W)
    right = scaled(Image.open(app_path).convert('RGB'), SHOT_W)
    height = HEADER_H + max(left.height, right.height) + GAP
    canvas = Image.new('RGB', (GAP * 3 + SHOT_W * 2, height), BG)
    draw = ImageDraw.Draw(canvas)
    f = font(26)
    for i, (label, img) in enumerate((('Mockup', left), ('App', right))):
        x = GAP + i * (SHOT_W + GAP)
        draw.text((x, HEADER_H // 2), label, fill=INK, font=f, anchor='lm')
        canvas.paste(img, (x, HEADER_H))
    canvas.save(out_path)
    print(f'Wrote {out_path}')


def main():
    if len(sys.argv) != 4:
        print('usage: side-by-side.py <smoke-dir> <mockup-png> <out-dir>')
        return
    smoke, mockup_png, out_dir = sys.argv[1:]
    try:
        mockup = Image.open(mockup_png).convert('RGB')
    except Exception as e:  # evidence only: never fail
        print(f'warning: cannot read the mockup {mockup_png}: {e}')
        return
    os.makedirs(out_dir, exist_ok=True)
    jobs = [(s, f'clean-{s}.png', f'compare-{s}.png') for s in MOCKUP_CROPS]
    jobs.append(('today', 'clean-today-dark.png', 'compare-today-dark.png'))
    for screen, shot, out in jobs:
        path = os.path.join(smoke, shot)
        if not os.path.isfile(path):
            print(f'warning: {path} is missing, skipping {out}')
            continue
        try:
            compare(mockup, path, MOCKUP_CROPS[screen], os.path.join(out_dir, out))
        except Exception as e:
            print(f'warning: {out} failed: {e}')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'warning: {e}')
