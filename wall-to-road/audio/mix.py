# 混音：音乐 + 音效 + 环境声 → mix.wav；另外导出两条分轨，方便后期配旁白时重新平衡
import sys, os
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio.sfx import SR, hp, compress, limit
D = os.path.dirname(os.path.abspath(__file__))
rd = lambda n: sf.read(os.path.join(D, n), dtype='float32')[0]
mus = rd('music.wav'); pen, wash, fx, amb = rd('fx_pen.wav'), rd('fx_wash.wav'), rd('fx_fx.wav'), rd('fx_amb.wav')
rms = lambda x: float(np.sqrt(np.mean(x ** 2)) + 1e-9)
mus *= .11 / rms(mus)                         # 音乐留出旁白的空间
pen = pen / (np.abs(pen).max() + 1e-9); pen = np.stack([compress(pen[:, 0], .2, 4), compress(pen[:, 1], .2, 4)], 1)
fx = fx / (np.abs(fx).max() + 1e-9)
fxs = pen * .55 + wash * 1.6 + fx * .8
fxs = np.stack([hp(fxs[:, 0], 90), hp(fxs[:, 1], 90)], 1).astype(np.float32)
fxs *= .06 / rms(fxs); amb *= .02 / rms(amb)
mix = mus + fxs + amb
mix = np.stack([limit(mix[:, 0], .95), limit(mix[:, 1], .95)], 1).astype(np.float32)
sf.write(os.path.join(D, 'mix.wav'), mix, SR, subtype='FLOAT')
sf.write(os.path.join(D, 'stem_music.wav'), mus, SR, subtype='FLOAT')
sf.write(os.path.join(D, 'stem_fx_ambience.wav'), (fxs + amb).astype(np.float32), SR, subtype='FLOAT')
print('mix peak', float(np.abs(mix).max()), 'rms music/fx/amb', rms(mus), rms(fxs), rms(amb))
