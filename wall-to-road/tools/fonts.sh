#!/bin/sh
# 把两款中文手写字体裁成只含片中用到的字（OFL 字体，原文件来自 google/fonts）
set -e
HERE=$(cd "$(dirname "$0")/.." && pwd)
PY=${PY:-$LIB/.venv/bin/python}
cd "$HERE/fonts"
[ -f LongCang-Regular.ttf ] || curl -sSLo LongCang-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/longcang/LongCang-Regular.ttf
[ -f MaShanZheng-Regular.ttf ] || curl -sSLo MaShanZheng-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf
TXT=$(cat "$HERE/film.js" "$HERE/world.js" "$HERE/subs.json" | "$PY" -c "import sys; s=sys.stdin.read(); print(''.join(sorted(set(c for c in s if ord(c)>127)))+'0123456789·《》ABCDEFGHIJKLMNOPQRSTUVWXYZ')")
"$PY" -m fontTools.subset LongCang-Regular.ttf --text="$TXT" --output-file=LongCang-sub.ttf
"$PY" -m fontTools.subset MaShanZheng-Regular.ttf --text="$TXT" --output-file=MaShanZheng-sub.ttf
ls -la *-sub.ttf
