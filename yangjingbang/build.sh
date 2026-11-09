#!/bin/sh
# 一条命令重建《租界百年》第 2 集《洋泾浜》（无旁白版）：时间表 → 字体 → 事件 → 配乐/音效/混音 → 逐帧渲染 → 合成 → 轻装版
set -e
HERE=$(cd "$(dirname "$0")" && pwd); LIB=${LIB:-$HOME/lemo-opuscar}; export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
NAME="租界百年-第2集-洋泾浜"
python3 "$HERE/tools/cues.py"
sh "$HERE/tools/fonts.sh"
cd "$LIB"
node core/render/events.mjs "$HERE" --size 1080x1920
.venv/bin/python "$HERE/audio/score.py"; .venv/bin/python "$HERE/audio/foley.py"; .venv/bin/python "$HERE/audio/mix.py"
node core/render/video.mjs "$HERE" --fps 24 --workers 4 --size 1080x1920 --out "$HERE/out/video.mp4"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/audio/mix.wav" "$HERE/out/master.mp4" 24 0
ffmpeg -loglevel error -y -i "$HERE/out/video.mp4" -c:v libx264 -preset slow -b:v 3200k -pass 1 -passlogfile "$HERE/out/x264" -an -f null /dev/null
ffmpeg -loglevel error -y -i "$HERE/out/video.mp4" -i "$HERE/out/master.mp4" -map 0:v -map 1:a -c:v libx264 -preset slow -b:v 3200k -pass 2 -passlogfile "$HERE/out/x264" -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$HERE/${NAME}-1080x1920-无旁白.mp4"
ffmpeg -loglevel error -y -i "$HERE/${NAME}-1080x1920-无旁白.mp4" -vf scale=720:1280 -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "$HERE/${NAME}-720p-无旁白.mp4"
for s in stem_music stem_fx_ambience; do ffmpeg -loglevel error -y -i "$HERE/audio/$s.wav" -c:a flac -sample_fmt s32 "$HERE/$s.flac"; done
.venv/bin/python core/render/srt.py "$HERE/subs.json" "$HERE/${NAME}.srt"
