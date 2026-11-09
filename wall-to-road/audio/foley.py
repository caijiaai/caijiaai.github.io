# 《城墙变成了路》音效与环境声（全部合成），由 events.json（画面导出的事件）驱动
import sys, os, json
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio.sfx import SR, add, bp, hp, lp, noise, env_exp, t_, brown, thump, step, ding, whoosh
D = os.path.dirname(os.path.abspath(__file__)); HERE = os.path.dirname(D)
C = json.load(open(os.path.join(HERE, 'events.json'))); DUR = 120.0; N = int(DUR * SR)
rng = np.random.default_rng(11)
B = {k: np.zeros((N, 2), np.float32) for k in ['pen', 'wash', 'fx', 'amb']}
ev = lambda typ: [e for e in C['ev'] if e['type'] == typ]
SIL = (70.0, 71.5)   # 静默的一小节：环境声也一起停

def penburst(d, v=1., bright=1., dark=False):
    d = max(.03, d); n = int(d * SR); x = rng.standard_normal(n)
    fiber = lp(rng.standard_normal(n), 90); fiber = .55 + .45 * np.abs(fiber) / (np.abs(fiber).max() + 1e-9)
    grain = (rng.random(n) > .9975) * rng.standard_normal(n) * 4
    y = (bp(x, 900, 3200, 2) if dark else bp(x, 1600 * bright, 7500 * min(1.25, bright), 2)) * fiber + hp(grain, 2500) * (.4 if dark else 1)
    e = np.minimum(1, np.arange(n) / (.008 * SR)) * np.minimum(1, (n - np.arange(n)) / (.025 * SR))
    return (y * e * v * .2).astype(np.float32)
def scribble_run(t0, dur, dens, v=.8, bright=1., dark=False, pan=0.):
    t = t0
    while t < t0 + dur:
        d = .04 + rng.random() * (.18 / max(.5, dens)); add(B['pen'], penburst(d, v * (.7 + rng.random() * .5), bright, dark), t, 1, pan + rng.uniform(-.25, .25))
        t += d * (.4 if dens > 2 else 1) + .01 + rng.random() * .05 / max(.5, dens)
for e in ev('pen'):
    dens = min(4, e['n'] / max(.5, e['dur']) / 25)
    scribble_run(e['t'], e['dur'], dens, .75 if e['name'] != 'wallGrow' else .85)
for e in ev('erase'):   # 倒着收回：更暗、更软的擦纸声
    scribble_run(e['t'], e['dur'], 1.5, .55, dark=True)
for e in ev('write'): scribble_run(e['t'], e['dur'], 1.2, .7, bright=1.15)
for e in ev('strike'): add(B['pen'], penburst(.5, 1.2, .9), e['t'], 1, -.2)
# 静默之后的第一笔：一记清楚的擦线
for e in ev('firstErase'): add(B['pen'], penburst(.55, 2.2, .85) + penburst(.55, 1.0, .5, dark=True), e['t'], 1, 0)
# 湿笔晕色：一声“嘘”
def wet(d=1.3, v=1.):
    n = int(d * SR); x = rng.standard_normal(n); y = lp(bp(x, 250, 2600, 2), 1800)
    e = np.minimum(1, np.arange(n) / (.12 * SR)) * np.exp(-np.arange(n) / (n * .35)); return (y * e * v * .16).astype(np.float32)
for e in ev('wash'): add(B['wash'], wet(1.0 + rng.random() * .6, .8 + rng.random() * .4), e['t'], 1, rng.uniform(-.3, .3))
# 脚步
for e in ev('step'): add(B['fx'], (step(.5) * e.get('gain', 1)).astype(np.float32), e['t'] + rng.uniform(0, .01), .5, .05)
# 电车：车轮滚、接缝咔嗒、开头一声铃，声像跟着车走（4150→… 每秒 560 px，相机中心约 5950）
def bell(f=1850, v=1., d=1.2):
    t = t_(d); y = (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.76 * t) + .25 * np.sin(2 * np.pi * f * 5.4 * t)) * np.exp(-t / .35); return (y * v * .12).astype(np.float32)
for e in ev('tram'):
    t0, d = e['t'], e['dur']; n = int(d * SR); x = rng.standard_normal(n)
    roll = lp(x, 220) * 1.8 + bp(x, 600, 1400) * .25; tt = np.arange(n) / SR
    env = np.minimum(1, tt / 1.2) * np.minimum(1, (d - tt) / 1.5)
    xs = 4150 + tt * 560; pan = np.clip((xs - 5950) / 1800, -1, 1)
    L, R = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    s = int(t0 * SR); y = roll * env * .25
    B['fx'][s:s + n, 0] += (y * L).astype(np.float32); B['fx'][s:s + n, 1] += (y * R).astype(np.float32)
    for k in np.arange(.4, d - .4, .55): add(B['fx'], thump(.35, 140), t0 + k, .25, float(np.clip((4150 + k * 560 - 5950) / 1800, -1, 1)))
    add(B['fx'], bell(), t0 + 1.0, .9, -.6); add(B['fx'], bell(), t0 + 1.25, .7, -.55)
# 第 4 段右半边也有电车铃（城外）
for t in (59.6, 63.0): add(B['fx'], bell(1750, .6), t, .6, .7)
# 江上的小船：划水
for e in ev('boat'):
    for k in np.arange(0, e['dur'], 1.1):
        n = int(.5 * SR); y = lp(bp(rng.standard_normal(n), 300, 1500), 900) * np.sin(np.linspace(0, np.pi, n)) ** 2 * .08
        add(B['fx'], y.astype(np.float32), e['t'] + k, .7, .6)
# 拆墙：砖块落地的闷响 + 碎屑
for e in ev('brick'):
    add(B['fx'], thump(.7, 90), e['t'], .7, rng.uniform(-.15, .15))
    for k in range(5): add(B['fx'], penburst(.02, 1.5, 1.4), e['t'] + .03 + k * .03 + rng.random() * .05, .6, rng.uniform(-.3, .3))
# 填濠：倒放的水声
n = int(2.2 * SR); y = lp(bp(rng.standard_normal(n), 200, 1800), 1200) * np.linspace(0, 1, n) ** 2 * .12; add(B['fx'], y.astype(np.float32), 79.2, 1, 0)
# 合上本子：一阵风 + 纸板落下
for e in ev('cover'): add(B['fx'], whoosh(1.6, .7), e['t'] + .8, .8, .2); add(B['fx'], thump(1.0, 75), e['t'] + 2.6, 1, 0); add(B['fx'], penburst(.25, 1.8, .6, dark=True), e['t'] + 2.6, 1, 0)
# ---------- 环境声 ----------
def bed(t0, t1, f, fade=1.2, gain=1., pan=0.):
    n = int((t1 - t0) * SR); y = f(n); tt = np.arange(n) / SR
    e = np.minimum(1, tt / fade) * np.minimum(1, (t1 - t0 - tt) / fade); add(B['amb'], (y * e * gain).astype(np.float32), t0, 1, pan)
room = lambda n: lp(rng.standard_normal(n), 400) * .02
bed(0, 120, room, 2, 1)
street = lambda n: lp(brown(n / SR), 300) * .5 + bp(rng.standard_normal(n), 300, 1200) * .015
bed(.2, 15.8, street, 1.5, .6); bed(95, 113.8, street, 2, .55)
for t in (5.3, 11.8, 100.2): add(B['amb'], bell(2600, .35, .6), t, .5, .4)   # 自行车铃
wind = lambda n: lp(bp(rng.standard_normal(n), 150, 900), 600) * .05 * (1 + .5 * np.sin(np.arange(n) / SR * .7))
bed(15.2, 35.2, wind, 2, 1)
harbour = lambda n: lp(brown(n / SR), 180) * .45 + bp(rng.standard_normal(n), 200, 900) * .02
bed(34.0, 53.8, harbour, 1.5, .7)
# 汽笛（J-cut：比外滩画面早一小节）
def horn(d=2.4):
    t = t_(d); f = 110; y = sum(np.sign(np.sin(2 * np.pi * f * k * t)) / k for k in (1, 1.5)) ; y = lp(y, 700) * np.minimum(1, t / .25) * np.minimum(1, (d - t) / .6); return (y * .05).astype(np.float32)
add(B['amb'], horn(), 34.2, 1, .5); add(B['amb'], horn(1.6), 50.5, .6, .6)
# 墙里墙外：左边市声，右边马路
babble = lambda n: bp(rng.standard_normal(n), 300, 2500) * (lp(np.abs(rng.standard_normal(n)), 5) * 4) * .015
bed(53.8, 70.0, babble, 1.2, 1, -.6); bed(53.8, 70.0, harbour, 1.2, .4, .6)
bed(71.5, 92.5, wind, 3, .8)
# 静默一小节
s0, s1 = int(SIL[0] * SR), int(SIL[1] * SR)
for k in B:
    fade = np.linspace(1, 0, int(.08 * SR))[:, None]
    B[k][s0 - len(fade):s0] *= fade; B[k][s0:s1] = 0
for k, b in B.items(): sf.write(os.path.join(D, f'fx_{k}.wav'), b, SR, subtype='FLOAT')
print('foley done', {k: float(np.abs(b).max()) for k, b in B.items()})
