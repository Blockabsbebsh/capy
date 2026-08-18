#!/usr/bin/env python3
"""Offline: the drawn icon art in assets/icons/src/ -> the PNGs the game loads.

    pip install pillow numpy scipy
    python3 tools/icons.py            # rewrite assets/icons/*.png
    python3 tools/icons.py --check    # fail if a PNG no longer matches its source

Run it when the art changes or the size does; the game never runs this. It is
the same shape of thing as tools/glb2json.mjs — source of truth in assets/, a
converted artefact next to it — and it is Python rather than Node because the
job is background removal and palette quantisation, neither of which is worth
hand-rolling.

The art arrives as flat-backed cartoon drawings: a subject with a heavy ink
outline, sitting on a pastel wash, usually with a soft drop shadow under it.

CUTTING THE BACKGROUND OUT IS A FLOOD FILL OVER FLATNESS, NOT OVER COLOUR.
Matching the backdrop's colour and pulling every pixel near it is the obvious
approach and it is wrong twice over: it leaves the drop shadow behind as a grey
smear, and on a light drawing it eats the subject. What separates backdrop from
subject here is not hue, it is the EDGE. A wash — the paper, its gradient, a
blurred shadow — changes by a level or two per pixel; an ink outline jumps
forty. So the fill is over pixels whose local gradient is low, walled in by the
outline, and the shadow is swallowed on the way because a blur is flat.

Three things the flood fill cannot know on its own, declared per icon in ART:

  holes   a pocket enclosed by the art but showing the backdrop THROUGH it —
          the gaps inside the chain links. Matched on the backdrop's own
          colour, so nothing that was drawn can be caught by it.
  frame   art drawn AROUND the icon rather than as part of it. `reach` came
          with a ring and an outer glow; the ring is the one shape here that
          runs off the edge of the picture, which is what identifies it. Its
          antialiased edge survives as hairline arcs, so anything left without
          a solid core goes with it — a whisker has one, a hairline does not.
  shadow  a blur whose own outer ramp got sharpened into a wall — a resize
          before the art reached here is enough — so the fill never got in and
          the shadow shipped. Steps across a wall that thin. See the code.

Everything else is uniform on purpose: same canvas, same margin, so the rail
does not read as a ragged column. The size is a display decision and lives in
SIZE below; see CLAUDE.md for what it has to clear.
"""
import io, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(HERE, '..', 'assets', 'icons', 'src')
DST  = os.path.join(HERE, '..', 'assets', 'icons')

# The output is square and every icon is fitted to the same box inside it, so a
# tall one and a wide one carry the same weight in the rail. 192 is drawn at 18px
# on a phone rail and 46px on a draft card, so it still has headroom at 3x DPR on
# the largest of those — the icons are downscaled everywhere and never stretched.
# COLORS is what keeps each file to 3-6KB; the art is flat, so a 32-entry palette
# is indistinguishable from truecolour here. Raising SIZE is the expensive knob:
# 256 doubles every file for detail nothing on screen can show.
SIZE, MARGIN, COLORS = 192, 0.05, 32

# Per-icon exceptions. Everything not named here is the plain case.
ART = {
    'chain': {'holes': True},           # the gaps inside the two links
    'reach': {'frame': True, 'shadow': 60},  # a ring, an outer glow and a sealed-in shadow
}


def barrier(rgb, g=14):
    """Passable where the picture is flat: max |delta| against the 4 neighbours."""
    a = rgb.astype(np.int16)
    d = np.zeros(a.shape[:2], np.int16)
    for ax, sh in ((0, 1), (0, -1), (1, 1), (1, -1)):
        d = np.maximum(d, np.abs(a - np.roll(a, sh, axis=ax)).max(2))
    return d < g


def ids(m):
    return {int(v) for v in np.unique(m) if v}


def edge_ids(lab):
    return ids(lab[0]) | ids(lab[-1]) | ids(lab[:, 0]) | ids(lab[:, -1])


def cut(rgb, holes=False, frame=False, shadow=0):
    """RGB -> boolean keep mask. See the module docstring for why it works."""
    h, w = rgb.shape[:2]
    lab, n = ndimage.label(barrier(rgb))
    outer = edge_ids(lab)

    bg = np.zeros((h, w), bool)
    for l in outer:
        bg |= (lab == l)
    if not bg.any():
        raise SystemExit('no backdrop found: the art must sit on a flat wash')
    bgcol = np.median(rgb[bg][::97], 0)
    tone = lambda m: np.abs(np.median(rgb[m][::13], 0) - bgcol).max()

    if holes:
        for l in range(1, n + 1):
            if l in outer:
                continue
            m = (lab == l)
            if m.sum() >= 64 and tone(m) <= 22:
                bg |= m

    if shadow:
        # A blur is flat and should have been swallowed with the wash. This one
        # was not: `reach`'s art was resized before it got here, which sharpened
        # the shadow's own outer ramp into a wall a pixel or two thick, sealing
        # the blur off behind it. So: step across a wall that thin, and take
        # what is on the other side if it is still the wash's own colour, until
        # nothing more gives. The two conditions are both load-bearing —
        # touching the wash is what spares every fill that has an ink outline
        # between it and the backdrop (the head here is 66 off the wash, which
        # no colour threshold alone could tell from the shadow's 55), and the
        # colour is what spares an unoutlined shape that does touch it. Which is
        # why this is opt-in per icon and not the default.
        seen = set(outer)
        while True:
            reach = ndimage.binary_dilation(bg, iterations=3) & ~bg
            fresh = {l for l in ids(lab[reach]) if l not in seen}
            if not fresh:
                break
            seen |= fresh
            for l in fresh:
                m = (lab == l)
                if tone(m) <= shadow:
                    bg |= m

    # the wall itself keeps a pixel or two of backdrop standing on its outside
    bg = ndimage.binary_dilation(bg, iterations=2)
    keep = ~bg

    if frame:
        lab2, _ = ndimage.label(keep)
        for l in edge_ids(lab2):
            keep &= (lab2 != l)
        core = ndimage.binary_erosion(keep, iterations=4)
        lab3, n3 = ndimage.label(keep)
        solid = np.zeros((h, w), bool)
        for l in range(1, n3 + 1):
            m = (lab3 == l)
            if (m & core).any():
                solid |= m
        keep = solid
    return keep


def fit(rgb, keep):
    """Crop to the art, drop it in the middle of a square, resize. Premultiplied
    throughout: resizing straight RGBA drags the backdrop colour still sitting in
    the transparent pixels into every edge as a halo."""
    ys, xs = np.where(keep)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    art = rgb[y0:y1, x0:x1].astype(np.float64)
    a = keep[y0:y1, x0:x1].astype(np.float64)
    h, w = a.shape

    side = int(max(h, w) / (1 - 2 * MARGIN))
    box = np.zeros((side, side, 4))
    oy, ox = (side - h) // 2, (side - w) // 2
    box[oy:oy + h, ox:ox + w, :3] = art * a[..., None]     # premultiply
    box[oy:oy + h, ox:ox + w, 3] = a * 255

    sm = np.asarray(Image.fromarray(box.astype(np.uint8), 'RGBA')
                    .resize((SIZE, SIZE), Image.LANCZOS)).astype(np.float64)
    al = sm[..., 3:4]
    out = np.concatenate([np.where(al > 0, sm[..., :3] / np.maximum(al, 1) * 255, 0),
                          al], 2)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def main():
    check = '--check' in sys.argv
    total, stale = 0, []
    for name in sorted(os.listdir(SRC)):
        if not name.endswith('.jpg'):
            continue
        icon = name[:-4]
        rgb = np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB'))
        keep = cut(rgb, **ART.get(icon, {}))
        # FASTOCTREE is the one PIL quantiser that carries alpha through
        im = fit(rgb, keep).quantize(colors=COLORS, method=Image.FASTOCTREE)
        buf = io.BytesIO()
        im.save(buf, 'PNG', optimize=True)
        blob = buf.getvalue()

        out = os.path.join(DST, icon + '.png')
        on_disk = open(out, 'rb').read() if os.path.exists(out) else None
        if blob != on_disk:
            stale.append(icon)
        if not check:
            open(out, 'wb').write(blob)
        total += len(blob)
        print(f'  {icon:11s} {rgb.shape[1]}x{rgb.shape[0]:<4d} -> {SIZE}px  '
              f'{len(blob) / 1024:5.1f} KB  {100 * keep.mean():4.1f}% kept'
              f'{"  STALE" if check and blob != on_disk else ""}')
    print(f'  {"":11s} {"":13s}    total {total / 1024:5.1f} KB')
    if check and stale:
        print(f'\n{len(stale)} icon(s) do not match the source: {", ".join(stale)}')
        print('run tools/icons.py to rebuild them')
        sys.exit(1)


if __name__ == '__main__':
    main()
