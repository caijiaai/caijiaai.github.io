# 《城墙变成了路》配乐：3/4 爵士华尔兹，120 BPM（一小节 1.5 秒）
# 低音提琴（拨弦）+ 鼓刷 + 钢琴 + 单簧管；外滩一段加手风琴。不做高潮。
import sys, os
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio import sampler as S
from core.audio.sfx import SR, add, bp, hp, lp, env_exp, t_
D = os.path.dirname(os.path.abspath(__file__)); DUR = 120.0
S.seed(7); rng = np.random.default_rng(7)
BEAT = .5; BAR = 1.5
NOTE = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
QUAL = {'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], '7': [0, 4, 7, 10], '6': [0, 4, 7, 9], 'm': [0, 3, 7, 14], 'maj9': [0, 4, 7, 11, 14]}
def chord(sym):
    for q in sorted(QUAL, key=len, reverse=True):
        if sym.endswith(q) and sym[:-len(q)] in NOTE: return NOTE[sym[:-len(q)]], QUAL[q]
    return NOTE[sym], [0, 4, 7]
# 段落：(起点秒, 每小节和弦, 状态)
SECS = [
    (0.0,  'Fmaj7 Dm7 Gm7 C7 Fmaj7 Dm7 Gm7 C7 Fmaj7 Bbmaj7', 'today'),
    (15.0, 'Dm Dm Bbmaj7 A7 Dm Gm7 Bbmaj7 A7 Dm Dm Bbmaj7 A7 Dm', 'ming'),
    (34.5, 'F6 D7 Gm7 C7 Am7 D7 Gm7 C7 Fmaj7 Bbmaj7 Gm7 C7 F6', 'bund'),
    (54.0, 'Dm7 Fmaj7 Dm7 Fmaj7 Gm7 C7 Dm7 Fmaj7 Bbmaj7 A7', 'split'),
    (71.5, 'Dm Bbmaj7 Gm7 A7 Dm Bbmaj7 Gm7 A7 Fmaj7 Dm7 Gm7 C7 Fmaj7 Bbmaj7', 'demo'),
    (93.0, 'Fmaj7 Dm7 Gm7 C7 Fmaj7 Dm7 Gm7 C7 Fmaj7 Bbmaj7 Gm7 C7 Fmaj9', 'today2'),
]
ev = []; brush = []   # brush = (t, vel, kind)
def mel_line(t0, chords, lo=62, hi=77, start=69, density=.6, inst='clarinet', vel=.5, pan=.1, seed=1):
    r = np.random.default_rng(seed); cur = start
    for i, c in enumerate(chords):
        root, iv = chord(c); tones = sorted({(root + k) % 12 for k in iv})
        cands = [m for m in range(lo, hi + 1) if m % 12 in tones]
        t = t0 + i * BAR
        if r.random() > density and i % 4 != 0: continue
        pat = [(0, 3)] if r.random() < .35 else [(0, 2), (2, 1)] if r.random() < .6 else [(1, 1), (2, 1), (0, 0)]
        for b, l in pat:
            if l == 0: continue
            cur = min(cands, key=lambda m: abs(m - cur) + (0 if m != cur else 2) + r.random() * 2.5)
            ev.append(dict(t=t + b * BEAT + r.uniform(0, .03), inst=inst, pitch=cur, dur=l * BEAT * .95, vel=vel * (.85 + .3 * r.random()), pan=pan, release=.25))
for si, (t0, prog, st) in enumerate(SECS):
    chords = prog.split(); tend = SECS[si + 1][0] if si + 1 < len(SECS) else 113.6
    for i, c in enumerate(chords):
        t = t0 + i * BAR
        if t >= tend - .05: break
        root, iv = chord(c); r0 = 41 + (root - 5) % 12   # 低音 F2 附近
        last = i == len(chords) - 1 or t + BAR >= tend - .05
        # 低音提琴
        if st in ('today', 'bund', 'split', 'today2') or (st == 'demo' and i >= 8):
            ev.append(dict(t=t, inst='jazz_bass', pitch=r0, dur=.9, vel=.8, pan=-.05))
            if not last: ev.append(dict(t=t + 2 * BEAT, inst='jazz_bass', pitch=r0 + (7 if i % 2 == 0 else 12) - (12 if r0 + 7 > 52 else 0), dur=.45, vel=.65, pan=-.05))
        elif st in ('ming', 'demo'):
            if i % 2 == 0: ev.append(dict(t=t, inst='jazz_bass', pitch=r0, dur=2.0, vel=.75, pan=-.05))
        # 钢琴：2、3 拍上的和弦（ming 段只在每两小节的第一拍放一个长和弦）
        voic = [60 + (root + k - 0) % 12 for k in iv[1:4]]; voic = sorted(v if v < 72 else v - 12 for v in voic)
        if st in ('today', 'today2', 'bund', 'split') or (st == 'demo' and i >= 8):
            for b in (1, 2):
                if st == 'split' and b == 2 and i % 2: continue
                for k, p in enumerate(voic): ev.append(dict(t=t + b * BEAT + k * .012, inst='piano', pitch=p, dur=.32, vel=.38, pan=.15))
        elif st == 'ming' and i % 2 == 0:
            for k, p in enumerate([r0 + 12] + voic): ev.append(dict(t=t + k * .04, inst='piano', pitch=p, dur=2.8, vel=.32, pan=.1))
        elif st == 'demo' and i < 8 and i % 4 == 0:
            for k, p in enumerate(voic): ev.append(dict(t=t + k * .06, inst='piano', pitch=p, dur=5, vel=.25, pan=.1))
        # 手风琴（外滩；墙外那半边）
        if st == 'bund' and i >= 2:
            for b in (1, 2):
                for p in voic: ev.append(dict(t=t + b * BEAT, inst='accordion', pitch=p, dur=.3, vel=.4, pan=.35, gain=.55))
        if st == 'split' and i % 2 == 1:
            for p in voic: ev.append(dict(t=t + BEAT, inst='accordion', pitch=p, dur=1.0, vel=.4, pan=.6, gain=.55))
        # 鼓刷
        if st in ('today', 'today2', 'bund') or (st == 'split') or (st == 'demo' and i >= 8):
            for b in range(3): brush.append((t + b * BEAT, (.9 if b == 0 else .55) * (.7 if st == 'split' else 1), 'swish' if b == 0 else 'tap'))
    # 旋律
    n = int((tend - t0) / BAR)
    if st == 'today': mel_line(t0 + 2 * BAR, chords[2:n], seed=1, density=.75, vel=.5)
    if st == 'ming': mel_line(t0, chords[:n], lo=57, hi=72, start=62, density=.5, vel=.42, seed=2)
    if st == 'bund': mel_line(t0 + BAR, chords[1:n], lo=65, hi=81, start=72, density=.8, vel=.5, seed=3)
    if st == 'split': mel_line(t0, [c for k, c in enumerate(chords[:n])], lo=55, hi=69, start=62, density=.55, vel=.42, pan=-.55, seed=4)
    if st == 'demo': mel_line(t0 + .2, chords[:n], lo=60, hi=76, start=69, density=.65, vel=.45, seed=5)
    if st == 'today2': mel_line(t0 + 2 * BAR, chords[2:n], seed=1, density=.75, vel=.5)
# 墙里墙外：第 1 段结尾的静默（70.0–71.5）——把跨进静默的音截掉
ev = [e for e in ev if not (69.95 < e['t'] < 71.5)]
for e in ev:
    if e['t'] < 70 and e['t'] + e['dur'] > 70: e['dur'] = max(.1, 69.95 - e['t'])
# 片尾：合上本子的那一下（116.2）一个低 F + 钢琴 F 和弦，让它自己响完
ev += [dict(t=116.2, inst='jazz_bass', pitch=41, dur=3, vel=.8, pan=0)] + [dict(t=116.25 + k * .05, inst='piano', pitch=p, dur=3.6, vel=.3, pan=.1) for k, p in enumerate([53, 57, 60, 64, 69])]
mus = S.render(ev, dur=DUR, master=False)
# 合成的鼓刷：刷面的“嘶”（带通噪声）+ 轻点
br = np.zeros((int(DUR * SR), 2), np.float32)
for t, v, k in brush:
    if 69.95 < t < 71.5: continue
    d = .38 if k == 'swish' else .12; n = int(d * SR); x = rng.standard_normal(n)
    e = np.minimum(1, np.arange(n) / (.03 * SR if k == 'swish' else .002 * SR)) * np.exp(-np.arange(n) / (n * .45))
    y = bp(x, 2500, 9000, 2) * e * v * (.06 if k == 'swish' else .09)
    add(br, y.astype(np.float32), t + rng.uniform(0, .012), 1, .25)
mus = S.room(mus + br, size=.35, mix=.18)
sf.write(os.path.join(D, 'music.wav'), mus, SR, subtype='FLOAT')
open(os.path.join(D, 'instruments.txt'), 'w').write('\n'.join(sorted({e['inst'] for e in ev})))
print('music', mus.shape, 'peak', float(np.abs(mus).max()))
