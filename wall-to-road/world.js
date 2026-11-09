// 《城墙变成了路》：纸上的所有静态速写（地图、外滩、墙里墙外），以及它们出现、上色、收回的时间
import { Group, W, H, ellipse, rough, rng, n2, fbm, clamp, lerp, TAU } from './sketch.js';
import { hex, mix3, foliage, dab, wash } from './engine.js';

// ---------- 颜色 ----------
export const COL = {
  road: hex('#bfc3bd'), roadWarm: hex('#cbbfa9'), brick: hex('#b98a6e'), wallGrey: hex('#9aa3a6'), wallTop: hex('#c9c3b3'),
  tile: hex('#8b93a6'), whitewash: hex('#e6dfcf'), wood: hex('#8a6a50'), water: hex('#a7b8b8'), waterDeep: hex('#8ea5a8'),
  stone: hex('#d8c6a0'), ochre: hex('#cfaa72'), lamp: hex('#e2b04a'), redBrick: hex('#b8705a'), deco: hex('#7fa38a'),
  sky: hex('#c3d0d6'), grass: hex('#c3c96f'), modern: hex('#c8c6c0'), modernWarm: hex('#d9c9ae'), glass: hex('#98b1c8'),
  violet: hex('#5a5f82'), field: hex('#cdc98c'),
};
const shade = c => mix3(c, COL.violet, .45);

// ---------- 城墙环（斜俯视的椭圆） ----------
export const C = [2000, 2650], RX = 1180, RY = 720;
const kR = th => 1 + .028 * (fbm(Math.cos(th) * 1.2 + 3, Math.sin(th) * 1.2 + 3, 5, 3) - .5) * 2;
export const ring = (th, s = 1, lift = 0) => { const k = kR(th) * s; return [C[0] + RX * k * Math.cos(th), C[1] + RY * k * Math.sin(th) - lift]; };
export const arc = (a, b, s = 1, lift = 0, step = .012) => { const n = Math.max(2, Math.ceil(Math.abs(b - a) / step)); return [...Array(n + 1)].map((_, i) => ring(lerp(a, b, i / n), s, lift)); };
export const inCity = (x, y, s = 1) => { const th = Math.atan2((y - C[1]) / RY, (x - C[0]) / RX); const k = kR(th) * s; return ((x - C[0]) / (RX * k)) ** 2 + ((y - C[1]) / (RY * k)) ** 2 < 1; };
// 环向角 θ 从南边起点算的“画的顺序”
const fromSouth = th => { let d = Math.abs(((th - Math.PI / 2) % TAU + TAU) % TAU); return Math.min(d, TAU - d); };

// 环带：分成小段四边形上色（避免环形多边形）
function bandWash(g, s0, s1, col, o = {}) {
  const N = o.n ?? 14;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU - .006, b = (i + 1) / N * TAU + .006;
    const poly = [...arc(a, b, s1, o.lift1 ?? 0, .03), ...arc(b, a, s0, o.lift0 ?? 0, .03)];
    g.wash(poly, col, { a: o.a ?? .5, j: o.j ?? 5, layers: 2, edge: o.edge ?? .1, seed: i * 13 + (o.seed ?? 0) });
  }
}

// ---------- 黄浦江 ----------
const RIV = [[3540, 4330], [3500, 3700], [3520, 3000], [3600, 2300], [3640, 1700], [3570, 1100], [3600, 620], [3800, 300], [4200, 140]];
export const riverAt = y => { for (let i = 0; i < RIV.length - 1; i++) { const a = RIV[i], b = RIV[i + 1]; if (y <= a[1] && y >= b[1]) return lerp(a[0], b[0], (a[1] - y) / (a[1] - b[1])); } return RIV[RIV.length - 1][0]; };
function river(t) {
  const g = new Group('river');
  const L = [], R = [];
  for (let i = 0; i < RIV.length; i++) { const a = RIV[Math.max(0, i - 1)], b = RIV[Math.min(RIV.length - 1, i + 1)]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny); nx /= l; ny /= l; const w = 150 + 20 * Math.sin(i * 1.7); L.push([RIV[i][0] - nx * w, RIV[i][1] - ny * w]); R.push([RIV[i][0] + nx * w, RIV[i][1] + ny * w]); }
  g.line(L, { w: 2.2, gap: .5, seed: 901 }); g.line(R, { w: 2.2, gap: .5, seed: 902 });
  const r = rng(77);
  for (let k = 0; k < 46; k++) { const u = r(), i = Math.min(RIV.length - 2, Math.floor(u * (RIV.length - 1))), f = u * (RIV.length - 1) - i; const x = lerp(RIV[i][0], RIV[i + 1][0], f) + (r() - .5) * 180, y = lerp(RIV[i][1], RIV[i + 1][1], f); g.line([[x - 30, y], [x - 10, y - 4], [x + 10, y], [x + 30, y - 3]], { w: 1.4, over: 2, alpha: .7, seed: 950 + k }); }
  g.wash([...L, ...R.slice().reverse()], COL.water, { a: .5, j: 10, layers: 3, edge: .25, seed: 31 });
  g.wash([...L.map((p, i) => [lerp(p[0], R[i][0], .35), lerp(p[1], R[i][1], .35)]), ...R.slice().reverse()], COL.waterDeep, { a: .18, j: 14, layers: 2, edge: 0, seed: 33 });
  return g.finish({ inkIn: [t, t + 3], colIn: { t: t + 1, x: 3500, y: 3300, v: 900 }, bakeScale: .5 });
}

// ---------- 今天：环路、行道树、楼 ----------
function todayRoad(t0, t1, out) {
  const g = new Group('road' + t0);
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - .03, b = (i + 1) / 16 * TAU + .03; for (const s of [.975, 1.085]) g.line(arc(a, b, s), { w: 2.1, gap: .4, ord: fromSouth((a + b) / 2) + (s > 1 ? .01 : 0) }); }
  for (let i = 0; i < 90; i++) { const a = i / 90 * TAU; g.line(arc(a, a + .022, 1.03), { w: 1.3, over: 1, gap: 0, alpha: .6, ord: fromSouth(a) + .02 }); }
  bandWash(g, .975, 1.085, COL.road, { a: .45, seed: 3 });
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out });
}
function todayTrees(t0, t1, out, seed) {
  const g = new Group('trees' + t0), r = rng(seed);
  for (const s of [.93, 1.14]) for (let i = 0; i < 64; i++) {
    const th = i / 64 * TAU + r() * .03, [x, y] = ring(th, s), cr = 22 + r() * 10, near = .7 + .3 * Math.sin(th);
    g.line([[x, y], [x + 1, y - 26]], { w: 1.6, over: 1, gap: 0, ord: fromSouth(th) });
    const crown = [{ x, y: y - 44, r: cr * near }, { x: x - cr * .4, y: y - 36, r: cr * .6 * near }];
    for (let k = 0; k < 3; k++) { const a0 = -2.6 + k * 1.1 + r() * .3; g.line([...Array(5)].map((_, j) => { const a = a0 + j * .17; return [x + Math.cos(a) * cr * near, y - 44 + Math.sin(a) * cr * near]; }), { w: 1.3, over: 1, gap: 0, alpha: .85, ord: fromSouth(th) + .005 }); }
    g.paint(ctx => foliage(ctx, crown, { seed: i * 7 + (s > 1 ? 500 : 0), dens: .8, scale: .55 }), [[x - cr, y - 80], [x + cr, y]]);
  }
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out, bakeScale: .6 });
}
// 一个斜俯视的盒子（楼 / 房子）
function box(g, x, y, w, d, h, o = {}) {
  const dx = d * .35, dy = -d * .6;
  const F = [[x, y], [x + w, y], [x + w, y - h], [x, y - h]], T = [[x, y - h], [x + w, y - h], [x + w + dx, y - h + dy], [x + dx, y - h + dy]], S = [[x + w, y], [x + w + dx, y + dy], [x + w + dx, y - h + dy], [x + w, y - h]];
  const ord = o.ord ?? 0, lw = o.w ?? 1.7;
  g.line([[x, y - h], [x, y], [x + w, y], [x + w, y - h]], { w: lw, ord, smooth: false, over: 4 });
  g.line([[x - 2, y - h], [x + w, y - h], [x + w + dx, y - h + dy], [x + dx, y - h + dy], [x, y - h]], { w: lw, ord: ord + .001, smooth: false, over: 4, gap: .5 });
  g.line([[x + w + dx, y - h + dy], [x + w + dx, y + dy]], { w: lw * .8, ord: ord + .002, smooth: false, alpha: .8 });
  if (o.windows) { const rows = Math.floor(h / 22), cols = Math.max(1, Math.floor(w / 24)); for (let j = 0; j < rows; j++) { const yy = y - h + 14 + j * 22; for (let i = 0; i < cols; i++) if (n2(x + i, yy, 5) > .3) { const xx = x + 8 + i * (w - 16) / Math.max(1, cols - .5); g.line([[xx, yy], [xx + 9, yy + 1]], { w: 1.2, over: 1, gap: 0, alpha: .75, ord: ord + .003 }); } } }
  const c = o.col ?? COL.modern;
  g.wash(F, c, { a: o.a ?? .38, j: 3, layers: 2, edge: .25, dx: 3, dy: 2, seed: x | 0 });
  g.wash(S, shade(c), { a: (o.a ?? .38) * .9, j: 3, layers: 2, edge: .2, seed: (x | 0) + 1 });
  g.wash(T, o.roof ?? mix3(c, [255, 255, 255], .3), { a: (o.a ?? .38) * .7, j: 3, layers: 2, edge: .2, seed: (x | 0) + 2 });
}
function todayBlocks(name, t0, t1, out, inside, seed) {
  const g = new Group(name), r = rng(seed);
  for (let gy = 1400; gy < 3900; gy += 125) for (let gx = 500; gx < 3400; gx += 170) {
    const x = gx + (r() - .5) * 50, y = gy + (r() - .5) * 30;
    const inn = inCity(x + 60, y, .92), outR = !inCity(x + 60, y, 1.22) && !inCity(x, y - 60, 1.22);
    if (inside ? !inn : !outR) continue;
    if (!inside && (x > riverAt(y) - 260)) continue;
    if (r() < .28) continue;
    if (Math.hypot(x + 50 - ring(DJG_TH, .93)[0], y - ring(DJG_TH, .93)[1]) < 300) continue;
    const w = 70 + r() * 70, h = inside ? 34 + r() * 70 : 50 + r() * 110;
    box(g, x, y, w, 30 + r() * 20, h, { windows: true, col: r() < .5 ? COL.modern : COL.modernWarm, ord: (y - C[1]) ** 2 * .0001 + Math.abs(x - C[0]) * .01 + r() });
  }
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out });
}

// ---------- 明代：城墙、城门、濠、城里屋顶、城外村落 ----------
export const WALL_H = 74;
export const GATES = [-.12, .5, 1.25, 1.95, 2.85, -1.75];
export function wallStrokes(g, h) {
  // 外侧墙脚（近的一半）、墙顶外沿、墙顶内沿、垛口、竖线
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU - .02, b = (i + 1) / 24 * TAU + .02, mid = (a + b) / 2, near = Math.sin(mid) > -.1, o = fromSouth(mid);
    if (near) g.line(arc(a, b, 1.0, 0), { w: 2.3, ord: o, gap: .3 });
    else g.line(arc(a, b, .965, 0), { w: 1.9, ord: o, gap: .4, alpha: .8 });
    g.line(arc(a, b, 1.0, h), { w: 2.3, ord: o + .001, gap: .3 });
    g.line(arc(a, b, .965, h), { w: 1.9, ord: o + .002, gap: .45 });
    // 垛口
    const P = [], n = Math.ceil((b - a) / .022), s = near ? 1.0 : .965;
    for (let k = 0; k < n; k++) {
      const u0 = lerp(a, b, k / n), u1 = lerp(a, b, (k + .5) / n), u2 = lerp(a, b, (k + 1) / n);
      if (GATES.some(gt => Math.abs(((u0 - gt + Math.PI) % TAU + TAU) % TAU - Math.PI) < .05)) { P.push(ring(u0, s, h), ring(u2, s, h)); continue; }
      const p0 = ring(u0, s, h), p1 = ring(u1, s, h), p2 = ring(u2, s, h);
      P.push(p0, [p0[0], p0[1] - 11], [p1[0], p1[1] - 11], p1, p2);
    }
    g.line(P, { w: 1.5, ord: o + .003, smooth: false, over: 1, gap: .2, alpha: .9 });
    if (near) { const v = ring(a + .07, 1.0, 0); g.line([v, [v[0], v[1] - h]], { w: 1.5, ord: o + .004, alpha: .7 }); for (let k = 0; k < 4; k++) { const q = ring(a + .03 + k * .055, 1.0, h * (.3 + .12 * k)); g.line([q, [q[0] + 12, q[1]]], { w: 1.1, ord: o + .005, alpha: .6, over: 1, gap: 0 }); } }
  }
}
function wallGroup(out) {
  const g = new Group('wall');
  wallStrokes(g, WALL_H);
  // 淡彩：外侧墙面（青灰带砖色）+ 墙顶
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * TAU - .02, b = (i + 1) / 28 * TAU + .02, near = Math.sin((a + b) / 2) > -.1, s = near ? 1.0 : .965;
    g.wash([...arc(a, b, s, WALL_H, .03), ...arc(b, a, s, 0, .03)], i % 3 ? COL.wallGrey : mix3(COL.wallGrey, COL.brick, .55), { a: .5, j: 4, layers: 2, edge: .3, dx: 3, seed: i * 5 });
    g.wash([...arc(a, b, 1.0, WALL_H, .03), ...arc(b, a, .965, WALL_H, .03)], COL.wallTop, { a: .42, j: 3, layers: 2, edge: .2, seed: i * 5 + 2 });
  }
  for (let i = 0; i < 40; i++) { const th = i / 40 * TAU; if (Math.sin(th) < 0) continue; const [x, y] = ring(th, 1.0, WALL_H * .5); g.paint(ctx => { for (let k = 0; k < 4; k++) dab(ctx, x + k * 14 - 20, y + (k % 2) * 16 - 8, 6, 0, COL.brick, .3, i * 9 + k); }); }
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [21, 21], ...out });
}
// 城门楼
function gateGroup(t0, t1, out) {
  const g = new Group('gates');
  GATES.forEach((th, i) => {
    const near = Math.sin(th) > -.1, s = near ? 1.0 : .965, [x, y] = ring(th, s, WALL_H), w = 64, h = 34;
    g.line([[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y]], { w: 1.8, smooth: false, ord: i });
    g.line([[x - w / 2 - 16, y - h + 2], [x - w / 4, y - h - 22], [x + w / 4, y - h - 22], [x + w / 2 + 16, y - h + 2]], { w: 1.9, smooth: false, ord: i + .1 });
    g.line([[x - w / 2 - 16, y - h + 2], [x - w / 2 - 22, y - h - 4]], { w: 1.4, ord: i + .2, over: 1 }); g.line([[x + w / 2 + 16, y - h + 2], [x + w / 2 + 22, y - h - 4]], { w: 1.4, ord: i + .2, over: 1 });
    if (near) { const [bx, by] = ring(th, 1.0, 0); g.line([...Array(9)].map((_, k) => { const a = Math.PI + k / 8 * Math.PI; return [bx + Math.cos(a) * 18, by - 30 + Math.sin(a) * 22]; }).concat([[bx + 18, by]]).reverse().concat([[bx - 18, by - 30]]), { w: 1.7, ord: i + .3 }); g.wash(ellipse(bx, by - 22, 16, 24, 14), [70, 64, 60], { a: .3, j: 2, layers: 2, edge: 0, seed: i }); }
    g.wash([[x - w / 2 - 16, y - h + 2], [x - w / 4, y - h - 22], [x + w / 4, y - h - 22], [x + w / 2 + 16, y - h + 2]], COL.tile, { a: .55, j: 3, layers: 2, edge: .3, seed: i * 3 });
    g.wash([[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y]], hex('#b45f48'), { a: .35, j: 3, layers: 2, edge: .2, seed: i * 3 + 1 });
  });
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out });
}
function moatGroup(out) {
  const g = new Group('moat');
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - .03, b = (i + 1) / 16 * TAU + .03; g.line(arc(a, b, 1.11), { w: 2, ord: fromSouth((a + b) / 2), gap: .45 }); g.line(arc(a, b, 1.035), { w: 1.6, ord: fromSouth((a + b) / 2) + .01, gap: .5, alpha: .8 }); }
  for (let i = 0; i < 60; i++) { const th = i / 60 * TAU + .02; g.line(arc(th, th + .03, 1.075), { w: 1.2, over: 1, gap: 0, alpha: .55, ord: fromSouth(th) + .02 }); }
  bandWash(g, 1.035, 1.11, COL.water, { a: .55, seed: 41 });
  return g.finish({ order: (a, b) => a.ord - b.ord, ...out });
}
// 城里：青灰瓦顶的小屋，密密的
function oldInside(out) {
  const g = new Group('oldIn'), r = rng(21);
  for (let gy = 2020; gy < 3330; gy += 74) for (let gx = 860; gx < 3150; gx += 96) {
    const x = gx + (r() - .5) * 30 + (Math.floor(gy / 74) % 2) * 40, y = gy + (r() - .5) * 16;
    if (!inCity(x + 40, y, .9) || !inCity(x, y - 40, .9) || r() < .22) continue;
    if (Math.hypot((x - 1700) / 140, (y - 2560) / 80) < 1) continue;   // 一块空地 / 池子
    const w = 50 + r() * 34, h = 16 + r() * 10, d = 26, ord = Math.hypot(x - 1700, y - 2560) + r() * 200;
    const R0 = [[x - 6, y - h], [x + w + 6, y - h], [x + w - 8, y - h - 18], [x + 8, y - h - 18]];
    g.line([[x, y - h], [x, y], [x + w, y], [x + w, y - h]], { w: 1.4, smooth: false, ord, over: 2, alpha: .85 });
    g.line([[x - 10, y - h + 3], ...R0, [x - 6, y - h]], { w: 1.6, smooth: false, ord: ord + .1, over: 3, gap: .3 });
    for (let k = 1; k < 4; k++) g.line([[x + k * w / 4, y - h - 1], [x + k * w / 4 + 2, y - h - 15]], { w: 1, over: 0, gap: 0, alpha: .5, ord: ord + .2 });
    g.wash(R0, COL.tile, { a: .5, j: 2.5, layers: 2, edge: .3, dx: 2, dy: 1, seed: x | 0 });
    g.wash([[x, y - h], [x, y], [x + w, y], [x + w, y - h]], r() < .7 ? COL.whitewash : COL.brick, { a: .35, j: 2, layers: 2, edge: .2, seed: (x | 0) + 1 });
  }
  // 池子与几棵树
  g.line(ellipse(1700, 2560, 120, 58, 26), { w: 1.6, seed: 411 }); g.wash(ellipse(1700, 2560, 118, 56, 26), COL.water, { a: .45, j: 6, seed: 412 });
  for (let k = 0; k < 16; k++) { const x = 900 + r() * 2200, y = 2050 + r() * 1250; if (!inCity(x, y, .86)) continue; g.paint(ctx => foliage(ctx, [{ x, y: y - 30, r: 24 }], { seed: k * 13, dens: .8, scale: .55 }), [[x - 30, y - 60], [x + 30, y]]); g.line([[x, y], [x, y - 18]], { w: 1.4, over: 1, ord: Math.hypot(x - 1700, y - 2560) }); }
  return g.finish({ order: (a, b) => a.ord - b.ord, ...out, bakeScale: .6 });
}
// 城外（开埠前）：零星村落、田
function oldOutside(out) {
  const g = new Group('oldOut'), r = rng(51);
  for (let k = 0; k < 70; k++) {
    const x = 500 + r() * 2900, y = 1500 + r() * 2500;
    if (inCity(x, y, 1.3) || x > riverAt(y) - 220 || y < 1550) continue;
    if (r() < .5) { // 田
      const w = 120 + r() * 90, h = 50 + r() * 30, P = [[x, y], [x + w, y - 8], [x + w + 30, y - h], [x + 24, y - h + 6]];
      g.line([...P, P[0]], { w: 1.3, smooth: false, alpha: .7, ord: r() });
      for (let i = 1; i < 4; i++) g.line([[x + i * w / 4, y - 2], [x + 24 + i * w / 4 + 6, y - h + 4]], { w: 1, alpha: .5, over: 0, gap: 0, ord: r() });
      g.wash(P, COL.field, { a: .3, j: 6, layers: 2, edge: .15, seed: k });
    } else { const w = 40 + r() * 20, h = 14; g.line([[x, y - h], [x, y], [x + w, y], [x + w, y - h]], { w: 1.3, smooth: false, ord: r() }); const R0 = [[x - 6, y - h], [x + w + 6, y - h], [x + w - 6, y - h - 14], [x + 6, y - h - 14]]; g.line([...R0, R0[0]], { w: 1.4, smooth: false, ord: r() }); g.wash(R0, COL.tile, { a: .45, j: 2, seed: k * 3 }); }
  }
  return g.finish({ order: (a, b) => a.ord - b.ord, ...out, bakeScale: .6 });
}

// ---------- 开埠后：城北和江边的租界（地图上） ----------
const YJB = [[820, 1520], [1500, 1500], [2300, 1470], [3000, 1450], [riverAt(1440) - 150, 1440]];   // 洋泾浜
const SZH = [[620, 650], [1400, 640], [2300, 610], [3100, 560], [riverAt(560) - 150, 560]];        // 苏州河
function concessions(t0, t1, out) {
  const g = new Group('conc'), r = rng(61);
  for (const [P, w] of [[YJB, 22], [SZH, 34]]) {
    g.line(P.map(p => [p[0], p[1] - w]), { w: 1.8, gap: .4 }); g.line(P.map(p => [p[0], p[1] + w]), { w: 1.8, gap: .4 });
    g.wash([...P.map(p => [p[0], p[1] - w]), ...P.slice().reverse().map(p => [p[0], p[1] + w])], COL.water, { a: .45, j: 5, seed: w });
  }
  // 马路：东西向（南京路一类）+ 南北向
  const yR = [800, 1050, 1290, 1640, 1790];
  for (const y of yR) { const xe = riverAt(y) - 160; g.line([[880, y + 6], [1800, y], [xe, y - 6]], { w: 1.9, gap: .3, ord: xe - 900 }); }
  for (let x = 1000; x < 3300; x += 330) { const xx = x + (r() - .5) * 40; g.line([[xx, 700], [xx + 10, 1480]], { w: 1.6, gap: .3, alpha: .85, ord: 3300 - xx }); g.line([[xx + 20, 1570], [xx + 20, 1880 - 40 * Math.abs(xx - 2000) / 1000]], { w: 1.5, gap: .3, alpha: .8, ord: 3300 - xx }); }
  // 街区里的楼（越近江边越高）
  for (let gy = 760; gy < 1860; gy += 120) for (let gx = 950; gx < 3300; gx += 165) {
    const x = gx + (r() - .5) * 40, y = gy + 95 + (r() - .5) * 20;
    if (x > riverAt(y) - 300) continue; if (Math.abs(y - 1500) < 70 || Math.abs(y - 620) < 90) continue;
    if (y > 1600 && inCity(x + 60, y + 60, 1.16)) continue;
    if (r() < .3) continue;
    const nearB = clamp(1 - (riverAt(y) - x) / 1800), h = 40 + r() * 50 + nearB * 120;
    box(g, x, y, 90 + r() * 50, 30, h, { windows: true, col: r() < .5 ? COL.ochre : COL.stone, a: .4, ord: (riverAt(y) - x) + r() * 80 });
  }
  // 路口的灯（暖色小点）
  for (const y of yR) for (let x = 1000; x < 3300; x += 330) { if (x > riverAt(y) - 200) continue; g.paint(ctx => { dab(ctx, x, y - 6, 9, 0, COL.lamp, .55, x + y); dab(ctx, x + 6, y - 2, 6, 1, COL.lamp, .35, x + y + 1); }); }
  // 外滩一线：江边的一排高楼（小）
  for (let y = 720; y < 1420; y += 120) { const x = riverAt(y) - 250; box(g, x, y + 50, 70, 26, 150 + n2(y, 2, 3) * 90, { windows: true, col: COL.stone, a: .45, ord: -100 + y * .1 }); }
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out, bakeScale: .6 });
}

// ---------- 外滩速写（右上一页） ----------
export const BUND = { x0: 4380, x1: 7520, base: 1480, road1: 1610, river0: 1650, river1: 1960 };
function bund(t0, t1, out) {
  const g = new Group('bund'), r = rng(71);
  const B = [
    { x: 4460, w: 360, h: 470, k: 'cornice', c: COL.stone },
    { x: 4840, w: 400, h: 640, k: 'dome', c: hex('#d9cdb0') },
    { x: 5260, w: 360, h: 700, k: 'clock', c: COL.stone },
    { x: 5640, w: 330, h: 520, k: 'arch', c: COL.ochre },
    { x: 5990, w: 450, h: 860, k: 'pyramid', c: hex('#c9b994') },
    { x: 6460, w: 370, h: 560, k: 'cornice', c: hex('#d8cfb8') },
    { x: 6850, w: 560, h: 600, k: 'colon', c: COL.stone },
  ];
  const y0 = BUND.base;
  for (const b of B) {
    const { x, w, h } = b, top = y0 - h, ord = x;
    g.line([[x, y0], [x, top], [x + w, top], [x + w, y0]], { w: 2.4, smooth: false, ord, gap: .25 });
    g.line([[x - 10, top], [x + w + 10, top]], { w: 2.2, ord: ord + .1 }); g.line([[x - 6, top + 14], [x + w + 6, top + 14]], { w: 1.4, ord: ord + .1, alpha: .7 });
    const floors = Math.floor(h / 78);
    for (let f = 1; f < floors; f++) { const yy = top + f * h / floors; if (r() < .7) g.line([[x + 4, yy], [x + w - 4, yy + 1]], { w: 1.2, alpha: .55, ord: ord + .2, gap: .5 }); }
    const cols = Math.floor(w / 48);
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      if (r() < .25) continue;
      const wx = x + 18 + c * (w - 30) / cols, wy = top + 26 + f * h / floors, ww = 18, wh = Math.min(40, h / floors - 30);
      if (b.k === 'arch' && f === floors - 1) g.line([[wx, wy + wh], [wx, wy + 8], [wx + ww / 2, wy], [wx + ww, wy + 8], [wx + ww, wy + wh]], { w: 1.3, smooth: true, ord: ord + .3, over: 1, alpha: .85 });
      else g.line([[wx, wy + wh], [wx, wy], [wx + ww, wy], [wx + ww, wy + wh * .7]], { w: 1.3, smooth: false, ord: ord + .3, over: 2, alpha: .85 });
    }
    if (b.k === 'dome') { const cx = x + w / 2; g.line([...Array(13)].map((_, i) => { const a = Math.PI + i / 12 * Math.PI; return [cx + Math.cos(a) * 110, top - 20 + Math.sin(a) * 110]; }), { w: 2.2, ord: ord + .4 }); g.line([[cx - 130, top - 20], [cx + 130, top - 20], [cx + 120, top], [cx - 120, top]], { w: 1.8, smooth: false, ord: ord + .41 }); g.wash(ellipse(cx, top - 70, 108, 70, 22).filter(p => p[1] < top - 20), hex('#9fb3a8'), { a: .45, seed: 7 }); }
    if (b.k === 'clock') { const cx = x + w / 2; g.line([[cx - 60, top], [cx - 60, top - 180], [cx + 60, top - 180], [cx + 60, top]], { w: 2.2, smooth: false, ord: ord + .4 }); g.line(ellipse(cx, top - 110, 30, 30, 20), { w: 1.8, ord: ord + .42 }); g.line([[cx, top - 110], [cx + 4, top - 132]], { w: 1.6, ord: ord + .43, over: 0 }); g.line([[cx, top - 110], [cx + 16, top - 104]], { w: 1.6, ord: ord + .43, over: 0 }); g.line([[cx - 72, top - 180], [cx, top - 250], [cx + 72, top - 180]], { w: 2, smooth: false, ord: ord + .44 }); g.wash([[cx - 60, top], [cx - 60, top - 180], [cx + 60, top - 180], [cx + 60, top]], b.c, { a: .45, seed: 9 }); }
    if (b.k === 'pyramid') { const cx = x + w / 2; g.line([[cx - 110, top], [cx - 110, top - 120], [cx + 110, top - 120], [cx + 110, top]], { w: 2.2, smooth: false, ord: ord + .4 }); g.line([[cx - 130, top - 120], [cx, top - 300], [cx + 130, top - 120]], { w: 2.3, smooth: false, ord: ord + .41 }); g.wash([[cx - 128, top - 118], [cx, top - 298], [cx + 128, top - 118]], COL.deco, { a: .6, seed: 13, j: 4 }); g.wash([[cx, top - 298], [cx + 128, top - 118], [cx + 30, top - 118]], shade(COL.deco), { a: .35, seed: 14 }); for (let k = 0; k < 4; k++) g.line([[x + 60 + k * 110, top + 20], [x + 60 + k * 110, y0 - 60]], { w: 1.1, alpha: .5, ord: ord + .5, gap: .4 }); }
    if (b.k === 'colon') for (let k = 0; k < 9; k++) g.line([[x + 30 + k * 62, top + 40], [x + 30 + k * 62, top + 200]], { w: 1.4, alpha: .8, ord: ord + .5 });
    g.wash([[x, y0], [x, top], [x + w, top], [x + w, y0]], b.c, { a: .45, j: 5, layers: 3, edge: .3, dx: 4, dy: 2, seed: x });
    g.wash([[x + w * .78, y0], [x + w * .78, top], [x + w, top], [x + w, y0]], shade(b.c), { a: .22, j: 4, seed: x + 3 });
  }
  // 马路、电车轨、电车线、江堤、江
  g.line([[4380, 1600], [7520, 1596]], { w: 2, gap: .3 }); g.line([[4380, 1540], [7520, 1538]], { w: 1.2, alpha: .6, gap: .4 }); g.line([[4380, 1556], [7520, 1555]], { w: 1.2, alpha: .6, gap: .4 });
  g.line([[4380, 1190], [7520, 1186]], { w: 1, alpha: .6, gap: .3 });
  for (let x = 4500; x < 7520; x += 520) g.line([[x, 1600], [x, 1180]], { w: 1.5, alpha: .8 });
  g.line([[4380, 1640], [7520, 1636]], { w: 2.2, gap: .3 }); g.line([[4380, 1660], [7520, 1658]], { w: 1.4, alpha: .7 });
  for (let k = 0; k < 26; k++) { const x = 4400 + r() * 3100, y = 1700 + r() * 240; g.line([[x - 40, y], [x - 12, y - 5], [x + 14, y], [x + 40, y - 4]], { w: 1.3, alpha: .6, over: 1 }); }
  g.wash([[4380, 1660], [7520, 1656], [7500, 1970], [4400, 1960]], COL.water, { a: .5, j: 14, layers: 3, edge: .25, seed: 81 });
  g.wash([[4380, 1480], [7520, 1480], [7520, 1600], [4380, 1600]], COL.roadWarm, { a: .3, j: 6, seed: 82 });
  // 天：几片淡淡的大水色
  for (let k = 0; k < 4; k++) g.wash(ellipse(4900 + k * 750, 420 + (k % 2) * 80, 520, 170, 26), COL.sky, { a: .14, j: 40, layers: 2, edge: 0, seed: 90 + k });
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out, bakeScale: .55 });
}
// 外滩的灯：橱窗、窗户里的暖光
function bundLights(out) {
  const g = new Group('bundLights'), r = rng(73);
  for (let k = 0; k < 90; k++) { const x = 4480 + r() * 2950, y = 1000 + r() * 440, sz = 7 + r() * 5, al = .35 + r() * .2; g.paint(ctx => dab(ctx, x, y, sz, 0, COL.lamp, al, k), [[x - 20, y - 20], [x + 20, y + 20]]); }
  for (let x = 4520; x < 7450; x += 160) g.paint(ctx => { ctx.save(); ctx.globalCompositeOperation = 'multiply'; wash(ctx, [[x, 1478], [x + 90, 1478], [x + 90, 1420], [x, 1420]], COL.lamp, { a: .5, j: 3, seed: x }); ctx.restore(); }, [[x, 1410], [x + 90, 1480]]);
  return g.finish({ ...out, bakeScale: .55 });
}

// ---------- 墙里墙外（右下一页） ----------
export const SPLIT = { x0: 4380, x1: 7520, ground: 3760, wallX0: 5890, wallX1: 6030, wallTop: 2860 };
function splitWall(out) {
  const g = new Group('splitWall'), { wallX0: a, wallX1: b, wallTop: top, ground: gy } = SPLIT;
  g.line([[a, gy], [a, top]], { w: 2.6, ord: 0 }); g.line([[b, gy], [b, top]], { w: 2.6, ord: 1 });
  const P = []; for (let x = a - 10; x < b + 10; x += 32) P.push([x, top], [x, top - 26], [x + 16, top - 26], [x + 16, top]); g.line([[a - 14, top], ...P, [b + 14, top]], { w: 2, smooth: false, ord: 2 });
  for (let y = top + 40; y < gy; y += 44) { const o = (y / 44 | 0) % 2 ? 0 : 35; g.line([[a + 4, y], [b - 4, y + 1]], { w: 1.1, alpha: .5, ord: 3 + y * .001, gap: .3 }); for (let x = a + o; x < b; x += 70) g.line([[x, y], [x, y + 44]], { w: 1, alpha: .45, ord: 3 + y * .001, over: 0 }); }
  g.wash([[a - 4, gy], [a - 4, top - 26], [b + 4, top - 26], [b + 4, gy]], mix3(COL.wallGrey, COL.brick, .35), { a: .55, j: 5, layers: 3, edge: .35, dx: 4, seed: 5 });
  g.wash([[b - 40, gy], [b - 40, top], [b + 4, top], [b + 4, gy]], shade(COL.wallGrey), { a: .25, seed: 6 });
  return g.finish({ order: (a, b) => a.ord - b.ord, ...out });
}
function splitLeft(t0, t1, out) {
  const g = new Group('splitL'), gy = SPLIT.ground, r = rng(91);
  const house = (x, w, h, two) => {
    const top = gy - h, ord = x;
    g.line([[x, gy], [x, top], [x + w, top], [x + w, gy]], { w: 2.2, smooth: false, ord });
    const R0 = [[x - 50, top + 6], [x + w * .2, top - 120], [x + w * .8, top - 120], [x + w + 50, top + 6]];
    g.line([[x - 66, top - 10], ...R0, [x + w + 66, top - 10]], { w: 2.3, ord: ord + .1, smooth: false });
    for (let k = 0; k < 9; k++) { const u = (k + .5) / 9; g.line([[lerp(x - 40, x + w + 40, u), top], [lerp(x + w * .2, x + w * .8, u), top - 112]], { w: 1.1, alpha: .55, ord: ord + .2, over: 1 }); }
    g.wash(R0, COL.tile, { a: .55, j: 4, layers: 3, edge: .35, dx: 4, seed: x });
    g.wash([[x, gy], [x, top], [x + w, top], [x + w, gy]], COL.whitewash, { a: .35, j: 4, seed: x + 1 });
    // 门、窗（木）
    const dx = x + w * .35; g.line([[dx, gy], [dx, gy - 200], [dx + 110, gy - 200], [dx + 110, gy]], { w: 1.9, smooth: false, ord: ord + .3 }); g.line([[dx + 55, gy - 200], [dx + 55, gy]], { w: 1.2, ord: ord + .31, alpha: .7 });
    g.wash([[dx, gy], [dx, gy - 200], [dx + 110, gy - 200], [dx + 110, gy]], COL.wood, { a: .5, seed: x + 2 });
    if (two) { const wy = top + 70; for (let k = 0; k < 2; k++) { const wx = x + 40 + k * (w - 160); g.line([[wx, wy], [wx + 90, wy], [wx + 90, wy + 70], [wx, wy + 70], [wx, wy]], { w: 1.6, smooth: false, ord: ord + .4 }); for (let j = 1; j < 4; j++) g.line([[wx + j * 22, wy], [wx + j * 22, wy + 70]], { w: 1, alpha: .6, ord: ord + .41, over: 0 }); g.wash([[wx, wy], [wx + 90, wy], [wx + 90, wy + 70], [wx, wy + 70]], COL.wood, { a: .35, seed: wx }); } }
  };
  house(4520, 560, 430, false); house(5190, 620, 600, true);
  // 晾衣竹竿和衣服
  g.line([[4560, 3260], [5000, 3240], [5420, 3250]], { w: 1.8, ord: 6000 });
  const clothes = [[4640, 60, 90, hex('#7187a6')], [4760, 50, 70, hex('#e6dfcf')], [4900, 70, 110, hex('#b8483e')], [5100, 56, 80, hex('#c8b48e')], [5260, 50, 100, hex('#8b93a6')]];
  for (const [x, w, h, c] of clothes) { const y = 3250 - 4; const P = [[x, y], [x + w, y - 2], [x + w + 4, y + h], [x + w * .5, y + h - 8], [x - 3, y + h + 4]]; g.line([...P, P[0]], { w: 1.5, smooth: false, ord: 6001 }); g.wash(P, c, { a: .5, j: 3, seed: x }); }
  // 井台
  g.line(ellipse(4840, 3700, 80, 22, 20), { w: 1.8, ord: 6100 }); g.line([[4760, 3700], [4762, 3760], [4920, 3760], [4920, 3700]], { w: 1.8, smooth: false, ord: 6101 }); g.wash([[4760, 3700], [4762, 3760], [4920, 3760], [4920, 3700]], COL.wallGrey, { a: .45, seed: 3 });
  // 石板地
  g.line([[4400, gy], [5890, gy + 2]], { w: 2.2, ord: 6200 }); for (let k = 0; k < 18; k++) { const x = 4440 + r() * 1400, y = gy + 20 + r() * 120; g.line([[x, y], [x + 60 + r() * 40, y + 2]], { w: 1.1, alpha: .5, ord: 6201 }); }
  g.wash([[4400, gy], [5890, gy], [5880, gy + 160], [4420, gy + 150]], COL.wallGrey, { a: .3, j: 10, seed: 4 });
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out });
}
function splitRight(t0, t1, out) {
  const g = new Group('splitR'), gy = SPLIT.ground, r = rng(93);
  // 石库门：一排红砖弄堂房 + 石头门框 + 黑漆门 + 门楣
  const x0 = 6110, x1 = 6880, top = 3080;
  g.line([[x0, gy], [x0, top], [x1, top], [x1, gy]], { w: 2.2, smooth: false, ord: 0 });
  g.line([[x0 - 20, top], [x1 + 20, top]], { w: 2, ord: .1 });
  for (let y = top + 50; y < gy; y += 50) g.line([[x0 + 6, y], [x1 - 6, y + 1]], { w: .9, alpha: .4, ord: .2 + y * .0001, gap: .4 });
  const gx = 6330, gw = 280;
  g.line([[gx, gy], [gx, gy - 400], [gx + gw, gy - 400], [gx + gw, gy]], { w: 2.4, smooth: false, ord: 1 });
  g.line([[gx - 30, gy - 400], [gx + gw / 2, gy - 520], [gx + gw + 30, gy - 400], [gx - 30, gy - 400]], { w: 2.2, smooth: false, ord: 1.1 });
  g.line([...Array(9)].map((_, i) => { const a = Math.PI + i / 8 * Math.PI; return [gx + gw / 2 + Math.cos(a) * 60, gy - 420 + Math.sin(a) * 40]; }), { w: 1.4, ord: 1.2 });
  g.line([[gx + 40, gy], [gx + 40, gy - 360], [gx + gw - 40, gy - 360], [gx + gw - 40, gy]], { w: 1.9, smooth: false, ord: 1.3 }); g.line([[gx + gw / 2, gy - 360], [gx + gw / 2, gy]], { w: 1.3, ord: 1.4 });
  g.line(ellipse(gx + gw / 2 - 22, gy - 200, 8, 8, 10), { w: 1.2, ord: 1.5 }); g.line(ellipse(gx + gw / 2 + 22, gy - 200, 8, 8, 10), { w: 1.2, ord: 1.5 });
  g.wash([[x0, gy], [x0, top], [x1, top], [x1, gy]], COL.redBrick, { a: .45, j: 5, layers: 3, edge: .3, dx: 4, seed: 1 });
  g.wash([[gx - 30, gy], [gx - 30, gy - 400], [gx + gw + 30, gy - 400], [gx + gw + 30, gy]], hex('#cfc6b4'), { a: .55, seed: 2 });
  g.wash([[gx + 40, gy], [gx + 40, gy - 360], [gx + gw - 40, gy - 360], [gx + gw - 40, gy]], hex('#3a3330'), { a: .55, seed: 3 });
  g.wash([[gx - 30, gy - 400], [gx + gw / 2, gy - 520], [gx + gw + 30, gy - 400]], hex('#cfc6b4'), { a: .5, seed: 4 });
  for (const wx of [6160, 6700]) { g.line([[wx, top + 90], [wx + 110, top + 90], [wx + 110, top + 230], [wx, top + 230], [wx, top + 90]], { w: 1.6, smooth: false, ord: 2 }); g.wash([[wx, top + 90], [wx + 110, top + 90], [wx + 110, top + 230], [wx, top + 230]], COL.glass, { a: .4, seed: wx }); }
  // 洋房：两层，阳台、拱窗
  const hx = 6950, hw = 520, ht = 2880;
  g.line([[hx, gy], [hx, ht], [hx + hw, ht], [hx + hw, gy]], { w: 2.3, smooth: false, ord: 3 });
  g.line([[hx - 40, ht + 8], [hx + hw / 2, ht - 110], [hx + hw + 40, ht + 8]], { w: 2.2, smooth: false, ord: 3.1 });
  g.wash([[hx - 40, ht + 8], [hx + hw / 2, ht - 110], [hx + hw + 40, ht + 8]], hex('#b4674e'), { a: .5, seed: 6 });
  for (let k = 0; k < 3; k++) for (let f = 0; f < 2; f++) { const wx = hx + 50 + k * 160, wy = ht + 90 + f * 420; g.line([[wx, wy + 200], [wx, wy + 50], [wx + 50, wy], [wx + 100, wy + 50], [wx + 100, wy + 200]], { w: 1.7, ord: 3.2 + k * .01 }); g.wash([[wx, wy + 200], [wx, wy + 50], [wx + 50, wy], [wx + 100, wy + 50], [wx + 100, wy + 200]], COL.glass, { a: .35, seed: wx + wy }); }
  g.line([[hx - 30, ht + 330], [hx + hw + 30, ht + 330]], { w: 2, ord: 3.3 }); g.line([[hx - 30, ht + 400], [hx + hw + 30, ht + 400]], { w: 2, ord: 3.31 });
  for (let x = hx - 20; x < hx + hw + 30; x += 26) g.line([[x, ht + 335], [x, ht + 398]], { w: 1.1, alpha: .7, ord: 3.32, over: 0 });
  g.wash([[hx, gy], [hx, ht], [hx + hw, ht], [hx + hw, gy]], COL.ochre, { a: .42, j: 5, layers: 3, edge: .3, dx: 4, seed: 7 });
  // 路灯
  g.line([[6930, gy], [6935, 3260]], { w: 2.2, ord: 4 }); g.line([[6895, 3260], [6975, 3260], [6960, 3200], [6910, 3200], [6895, 3260]], { w: 1.8, smooth: false, ord: 4.1 });
  g.paint(ctx => { ctx.save(); ctx.globalCompositeOperation = 'multiply'; wash(ctx, ellipse(6935, 3230, 90, 80, 20), COL.lamp, { a: .45, j: 14, edge: 0, seed: 9 }); ctx.restore(); });
  // 马路
  g.line([[6030, gy], [7520, gy - 2]], { w: 2.2, ord: 5 }); g.line([[6030, gy + 150], [7520, gy + 146]], { w: 1.4, alpha: .6, ord: 5.1, gap: .4 });
  g.wash([[6030, gy], [7520, gy], [7520, gy + 160], [6030, gy + 160]], COL.roadWarm, { a: .35, j: 8, seed: 8 });
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out });
}
function splitRoad(out) {   // 拆墙之后：墙脚变成路
  const g = new Group('splitRoad'), gy = SPLIT.ground;
  g.line([[5860, gy], [6060, gy]], { w: 2.2 }); g.line([[5800, gy + 150], [6100, gy + 150]], { w: 1.4, alpha: .6 });
  g.wash([[5700, gy - 6], [6200, gy - 6], [6220, gy + 165], [5690, gy + 160]], COL.roadWarm, { a: .45, j: 10, seed: 3 });
  return g.finish(out);
}

// ---------- 拆城之后：砖填进濠、新的路 ----------
function brickFill(out) {
  const g = new Group('brickFill'), r = rng(101);
  for (let k = 0; k < 460; k++) { const th = r() * TAU, [x, y] = ring(th, 1.04 + r() * .065); const sz = 7 + r() * 6, rot = r() * 3, c = r() < .6 ? COL.brick : COL.wallGrey, al = .35 + r() * .2; g.paint(ctx => dab(ctx, x, y, sz, rot, c, al, k), [[x - 14, y - 14], [x + 14, y + 14]]); }
  return g.finish({ ...out, bakeScale: .6 });
}
function newRoad(t0, t1, out) {
  const g = new Group('newRoad' + t0);
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - .03, b = (i + 1) / 16 * TAU + .03; for (const s of [.975, 1.1]) g.line(arc(a, b, s), { w: 2.1, gap: .4, ord: fromSouth((a + b) / 2) + (s > 1 ? .01 : 0), seed: 7000 + i * 2 + (s > 1) }); }
  bandWash(g, .975, 1.1, COL.roadWarm, { a: .42, seed: 7 });
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out });
}
function laneDashes(t0, t1, out) {
  const g = new Group('dash' + t0);
  for (let i = 0; i < 100; i++) { const a = i / 100 * TAU; g.line(arc(a, a + .02, 1.038), { w: 1.3, over: 1, gap: 0, alpha: .6, ord: fromSouth(a), seed: 8000 + i }); }
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out });
}
// 大境阁：西北角上一小段老墙 + 一座两层的阁
export const DJG_TH = -2.32;
function dajingge(t0, t1, out) {
  const g = new Group('djg'), [x, y] = ring(DJG_TH, .93, 0);
  const wx0 = x - 150, wx1 = x + 150, wt = y - 80;
  g.line([[wx0, y], [wx0, wt], [wx1, wt], [wx1, y]], { w: 2, smooth: false, ord: 0 });
  const P = []; for (let k = wx0; k < wx1; k += 26) P.push([k, wt], [k, wt - 12], [k + 13, wt - 12], [k + 13, wt]); g.line(P, { w: 1.5, smooth: false, ord: 1 });
  for (let yy = wt + 18; yy < y; yy += 18) g.line([[wx0 + 4, yy], [wx1 - 4, yy]], { w: .9, alpha: .45, ord: 2, gap: .5 });
  const px = x - 60, pw = 120, b1 = wt - 12, f1 = b1 - 50, f2 = f1 - 50;
  g.line([[px, b1], [px, f1], [px + pw, f1], [px + pw, b1]], { w: 1.8, smooth: false, ord: 3 });
  g.line([[px - 40, f1 + 4], [px - 10, f1 - 18], [px + pw + 10, f1 - 18], [px + pw + 40, f1 + 4]], { w: 1.9, ord: 4 });
  g.line([[px + 10, f1 - 18], [px + 10, f2], [px + pw - 10, f2], [px + pw - 10, f1 - 18]], { w: 1.7, smooth: false, ord: 5 });
  g.line([[px - 30, f2 + 4], [px + 20, f2 - 30], [px + pw - 20, f2 - 30], [px + pw + 30, f2 + 4]], { w: 1.9, ord: 6 });
  g.wash([[wx0, y], [wx0, wt - 12], [wx1, wt - 12], [wx1, y]], mix3(COL.wallGrey, COL.brick, .5), { a: .55, seed: 1, dx: 3 });
  g.wash([[px - 40, f1 + 4], [px - 10, f1 - 18], [px + pw + 10, f1 - 18], [px + pw + 40, f1 + 4]], COL.tile, { a: .6, seed: 2 });
  g.wash([[px - 30, f2 + 4], [px + 20, f2 - 30], [px + pw - 20, f2 - 30], [px + pw + 30, f2 + 4]], COL.tile, { a: .6, seed: 3 });
  g.wash([[px, b1], [px, f1], [px + pw, f1], [px + pw, b1]], hex('#b45f48'), { a: .45, seed: 4 });
  g.wash([[px + 10, f1 - 18], [px + 10, f2], [px + pw - 10, f2], [px + pw - 10, f1 - 18]], hex('#b45f48'), { a: .45, seed: 5 });
  return g.finish({ order: (a, b) => a.ord - b.ord, inkIn: [t0, t1], ...out });
}

// ---------- 全部，按时间表 ----------
export function buildWorld() {
  const G = [];
  const add = g => (G.push(g), g);
  // 1. 今天（片头）
  add(river(3.5));
  add(todayBlocks('in1', 4.5, 9, { colIn: { t: 6, x: 1700, y: 3300, v: 600 }, inkOut: [15.6, 17.6], colOut: { t: 14.8, x: 2000, y: 2650, v: 2400 } }, true, 11));
  add(todayBlocks('out1', 6, 10, { colIn: { t: 7.5, x: 1700, y: 3500, v: 700 }, inkOut: [15.4, 17.4], colOut: { t: 14.8, x: 2000, y: 2650, v: 2600 } }, false, 12));
  add(todayTrees(1.2, 7, { colIn: { t: 3, x: 1650, y: 3360, v: 520 }, inkOut: [15.2, 17.2], colOut: { t: 14.6, x: 1650, y: 3360, v: 2200 } }, 5));
  add(todayRoad(0.3, 4.2, { colIn: { t: 2.2, x: 1650, y: 3360, v: 600 }, inkOut: [15.0, 16.6], colOut: { t: 14.5, x: 1650, y: 3360, v: 2000 } }));
  // 2. 明代：城墙（17–21 长高，动态画），城门，城里，濠，城外
  const wall = add(wallGroup({ colIn: { t: 21.6, x: 1700, y: 3370, v: 1100 }, inkOut: [78.2, 82.6], colOut: { t: 78.4, x: 2000, y: 2650, v: 700 } }));
  add(gateGroup(21.2, 23, { colIn: { t: 22.4, x: 2000, y: 3400, v: 1400 }, inkOut: [78, 79.6], colOut: { t: 78, x: 2000, y: 2650, v: 1600 } }));
  add(oldInside({ inkIn: [18.2, 25], colIn: { t: 21, x: 1700, y: 2560, v: 380 }, inkOut: [91.6, 94.6], colOut: { t: 91.2, x: 1700, y: 2560, v: 1500 } }));
  add(oldOutside({ inkIn: [23, 28], colIn: { t: 25, x: 900, y: 3600, v: 700 }, inkOut: [35.5, 38], colOut: { t: 35.2, x: 2500, y: 1200, v: 2400 } }));
  add(moatGroup({ inkIn: [30.4, 32.8], colIn: { t: 31, x: 2000, y: 3420, v: 1100 }, colOut: { t: 79, x: 2000, y: 2650, v: 1500 }, inkOut: [81.2, 83] }));
  // 3. 开埠：租界、外滩
  add(concessions(36, 43, { colIn: { t: 41, x: 3300, y: 1000, v: 900 }, inkOut: [92, 94.6], colOut: { t: 92, x: 1500, y: 1200, v: 2400 } }));
  add(bund(43.4, 47.4, { colIn: { t: 46, x: 4400, y: 1200, v: 1300 } }));
  add(bundLights({ colIn: { t: 47.2, x: 4400, y: 1100, v: 800 } }));
  // 4. 墙里墙外
  add(splitWall({ inkIn: [53.4, 55.4], colIn: { t: 54.4, x: 5960, y: 3300, v: 900 }, inkOut: [71.6, 75], colOut: { t: 72.2, x: 5960, y: 3300, v: 900 } }));
  add(splitLeft(54.2, 58, { colIn: { t: 56, x: 5300, y: 3400, v: 600 } }));
  add(splitRight(58.6, 62.4, { colIn: { t: 60, x: 6700, y: 3400, v: 600 } }));
  add(splitRoad({ inkIn: [76, 77.4], colIn: { t: 76.4, x: 5960, y: 3820, v: 700 } }));
  // 5. 拆城：砖填进濠，墙脚变成路
  add(brickFill({ colIn: { t: 79.6, x: 2000, y: 3420, v: 900 }, fade: [86, 90], fadeMin: .3 }));
  add(newRoad(82.4, 85, { colIn: { t: 83, x: 2000, y: 3420, v: 1300 } }));
  // 6. 今天又回来了
  add(todayBlocks('in6', 92, 96.5, { colIn: { t: 93.4, x: 2000, y: 2650, v: 700 } }, true, 11));
  add(todayBlocks('out6', 92.6, 97, { colIn: { t: 94, x: 2000, y: 1700, v: 900 } }, false, 12));
  add(todayTrees(93, 97.5, { colIn: { t: 94.6, x: 1650, y: 3360, v: 700 } }, 5));
  add(laneDashes(95, 97, {}));
  add(dajingge(104.6, 106.8, { colIn: { t: 105.6, x: ring(DJG_TH, .93)[0], y: ring(DJG_TH, .93)[1], v: 260 } }));
  return { G, wall };
}
