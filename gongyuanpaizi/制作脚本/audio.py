# -*- coding: utf-8 -*-
"""配乐（古筝/笛子风，代码合成）与环境音效分轨；48kHz 立体声，24-bit FLAC"""
import math, subprocess, sys
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
import script_data as SD

SR = 48000
SEGS, TOTAL = SD.build()
NFRAMES = int(round(TOTAL * 24))
N = NFRAMES * SR // 24
LEN = N / SR
rng = np.random.default_rng(2026)


def ct(si, cj):
    return SEGS[si]['chunks'][cj]['start']


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def add(buf, sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[: N - i]
    l = math.cos((pan + 1) * math.pi / 4); r = math.sin((pan + 1) * math.pi / 4)
    buf[i:i + len(sig), 0] += sig * gain * l * 1.414
    buf[i:i + len(sig), 1] += sig * gain * r * 1.414


def reverb(x, secs=2.2, mix=0.28, seed=1):
    r = np.random.default_rng(seed)
    n = int(secs * SR)
    env = np.exp(-np.linspace(0, 7, n))
    out = np.zeros_like(x)
    for ch in range(2):
        ir = r.normal(0, 1, n) * env
        ir = lp(ir, 6000)
        ir /= np.sqrt(np.sum(ir ** 2))
        out[:, ch] = fftconvolve(x[:, ch], ir)[: len(x)]
    return x * (1 - mix) + out * mix * 1.6


# ---------------------------------------------------------------- 乐器
def zheng(freq, dur=3.0, bend=0.0):
    """Karplus-Strong 拨弦 + 可选按音滑音"""
    n = int(dur * SR)
    p = SR / freq
    L = int(p)
    buf = rng.uniform(-1, 1, L)
    buf = lp(buf, min(freq * 6, 9000), 1)
    out = np.zeros(n)
    # 简化：用分数延迟近似，滑音通过重采样实现
    idx = 0
    prev = 0.0
    decay = 0.996 if freq < 400 else 0.993
    for i in range(n):
        v = buf[idx]
        nxt = buf[(idx + 1) % L]
        newv = decay * 0.5 * (v + nxt)
        buf[idx] = newv
        out[i] = v
        idx = (idx + 1) % L
    if bend:
        tt = np.arange(n) / SR
        rate = 1 + bend * np.clip((tt - 0.25) / 0.35, 0, 1)
        pos = np.cumsum(rate)
        pos = pos[pos < n - 1]
        out = np.interp(pos, np.arange(n), out)
    env = np.minimum(1, np.arange(len(out)) / (0.002 * SR))
    out = out * env
    out[-2000:] *= np.linspace(1, 0, 2000)
    # 琴体共鸣
    body = bp(out, 180, 2400, 1)
    return (out * 0.6 + body * 0.6) * 0.5


def dizi(freq, dur, vib=5.2):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    vibr = 1 + 0.006 * np.sin(2 * math.pi * vib * tt) * np.clip((tt - 0.35) / 0.4, 0, 1)
    ph = 2 * math.pi * np.cumsum(freq * vibr) / SR
    tone = np.sin(ph) + 0.32 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph) + 0.05 * np.sin(4 * ph)
    breath = bp(rng.normal(0, 1, n), freq * 0.9, min(freq * 4, 16000), 2) * 0.25
    att = np.clip(tt / 0.12, 0, 1); rel = np.clip((dur - tt) / 0.35, 0, 1)
    swell = 0.85 + 0.15 * np.sin(math.pi * np.clip(tt / dur, 0, 1))
    return (tone + breath) * att * rel * swell * 0.22


def pad(f0, dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * math.pi * f0 * m * tt + rng.uniform(0, 6)) / m ** 1.4 for m in (1, 2, 3, 4))
    lfo = 0.75 + 0.25 * np.sin(2 * math.pi * 0.07 * tt)
    env = np.clip(tt / 3, 0, 1) * np.clip((dur - tt) / 3, 0, 1)
    return lp(s, 900) * lfo * env * 0.08


# 五声音阶（D 宫）
def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


PENTA = [62, 64, 66, 69, 71]  # D E F# A B
SCALE = [p + 12 * o for o in (-1, 0, 1) for p in PENTA]


def music():
    buf = np.zeros((N, 2))
    beat = 60 / 64
    # 低音铺底：按段变化
    roots = [50, 50, 45, 47, 47, 45, 50, 50]  # D D A B B A D D (低)
    for i, s in enumerate(SEGS):
        st = max(0, s['start'] - 1.5); en = min(LEN, s['end'] + 1.5)
        add(buf, pad(mtof(roots[i] - 12), en - st), st, 0.9)
        add(buf, pad(mtof(roots[i] - 5), en - st), st, 0.45, pan=0.3)
    # 古筝：每段一个节奏密度
    density = [0.55, 0.7, 0.65, 0.7, 0.5, 0.45, 0.85, 0.6]
    t = 0.05
    idx = 5
    while t < LEN - 3:
        si = max(i for i, s in enumerate(SEGS) if t >= s['start'] - 0.01)
        if si == 7 and t > SEGS[7]['endcard'] + 4:
            break
        if rng.random() < density[si]:
            step = rng.choice([-2, -1, -1, 1, 1, 2, 0])
            idx = int(np.clip(idx + step, 3, len(SCALE) - 3))
            note = SCALE[idx]
            if si in (4, 5):  # 段 5/6 偏羽调色彩（B/E 为重心）
                note = note if (note % 12) in (11, 4, 2, 9) or rng.random() < 0.5 else note - 2 if (note - 2) % 12 in (4, 11, 2, 9) else note
            bend = 0.06 if rng.random() < 0.12 else 0.0
            sig = zheng(mtof(note), 2.6, bend)
            add(buf, sig, t + rng.uniform(-0.01, 0.01), 0.55, pan=rng.uniform(-0.4, 0.4))
            if rng.random() < 0.18:  # 八度和音
                add(buf, zheng(mtof(note - 12), 2.6), t, 0.35, pan=-0.2)
        # 刮奏点缀：段首
        t += beat * (0.5 if rng.random() < 0.25 else 1.0)
    for s in SEGS[1:]:
        st = s['start'] - 0.6
        for k, nn in enumerate([62, 64, 66, 69, 71, 74, 76, 78]):
            add(buf, zheng(mtof(nn), 1.6), st + k * 0.045, 0.18, pan=-0.5 + k * 0.12)
    # 笛子：稀疏长音乐句
    phrases = [(SEGS[1]['start'] + 4, [74, 76, 78, 76, 74]), (SEGS[2]['start'] + 10, [81, 78, 76, 74]),
               (SEGS[4]['start'] + 6, [71, 74, 76, 74, 71]), (SEGS[5]['start'] + 12, [76, 74, 71, 69]),
               (SEGS[6]['start'] + 13, [74, 76, 78, 81, 83, 81]), (SEGS[7]['start'] + 3, [78, 76, 74]),
               (SEGS[7]['endcard'] + 0.5, [81, 78, 76, 74])]
    for st, notes in phrases:
        tt = st
        for k, nn in enumerate(notes):
            d = beat * (2 if k < len(notes) - 1 else 4)
            add(buf, dizi(mtof(nn), d + 0.25), tt, 0.5, pan=0.15)
            tt += d
    # 结尾和弦
    for nn in (50, 57, 62, 66, 69):
        add(buf, zheng(mtof(nn), 5.0), SEGS[7]['endcard'] + 6.0, 0.4)
    buf = reverb(buf, 2.4, 0.3, seed=3)
    # 首尾淡入淡出
    fi = int(0.15 * SR); fo = int(2.2 * SR)
    buf[:fi] *= np.linspace(0, 1, fi)[:, None]
    buf[-fo:] *= np.linspace(1, 0.02, fo)[:, None]
    return buf


# ---------------------------------------------------------------- 环境与音效
def noise(n):
    return rng.normal(0, 1, n)


def brown(n):
    x = np.cumsum(rng.normal(0, 1, n)); x = hp(x, 20, 1)
    return x / (np.std(x) + 1e-9)


def env_curve(points):
    """points: [(t, gain)] 线性插值"""
    ts = np.array([p[0] for p in points]); gs = np.array([p[1] for p in points])
    return np.interp(np.arange(N) / SR, ts, gs)


def thump(dur=0.35):
    n = int(dur * SR); tt = np.arange(n) / SR
    body = np.sin(2 * math.pi * (70 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 14)
    click = bp(noise(n), 800, 5000) * np.exp(-tt * 60) * 0.5
    return (body + click) * 0.9


def paper_swish(dur=0.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    e = np.sin(math.pi * np.clip(tt / dur, 0, 1)) ** 2
    return bp(noise(n), 1200, 7000) * e * 0.25


def tick(dur=0.08):
    n = int(dur * SR); tt = np.arange(n) / SR
    return bp(noise(n), 1500, 6000) * np.exp(-tt * 80) * 0.5


def chirp(f0=3200, dur=0.12):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = f0 * (1 + 0.35 * np.sin(math.pi * tt / dur))
    return np.sin(2 * math.pi * np.cumsum(f) / SR) * np.sin(math.pi * tt / dur) ** 2 * 0.25


def creak(dur=2.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = 95 + 25 * np.sin(2 * math.pi * 0.7 * tt) + 10 * rng.normal(0, 1, n).cumsum() / np.sqrt(np.arange(1, n + 1)) * 0
    ph = 2 * math.pi * np.cumsum(f) / SR
    saw = ((ph / (2 * math.pi)) % 1) * 2 - 1
    s = bp(saw, 300, 2500) * (0.6 + 0.4 * np.abs(np.sin(2 * math.pi * 3.1 * tt)))
    e = np.clip(tt / 0.2, 0, 1) * np.clip((dur - tt) / 0.5, 0, 1)
    return s * e * 0.18


def murmur(dur):
    """人声环境拟音：带通噪声 + 音节状包络叠加（不含可懂语言）"""
    n = int(dur * SR)
    out = np.zeros(n)
    for v in range(14):
        src = bp(noise(n), rng.uniform(250, 450), rng.uniform(1600, 3000), 2)
        rate = rng.uniform(3, 5.5)
        syl = (np.sin(2 * math.pi * rate * np.arange(n) / SR + rng.uniform(0, 6)) > rng.uniform(-0.2, 0.4)).astype(float)
        syl = lp(syl, 18, 1)
        out += src * np.clip(syl, 0, 1) * rng.uniform(0.5, 1)
    return out / (np.std(out) + 1e-9) * 0.035


def fx():
    buf = np.zeros((N, 2))
    # 底噪：远处江风 + 房间底（全程连续，非数字静音）
    base = np.stack([lp(brown(N), 600), lp(brown(N), 600)], 1) * 0.02
    buf += base
    # 江水：镜 2 / 镜 8 加重
    water = np.stack([bp(noise(N), 150, 1200), bp(noise(N), 150, 1200)], 1)
    lap = 0.6 + 0.4 * np.sin(2 * math.pi * 0.23 * np.arange(N) / SR)
    s2, s8 = SEGS[1], SEGS[7]
    g = env_curve([(0, 0.004), (s2['start'], 0.004), (s2['start'] + 1.5, 0.02), (ct(1, 1), 0.02),
                   (ct(1, 1) + 1.5, 0.008), (s2['end'], 0.006), (s8['start'], 0.006), (s8['start'] + 2, 0.022),
                   (s8['endcard'], 0.02), (s8['endcard'] + 2, 0.006), (LEN, 0.004)])
    buf += water * (g * lap)[:, None]
    # 鸟鸣：版画段、园景照片段
    for (a, b) in [(ct(1, 1), SEGS[1]['end']), (SEGS[5]['start'], ct(5, 1) + 1.5)]:
        t = a + 0.5
        while t < b:
            for k in range(rng.integers(1, 4)):
                add(buf, chirp(rng.uniform(2600, 4200), rng.uniform(0.07, 0.14)), t + k * 0.13, 0.35, rng.uniform(-0.7, 0.7))
            t += rng.uniform(1.2, 3.5)
    # 镜 1：落字轻响 + 问号印章
    for i in range(8):
        add(buf, tick(), 0.12 + i * 0.17 + 0.3, 0.6, -0.3 + i * 0.08)
    add(buf, thump(), 2.4 + 0.2, 0.75)
    # 转场纸声
    for s in SEGS[1:]:
        add(buf, paper_swish(), s['start'] - 0.3, 0.8, rng.uniform(-0.3, 0.3))
    add(buf, paper_swish(), SEGS[7]['endcard'], 0.7)
    # 镜 3 高亮框 / 镜 4 印章
    add(buf, tick(0.12), ct(2, 2) + 0.05, 0.5)
    add(buf, tick(0.12), ct(2, 3) + 0.05, 0.5)
    add(buf, thump(), ct(3, 1) + 0.2 + 0.18, 0.7)
    # 镜 5：剪报、相框落下
    add(buf, paper_swish(0.45), ct(4, 2) + 0.4, 0.9, -0.2)
    add(buf, paper_swish(0.45), ct(4, 3) + 1.0, 0.9, 0.2)
    add(buf, thump(0.3), ct(4, 4) + 2.2 + 0.25, 0.45)
    # 镜 6：盖章
    add(buf, paper_swish(), ct(5, 1) + 1.0, 0.6)
    # 镜 7：开门 + 人声环境（点到为止）
    add(buf, creak(3.2), ct(6, 2) + 0.2, 0.6, 0.0)
    w0 = ct(6, 2) + 1.4; w1 = SEGS[6]['end'] + 0.6
    m = murmur(w1 - w0)
    e = np.clip((np.arange(len(m)) / SR) / 2.0, 0, 1) * np.clip(((w1 - w0) - np.arange(len(m)) / SR) / 1.6, 0, 1)
    mm = m * e
    i0 = int(w0 * SR)
    buf[i0:i0 + len(mm), 0] += mm * 0.9
    buf[i0:i0 + len(mm), 1] += np.roll(mm, 240) * 0.9
    # footsteps-ish 软脚步
    t = w0 + 0.5
    while t < w1 - 1:
        add(buf, lp(tick(0.06), 1500) * 0.6, t, 0.18, rng.uniform(-0.6, 0.6))
        t += rng.uniform(0.12, 0.35)
    buf = reverb(buf, 1.2, 0.18, seed=9)
    fi = int(0.05 * SR); fo = int(2.0 * SR)
    buf[:fi] *= np.linspace(0, 1, fi)[:, None]
    buf[-fo:] *= np.linspace(1, 0.2, fo)[:, None]
    return buf


def norm_rms(x, db):
    r = np.sqrt(np.mean(x ** 2))
    x = x * (10 ** (db / 20) / r)
    pk = np.max(np.abs(x))
    if pk > 0.89:
        x = x * 0.89 / pk
    return x


def write_flac(x, path):
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                          "-c:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24", path], stdin=subprocess.PIPE)
    p.stdin.write(x.astype(np.float32).tobytes()); p.stdin.close()
    assert p.wait() == 0


if __name__ == "__main__":
    out = sys.argv[1]
    m = norm_rms(music(), -24.0)
    write_flac(m, f"{out}/stem_music.flac")
    f = norm_rms(fx(), -34.0)
    write_flac(f, f"{out}/stem_fx_ambience.flac")
    print("samples", N, "secs", LEN)
