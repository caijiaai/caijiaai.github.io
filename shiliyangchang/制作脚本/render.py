# -*- coding: utf-8 -*-
"""《租界百年》第7集《十里洋场》—— 无旁白画面渲染（白天 → 夜里）"""
import math, os, sys, random, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import script_data as SD

W, H, FPS = 1080, 1920, 24
ASSET = os.environ.get("ASSET_DIR", "/home/claude/src_assets")
WORK = os.environ.get("WORK_DIR", "/home/claude/work")
PAPER = (239, 230, 210)
NIGHT = (22, 27, 46)
INK = (31, 53, 80)
LIGHT = (238, 230, 212)
RED = (184, 50, 42)
GOLD = (238, 186, 92)
NEON_P = (255, 92, 170)
NEON_C = (90, 230, 255)
SEGS, TOTAL = SD.build()
NFRAMES = int(round(TOTAL * FPS))
# 每镜的“天色”：0 白天纸面 → 1 夜色
NIGHTNESS = [0.0, 0.0, 0.0, 0.1, 0.35, 0.6, 0.85, 1.0, 1.0]

SANS_B = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
SERIF_B = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
SERIF_K = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Black.ttc"


@functools.lru_cache(None)
def font(path, size):
    return ImageFont.truetype(path, size, index=2)  # SC


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def ease(x):
    x = clamp(x); return x * x * (3 - 2 * x)


def ease_out(x):
    x = clamp(x); return 1 - (1 - x) ** 3


def ease_back(x):
    x = clamp(x); c1 = 1.5; c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def fade(t, t0, d=0.45):
    return ease((t - t0) / d)


def win(t, a, b, d=0.45):
    """a 时淡入、b 时淡出"""
    return fade(t, a, d) * (1 - fade(t, b, d))


def ct(si, cj):
    return SEGS[si]['chunks'][cj]['start']


def cend(si, cj):
    return SEGS[si]['chunks'][cj]['end']


def mix(c1, c2, k):
    return tuple(int(a + (b - a) * k) for a, b in zip(c1, c2))


# ---------------------------------------------------------------- 底图
@functools.lru_cache(None)
def background(n):
    """n: 0 纸面白天 … 1 夜色；带纸纹与暗角"""
    rng = np.random.default_rng(7)
    h, w = H, W
    stops = [(0.0, PAPER), (0.35, (222, 184, 140)), (0.6, (78, 62, 96)), (0.85, (36, 36, 64)), (1.0, NIGHT)]
    for (n0, c0), (n1, c1) in zip(stops, stops[1:]):
        if n0 <= n <= n1:
            k = (n - n0) / (n1 - n0)
            col = np.array(c0, np.float32) * (1 - k) + np.array(c1, np.float32) * k
            break
    base = np.ones((h, w, 3), np.float32) * col
    low = np.array(Image.fromarray(rng.normal(0, 1, (h // 60 + 2, w // 60 + 2)).astype(np.float32)).resize((w, h), Image.BICUBIC))
    mid = np.array(Image.fromarray(rng.normal(0, 1, (h // 8 + 2, w // 8 + 2)).astype(np.float32)).resize((w, h), Image.BICUBIC))
    grain = rng.normal(0, 1, (h, w)).astype(np.float32)
    amp = 1 - 0.55 * n
    shade = (low * 5 + mid * 2.2 + grain * 2.0) * amp
    yy, xx = np.mgrid[0:h, 0:w]
    vig = ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2
    out = base + shade[..., None] - (vig * (10 + 14 * n))[..., None]
    if n > 0.3:  # 夜里：顶部一点暖色天光（城市灯火反照）
        glow = np.exp(-((yy - h * 0.05) / (h * 0.35)) ** 2) * 18 * n
        out[..., 0] += glow; out[..., 1] += glow * 0.55; out[..., 2] += glow * 0.3
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert("RGBA")


def bg(si):
    return background(NIGHTNESS[si]).copy()


def fg(si):
    """标题/标注文字颜色随天色切换"""
    return INK if NIGHTNESS[si] < 0.5 else LIGHT


def with_alpha(img, a):
    if a >= 0.999:
        return img
    arr = np.array(img)
    arr[..., 3] = (arr[..., 3].astype(np.float32) * max(a, 0)).astype(np.uint8)
    return Image.fromarray(arr)


def put(frame, img, x, y, a=1.0, anchor="lt"):
    if a <= 0.003:
        return
    w, h = img.size
    if anchor[0] == "m": x -= w / 2
    if anchor[0] == "r": x -= w
    if anchor[1] == "m": y -= h / 2
    if anchor[1] == "b": y -= h
    x, y = int(round(x)), int(round(y))
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(w, W - x), min(h, H - y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    src_ = img.crop((sx0, sy0, sx1, sy1)) if (sx0, sy0, sx1, sy1) != (0, 0, w, h) else img
    frame.alpha_composite(with_alpha(src_, a), dest=(x + sx0, y + sy0))


@functools.lru_cache(None)
def text_img(text, path, size, color=INK, stroke=0, stroke_color=(0, 0, 0), alpha=255):
    f = font(path, size)
    bb = f.getbbox(text, stroke_width=stroke)
    pad = 6 + stroke
    w = bb[2] - bb[0] + pad * 2; h = bb[3] - bb[1] + pad * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((pad - bb[0], pad - bb[1]), text, font=f, fill=color + (alpha,),
                            stroke_width=stroke, stroke_fill=stroke_color + (alpha,))
    return im


@functools.lru_cache(None)
def rich_line(parts, path, size):
    ims = [text_img(t, path, size, c) for t, c in parts]
    w = sum(i.size[0] for i in ims) - 12 * (len(ims) - 1)
    h = max(i.size[1] for i in ims)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = 0
    f = font(path, size)
    for (t, c), i in zip(parts, ims):
        bb = f.getbbox(t)
        out.alpha_composite(i, (x, max(0, bb[1] - f.getbbox("国")[1])))
        x += i.size[0] - 12
    return out


@functools.lru_cache(None)
def card(parts, size=44, path=SERIF_B, bar=True, padx=30, pady=16):
    """字卡：浅纸条 + 墨线框 + 朱红左条（夜里同样用浅纸色，保证可读）"""
    if isinstance(parts, str):
        parts = ((parts, INK),)
    t = rich_line(parts, path, size)
    w = t.size[0] + padx * 2 + (14 if bar else 0)
    h = t.size[1] + pady * 2
    im = Image.new("RGBA", (w + 12, h + 12), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((8, 9, w + 4, h + 5), 10, fill=(20, 15, 10, 90))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((2, 2, w, h), 10, fill=(250, 245, 233, 245), outline=INK + (255,), width=2)
    if bar:
        d.rectangle((10, 12, 20, h - 10), fill=RED + (255,))
    im.alpha_composite(t, (2 + padx + (14 if bar else 0), 2 + pady))
    return im


def card_in(f, parts, x, y, t, t0, size=44, anchor="lt", t1=None, **kw):
    a = fade(t, t0)
    if t1 is not None:
        a *= 1 - fade(t, t1)
    put(f, card(parts, size, **kw), x, y + (1 - fade(t, t0)) * 20, a, anchor)


@functools.lru_cache(None)
def label(text, dark=False):
    """照片标注：朱红小方块 + 文字（只标地点/实物名，不标年份）"""
    col = LIGHT if dark else INK
    t = text_img(text, SERIF_B, 36, col)
    im = Image.new("RGBA", (t.size[0] + 40, t.size[1]), (0, 0, 0, 0))
    ImageDraw.Draw(im).rectangle((4, t.size[1] // 2 - 9, 22, t.size[1] // 2 + 9), fill=RED + (255,))
    im.alpha_composite(t, (32, 0))
    return im


@functools.lru_cache(None)
def shiyi_tag():
    t = text_img("示意", SERIF_B, 32, RED)
    im = Image.new("RGBA", (t.size[0] + 20, t.size[1] + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((1, 1, im.size[0] - 2, im.size[1] - 2), fill=(250, 245, 233, 235), outline=RED + (255,), width=3)
    im.alpha_composite(t, (10, 4))
    return im


@functools.lru_cache(None)
def seal(text, size=120, path=SERIF_K, rot=0.0, seed=1, pad=None):
    f = font(path, int(size * 0.72))
    pad = pad if pad is not None else int(size * 0.14)
    bb = f.getbbox(text)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    w = max(size, tw + pad * 2); h = size
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), int(size * 0.1), fill=RED + (255,))
    d.rounded_rectangle((5, 5, w - 6, h - 6), int(size * 0.08), outline=(250, 240, 225, 255), width=max(2, size // 40))
    d.text(((w - tw) / 2 - bb[0], (h - th) / 2 - bb[1]), text, font=f, fill=(250, 240, 225, 255))
    rng = np.random.default_rng(seed)
    arr = np.array(im)
    n = rng.random(arr.shape[:2])
    blot = np.array(Image.fromarray((rng.random((h // 6 + 1, w // 6 + 1)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)) / 255
    keep = (n > 0.08) & (blot > 0.18)
    arr[..., 3] = (arr[..., 3] * np.where(keep, 1.0, 0.25)).astype(np.uint8)
    im = Image.fromarray(arr)
    if rot:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    return im


@functools.lru_cache(None)
def shadow(w, h, r=14, a=90):
    im = Image.new("RGBA", (w + 4 * r, h + 4 * r), (0, 0, 0, 0))
    ImageDraw.Draw(im).rectangle((2 * r, 2 * r + 6, 2 * r + w, 2 * r + h + 6), fill=(10, 8, 5, a))
    return im.filter(ImageFilter.GaussianBlur(r))


@functools.lru_cache(None)
def neon_text(text, size, color, path=SERIF_K):
    """霓虹字（图形字卡，不冒充照片）"""
    core = text_img(text, path, size, (255, 250, 245))
    pad = 40
    im = Image.new("RGBA", (core.size[0] + pad * 2, core.size[1] + pad * 2), (0, 0, 0, 0))
    col = text_img(text, path, size, color, stroke=3, stroke_color=color)
    g1 = Image.new("RGBA", im.size, (0, 0, 0, 0)); g1.alpha_composite(col, (pad - 3, pad - 3))
    im.alpha_composite(g1.filter(ImageFilter.GaussianBlur(18)))
    im.alpha_composite(g1.filter(ImageFilter.GaussianBlur(6)))
    im.alpha_composite(g1)
    im.alpha_composite(core, (pad, pad))
    return im


def heading(f, si, text, a=1.0):
    c = fg(si)
    put(f, text_img("租界百年 · 十里洋场", SERIF_B, 34, mix(c, (128, 118, 100), 0.45)), 540, 150, a, "mt")
    t = text_img(text, SERIF_K, 68, c)
    put(f, t, 540, 205, a, "mt")
    put(f, Image.new("RGBA", (t.size[0] + 60, 6), RED + (255,)), 540, 300, a * 0.9, "mt")


# ---------------------------------------------------------------- 照片
@functools.lru_cache(None)
def src(name):
    return Image.open(os.path.join(ASSET, name)).convert("RGB")


def kenburns(name, out_w, out_h, z, cx, cy, tint=None):
    """z>=1；(cx,cy) 为原图坐标的取景中心。只做插值缩放/平移，不做修复重绘"""
    im = src(name)
    sw, sh = im.size
    aspect = out_w / out_h
    bw = sw / z; bh = bw / aspect
    if bh > sh / z * 1.0001 and bh > sh:
        bh = sh / z; bw = bh * aspect
    if bh > sh:
        bh = sh; bw = bh * aspect
    if bw > sw:
        bw = sw; bh = bw / aspect
    x0 = clamp(cx - bw / 2, 0, sw - bw); y0 = clamp(cy - bh / 2, 0, sh - bh)
    out = im.resize((out_w, out_h), Image.BICUBIC, box=(x0, y0, x0 + bw, y0 + bh)).convert("RGBA")
    return out


def mounted(frame, img, x, y, a=1.0, border=10, rot=0.0):
    """照片：白边 + 投影（明信片式）"""
    w, h = img.size
    m = Image.new("RGBA", (w + border * 2, h + border * 2), (250, 247, 238, 255))
    m.paste(img, (border, border))
    if rot:
        m = m.rotate(rot, resample=Image.BICUBIC, expand=True)
        cx, cy = x + w / 2, y + h / 2
        put(frame, shadow(m.size[0], m.size[1]), cx - m.size[0] / 2 - 28, cy - m.size[1] / 2 - 28, a)
        put(frame, m, cx, cy, a, "mm")
        return
    put(frame, shadow(w + border * 2, h + border * 2), x - border - 28, y - border - 28, a)
    put(frame, m, x - border, y - border, a)


def photo(f, si, name, x, y, w, h, t, t0, z0, z1, c0, c1, dur, a=1.0, lab=None, rot=0.0, border=10):
    u = ease((t - t0) / dur)
    z = z0 + (z1 - z0) * u
    cx = c0[0] + (c1[0] - c0[0]) * u; cy = c0[1] + (c1[1] - c0[1]) * u
    img = kenburns(name, w, h, z, cx, cy)
    mounted(f, img, x, y, a, border=border, rot=rot)
    if lab:
        put(f, label(lab, NIGHTNESS[si] >= 0.5), x - 6, y + h + 28 + (abs(rot) * 6), a)


# ---------------------------------------------------------------- 图形：跑道示意地图
MAP_W, MAP_H = 1000, 860
TRACK = (175, 215, 825, 655)  # 跑道外框（跑道形：两头半圆）


def stadium_pts(box, n=240, inset=0):
    x0, y0, x1, y1 = box
    x0 += inset; y0 += inset; x1 -= inset; y1 -= inset
    r = (y1 - y0) / 2
    cxl, cxr, cy = x0 + r, x1 - r, (y0 + y1) / 2
    L = 2 * (cxr - cxl) + 2 * math.pi * r
    pts = []
    for i in range(n + 1):
        s = L * i / n
        if s < cxr - cxl:                      # 上边 左→右
            pts.append((cxl + s, y0))
        elif s < cxr - cxl + math.pi * r:      # 右半圆
            a = (s - (cxr - cxl)) / r - math.pi / 2
            pts.append((cxr + r * math.cos(a), cy + r * math.sin(a)))
        elif s < 2 * (cxr - cxl) + math.pi * r:  # 下边 右→左
            pts.append((cxr - (s - (cxr - cxl) - math.pi * r), y1))
        else:                                  # 左半圆
            a = (s - 2 * (cxr - cxl) - math.pi * r) / r + math.pi / 2
            pts.append((cxl + r * math.cos(a), cy + r * math.sin(a)))
    return pts


@functools.lru_cache(None)
def city_map(night=0.0):
    """今日人民广场一带示意：城市街区 + 公园/广场（不含农田村落，纯城市口径）"""
    w, h = MAP_W, MAP_H
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 16, fill=(228, 224, 214, 255), outline=INK + (255,), width=2)
    rng = random.Random(11)
    # 街区（城市楼宇块）
    road = 26
    xs = [0, 120, 260, 400, 540, 690, 830, 1000]
    ys = [0, 110, 230, 370, 500, 630, 760, 860]
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            bx0, by0, bx1, by1 = xs[i] + road / 2, ys[j] + road / 2, xs[i + 1] - road / 2, ys[j + 1] - road / 2
            g = rng.randint(186, 206)
            d.rectangle((bx0, by0, bx1, by1), fill=(g, g - 4, g - 12, 255))
            for _ in range(rng.randint(2, 5)):  # 楼栋
                ww = rng.uniform(18, 50); hh = rng.uniform(18, 46)
                px = rng.uniform(bx0 + 4, max(bx0 + 5, bx1 - ww - 4)); py = rng.uniform(by0 + 4, max(by0 + 5, by1 - hh - 4))
                gg = rng.randint(150, 176)
                d.rectangle((px, py, px + ww, py + hh), fill=(gg, gg - 3, gg - 10, 255))
    # 公园 + 广场 合起来的大地块（盖掉中间街区）
    x0, y0, x1, y1 = TRACK
    pad = 30
    d.rounded_rectangle((x0 - pad, y0 - pad, x1 + pad, y1 + pad), 60, fill=(226, 220, 205, 255))
    mid = (y0 + y1) / 2 + 10
    # 北：人民公园（绿）
    park = Image.new("L", (w, h), 0); pd = ImageDraw.Draw(park)
    pd.polygon(stadium_pts(TRACK, 200, 6), fill=255)
    pd.rectangle((0, mid - 14, w, h), fill=0)
    gl = Image.new("RGBA", (w, h), (126, 158, 112, 255))
    im.paste(gl, (0, 0), park)
    for _ in range(70):
        tx = rng.uniform(x0 + 20, x1 - 20); ty = rng.uniform(y0 + 15, mid - 30); rr = rng.uniform(10, 22)
        if Image.Image.getpixel(park, (int(tx), int(ty))) > 0:
            d.ellipse((tx - rr, ty - rr, tx + rr, ty + rr), fill=(96, 132, 90, 255))
    # 南：人民广场（铺地 + 中央圆）
    sq = Image.new("L", (w, h), 0); sd = ImageDraw.Draw(sq)
    sd.polygon(stadium_pts(TRACK, 200, 6), fill=255)
    sd.rectangle((0, 0, w, mid + 14), fill=0)
    im.paste(Image.new("RGBA", (w, h), (214, 208, 192, 255)), (0, 0), sq)
    cxm = (x0 + x1) / 2; cym = (mid + y1) / 2 + 8
    d.ellipse((cxm - 70, cym - 50, cxm + 70, cym + 50), outline=(170, 160, 140, 255), width=6)
    d.rectangle((cxm - 220, cym - 6, cxm + 220, cym + 6), fill=(190, 182, 166, 255))
    # 横穿的大道
    d.rectangle((0, mid - 14, w, mid + 14), fill=(246, 242, 232, 255))
    if night:
        arr = np.array(im).astype(np.float32)
        arr[..., :3] *= (1 - 0.15 * night)
        im = Image.fromarray(arr.astype(np.uint8))
    return im


def draw_track(panel, p, glow=1.0, width=12, color=RED):
    """沿跑道形描线，p: 0~1 进度"""
    if p <= 0:
        return
    pts = stadium_pts(TRACK, 240, -4)
    k = max(2, int(len(pts) * clamp(p)))
    lay = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).line(pts[:k], fill=color + (255,), width=width + 10, joint="curve")
    panel.alpha_composite(with_alpha(lay.filter(ImageFilter.GaussianBlur(10)), 0.55 * glow))
    ImageDraw.Draw(panel).line(pts[:k], fill=color + (255,), width=width, joint="curve")
    x, y = pts[k - 1]
    if p < 1:
        ImageDraw.Draw(panel).ellipse((x - 13, y - 13, x + 13, y + 13), fill=color + (255,))


def map_labels(panel, a1, a2):
    x0, y0, x1, y1 = TRACK
    mid = (y0 + y1) / 2 + 10
    if a1 > 0:
        im = text_img("人民公园", SERIF_K, 46, (255, 255, 255), stroke=4, stroke_color=(60, 90, 55))
        put_on(panel, im, (x0 + x1) / 2, (y0 + mid) / 2 - 10, a1)
    if a2 > 0:
        im = text_img("人民广场", SERIF_K, 46, INK, stroke=4, stroke_color=(240, 236, 226))
        put_on(panel, im, (x0 + x1) / 2, (mid + y1) / 2 - 62, a2)


def put_on(panel, img, cx, cy, a):
    w, h = img.size
    panel.alpha_composite(with_alpha(img, a), (int(cx - w / 2), int(cy - h / 2)))


# ---------------------------------------------------------------- 镜 1 钩子
def scene1(t):
    si = 0
    f = bg(si)
    s0 = SEGS[0]['start']
    r = t - s0
    put(f, text_img("租界百年", SERIF_B, 40, (110, 100, 85)), 540, 150, 1, "mt")
    px, py = 40, 300
    old_a = win(t, 2.3, ct(0, 1) - 0.6, 0.5)        # 第 3 秒内：退回老跑马场
    title_on = ct(0, 2) - 0.4
    map_a = 1 - old_a
    if t >= title_on:
        map_a *= 1 - fade(t, title_on, 0.5)
    if map_a > 0:
        panel = city_map().copy()
        tr = ease((r - 0.35) / 1.7)                  # 0.35~2.05 s 描出跑道轮廓
        if t > ct(0, 1) - 0.6:                       # 第二块：再描一遍 + 标出两块地
            tr = 1.0
        pulse = 1.0
        if t > ct(0, 1) + 3.5:
            pulse = 0.75 + 0.25 * math.sin((t - ct(0, 1)) * 3.0)
        draw_track(panel, tr, pulse)
        map_labels(panel, fade(t, ct(0, 1) + 0.5), fade(t, ct(0, 1) + 1.3))
        put(f, shadow(MAP_W, MAP_H), px - 28, py - 28, map_a)
        put(f, panel, px, py, map_a)
        put(f, shiyi_tag(), px + MAP_W - 16, py + 16, map_a, "rt")
        put(f, label("人民广场（今）"), px - 6, py + MAP_H + 26, map_a)
    if old_a > 0:
        u = clamp((t - 2.3) / 6)
        img = kenburns("racecourse_park_hotel.jpg", 1000, 648, 1.0 + 0.08 * ease(u), 420, 300 + 20 * u)
        mounted(f, img, px, py + 100, old_a)
        put(f, label("跑马厅"), px - 6, py + 100 + 648 + 26, old_a)
    # 标题：白天 / 夜里
    if t >= title_on - 0.1:
        a = fade(t, title_on, 0.6)
        put(f, title_board(t - title_on), 540, 380, a, "mt")
        b = fade(t, ct(0, 3) - 0.2, 0.6)
        put(f, text_img("第七集", SERIF_B, 52, (110, 100, 85)), 540, 1080, b, "mt")
        put(f, text_img("《十里洋场》", SERIF_K, 112, INK), 540, 1150 + (1 - b) * 30, b, "mt")
        put(f, Image.new("RGBA", (460, 6), RED + (255,)), 540, 1310, b, "mt")
    return f


def title_board(r):
    """白天看马（左，纸色）| 夜里逛街（右，夜色+霓虹）"""
    w, h = 1000, 620
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    left = Image.new("RGBA", (w // 2, h), (246, 238, 220, 255))
    dl = ImageDraw.Draw(left)
    # 太阳 + 跑道草坪
    dl.ellipse((180, 80, 320, 220), fill=(236, 170, 70, 255))
    dl.rectangle((0, 420, w // 2, h), fill=(140, 170, 110, 255))
    for k in range(4):
        dl.arc((-200 + k * 18, 380 + k * 22, 700 - k * 18, 900 - k * 22), 190, 350, fill=(250, 248, 240, 255), width=4)
    right = Image.new("RGBA", (w // 2, h), (24, 30, 52, 255))
    dr = ImageDraw.Draw(right)
    dr.ellipse((300, 80, 380, 160), fill=(240, 232, 200, 255))
    dr.ellipse((322, 70, 402, 150), fill=(24, 30, 52, 255))  # 月牙
    rng = random.Random(3)
    x = 0
    while x < w // 2:  # 城市天际线剪影 + 窗灯
        bw = rng.uniform(40, 90); bh = rng.uniform(120, 300)
        dr.rectangle((x, h - bh, x + bw, h), fill=(38, 44, 70, 255))
        for _ in range(int(bh / 30)):
            wx = rng.uniform(x + 6, x + bw - 12); wy = rng.uniform(h - bh + 10, h - 20)
            if rng.random() < 0.6:
                dr.rectangle((wx, wy, wx + 7, wy + 10), fill=(250, 210, 120, 255))
        x += bw + rng.uniform(4, 14)
    im.paste(left, (0, 0)); im.paste(right, (w // 2, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 16, outline=INK + (255,), width=3)
    d.line([(w // 2, 0), (w // 2, h)], fill=INK + (255,), width=3)
    a1 = clamp(r / 0.4); a2 = clamp((r - 0.9) / 0.4)
    t1 = text_img("白天看马", SERIF_K, 76, INK)
    im.alpha_composite(with_alpha(t1, a1), ((w // 2 - t1.size[0]) // 2, 270))
    t2 = neon_text("夜里逛街", 76, NEON_P)
    if a2 > 0:
        flick = 1.0 if r > 1.6 else (0.4 if int(r * 20) % 3 == 0 else 1.0)
        im.alpha_composite(with_alpha(t2, a2 * flick), (w // 2 + (w // 2 - t2.size[0]) // 2, 270 - 34))
    return im


# ---------------------------------------------------------------- 镜 2 跑马厅
@functools.lru_cache(None)
def champagne_ticket():
    w, h = 820, 400
    im = Image.new("RGBA", (w + 30, h + 30), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((18, 22, w + 14, h + 18), fill=(40, 30, 20, 90))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(im)
    d.rectangle((6, 6, w, h), fill=(244, 232, 196, 255))
    d.rectangle((22, 22, w - 16, h - 16), outline=(150, 110, 50, 255), width=4)
    d.rectangle((34, 34, w - 28, h - 28), outline=(150, 110, 50, 255), width=1)
    for y in range(20, h, 22):  # 齿孔
        d.ellipse((w - 190 - 5, y - 5, w - 190 + 5, y + 5), fill=(210, 196, 160, 255))
    tt = text_img("香槟票", SERIF_K, 120, (120, 40, 30))
    im.alpha_composite(tt, (70, (h - tt.size[1]) // 2 + 6))
    # 香槟瓶（线描）
    bx, by = w - 95, 200
    d.rounded_rectangle((bx - 34, by - 30, bx + 34, by + 140), 18, fill=(70, 100, 70, 255))
    d.polygon([(bx - 34, by - 20), (bx - 12, by - 90), (bx + 12, by - 90), (bx + 34, by - 20)], fill=(70, 100, 70, 255))
    d.rectangle((bx - 14, by - 120, bx + 14, by - 86), fill=(214, 172, 80, 255))
    d.rectangle((bx - 30, by + 30, bx + 30, by + 80), fill=(244, 232, 196, 255))
    for k in range(6):
        a = -1.2 + k * 0.45
        d.line([(bx, by - 128), (bx + 50 * math.cos(a - 1.57), by - 128 + 50 * math.sin(a - 1.57))], fill=(214, 172, 80, 255), width=4)
    return im.rotate(-3, resample=Image.BICUBIC, expand=True)


def scene2(t):
    si = 1
    f = bg(si); heading(f, si, "跑马厅")
    x, y, w, h = 40, 350, 1000, 648
    sw1 = ct(1, 1) - 0.5; sw2 = ct(1, 2) - 0.5; sw3 = ct(1, 4) - 0.5; sw4 = ct(1, 5) - 0.6
    a0 = 1 - fade(t, sw1, 0.6)
    if a0 > 0:
        photo(f, si, "racecourse_park_hotel.jpg", x, y, w, h, t, SEGS[1]['start'], 1.0, 1.18, (420, 290), (470, 330), 7, a0, "跑马厅")
    a1 = win(t, sw1, sw2, 0.6)
    if a1 > 0:  # 小图，只做明信片式小幅呈现（约 1.5 倍）
        photo(f, si, "racecourse_great.jpg", 230, 440, 606, 363, t, sw1, 1.0, 1.06, (202, 121), (190, 118), 5, a1, "跑马厅", rot=-2.5, border=14)
    a2 = win(t, sw2, sw3, 0.6)
    if a2 > 0:
        photo(f, si, "race_club_building_old.jpg", x, y, w, 748, t, sw2, 1.0, 1.15, (420, 315), (330, 330), 9, a2, "跑马总会")
    a3 = win(t, sw3, sw4, 0.6)
    if a3 > 0:
        photo(f, si, "race_club_members_1927.jpg", x, y + 80, w, 499, t, sw3, 1.0, 1.25, (420, 210), (420, 230), 8, a3, "跑马总会会员合影")
    a4 = fade(t, sw4, 0.6)
    if a4 > 0:
        tk = champagne_ticket()
        p = clamp((t - sw4) / 0.5)
        put(f, tk, 540, 480 - (1 - ease_out(p)) * 50, a4, "mt")
        put(f, shiyi_tag(), 1000, 450, a4, "rt")
    # 字卡
    card_in(f, (("1862", RED), (" 年 · 跑马总会建成", INK)), 60, 1150, t, ct(1, 0) + 0.2, t1=sw2)
    card_in(f, "上海第三个、也是最后一个跑马场", 60, 1255, t, ct(1, 1) + 0.2, size=40, t1=sw2)
    if t > sw2 - 0.5:
        a = win(t, ct(1, 2) + 2.0, sw3)
        put(f, road_card(t - ct(1, 3) + 0.2), 60, 1210 + (1 - a) * 20, a)
    card_in(f, (("春秋两季", RED), (" · 全城的社交季", INK)), 60, 1210, t, ct(1, 4) + 0.3, t1=sw4)
    card_in(f, (("头奖", RED), (" · 一瓶香槟", INK)), 60, 1050, t, ct(1, 5) + 0.6, size=48)
    return f


def road_card(r):
    """「大马路 → 南京路」"""
    parts = (("大马路", INK), ("  →  ", RED), ("南京路", RED)) if r > 0 else (("大马路", INK), ("", INK))
    return card(parts, 52)


# ---------------------------------------------------------------- 镜 3 大楼与落幕
def scene3(t):
    si = 2
    f = bg(si); heading(f, si, "钟楼大楼")
    s0 = SEGS[2]['start']
    swmap = ct(2, 1) - 0.4; swcmp = ct(2, 2) - 0.4
    a0 = 1 - fade(t, swmap, 0.6)
    if a0 > 0:  # 明信片里的钟楼大楼局部放大
        photo(f, si, "racecourse_park_hotel.jpg", 190, 340, 700, 808, t, s0, 2.2, 2.6, (655, 330), (660, 300), 9, a0, "跑马总会大楼")
    a1 = win(t, swmap, swcmp, 0.6)
    if a1 > 0:
        panel = city_map().copy()
        draw_track(panel, 1.0)
        map_labels(panel, 1, 1)
        put(f, shadow(MAP_W, MAP_H), 40 - 28, 340 - 28, a1)
        put(f, panel, 40, 340, a1)
        put(f, shiyi_tag(), 40 + MAP_W - 16, 356, a1, "rt")
    a2 = fade(t, swcmp, 0.6)
    if a2 > 0:  # 今昔对比
        put(f, text_img("当年", SERIF_B, 40, INK), 275, 345, a2, "mt")
        put(f, text_img("今天", SERIF_B, 40, RED), 805, 345, a2, "mt")
        img = kenburns("racecourse_park_hotel.jpg", 470, 700, 2.4, 658, 335)
        mounted(f, img, 40, 420, a2)
        put(f, label("跑马总会大楼"), 34, 1150, a2)
        u = clamp((t - swcmp) / 7)
        img2 = kenburns("race_club_today.jpg", 470, 700, 1.0 + 0.06 * ease(u), 420, 620)
        mounted(f, img2, 570, 420, fade(t, swcmp + 0.5, 0.6))
        put(f, label("上海历史博物馆"), 564, 1150, fade(t, swcmp + 0.5, 0.6))
    card_in(f, (("1934", RED), (" 年落成 · 钟楼是地标", INK)), 60, 1250, t, ct(2, 0) + 0.2, t1=swmap)
    card_in(f, (("1951", RED), (" 年 · 跑马场收归国有", INK)), 60, 1250, t, ct(2, 1) + 0.2, t1=swcmp)
    card_in(f, "改建为人民公园、人民广场", 60, 1355, t, ct(2, 1) + 3.6, size=40, t1=swcmp)
    return f


# ---------------------------------------------------------------- 镜 4 四大公司（上）
COMPANIES = [("先施", "1917"), ("永安", "1918"), ("新新", "1926"), ("大新", "1936")]


def company_panel(lit):
    """lit: 每家 0~1 点亮程度"""
    w, h = 560, 440
    im = Image.new("RGBA", (w + 20, h + 20), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((10, 12, w + 6, h + 8), 14, fill=(10, 8, 5, 120))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((2, 2, w, h), 14, fill=(250, 245, 233, 240), outline=INK + (255,), width=2)
    for i, (n, y) in enumerate(COMPANIES):
        k = lit[i]
        yy = 34 + i * 100
        c1 = mix((190, 182, 165), INK, k); c2 = mix((200, 190, 175), RED, k)
        tn = text_img(n, SERIF_K, 64, c1)
        im.alpha_composite(tn, (60, yy))
        ty = text_img(y, SERIF_B, 56, c2)
        im.alpha_composite(ty, (w - 60 - ty.size[0], yy + 6))
        d.line([(60 + tn.size[0] + 20, yy + 50), (w - 80 - ty.size[0], yy + 50)], fill=c2 + (255,), width=2)
    return im


def scene4(t):
    si = 3
    f = bg(si)
    s0 = SEGS[3]['start']
    sw_street = ct(3, 4) - 0.4
    sw_tower = ct(3, 6) - 0.4
    sw_wingon = ct(3, 8) - 0.4
    # 南京路竖幅全屏
    a0 = 1 - fade(t, sw_street, 0.6)
    if a0 > 0:
        u = ease((t - s0) / (sw_street - s0))
        img = kenburns("nanjing_road_1930s_v.jpg", W, H, 1.06 + 0.10 * u, 420, 900 - 260 * u)
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        g = np.zeros((H, W, 4), np.uint8)
        yy = np.arange(H)[:, None]
        g[..., 3] = np.clip(np.maximum(0, (470 - yy) / 470) ** 0.7 * 215 + np.maximum(0, (yy - 1250) / 670) * 215, 0, 255).astype(np.uint8)
        img.alpha_composite(Image.fromarray(g))
        put(f, img, 0, 0, a0)
        put(f, text_img("租界百年 · 十里洋场", SERIF_B, 34, (230, 220, 200)), 540, 150, a0, "mt")
        put(f, text_img("南京路", SERIF_K, 68, LIGHT), 540, 205, a0, "mt")
        put(f, label("南京路", True), 40, 1330, a0 * (1 - fade(t, ct(3, 2) - 0.6)))
    else:
        heading(f, si, "南京路四大公司")
    card_in(f, (("十里洋场", RED), (" · 外滩 → 静安寺", INK)), 60, 1150, t, ct(3, 1) - 0.1, size=48, t1=ct(3, 2) - 0.5)
    # 四家公司名 + 开业年份，依次点亮
    pa = win(t, ct(3, 2) - 0.3, sw_street)
    if pa > 0:
        lit = [ease((t - (ct(3, 3) + k * 0.55)) / 0.35) for k in range(4)]
        put(f, company_panel(lit), 540, 720, pa, "mt")
        card_in(f, "四家大百货公司", 540, 590, t, ct(3, 2) - 0.2, size=48, anchor="mt", t1=sw_street)
    # 南京路街景明信片
    a1 = win(t, sw_street, sw_tower, 0.6)
    if a1 > 0:
        photo(f, si, "nanking_road_1930s.jpg", 40, 360, 1000, 643, t, sw_street, 1.0, 1.12, (420, 270), (470, 280), 9, a1, "南京路")
        card_in(f, (("四家创办人", RED), (" · 都是广东香山人", INK)), 60, 1150, t, ct(3, 5) + 0.3, t1=sw_tower)
        card_in(f, "都在澳大利亚打工发家", 60, 1255, t, ct(3, 5) + 4.2, t1=sw_tower)
    # 先施：竖幅局部（远景双塔）+ 始创不二价
    a2 = win(t, sw_tower, sw_wingon, 0.6)
    if a2 > 0:
        photo(f, si, "nanjing_road_1930s_v.jpg", 140, 360, 800, 860, t, sw_tower, 1.8, 2.1, (240, 300), (250, 260), 9, a2, "南京路")
        card_in(f, (("先施", INK), (" 1917", RED)), 60, 1300, t, ct(3, 6) + 0.2, size=48, t1=sw_wingon)
        p = (t - (ct(3, 6) + 4.4)) / 0.3
        if p > 0:
            sc = 1.5 - 0.5 * ease_out(p)
            sm = seal("始创不二价", 120, rot=-4, seed=5)
            sm = sm.resize((int(sm.size[0] * sc), int(sm.size[1] * sc)), Image.BICUBIC)
            put(f, sm, 700, 1180, clamp(p * 1.6) * (1 - fade(t, sw_wingon)), "mm")
        card_in(f, "明码标价", 560, 1300, t, ct(3, 7) + 0.2, size=48, t1=sw_wingon)
    a3 = fade(t, sw_wingon, 0.6)
    if a3 > 0:  # 永安橱窗：小幅细节
        photo(f, si, "wing_on_1918.jpg", 150, 430, 780, 549, t, sw_wingon, 1.0, 1.08, (260, 183), (260, 170), 7, a3, "永安公司橱窗")
        card_in(f, (("永安", INK), (" 1918", RED), (" · 开在先施对门", INK)), 60, 1150, t, ct(3, 8) + 0.3)
    return f


# ---------------------------------------------------------------- 镜 5 四大公司（下）
def radio_panel(t, r):
    w, h = 1000, 760
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 16, fill=(58, 52, 70, 255), outline=INK + (255,), width=2)
    # 楼层：六楼
    d.rectangle((0, 560, w, h), fill=(84, 74, 82, 255))
    d.line([(0, 560), (w, 560)], fill=(140, 120, 110, 255), width=4)
    # 玻璃房
    gx0, gy0, gx1, gy1 = 260, 170, 740, 560
    glass = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass)
    gd.rectangle((gx0, gy0, gx1, gy1), fill=(170, 215, 230, 70))
    im.alpha_composite(glass)
    d.rectangle((gx0, gy0, gx1, gy1), outline=(210, 235, 245, 255), width=6)
    for k in range(1, 4):
        x = gx0 + (gx1 - gx0) * k / 4
        d.line([(x, gy0), (x, gy1)], fill=(210, 235, 245, 200), width=3)
    for k in range(3):  # 反光斜线
        ox = gx0 + 40 + k * 140
        d.line([(ox, gy0 + 20), (ox + 70, gy0 + 120)], fill=(255, 255, 255, 120), width=5)
    # 播音员剪影 + 话筒 + 桌
    sil = (24, 22, 30, 255)
    d.rectangle((380, 430, 640, 450), fill=(110, 80, 60, 255))
    d.rectangle((395, 450, 410, 560), fill=(110, 80, 60, 255)); d.rectangle((610, 450, 625, 560), fill=(110, 80, 60, 255))
    d.ellipse((440, 270, 510, 340), fill=sil)
    d.rounded_rectangle((420, 335, 530, 440), 26, fill=sil)
    d.rectangle((560, 330, 566, 430), fill=(60, 60, 70, 255))
    d.rounded_rectangle((544, 292, 582, 342), 12, fill=(150, 150, 160, 255))
    # 声波
    for k in range(4):
        ph = ((r * 0.9 - k * 0.25) % 1.0)
        rad = 40 + ph * 220
        al = int(220 * (1 - ph))
        d.arc((563 - rad, 317 - rad, 563 + rad, 317 + rad), -50, 50, fill=(255, 220, 120, al), width=5)
    # 玻璃外的逛街人（剪影）
    rng = random.Random(5)
    for k in range(7):
        x = 40 + k * 140 + rng.uniform(-20, 20) + 10 * math.sin(r * 0.8 + k)
        if gx0 - 30 < x < gx1 + 30:
            x = gx0 - 60 if x < (gx0 + gx1) / 2 else gx1 + 60
        s = rng.uniform(0.9, 1.1)
        y = 700
        col = (18, 16, 22, 255)
        d.ellipse((x - 18 * s, y - 175 * s, x + 18 * s, y - 139 * s), fill=col)
        d.rounded_rectangle((x - 30 * s, y - 140 * s, x + 30 * s, y - 40 * s), int(14 * s), fill=col)
        d.rectangle((x - 20 * s, y - 45 * s, x + 20 * s, y), fill=col)
    t6 = text_img("六楼", SERIF_B, 40, (240, 230, 210))
    im.alpha_composite(t6, (30, 590))
    return im


def escalator_panel(t, r):
    w, h = 1000, 760
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 16, fill=(236, 226, 206, 255), outline=INK + (255,), width=2)
    # 两层楼板
    d.rectangle((0, 640, 300, h), fill=(196, 180, 150, 255))
    d.rectangle((700, 0, w, 220), fill=(214, 200, 172, 255))
    d.rectangle((700, 220, w, 236), fill=(170, 150, 120, 255))
    # 扶梯：从 (250,640) 到 (760,230)
    x0, y0, x1, y1 = 240, 640, 760, 228
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = -uy, ux
    body = [(x0 - 40, y0 + 40), (x1 + 40, y1 + 40), (x1 + 40, y1 + 110), (x0 - 40, y0 + 110)]
    d.polygon(body, fill=(120, 100, 80, 255))
    step = 34
    off = (r * 26) % step  # 台阶自己会走
    n = int(L / step) + 2
    for k in range(-1, n):
        s = k * step + off
        if s < 0 or s > L: continue
        px, py = x0 + ux * s, y0 + uy * s
        d.line([(px, py), (px + step * ux, py)], fill=(70, 60, 55, 255), width=5)
        d.line([(px + step * ux, py), (px + step * ux, py + step * uy)], fill=(70, 60, 55, 255), width=5)
    # 扶手
    hx0, hy0 = x0 - 10 + nx * -90, y0 + ny * -90
    d.line([(x0 - 30, y0 - 90), (x1 + 20, y1 - 90)], fill=(40, 40, 40, 255), width=14)
    d.line([(x0 - 30, y0 - 90), (x0 - 30, y0)], fill=(90, 80, 70, 255), width=8)
    d.line([(x1 + 20, y1 - 90), (x1 + 20, y1)], fill=(90, 80, 70, 255), width=8)
    # 乘客剪影随台阶上行
    for k in range(3):
        s = ((r * 26 + k * 190) % (L + 120)) - 40
        if s < 0 or s > L - 10: continue
        px, py = x0 + ux * s, y0 + uy * s
        col = (30, 34, 46, 255)
        d.ellipse((px - 16, py - 160, px + 16, py - 128), fill=col)
        d.rounded_rectangle((px - 26, py - 130, px + 26, py - 40), 12, fill=col)
        d.rectangle((px - 18, py - 45, px + 18, py), fill=col)
    return im


def scene5(t):
    si = 4
    f = bg(si); heading(f, si, "玻璃电台 · 自动扶梯")
    s0 = SEGS[4]['start']
    sw_esc = ct(4, 3) - 0.4
    sw_pic = ct(4, 4) - 0.3
    a0 = 1 - fade(t, sw_esc, 0.6)
    if a0 > 0:
        put(f, shadow(1000, 760), 12, 332, a0)
        put(f, radio_panel(t, t - s0), 40, 360, a0)
        put(f, shiyi_tag(), 1024, 376, a0, "rt")
        put(f, label("玻璃电台（示意）"), 34, 1146, a0)
    a1 = win(t, sw_esc, sw_pic, 0.6)
    if a1 > 0:
        put(f, shadow(1000, 760), 12, 332, a1)
        put(f, escalator_panel(t, t - sw_esc), 40, 360, a1)
        put(f, shiyi_tag(), 1024, 376, a1, "rt")
        put(f, label("自动扶梯（示意）"), 34, 1146, a1)
    a2 = fade(t, sw_pic, 0.6)
    if a2 > 0:  # 回到南京路竖幅局部：招牌段
        photo(f, si, "nanjing_road_1930s_v.jpg", 40, 360, 1000, 760, t, sw_pic, 1.55, 1.75, (380, 1000), (360, 960), 6, a2, "南京路")
    card_in(f, (("新新", INK), (" 1926", RED), (" · 六楼玻璃电台", INK)), 60, 1220, t, ct(4, 0) + 0.2, t1=ct(4, 2) - 0.3)
    card_in(f, "中国人自办的第一座播音电台", 60, 1220, t, ct(4, 2) - 0.1, t1=sw_esc)
    card_in(f, (("大新", INK), (" 1936", RED), (" · 远东头一家自动扶梯", INK)), 60, 1220, t, ct(4, 3) + 0.2, t1=sw_pic + 1.2)
    return f


# ---------------------------------------------------------------- 镜 6 大世界
def mirror_panel(t, r):
    w, h = 1000, 720
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 16, fill=(48, 40, 58, 255), outline=INK + (255,), width=2)
    for k in range(3):  # 三面哈哈镜：拉高 / 压扁 / 扭曲
        mx = 60 + k * 310; my = 60; mw = 260; mh = 560
        d.rounded_rectangle((mx - 12, my - 12, mx + mw + 12, my + mh + 12), 120, fill=(196, 150, 70, 255))
        d.rounded_rectangle((mx, my, mx + mw, my + mh), 110, fill=(196, 214, 222, 255))
        # 镜中人影：随时间变形
        fig = Image.new("RGBA", (mw, mh), (0, 0, 0, 0))
        fd = ImageDraw.Draw(fig)
        col = (40, 46, 64, 255)
        sx = [0.55, 1.6, 1.0][k]; sy = [1.35, 0.6, 1.0][k]
        wob = math.sin(r * 2.4 + k) * 0.12
        sx *= 1 + wob; sy *= 1 - wob * 0.6
        cx = mw / 2; base = mh - 40
        hr = 34
        fd.ellipse((cx - hr * sx, base - 300 * sy - hr * 2 * sy, cx + hr * sx, base - 300 * sy), fill=col)
        fd.rounded_rectangle((cx - 60 * sx, base - 300 * sy, cx + 60 * sx, base - 110 * sy), int(26 * min(sx, 1)), fill=col)
        fd.rectangle((cx - 40 * sx, base - 115 * sy, cx + 40 * sx, base), fill=col)
        if k == 2:
            arr = np.array(fig)
            out = np.zeros_like(arr)
            for yy in range(mh):
                sh_ = int(28 * math.sin(yy / 45 + r * 2.0))
                out[yy] = np.roll(arr[yy], sh_, axis=0)
            fig = Image.fromarray(out)
        mask = Image.new("L", (mw, mh), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, mw - 1, mh - 1), 110, fill=255)
        fa = np.array(fig); fa[..., 3] = np.minimum(fa[..., 3], np.array(mask)); fig = Image.fromarray(fa)
        im.alpha_composite(fig, (mx, my))
        d.line([(mx + 40, my + 60), (mx + 90, my + 160)], fill=(255, 255, 255, 140), width=6)
    return im


def scene6(t):
    si = 5
    f = bg(si); heading(f, si, "大世界")
    s0 = SEGS[5]['start']
    sw_mir = ct(5, 3) - 0.4
    sw_say = ct(5, 4) - 0.3
    sw_tow = ct(5, 6) - 0.4
    a0 = 1 - fade(t, sw_mir, 0.6)
    if a0 > 0:
        photo(f, si, "great_world_1917.jpg", 40, 380, 1000, 658, t, s0, 1.0, 1.12, (398, 261), (330, 230), 12, a0, "大世界")
        card_in(f, (("1917", RED), (" 年 · 黄楚九创办", INK)), 60, 1180, t, ct(5, 2) + 0.2, t1=sw_mir)
    a1 = win(t, sw_mir, sw_say, 0.6)
    if a1 > 0:
        put(f, shadow(1000, 720), 12, 352, a1)
        put(f, mirror_panel(t, t - sw_mir), 40, 380, a1)
        put(f, shiyi_tag(), 1024, 396, a1, "rt")
        put(f, label("哈哈镜（示意）", True), 34, 1126, a1)
        words = ["哈哈镜", "杂耍", "戏台", "电影"]
        for k, wd in enumerate(words):
            card_in(f, wd, 60 + k * 245, 1200, t, ct(5, 3) + k * 0.75, size=44, bar=False, padx=24, t1=sw_say)
    a2 = win(t, sw_say, sw_tow, 0.5)
    if a2 > 0:
        p = clamp((t - sw_say - 0.2) / 0.5)
        n1 = neon_text("不到大世界", 110, GOLD)
        n2 = neon_text("枉来大上海", 110, NEON_P)
        put(f, n1, 540, 560 - (1 - ease_out(p)) * 40, a2 * clamp(p * 2), "mt")
        q = clamp((t - ct(5, 5) - 1.2) / 0.5)
        put(f, n2, 540, 800 - (1 - ease_out(q)) * 40, a2 * clamp(q * 2), "mt")
    a3 = fade(t, sw_tow, 0.6)
    if a3 > 0:  # 小图（440 宽），明信片式小幅
        photo(f, si, "great_world_tower.jpg", 270, 380, 528, 725, t, sw_tow, 1.0, 1.05, (220, 302), (220, 280), 8, a3, "大世界", rot=2.0, border=14)
        card_in(f, (("1928", RED), (" 年重建 · 中央塔楼", INK)), 60, 1240, t, ct(5, 6) + 0.2)
    return f


# ---------------------------------------------------------------- 镜 7 大世界·今
def scene7(t):
    si = 6
    f = bg(si); heading(f, si, "大世界 · 今")
    s0 = SEGS[6]['start']
    sw = ct(6, 2) - 0.4
    a0 = 1 - fade(t, sw, 0.7)
    if a0 > 0:
        photo(f, si, "great_world_tower.jpg", 270, 380, 528, 725, t, s0, 1.05, 1.12, (220, 280), (220, 240), 9, a0, "大世界", rot=2.0, border=14)
        card_in(f, (("1931", RED), (" 年 · 大世界易手", INK)), 60, 1240, t, ct(6, 0) + 0.2, t1=sw)
    a1 = fade(t, sw, 0.7)
    if a1 > 0:  # 今昔对比：老明信片（小）→ 今日夜景
        photo(f, si, "great_world_tower.jpg", 40, 360, 300, 412, t, sw, 1.0, 1.0, (220, 302), (220, 302), 1, a1, None, border=8)
        put(f, label("大世界", True), 34, 800, a1)
        a2 = fade(t, sw + 0.8, 0.7)
        photo(f, si, "great_world_today.jpg", 380, 360, 660, 440, t, sw + 0.8, 1.0, 1.15, (420, 280), (300, 230), 9, a2, None, border=8)
        put(f, label("大世界（今）", True), 374, 828, a2)
        card_in(f, (("2017", RED), (" 年重新开放", INK)), 60, 960, t, ct(6, 2) + 1.6, size=48)
        card_in(f, "非物质文化遗产展示中心 · 老楼还在原址", 60, 1070, t, ct(6, 2) + 5.0, size=38)
    return f


# ---------------------------------------------------------------- 镜 8 百乐门
def spring_panel(t, r):
    w, h = 1000, 700
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 16, fill=(30, 26, 44, 255), outline=(120, 110, 150, 255), width=2)
    bounce = 10 * abs(math.sin(r * 3.2))
    fy = 330 + bounce
    # 舞者剪影（两对）
    for k, cx in enumerate((330, 670)):
        sw_ = 8 * math.sin(r * 3.2 + k)
        col = (250, 220, 240, 255)
        for dx in (-34, 34):
            x = cx + dx + sw_
            d.ellipse((x - 18, fy - 230, x + 18, fy - 194), fill=col)
            d.rounded_rectangle((x - 26, fy - 196, x + 26, fy - 100), 12, fill=col)
            if dx > 0:  # 裙摆
                d.polygon([(x - 26, fy - 110), (x + 26, fy - 110), (x + 44, fy - 4), (x - 44, fy - 4)], fill=col)
            else:
                d.rectangle((x - 20, fy - 104, x + 20, fy - 4), fill=col)
    # 舞池地板（木板）
    d.rectangle((60, fy, w - 60, fy + 34), fill=(176, 120, 70, 255))
    for x in range(60, w - 60, 70):
        d.line([(x, fy), (x, fy + 34)], fill=(130, 86, 50, 255), width=3)
    # 钢板（弓形叠板）+ 弹簧
    for k in range(5):
        cx = 140 + k * 180
        top = fy + 34
        for j in range(3):
            d.arc((cx - 70 + j * 10, top + 10 + j * 10, cx + 70 - j * 10, top + 70 + j * 6 - bounce * 0.5), 200, 340, fill=(180, 190, 205, 255), width=6)
        ys = top + 50; ye = 600
        n = 8
        pts = []
        for i in range(n * 2 + 1):
            yy = ys + (ye - ys) * i / (n * 2)
            pts.append((cx + (24 if i % 2 else -24), yy))
        d.line(pts, fill=(210, 215, 225, 255), width=5)
    d.rectangle((60, 600, w - 60, 630), fill=(90, 86, 96, 255))
    return im


def scene8(t):
    si = 7
    f = bg(si); heading(f, si, "百乐门")
    s0 = SEGS[7]['start']
    sw_spr = ct(7, 1) - 0.4
    sw_nn = ct(7, 2) - 0.4
    sw_day = ct(7, 4) - 0.4
    a0 = 1 - fade(t, sw_spr, 0.6)
    if a0 > 0:
        photo(f, si, "paramount_today.jpg", 40, 360, 1000, 750, t, s0, 1.0, 1.14, (420, 315), (360, 300), 7, a0, "百乐门")
    a1 = win(t, sw_spr, sw_nn, 0.6)
    if a1 > 0:
        put(f, shadow(1000, 700), 12, 332, a1)
        put(f, spring_panel(t, t - sw_spr), 40, 360, a1)
        put(f, shiyi_tag(), 1024, 376, a1, "rt")
        put(f, label("弹簧地板（示意）", True), 34, 1086, a1)
        card_in(f, (("1933", RED), (" 年开业", INK)), 60, 1160, t, ct(7, 1) + 0.2, size=48, t1=sw_nn)
        card_in(f, "钢板托着地板 · 跳起来会晃", 60, 1270, t, ct(7, 1) + 3.0, size=40, t1=sw_nn)
    a2 = win(t, sw_nn, sw_day, 0.6)
    if a2 > 0:
        photo(f, si, "paramount_today.jpg", 140, 360, 800, 600, t, sw_nn, 1.2, 1.45, (300, 260), (300, 230), 13, a2 * 0.92, "百乐门")
        p = clamp((t - ct(7, 2) - 0.1) / 0.5)
        flick = 1.0 if p >= 1 else (0.35 if int(t * 24) % 4 == 0 else 1.0)
        put(f, neon_text("东方第一乐府", 96, NEON_C), 540, 1020, a2 * clamp(p * 2) * flick, "mt")
        card_in(f, (("四大舞厅", RED),), 540, 1225, t, ct(7, 2) + 3.0, size=44, anchor="mt", t1=ct(7, 3) - 0.3)
        card_in(f, "仙乐斯 · 大都会 · 百乐门 · 新仙林", 540, 1330, t, ct(7, 2) + 3.6, size=40, anchor="mt", bar=False, t1=ct(7, 3) - 0.3)
        card_in(f, (("1936", RED), (" 年 · 卓别林来百乐门跳舞", INK)), 540, 1220, t, ct(7, 3) + 0.2, size=40, anchor="mt", t1=sw_day)
    a3 = fade(t, sw_day, 0.6)
    if a3 > 0:
        photo(f, si, "paramount_today_day.jpg", 40, 360, 1000, 663, t, sw_day, 1.0, 1.1, (420, 280), (450, 260), 8, a3, "百乐门")
        card_in(f, (("2017", RED), (" 年修缮重开 · 至今营业", INK)), 60, 1150, t, ct(7, 4) + 1.6, size=44)
    return f


# ---------------------------------------------------------------- 镜 9 收尾
@functools.lru_cache(None)
def lamp_row_base():
    w, h = 1000, 760
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 16, fill=(16, 20, 38, 255))
    rng = random.Random(21)
    x = 0
    while x < w:
        bw = rng.uniform(60, 130); bh = rng.uniform(200, 470)
        d.rectangle((x, h - bh, x + bw, h), fill=(30, 36, 60, 255))
        x += bw + rng.uniform(2, 10)
    return im


LAMPS = [(90 + k * 118, 300 + (k % 2) * 40) for k in range(8)]


def lamp_panel(r):
    im = lamp_row_base().copy()
    d = ImageDraw.Draw(im)
    rng = random.Random(4)
    # 楼窗：一盏一盏亮
    wins = []
    for k in range(90):
        wins.append((rng.uniform(20, 980), rng.uniform(330, 740), rng.uniform(0, 6.5)))
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    for x, y, t0 in wins:
        if r > t0:
            gd.rectangle((x, y, x + 10, y + 14), fill=(255, 205, 120, 255))
    for k, (x, y) in enumerate(LAMPS):
        d.line([(x, y + 20), (x, 760)], fill=(60, 60, 74, 255), width=6)
        on = clamp((r - 0.55 * k) / 0.3)
        c = mix((80, 80, 90), (255, 226, 150), on)
        if on > 0:
            gd.ellipse((x - 46, y - 46, x + 46, y + 46), fill=(255, 210, 120, int(120 * on)))
        d.ellipse((x - 18, y - 18, x + 18, y + 18), fill=c + (255,))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)))
    im.alpha_composite(glow)
    for k, (x, y) in enumerate(LAMPS):
        on = clamp((r - 0.55 * k) / 0.3)
        d2 = ImageDraw.Draw(im)
        d2.ellipse((x - 16, y - 16, x + 16, y + 16), fill=mix((80, 80, 90), (255, 240, 200), on) + (255,))
    return im


def endcard(t):
    f = background(1.0).copy()
    r = t - SEGS[8]['endcard']
    a = fade(r, 0.2, 0.6)
    put(f, seal("租界百年", 170, seed=21), 540, 560 + (1 - a) * 30, a, "mt")
    b = fade(r, 0.8, 0.6)
    put(f, text_img("第七集", SERIF_B, 56, (200, 190, 170)), 540, 840, b, "mt")
    put(f, neon_text("十里洋场", 128, GOLD), 540, 900 + (1 - b) * 20, b, "mt")
    c = fade(r, 1.6, 0.6)
    put(f, Image.new("RGBA", (380, 6), RED + (255,)), 540, 1150, c, "mt")
    put(f, text_img("熊吉大王", SERIF_B, 52, LIGHT), 540, 1190, c, "mt")
    return f


def scene9(t):
    si = 8
    s0 = SEGS[8]['start']
    ec = SEGS[8]['endcard']
    xf = ease((t - ec) / 0.7)
    if xf >= 1:
        return endcard(t)
    f = bg(si); heading(f, si, "三个场子")
    b1 = ct(8, 1)
    seg_len = (cend(8, 1) - b1) / 3
    flashes = [b1 + k * seg_len for k in range(3)]
    sw_lamp = ct(8, 2) - 0.4
    a_tri = 1 - fade(t, sw_lamp, 0.6)
    if a_tri > 0:
        # 三格：跑道形状 / 大世界塔楼 / 百乐门霓虹，依次各一闪放大
        cells = [(40, 380), (380, 380), (720, 380)]
        for k, (cx, cy) in enumerate(cells):
            on = win(t, flashes[k] - 0.15, flashes[k] + seg_len - 0.15, 0.25) if t >= b1 - 0.4 else 0
            base_a = fade(t, s0 + 0.4 + k * 0.35, 0.4)
            if k == 0:
                panel = city_map(1.0).copy(); draw_track(panel, 1.0)
                tile = panel.resize((320, 275), Image.BICUBIC)
            elif k == 1:
                tile = kenburns("great_world_tower.jpg", 320, 440, 1.0, 220, 302)
            else:
                tile = kenburns("paramount_today.jpg", 320, 440, 1.6, 330, 300)
            ty = cy + (440 - tile.size[1]) / 2
            mounted(f, tile, cx, ty, base_a * (1 - any_on(t, flashes, seg_len, k)), border=6)
            names = ["跑马厅", "大世界", "百乐门"]
            put(f, label(names[k], True), cx - 6, 860, base_a * (1 - any_on(t, flashes, seg_len, k)))
        for k in range(3):
            on = win(t, flashes[k] - 0.15, flashes[k] + seg_len - 0.2, 0.2) if t >= b1 - 0.4 else 0
            if on <= 0: continue
            if k == 0:
                panel = city_map(1.0).copy()
                draw_track(panel, ease((t - flashes[0]) / 1.0))
                big = panel
                put(f, big, 540, 340, on, "mt")
            elif k == 1:
                big = kenburns("great_world_tower.jpg", 640, 880, 1.0 + 0.05 * (t - flashes[1]), 220, 280)
                mounted(f, big, 220, 330, on, border=10)
            else:
                big = kenburns("paramount_today.jpg", 1000, 750, 1.05 + 0.05 * (t - flashes[2]), 360, 300)
                mounted(f, big, 40, 380, on, border=10)
    a_l = fade(t, sw_lamp, 0.6)
    if a_l > 0:
        put(f, shadow(1000, 760), 12, 332, a_l)
        put(f, lamp_panel(t - sw_lamp), 40, 360, a_l)
        put(f, shiyi_tag(), 1024, 376, a_l, "rt")
    if xf > 0:
        return Image.blend(f, endcard(t), xf)
    return f


def any_on(t, flashes, seg_len, k):
    return 1.0 if any(flashes[j] - 0.15 <= t <= flashes[j] + seg_len - 0.2 for j in range(3)) else 0.0


SCENES = [scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8, scene9]


# ---------------------------------------------------------------- 字幕 / 水印
SUB_EVENTS = []
for s in SEGS:
    for c in s['chunks']:
        for g0, g1, lines in c['groups']:
            SUB_EVENTS.append((g0, g1, tuple(lines)))
SUB_SHOW = []
for k, (g0, g1, lines) in enumerate(SUB_EVENTS):
    nxt = SUB_EVENTS[k + 1][0] if k + 1 < len(SUB_EVENTS) else 1e9
    SUB_SHOW.append((g0, min(g1 + 0.3, nxt), lines))


@functools.lru_cache(None)
def sub_img(lines):
    ims = [text_img(l, SANS_B, 56, (255, 255, 255), stroke=5, stroke_color=(20, 22, 28)) for l in lines]
    w = max(i.size[0] for i in ims); lh = 78
    out = Image.new("RGBA", (w, lh * len(ims) + 10), (0, 0, 0, 0))
    for k, i in enumerate(ims):
        out.alpha_composite(i, ((w - i.size[0]) // 2, k * lh))
    return out


def subtitles(f, t):
    for g0, g1, lines in SUB_SHOW:
        if g0 <= t < g1:
            a = min(clamp((t - g0) / 0.1 + 0.2), clamp((g1 - t) / 0.1))
            put(f, sub_img(lines), 540, 1535, a, "mt")


@functools.lru_cache(None)
def watermark():
    return text_img("熊吉大王", SANS_B, 34, (255, 255, 255), stroke=2, stroke_color=(40, 40, 40))


def frame_at(n):
    t = n / FPS
    si = 0
    for i, s in enumerate(SEGS):
        if t >= s['start']:
            si = i
    f = SCENES[si](t)
    XF = 0.25
    if si + 1 < len(SEGS) and t > SEGS[si + 1]['start'] - XF:
        w = (t - (SEGS[si + 1]['start'] - XF)) / (2 * XF)
        f = Image.blend(f, SCENES[si + 1](t), ease(w))
    elif si > 0 and t < SEGS[si]['start'] + XF:
        w = (t - (SEGS[si]['start'] - XF)) / (2 * XF)
        f = Image.blend(SCENES[si - 1](t), f, ease(w))
    subtitles(f, t)
    put(f, watermark(), W - 36, H - 150, 0.5, "rt")
    return f.convert("RGB")


def scene_frames():
    b = [int(round(s['start'] * FPS)) for s in SEGS] + [NFRAMES]
    return [(b[i], b[i + 1]) for i in range(len(SEGS))]


if __name__ == "__main__":
    import subprocess
    mode = sys.argv[1]
    if mode == "still":
        os.makedirs(f"{WORK}/stills", exist_ok=True)
        for tt in sys.argv[2:]:
            n = int(round(float(tt) * FPS))
            frame_at(n).save(f"{WORK}/stills/still_{float(tt):07.2f}.jpg", quality=88)
    elif mode == "scene":
        i = int(sys.argv[2])
        a, b = scene_frames()[i]
        out = f"{WORK}/scenes/s{i+1}.mp4"
        tmp = out.replace(".mp4", ".part.mp4")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                              "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "18",
                              "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", str(FPS), tmp], stdin=subprocess.PIPE)
        for n in range(a, b):
            p.stdin.write(frame_at(n).tobytes())
        p.stdin.close()
        if p.wait() == 0:
            os.replace(tmp, out)
            print("ok", out, b - a)
        else:
            sys.exit(1)
