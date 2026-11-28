#!/usr/bin/env bash
# 《租界百年》第7集《十里洋场》一条命令重建：bash build.sh
# 需要：python3 (numpy, pillow, scipy)、ffmpeg、Noto CJK 字体；照片放在 $ASSET_DIR（默认 /home/claude/src_assets）
set -euo pipefail
cd "$(dirname "$0")"
OUT="$(cd .. && pwd)"
export WORK_DIR="${WORK_DIR:-/tmp/shiliyangchang_work}"
export ASSET_DIR="${ASSET_DIR:-/home/claude/src_assets}"
JOBS="${JOBS:-$(nproc)}"
NAME="租界百年-第7集-十里洋场-无旁白"
mkdir -p "$WORK_DIR/scenes"
python3 script_data.py > /dev/null                      # 锁定稿逐字断言
python3 make_docs.py "$OUT"                              # 旁白时间表 + 字幕
seq 0 8 | xargs -P "$JOBS" -I{} python3 render.py scene {}
python3 audio.py "$OUT"                                  # 配乐 / 音效分轨
IN=(); FC=""
for i in $(seq 1 9); do IN+=(-i "$WORK_DIR/scenes/s$i.mp4"); FC="$FC[$((i-1)):v]"; done
ffmpeg -y -loglevel error "${IN[@]}" -i "$OUT/stem_music.flac" -i "$OUT/stem_fx_ambience.flac" \
  -filter_complex "${FC}concat=n=9:v=1:a=0,setpts=N/(24*TB)[v];[9:a][10:a]amix=inputs=2:duration=first:normalize=0[a]" \
  -map "[v]" -map "[a]" -fps_mode passthrough -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT/$NAME-1080x1920.mp4"
ffmpeg -y -loglevel error -i "$OUT/$NAME-1080x1920.mp4" -vf scale=720:1280:flags=lanczos \
  -c:v libx264 -crf 22 -preset medium -pix_fmt yuv420p -c:a copy -movflags +faststart "$OUT/$NAME-720p.mp4"
echo "done: $OUT/$NAME-1080x1920.mp4"
