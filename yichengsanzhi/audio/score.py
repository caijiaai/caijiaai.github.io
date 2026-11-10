# 《一城三治》配乐：老上海爵士小编制（低音提琴、鼓刷、钢琴、单簧管；颤音琴、手风琴点色）。旁白位留空，配乐不压掉。
import sys, os, json
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio import sampler as S
from core.audio.sfx import SR, add, bp
D = os.path.dirname(os.path.abspath(__file__)); H = os.path.dirname(D)
EV = json.load(open(os.path.join(H, 'events.json')))['ev']; DUR = 218.0
S.seed(3); R = np.random.default_rng(3)
NOTE = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
QUAL = {'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], '7': [0, 4, 7, 10], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], 'dim7': [0, 3, 6, 9], 'm': [0, 3, 7]}
def chord(s):
    for q in sorted(QUAL, key=len, reverse=True):
        if s.endswith(q) and s[:-len(q)] in NOTE: return NOTE[s[:-len(q)]], QUAL[q]
    return NOTE[s], [0, 4, 7]
ev = []; brush = []
def voicing(root, iv): return sorted(((60 + (root + k) % 12) if (60 + (root + k) % 12) < 71 else (48 + (root + k) % 12)) for k in iv[1:])
def section(t0, t1, bpm, prog, style, mel=None, mel_inst='clarinet', mel_vel=.42, seed=1, swing=.62):
    beat = 60 / bpm; bar = beat * 4; chords = prog.split(); r = np.random.default_rng(seed); cur = 69
    i = 0; t = t0
    while t < t1 - .2:
        c = chords[i % len(chords)]; root, iv = chord(c); r0 = 40 + (root - 4) % 12
        sw = lambda b: t + (int(b) + (swing if b % 1 else 0)) * beat
        # 低音
        if style in ('walk', 'french'):
            line = [r0, r0 + iv[1], r0 + 7, r0 + 7 + (1 if i % 2 else -1)]
            for b, p in enumerate(line): ev.append(dict(t=sw(b), inst='jazz_bass', pitch=p, dur=beat * .9, vel=.72, pan=-.05))
        elif style == 'stride':
            ev.append(dict(t=sw(0), inst='jazz_bass', pitch=r0, dur=beat, vel=.8, pan=-.05)); ev.append(dict(t=sw(2), inst='jazz_bass', pitch=r0 + 7, dur=beat, vel=.72, pan=-.05))
        elif style in ('soft', 'tamp'):
            ev.append(dict(t=t, inst='jazz_bass', pitch=r0, dur=bar * .9, vel=.7, pan=-.05))
            if style == 'tamp': ev.append(dict(t=sw(2), inst='jazz_bass', pitch=r0 + 7, dur=beat, vel=.6, pan=-.05))
        # 钢琴
        vo = voicing(root, iv)
        if style in ('walk', 'french', 'stride'):
            for b in (1, 3): [ev.append(dict(t=sw(b) + k * .01, inst='piano', pitch=p, dur=beat * .5, vel=.34 if style != 'stride' else .42, pan=.15)) for k, p in enumerate(vo)]
            if style == 'stride' and i % 2: [ev.append(dict(t=sw(3.5) + k * .01, inst='piano', pitch=p, dur=beat * .3, vel=.3, pan=.15)) for k, p in enumerate(vo)]
        else: [ev.append(dict(t=t + k * .05, inst='piano', pitch=p, dur=bar * 1.1, vel=.28, pan=.12)) for k, p in enumerate([r0 + 12] + vo)]
        if style == 'french': [ev.append(dict(t=sw(b), inst='accordion', pitch=p, dur=beat * .45, vel=.4, pan=.4, gain=.5)) for b in (1, 3) for p in vo]
        # 鼓刷
        if style in ('walk', 'french', 'stride'):
            for b in range(4): brush.append((sw(b), .9 if b in (1, 3) else .55))
        # 旋律（稀，给旁白让位）
        if mel and r.random() < mel:
            tones = sorted({(root + k) % 12 for k in iv}); cands = [m for m in range(62, 79) if m % 12 in tones]
            for b in ([0, 1.5, 2] if style == 'stride' else [0, 2]):
                cur = min(cands, key=lambda m: abs(m - cur) + (2 if m == cur else 0) + r.random() * 3)
                ev.append(dict(t=sw(b) + r.uniform(0, .02), inst=mel_inst, pitch=cur, dur=beat * (.45 if style == 'stride' else 1.6), vel=mel_vel * (.85 + .3 * r.random()), pan=.2, release=.2))
        t += bar; i += 1
section(0.0, 19.0, 80, 'Fmaj7 Dm7 Bbmaj7 C7', 'soft', mel=.5, seed=1, mel_vel=.36)
section(19.0, 54.0, 100, 'Dm Dm Gm A7 Dm Bbmaj7 Gm A7', 'tamp')
section(54.0, 80.0, 104, 'Fmaj7 Dm7 Gm7 C7 Am7 Dm7 Gm7 C7', 'walk', mel=.4, seed=3)
section(80.0, 99.0, 108, 'F6 D7 Gm7 C7', 'french', mel=.45, seed=4)
section(99.0, 121.0, 96, 'Bbmaj7 F6 Gm7 C7', 'walk', mel=.3, seed=5)
section(121.0, 148.0, 84, 'Dm7 Gm7 C7 Fmaj7', 'soft', mel=.4, seed=6)
section(148.0, 171.0, 112, 'F6 D7 G7 C7', 'stride', mel=.6, mel_inst='clarinet_stac', mel_vel=.42, seed=7)
section(171.0, 210.0, 76, 'Fmaj7 Dm7 Bbmaj7 C7', 'soft', mel=.55, seed=8, mel_vel=.36)
ev += [dict(t=210.2 + k * .05, inst='piano', pitch=p, dur=6, vel=.34, pan=.1) for k, p in enumerate([41, 53, 57, 60, 64, 69])] + [dict(t=210.2, inst='clarinet', pitch=72, dur=3.2, vel=.35, pan=.2, release=1)]
# 事件点色：章 = 大鼓；炮声 = 大鼓重击；挂牌子 = 颤音琴和弦；修路 = 颤音琴上行
for e in EV:
    if e['type'] == 'stamp': ev.append(dict(t=e['t'], inst='gran_cassa', pitch='hit', vel=.55, pan=0, gain=.7))
    if e['type'] == 'cannon': ev.append(dict(t=e['t'] + .8, inst='gran_cassa', pitch='hit', vel=.75, pan=-.2, gain=.8))
    if e['type'] == 'plaque': [ev.append(dict(t=e['t'] + k * .03, inst='vibraphone', pitch=p, dur=1.4, vel=.4, pan=.1)) for k, p in enumerate([65, 69, 72])]
for i, e in enumerate([e for e in EV if e['type'] == 'road']): ev.append(dict(t=e['t'], inst='vibraphone', pitch=[67, 69, 72, 74][i], dur=1, vel=.4, pan=-.2))
mus = S.render(ev, dur=DUR, master=False)
br = np.zeros((int(DUR * SR), 2), np.float32)
for t, v in brush:
    n = int(.14 * SR); x = R.standard_normal(n); e = np.exp(-np.arange(n) / (n * .3)); add(br, (bp(x, 2500, 9000, 2) * e * v * .07).astype(np.float32), t, 1, .25)
mus = S.room(mus + br, size=.35, mix=.18)
sf.write(os.path.join(D, 'music.wav'), mus, SR, subtype='FLOAT')
open(os.path.join(D, 'instruments.txt'), 'w').write('\n'.join(sorted({e['inst'] for e in ev})))
print('music ok', float(np.abs(mus).max()))
