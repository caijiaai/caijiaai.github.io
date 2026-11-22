# -*- coding: utf-8 -*-
"""《租界百年》第6集《公园门口的牌子》—— 无旁白画面渲染"""
import math, os, sys, random, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import script_data as SD

W, H, FPS = 1080, 1920, 24
ASSET = "/home/claude/src_assets"
PAPER = (239, 230, 210)
INK = (31, 53, 80)
RED = (184, 50, 42)
SEGS, TOTAL = SD.build()
NFRAMES = int(round(TOTAL * FPS))

SANS_B = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
SERIF_B = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
SERIF_K = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Black.ttc"


@functools.lru_cache(None)
def font(path, size):
    return ImageFont.truetype(path, size, index=2)  # SC


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_back(x):
    x = clamp(x)
    c1 = 1.5; c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def fade(t, t0, d=0.45):
    return ease((t - t0) / d)


def ct(si, cj):
    return SEGS[si]['chunks'][cj]['start']


def cend(si, cj):
    return SEGS[si]['chunks'][cj]['end']


# ---------------------------------------------------------------- 基础图层
def make_paper(w=W, h=H, seed=6):
    rng = np.random.default_rng(seed)
    base = np.ones((h, w, 3), np.float32) * np.array(PAPER, np.float32)
    low = rng.normal(0, 1, (h // 60 + 2, w // 60 + 2)).astype(np.float32)
    low = np.array(Image.fromarray(low).resize((w, h), Image.BICUBIC))
    mid = rng.normal(0, 1, (h // 8 + 2, w // 8 + 2)).astype(np.float32)
    mid = np.array(Image.fromarray(mid).resize((w, h), Image.BICUBIC))
    grain = rng.normal(0, 1, (h, w)).astype(np.float32)
    shade = low * 5 + mid * 2.2 + grain * 2.0
    # 纤维
    fib = np.zeros((h, w), np.float32)
    im = Image.fromarray(fib); d = ImageDraw.Draw(im)
    for _ in range(900):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        a = rng.uniform(0, math.pi); L = rng.uniform(8, 40)
        d.line([(x, y), (x + L * math.cos(a), y + L * math.sin(a))], fill=float(rng.uniform(3, 7)), width=1)
    fib = np.array(im)
    yy, xx = np.mgrid[0:h, 0:w]
    vig = ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2
    out = base + (shade - fib)[..., None] - (vig * 10)[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert("RGBA")


PAPER_IMG = None


def paper():
    global PAPER_IMG
    if PAPER_IMG is None:
        p = "/home/claude/work/cache_paper.png"
        if os.path.exists(p):
            PAPER_IMG = Image.open(p).convert("RGBA")
        else:
            PAPER_IMG = make_paper(); PAPER_IMG.save(p)
    return PAPER_IMG.copy()


def with_alpha(img, a):
    if a >= 0.999:
        return img
    arr = np.array(img)
    arr[..., 3] = (arr[..., 3].astype(np.float32) * max(a, 0)).astype(np.uint8)
    return Image.fromarray(arr)


def put(frame, img, x, y, a=1.0, anchor="lt"):
    """把 RGBA 图贴到 frame；anchor: lt / mm / mt / rt / lm / rb"""
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
    src = img.crop((sx0, sy0, sx1, sy1)) if (sx0, sy0, sx1, sy1) != (0, 0, w, h) else img
    frame.alpha_composite(with_alpha(src, a), dest=(x + sx0, y + sy0))


@functools.lru_cache(None)
def text_img(text, path, size, color=INK, stroke=0, stroke_color=(0, 0, 0), alpha=255):
    f = font(path, size)
    bb = f.getbbox(text, stroke_width=stroke)
    pad = 6 + stroke
    w = bb[2] - bb[0] + pad * 2; h = bb[3] - bb[1] + pad * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((pad - bb[0], pad - bb[1]), text, font=f, fill=color + (alpha,),
           stroke_width=stroke, stroke_fill=stroke_color + (alpha,))
    return im


@functools.lru_cache(None)
def rich_line(parts, path, size):
    """parts: ((text, rgb), ...) 横排拼接"""
    ims = [text_img(t, path, size, c) for t, c in parts]
    f = font(path, size)
    asc, desc = f.getmetrics()
    w = sum(i.size[0] for i in ims) - 12 * (len(ims) - 1)
    h = max(i.size[1] for i in ims)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = 0
    for (t, c), i in zip(parts, ims):
        bb = font(path, size).getbbox(t)
        # 统一基线：用 getbbox 顶部偏移对齐
        out.alpha_composite(i, (x, max(0, bb[1] - font(path, size).getbbox("国")[1])))
        x += i.size[0] - 12
    return out


@functools.lru_cache(None)
def card(parts, size=44, path=SERIF_B, bar=True, padx=30, pady=16):
    """字卡：浅纸条 + 墨线框 + 朱红左条"""
    if isinstance(parts, str):
        parts = ((parts, INK),)
    t = rich_line(parts, path, size)
    w = t.size[0] + padx * 2 + (14 if bar else 0)
    h = t.size[1] + pady * 2
    im = Image.new("RGBA", (w + 12, h + 12), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((8, 9, w + 4, h + 5), 10, fill=(60, 40, 20, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(5))
    im.alpha_composite(sh)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((2, 2, w, h), 10, fill=(250, 245, 233, 245), outline=INK + (255,), width=2)
    if bar:
        d.rectangle((10, 12, 20, h - 10), fill=RED + (255,))
    im.alpha_composite(t, (2 + padx + (14 if bar else 0), 2 + pady))
    return im


@functools.lru_cache(None)
def label(text):
    """照片/画面标注：朱红小方块 + 墨字"""
    t = text_img(text, SERIF_B, 36, INK)
    im = Image.new("RGBA", (t.size[0] + 40, t.size[1]), (0, 0, 0, 0))
    ImageDraw.Draw(im).rectangle((4, t.size[1] // 2 - 9, 22, t.size[1] // 2 + 9), fill=RED + (255,))
    im.alpha_composite(t, (32, 0))
    return im


@functools.lru_cache(None)
def shiyi_tag():
    t = text_img("示意", SERIF_B, 32, RED)
    im = Image.new("RGBA", (t.size[0] + 20, t.size[1] + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((1, 1, im.size[0] - 2, im.size[1] - 2), fill=(250, 245, 233, 230), outline=RED + (255,), width=3)
    im.alpha_composite(t, (10, 4))
    return im


@functools.lru_cache(None)
def seal(text, size=120, path=SERIF_K, rot=0.0, seed=1, pad=None):
    """朱红印章（阳文底、纸色字），带斑驳"""
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
    ImageDraw.Draw(im).rectangle((2 * r, 2 * r + 6, 2 * r + w, 2 * r + h + 6), fill=(50, 35, 20, a))
    return im.filter(ImageFilter.GaussianBlur(r))


def heading(frame, text, a=1.0):
    put(frame, text_img("租界百年", SERIF_B, 34, (120, 110, 95)), 540, 150, a, "mt")
    put(frame, text_img(text, SERIF_K, 68, INK), 540, 205, a, "mt")
    t = text_img(text, SERIF_K, 68, INK)
    bar = Image.new("RGBA", (t.size[0] + 60, 6), RED + (255,))
    put(frame, bar, 540, 300, a * 0.9, "mt")


# ---------------------------------------------------------------- 素材
@functools.lru_cache(None)
def src(name, up=1):
    im = Image.open(os.path.join(ASSET, name)).convert("RGB")
    if up != 1:  # 仅做常规插值放大（不做 AI 修复/重绘）
        im = im.resize((im.size[0] * up, im.size[1] * up), Image.LANCZOS)
    return im


def kenburns(name, out_w, out_h, z, cx, cy, up=1):
    """z>=1；(cx,cy) 为原图坐标的取景中心"""
    im = src(name, up)
    sw, sh = im.size
    s = up
    aspect = out_w / out_h
    bw = sw / z
    bh = bw / aspect
    if bh > sh:
        bh = sh / z; bw = bh * aspect
    x0 = clamp(cx * s - bw / 2, 0, sw - bw); y0 = clamp(cy * s - bh / 2, 0, sh - bh)
    return im.resize((out_w, out_h), Image.BICUBIC, box=(x0, y0, x0 + bw, y0 + bh)).convert("RGBA")


def mounted(frame, img, x, y, a=1.0, border=10):
    """照片：白边 + 投影"""
    w, h = img.size
    put(frame, shadow(w + border * 2, h + border * 2), x - border - 28, y - border - 28, a)
    m = Image.new("RGBA", (w + border * 2, h + border * 2), (250, 247, 238, 255))
    m.paste(img, (border, border))
    put(frame, m, x - border, y - border, a)


# ---------------------------------------------------------------- 镜 1
HOOK_CHARS = ["华", "人", "与", "狗", "不", "得", "入", "内"]


def scene1(t):
    s = SEGS[0]; t0 = s['start']; r = t - t0
    f = paper()
    put(f, text_img("租界百年", SERIF_B, 40, (110, 100, 85)), 540, 250, fade(r, 0, 0.3), "mt")
    # 大字逐个落下（纯文字，无牌子图形）
    size = 168; gx0 = 540 - 2 * 190 + 95; rows = (560, 760)
    for i, ch in enumerate(HOOK_CHARS):
        st = 0.12 + i * 0.17
        p = (r - st) / 0.42
        if p <= 0: continue
        col, row = i % 4, i // 4
        x = gx0 + col * 190; y = rows[row]
        dy = (1 - ease_back(p)) * -170
        put(f, text_img(ch, SERIF_K, size, INK), x, y + dy, clamp(p * 2.2), "mm")
    qa = fade(r, 0.12, 0.3)
    put(f, text_img("「", SERIF_K, 120, INK), gx0 - 150, rows[0] - 40, qa, "mm")
    qb = fade(r, 0.12 + 7 * 0.17, 0.3)
    put(f, text_img("」", SERIF_K, 120, INK), gx0 + 3 * 190 + 140, rows[1] + 40, qb, "mm")
    # 传闻中的说法
    put(f, text_img("—— 传闻中的说法", SERIF_B, 40, RED), gx0 - 95, 905, fade(r, 1.9, 0.5), "lt")
    # 问号印章
    p = (r - 2.4) / 0.28
    if p > 0:
        sc = 1.9 - 0.9 * ease_out(p)
        pulse = 1.0
        q0 = ct(0, 2) + 2.6  # “有人见过照片吗？”
        if r + t0 > q0:
            pulse = 1 + 0.06 * math.sin(clamp((r + t0 - q0) / 0.5) * math.pi)
        sim = seal("？", 160, rot=-9, seed=3)
        sim = sim.resize((int(sim.size[0] * sc * pulse), int(sim.size[1] * sc * pulse)), Image.BICUBIC)
        put(f, sim, 905, 960, clamp(p * 1.6) * 0.95, "mm")
    # 标题
    a = fade(r, 3.0, 0.6)
    put(f, text_img("《公园门口的牌子》", SERIF_K, 92, INK), 540, 1140 + (1 - a) * 30, a, "mt")
    bar = Image.new("RGBA", (420, 6), RED + (255,))
    put(f, bar, 540, 1275, a, "mt")
    return f


# ---------------------------------------------------------------- 镜 2
def scene2(t):
    s = SEGS[1]; r = t - s['start']; dur = s['end'] - s['start']
    f = paper(); heading(f, "公园来历")
    sw = ct(1, 1) - 0.2  # 叠版画
    xf = ease((t - sw) / 0.9)
    if xf < 1:
        z = 1.0 + 0.16 * ease(r / (sw - s['start'] + 1.0))
        cx = 600 - 50 * ease(r / 14); cy = 389 - 110 * ease(r / 14)
        img = kenburns("park_and_garden_bridge.jpg", 1000, 650, z, cx, cy)
        mounted(f, img, 40, 360, 1 - xf)
        put(f, label("外滩公园 · 花园桥"), 40, 1040, 1 - xf)
    if xf > 0:
        rr = t - sw
        z = 1.04 + 0.08 * ease(rr / 16)
        cx = 560 + 60 * ease(rr / 16); cy = 350
        img = kenburns("public_garden_1870.jpg", 1000, 600, z, cx, cy)
        mounted(f, img, 40, 385, xf)
        put(f, label("公共花园入口"), 40, 1040, xf)
    # 字卡
    c1 = ct(1, 1) + 0.3
    put(f, card((("1868", RED), (" 年开放", INK))), 60, 1125 + (1 - fade(t, c1)) * 20, fade(t, c1))
    c2 = ct(1, 2) + 0.2
    put(f, card((("约 ", INK), ("30", RED), (" 亩 · 上海最早的公园", INK))), 60, 1235 + (1 - fade(t, c2)) * 20, fade(t, c2))
    c3 = ct(1, 2) + len("三十亩地，是上海最早的一座公园。") / SD.SPEED
    put(f, card("今天 · 黄浦公园"), 60, 1345 + (1 - fade(t, c3)) * 20, fade(t, c3))
    return f


# ---------------------------------------------------------------- 镜 3 / 4 园规
REG = "park_regulations_1917.jpg"
ROW1 = (12, 74, 330, 95)
ROW4 = (11, 137, 230, 157)
REG_UP = 4


def reg_view(scale, cy_src, win_w, win_h, boxes):
    """返回 window 大小的 RGBA；照片按 scale 显示，(居中, 以原图 y=cy_src 对准窗口中心)；boxes: [(rect, progress)]"""
    im = src(REG, REG_UP)
    dw, dh = 342 * scale, 465 * scale
    ox = (win_w - dw) / 2
    oy = win_h / 2 - cy_src * scale
    oy = min(0, max(win_h - dh, oy)) if dh > win_h else (win_h - dh) / 2
    # 只取窗口内可见部分
    vx0 = max(0, -ox) / scale; vy0 = max(0, -oy) / scale
    vx1 = min(dw, win_w - ox) / scale; vy1 = min(dh, win_h - oy) / scale
    px0, py0 = max(0, ox), max(0, oy)
    pw, ph = int(round((vx1 - vx0) * scale)), int(round((vy1 - vy0) * scale))
    crop = im.resize((pw, ph), Image.BICUBIC, box=(vx0 * REG_UP, vy0 * REG_UP, vx1 * REG_UP, vy1 * REG_UP)).convert("RGBA")
    out = Image.new("RGBA", (win_w, win_h), (0, 0, 0, 0))
    out.alpha_composite(crop, (int(round(px0)), int(round(py0))))
    if boxes:
        dim = Image.new("RGBA", (win_w, win_h), (0, 0, 0, 0))
        mask = Image.new("L", (win_w, win_h), 0)
        md = ImageDraw.Draw(mask)
        md.rectangle((int(px0), int(py0), int(px0 + pw), int(py0 + ph)), fill=1)
        dm = max(p for _, p in boxes)
        holes = Image.new("L", (win_w, win_h), 0); hd = ImageDraw.Draw(holes)
        d = ImageDraw.Draw(out)
        rects = []
        for (x0, y0, x1, y1), p in boxes:
            if p <= 0: continue
            X0 = ox + x0 * scale - 6; Y0 = oy + y0 * scale - 6; X1 = ox + x1 * scale + 6; Y1 = oy + y1 * scale + 6
            rects.append((X0, Y0, X1, Y1, p))
            hd.rectangle((X0, Y0, X1, Y1), fill=1)
        # 框外轻微压暗（不改动照片文字）
        a = int(95 * ease(dm))
        sel = np.array(mask, bool) & ~np.array(holes, bool)
        arr = np.zeros((win_h, win_w, 4), np.uint8); arr[sel, 3] = a
        out.alpha_composite(Image.fromarray(arr))
        d = ImageDraw.Draw(out)
        for X0, Y0, X1, Y1, p in rects:
            q = ease_out(p)
            xm = X0 + (X1 - X0) * q
            lw = max(3, int(scale * 1.3))
            d.rectangle((X0, Y0, xm, Y1), outline=RED + (255,), width=lw)
    return out


def scene3(t):
    s = SEGS[2]; r = t - s['start']
    f = paper(); heading(f, "园规真相")
    win_w, win_h, wx, wy = 1000, 860, 40, 340
    s0 = 840 / 465; s1 = 1000 / 342
    p0 = ct(2, 1) + 2.0; p1 = ct(2, 2) - 0.2
    z = ease((t - p0) / (p1 - p0))
    sc = s0 + (s1 - s0) * z
    cy = 232 + (125 - 232) * z
    b1 = (t - ct(2, 2)) / 0.6; b4 = (t - ct(2, 3)) / 0.6
    view = reg_view(sc, cy, win_w, win_h, [(ROW1, b1), (ROW4, b4)])
    # 窗口底衬
    dw = min(win_w, 342 * sc); dh = min(win_h, 465 * sc)
    put(f, shadow(int(dw), int(dh)), wx + (win_w - dw) / 2 - 28, wy + (win_h - dh) / 2 - 28)
    put(f, view, wx, wy)
    put(f, label("外滩公园园规告示"), 40, 1225, fade(r, 0.3))
    a1 = fade(t, ct(2, 2) + 0.2)
    put(f, card((("园规第一条", RED), (" · 专供外侨使用", INK))), 60, 1295 + (1 - a1) * 20, a1)
    a4 = fade(t, ct(2, 3) + 0.2)
    put(f, card((("园规第四条", RED), (" · 狗与自行车不得入内", INK))), 60, 1400 + (1 - a4) * 20, a4)
    return f


def draw_gate(d, cx, base_y, leaf_w, leaf_h, open_p, color, pillar_w=46):
    """铁门：两根门柱 + 两扇门（open_p 0 关 → 1 开）"""
    lx = cx - leaf_w - pillar_w; rx = cx + leaf_w
    top = base_y - leaf_h
    for px in (lx, rx):
        d.rectangle((px, top - 60, px + pillar_w, base_y), fill=color)
        d.rectangle((px - 8, top - 74, px + pillar_w + 8, top - 56), fill=color)
        d.ellipse((px + pillar_w / 2 - 16, top - 110, px + pillar_w / 2 + 16, top - 78), fill=color)
    k = 1 - 0.82 * ease(open_p)
    for side in (-1, 1):
        hinge = (lx + pillar_w) if side == -1 else rx
        ww = leaf_w * k
        x0, x1 = (hinge, hinge + ww) if side == -1 else (hinge - ww, hinge)
        sk = 26 * ease(open_p)  # 透视收缩
        far = x1 if side == -1 else x0
        def yt(x):
            return top + (sk if (x == far) else 0)
        def yb(x):
            return base_y - (sk * 0.5 if (x == far) else 0)
        lw = 6
        d.line([(x0, yt(x0)), (x1, yt(x1))], fill=color, width=lw)
        d.line([(x0, yb(x0)), (x1, yb(x1))], fill=color, width=lw)
        d.line([(x0, (yt(x0) + yb(x0)) / 2), (x1, (yt(x1) + yb(x1)) / 2)], fill=color, width=4)
        nb = 9
        for i in range(nb + 1):
            u = i / nb
            x = x0 + (x1 - x0) * u
            ytop = yt(x0) + (yt(x1) - yt(x0)) * u
            ybot = yb(x0) + (yb(x1) - yb(x0)) * u
            d.line([(x, ytop - 22), (x, ybot)], fill=color, width=4)
            d.polygon([(x - 7, ytop - 20), (x + 7, ytop - 20), (x, ytop - 38)], fill=color)


@functools.lru_cache(None)
def gate_paths_panel(w, h):
    """镜4 示意：铁门内两条小径（静态底图）"""
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 14, fill=(246, 240, 226, 255), outline=INK + (255,), width=2)
    # 园内树丛（墨点）
    rng = random.Random(4)
    for _ in range(26):
        x = rng.uniform(40, w - 40); y = rng.uniform(30, h * 0.36); rr = rng.uniform(22, 48)
        d.ellipse((x - rr, y - rr * 0.8, x + rr, y + rr * 0.8), fill=(96, 120, 104, 120))
    gx = w / 2
    gy = h - 70
    # 两条小径（从门口分叉向园内）
    for side in (-1, 1):
        pts = []
        for i in range(40):
            u = i / 39
            x = gx + side * (30 + 300 * u ** 0.8) + side * 40 * math.sin(u * 3.2)
            y = gy - 40 - (gy - 120) * u
            pts.append((x, y))
        for wdt, col in ((44, (214, 200, 170, 255)), (34, (230, 220, 196, 255))):
            d.line(pts, fill=col, width=int(wdt), joint="curve")
    draw_gate(d, gx, gy + 40, 120, 150, 0.6, INK + (255,), pillar_w=30)
    d.line([(20, gy + 40), (w - 20, gy + 40)], fill=INK + (255,), width=3)
    return im


def scene4(t):
    s = SEGS[3]; r = t - s['start']
    f = paper(); heading(f, "谁能进园")
    sc = 470 / 342
    b = [(ROW1, 1.0), (ROW4, 1.0)]
    view = reg_view(sc, 232, 470, int(465 * sc) + 2, b)
    put(f, shadow(470, int(465 * sc)), 40 - 28, 345 - 28)
    put(f, view, 40, 345)
    # 右栏：两条分开
    a1 = fade(t, ct(3, 0) + 0.9)
    a2 = fade(t, ct(3, 0) + 0.9 + len("看清楚了：华人进不去，写在第一条；") / SD.SPEED)
    y1, y2 = 420, 600
    put(f, card((("第一条", RED), ("  华人进不去", INK)), size=42, bar=False, padx=22), 560, y1, a1)
    put(f, card((("第四条", RED), ("  狗进不去", INK)), size=42, bar=False, padx=22), 560, y2, a2)
    d = ImageDraw.Draw(f)
    # 连线：照片原行 → 字卡
    r1y = 345 + (ROW1[1] + ROW1[3]) / 2 * sc; r4y = 345 + (ROW4[1] + ROW4[3]) / 2 * sc
    if a1 > 0:
        d.line([(40 + ROW1[2] * sc + 8, r1y), (556, y1 + 42)], fill=RED + (int(255 * a1),), width=3)
    if a2 > 0:
        d.line([(40 + ROW4[2] * sc + 8, r4y), (556, y2 + 42)], fill=RED + (int(255 * a2),), width=3)
    a3 = (t - ct(3, 1) - 0.2) / 0.3
    if a3 > 0:
        sc3 = 1.5 - 0.5 * ease_out(a3)
        sm = seal("不在同一条", 92, rot=-4, seed=8)
        sm = sm.resize((int(sm.size[0] * sc3), int(sm.size[1] * sc3)), Image.BICUBIC)
        put(f, sm, 790, 830, clamp(a3 * 1.6), "mm")
    # 下方示意：铁门内两条小径
    pa = fade(t, ct(3, 2) - 0.2, 0.6)
    pw, ph, px, py = 1000, 470, 40, 1015
    if pa > 0:
        put(f, gate_paths_panel(pw, ph), px, py, pa)
        put(f, shiyi_tag(), px + pw - 16, py + 16, pa, "rt")
        l1 = fade(t, ct(3, 2) + len("能进园的中国人只有两种：") / SD.SPEED)
        put(f, card("阿妈 · 仆佣", size=40, bar=False, padx=20, pady=10), px + 110, py + 150, pa * l1)
        l2 = fade(t, ct(3, 3) + 0.6)
        put(f, card("凭券入园", size=40, bar=False, padx=20, pady=10), px + pw - 110, py + 150, pa * l2, "rt")
    return f


# ---------------------------------------------------------------- 镜 5
@functools.lru_cache(None)
def clipping(quote, byline, w=880, h=250, seed=1, rot=0.0):
    rng = random.Random(seed)
    im = Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    # 撕边轮廓
    pts = []
    for i in range(0, w + 1, 14): pts.append((20 + i, 20 + rng.uniform(-4, 4)))
    for i in range(0, h + 1, 14): pts.append((20 + w + rng.uniform(-4, 4), 20 + i))
    for i in range(w, -1, -14): pts.append((20 + i, 20 + h + rng.uniform(-4, 4)))
    for i in range(h, -1, -14): pts.append((20 + rng.uniform(-4, 4), 20 + i))
    ImageDraw.Draw(sh).polygon([(x + 6, y + 8) for x, y in pts], fill=(40, 30, 20, 90))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)))
    d = ImageDraw.Draw(im)
    d.polygon(pts, fill=(232, 224, 203, 255))
    # 报纸栏线（无可读假文字）
    d.line([(50, 52), (w - 10, 52)], fill=(90, 85, 75, 255), width=3)
    d.line([(50, 60), (w - 10, 60)], fill=(90, 85, 75, 255), width=1)
    for k in range(3):
        y = h - 18 - k * 14
        d.line([(50, y), (w - 10, y)], fill=(170, 160, 140, 160), width=4)
    q = text_img(quote, SERIF_K, 70, INK)
    im.alpha_composite(q, ((w + 40 - q.size[0]) // 2, 78))
    b = text_img(byline, SERIF_B, 40, RED)
    im.alpha_composite(b, (w + 40 - b.size[0] - 50, 168))
    if rot:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    return im


@functools.lru_cache(None)
def empty_frame(w=440, h=320):
    im = Image.new("RGBA", (w + 60, h + 60), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((34, 38, w + 34, h + 38), fill=(40, 30, 20, 110))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(im)
    d.rectangle((30, 30, w + 30, h + 30), fill=(70, 52, 38, 255))
    d.rectangle((44, 44, w + 16, h + 16), outline=(150, 120, 80, 255), width=3)
    d.rectangle((62, 62, w - 2, h - 2), fill=(236, 232, 222, 255))
    d.rectangle((62, 62, w - 2, h - 2), outline=(190, 180, 160, 255), width=2)
    t = text_img("照片：无", SERIF_K, 56, RED)
    im.alpha_composite(t, ((w + 60 - t.size[0]) // 2, (h + 60 - t.size[1]) // 2))
    return im


def drop_in(f, img, x, y, t, t0, anchor="mt"):
    p = (t - t0) / 0.5
    if p <= 0: return
    sc = 1.12 - 0.12 * ease_out(p)
    im = img if sc == 1 else img.resize((int(img.size[0] * sc), int(img.size[1] * sc)), Image.BICUBIC)
    put(f, im, x, y - (1 - ease_out(p)) * 40, clamp(p * 2), anchor)


def scene5(t):
    s = SEGS[4]; r = t - s['start']
    f = paper(); heading(f, "传闻怎么来的")
    put(f, shiyi_tag(), 1040, 160, fade(r, 0.2), "rt")
    a = fade(t, ct(4, 0) - 0.4)
    put(f, text_img("「华人与狗不得入内」", SERIF_K, 64, INK), 540, 360, a, "mt")
    put(f, text_img("—— 传闻中的说法", SERIF_B, 34, RED), 960, 455, a, "rt")
    drop_in(f, clipping("「华人与犬不得入内」", "1923 蔡和森", seed=2, rot=-2.0), 540, 520, t, ct(4, 2) + 0.4)
    drop_in(f, clipping("「狗同中国人不许入」", "1924 孙中山", seed=5, rot=1.6), 540, 800, t, ct(4, 3) + 1.0)
    drop_in(f, empty_frame(), 540, 1090, t, ct(4, 4) + 2.2)
    return f


# ---------------------------------------------------------------- 镜 6
@functools.lru_cache(None)
def tax_panel(w, h):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 14, fill=(244, 237, 220, 255), outline=INK + (255,), width=2)
    # 铁门剪影（关着）
    gl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_gate(ImageDraw.Draw(gl), w * 0.64, h - 60, 170, 360, 0.0, INK + (235,), pillar_w=40)
    ImageDraw.Draw(gl).rectangle((20, h - 62, w - 20, h - 54), fill=INK + (235,))
    im.alpha_composite(gl)
    # 捐税单据（示意纸面）
    slip = Image.new("RGBA", (330, 440), (0, 0, 0, 0))
    sd = ImageDraw.Draw(slip)
    sd.rectangle((0, 0, 329, 439), fill=(250, 244, 228, 255), outline=(120, 90, 60, 255), width=3)
    sd.rectangle((14, 14, 315, 425), outline=(184, 120, 100, 255), width=2)
    tt = text_img("捐 税", SERIF_K, 64, INK)
    slip.alpha_composite(tt, ((330 - tt.size[0]) // 2, 34))
    for k in range(7):
        y = 150 + k * 36
        sd.line([(40, y), (290, y)], fill=(180, 165, 140, 255), width=2)
    sl = seal("纳", 96, seed=11, rot=-12)
    slip.alpha_composite(sl, (190, 300))
    slip = slip.rotate(5, resample=Image.BICUBIC, expand=True)
    sh = shadow(330, 440, 10, 70)
    im.alpha_composite(sh, (40, 60))
    im.alpha_composite(slip, (52, 66))
    return im


def scene6(t):
    s = SEGS[5]; r = t - s['start']
    f = paper(); heading(f, "为什么传得牢")
    sw = ct(5, 1) + 1.0
    xf = ease((t - sw) / 0.9)
    if xf < 1:
        z = 1.0 + 0.14 * ease(r / 9)
        img = kenburns("public_gardens_view.jpg", 1000, 663, z, 600 - 20 * ease(r / 9), 398 + 120 * ease(r / 9))
        mounted(f, img, 40, 370, 1 - xf)
        put(f, label("公共花园"), 40, 1070, 1 - xf)
    if xf > 0:
        put(f, tax_panel(1000, 683), 40, 360, xf)
        put(f, shiyi_tag(), 1024, 376, xf, "rt")
    a = fade(t, ct(5, 2) - 0.1, 0.5)
    put(f, card((("纳税有份", INK), (" · ", INK), ("入园无门", RED)), size=64, padx=40, pady=20), 540, 1135 + (1 - a) * 24, a, "mt")
    return f


# ---------------------------------------------------------------- 镜 7
CROWD = []
_rng = random.Random(77)
for i in range(70):
    CROWD.append(dict(t0=_rng.uniform(0, 14), lane=_rng.uniform(-1, 1), sz=_rng.uniform(0.75, 1.25),
                      spd=_rng.uniform(0.13, 0.2), sway=_rng.uniform(0, 6.28)))


def scene7(t):
    s = SEGS[6]; r = t - s['start']
    f = paper(); heading(f, "开放")
    pw, ph, px, py = 1000, 830, 40, 350
    panel = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    d = ImageDraw.Draw(panel)
    d.rounded_rectangle((0, 0, pw - 1, ph - 1), 14, fill=(244, 238, 222, 255), outline=INK + (255,), width=2)
    # 园内远景：墨点树
    rng = random.Random(9)
    for _ in range(30):
        x = rng.uniform(150, pw - 150); y = rng.uniform(150, 330); rr = rng.uniform(26, 56)
        d.ellipse((x - rr, y - rr * 0.8, x + rr, y + rr * 0.8), fill=(96, 120, 104, 110))
    gx, gbase = pw / 2, 520
    d.line([(16, gbase), (pw - 16, gbase)], fill=INK + (255,), width=4)
    # 地面透视线
    for k in (-1, 1):
        d.line([(gx + k * 170, gbase), (gx + k * 520, ph - 2)], fill=(150, 140, 120, 160), width=2)
    op = ease((t - ct(6, 2) - 0.2) / 3.2)
    draw_gate(d, gx, gbase, 170, 330, op, INK + (255,), pillar_w=40)
    # 人流剪影（走向门内）
    walk0 = ct(6, 2) + 1.6
    if t > walk0:
        lay = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        tw = t - walk0
        figs = []
        for c in CROWD:
            u = (tw - c['t0']) * c['spd']
            if u <= 0 or u >= 1: continue
            depth = u
            y = ph + 40 - (ph + 40 - gbase + 10) * ease_out(depth)
            spread = 420 * (1 - depth) + 120 * depth
            x = gx + c['lane'] * spread
            s_ = c['sz'] * (1.25 - 0.85 * depth)
            al = int(225 * clamp((1 - depth) * 6) * clamp(u * 8))
            figs.append((y, x, s_, al, c))
        for y, x, s_, al, c in sorted(figs, key=lambda q: q[0]):
            bob = math.sin(tw * 7 + c['sway']) * 3 * s_
            hr = 15 * s_
            col = (35, 45, 60, al)
            ld.ellipse((x - hr, y - 118 * s_ - hr * 2 + bob, x + hr, y - 118 * s_ + bob), fill=col)
            ld.rounded_rectangle((x - 26 * s_, y - 112 * s_ + bob, x + 26 * s_, y - 30 * s_ + bob), int(14 * s_), fill=col)
            ld.rectangle((x - 18 * s_, y - 34 * s_ + bob, x + 18 * s_, y), fill=col)
        panel.alpha_composite(lay)
    put(f, panel, px, py)
    put(f, shiyi_tag(), px + pw - 16, py + 16, 1, "rt")
    a1 = fade(t, ct(6, 1) + 0.3)
    put(f, card((("1928 年 4 月", RED), (" · 租界纳税人年会作出决定", INK)), size=40), 60, 1215 + (1 - a1) * 20, a1)
    a2 = fade(t, ct(6, 2) + 0.2)
    put(f, card((("1928 年 6 月 1 日", RED), (" · 公园向中国人开放", INK)), size=48), 60, 1320 + (1 - a2) * 20, a2)
    return f


# ---------------------------------------------------------------- 镜 8
@functools.lru_cache(None)
def river_plate(w, h):
    """柔焦江景示意（不含任何文字）"""
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    arr = np.zeros((h, w, 4), np.float32)
    yy = np.linspace(0, 1, h)[:, None]
    sky_top = np.array([214, 206, 190]); sky_bot = np.array([236, 220, 196])
    water_top = np.array([150, 160, 160]); water_bot = np.array([105, 120, 128])
    hz = 0.52
    sky = sky_top + (sky_bot - sky_top) * (yy / hz)
    wat = water_top + (water_bot - water_top) * ((yy - hz) / (1 - hz))
    col = np.where(yy < hz, sky, wat)
    arr[..., :3] = np.broadcast_to(col[:, None, :] if col.ndim == 2 else col, (h, w, 3))
    arr[..., 3] = 255
    im = Image.fromarray(arr.astype(np.uint8))
    d = ImageDraw.Draw(im)
    rng = random.Random(5)
    x = 0
    while x < w:  # 天际线剪影
        bw = rng.uniform(30, 90); bh = rng.uniform(40, 200)
        d.rectangle((x, hz * h - bh, x + bw, hz * h), fill=(120, 125, 130, 255))
        x += bw + rng.uniform(0, 12)
    d.polygon([(w * 0.18, hz * h), (w * 0.2, hz * h - 330), (w * 0.22, hz * h)], fill=(110, 112, 118, 255))  # 远塔轮廓
    for _ in range(60):
        yy_ = rng.uniform(hz * h + 10, h - 10); xx_ = rng.uniform(0, w); L = rng.uniform(40, 160)
        d.line([(xx_, yy_), (xx_ + L, yy_)], fill=(220, 214, 196, 150), width=3)
    im = im.filter(ImageFilter.GaussianBlur(14))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), 14, fill=255)
    im.putalpha(mask)
    return im


def endcard(t):
    f = paper()
    r = t - SEGS[7]['endcard']
    a = fade(r, 0.2, 0.6)
    put(f, seal("租界百年", 170, seed=21), 540, 600 + (1 - a) * 30, a, "mt")
    b = fade(r, 0.9, 0.6)
    put(f, text_img("下一集", SERIF_B, 54, (110, 100, 85)), 540, 900, b, "mt")
    put(f, text_img("十里洋场", SERIF_K, 128, INK), 540, 985 + (1 - b) * 20, b, "mt")
    bar = Image.new("RGBA", (380, 6), RED + (255,))
    put(f, bar, 540, 1170, b, "mt")
    return f


def scene8(t):
    s = SEGS[7]; r = t - s['start']
    ec = s['endcard']
    xf = ease((t - ec) / 0.7)
    if xf >= 1:
        return endcard(t)
    f = paper(); heading(f, "两头都说清")
    pw, ph, px, py = 1000, 700, 40, 350
    plate = river_plate(pw + 80, ph)
    off = int(40 * math.sin(r / 9))
    pl = plate.crop((40 + off, 0, 40 + off + pw, ph))
    put(f, pl, px, py)
    m1 = s['start'] + 0.4
    m2 = ct(7, 1) + 3.5
    a1 = fade(t, m1) * (1 - fade(t, m2 - 0.3, 0.3))
    a2 = fade(t, m2)
    put(f, label("上海市人民英雄纪念塔"), px, py + ph + 25, a1)
    put(f, label("外滩历史纪念馆"), px, py + ph + 25, a2)
    c1 = fade(t, ct(7, 1) + 0.2)
    put(f, card((("那块牌子", RED), (" · 没证据证明存在过", INK)), size=44), 60, 1175 + (1 - c1) * 20, c1)
    c2 = fade(t, ct(7, 1) + len("那块牌子，没证据证明存在过；") / SD.SPEED)
    put(f, card((("那道铁门", RED), (" · 实实在在关了几十年", INK)), size=44), 60, 1285 + (1 - c2) * 20, c2)
    if xf > 0:
        return Image.blend(f, endcard(t), xf)
    return f


SCENES = [scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8]


# ---------------------------------------------------------------- 字幕 / 水印
SUB_EVENTS = []
for si, s in enumerate(SEGS):
    for c in s['chunks']:
        for g0, g1, lines in c['groups']:
            SUB_EVENTS.append((g0, g1, tuple(lines)))


@functools.lru_cache(None)
def sub_img(lines):
    ims = [text_img(l, SANS_B, 56, (255, 255, 255), stroke=5, stroke_color=(20, 22, 28)) for l in lines]
    w = max(i.size[0] for i in ims); lh = 78
    out = Image.new("RGBA", (w, lh * len(ims) + 10), (0, 0, 0, 0))
    for k, i in enumerate(ims):
        out.alpha_composite(i, ((w - i.size[0]) // 2, k * lh))
    return out


SUB_SHOW = []
for k, (g0, g1, lines) in enumerate(SUB_EVENTS):
    nxt = SUB_EVENTS[k + 1][0] if k + 1 < len(SUB_EVENTS) else 1e9
    SUB_SHOW.append((g0, min(g1 + 0.3, nxt), lines))


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
    # 段间叠化 0.5s（以分界点为中心）
    XF = 0.25
    if si + 1 < len(SEGS) and t > SEGS[si + 1]['start'] - XF:
        w = (t - (SEGS[si + 1]['start'] - XF)) / (2 * XF)
        f = Image.blend(f, SCENES[si + 1](t), ease(w))
    elif si > 0 and t < s_start(si) + XF:
        w = (t - (s_start(si) - XF)) / (2 * XF)
        f = Image.blend(SCENES[si - 1](t), f, ease(w))
    subtitles(f, t)
    put(f, watermark(), W - 36, H - 150, 0.5, "rt")
    return f.convert("RGB")


def s_start(i):
    return SEGS[i]['start']


def scene_frames():
    b = [int(round(s['start'] * FPS)) for s in SEGS] + [NFRAMES]
    return [(b[i], b[i + 1]) for i in range(len(SEGS))]


if __name__ == "__main__":
    import subprocess
    mode = sys.argv[1]
    if mode == "still":
        for tt in sys.argv[2:]:
            n = int(round(float(tt) * FPS))
            frame_at(n).save(f"/home/claude/work/still_{float(tt):07.2f}.jpg", quality=90)
    elif mode == "scene":
        i = int(sys.argv[2])
        a, b = scene_frames()[i]
        out = f"/home/claude/work/scenes/s{i+1}.mp4"
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
