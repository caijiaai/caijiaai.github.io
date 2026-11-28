# -*- coding: utf-8 -*-
"""配乐与环境音效分轨（全部代码合成，无外部采样）；48kHz 立体声 24-bit FLAC
白天（跑马厅/南京路）：古筝 + 笛子；黄昏过渡；夜里（大世界/百乐门）：摇摆爵士小乐队"""
import math, subprocess, sys
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
import script_data as SD

SR = 48000
SEGS, TOTAL = SD.build()
NFRAMES = int(round(TOTAL * 24))
N = NFRAMES * SR // 24
LEN = N / SR
rng = np.random.default_rng(2027)


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
    if i >= N or i < 0: return
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
        ir = lp(r.normal(0, 1, n) * env, 6000)
        ir /= np.sqrt(np.sum(ir ** 2))
        out[:, ch] = fftconvolve(x[:, ch], ir)[: len(x)]
    return x * (1 - mix) + out * mix * 1.6


def env_curve(points):
    ts = np.array([p[0] for p in points]); gs = np.array([p[1] for p in points])
    return np.interp(np.arange(N) / SR, ts, gs)


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- 乐器
def pluck(freq, dur=2.6, decay=None, bright=6.0):
    """Karplus-Strong 拨弦（古筝 / 低音提琴共用）"""
    n = int(dur * SR)
    L = max(2, int(SR / freq))
    buf = lp(rng.uniform(-1, 1, L), min(freq * bright, 9000), 1)
    decay = decay if decay is not None else (0.996 if freq < 400 else 0.993)
    reps = n // L + 1
    out = np.empty(reps * L)
    cur = buf.copy()
    for k in range(reps):  # 按周期向量化
        out[k * L:(k + 1) * L] = cur
        cur = decay * 0.5 * (cur + np.roll(cur, -1))
    out = out[:n]
    out *= np.minimum(1, np.arange(n) / (0.002 * SR))
    out[-1500:] *= np.linspace(1, 0, 1500)
    return out


def zheng(freq, dur=2.6):
    o = pluck(freq, dur)
    return (o * 0.6 + bp(o, 180, 2400, 1) * 0.6) * 0.5


def dizi(freq, dur, vib=5.2):
    n = int(dur * SR); tt = np.arange(n) / SR
    vibr = 1 + 0.006 * np.sin(2 * math.pi * vib * tt) * np.clip((tt - 0.35) / 0.4, 0, 1)
    ph = 2 * math.pi * np.cumsum(freq * vibr) / SR
    tone = np.sin(ph) + 0.32 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph) + 0.05 * np.sin(4 * ph)
    breath = bp(rng.normal(0, 1, n), freq * 0.9, min(freq * 4, 16000), 2) * 0.25
    att = np.clip(tt / 0.12, 0, 1); rel = np.clip((dur - tt) / 0.35, 0, 1)
    return (tone + breath) * att * rel * 0.22


def pad(f0, dur, bright=900):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * math.pi * f0 * m * tt + rng.uniform(0, 6)) / m ** 1.4 for m in (1, 2, 3, 4))
    lfo = 0.75 + 0.25 * np.sin(2 * math.pi * 0.07 * tt)
    env = np.clip(tt / 3, 0, 1) * np.clip((dur - tt) / 3, 0, 1)
    return lp(s, bright) * lfo * env * 0.08


def piano(freq, dur=1.2):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = 0
    for m, a in ((1, 1.0), (2, 0.45), (3, 0.22), (4, 0.12), (5, 0.06)):
        s = s + a * np.sin(2 * math.pi * freq * m * 1.0006 ** m * tt) * np.exp(-tt * (2.2 + m * 0.9))
    att = np.clip(tt / 0.004, 0, 1); rel = np.clip((dur - tt) / 0.08, 0, 1)
    return s * att * rel * 0.18


def horn(freq, dur):
    """弱音小号/单簧管感的长音（锯齿 + 低通 + 颤音）"""
    n = int(dur * SR); tt = np.arange(n) / SR
    vib = 1 + 0.005 * np.sin(2 * math.pi * 5.5 * tt) * np.clip((tt - 0.25) / 0.3, 0, 1)
    ph = np.cumsum(freq * vib) / SR
    saw = 2 * (ph % 1) - 1
    s = lp(saw, freq * 3.2, 2)
    att = np.clip(tt / 0.06, 0, 1); rel = np.clip((dur - tt) / 0.12, 0, 1)
    return s * att * rel * 0.16


def ride(dur=0.5):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = bp(rng.normal(0, 1, n), 5000, 12000) * np.exp(-tt * 9)
    s += 0.25 * sum(np.sin(2 * math.pi * f * tt) for f in (3170, 4310, 5530)) * np.exp(-tt * 7)
    return s * 0.12


def brush(dur=0.18):
    n = int(dur * SR); tt = np.arange(n) / SR
    e = np.clip(tt / 0.03, 0, 1) * np.exp(-tt * 18)
    return bp(rng.normal(0, 1, n), 1500, 7000) * e * 0.12


def kick(dur=0.3):
    n = int(dur * SR); tt = np.arange(n) / SR
    return np.sin(2 * math.pi * (55 + 50 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 12) * 0.35


PENTA = [62, 64, 66, 69, 71]  # D 宫五声
SCALE = [p + 12 * o for o in (-1, 0, 1) for p in PENTA]


def day_music(buf, t_end):
    beat = 60 / 72
    roots = [50, 50, 45, 47, 47, 45]
    for i in range(6):
        s = SEGS[i]
        st = max(0, s['start'] - 1.5); en = min(t_end + 2, s['end'] + 1.5)
        if st >= en: continue
        add(buf, pad(mtof(roots[i] - 12), en - st), st, 0.9)
        add(buf, pad(mtof(roots[i] - 5), en - st), st, 0.45, pan=0.3)
    density = [0.6, 0.72, 0.6, 0.78, 0.7, 0.5]
    t = 0.05; idx = 5
    while t < t_end:
        si = max(i for i, s in enumerate(SEGS) if t >= s['start'] - 0.01)
        if si > 5: break
        if rng.random() < density[si]:
            idx = int(np.clip(idx + rng.choice([-2, -1, -1, 1, 1, 2, 0]), 3, len(SCALE) - 3))
            note = SCALE[idx]
            fade_k = 1.0 if t < t_end - 6 else max(0.0, (t_end - t) / 6)
            add(buf, zheng(mtof(note)), t + rng.uniform(-0.01, 0.01), 0.55 * fade_k, pan=rng.uniform(-0.4, 0.4))
            if rng.random() < 0.18:
                add(buf, zheng(mtof(note - 12)), t, 0.35 * fade_k, pan=-0.2)
        t += beat * (0.5 if rng.random() < 0.3 else 1.0)
    for s in SEGS[1:6]:  # 段首刮奏
        for k, nn in enumerate([62, 64, 66, 69, 71, 74, 76, 78]):
            add(buf, zheng(mtof(nn), 1.6), s['start'] - 0.6 + k * 0.045, 0.18, pan=-0.5 + k * 0.12)
    phrases = [(SEGS[1]['start'] + 5, [74, 76, 78, 76, 74]), (SEGS[2]['start'] + 6, [81, 78, 76, 74]),
               (SEGS[3]['start'] + 14, [74, 76, 78, 81, 78]), (SEGS[4]['start'] + 8, [71, 74, 76, 74, 71]),
               (SEGS[5]['start'] + 4, [76, 74, 71, 69])]
    for st, notes in phrases:
        tt = st
        for k, nn in enumerate(notes):
            d = beat * (2 if k < len(notes) - 1 else 4)
            add(buf, dizi(mtof(nn), d + 0.25), tt, 0.5, pan=0.15)
            tt += d


# 夜：F 大调摇摆（ii-V-I 循环），与五声段落以长交叉淡化衔接
PROG = [(65, [65, 69, 72, 76]), (62, [62, 65, 69, 72]), (67, [67, 70, 74, 77]), (60, [64, 67, 70, 74])]  # Fmaj7 Dm7 Gm7 C9(无根)


def night_music(buf, t0, t_end):
    beat = 60 / 118
    sw = beat * 0.66  # 摇摆八分
    t = t0; bar = 0
    lead_bars = {4, 5, 6, 12, 13, 14, 20, 21, 22, 28, 29, 30, 36, 37}
    lead_pool = [72, 74, 77, 79, 81, 84, 81, 79]
    li = 0
    while t < t_end:
        root, chord = PROG[bar % 4]
        g = 1.0 if t > t0 + 4 else (t - t0) / 4
        for b in range(4):
            tb = t + b * beat
            if tb >= t_end: break
            walk = [root - 24, root - 24 + [4, 3, 3, 4][bar % 4], root - 24 + 7, root - 24 + rng.choice([9, 10, 11, 6])][b]
            add(buf, lp(pluck(mtof(walk), beat * 1.1, 0.995, 3.0), 900), tb, 0.9 * g, pan=-0.1)
            add(buf, ride(), tb, 0.8 * g, pan=0.35)
            if b in (1, 3):
                add(buf, ride(0.3), tb + sw, 0.5 * g, pan=0.35)
                add(buf, brush(), tb, 0.9 * g, pan=-0.3)
            if b == 0:
                add(buf, kick(), tb, 0.5 * g)
        for tb in (t + beat * 1 + sw, t + beat * 3):  # 钢琴 Charleston 伴奏
            for nn in chord:
                add(buf, piano(mtof(nn)), tb, 0.55 * g, pan=0.2)
        if (bar % 40) in lead_bars:
            for k in range(2):
                nn = lead_pool[li % len(lead_pool)] + rng.choice([0, 0, -3, 2]); li += 1
                d = beat * (1.5 if k == 0 else 2.2)
                add(buf, horn(mtof(nn), d), t + k * beat * 2 + (sw if k else 0), 0.7 * g, pan=-0.25)
        t += beat * 4; bar += 1
    return beat


def music():
    split = SEGS[6]['start']  # 大世界·今 起进入夜色
    day = np.zeros((N, 2)); night = np.zeros((N, 2))
    day_music(day, split + 3.0)
    ec = SEGS[8]['endcard']
    night_music(night, split - 3.0, ec + 1.0)
    for nn in (53, 60, 65, 69, 72, 76):  # 片尾 Fmaj7
        add(night, piano(mtof(nn), 4.5), ec + 1.0, 0.9)
    add(night, horn(mtof(77), 3.0), ec + 1.0, 0.6)
    xd = env_curve([(0, 1), (split - 3.0, 1), (split + 3.0, 0), (LEN, 0)])
    buf = day * xd[:, None] + night * (1 - xd)[:, None]
    buf = reverb(buf, 2.0, 0.26, seed=3)
    fi = int(0.12 * SR); fo = int(2.2 * SR)
    buf[:fi] *= np.linspace(0, 1, fi)[:, None]
    buf[-fo:] *= np.linspace(1, 0.02, fo)[:, None]
    return buf


# ---------------------------------------------------------------- 环境与音效
def noise(n):
    return rng.normal(0, 1, n)


def brown(n):
    x = hp(np.cumsum(rng.normal(0, 1, n)), 20, 1)
    return x / (np.std(x) + 1e-9)


def tick(dur=0.08):
    n = int(dur * SR); tt = np.arange(n) / SR
    return bp(noise(n), 1500, 6000) * np.exp(-tt * 80) * 0.5


def thump(dur=0.35):
    n = int(dur * SR); tt = np.arange(n) / SR
    body = np.sin(2 * math.pi * (70 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 14)
    return (body + bp(noise(n), 800, 5000) * np.exp(-tt * 60) * 0.5) * 0.9


def swish(dur=0.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    return bp(noise(n), 1200, 7000) * np.sin(math.pi * np.clip(tt / dur, 0, 1)) ** 2 * 0.25


def bell(freq, dur=4.0):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = sum(a * np.sin(2 * math.pi * freq * m * tt) * np.exp(-tt * d) for m, a, d in
            ((0.5, 0.5, 0.6), (1, 1, 0.9), (2.4, 0.5, 1.6), (3.0, 0.3, 2.4), (4.2, 0.2, 3.2)))
    return s * 0.2


def tram_bell():
    n = int(0.5 * SR); tt = np.arange(n) / SR
    s = sum(a * np.sin(2 * math.pi * f * tt) for f, a in ((1850, 1), (2710, 0.5), (4400, 0.25))) * np.exp(-tt * 7)
    return s * 0.18


def hoof(dur=0.09):
    n = int(dur * SR); tt = np.arange(n) / SR
    return (lp(noise(n), 900) * 0.8 + np.sin(2 * math.pi * 140 * tt)) * np.exp(-tt * 55) * 0.5


def murmur(dur, voices=14, lo=250, hi=2800):
    n = int(dur * SR)
    out = np.zeros(n)
    for v in range(voices):
        src = bp(noise(n), rng.uniform(lo, lo * 1.8), rng.uniform(hi * 0.6, hi), 2)
        syl = (np.sin(2 * math.pi * rng.uniform(3, 5.5) * np.arange(n) / SR + rng.uniform(0, 6)) > rng.uniform(-0.2, 0.4)).astype(float)
        out += src * np.clip(lp(syl, 18, 1), 0, 1) * rng.uniform(0.5, 1)
    return out / (np.std(out) + 1e-9) * 0.035


def place(buf, sig, t0, t1, gain, fade_in=1.5, fade_out=1.5, roll=240):
    n0 = int(t0 * SR); m = sig[: max(0, min(len(sig), N - n0))]
    tt = np.arange(len(m)) / SR; d = (t1 - t0)
    e = np.clip(tt / fade_in, 0, 1) * np.clip((d - tt) / fade_out, 0, 1)
    buf[n0:n0 + len(m), 0] += m * e * gain
    buf[n0:n0 + len(m), 1] += np.roll(m * e, roll) * gain


def fx():
    buf = np.zeros((N, 2))
    buf += np.stack([lp(brown(N), 600), lp(brown(N), 600)], 1) * 0.02  # 全程城市底噪（非数字静音）
    S = SEGS
    # 镜1：跑道描线轻响、转到老明信片
    add(buf, swish(0.5), 0.3, 0.6)
    add(buf, swish(0.6), 2.2, 0.7)
    add(buf, thump(0.3), ct(0, 2) - 0.3, 0.5)
    # 镜2：赛马日——看台人声 + 远处马蹄（点到为止）
    place(buf, murmur(S[1]['end'] - S[1]['start'] + 1, 16), S[1]['start'], S[1]['end'] + 1, 0.8)
    for st in (ct(1, 4) + 0.5,):
        t = st
        while t < ct(1, 4) + 6.5:
            g = 0.45 * math.sin(math.pi * (t - st) / 6.0)
            for k, d in enumerate((0, 0.07, 0.15, 0.2)):
                add(buf, hoof(), t + d, g, pan=-0.6 + (t - st) / 5)
            t += 0.42
    add(buf, tick(0.12), ct(1, 0) + 0.2, 0.5)
    add(buf, swish(0.5), S[1]['chunks'][5]['start'] - 0.6, 0.8)
    # 镜3：钟楼钟声
    add(buf, bell(392, 5.0), ct(2, 0) + 0.6, 0.55)
    add(buf, bell(330, 5.0), ct(2, 0) + 2.1, 0.45)
    # 镜4：南京路——街市人声 + 电车铃
    place(buf, murmur(S[3]['end'] - S[3]['start'] + 1, 18, 220, 3000), S[3]['start'], S[3]['end'] + 1, 0.9)
    for tb in (ct(3, 0) + 0.8, ct(3, 4) + 0.6, ct(3, 8) + 2.0):
        add(buf, tram_bell(), tb, 0.6, 0.3); add(buf, tram_bell(), tb + 0.28, 0.6, 0.3)
    for k in range(4):
        add(buf, tick(0.1), ct(3, 3) + k * 0.55, 0.55, -0.3 + k * 0.2)
    add(buf, thump(), ct(3, 6) + 4.4 + 0.15, 0.7)
    # 镜5：电台底噪 / 扶梯运转声
    n = int((ct(4, 3) - ct(4, 0)) * SR)
    crackle = bp(noise(n), 1000, 6000) * (rng.random(n) < 0.002) * 3 + bp(noise(n), 300, 3000) * 0.04
    place(buf, crackle, ct(4, 0) - 0.3, ct(4, 3) - 0.3, 0.4, 1.0, 1.0)
    n = int((ct(4, 4) - ct(4, 3)) * SR); tt = np.arange(n) / SR
    hum = (np.sin(2 * math.pi * 60 * tt) * 0.3 + bp(noise(n), 80, 400) * 0.6) * (1 + 0.15 * np.sin(2 * math.pi * 1.6 * tt))
    place(buf, hum * 0.06, ct(4, 3) - 0.4, ct(4, 4) - 0.2, 0.9, 1.0, 1.0)
    # 镜6：大世界——游乐场人声
    place(buf, murmur(S[5]['end'] - ct(5, 1) + 1, 18, 300, 3200), ct(5, 1), S[5]['end'] + 1, 0.9)
    add(buf, thump(0.3), ct(5, 4) - 0.1, 0.4)
    # 镜7：雨夜街面
    n = int((S[6]['end'] - S[6]['start']) * SR)
    rain = hp(bp(noise(n), 2000, 9000), 1500) * 0.05
    place(buf, rain, S[6]['start'], S[6]['end'], 0.7, 2.0, 1.0)
    # 镜8：舞厅人声 + 霓虹嗡声
    place(buf, murmur(S[7]['end'] - S[7]['start'] + 1, 14, 300, 2600), S[7]['start'], S[7]['end'] + 1, 0.55)
    for k in range(3):
        add(buf, tick(0.05), ct(7, 2) + k * 0.12, 0.5)
    # 镜9：灯一盏一盏亮（继电器咔嗒 + 霓虹嗡声）
    for k in range(8):
        add(buf, tick(0.07), ct(8, 2) - 0.4 + 0.55 * k + 0.05, 0.55, -0.7 + k * 0.2)
    n = int((S[8]['endcard'] - ct(8, 2)) * SR); tt = np.arange(n) / SR
    buzz = np.sin(2 * math.pi * 120 * tt) * 0.5 + np.sin(2 * math.pi * 240 * tt) * 0.2
    place(buf, buzz * 0.02, ct(8, 2), S[8]['endcard'], 1.0, 2.0, 2.0)
    for k in range(3):
        add(buf, swish(0.35), ct(8, 1) + k * (SD.spoken(S[8]['chunks'][1]['text']) / SD.SPEED / 3) - 0.15, 0.6)
    # 段间转场
    for s in S[1:]:
        add(buf, swish(), s['start'] - 0.3, 0.7, rng.uniform(-0.3, 0.3))
    add(buf, swish(), S[8]['endcard'], 0.6)
    buf = reverb(buf, 1.2, 0.18, seed=9)
    fi = int(0.05 * SR); fo = int(2.0 * SR)
    buf[:fi] *= np.linspace(0, 1, fi)[:, None]
    buf[-fo:] *= np.linspace(1, 0.2, fo)[:, None]
    return buf


def norm_rms(x, db):
    x = x * (10 ** (db / 20) / np.sqrt(np.mean(x ** 2)))
    pk = np.max(np.abs(x))
    return x * 0.89 / pk if pk > 0.89 else x


def write_flac(x, path):
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                          "-c:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24", path], stdin=subprocess.PIPE)
    p.stdin.write(x.astype(np.float32).tobytes()); p.stdin.close()
    assert p.wait() == 0


if __name__ == "__main__":
    out = sys.argv[1]
    write_flac(norm_rms(music(), -24.0), f"{out}/stem_music.flac")
    write_flac(norm_rms(fx(), -34.0), f"{out}/stem_fx_ambience.flac")
    print("samples", N, "secs", LEN)
