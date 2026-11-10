# 《一城三治》音效与环境声（合成），由画面导出的 events.json 驱动
import sys, os, json
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio.sfx import SR, add, bp, hp, lp, t_, brown, thump, whoosh, click, pop
D = os.path.dirname(os.path.abspath(__file__)); H = os.path.dirname(D)
EV = json.load(open(os.path.join(H, 'events.json')))['ev']; DUR = 218.0; N = int(DUR * SR)
r = np.random.default_rng(5); fx = np.zeros((N, 2), np.float32); amb = np.zeros((N, 2), np.float32)
def noise_env(d, lo, hi, att, dec, g):
    n = int(d * SR); x = bp(r.standard_normal(n), lo, hi, 2); e = np.minimum(1, np.arange(n) / (att * SR)) * np.exp(-np.arange(n) / (dec * SR)); return (x * e * g).astype(np.float32)
def paperflip(): return noise_env(.35, 800, 6000, .01, .08, .25) + noise_env(.35, 300, 1500, .002, .03, .2)
for e in EV:
    t = e['t']; k = e['type']
    if k in ('page', 'card'): add(fx, paperflip(), t, .8, .2)
    elif k == 'wipe': add(fx, whoosh(1.2, .5).astype(np.float32), t, .6, 0)
    elif k == 'stamp': add(fx, thump(1.0, 90).astype(np.float32), t, .8, .1)
    elif k == 'cannon': add(fx, whoosh(.8, .5).astype(np.float32), t, .5, -.3); add(fx, thump(1.0, 55).astype(np.float32), t + .8, 1, .2)
    elif k == 'plaque': add(fx, thump(.6, 140).astype(np.float32), t, .6, 0); add(fx, click(1.2, .6).astype(np.float32), t + .02, .4, 0)
    elif k == 'shake':
        for j in np.arange(0, e['dur'], .12): add(fx, click(.7, .4).astype(np.float32), t + j, .3, r.uniform(-.3, .3))
    elif k == 'merge': add(fx, whoosh(1.0, .5).astype(np.float32), t, .6, 0); add(fx, thump(.8, 100).astype(np.float32), t + 1, .6, 0)
    elif k == 'road': add(fx, lp(noise_env(e['dur'], 150, 1500, .05, .5, .25), 1200).astype(np.float32), t, .6, -.3)
    elif k == 'walk':
        for j in np.arange(0, e['dur'], .4): add(fx, thump(.3, 130).astype(np.float32), t + j, .3, 0)
def bed(t0, t1, f, g, pan=0, fade=1.5):
    n = int((t1 - t0) * SR); y = f(n); tt = np.arange(n) / SR; e = np.minimum(1, tt / fade) * np.minimum(1, (t1 - t0 - tt) / fade); add(amb, (y * e * g).astype(np.float32), t0, 1, pan)
traffic = lambda n: lp(brown(n / SR), 250) * .6 + bp(r.standard_normal(n), 400, 2000) * .02
water = lambda n: lp(bp(r.standard_normal(n), 200, 1800), 900) * .05 * (1 + .4 * np.sin(np.arange(n) / SR * 1.3))
harbour = lambda n: lp(brown(n / SR), 180) * .45 + bp(r.standard_normal(n), 300, 1500) * .015
room = lambda n: lp(r.standard_normal(n), 500) * .02
bed(0, 218, room, 1, 0, 2)
street = lambda n: lp(brown(n / SR), 250) * .5 + bp(r.standard_normal(n), 400, 2000) * .015
bed(0, 2.6, street, .7, 0, .3); bed(201, 210, street, .45, 0, 1)
crowd = lambda n: bp(r.standard_normal(n), 300, 2500) * (lp(np.abs(r.standard_normal(n)), 5) * 4) * .012
bed(121, 148, crowd, .6, 0)
wind = lambda n: lp(bp(r.standard_normal(n), 150, 900), 600) * .05
bed(2.6, 54, wind, .7, 0)
sf.write(os.path.join(D, 'fx.wav'), fx, SR, subtype='FLOAT'); sf.write(os.path.join(D, 'amb.wav'), amb, SR, subtype='FLOAT')
print('foley ok')
