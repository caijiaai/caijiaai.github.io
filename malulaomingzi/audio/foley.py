# 《马路的老名字》音效与环境声（全部合成），由画面导出的 events.json 驱动
import sys, os, json
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio.sfx import SR, add, bp, hp, lp, t_, brown, thump, whoosh, click, pop
D = os.path.dirname(os.path.abspath(__file__)); H = os.path.dirname(D)
EV = json.load(open(os.path.join(H, 'events.json')))['ev']; DUR = 222.0; N = int(DUR * SR)
r = np.random.default_rng(7); fx = np.zeros((N, 2), np.float32); amb = np.zeros((N, 2), np.float32)
def noise_env(d, lo, hi, att, dec, g):
    n = int(d * SR); x = bp(r.standard_normal(n), lo, hi, 2); e = np.minimum(1, np.arange(n) / (att * SR)) * np.exp(-np.arange(n) / (dec * SR)); return (x * e * g).astype(np.float32)
def paperflip(): return noise_env(.35, 800, 6000, .01, .08, .25) + noise_env(.35, 300, 1500, .002, .03, .2)
def metal(f=1900, v=1., d=.9, tau=.22):   # 搪瓷牌 / 扳手：金属敲击
    t = t_(d); y = sum(a * np.sin(2 * np.pi * f * k * t) for k, a in [(1, 1), (2.31, .6), (3.87, .35), (5.2, .2)]) * np.exp(-t / tau); return (y * v * .1).astype(np.float32)
for e in EV:
    t = e['t']; k = e['type']
    if k in ('page', 'card'): add(fx, paperflip(), t, .8, .2)
    elif k == 'unhook': add(fx, metal(1500, .8, .5, .12), t, .7, -.2); add(fx, whoosh(.7, .5).astype(np.float32), t + .1, .5, -.5)
    elif k == 'hang': add(fx, metal(2100, .7, .6, .15), t + .25, .6, .1); add(fx, thump(.4, 150).astype(np.float32), t + .25, .4, 0)
    elif k == 'flip': add(fx, paperflip(), t, .7, 0); add(fx, metal(2400, .7, .5, .12), t + .28, .6, .1)
    elif k == 'stamp': add(fx, thump(1.0, 90).astype(np.float32), t, .8, .1)
    elif k == 'light': add(fx, click(1.3, .5).astype(np.float32), t, .35, r.uniform(-.4, .4))
    elif k == 'cars': add(fx, lp(noise_env(e['dur'], 60, 600, 1.2, e['dur'] * .5, .4), 400).astype(np.float32), t, .5, 0)
    elif k == 'wrench':   # 镜 7：扳手拟音，点到为止
        add(fx, metal(3100, .6, .5, .09), t, .5, r.uniform(-.5, .5)); add(fx, metal(2700, .4, .4, .07), t + .16, .4, r.uniform(-.5, .5))
def bed(t0, t1, f, g, pan=0, fade=1.5):
    n = int((t1 - t0) * SR); y = f(n); tt = np.arange(n) / SR; e = np.minimum(1, tt / fade) * np.minimum(1, (t1 - t0 - tt) / fade); add(amb, (y * e * g).astype(np.float32), t0, 1, pan)
room = lambda n: lp(r.standard_normal(n), 500) * .02
street = lambda n: lp(brown(n / SR), 250) * .5 + bp(r.standard_normal(n), 400, 2000) * .015
bed(0, 222, room, 1, 0, 2)
bed(0, 27, street, .5, 0, .4); bed(138.5, 163.5, street, .6, 0, 1.5); bed(163.5, 192, street, .45, .1, 2)
sf.write(os.path.join(D, 'fx.wav'), fx, SR, subtype='FLOAT'); sf.write(os.path.join(D, 'amb.wav'), amb, SR, subtype='FLOAT')
print('foley ok')
