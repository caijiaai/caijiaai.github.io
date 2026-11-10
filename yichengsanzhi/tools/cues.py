# 旁白时间表（单一来源）：锁定稿逐块切分 + 每块目标起始秒 + 镜号
# 生成 cues.json（画面与字幕都读它）、subs.json、narration_cues.md
import re, json, os
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARA = open(os.path.join(H, 'narration_locked.txt'), encoding='utf-8').read().strip().split('\n')
assert len(PARA) == 8
# 镜号 → (起, 止) 秒；第 i 句旁白在第 i 镜
SHOT = {1: (0, 19), 2: (19, 54), 3: (54, 80), 4: (80, 99), 5: (99, 121), 6: (121, 148), 7: (148, 171), 8: (171, 218)}
LEAD = .8      # 每镜第一块：镜头开始后 0.5 秒出内容，0.3 秒后进旁白
CPS = 4.3      # 估计语速：每秒 4.3 字（不含标点）
def est(s):
    n = len(re.sub(r'[，。？！；：、——"“”「」\s]', '', s)); return n / CPS + s.count('，') * .15 + s.count('、') * .1
def gap(s):    # 块后的自然停顿
    return .7 if s.endswith(('。', '？', '！')) else .55 if s.endswith(('；', '：', '——')) else .45
cues = []
for i, p in enumerate(PARA, 1):
    parts = [x for x in re.findall(r'.+?(?:[。？！；]|——|：|$)', p) if x]
    assert ''.join(parts) == p, i
    t = SHOT[i][0] + LEAD
    for k, x in enumerate(parts, 1):
        assert len(x) <= 40, x
        e = est(x); cues.append(dict(id=f'{i}-{k}', para=i, shot=i, text=x, t=round(t, 2), est=round(e, 2))); t += e + gap(x)
    end = cues[-1]['t'] + cues[-1]['est']
    assert end <= SHOT[i][1] - (17 if i == 8 else .8), (i, round(end, 1))   # 镜 8 留出片尾卡
for a, b in zip(cues, cues[1:]): assert b['t'] - (a['t'] + a['est']) >= .3, (a['id'], b['id'])
json.dump(cues, open(os.path.join(H, 'cues.json'), 'w'), ensure_ascii=False, indent=1)
# 字幕：在逗号等处切成短行（竖屏一行 ≤ 15 字），时间按字数在估计时长里分配
subs = []
for c in cues:
    pieces = [x for x in re.findall(r'.+?(?:[，。？！；：、]|——|$)', c['text']) if x]
    lines, cur = [], ''
    for x in pieces:
        if cur and len(cur + x) > 15: lines.append(cur); cur = x
        else: cur += x
    if cur: lines.append(cur)
    # 很短的一行（≤6 字）不单独闪一下：和下一行并成两行字幕
    k = 0
    while k < len(lines) - 1:
        if len(lines[k]) <= 6 and '\n' not in lines[k + 1]: lines[k:k + 2] = [lines[k] + '\n' + lines[k + 1]]
        else: k += 1
    n = sum(len(x) for x in lines); t = c['t']
    for x in lines: subs.append(dict(t0=round(t, 2), text=x, cue=c['id'])); t += c['est'] * len(x) / n
for k, s in enumerate(subs):
    nxt = subs[k + 1]['t0'] if k + 1 < len(subs) else 1e9
    c = next(c for c in cues if c['id'] == s['cue'])
    last_of_cue = k + 1 == len(subs) or subs[k + 1]['cue'] != s['cue']
    s['t1'] = round(min(nxt - .05, max(c['t'] + c['est'] + .9, s['t0'] + 1.8)) if last_of_cue else nxt - .05, 2)
json.dump(subs, open(os.path.join(H, 'subs.json'), 'w'), ensure_ascii=False, indent=1)
name = {1: '钩子：今天的人民广场 → 退回 1854 年的跑马场（示意）', 2: '泥城之战：当时报纸版画 + 战场原图局部推近', 3: '工部局：牌子、印章、修路/收税/巡捕字卡', 4: '法租界分家：示意地图第一次分色 + 公董局字卡', 5: '合并与三界：示意地图定版，三色分区 + 三个衙门', 6: '会审公廨：内景实照 + 法官/陪审席位示意', 7: '越界筑路：示意地图上马路伸到界外', 8: '收尾：三界并立 + 今天同一地段（今昔对比占位）+ 片尾卡'}
tc = lambda t: f'{int(t // 60):02d}:{t % 60:05.2f}'
L = ['# 《租界百年》第 4 集《一城三治》旁白时间表', '',
     '- 成片无旁白，配乐轨保留（按旁白垫底的音量），旁白位留空；字幕已按本表上轴。',
     '- 「句号」= 锁定稿第几句 - 该句内第几块（在 。？！；： 和 —— 处切开；同一句的各块连起来与锁定稿逐字一致，每块不超过 40 字）。',
     '- 「目标起始秒」= 该块旁白在成片里应开始的时刻，对应该镜内容出现后约 0.3 秒；按每秒约 4.3 字估算每块时长，块与块之间至少留 0.3 秒自然停顿。',
     '- 贴回旁白后，用 silencedetect 实测每块起点，与本表逐块对齐。', '',
     '| 句号 | 旁白原文（锁定稿） | 目标起始秒 | 时间码 | 估计时长 | 镜号 |', '|---|---|---|---|---|---|']
for c in cues: L.append(f"| {c['id']} | {c['text']} | {c['t']:.2f} | {tc(c['t'])} | {c['est']:.1f} s | 镜{c['shot']} |")
L += ['', '## 镜头区间', '', '| 镜号 | 区间 | 内容 |', '|---|---|---|'] + [f'| 镜{k} | {tc(v[0])}–{tc(v[1])} | {name[k]} |' for k, v in SHOT.items()]
L += ['', '今昔对比占位：03:21.00–03:30.00（201.0–210.0 s）。片尾卡：03:30.00–03:38.00（210.0–218.0 s）。', '', '## 整句对照（用于核对一字不改）', ''] + [f'{i}. {p}' for i, p in enumerate(PARA, 1)]
open(os.path.join(H, 'narration_cues.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print(len(cues), 'cues;', len(subs), 'subtitle lines; last end', round(cues[-1]['t'] + cues[-1]['est'], 1))
