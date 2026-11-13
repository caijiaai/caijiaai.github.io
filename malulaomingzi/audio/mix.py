# 混音：配乐（保留，不压掉）+ 音效 + 环境声；旁白位留空。另出两条分轨，方便贴旁白后重新平衡。
import sys, os
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio.sfx import SR, hp, limit
D = os.path.dirname(os.path.abspath(__file__))
rd = lambda n: sf.read(os.path.join(D, n), dtype='float32')[0]
rms = lambda x: float(np.sqrt(np.mean(x ** 2)) + 1e-9)
mus, fx, amb = rd('music.wav'), rd('fx.wav'), rd('amb.wav')
mus *= .10 / rms(mus); fx = np.stack([hp(fx[:, 0], 90), hp(fx[:, 1], 90)], 1).astype(np.float32); fx *= .035 / rms(fx); amb *= .018 / rms(amb)
mix = mus + fx + amb; mix = np.stack([limit(mix[:, 0], .95), limit(mix[:, 1], .95)], 1).astype(np.float32)
lim = lambda x: np.stack([limit(x[:, 0], .95), limit(x[:, 1], .95)], 1).astype(np.float32)   # 分轨也不许过 0 dBFS（24-bit FLAC 会削波）
for n, x in [('mix.wav', mix), ('stem_music.wav', lim(mus)), ('stem_fx_ambience.wav', lim((fx + amb).astype(np.float32)))]: sf.write(os.path.join(D, n), x, SR, subtype='FLOAT')
print('mix ok')
