# 《洋泾浜》音效与环境声（合成），由画面导出的 events.json 驱动
import sys, os, json
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio.sfx import SR, add, bp, hp, lp, t_, brown, thump, whoosh, click, pop
D = os.path.dirname(os.path.abspath(__file__)); H = os.path.dirname(D)
EV = json.load(open(os.path.join(H, 'events.json')))['ev']; DUR = 222.0; N = int(DUR * SR)
r = np.random.default_rng(5); fx = np.zeros((N, 2), np.float32); amb = np.zeros((N, 2), np.float32)
def noise_env(d, lo, hi, att, dec, g):
    n = int(d * SR); x = bp(r.standard_normal(n), lo, hi, 2); e = np.minimum(1, np.arange(n) / (att * SR)) * np.exp(-np.arange(n) / (dec * SR)); return (x * e * g).astype(np.float32)
def paperflip(): return noise_env(.35, 800, 6000, .01, .08, .25) + noise_env(.35, 300, 1500, .002, .03, .2)
for e in EV:
    t = e['t']; k = e['type']
    if k == 'page': add(fx, paperflip(), t, .8, .3)
    elif k == 'water': add(fx, lp(noise_env(e['dur'] + 1, 150, 2000, .3, .9, .25), 1200).astype(np.float32), t, 1, -.2)
    elif k in ('write', 'pen'):
        tt = t
        while tt < t + 1.0: d = .04 + r.random() * .1; add(fx, noise_env(d, 1800, 7000, .005, d * .6, .12), tt, 1, r.uniform(-.2, .2)); tt += d + .02 + r.random() * .04
    elif k == 'bridge': add(fx, pop(.5).astype(np.float32), t, .25, -.3 + e['i'] * .07)
    elif k == 'rise': add(fx, whoosh(e['dur'], .4).astype(np.float32), t, .5, 0)
    elif k == 'sign': add(fx, thump(.5, 160).astype(np.float32), t, .5, 0); add(fx, click(1.4, .6).astype(np.float32), t + .02, .4, 0)
    elif k == 'pop': add(fx, pop(.8).astype(np.float32), t, .5, 0)
    elif k == 'card': add(fx, paperflip(), t, 1, 0)
    elif k == 'stamp': add(fx, thump(1.0, 90).astype(np.float32), t, .8, .1)
    elif k == 'fill':
        for j in np.arange(0, e['dur'], .7): add(fx, lp(noise_env(.9, 120, 1200, .05, .35, .3), 900).astype(np.float32), t + j + r.random() * .2, .7, r.uniform(-.3, .3))
    elif k == 'tamp': add(fx, thump(.6, 70).astype(np.float32), t, .5, 0)
    elif k == 'flip': add(fx, paperflip(), t, 1, 0); add(fx, click(.9, .7).astype(np.float32), t + .2, .5, 0)
    elif k == 'car': add(fx, lp(noise_env(e['dur'], 60, 600, 1.5, e['dur'] * .5, .4), 400).astype(np.float32), t, .5, 0)
def bed(t0, t1, f, g, pan=0, fade=1.5):
    n = int((t1 - t0) * SR); y = f(n); tt = np.arange(n) / SR; e = np.minimum(1, tt / fade) * np.minimum(1, (t1 - t0 - tt) / fade); add(amb, (y * e * g).astype(np.float32), t0, 1, pan)
traffic = lambda n: lp(brown(n / SR), 250) * .6 + bp(r.standard_normal(n), 400, 2000) * .02
water = lambda n: lp(bp(r.standard_normal(n), 200, 1800), 900) * .05 * (1 + .4 * np.sin(np.arange(n) / SR * 1.3))
harbour = lambda n: lp(brown(n / SR), 180) * .45 + bp(r.standard_normal(n), 300, 1500) * .015
room = lambda n: lp(r.standard_normal(n), 500) * .02
bed(0, 222, room, 1, 0, 2)
bed(0, 3.4, traffic, .8, 0, .3); bed(1.6, 45, water, .7, -.2, 1.5); bed(65, 105, harbour, .7, .2); bed(190, 216, traffic, .4, 0, 2)
sf.write(os.path.join(D, 'fx.wav'), fx, SR, subtype='FLOAT'); sf.write(os.path.join(D, 'amb.wav'), amb, SR, subtype='FLOAT')
print('foley ok')
