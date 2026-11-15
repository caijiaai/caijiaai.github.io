# 旁白时间表（已冻结）：cues.json 是单一来源，起始秒不再重排。
# 本脚本只做三件事：核对 cues.json 与 narration_locked.txt 逐字一致；生成字幕 subs.json；生成 narration_cues.md。
# 每块的 est = 画面动效用的时长（冻结）；est_sub（若有）= 修订后文字的估计时长，字幕和时间表用它。
import re, json, os
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARA = open(os.path.join(H, 'narration_locked.txt'), encoding='utf-8').read().strip().split('\n')
assert len(PARA) == 8
SHOT = {1: (0, 27), 2: (27, 61.5), 3: (61.5, 86), 4: (86, 113), 5: (113, 138.5), 6: (138.5, 163.5), 7: (163.5, 192), 8: (192, 222)}
cues = json.load(open(os.path.join(H, 'cues.json')))
D = lambda c: c.get('est_sub', c['est'])
for i, p in enumerate(PARA, 1): assert ''.join(c['text'] for c in cues if c['para'] == i) == p, i
for c in cues: assert len(c['text']) <= 40 and SHOT[c['shot']][0] <= c['t'] and c['t'] + D(c) <= SHOT[c['shot']][1], c['id']
for a, b in zip(cues, cues[1:]): assert b['t'] - (a['t'] + D(a)) >= .3, (a['id'], b['id'])
subs = []
for c in cues:
    pieces = [x for x in re.findall(r'.+?(?:[，。？！；：、]|——|$)', c['text']) if x]
    pieces = [y for x in pieces for y in ([x[:x.index('「')], x[x.index('「'):]] if len(x) > 16 and '「' in x and x.index('「') > 0 else [x])]
    lines, cur = [], ''
    for x in pieces:
        if cur and (len(cur + x) > 16 or ('「' in x and '」' not in x)): lines.append(cur); cur = x
        else: cur += x
    if cur: lines.append(cur)
    k = 0
    while k < len(lines) - 1:   # 很短的一行（≤6 字）和下一行并成两行字幕
        if len(lines[k]) <= 6 and '\n' not in lines[k + 1]: lines[k:k + 2] = [lines[k] + '\n' + lines[k + 1]]
        else: k += 1
    n = sum(len(x) for x in lines); t = c['t']
    for x in lines: subs.append(dict(t0=round(t, 2), text=x, cue=c['id'])); t += D(c) * len(x) / n
for k, s in enumerate(subs):
    nxt = subs[k + 1]['t0'] if k + 1 < len(subs) else 1e9
    c = next(c for c in cues if c['id'] == s['cue'])
    last_of_cue = k + 1 == len(subs) or subs[k + 1]['cue'] != s['cue']
    s['t1'] = round(min(nxt - .05, max(c['t'] + D(c) + .9, s['t0'] + 1.8)) if last_of_cue else nxt - .05, 2)
json.dump(subs, open(os.path.join(H, 'subs.json'), 'w'), ensure_ascii=False, indent=1)
name = {1: '钩子：路牌「静安寺路」换成「南京西路」（示意）+ 标题', 2: '静安寺路：老明信片缓推近 + 路牌替换（1945）', 3: '霞飞路：国泰大戏院照片缓推近 + 路名沿革', 4: '改名两波：路牌翻牌（示意）', 5: '威海卫路：顶视示意图，「卫」字淡出', 6: '汽配街：示意街景，招牌逐个亮起', 7: '个人记忆段：暖调，威海路现状空位 + 三张字卡', 8: '收尾：三条路路牌并排回放 + 片尾卡'}
tc = lambda t: f'{int(t // 60):02d}:{t % 60:05.2f}'
L = ['# 《租界百年》第 5 集《马路的老名字》旁白时间表（修订版）', '',
     '- 成片无旁白，配乐轨保留（按旁白垫底的音量），旁白位留空；字幕已按本表上轴。',
     '- 「句号」= 锁定稿第几段 - 该段内第几块；同一段的各块连起来与锁定稿逐字一致，每块不超过 40 字。',
     '- 「目标起始秒」= 该块旁白在成片里应开始的时刻。**本次修订只换了 5-3、6-3、6-4 三块的文字，全部 40 块的起始秒都没有变。**',
     '- 「估计时长」按每秒约 4.3 字估算；修订的三块按新文字重新估算。', '',
     '| 句号 | 旁白原文（锁定稿） | 目标起始秒 | 时间码 | 估计时长 | 镜号 |', '|---|---|---|---|---|---|']
for c in cues: L.append(f"| {c['id']} | {c['text']} | {c['t']:.2f} | {tc(c['t'])} | {D(c):.1f} s | 镜{c['shot']} |")
L += ['', '## 镜头区间', '', '| 镜号 | 区间 | 内容 |', '|---|---|---|'] + [f'| 镜{k} | {tc(v[0])}–{tc(v[1])} | {name[k]} |' for k, v in SHOT.items()]
L += ['', '片尾卡：03:34.00–03:42.00（214.0–222.0 s）。', '', '## 整句对照（用于核对一字不改）', ''] + [f'{i}. {p}' for i, p in enumerate(PARA, 1)]
open(os.path.join(H, 'narration_cues.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print(len(cues), 'cues;', len(subs), 'subtitle lines')
