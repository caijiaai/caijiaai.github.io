#!/bin/sh
# 中文字体裁成只含片中用到的字（OFL，原文件来自 github.com/google/fonts）
set -e
HERE=$(cd "$(dirname "$0")/.." && pwd); PY=${PY:-$LIB/.venv/bin/python}
cd "$HERE/fonts"
[ -f LongCang-Regular.ttf ] || curl -sSLo LongCang-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/longcang/LongCang-Regular.ttf
[ -f MaShanZheng-Regular.ttf ] || curl -sSLo MaShanZheng-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf
[ -f NotoSansSC.ttf ] || curl -sSLo NotoSansSC.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
[ -f NotoSerifSC.ttf ] || curl -sSLo NotoSerifSC.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
TXT=$(cat "$HERE/film.js" "$HERE/subs.json" "$HERE/cues.json" | "$PY" -c "import sys; s=sys.stdin.read(); print(''.join(sorted(set(c for c in s if ord(c)>127)))+'0123456789'+''.join(chr(c) for c in range(32,127)))")
for f in LongCang-Regular:LongCang-sub MaShanZheng-Regular:MaShanZheng-sub NotoSerifSC:NotoSerifSC-sub NotoSansSC:NotoSansSC-sub; do "$PY" -m fontTools.subset "${f%%:*}.ttf" --text="$TXT" --output-file="${f##*:}.ttf"; done
ls -la *-sub.ttf
