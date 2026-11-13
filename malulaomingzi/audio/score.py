# 《马路的老名字》配乐：中国风轻音乐 —— 筝（拨弦物理建模）+ 笛（长笛采样代）+ 低音拨弦。五声 D 宫（D E F# A B）。
# 全程按「旁白垫底」的音量，旁白位留空。
import sys, os, json
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio import sampler as S, pluck as P
from core.audio.sfx import SR, add
D = os.path.dirname(os.path.abspath(__file__)); H = os.path.dirname(D)
EV = json.load(open(os.path.join(H, 'events.json')))['ev']; DUR = 222.0
S.seed(5); R = np.random.default_rng(5)
buf = np.zeros((int(DUR * SR), 2), np.float32)
PENTA = [0, 2, 4, 7, 9]                                   # D 宫五声
scale = lambda lo, hi: [m for m in range(lo, hi + 1) if (m - 62) % 12 in PENTA]
ZH = scale(50, 86)                                        # 筝的音域
cache = {}
def zheng(m, dur, vel):
    k = (m, round(dur, 1), round(vel, 1))
    if k not in cache: cache[k] = P.pluck('koto', m, dur, vel=vel).astype(np.float32)
    return cache[k]
def gliss(t, lo, hi, up=True, v=.35, step=.045):          # 刮奏
    ns = [m for m in ZH if lo <= m <= hi]; ns = ns if up else ns[::-1]
    for i, m in enumerate(ns): add(buf, zheng(m, 1.6, v + .2 * i / len(ns)), t + i * step, .5, -.3 + .6 * i / len(ns))
fl = []                                                   # 笛
# 每个镜头一段：(起, 止, bpm, 根音序列, 型, 笛的疏密)
SECS = [(0.0, 27.0, 76, [50, 57, 54, 57], 'arp', .45), (27.0, 61.5, 84, [50, 54, 57, 59], 'arp', .4), (61.5, 86.0, 80, [47, 54, 52, 57], 'arp', .5),
        (86.0, 113.0, 88, [50, 57, 59, 54], 'roll', .3), (113.0, 138.5, 76, [50, 57, 52, 57], 'arp', .45), (138.5, 163.5, 96, [50, 54, 57, 59], 'roll', .35),
        (163.5, 192.0, 66, [50, 59, 54, 57], 'slow', .55), (192.0, 214.0, 72, [50, 57, 54, 50], 'arp', .5)]
cur = 74
for (t0, t1, bpm, roots, kind, dens) in SECS:
    beat = 60 / bpm; bar = beat * 4; t = t0 + .3; i = 0
    gliss(t0 + .05, 62, 86, up=True, v=.28)
    while t < t1 - bar * .6:
        root = roots[i % len(roots)]; tones = [m for m in ZH if m > root + 6 and m < root + 30 and (m - root) % 12 in (0, 4, 7, 9, 2)]
        add(buf, zheng(root, bar * 1.2, .7), t, .55, -.15)                                   # 低音弦
        if kind == 'arp':
            for b, k in enumerate([0, 2, 1, 3, 2, 4, 3, 2]):
                if R.random() < .82: add(buf, zheng(tones[k % len(tones)], 1.4, .45 + .12 * (b % 4 == 0)), t + b * beat / 2 + R.uniform(0, .012), .42, .1 + .1 * (b % 2))
        elif kind == 'roll':
            for b in range(8):
                m = tones[(b * 2 + i) % len(tones)]; add(buf, zheng(m, .9, .5), t + b * beat / 2, .4, .15)
                if b % 4 == 2: add(buf, zheng(m + (12 if m + 12 <= 86 else 0), .9, .4), t + b * beat / 2 + beat / 4, .32, .25)
        else:   # slow：稀疏、带泛音感的长音
            for b, k in [(0, 1), (1.5, 3), (2.5, 2)]: add(buf, zheng(tones[k % len(tones)], 2.4, .42), t + b * beat, .42, .1)
        if R.random() < dens:                                                                # 笛：一两个长音
            cands = [m for m in scale(69, 88) if (m - root) % 12 in (0, 4, 7, 9, 2)]
            for b, l in ([(0, 2.6)] if R.random() < .5 else [(0, 1.4), (1.5, 2.2)]):
                cur = min(cands, key=lambda m: abs(m - cur) + (2.5 if m == cur else 0) + R.random() * 3)
                fl.append(dict(t=t + b * beat + .02, inst='flute', pitch=cur, dur=l * beat * .95, vel=.34 if kind == 'slow' else .38, pan=.25, release=.35, attack=.06))
        t += bar; i += 1
# 路牌翻面、挂牌：筝的一个高音；章：低音重拨
for e in EV:
    if e['type'] in ('flip', 'hang'): add(buf, zheng(86 if e['type'] == 'flip' else 81, 1.5, .5), e['t'], .4, .3)
    if e['type'] == 'stamp': add(buf, zheng(38 + 12, 2.5, .9), e['t'], .6, 0)
    if e['type'] == 'light': add(buf, zheng(ZH[len(ZH) - 9 + (int(e['t'] * 7)) % 9], .8, .35), e['t'], .22, R.uniform(-.4, .4))
# 片尾卡：下行刮奏 + 一个 D 宫和弦
gliss(214.2, 62, 86, up=False, v=.3, step=.06)
for k, m in enumerate([50, 57, 62, 66, 69, 74]): add(buf, zheng(m, 6, .6), 216.6 + k * .09, .5, -.2 + k * .08)
fl.append(dict(t=216.8, inst='flute', pitch=81, dur=3.6, vel=.34, pan=.25, release=1.2, attack=.1))
mus = buf + S.render(fl, dur=DUR, master=False) * .9
mus = S.room(mus, size=.5, mix=.24)
sf.write(os.path.join(D, 'music.wav'), mus, SR, subtype='FLOAT')
open(os.path.join(D, 'instruments.txt'), 'w').write('flute\n(筝、低音弦：core/audio/pluck.py 物理建模合成，无采样)\n')
print('music ok', float(np.abs(mus).max()))
