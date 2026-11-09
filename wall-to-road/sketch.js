// 《城墙变成了路》：画面的底层工具
// 一张大纸（世界坐标），上面是一组组“速写元素”：墨线按笔顺画出、可倒着收回；淡彩烤在离屏画布上，按颜色到达（晕开）或退去（收回）显示。
import { clamp, lerp, ss, TAU, rng, n2, fbm, rgba, INK, PAPER, penStroke, wash, rough, ellipse } from './engine.js';

export const W = 7680, H = 4320;          // 整张纸
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const eo = t => 1 - Math.pow(1 - clamp(t), 3);

// ---------- 钢笔：一条笔画画到 p，从 from 开始（from>0 = 从尾巴擦掉） ----------
const inGap = (st, u) => st.gaps.some(g => u > g[0] && u < g[1]);
export function pen(ctx, st, p = 1, from = 0, alpha = .95, col = INK) {
  if (p <= from) return;
  const end = st.L * clamp(p), beg = st.L * clamp(from);
  ctx.strokeStyle = rgba(col, alpha * st.alpha); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 按宽度分成几段连续路径（比逐段描边快得多）
  let open = false, wsum = 0, wn = 0;
  const flush = () => { if (open) { ctx.lineWidth = wsum / Math.max(1, wn); ctx.stroke(); open = false; wsum = 0; wn = 0; } };
  for (let i = 1; i < st.P.length; i++) {
    if (st.S[i - 1] > end) break;
    if (st.S[i] < beg) continue;
    const u = st.S[i] / st.L; if (inGap(st, u)) { flush(); continue; }
    let [x0, y0] = st.P[i - 1], [x1, y1] = st.P[i];
    if (st.S[i - 1] < beg) { const k = (beg - st.S[i - 1]) / (st.S[i] - st.S[i - 1] || 1); x0 = lerp(x0, x1, k); y0 = lerp(y0, y1, k); }
    if (st.S[i] > end) { const k = (end - st.S[i - 1]) / (st.S[i] - st.S[i - 1] || 1); x1 = lerp(st.P[i - 1][0], x1, k); y1 = lerp(st.P[i - 1][1], y1, k); }
    if (!open) { ctx.beginPath(); ctx.moveTo(x0, y0); open = true; }
    ctx.lineTo(x1, y1); wsum += st.W[i]; wn++;
    if (wn >= 14) { flush(); ctx.beginPath(); ctx.moveTo(x1, y1); open = true; }
  }
  flush();
}
function bboxOf(pts, pad = 0) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of pts) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a - pad, b - pad, c + pad, d + pad]; }

// ---------- 元素组 ----------
// g = { strokes: [{st, a, b}], washes: [fn(ctx)], bbox, inkIn:[t0,t1], inkOut:[t0,t1], colIn:{t,x,y,v}, colOut:{t,x,y,v}, fade:[t0,t1] }
export class Group {
  constructor(name, o = {}) { this.name = name; this.lines = []; this.paints = []; this.o = o; this.pts = []; }
  // 加一笔：pts 世界坐标折线；o 是 penStroke 的参数
  line(pts, o = {}) { if (pts.length < 2) return; const st = penStroke(pts, { w: o.w ?? 2.2, wob: o.wob ?? 1, over: o.over ?? 5, gap: o.gap ?? .35, seed: o.seed ?? (this.lines.length * 7 + 3 + this.name.length * 131), smooth: o.smooth, alpha: o.alpha }); st.bb = bboxOf(st.P, 6); this.lines.push({ st, ord: o.ord }); this.pts.push(...pts); return st; }
  // 加一块淡彩（烤进离屏画布）
  paint(fn, pts) { this.paints.push(fn); if (pts) this.pts.push(...pts); }
  wash(poly, col, o = {}) { this.paint(ctx => wash(ctx, poly, col, o), poly); }
  // 完成：按笔顺分配每笔的时间，烤淡彩
  finish(o = {}) {
    Object.assign(this.o, o);
    const L = this.lines; if (this.o.order) L.sort(this.o.order);
    const total = L.reduce((s, l) => s + l.st.L, 0) || 1; let acc = 0;
    const [t0, t1] = this.o.inkIn ?? [0, 0];
    for (const l of L) { const a = acc / total; acc += l.st.L; const b = acc / total; l.a = lerp(t0, t1, a); l.b = lerp(t0, t1, b); l.u0 = a; l.u1 = b; }
    this.bb = bboxOf(this.pts.length ? this.pts : [[0, 0], [1, 1]], 60);
    if (this.paints.length) this.bake(this.o.bakeScale ?? .75);
    return this;
  }
  bake(sc) {
    const [x0, y0, x1, y1] = this.bb, w = Math.max(4, Math.ceil((x1 - x0) * sc)), h = Math.max(4, Math.ceil((y1 - y0) * sc));
    const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    for (const f of this.paints) f(g);
    this.img = c;
  }
  // 墨线某一笔在 t 时刻的 [from, p]
  inkAt(l, t) {
    let p = l.a === l.b ? (t >= l.a ? 1 : 0) : seg(t, l.a, l.b);
    let from = 0;
    const out = this.o.inkOut;
    if (out) {   // 倒着收回：最后画的最先收；每一笔从尾巴往头缩
      const a = lerp(out[1], out[0], l.u1), b = lerp(out[1], out[0], l.u0);
      const e = a === b ? (t >= a ? 1 : 0) : seg(t, a, b);
      p = Math.min(p, 1 - e);
    }
    return [from, p];
  }
  visibleAt(t) {
    const o = this.o, st = Math.min(o.inkIn?.[0] ?? 1e9, o.colIn?.t ?? 1e9, o.fadeIn?.[0] ?? 1e9);
    if (st < 1e9 && t < st) return false;
    if (o.end !== undefined && t > o.end) return false;
    if (o.fade && !o.fadeMin && t > o.fade[1]) return false;
    return true;
  }
}

// 颜色晕开的边：一个带噪声的圆
function blob(cx, cy, r, seed, n = 72) {
  const P = [], amp = Math.min(r * .32, 190);
  for (let i = 0; i < n; i++) { const a = i / n * TAU, c = Math.cos(a), s = Math.sin(a); const d = r + (fbm(c * 1.6 + seed, s * 1.6 + seed * .7, seed, 3) - .5) * 2 * amp + (n2(c * 7 + seed, s * 7, seed + 3) - .5) * amp * .3; P.push([cx + c * Math.max(0, d), cy + s * Math.max(0, d)]); }
  return P;
}
const pathOf = (ctx, P) => { ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); };
const farthest = (bb, x, y) => Math.max(Math.hypot(bb[0] - x, bb[1] - y), Math.hypot(bb[2] - x, bb[1] - y), Math.hypot(bb[0] - x, bb[3] - y), Math.hypot(bb[2] - x, bb[3] - y)) + 260;

// 画一个组：淡彩（乘法）+ 墨线
export function drawGroup(ctx, g, t, view) {
  if (!g.visibleAt(t)) return;
  const bb = g.bb; if (bb[2] < view[0] || bb[0] > view[2] || bb[3] < view[1] || bb[1] > view[3]) return;
  let fadeA = 1; if (g.o.fade) fadeA = 1 - (1 - (g.o.fadeMin ?? 0)) * ss(seg(t, g.o.fade[0], g.o.fade[1]));
  if (g.o.fadeIn) fadeA *= ss(seg(t, g.o.fadeIn[0], g.o.fadeIn[1]));
  if (g.img && fadeA > 0) {
    const ci = g.o.colIn, co = g.o.colOut, sd = g.name.length * 3.7;
    let r = 1e9, front = null;
    if (ci) { if (t < ci.t) r = -1; else { r = (t - ci.t) * ci.v; const F = farthest(bb, ci.x, ci.y); if (r < F) front = [ci.x, ci.y, r]; else r = 1e9; } }
    let r2 = 1e9, back = null;
    if (co && t > co.t) { const F = farthest(bb, co.x, co.y); r2 = F - (t - co.t) * co.v; if (r2 < F) back = [co.x, co.y, Math.max(0, r2)]; }
    if (r > 0 && r2 > 0) {
      ctx.save();
      if (front) { ctx.beginPath(); pathOf(ctx, blob(front[0], front[1], front[2], sd)); ctx.clip(); }
      if (back) { ctx.beginPath(); pathOf(ctx, blob(back[0], back[1], back[2], sd + 5)); ctx.clip(); }
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = fadeA;
      ctx.drawImage(g.img, bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]);
      ctx.restore();
      // 湿的前沿：颜料在边上积一圈
      if (front && front[2] > 30) {
        ctx.save(); ctx.beginPath(); pathOf(ctx, blob(front[0], front[1], front[2], sd)); pathOf(ctx, blob(front[0], front[1], Math.max(0, front[2] - 46), sd).reverse()); ctx.clip();
        ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .45 * fadeA; ctx.drawImage(g.img, bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]); ctx.restore();
      }
    }
  }
  const ia = (g.o.inkAlpha ?? .95) * fadeA;
  if (ia > 0) for (const l of g.lines) {
    const b = l.st.bb; if (b[2] < view[0] || b[0] > view[2] || b[3] < view[1] || b[1] > view[3]) continue;
    const [from, p] = g.inkAt(l, t); if (p <= 0) continue;
    pen(ctx, l.st, p, from, ia);
  }
}

// ---------- 纸 ----------
export function makePaper() {
  const pw = 1280, ph = 720, c = new OffscreenCanvas(pw, ph), g = c.getContext('2d'), im = g.createImageData(pw, ph);
  for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
    const x = i * W / pw, y = j * H / ph;
    const m = fbm(x * .0011, y * .0011, 2, 3) * .6 + fbm(x * .0062 + 9, y * .0062, 5, 2) * .4;
    const k = 1 - .05 * (m - .45), o = (j * pw + i) * 4;
    im.data[o] = 245 * k; im.data[o + 1] = 238 * k; im.data[o + 2] = 222 * k; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  // 纸纹：小块平铺，乘在最上面
  const T = 256, tc = new OffscreenCanvas(T, T), tg = tc.getContext('2d'), ti = tg.createImageData(T, T);
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const v = n2(i * .35, j * .35, 41) * .5 + n2(i * .9, j * .12, 43) * .3 + n2(i * 1.7, j * 1.7, 47) * .2;
    const k = 255 - Math.max(0, v - .45) * 46, o = (j * T + i) * 4;
    ti.data[o] = k; ti.data[o + 1] = k; ti.data[o + 2] = k - 2; ti.data[o + 3] = 255;
  }
  tg.putImageData(ti, 0, 0);
  return { img: c, tooth: tc };
}

// ---------- 镜头：关键帧 [t, cx, cy, z]，段内三次缓动 ----------
export function camTrack(keys) {
  return t => {
    if (t <= keys[0][0]) return { cx: keys[0][1], cy: keys[0][2], z: keys[0][3] };
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b[0]) {
        const u = eio(seg(t, a[0], b[0])), lz = lerp(Math.log(a[3]), Math.log(b[3]), u);
        // 远距离移动时，中途稍微拉远一点（像手移本子）
        const dist = Math.hypot(b[1] - a[1], b[2] - a[2]), dip = b[4] ?? Math.min(.5, dist / 9000);
        return { cx: lerp(a[1], b[1], u), cy: lerp(a[2], b[2], u), z: Math.exp(lz) * (1 - dip * Math.sin(Math.PI * u)) };
      }
    }
    const k = keys[keys.length - 1]; return { cx: k[1], cy: k[2], z: k[3] };
  };
}
// 临界阻尼弹簧跟拍：从 t0 起积分（确定性）
export function springFollow(target, t0, t, k = 30) {
  const dt = 1 / 120; let p = target(t0), v = [0, 0]; const w = Math.sqrt(k);
  for (let s = t0; s < t; s += dt) { const g = target(Math.min(t, s + .35)); for (let i = 0; i < 2; i++) { const a = w * w * (g[i] - p[i]) - 2 * w * v[i]; v[i] += a * dt; p[i] += v[i] * dt; } }
  return p;
}

// ---------- 手写 ----------
export function scribble(ctx, text, x, y, size, p, o = {}) {
  if (p <= 0) return 0;
  ctx.save(); ctx.font = `${size}px ${o.font ?? 'LongCang'}`; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(text).width, a = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  if (o.rot) { ctx.translate(a, y); ctx.rotate(o.rot); ctx.translate(-a, -y); }
  ctx.beginPath(); ctx.rect(a - size * .3, y - size * 1.3, (w + size * .4) * clamp(p) + 1, size * 1.8); ctx.clip();
  ctx.fillStyle = rgba(o.col ?? INK, o.alpha ?? .9); ctx.fillText(text, a, y);
  ctx.restore();
  return w;
}
// 沿一条曲线逐字写（路名写在环路上）
export function scribbleAlong(ctx, text, at, size, p, o = {}) {
  const n = [...text].length, chars = [...text];
  ctx.save(); ctx.font = `${size}px ${o.font ?? 'LongCang'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(o.col ?? INK, o.alpha ?? .9);
  for (let i = 0; i < n; i++) {
    const k = clamp(p * n - i); if (k <= 0) break;
    const [x, y, ang] = at(n === 1 ? .5 : i / (n - 1));
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang + (n2(i, 3, 9) - .5) * .12);
    ctx.beginPath(); ctx.rect(-size * .6, -size * .7, size * 1.2 * k, size * 1.4); ctx.clip();
    ctx.fillText(chars[i], 0, 0); ctx.restore();
  }
  ctx.restore();
}
export { ellipse, rough, rng, n2, fbm, clamp, lerp, ss, TAU, INK, PAPER, rgba };
