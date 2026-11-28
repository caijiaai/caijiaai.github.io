# -*- coding: utf-8 -*-
"""《租界百年》第7集《十里洋场》—— 锁定旁白稿（逐字，不改一字）+ 切块 + 时间表 + 字幕分行"""
import re

LOCKED = [
"侬现在站在人民广场，脚底下这块地，一百多年前是跑马的。人民公园加人民广场，两块地合起来，到今天还是一个跑道的形状。白天看马，夜里逛街——这一集，讲讲老上海的场子是怎么热闹起来的。",
"一八六二年，英国人办的跑马总会在城西圈下这块地。建起上海第三个、也是最后一个跑马场。通往跑马场的那条路，上海人叫它大马路——就是后来的南京路。每年春秋两季大赛，一开就是几天，全城有头有脸的人物都往这里赶。早年头奖只有一瓶香槟，后来卖的赛马彩票，干脆就叫香槟票。",
"一九三四年，跑道西边立起一幢带钟楼的总会大楼，是全上海最扎眼的地标之一。一九五一年，跑马场收归国有，跑道改成人民公园和人民广场。那幢钟楼大楼留了下来，今天是上海历史博物馆。",
"从跑马场往东，就是南京路。外滩到静安寺这一段，就是人们说的十里洋场。把这条路捧热闹的，是四家大百货公司：先施、永安、新新、大新。说来有缘分：四家的创办人，都是广东香山人，都是在澳大利亚打工发家的。一九一七年，先施公司先开，门口立柱上写着「始创不二价」——明码标价，在当时是头一遭。第二年，永安公司开在先施对门，两家隔着南京路打擂台。",
"一九二六年，新新公司跟上，六楼装了一座玻璃电台。播音员坐在玻璃房子里播音，逛街的人全看得见——这是中国人自办的第一座播音电台。一九三六年，大新公司压轴出场，从美国订来的自动扶梯，远东的百货公司里是头一家——人不用爬楼，楼梯自己会走。",
"白天逛公司，夜里去哪里？平民百姓的去处，是西藏路口的大世界。一九一七年，黄楚九办起大世界：哈哈镜、杂耍、戏台、电影，一张门票，玩上一夜。上海人有句话：不到大世界，枉来大上海。一九二八年，大世界重建，中央那座塔楼立起来，成了上海滩的地标。",
"一九三一年，黄楚九病故，大世界落到黄金荣手里——他的故事，下一集再讲。大世界关过一阵长门，二〇一七年重新开放，如今是展示非遗的地方，老楼还在原地。",
"有钱人家的夜生活，在城西愚园路的百乐门。一九三三年开业，舞池的地板装在钢板弹簧上，跳起来会晃，人称弹簧地板。它被称作东方第一乐府，和仙乐斯、大都会、新仙林并称四大舞厅。一九三六年，卓别林来上海，也到百乐门跳过舞。后来它做过电影院，二〇一七年修缮重开，舞池还在，霓虹还亮。",
"三个场子，三个下场：跑马场只剩一个形状，大世界还在演，百乐门还在跳。十里洋场的灯，一盏一盏亮起来，照见的是老上海的欲望和体面。下一集，我们讲讲给这些场子看场子的人——青帮大亨。",
]

PUNCT = set("，。？！；：、—「」")
SPEED = 3.7        # 字/秒（只计念出来的字，标点不计）
GAP_IN = 0.7       # 段内块间停顿
GAP_SEG = 3.0      # 段间停顿
LEAD = 0.55        # 镜头切换点 → 该镜第一块旁白（叠化 0.25 s 结束后约 0.3 s 开口）
END_HOLD = 6.6     # 最后一块结束后片尾卡停留
LINE_MAX = 16      # 字幕每行上限

# 少数需要手工断行的块（行拼接 = 块文本）
MANUAL = {
    "它被称作东方第一乐府，和仙乐斯、大都会、新仙林并称四大舞厅。":
        ["它被称作东方第一乐府，", "和仙乐斯、大都会、新仙林", "并称四大舞厅。"],
    "后来它做过电影院，二〇一七年修缮重开，舞池还在，霓虹还亮。":
        ["后来它做过电影院，", "二〇一七年修缮重开，", "舞池还在，霓虹还亮。"],
    "一八六二年，英国人办的跑马总会在城西圈下这块地。":
        ["一八六二年，", "英国人办的跑马总会", "在城西圈下这块地。"],
    "一九三六年，大新公司压轴出场，从美国订来的自动扶梯，远东的百货公司里是头一家——":
        ["一九三六年，大新公司压轴出场，", "从美国订来的自动扶梯，", "远东的百货公司里是头一家——"],
}


def split_blocks(s):
    parts = [p for p in re.findall(r'.*?(?:——|[。？！；：])|.+$', s) if p]
    assert "".join(parts) == s
    return parts


def spoken(t):
    return sum(1 for c in t if c not in PUNCT)


def split_lines(b):
    if b in MANUAL:
        return MANUAL[b]
    toks = [p for p in re.findall(r'.*?(?:——|[，、。？！；：])|.+$', b) if p]
    lines, cur = [], ""
    for tk in toks:
        if len(cur) + len(tk) <= LINE_MAX:
            cur += tk
        else:
            if cur: lines.append(cur)
            cur = tk
    if cur: lines.append(cur)
    return lines


CHUNKS = [[split_lines(b) for b in split_blocks(s)] for s in LOCKED]


def group_lines(c):
    """字幕：每屏最多两行"""
    if len(c) <= 2:
        return [c]
    if len(c) == 3:
        a = [c[:2], c[2:]]; b = [c[:1], c[1:]]
        sc = lambda g: abs(len("".join(g[0])) - len("".join(g[1])))
        return a if sc(a) <= sc(b) else b
    return [c[k:k + 2] for k in range(0, len(c), 2)]


def build():
    for i, (txt, ch) in enumerate(zip(LOCKED, CHUNKS)):
        assert "".join("".join(c) for c in ch) == txt, i
        for c in ch:
            assert len("".join(c)) <= 40, c
            for l in c:
                assert len(l) <= LINE_MAX + 1, l
    t = LEAD
    segs = []
    for i, ch in enumerate(CHUNKS):
        if i > 0:
            t = t - GAP_IN + GAP_SEG
        s0 = round(t - LEAD, 2)
        chunks = []
        for c in ch:
            text = "".join(c)
            dur = round(spoken(text) / SPEED, 2)
            c0 = round(t, 2); c1 = round(t + dur, 2)
            lines, tt = [], c0
            for g in group_lines(c):
                gd = dur * spoken("".join(g)) / spoken(text)
                lines.append((round(tt, 2), round(tt + gd, 2), g))
                tt += gd
            chunks.append(dict(start=c0, end=c1, text=text, groups=lines))
            t = c1 + GAP_IN
        segs.append(dict(start=s0, chunks=chunks))
    for i in range(len(segs) - 1):
        segs[i]['end'] = segs[i + 1]['start']
    last = segs[-1]['chunks'][-1]['end']
    segs[-1]['endcard'] = round(last + 0.5, 2)
    total = round(last + END_HOLD, 2)
    segs[-1]['end'] = total
    return segs, total


if __name__ == "__main__":
    segs, total = build()
    n = 0
    for i, s in enumerate(segs):
        print(f"seg{i+1} {s['start']:7.2f}-{s['end']:7.2f} ({s['end']-s['start']:.1f}s)")
        for c in s['chunks']:
            n += 1
            print(f"  {n:2d} {c['start']:7.2f}-{c['end']:7.2f} {len(c['text']):2d} | " + " / ".join(l for g in c['groups'] for l in g[2]))
    print("blocks", n, "total", total)
