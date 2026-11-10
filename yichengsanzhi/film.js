// 《租界百年》第 4 集《一城三治》—— 竖屏 1080×1920，老照片 + 动效
// 画面时间点全部取自 cues.json（旁白时间表）：每块旁白的目标起始秒 = 该镜内容出现后约 0.3 秒
const SW = 1080, SH = 1920, DUR = 218;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
await Promise.all(['60px LongCang', '60px MaShan', '600 60px NotoSerif', '400 60px NotoSerif'].map(f => document.fonts.load(f)));
const CUES = await (await fetch('cues.json')).json();
const SUBS = await (await fetch('subs.json')).json();
const PHOTOS = await fetch('photos/photos.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
const IMG = {};
await Promise.all(Object.entries(PHOTOS).map(([k, p]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = res; im.src = 'photos/' + p.file; })));
const T = id => CUES.find(c => c.id === id).t;          // 某块旁白的起始秒
const V = id => T(id) - .3;                            // 对应画面内容出现的时刻

// ---------------- 小工具 ----------------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a)), ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const back = t => { t = clamp(t); const s = 1.7; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const h1 = x => { const n = Math.sin(x * 127.1) * 43758.5453; return n - Math.floor(n); };
const INK = '#3e2b1e', PAPER = '#e9dec6';
const RNG = rng(5);

// ---------------- 纸、颗粒、暗角 ----------------
const paper = (() => {
  const c = new OffscreenCanvas(SW, SH), g = c.getContext('2d'); g.fillStyle = PAPER; g.fillRect(0, 0, SW, SH);
  const r = rng(9);
  for (let i = 0; i < 260; i++) { const x = r() * SW, y = r() * SH, rr = 40 + r() * 220; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(150,110,60,${.025 + r() * .04})`); gr.addColorStop(1, 'rgba(150,110,60,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  const im = g.getImageData(0, 0, SW, SH), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(im, 0, 0);
  const v = g.createRadialGradient(SW / 2, SH / 2, SH * .3, SW / 2, SH / 2, SH * .75); v.addColorStop(0, 'rgba(60,35,15,0)'); v.addColorStop(1, 'rgba(60,35,15,.38)'); g.fillStyle = v; g.fillRect(0, 0, SW, SH);
  return c;
})();
const grainTiles = [...Array(6)].map((_, k) => { const c = new OffscreenCanvas(256, 256), g = c.getContext('2d'), im = g.createImageData(256, 256), r = rng(100 + k); for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (r() - .5) * 90; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); return c; });
function grain(t, a = .07) { const k = Math.floor(t * 12) % 6, p = ctx.createPattern(grainTiles[k], 'repeat'); ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = a; ctx.fillStyle = p; ctx.fillRect(0, 0, SW, SH); ctx.restore(); }
function scratches(t, a = .25) { const f = Math.floor(t * 12), r = rng(f * 7 + 3); ctx.save(); ctx.strokeStyle = `rgba(250,240,220,${a})`; ctx.lineWidth = 1.2; for (let i = 0; i < 2; i++) if (r() < .5) { const x = r() * SW; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (r() - .5) * 30, SH); ctx.stroke(); } for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(40,25,10,${r() * .35})`; ctx.beginPath(); ctx.arc(r() * SW, r() * SH, r() * 2.4, 0, 6.3); ctx.fill(); } ctx.restore(); }

// ---------------- 文字 ----------------
function text(s, x, y, size, o = {}) {
  ctx.save(); ctx.font = `${o.weight ?? 400} ${size}px ${o.font ?? 'NotoSerif'}`; ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = o.base ?? 'alphabetic';
  ctx.globalAlpha *= (o.a ?? 1); if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); x = 0; y = 0; }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw ?? 8; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.col ?? INK; ctx.fillText(s, x, y); ctx.restore();
}
// 手写体逐字写出（左到右）
function hand(s, x, y, size, p, o = {}) {
  if (p <= 0) return; ctx.save(); ctx.font = `${size}px ${o.font ?? 'LongCang'}`; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(s).width, x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  if (o.rot) { ctx.translate(x0, y); ctx.rotate(o.rot); ctx.translate(-x0, -y); }
  ctx.beginPath(); ctx.rect(x0 - 10, y - size * 1.3, (w + 20) * clamp(p), size * 1.8); ctx.clip();
  ctx.globalAlpha *= (o.a ?? 1); ctx.fillStyle = o.col ?? INK; ctx.fillText(s, x0, y); ctx.restore(); return w;
}
// 角标：年份或地名，手写在左上角
const CORNER = [[0.3, 18.6, '今日 · 人民广场'], [19.3, 53.6, '泥城浜 · 1854'], [54.3, 79.6, '工部局 · 1854'], [80.3, 98.6, '法租界 · 1862'], [99.3, 120.6, '一城三治'], [121.3, 147.6, '会审公廨 · 1864'], [148.3, 170.6, '越界筑路'], [171.3, 209.6, '三个衙门 · 一座城']];
function corner(t) {
  for (const [a, b, s] of CORNER) if (t > a && t < b) {
    const p = seg(t, a, a + .8), q = 1 - seg(t, b - .4, b);
    hand(s, 64, 200, 58, p, { a: q, col: INK });
    ctx.save(); ctx.globalAlpha = q * p; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(64, 220); ctx.lineTo(64 + 300 * p, 224); ctx.stroke(); ctx.restore();
  }
}
// 示意标记：动画镜头右上角标“示意”，与老照片区分
function schematicTag(a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a * .85; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2; ctx.strokeRect(SW - 170, 160, 110, 50); text('示意', SW - 115, 196, 30, { col: '#7a5a3a', weight: 600 }); ctx.restore(); }
function poly(P, close) { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (const p of P) ctx.lineTo(p[0], p[1]); if (close) ctx.closePath(); }
function inkLine(P, w = 2.4, col = INK, p = 1) { if (p <= 0 || P.length < 2) return; const n = Math.max(2, Math.floor(P.length * clamp(p))); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; poly(P.slice(0, n)); ctx.stroke(); ctx.restore(); }
function sign(cx, cy, w, h, lines, o = {}) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot ?? 0); ctx.scale(o.sx ?? 1, o.sy ?? 1); ctx.globalAlpha *= (o.a ?? 1);
  ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.fillRect(-w / 2 + 10, -h / 2 + 12, w, h);
  ctx.fillStyle = o.bg ?? '#2f4a6b'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = o.fg ?? '#efe6cf'; ctx.lineWidth = 5; ctx.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24);
  for (const [s, y, size, f] of lines) text(s, 0, y, size, { col: o.fg ?? '#efe6cf', font: f ?? 'NotoSerif', weight: 600 });
  // 搪瓷的磨损
  const r = rng(o.seed ?? 3); for (let i = 0; i < 18; i++) { ctx.fillStyle = `rgba(20,15,10,${.15 + r() * .25})`; ctx.beginPath(); ctx.arc((r() - .5) * w, (r() - .5) * h, 2 + r() * 7, 0, 6.3); ctx.fill(); }
  ctx.restore();
}
// 老照片：冲印、褐调、缓慢推拉
function photo(key, cx, cy, w, h, kb, o = {}) {
  const im = IMG[key]; ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot ?? 0); ctx.globalAlpha *= (o.a ?? 1);
  ctx.fillStyle = 'rgba(30,20,10,.3)'; ctx.fillRect(-w / 2 - 14, -h / 2 - 8, w + 40, h + 44);
  ctx.fillStyle = '#f2ead6'; ctx.fillRect(-w / 2 - 24, -h / 2 - 24, w + 48, h + 48 + (o.caption ? 56 : 0));
  ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
  if (im) {
    const s = (o.fit === 'contain' ? Math.min : Math.max)(w / im.width, h / im.height) * kb.z, iw = im.width * s, ih = im.height * s;
    ctx.filter = o.filter ?? 'sepia(.75) contrast(1.08) brightness(.97)';
    let ox = -iw / 2 + kb.x * (iw - w) / 2, oy = -ih / 2 + kb.y * (ih - h) / 2;
    if (kb.fx !== undefined) { const k = kb.fk ?? 1; ox = lerp(-iw / 2, -iw * kb.fx, k); oy = lerp(-ih / 2, -ih * kb.fy, k); }   // 把原图上 (fx, fy) 这一点推到画框中心
    ctx.drawImage(im, ox, oy, iw, ih); ctx.filter = 'none';
  } else { ctx.fillStyle = '#cdbb98'; ctx.fillRect(-w / 2, -h / 2, w, h); }
  const v = ctx.createRadialGradient(0, 0, Math.min(w, h) * .3, 0, 0, Math.max(w, h) * .7); v.addColorStop(0, 'rgba(40,25,10,0)'); v.addColorStop(1, 'rgba(40,25,10,.45)'); ctx.fillStyle = v; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  if (o.caption) text(o.caption, cx, cy + h / 2 + 46, o.capSize ?? 26, { col: '#5a4532', a: o.a ?? 1 });
}
// 照片说明只写地点：照片年代不在锁定史实里，不上屏

// 照片下方只标地点或实物名，不标年份
const CAP = { battle: '《字林西报》刊印的泥城之战版画（后人绘制的想象图）', battle_map: '泥城之战形势图', mixed_court: '会审公廨' };
const credit = k => CAP[k] ?? '';
const RED = '#8a2414', STAMP = '#a8231a', BLUE = '#2f4a6b', GREEN = '#4f6b3a';
function tagAt(x, y, a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a * .85; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 110, 50); text('示意', x + 55, y + 36, 30, { col: '#7a5a3a', weight: 600 }); ctx.restore(); }
function card(cx, cy, w, h, p, o = {}) {
  if (p <= 0) return false; const sc = back(p);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot ?? 0); ctx.scale(sc, sc); ctx.globalAlpha = (o.a ?? 1) * clamp(p * 2);
  ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.fillRect(-w / 2 + 10, -h / 2 + 12, w, h);
  ctx.fillStyle = o.bg ?? '#efe2bf'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = o.border ?? RED; ctx.lineWidth = 5; ctx.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20);
  return true;
}
function stampBox(s, cx, cy, p, o = {}) { if (p <= 0) return; const z = o.size ?? 70, sc = lerp(1.6, 1, eo(p)); ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot ?? -.15); ctx.scale(sc, sc); ctx.globalAlpha = clamp(p * 1.5) * .9 * (o.a ?? 1); ctx.strokeStyle = o.col ?? STAMP; ctx.lineWidth = 7; ctx.font = `${z}px MaShan`; const w = ctx.measureText(s).width + 50; ctx.strokeRect(-w / 2, -z * .75, w, z * 1.25); text(s, 0, z * .3, z, { col: o.col ?? STAMP, font: 'MaShan' }); ctx.restore(); }
function person(x, y, s, o = {}) { ctx.save(); ctx.globalAlpha *= (o.a ?? 1); ctx.fillStyle = o.col ?? INK; ctx.beginPath(); ctx.arc(x, y - 52 * s, 9 * s, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 11 * s, y - 40 * s); ctx.lineTo(x + 11 * s, y - 40 * s); ctx.lineTo(x + 14 * s, y - 6 * s); ctx.lineTo(x - 14 * s, y - 6 * s); ctx.closePath(); ctx.fill(); const st = Math.sin(o.ph ?? 0) * 6 * s; ctx.lineWidth = 4 * s; ctx.strokeStyle = o.col ?? INK; ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 8 * s); ctx.lineTo(x - 5 * s + st, y); ctx.moveTo(x + 4 * s, y - 8 * s); ctx.lineTo(x + 5 * s - st, y); ctx.stroke(); ctx.restore(); }
// 衙门牌子
function plaque(s, cx, cy, p, o = {}) { if (p <= 0) return; const sc = back(p), z = o.size ?? 56; ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.globalAlpha = clamp(p * 2) * (o.a ?? 1); ctx.font = `${z}px MaShan`; const w = ctx.measureText(s).width + 60, h = z * 1.6; ctx.fillStyle = 'rgba(30,20,10,.3)'; ctx.fillRect(-w / 2 + 6, -h / 2 + 8, w, h); ctx.fillStyle = o.bg ?? '#3a2a1e'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 4; ctx.strokeRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16); text(s, 0, z * .35, z, { col: '#e8cf8a', font: 'MaShan' }); ctx.restore(); }

// ---------------- 示意地图：北在上；苏州河、洋泾浜、黄浦江、县城 ----------------
const SZH = 430, YJB = 820, CITY = [560, 1235, 175];
const Z = {   // 各区的多边形
  us: [[520, 270], [945, 270], [945, SZH - 14], [520, SZH - 14]],                 // 美租界（苏州河北）
  uk: [[200, SZH + 14], [945, SZH + 14], [945, YJB - 14], [200, YJB - 14]],       // 英租界
  fr: [[330, YJB + 14], [945, YJB + 14], [945, 1080], [700, 1080], [620, CITY[1] - CITY[2] + 6], [500, CITY[1] - CITY[2] + 6], [330, 1060]],   // 法租界
};
const COL = { uk: 'rgba(205,140,120,', us: 'rgba(205,140,120,', fr: 'rgba(130,160,195,', cn: 'rgba(190,170,110,' };
function mapBase(t, o = {}) {
  ctx.save(); ctx.globalAlpha *= (o.a ?? 1);
  // 华界底色（全图）
  ctx.fillStyle = COL.cn + (o.cn ?? .0) + ')'; ctx.fillRect(60, 250, 885, 1230);
  // 黄浦江
  ctx.fillStyle = 'rgba(110,135,138,.45)'; ctx.beginPath(); ctx.moveTo(945, 220); ctx.bezierCurveTo(990, 700, 930, 1100, 975, 1500); ctx.lineTo(1080, 1500); ctx.lineTo(1080, 220); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(945, 220); ctx.bezierCurveTo(990, 700, 930, 1100, 975, 1500); ctx.stroke();
  text('黄浦江', 1020, 1100, 34, { rot: Math.PI / 2, font: 'MaShan' });
  // 苏州河、洋泾浜
  for (const [y, w, lab] of [[SZH, 22, '苏州河'], [YJB, 16, '洋泾浜']]) { ctx.fillStyle = 'rgba(110,135,138,.5)'; ctx.fillRect(80, y - w / 2, 870, w); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(80, y - w / 2); ctx.lineTo(950, y - w / 2); ctx.moveTo(80, y + w / 2); ctx.lineTo(950, y + w / 2); ctx.stroke(); text(lab, 140, y + 8, 26, { col: '#2f5560', weight: 600 }); }
  // 县城
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(CITY[0], CITY[1], CITY[2], 0, 6.3); ctx.stroke();
  ctx.restore();
}
function zone(key, a, o = {}) { if (a <= 0) return; const P = Z[key]; ctx.save(); if (o.dx || o.dy) ctx.translate(o.dx ?? 0, o.dy ?? 0); ctx.fillStyle = (o.col ?? COL[key]) + (.55 * a) + ')'; poly(P, true); ctx.fill(); ctx.setLineDash([14, 9]); ctx.strokeStyle = o.stroke ?? INK; ctx.globalAlpha = a; ctx.lineWidth = 2.5; poly(P, true); ctx.stroke(); ctx.restore(); }
function cityFill(a) { if (a <= 0) return; ctx.save(); ctx.fillStyle = COL.cn + (.6 * a) + ')'; ctx.beginPath(); ctx.arc(CITY[0], CITY[1], CITY[2] - 3, 0, 6.3); ctx.fill(); ctx.restore(); }

// ================= 镜 1：今天的人民广场 → 1854 年的跑马场（0–19） =================
function todaySquare(y0, c) {   // 示意：广场 + 三座建筑
  const g = (a, b) => `rgb(${a.map((v, i) => Math.round(lerp(b[i], v, c))).join(',')})`;
  ctx.save();
  ctx.fillStyle = g([150, 175, 120], [200, 190, 150]); ctx.beginPath(); ctx.roundRect(140, y0 + 260, 800, 300, 30); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = g([200, 200, 195], [215, 205, 180]); ctx.beginPath(); ctx.ellipse(540, y0 + 410, 120, 60, 0, 0, 6.3); ctx.fill(); ctx.stroke();
  // 市政府（方楼）、博物馆（圆顶方座）、大剧院（弧形屋顶）
  const B = (x, w, h, col) => { ctx.fillStyle = g(col, [205, 190, 160]); ctx.fillRect(x, y0 + 240 - h, w, h); ctx.strokeRect(x, y0 + 240 - h, w, h); for (let r = 0; r < h / 40 - 1; r++) for (let k = 0; k < w / 36 - 1; k++) { ctx.fillStyle = g([150, 180, 200], [190, 175, 145]); ctx.fillRect(x + 14 + k * 36, y0 + 240 - h + 16 + r * 40, 18, 22); } };
  B(380, 320, 230, [210, 205, 195]); // 市政府
  ctx.fillStyle = g([190, 170, 130], [205, 190, 160]); ctx.fillRect(100, y0 + 120, 220, 120); ctx.strokeRect(100, y0 + 120, 220, 120); ctx.beginPath(); ctx.ellipse(210, y0 + 120, 100, 70, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); // 博物馆
  ctx.fillStyle = g([235, 235, 240], [215, 205, 180]); ctx.fillRect(760, y0 + 110, 220, 130); ctx.strokeRect(760, y0 + 110, 220, 130); ctx.beginPath(); ctx.moveTo(730, y0 + 110); ctx.quadraticCurveTo(870, y0 + 20, 1010, y0 + 110); ctx.closePath(); ctx.fill(); ctx.stroke(); // 大剧院
  ctx.restore();
}
function raceCourse(y0, t) {   // 1854：跑马场跑道 + 泥城浜
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.fillStyle = '#d8c79c'; ctx.beginPath(); ctx.ellipse(560, y0 + 190, 360, 120, 0, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c3b483'; ctx.beginPath(); ctx.ellipse(560, y0 + 190, 290, 72, 0, 0, 6.3); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 6; i++) { const a = t * .9 + i * .35, x = 560 + Math.cos(a) * 325, y = y0 + 190 + Math.sin(a) * 96; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, 16, 8, Math.atan2(Math.cos(a) * 96, -Math.sin(a) * 325), 0, 6.3); ctx.fill(); }
  ctx.fillStyle = 'rgba(110,135,138,.6)'; ctx.fillRect(110, y0 + 20, 40, 330); ctx.strokeRect(110, y0 + 20, 40, 330);
  text('泥城浜', 130, y0 + 390, 32, { font: 'MaShan', col: '#2f5560' });
  ctx.restore();
}
function shot1(t) {
  ctx.drawImage(paper, 0, 0);
  const split = eio(seg(t, 1.6, 2.8)), c = 1 - .6 * ss(seg(t, 2.6, 4));
  todaySquare(330, c);
  text('今天', 90, 330, 44, { align: 'left', weight: 600, col: RED, a: ss(seg(t, 1.6, 2.2)) });
  const T2 = T('1-2'), k = CUES.find(c => c.id === '1-2').est / 10;
  [['市政府', 540, 420, 0], ['博物馆', 210, 420, 4], ['大剧院', 870, 420, 8]].forEach(([s, x, y, d]) => hand(s, x, y, 46, seg(t, T2 - .1 + d * k, T2 + .4 + d * k), { align: 'center', col: RED, font: 'MaShan' }));
  if (split > 0) {
    const yb = lerp(1920, 1000, split);
    ctx.save(); ctx.beginPath(); ctx.rect(0, yb, SW, SH - yb); ctx.clip(); ctx.drawImage(paper, 0, 0);
    ctx.filter = 'sepia(.5)'; raceCourse(yb + 30, t); ctx.filter = 'none';
    // 还打过一仗：烟和炮弹
    if (t > V('1-3') + 3) for (let i = 0; i < 5; i++) { const p = seg(t, V('1-3') + 3 + i * .5, V('1-3') + 4.4 + i * .5); if (p <= 0 || p >= 1) continue; const x = lerp(160, 520 + i * 60, p), y = yb + 250 - Math.sin(p * Math.PI) * 200; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.3); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, yb); ctx.lineTo(SW, yb); ctx.stroke(); ctx.restore();
    stampBox('1854', 880, yb + 80, seg(t, 2.6, 3.0), { size: 60 });
    hand('跑马场', 560, yb + 240, 58, seg(t, V('1-3') + 1.6, V('1-3') + 2.4), { align: 'center', font: 'MaShan', col: RED });
  }
  if (t > V('1-4')) { const p = seg(t, V('1-4') + 1.4, V('1-4') + 2.6); [['1', COL.uk], ['2', COL.fr], ['3', COL.cn]].forEach(([n, c], i) => { const q = back(seg(p, i * .25, i * .25 + .5)); if (q <= 0) return; ctx.save(); ctx.translate(300 + i * 240, 1420); ctx.scale(q, q); ctx.fillStyle = c + '.85)'; ctx.fillRect(-90, -50, 180, 100); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-90, -50, 180, 100); ctx.restore(); }); hand('三个上海', 540, 1525, 60, seg(t, V('1-4') + 2.6, V('1-4') + 3.4), { align: 'center', font: 'MaShan' }); }
  tagAt(SW - 170, 160, 1);
}

// ================= 镜 2：泥城之战（19–54） =================
function shot2(t) {
  ctx.drawImage(paper, 0, 0);
  // 1853：万国商团
  if (t < V('2-3') + .4) {
    const a = 1 - ss(seg(t, V('2-3'), V('2-3') + .4));
    ctx.save(); ctx.globalAlpha = a;
    if (card(540, 560, 860, 300, seg(t, V('2-1'), V('2-1') + .4))) { text('1853', 0, -60, 90, { font: 'MaShan', col: RED }); text('太平军打下南京', 0, 40, 52, { font: 'MaShan', a: seg(t, V('2-1') + .8, V('2-1') + 1.3) }); text('租界里开会：组织万国商团', 0, 110, 40, { weight: 600, a: seg(t, V('2-1') + 4.4, V('2-1') + 5) }); ctx.restore(); }
    for (let i = 0; i < 8; i++) person(220 + i * 90, 1010, 1.2, { a: seg(t, V('2-1') + 5 + i * .1, V('2-1') + 5.4 + i * .1), col: '#3a3a4a' });
    stampBox('武装中立', 540, 1220, seg(t, V('2-2') + 1.6, V('2-2') + 2), { size: 76 });
    ctx.restore();
  }
  // 1854 年 4 月：战场原图，推到老跑马场
  if (t > V('2-3') - .2 && t < V('2-6') + .6) {
    const a = ss(seg(t, V('2-3') - .2, V('2-3') + .4)) * (1 - ss(seg(t, V('2-6'), V('2-6') + .6)));
    const zin = eio(seg(t, V('2-5'), V('2-5') + 2.4));
    // 推近：原图上 OLD RACE COURSE（老跑马场）的中心约在宽 54%、高 36% 处
    photo('battle_map', 540, 820, 900, 1100, { z: lerp(1.0, 2.3, zin), fx: .54, fy: .36, fk: zin }, { fit: 'contain', caption: credit('battle_map'), a, filter: 'sepia(.55) contrast(1.05)' });
    if (zin > .95) { const p = seg(t, V('2-5') + 2.4, V('2-5') + 3.2); ctx.save(); ctx.globalAlpha = a * p; ctx.strokeStyle = STAMP; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(540, 820, 330, 220, -.05, 0, 6.3 * p); ctx.stroke(); ctx.restore(); text('老跑马场', 540, 1110, 56, { font: 'MaShan', col: STAMP, a: a * seg(t, V('2-5') + 2.8, V('2-5') + 3.4), stroke: 'rgba(242,234,214,.9)', sw: 8 }); text('今人民广场、西藏中路一带', 540, 1180, 38, { weight: 600, col: INK, a: a * seg(t, V('2-5') + 3.6, V('2-5') + 4.2), stroke: 'rgba(242,234,214,.9)', sw: 7 }); }
    if (card(540, 1440, 640, 130, seg(t, V('2-3'), V('2-3') + .4), { a: a * (1 - zin) })) { text('1854 年 4 月', 0, 22, 64, { font: 'MaShan', col: RED }); ctx.restore(); }
    stampBox('租界不借', 800, 420, seg(t, V('2-4'), V('2-4') + .35), { size: 64, a: a * (1 - zin), rot: .12 });
  }
  // 报纸版画 + 不到两个小时 + 泥城之战
  if (t > V('2-6')) {
    const a = ss(seg(t, V('2-6'), V('2-6') + .6)), u = seg(t, V('2-6'), 54);
    photo('battle', 540, 760, 900, 754, { z: lerp(1.0, 1.08, u), x: 0, y: 0 }, { a, caption: credit('battle'), capSize: 24, filter: 'sepia(.5) contrast(1.05)' });
    text('不到两个小时', 540, 1260, 56, { font: 'MaShan', col: RED, a: seg(t, V('2-6') + .8, V('2-6') + 1.3) });
    text('清兵退了', 540, 1330, 44, { weight: 600, a: seg(t, V('2-6') + 1.6, V('2-6') + 2.1) });
    if (t > V('2-7')) { stampBox('泥城之战', 540, 1440, seg(t, V('2-7') + 1.0, V('2-7') + 1.35), { size: 80, rot: -.06 }); }
  }
}

// ================= 镜 3：工部局（54–80，图形字卡） =================
function shot3(t) {
  ctx.drawImage(paper, 0, 0);
  if (t < V('3-3')) { const a = 1 - ss(seg(t, V('3-3') - .4, V('3-3'))); ctx.save(); ctx.globalAlpha = a; hand('要管住这块地', 540, 620, 76, seg(t, V('3-2'), V('3-2') + 1.2), { align: 'center', font: 'MaShan' }); hand('得有个自己的衙门', 540, 760, 76, seg(t, V('3-2') + 1.4, V('3-2') + 2.6), { align: 'center', font: 'MaShan', col: RED }); for (let i = 0; i < 6; i++) person(260 + i * 110, 1080, 1.3, { a: seg(t, V('3-1') + i * .1, V('3-1') + .5 + i * .1), col: '#3a3a4a' }); ctx.restore(); }
  if (t > V('3-3')) {
    plaque('工 部 局', 540, 470, seg(t, V('3-3'), V('3-3') + .5), { size: 92 });
    hand('1854', 540, 640, 84, seg(t, V('3-3') + .4, V('3-3') + 1.1), { align: 'center', font: 'MaShan', col: RED });
    [['修路', 230], ['收税', 540], ['巡捕', 850]].forEach(([s, x], i) => { if (card(x, 840, 260, 170, seg(t, V('3-4') + i * .7, V('3-4') + .4 + i * .7), { rot: (i - 1) * .03 })) { text(s, 0, 24, 72, { font: 'MaShan' }); ctx.restore(); } });
    if (t > V('3-5')) { if (card(540, 1110, 820, 180, seg(t, V('3-5'), V('3-5') + .4), { border: BLUE })) { text('清政府：没有批准', 0, 22, 62, { font: 'MaShan', col: BLUE }); ctx.restore(); } }
    [['自己开会', 0], ['自己选董事', 1.2], ['自己说了算', 2.6]].forEach(([s, d], i) => text(s, 540, 1300 + i * 70, 48, { weight: 600, a: seg(t, V('3-6') + d, V('3-6') + d + .4), col: i === 2 ? RED : INK }));
  }
}

// ================= 镜 4：法租界分家（80–99，示意地图） =================
function shot4(t) {
  ctx.drawImage(paper, 0, 0);
  mapBase(t); cityFill(.5);
  const split = ss(seg(t, V('4-3'), V('4-3') + 1.2)), shake = t > V('4-2') && t < V('4-3') ? Math.sin(t * 40) * 6 * seg(t, V('4-2'), V('4-2') + .4) : 0;
  zone('us', 1); zone('uk', 1);
  zone('fr', 1, { col: split > .5 ? COL.fr : COL.uk, dx: shake + split * 0, dy: split * 14 });
  plaque('工部局', 560, 620, seg(t, V('4-1'), V('4-1') + .5), { size: 52 });
  text('英 · 美 · 法 三家合用', 560, 720, 40, { weight: 600, a: seg(t, V('4-1') + 1.2, V('4-1') + 1.7) * (1 - split) });
  if (split > 0) { plaque('公董局', 640, 980, seg(t, V('4-3') + 1.4, V('4-3') + 1.9), { size: 46, bg: '#1e2c40' }); text('法租界', 470, 930, 44, { font: 'MaShan', col: BLUE, a: split }); }
  if (card(540, 1500, 760, 130, seg(t, V('4-3') + 2.4, V('4-3') + 2.8), { border: BLUE })) { text('1862 · 法租界自立门户', 0, 20, 52, { font: 'MaShan', col: BLUE }); ctx.restore(); }
  text('自己的路自己修', 300, 1400, 40, { weight: 600, a: seg(t, V('4-4'), V('4-4') + .4) * (1 - seg(t, V('4-4') + 3.5, V('4-4') + 4)) });
  text('自己的税自己收', 780, 1400, 40, { weight: 600, a: seg(t, V('4-4') + 1.7, V('4-4') + 2.1) * (1 - seg(t, V('4-4') + 3.5, V('4-4') + 4)) });
  tagAt(SW - 170, 160, 1);
}

// ================= 镜 5：合并与三界（99–121，本集核心画面） =================
function threeZones(t, o = {}) {
  mapBase(t, { cn: o.cn ?? .22 }); cityFill(.75);
  zone('us', 1); zone('uk', 1); zone('fr', 1, { dy: 14 });
  text('公共租界', 600, 560, 60, { font: 'MaShan', col: RED, a: o.labA ?? 1 }); text('法租界', 620, 935, 52, { font: 'MaShan', col: BLUE, a: o.labA ?? 1 }); text('华界 · 县城', CITY[0], CITY[1] + 15, 52, { font: 'MaShan', col: GREEN, a: o.labA ?? 1 });
}
function shot5(t) {
  ctx.drawImage(paper, 0, 0);
  const merge = ss(seg(t, V('5-1') + 2.6, V('5-1') + 4));
  mapBase(t, { cn: .22 }); cityFill(.75);
  zone('us', 1); zone('uk', 1); zone('fr', 1, { dy: 14 });
  // 英、美两块先各自标名，再合成一块
  text('美租界', 730, 360, 44, { font: 'MaShan', a: 1 - merge }); text('英租界', 560, 560, 52, { font: 'MaShan', a: 1 - merge });
  if (merge > 0) { ctx.save(); ctx.globalAlpha = merge; ctx.strokeStyle = RED; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(520, 270); ctx.lineTo(945, 270); ctx.lineTo(945, YJB - 14); ctx.lineTo(200, YJB - 14); ctx.lineTo(200, SZH + 14); ctx.lineTo(520, SZH + 14); ctx.closePath(); ctx.stroke(); ctx.restore(); text('公共租界', 600, 600, 64, { font: 'MaShan', col: RED, a: merge }); }
  if (card(540, 1495, 820, 140, seg(t, V('5-1') + .2, V('5-1') + .6), { a: 1 - ss(seg(t, V('5-2') - .2, V('5-2') + .3)) })) { text('1863 · 英美租界合并', 0, -4, 50, { font: 'MaShan', col: RED }); text('（1899 年起正式称「公共租界」）', 0, 44, 28, { weight: 600, a: seg(t, V('5-1') + 4.2, V('5-1') + 4.8) }); ctx.restore(); }
  text('法租界', 620, 935, 52, { font: 'MaShan', col: BLUE });
  text('华界 · 县城', CITY[0], CITY[1] + 15, 52, { font: 'MaShan', col: GREEN, a: seg(t, V('5-2'), V('5-2') + .5) });
  // 两个外国衙门并排站着；第三个：道台、县衙门
  plaque('工部局', 330, 700, seg(t, V('5-3'), V('5-3') + .5), { size: 46 });
  plaque('公董局', 820, 1010, seg(t, V('5-4'), V('5-4') + .5), { size: 42, bg: '#1e2c40' });
  plaque('道台 · 县衙门', CITY[0], CITY[1] + 100, seg(t, V('5-4') + 2.6, V('5-4') + 3.1), { size: 36, bg: '#2f3a22' });
  const hl = (key, t0) => { const a = ss(seg(t, t0, t0 + .4)) * (1 - ss(seg(t, t0 + 2.6, t0 + 3))); if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#e8b24a'; ctx.lineWidth = 9; poly(Z[key], true); ctx.stroke(); ctx.restore(); };
  hl('uk', V('5-3')); hl('us', V('5-3')); ctx.save(); ctx.translate(0, 14); hl('fr', V('5-4')); ctx.restore();
  if (t > V('5-2') && t < V('5-3')) text('两个外国衙门，并排站着', 540, 1500, 46, { weight: 600, a: seg(t, V('5-2') + .4, V('5-2') + .9) });
  tagAt(SW - 170, 160, 1);
}

// ================= 镜 6：会审公廨（121–148） =================
function bench(x, y, w, lab, col, a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(x - w / 2, y - 26, w, 52); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x - w / 2, y - 26, w, 52); ctx.restore(); text(lab, x, y + 14, 36, { col: '#f3ead6', weight: 600, a }); }
function shot6(t) {
  ctx.drawImage(paper, 0, 0);
  const u = seg(t, 121, 148);
  photo('mixed_court', 540, 600, 940, 620, { z: lerp(1.02, 1.14, u), x: lerp(-.3, .3, u), y: 0 }, { caption: credit('mixed_court'), filter: 'sepia(.55) contrast(1.05)' });
  if (card(540, 1030, 640, 140, seg(t, V('6-2'), V('6-2') + .4))) { text('1864 · 会审公廨', 0, 22, 62, { font: 'MaShan', col: RED }); ctx.restore(); }
  // 席位示意小图
  const a0 = ss(seg(t, V('6-3'), V('6-3') + .5));
  if (a0 > 0) {
    ctx.save(); ctx.globalAlpha = a0; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2; ctx.strokeRect(140, 1150, 800, 360); ctx.restore();
    tagAt(820, 1160, a0);
    bench(540, 1240, 260, '中国法官', RED, a0);
    bench(800, 1240, 200, '外国陪审', BLUE, ss(seg(t, V('6-4') + 1.8, V('6-4') + 2.3)));
    person(540, 1440, 1.1, { a: a0 }); text('华人案子', 540, 1490, 30, { weight: 600, a: a0 });
    if (t > V('6-4')) { person(360, 1440, 1.1, { a: ss(seg(t, V('6-4'), V('6-4') + .4)), col: BLUE }); text('牵涉外国人', 360, 1490, 30, { weight: 600, a: ss(seg(t, V('6-4'), V('6-4') + .4)), col: BLUE }); }
  }
  if (t > V('6-5')) stampBox('中西合办的衙门', 540, 870, seg(t, V('6-5') + 3.4, V('6-5') + 3.8), { size: 56, rot: -.05 });
}

// ================= 镜 7：越界筑路（148–171，示意地图） =================
const ROADS = [[520, 600], [600, 700], [690, 520], [760, 860]];   // [起点 y, 终点 y]（从公共租界西界 x=200 往西修到界外）
function road(i, p) {
  const [y0, y1] = ROADS[i], x0 = 200, x1 = lerp(200, 70, p) ;
  const P = []; for (let k = 0; k <= 20; k++) { const u = k / 20 * p; P.push([lerp(x0, 70, u) - Math.sin(u * 3) * 40 * 0, lerp(y0, y1, u * u)]); }
  return P;
}
function shot7(t) {
  ctx.drawImage(paper, 0, 0);
  // 地图左移放大一些，给界外留出位置
  ctx.save(); ctx.translate(140, 0);
  mapBase(t, { cn: .22 }); cityFill(.75); zone('us', 1); zone('uk', 1); zone('fr', 1, { dy: 14 });
  text('公共租界', 600, 600, 56, { font: 'MaShan', col: RED, a: .8 });
  ctx.restore();
  // 界外（华界）
  text('界外：华界', 150, 300, 40, { font: 'MaShan', col: GREEN, a: seg(t, V('7-2'), V('7-2') + .5) });
  const L = [[340, 520, 60, 640], [340, 600, 30, 760], [340, 690, 80, 900], [340, 760, 40, 1060]];
  L.forEach(([x0, y0, x1, y1], i) => {
    const p = eo(seg(t, V('7-2') + .3 + i * .9, V('7-2') + 1.3 + i * .9)); if (p <= 0) return;
    const P = []; for (let k = 0; k <= 24; k++) { const u = k / 24 * p; P.push([lerp(x0, x1, u), lerp(y0, y1, u * u * .6 + u * .4)]); }
    inkLine(P, 16, 'rgba(120,110,100,.9)'); inkLine(P, 3, '#f3ead6');
    // 巡捕跟着路走
    if (t > V('7-3')) { const q = P[Math.floor((P.length - 1) * .8)]; person(q[0] + 24, q[1], .8, { col: BLUE, a: ss(seg(t, V('7-3') + i * .3, V('7-3') + .4 + i * .3)) }); }
    // 路两边：地属华界
    if (t > V('7-4') + .8 && i < 3) { const q = P[Math.floor((P.length - 1) * .55)]; text('地属华界', q[0] + (i % 2 ? 110 : -10), q[1] - 30, 28, { col: GREEN, weight: 600, a: ss(seg(t, V('7-4') + .8 + i * .3, V('7-4') + 1.2 + i * .3)) }); }
  });
  if (t > V('7-3')) text('路修到哪里，巡捕管到哪里', 540, 1480, 44, { weight: 600, col: BLUE, a: seg(t, V('7-3'), V('7-3') + .4) * (1 - seg(t, V('7-5') - .3, V('7-5'))) });
  if (card(540, 1470, 640, 170, seg(t, V('7-5'), V('7-5') + .4), { a: 1 - ss(seg(t, V('7-6') - .3, V('7-6'))) })) { text('越界筑路', 0, 4, 76, { font: 'MaShan', col: RED }); text('1860 年代起', 0, 62, 36, { weight: 600, a: seg(t, V('7-5') + .6, V('7-5') + 1.1) }); ctx.restore(); }
  hand('一条马路，两种规矩', 540, 1490, 58, seg(t, V('7-6'), V('7-6') + 1.2), { align: 'center', font: 'MaShan' });
  tagAt(SW - 170, 160, 1);
}

// ================= 镜 8：三界并立 + 今昔对比占位（171–210）+ 片尾卡 =================
function shot8(t) {
  ctx.drawImage(paper, 0, 0);
  const toToday = ss(seg(t, 201, 202));
  if (toToday < 1) {
    ctx.save(); ctx.globalAlpha = 1 - toToday;
    threeZones(t);
    plaque('工部局', 330, 700, 1, { size: 40 }); plaque('公董局', 820, 1010, 1, { size: 38, bg: '#1e2c40' });
    plaque('道台 · 县衙门', CITY[0], CITY[1] + 100, seg(t, V('8-2'), V('8-2') + .5), { size: 36, bg: '#2f3a22' });
    // 一个人出趟门：从县城往北，穿过三个城
    if (t > V('8-3') + 1) {
      const p = seg(t, V('8-3') + 1, V('8-4') + 4.6), y = lerp(CITY[1] + 40, 330, eio(p)), x = 520 + Math.sin(p * 9) * 40;
      person(x, y, 1.1, { col: RED, ph: t * 8 });
      const zoneAt = y > CITY[1] - CITY[2] ? 2 : y > YJB ? 1 : 0;
      const names = ['工部局', '公董局', '道台 · 县衙门'];
      text('现在归：' + names[zoneAt], 540, 1500, 46, { weight: 600, col: [RED, BLUE, GREEN][zoneAt], a: 1 - ss(seg(t, V('8-5') - .4, V('8-5'))) });
    }
    if (t > V('8-5')) { if (card(540, 1495, 720, 140, seg(t, V('8-5'), V('8-5') + .4))) { text('三个衙门并行', 0, -8, 46, { font: 'MaShan' }); text('直到 1943 年租界交还', 0, 40, 30, { weight: 600, col: RED }); ctx.restore(); } }
    if (t > V('8-6')) { if (card(540, 400, 860, 220, seg(t, V('8-6'), V('8-6') + .4))) { text('下一集', 0, -46, 40, { weight: 600, col: RED }); text('马路的老名字', 0, 30, 72, { font: 'MaShan' }); text('威海路，原先叫啥？', 0, 84, 34, { weight: 600, a: seg(t, V('8-7'), V('8-7') + .5) }); ctx.restore(); } }
    ctx.restore();
    tagAt(SW - 170, 160, 1 - toToday);
  }
  if (toToday > 0) {   // 今昔对比占位：今天同一地段（示意）
    ctx.save(); ctx.globalAlpha = toToday; ctx.drawImage(paper, 0, 0); todaySquare(560, 1); text('今天', 90, 520, 44, { align: 'left', weight: 600, col: RED }); ctx.restore();
    tagAt(SW - 170, 160, toToday * (1 - seg(t, 209, 210)));
  }
}
function endCard(t) {
  const a = ss(seg(t, 210, 211)); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.drawImage(paper, 0, 0); ctx.restore();
  hand('《租界百年》', 540, 720, 96, seg(t, 210.4, 211.4), { align: 'center', font: 'MaShan' });
  hand('第四集', 540, 850, 80, seg(t, 211.2, 212), { align: 'center', font: 'MaShan' });
  hand('一城三治', 540, 1000, 120, seg(t, 211.8, 213), { align: 'center', font: 'MaShan' });
  ctx.save(); ctx.globalAlpha = ss(seg(t, 213, 213.6)); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(300, 1060); ctx.lineTo(780, 1064); ctx.stroke(); ctx.restore();
  hand('熊吉大王', 540, 1200, 80, seg(t, 213.6, 214.6), { align: 'center' });
}

// ---------------- 字幕与水印 ----------------
function subtitles(t) {
  const s = SUBS.find(s => t >= s.t0 && t < s.t1); if (!s) return;
  const a = ss(seg(t, s.t0, s.t0 + .15)) * (1 - ss(seg(t, s.t1 - .15, s.t1)));
  const ls = s.text.split('\n'); ls.forEach((l, i) => text(l, SW / 2, (ls.length > 1 ? 1616 : 1650) + i * 66, 52, { col: '#f8f1df', stroke: 'rgba(28,18,8,.88)', sw: 9, weight: 600, a }));
}
function watermark() { text('熊吉大王', SW - 44, SH - 66, 40, { align: 'right', col: '#f3ead6', stroke: 'rgba(30,20,10,.45)', sw: 5, a: .5, font: 'LongCang' }); }

// ---------------- 一帧 ----------------
const SHOTS = [[0, 19.4, shot1], [19, 54.4, shot2], [54, 80.4, shot3], [80, 99.4, shot4], [99, 121.4, shot5], [121, 148.4, shot6], [148, 171.4, shot7], [171, 218, shot8]];
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  const cur = SHOTS.findLast(s => t >= s[0]); cur[2](t);
  const tr = SHOTS.find((s, i) => i > 0 && t >= s[0] && t < s[0] + .4);
  if (tr) { const prev = SHOTS[SHOTS.indexOf(tr) - 1], p = eio(seg(t, tr[0], tr[0] + .4)), x = SW * (1 - p);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, SH); ctx.clip(); prev[2](t); ctx.restore();
    ctx.save(); const g = ctx.createLinearGradient(x, 0, x + 40, 0); g.addColorStop(0, 'rgba(40,25,10,.35)'); g.addColorStop(1, 'rgba(40,25,10,0)'); ctx.fillStyle = g; ctx.fillRect(x, 0, 40, SH); ctx.restore(); }
  endCard(t);
  corner(t);
  grain(t, .06); scratches(t, .18);
  ctx.save(); ctx.fillStyle = `rgba(20,10,0,${.03 * h1(Math.floor(t * 12))})`; ctx.fillRect(0, 0, SW, SH); ctx.restore();
  subtitles(t);
  watermark();
}

// ---------------- 声音事件 ----------------
const EV = [];
for (const [a] of SHOTS.slice(1)) EV.push({ t: a, type: 'page' });
EV.push({ t: 1.6, type: 'wipe' }, { t: 2.6, type: 'stamp' }, { t: V('1-3') + 3, type: 'cannon' }, { t: V('1-3') + 3.5, type: 'cannon' });
for (const id of ['2-1', '2-3', '3-4', '3-5', '4-3', '5-1', '6-2', '7-5', '8-5', '8-6']) EV.push({ t: V(id), type: 'card' });
EV.push({ t: V('2-2') + 1.6, type: 'stamp' }, { t: V('2-4'), type: 'stamp' }, { t: V('2-7') + 1, type: 'stamp' }, { t: V('6-5') + 3.4, type: 'stamp' });
EV.push({ t: V('3-3'), type: 'plaque' }, { t: V('4-1'), type: 'plaque' }, { t: V('4-3') + 1.4, type: 'plaque' }, { t: V('5-3'), type: 'plaque' }, { t: V('5-4'), type: 'plaque' }, { t: V('5-4') + 2.6, type: 'plaque' });
EV.push({ t: V('4-2'), type: 'shake', dur: 3 }, { t: V('5-1') + 2.6, type: 'merge' });
for (let i = 0; i < 4; i++) EV.push({ t: V('7-2') + .3 + i * .9, type: 'road', dur: 1 });
EV.push({ t: V('8-3') + 1, type: 'walk', dur: 9 });
EV.sort((a, b) => a.t - b.t);

window.DUR = DUR; window.EV = EV; window.render = render;
window.TEXTS = t => { const s = SUBS.find(s => t >= s.t0 && t < s.t1); return s ? [{ id: 'sub' + s.t0, text: s.text, x0: 100, y0: 1580, x1: 980, y1: 1700 }] : []; };
window.READY = true;
