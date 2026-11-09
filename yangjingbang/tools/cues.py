# 旁白时间表（单一来源）：锁定稿逐块切分 + 每块目标起始秒 + 镜号
# 生成 cues.json（画面与字幕读它）、narration_cues.md、subs.json
import re, json, os
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARA = open(os.path.join(H, 'narration_locked.txt'), encoding='utf-8').read().strip().split('\n')
assert len(PARA) == 8
SHOT = {1: (1, 0, 8), 2: (2, 8, 45), 3: (3, 45, 65), 4: (4, 65, 105), 5: (5, 105, 135), 6: (6, 135, 165), 7: (7, 165, 190), 8: (8, 190, 222)}
# 每块的目标起始秒（对应该镜内容出现之后约 0.3 秒）
START = {
 1: [0.5, 4.8],
 2: [9.0, 15.3, 20.4, 25.2, 30.6, 34.4, 38.2, 41.0],
 3: [46.0, 49.4, 56.0],
 4: [65.8, 72.4, 78.8, 81.3, 85.4, 92.0],
 5: [105.8, 113.4, 115.4],
 6: [135.8, 139.0, 143.2, 144.9, 150.4, 152.6],
 7: [165.6, 169.0, 175.0, 178.3],
 8: [190.6, 192.6, 198.7, 206.2, 213.0],
}
CPS = 4.3   # 估计语速：每秒 4.3 字（不含标点）
def est(s):
    n = len(re.sub(r'[，。？！；：、——"“”\s]', '', s)); return n / CPS + s.count('，') * .15 + s.count('、') * .1
cues = []
for i, p in enumerate(PARA, 1):
    parts = [x for x in re.findall(r'.+?(?:[。？！；]|——|：|$)', p) if x]
    assert ''.join(parts) == p and len(parts) == len(START[i]), (i, len(parts))
    for k, (x, t) in enumerate(zip(parts, START[i]), 1):
        assert len(x) <= 40
        cues.append(dict(id=f'{i}-{k}', para=i, shot=SHOT[i][0], text=x, t=t, est=round(est(x), 2)))
# 检查：每块念完后至少留 0.3 秒，且不超出本镜
for a, b in zip(cues, cues[1:]):
    gap = b['t'] - (a['t'] + a['est'])
    assert gap >= .3, (a['id'], b['id'], round(gap, 2))
for c in cues:
    s0, s1 = SHOT[c['para']][1:]
    assert s0 <= c['t'] and c['t'] + c['est'] <= s1 + .4, (c['id'], c['t'], c['est'])
json.dump(cues, open(os.path.join(H, 'cues.json'), 'w'), ensure_ascii=False, indent=1)
# 字幕：长块在逗号处切成短行（竖屏一行 ≤ 15 字），时间按字数在估计时长里分配
subs = []
for c in cues:
    pieces = [x for x in re.findall(r'.+?(?:[，。？！；：、]|——|$)', c['text']) if x]
    lines, cur = [], ''
    for x in pieces:
        if cur and len(cur + x) > 15: lines.append(cur); cur = x
        else: cur += x
    if cur: lines.append(cur)
    n = sum(len(x) for x in lines); t = c['t']
    for k, x in enumerate(lines):
        d = c['est'] * len(x) / n
        subs.append(dict(t0=round(t, 2), t1=None, text=x, cue=c['id'])); t += d
# 每条字幕显示到下一条开始前（同块内连续；块之间最多多停 1.2 秒）
for k, s in enumerate(subs):
    nxt = subs[k + 1]['t0'] if k + 1 < len(subs) else s['t0'] + 3
    c = next(c for c in cues if c['id'] == s['cue'])
    end_c = c['t'] + c['est']
    s['t1'] = round(min(nxt - .05, max(end_c + 1.2, s['t0'] + 1.8) if (k + 1 == len(subs) or subs[k + 1]['cue'] != s['cue']) else nxt - .05), 2)
    s['t1'] = max(s['t1'], min(nxt - .05, s['t0'] + 1.2))
json.dump(subs, open(os.path.join(H, 'subs.json'), 'w'), ensure_ascii=False, indent=1)
# narration_cues.md
shot_name = {1: '钩子：今天的延安东路退回成河', 2: '老地图：界河、两岸租界与道路、九座桥', 3: '桥浮现又淡去，只剩地名牌', 4: '码头洋行街景 + 顺口溜字卡', 5: '填浜筑路（示意动画）', 6: '爱多亚路街景 + 路牌', 7: '路牌翻页：四个名字', 8: '弯道示意（今昔对比占位）+ 片尾卡'}
L = ['# 《租界百年》第 2 集《洋泾浜》旁白时间表', '',
     '- 成片无旁白，配乐轨保留，旁白位留空；字幕已按本表上轴。',
     '- 「句号」= 锁定稿第几句 - 该句内第几块（在 。？！；： 和 —— 处切开；同一句的各块连起来与锁定稿逐字一致，每块不超过 40 字）。',
     '- 「目标起始秒」= 该块旁白在成片里应开始的时刻，对应该镜内容出现之后约 0.3 秒；按每秒约 4.3 字估算每块时长，块与块之间至少留 0.3 秒自然停顿。',
     '- 贴回旁白后，用 silencedetect 实测每块起点，与本表逐块对齐（目标误差 ≤ 0.06 秒）。', '',
     '| 句号 | 旁白原文（锁定稿） | 目标起始秒 | 时间码 | 估计时长 | 镜号 |', '|---|---|---|---|---|---|']
tc = lambda t: f'{int(t // 60):02d}:{t % 60:05.2f}'
for c in cues: L.append(f"| {c['id']} | {c['text']} | {c['t']:.2f} | {tc(c['t'])} | {c['est']:.1f} s | 镜{c['shot']} |")
L += ['', '## 镜头区间', '', '| 镜号 | 区间 | 内容 |', '|---|---|---|'] + [f'| 镜{k} | {tc(v[1])}–{tc(v[2])} | {shot_name[k]} |' for k, v in SHOT.items()]
L += ['', '## 整句对照（用于核对一字不改）', ''] + [f'{i}. {p}' for i, p in enumerate(PARA, 1)]
open(os.path.join(H, 'narration_cues.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print(len(cues), 'cues;', len(subs), 'subtitle lines; last end', round(cues[-1]['t'] + cues[-1]['est'], 1))
