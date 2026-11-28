# -*- coding: utf-8 -*-
"""生成 narration_cues.md 与 subtitles.srt（均由 script_data 推出，与画面字幕同源）"""
import sys
import script_data as SD

segs, total = SD.build()
out = sys.argv[1]
FPS = 24
nfr = int(round(total * FPS))


def tc(x, sep="."):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


flat = [(i + 1, c) for i, s in enumerate(segs) for c in s['chunks']]
L = [f"# 《租界百年》第7集《十里洋场》旁白时间表", "",
     f"- 成片时长：{nfr / FPS:.3f} 秒（{nfr} 帧 @ {FPS} fps）；共 {len(flat)} 块，9 段",
     "- 切块：锁定稿在 。？！；： 和 —— 处切开（—— 留在前一块末尾），同段各块拼起来与锁定稿逐字一致（脚本断言）；每块 ≤40 字（标点计入）。",
     f"- 起始：该块旁白的目标起点（画面内容先出现约 0.3 秒，再开口）。槽长：按每秒 {SD.SPEED} 字估算，只计念出来的字、标点不计（见「念字」列）。合成短于槽长直接贴起点；长出时不要压到下一块起点。",
     f"- 停顿：段内块间 {SD.GAP_IN} 秒，段与段之间 {SD.GAP_SEG} 秒。时码格式 时:分:秒.毫秒，秒数列可直接对轨。", "",
     "| 块 | 段 | 起始(秒) | 起始时码 | 槽长(秒) | 下一块起点前停顿(秒) | 字数 | 念字 | 旁白文本 |",
     "|---|---|---|---|---|---|---|---|---|"]
for k, (seg, c) in enumerate(flat):
    nxt = flat[k + 1][1]['start'] if k + 1 < len(flat) else total
    gap = nxt - c['end']
    L.append(f"| {k+1} | {seg} | {c['start']:.2f} | {tc(c['start'])} | {c['end']-c['start']:.2f} | {gap:.2f} | {len(c['text'])} | {SD.spoken(c['text'])} | {c['text']} |")
open(f"{out}/narration_cues.md", "w", encoding="utf-8").write("\n".join(L) + "\n")

ev = []
for s in segs:
    for c in s['chunks']:
        for g0, g1, lines in c['groups']:
            ev.append([g0, g1, lines])
S = []
for k, (g0, g1, lines) in enumerate(ev):
    nxt = ev[k + 1][0] if k + 1 < len(ev) else 1e9
    S.append(f"{k+1}\n{tc(g0, ',')} --> {tc(min(g1 + 0.3, nxt), ',')}\n" + "\n".join(lines) + "\n")
open(f"{out}/subtitles.srt", "w", encoding="utf-8").write("\n".join(S))
# 校验：字幕按序拼接 = 锁定稿全文
assert "".join("".join(e[2]) for e in ev) == "".join(SD.LOCKED)
print("cues", len(flat), "subs", len(ev))
