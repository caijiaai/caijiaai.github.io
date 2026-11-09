// 《城墙变成了路》—— 时间轴：镜头、人物、动态物件、手写标注、字幕、水印、片尾
import { W, H, Group, drawGroup, makePaper, scribble, scribbleAlong, springFollow, pen, seg, eio, eo, rng, n2, fbm, clamp, lerp, ss, TAU, INK, PAPER, rgba, ellipse, rough } from './sketch.js';
import { buildWorld, ring, C, RX, RY, wallStrokes, WALL_H, BUND, SPLIT, DJG_TH, COL, riverAt } from './world.js';
import { figure, drawPrims, penStroke, wash, dab, hex, mix3 } from './engine.js';
import { walk, stand, mixPose } from './poses.js';

const DUR = 120, BPM = 120, BEAT = 60 / BPM;
const q = new URLSearchParams(location.search);
await Promise.all([document.fonts.load('80px LongCang'), document.fonts.load('80px MaShan')]);
const SUBS = await (await fetch('subs.json')).json();

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const SW = cv.width, SH = cv.height;
const paper = makePaper();
const { G } = buildWorld();
const boilOf = t => Math.floor(t * 12);

// ---------------- 人物与动态物件 ----------------
const FIG_S = 64;   // 地图上走路的人（世界像素，身高）
const walkerTh = (t, t0) => 1.87 - .038 * (t - t0);
const walkerAt = (t, t0) => { const th = walkerTh(t, t0); const [x, y] = ring(th, 1.03); return { x, y, th }; };
const WALKER = { skin: hex('#e8c0a0'), top: hex('#c9796a'), bottom: hex('#5a6173'), hair: hex('#3a2e28'), shoe: hex('#4a4040') };
function drawWalker(t, t0, colA) {
  const p = walkerAt(t, t0), ph = Math.PI * (t - t0) / BEAT;
  const pose = walk(ph, { headYaw: .1 });
  pose.handR = [.14, .43, .02 + .04 * Math.sin(ph)]; pose.elbR = [1, -.2, 0];   // 拎着菜篮
  const prims = figure(WALKER, pose, { x: p.x, y: p.y, S: FIG_S, yaw: Math.PI / 2 + .45 }, { seed: 31, boil: boilOf(t) });
  drawPrims(ctx, prims, { color: colA });
  const h = prims.hand.R, bw = FIG_S * .13;   // 篮子
  const B = [[h[0] - bw, h[1] + 3], [h[0] + bw, h[1] + 3], [h[0] + bw * .8, h[1] + bw * 1.1], [h[0] - bw * .8, h[1] + bw * 1.1]];
  drawPrims(ctx, [{ k: 'knock', poly: B }, { k: 'wash', poly: B, col: hex('#c8a86b'), a: .7, seed: 3 }, { k: 'ink', st: penStroke([...B, B[0]], { w: 1.1, wob: .3, seed: 4 + boilOf(t) % 3, smooth: false, over: 1 }) }, { k: 'ink', st: penStroke([[h[0] - bw * .8, h[1] + 3], [h[0], h[1] - bw * .6], [h[0] + bw * .8, h[1] + 3]], { w: 1, wob: .2, seed: 5 }) }], { color: colA });
  // 一把青菜冒出篮口
  if (colA > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; for (let k = 0; k < 4; k++) dab(ctx, h[0] - bw * .5 + k * bw * .35, h[1] - 1, 3.5, -1.2 + k * .3, hex('#7fa04a'), .7 * colA, k + boilOf(t)); ctx.restore(); }
}
// 远处的“胡萝卜小人”：一团颜色、两条腿、一个头点
const CROWD = (() => { const r = rng(5); return [...Array(30)].map((_, i) => ({ th: r() * TAU, s: .99 + r() * .085, v: (r() < .5 ? -1 : 1) * (.012 + r() * .02), h: 30 + r() * 12, col: [hex('#7187a6'), hex('#b8483e'), hex('#c8b48e'), hex('#8fb3a0'), hex('#e2c46a'), hex('#5a6173')][i % 6], ph: r() * 6 })); })();
function drawCrowd(t, t0, colA) {
  for (const c of CROWD) {
    const th = c.th + c.v * (t - t0), [x, y] = ring(th, c.s), h = c.h * (.75 + .25 * Math.sin(th)), st = Math.sin((t * 4 + c.ph) * Math.PI) * h * .12, sd = (c.ph * 100 | 0) + boilOf(t);
    const body = ellipse(x, y - h * .62, h * .17, h * .28, 10);
    drawPrims(ctx, [{ k: 'knock', poly: body, a: .5 }, { k: 'wash', poly: body, col: c.col, a: .75, seed: sd, j: 1.2 }], { color: colA });
    ctx.globalAlpha = colA; pen(ctx, penStroke([[x - 2, y - h * .38], [x - 3 + st, y]], { w: 1.2, wob: .3, seed: sd, over: 0 }), 1);
    pen(ctx, penStroke([[x + 2, y - h * .38], [x + 3 - st, y]], { w: 1.2, wob: .3, seed: sd + 1, over: 0 }), 1);
    ctx.fillStyle = rgba(INK, .9); ctx.beginPath(); ctx.arc(x, y - h * .98, h * .1, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
}
// 江上的小帆船（第 2 段：从下游上来）
function drawBoats(t) {
  for (let i = 0; i < 3; i++) {
    const t0 = 21.4 + i * 1.3, u = clamp((t - t0) / 9), y = lerp(4240, 3000 + i * 160, eo(u)), x = riverAt(y) + (i - 1) * 70, sd = i * 30 + boilOf(t);
    if (t < t0) continue;
    const s = 1.1 + .2 * (y - 3000) / 1200;
    const hull = [[x - 40 * s, y], [x + 40 * s, y], [x + 30 * s, y + 12 * s], [x - 30 * s, y + 12 * s]], sail = [[x - 4 * s, y - 4], [x - 4 * s, y - 70 * s], [x + 30 * s, y - 60 * s], [x + 34 * s, y - 6]];
    drawPrims(ctx, [{ k: 'knock', poly: sail, a: .6 }, { k: 'wash', poly: sail, col: hex('#a8543e'), a: .55, seed: sd }, { k: 'wash', poly: hull, col: COL.wood, a: .6, seed: sd + 1 }], {});
    pen(ctx, penStroke([...hull, hull[0]], { w: 1.6, wob: .5, seed: sd, smooth: false, over: 2 }), 1);
    pen(ctx, penStroke([...sail, sail[0]], { w: 1.4, wob: .5, seed: sd + 2, smooth: false, over: 2 }), 1);
    for (let k = 1; k < 4; k++) pen(ctx, penStroke([[x - 4 * s, y - k * 17 * s], [x + 31 * s, y - k * 15 * s]], { w: 1, wob: .3, seed: sd + 3 + k, over: 0 }), 1, 0, .7);
    // 船后的水纹
    for (let k = 0; k < 3; k++) pen(ctx, penStroke([[x - 30 - k * 12, y + 20 + k * 14], [x - 6, y + 26 + k * 14], [x + 20 + k * 10, y + 20 + k * 14]], { w: 1, wob: .5, seed: sd + 10 + k, over: 0 }), 1, 0, .6);
  }
}
// 电车（第 3 段，沿外滩开过）
const tramX = t => 4150 + (t - 45.6) * 560;
function drawTram(t) {
  if (t < 45.4 || t > 53.5) return;
  const x = tramX(t), y = 1556, w = 330, h = 150, sd = boilOf(t);
  const body = [[x, y - 12], [x + w, y - 12], [x + w, y - h], [x, y - h]], roof = [[x - 10, y - h], [x + w + 10, y - h], [x + w - 10, y - h - 22], [x + 10, y - h - 22]], low = [[x, y - 12], [x + w, y - 12], [x + w, y - 60], [x, y - 60]];
  drawPrims(ctx, [{ k: 'knock', poly: [...body, ...roof.slice(2)], a: .95 }, { k: 'wash', poly: body, col: hex('#e8dcc0'), a: .55, seed: 3 }, { k: 'wash', poly: low, col: hex('#6f8f73'), a: .6, seed: 4 }, { k: 'wash', poly: roof, col: hex('#6f6a64'), a: .5, seed: 5 }], {});
  const ink = (P, o = {}) => pen(ctx, penStroke(P, { w: o.w ?? 2, wob: .6, seed: (o.s ?? 1) + sd * 3, smooth: false, over: 3 }), 1, 0, o.a ?? .95);
  ink([...body, body[0]], { s: 1 }); ink([...roof, roof[0]], { s: 2 }); ink([[x, y - 60], [x + w, y - 60]], { s: 3, w: 1.4 });
  for (let k = 0; k < 6; k++) { const wx = x + 18 + k * 52; ink([[wx, y - 72], [wx, y - 128], [wx + 38, y - 128], [wx + 38, y - 72]], { s: 10 + k, w: 1.3, a: .8 }); }
  for (const wx of [x + 50, x + w - 50]) { pen(ctx, penStroke(ellipse(wx, y - 4, 16, 16, 12).concat([[wx + 16, y - 4]]), { w: 1.6, wob: .3, seed: 40 + sd }), 1); }
  ink([[x + w * .55, y - h - 22], [x + w * .2, 1192]], { s: 50, w: 1.4 });   // 集电杆
  // 车尾的风：几道墨线
  for (let k = 0; k < 3; k++) { const yy = y - 40 - k * 36; pen(ctx, penStroke([[x - 30, yy], [x - 90 - k * 20, yy + 4], [x - 150, yy - 2]], { w: 1.2, wob: .6, seed: 60 + k + sd }), 1, .35, .6); }
}
// 墙里墙外的两个人
const LOOK_IN = { skin: hex('#e2b394'), top: hex('#6b7a96'), hair: hex('#2f2622'), dress: 1, sleeve: 'long', torso: [.08, .082, .1], flare: .1, shoe: hex('#3a3330') };
const LOOK_OUT = { skin: hex('#eec3a4'), top: hex('#b8483e'), hair: hex('#2a2220'), dress: 1, sleeve: 'none', hairLong: 0, torso: [.078, .066, .09], flare: .08, shoe: hex('#3a3330') };
const FS = 380;
function personSplit(t, who) {
  const L = who === 'in';
  const path = L ? [[54, 5300], [56.4, 5300], [58.4, 5520], [75.6, 5520], [78.8, 5850]] : [[54, 6820], [59.2, 6820], [61.2, 6600], [75.6, 6600], [78.8, 6080]];
  let x = path[0][1], moving = false, ph = 0;
  for (let i = 0; i < path.length - 1; i++) { const [ta, xa] = path[i], [tb, xb] = path[i + 1]; if (t >= ta && t <= tb) { x = lerp(xa, xb, ss((t - ta) / (tb - ta))); moving = xa !== xb; ph = Math.PI * (t - ta) / BEAT; } else if (t > tb) x = xb; }
  const look = ss(seg(t, 64.5, 65.2)) * (1 - ss(seg(t, 69, 70)));   // 同一拍抬头看墙
  const face = L ? 1 : -1;
  let pose = moving ? walk(ph, {}) : stand({ nod: -.35 * look, headYaw: face * .25 * look });
  if (!moving) { const br = Math.sin(t * 2.2 + (L ? 0 : 1)) * .01; pose.lean = (pose.lean ?? 0) + br; if (look > 0) { pose.handR = [lerp(.1, .06, look), lerp(.38, 1.0, look), lerp(.05, .12, look)]; pose.elbR = [1, .3, .4]; } }
  const prims = figure(L ? LOOK_IN : LOOK_OUT, pose, { x, y: SPLIT.ground + 10, S: FS, yaw: face * (Math.PI / 2 + .5) }, { seed: L ? 11 : 13, boil: boilOf(t) });
  const colA = L ? ss(seg(t, 56.2, 57.2)) : ss(seg(t, 60.2, 61.2));
  drawPrims(ctx, prims, { color: colA, ink: ss(seg(t, L ? 55 : 59.4, L ? 56 : 60.4)) });
}
// 拆墙时掉下来的砖屑
function drawDust(t) {
  if (t < 71.6 || t > 76.5) return;
  const r = rng(3);
  for (let k = 0; k < 70; k++) {
    const ts = 71.6 + r() * 3.6, x = SPLIT.wallX0 + r() * (SPLIT.wallX1 - SPLIT.wallX0), y0 = lerp(SPLIT.wallTop, SPLIT.ground - 200, (ts - 71.6) / 3.6) + r() * 80, sz = 5 + r() * 9, c = r() < .6 ? COL.brick : COL.wallGrey, ang = r() * 3;
    const u = t - ts; if (u < 0 || u > 1.1) continue;
    const y = Math.min(SPLIT.ground - 4, y0 + 900 * u * u), xx = x + (r() - .5) * 120 * u;
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; dab(ctx, xx, y, sz, ang + u * 3, c, .7 * (1 - u / 1.1), k); ctx.restore();
  }
}

// ---------------- 手写标注（在纸上，随镜头动） ----------------
const NOTES = [
  { s: '今日 · 老城厢', x: 1360, y: 3180, z: 34, t: .8, d: 1, e: 14.8 },
  { s: '明嘉靖三十二年 · 1553', x: 860, y: 3440, z: 62, t: 21.0, d: 1.4, e: 35.2 },
  { s: '1843 · 开埠', x: 1000, y: 880, z: 72, t: 36.4, d: 1, e: 92 },
  { s: '英租界', x: 1480, y: 1190, z: 58, t: 41.6, d: .7, e: 92 },
  { s: '法租界', x: 1560, y: 1720, z: 58, t: 42.2, d: .7, e: 92 },
  { s: '洋泾浜', x: 920, y: 1468, z: 38, t: 42.7, d: .5, e: 92 },
  { s: '黄浦江', x: 3600, y: 1180, z: 50, t: 43.0, d: .6, rot: 1.48 },
  { s: '外滩', x: 4470, y: 400, z: 80, t: 44.4, d: .6 },
  { s: '城里 · 城厢', x: 4480, y: 2870, z: 66, t: 55.0, d: .9, e: 74.5 },
  { s: '城外 · 租界', x: 6110, y: 2890, z: 66, t: 59.2, d: .9, e: 74.5 },
  { s: '民国元年 · 1912', x: 4480, y: 2700, z: 72, t: 72.4, d: 1.2 },
  { s: '大境阁', x: 1060, y: 1930, z: 56, t: 105.6, d: .6 },
];
const northAt = (s, a = -1.88, b = -1.74) => u => { const th = lerp(a, b, u), [x, y] = ring(th, s); return [x, y, Math.atan2(RY * Math.cos(th), -RX * Math.sin(th))]; };
const southAt = (s, a = 1.36, b = 1.22) => u => { const th = lerp(a, b, u), [x, y] = ring(th, s); return [x, y, Math.atan2(-RY * Math.cos(th), RX * Math.sin(th))]; };
function drawNotes(t) {
  for (const n of NOTES) if (t > n.t && !(n.e && t > n.e + .8)) scribble(ctx, n.s, n.x, n.y, n.z, Math.min((t - n.t) / n.d, n.e ? 1 - seg(t, n.e, n.e + .8) : 1), { rot: n.rot });
  if (t > 86.6) scribbleAlong(ctx, '民国路', northAt(1.24), 64, (t - 86.6) / 1.1);
  if (t > 89.3) scribbleAlong(ctx, '中华路', southAt(1.2), 64, (t - 89.3) / 1.1);
  if (t > 94.6) { const a = northAt(1.24)(0), b = northAt(1.24)(1); const st = penStroke([[a[0] - 30, a[1] + 4], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 22], [b[0] + 30, b[1] + 6]], { w: 6, wob: 1.5, seed: 77 }); pen(ctx, st, eo(seg(t, 94.6, 95.3))); }
  if (t > 95.4) scribbleAlong(ctx, '人民路', northAt(1.24, -1.5, -1.36), 70, (t - 95.4) / 1.1);
}

// ---------------- 镜头 ----------------
const MAP = [2000, 2660, .6], MAP2 = [2000, 2640, .63], MAP6 = [2000, 2580, .6];
const F1 = t => { const p = walkerAt(t, 0); return [p.x + 40, p.y - 70, 3.2]; };
const F6 = t => { const p = walkerAt(t, 97); return [p.x + 40, p.y - 60, 2.4]; };
const TRAMF = t => { const x = springFollow(tt => [tramX(tt) + 220, 1360], 45.8, Math.max(45.8, t), 26)[0]; return [x, 1360, .95]; };
const djg = ring(DJG_TH, .93);
const KEYS = [
  [0, F1], [2.6, F1], [11.5, MAP], [14.6, MAP2], [16.8, [1950, 3120, 1.05]], [21.8, [1800, 3120, 1.0]], [26.4, [2250, 2700, .58]], [34.6, MAP],
  [40.4, [2100, 1250, .74]], [43.0, [2250, 1220, .76]], [46.0, [5950, 1150, .6]], [47.0, TRAMF], [52.0, TRAMF], [54.2, [5960, 3250, .62], .55],
  [55.8, [5250, 3330, .9]], [58.4, [5250, 3330, .9]], [59.6, [6650, 3330, .9]], [63.4, [6650, 3330, .9]], [65.0, [5960, 3250, .62]], [71.5, [5960, 3250, .62]],
  [76.8, [5960, 3300, .7]], [80.6, MAP], [86.0, MAP2], [87.4, [2000, 2060, .8]], [88.7, [2000, 2060, .8]], [90.0, [2000, 3250, .8]], [91.7, [2000, 3250, .8]],
  [93.4, MAP6], [98.2, MAP6], [100.4, F6], [103.4, F6], [105.2, [djg[0] + 60, djg[1] - 90, 1.5]], [108.6, [djg[0] + 40, djg[1] - 80, 1.62]], [113.2, [W / 2, H / 2, .25]], [DUR, [W / 2, H / 2, .25]],
];
const val = (k, t) => typeof k === 'function' ? k(t) : k;
function camera(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const [ta, A0] = KEYS[i], [tb, B0] = KEYS[i + 1], A = val(A0, t), B = val(B0, t);
  const u = eio(seg(t, ta, tb)), dist = Math.hypot(B[0] - A[0], B[1] - A[1]), dip = KEYS[i + 1][2] ?? Math.min(.45, dist / 9000);
  const z = Math.exp(lerp(Math.log(A[2]), Math.log(B[2]), u)) * (1 - dip * Math.sin(Math.PI * u));
  // 镜头不出纸边（片尾整页除外）
  const hw = Math.min(W / 2, SW / 2 / z), hh = Math.min(H / 2, SH / 2 / z);
  return { cx: clamp(lerp(A[0], B[0], u), hw, W - hw), cy: clamp(lerp(A[1], B[1], u), hh, H - hh), z };
}

// ---------------- 片尾：本子合上 ----------------
const COVER = hex('#a8835a');
function drawCover(t) {
  const u = eio(seg(t, 113.6, 116.2)); if (u <= 0) return;
  const th = Math.PI * (1 - u), cx = W * Math.cos(th), lift = H * .05 * Math.sin(th);
  const P = [[0, 0], [cx, -lift], [cx, H + lift], [0, H]];
  ctx.save();
  ctx.fillStyle = rgba([40, 30, 22], .18 * Math.sin(th)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(0, cx) + 160, 0); ctx.lineTo(Math.max(0, cx) + 160, H); ctx.lineTo(0, H); ctx.closePath(); if (cx > 0) ctx.fill();
  ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (const p of P) ctx.lineTo(p[0], p[1]); ctx.closePath();
  ctx.fillStyle = cx > 0 ? rgba(COVER) : rgba([236, 228, 210]); ctx.fill();
  ctx.clip();
  if (cx > 0) { ctx.globalCompositeOperation = 'multiply'; { const rr = rng(17); for (let k = 0; k < 7; k++) { const ex = W * rr() * u, ey = H * rr(); wash(ctx, ellipse(ex, ey, 700 + rr() * 900, 400 + rr() * 500, 20, rr() * 3), mix3(COVER, [90, 60, 40], .3), { a: .08, j: 220, layers: 2, edge: 0, seed: k }); } } ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  pen(ctx, penStroke([[0, 0], [0, H]], { w: 14, wob: 2, seed: 3 }), 1, 0, .6);
  if (t > 116.4) {
    const p = (t - 116.4) / 1.4;
    // 封面上一圈环（呼应开头）+ 片名 + 熊吉大王
    pen(ctx, penStroke(ellipse(5400, 2160, 1200, 760, 64).concat([[5400 + 1200, 2160 - 40]]), { w: 18, wob: 6, seed: 9, over: 60 }), eo(p * 1.2), 0, .85);
    scribble(ctx, '城墙变成了路', 700, 2100, 560, p * 1.1, { col: [40, 30, 24], alpha: .92 });
    if (t > 117.9) scribble(ctx, '熊吉大王', 720, 2780, 260, (t - 117.9) / .8, { col: [40, 30, 24], alpha: .9 });
  }
}

// ---------------- 字幕与水印（屏幕上） ----------------
const subAt = t => SUBS.find(s => t >= s.t0 && t < s.t1);
function drawSubs(t) {
  const s = subAt(t); if (!s) return;
  const a = ss(seg(t, s.t0, s.t0 + .25)) * (1 - ss(seg(t, s.t1 - .25, s.t1)));
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = '50px MaShan'; const w = ctx.measureText(s.text).width, x0 = SW / 2 - w / 2, y = 1012;
  // 一条撕下的纸条（字幕带）
  const strip = rough([[x0 - 42, y - 50], [x0 + w + 42, y - 50], [x0 + w + 42, y + 22], [x0 - 42, y + 22]], 4, (s.t0 * 10) | 0, 8, .05);
  ctx.fillStyle = 'rgba(247,241,226,.88)'; ctx.beginPath(); ctx.moveTo(strip[0][0], strip[0][1]); for (const p of strip) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,95,70,.25)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = a; scribble(ctx, s.text, x0, y, 50, (t - s.t0) / Math.min(.9, [...s.text].length * .045), { font: 'MaShan', alpha: .92 }); ctx.restore();
}
function drawWatermark() {
  ctx.save(); ctx.font = '34px LongCang'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(247,241,226,.55)'; ctx.fillText('熊吉大王', 1882, 1054);
  ctx.fillStyle = rgba(INK, .62); ctx.fillText('熊吉大王', 1880, 1052); ctx.restore();
}

// ---------------- 一帧 ----------------
const deskPage = rough([[0, 0], [W, 0], [W, H], [0, H]], 18, 7, 60, .004);
function render(t) {
  const cam = camera(t), z = cam.z;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#6b5a48'; ctx.fillRect(0, 0, SW, SH);
  ctx.setTransform(z, 0, 0, z, SW / 2 - cam.cx * z, SH / 2 - cam.cy * z);
  const view = [cam.cx - SW / 2 / z, cam.cy - SH / 2 / z, cam.cx + SW / 2 / z, cam.cy + SH / 2 / z];
  ctx.save(); ctx.beginPath(); ctx.moveTo(deskPage[0][0], deskPage[0][1]); for (const p of deskPage) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.clip();
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(paper.img, 0, 0, W, H);
  for (const g of G) drawGroup(ctx, g, t, view);
  // 城墙“长高”（17–21 s）：每帧按当前高度重画
  if (t > 16.3 && t < 21.05) {
    const g = new Group('wallGrow'); wallStrokes(g, WALL_H * eio(seg(t, 17.2, 20.8))); g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [16.3, 17.6] });
    drawGroup(ctx, g, t, view);
  }
  drawNotes(t);
  const today1 = ss(seg(t, 2.6, 4)) * (1 - ss(seg(t, 14.6, 15.6))), today6 = ss(seg(t, 95, 96.5));
  if (t < 16) { drawCrowd(t, 0, today1); }
  if (t > 95) { drawCrowd(t, 95, today6); }
  if (t < 16.2) drawWalker(t, 0, ss(seg(t, 2.2, 3.2)) * (1 - ss(seg(t, 14.8, 15.8))));
  if (t > 97) drawWalker(t, 97, ss(seg(t, 97.4, 98.4)));
  if (t > 21 && t < 36) drawBoats(t);
  drawTram(t);
  if (t > 54.5 && t < 80) { personSplit(t, 'in'); personSplit(t, 'out'); }
  drawDust(t);
  drawCover(t);
  ctx.restore();
  // 纸纹（屏幕空间，随镜头平移）
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pat = ctx.createPattern(paper.tooth, 'repeat'); pat.setTransform(new DOMMatrix().translate((-cam.cx * z) % 256, (-cam.cy * z) % 256));
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .55; ctx.fillStyle = pat; ctx.fillRect(0, 0, SW, SH); ctx.restore();
  drawSubs(t);
  drawWatermark();
}

// ---------------- 声音事件（给混音用） ----------------
const EV = [];
for (const g of G) {
  if (g.o.inkIn && g.o.inkIn[1] > g.o.inkIn[0]) EV.push({ t: g.o.inkIn[0], type: 'pen', dur: g.o.inkIn[1] - g.o.inkIn[0], n: g.lines.length, name: g.name });
  if (g.o.inkOut) EV.push({ t: g.o.inkOut[0], type: 'erase', dur: g.o.inkOut[1] - g.o.inkOut[0], n: g.lines.length, name: g.name });
  if (g.o.colIn) EV.push({ t: g.o.colIn.t, type: 'wash', name: g.name });
}
EV.push({ t: 16.3, type: 'pen', dur: 4.6, n: 600, name: 'wallGrow' });
for (const n of NOTES) EV.push({ t: n.t, type: 'write', dur: n.d });
for (const [t0, s] of [[86.6, '民国路'], [89.3, '中华路'], [95.4, '人民路'], [116.4, 'title'], [117.9, 'sign']]) EV.push({ t: t0, type: 'write', dur: 1.1 });
EV.push({ t: 94.6, type: 'strike', dur: .7 });
for (let t = 0; t < 15.6; t += BEAT) EV.push({ t, type: 'step', pan: 0, gain: 1 - ss(seg(t, 3, 11)) * .7 });
for (let t = 97; t < 104; t += BEAT) EV.push({ t, type: 'step', pan: 0, gain: .7 });
EV.push({ t: 45.6, type: 'tram', dur: 7.6 });
for (let i = 0; i < 3; i++) EV.push({ t: 21.4 + i * 1.3, type: 'boat', dur: 9 });
EV.push({ t: 71.5, type: 'firstErase' });
for (let k = 0; k < 9; k++) EV.push({ t: 71.8 + k * .42, type: 'brick', pan: 0 });
EV.push({ t: 113.6, type: 'cover', dur: 2.6 });
EV.sort((a, b) => a.t - b.t);

window.DUR = DUR;
window.EV = EV;
window.SUBS = SUBS;
window.render = render;
window.TEXTS = t => { const s = subAt(t); if (!s) return []; ctx.font = '50px MaShan'; const w = ctx.measureText(s.text).width; return [{ id: 'sub' + s.t0, text: s.text, x0: SW / 2 - w / 2, y0: 960, x1: SW / 2 + w / 2, y1: 1030 }]; };
if (q.get('t')) render(+q.get('t'));
window.READY = true;
