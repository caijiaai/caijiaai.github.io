// 《租界百年》第 5 集《马路的老名字》—— 竖屏 1080×1920，老照片 + 动效
// 画面时间点全部取自 cues.json（旁白时间表）：每块旁白的目标起始秒 = 该镜内容出现后约 0.3 秒
const SW = 1080, SH = 1920, DUR = 222;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
await Promise.all(['60px LongCang', '60px MaShan', '600 60px NotoSerif', '400 60px NotoSerif', '700 60px NotoSans'].map(f => document.fonts.load(f)));
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
const INK = '#1f3350', PAPER = '#e9dec6';
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
const CORNER = [[0.3, 26.6, '今日 · 南京西路'], [27.3, 61.1, '静安寺路'], [61.8, 85.6, '霞飞路'], [86.3, 112.6, '路名先改 · 1943 / 1950'], [113.3, 138.1, '威海卫路 · 1901'], [138.8, 163.1, '威海路 · 汽配街'], [163.8, 191.6, '威海路 369 号'], [192.3, 213.6, '三条路']];
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

// 照片下方只标地点 / 对象名称，不标年份
const CAP = { bubbling_well_road: '静安寺路', avenue_joffre: '霞飞路 · 国泰大戏院' };
const credit = k => CAP[k] ?? '';
const NAVY = '#1f3350', SIGN = '#22406b';

// 路牌：深蓝搪瓷牌 + 白字；sy 用来做翻牌
function roadSign(name, cx, cy, o = {}) {
  const z = o.size ?? 84, w = o.w ?? (z * name.length + 110), h = o.h ?? z * 1.75;
  sign(cx, cy, w, h, [[name, z * .36, z, 'NotoSerif']], { bg: o.bg ?? SIGN, sy: o.sy ?? 1, rot: o.rot ?? 0, a: o.a ?? 1, seed: o.seed ?? name.length * 7 + name.charCodeAt(0) % 9 });
}
// 翻牌：t0 起 0.5 秒，旧牌压扁、新牌展开
function flipSign(t, t0, oldN, newN, cx, cy, o = {}) {
  const f = seg(t, t0, t0 + .5);
  if (f <= 0) roadSign(oldN, cx, cy, o);
  else if (f < .5) roadSign(oldN, cx, cy, { ...o, sy: Math.max(.03, 1 - f * 2) });
  else roadSign(newN, cx, cy, { ...o, sy: Math.max(.03, (f - .5) * 2) });
}
// 路面纹理（纸上淡淡的路）
function roadTexture(a = 1) {
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(31,51,80,.07)'; ctx.fillRect(0, 1180, SW, 330);
  ctx.strokeStyle = 'rgba(31,51,80,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 1180); ctx.lineTo(SW, 1180); ctx.moveTo(0, 1510); ctx.lineTo(SW, 1510); ctx.stroke();
  ctx.setLineDash([60, 46]); ctx.strokeStyle = 'rgba(31,51,80,.3)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 1345); ctx.lineTo(SW, 1345); ctx.stroke(); ctx.setLineDash([]);
  const r = rng(77); for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(31,51,80,${.05 + r() * .1})`; ctx.fillRect(r() * SW, 1185 + r() * 320, 2 + r() * 5, 2); }
  ctx.restore();
}
// 路牌杆
function pole(x, y0, y1, a = 1) { ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = NAVY; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); ctx.restore(); }

// ================= 镜 1：钩子（0–27） =================
function shot1(t) {
  ctx.drawImage(paper, 0, 0); roadTexture();
  // 路牌挂在一根横杆上（不用立杆，免得穿过下面的字）
  ctx.save(); ctx.strokeStyle = NAVY; ctx.lineCap = 'round'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(250, 330); ctx.lineTo(830, 330); ctx.stroke(); ctx.lineWidth = 5; for (const x of [400, 680]) { ctx.beginPath(); ctx.moveTo(x, 330); ctx.lineTo(x, 450); ctx.stroke(); } ctx.restore();
  // 0.5 秒内：路牌在画面里；1.2–2.6 秒：「静安寺路」被摘下，换上「南京西路」
  const off = eio(seg(t, 1.2, 2.0)), on = back(seg(t, 2.0, 2.6));
  if (off < 1) roadSign('静安寺路', 540 - off * 620, 520 + off * 160, { rot: -off * .5, a: 1 - off * .3 });
  if (off >= 1 && t < V('1-2')) roadSign('静安寺路', -80, 680, { rot: -.5, a: .7 * (1 - seg(t, 2.6, 3.4)) });
  if (on > 0) { ctx.save(); ctx.translate(540, 520); ctx.scale(1, on); ctx.translate(-540, -520); roadSign('南京西路', 540, 520); ctx.restore(); }
  // 老一辈嘴里：旧牌淡淡地回到旁边
  if (t > V('1-2')) { const a = ss(seg(t, V('1-2') + 1.6, V('1-2') + 2.4)) * (1 - ss(seg(t, V('1-5') - .4, V('1-5')))); roadSign('静安寺路', 540, 760, { size: 62, a: a * .85, bg: '#5a4a3a', rot: -.03 }); hand('老一辈嘴里', 540, 890, 50, seg(t, V('1-2'), V('1-2') + 1) , { align: 'center', a: 1 - ss(seg(t, V('1-5') - .4, V('1-5'))) }); }
  // 标题
  if (t > V('1-3')) { const a = 1 - ss(seg(t, V('1-5') - .4, V('1-5'))); hand('《马路的老名字》', 540, 1050, 104, seg(t, V('1-3'), V('1-3') + 1.6), { align: 'center', font: 'MaShan', a }); stampBox('一个路名，一段历史', 540, 1140, seg(t, V('1-4') + .6, V('1-4') + 1), { size: 46, rot: -.03, a }); }
  // 三条路
  if (t > V('1-5')) {
    const a0 = ss(seg(t, V('1-5'), V('1-5') + .5));
    ctx.save(); ctx.globalAlpha = a0; hand('《马路的老名字》', 540, 800, 84, 1, { align: 'center', font: 'MaShan' }); ctx.restore();
    const d = CUES.find(c => c.id === '1-6').est;
    [['一条大马路', 0], ['一条法国路', d * .28], ['一条我从小走的路', d * .56]].forEach(([s, dt], i) => { const p = back(seg(t, V('1-6') + dt, V('1-6') + dt + .4)); if (p <= 0) return; ctx.save(); ctx.translate(540, 930 + i * 78); ctx.scale(p, p); text(`${i + 1}　${s}`, 0, 0, 48, { weight: 600, col: i === 2 ? RED : INK }); ctx.restore(); });
  }
  tagAt(SW - 170, 160, 1);
}

// ================= 镜 2：静安寺路（27–61.5） =================
function shot2(t) {
  ctx.drawImage(paper, 0, 0);
  const u = seg(t, 27, 61.5);
  photo('bubbling_well_road', 540, 640, 940, 660, { z: lerp(1.02, 1.2, u), x: lerp(.5, -.2, u), y: lerp(-.3, .3, u) }, { filter: 'sepia(.15) contrast(1.03)', caption: credit('bubbling_well_road'), rot: -.006 });
  // 1862 越界筑路 · 涌泉路
  const a1 = 1 - ss(seg(t, V('2-5') - .5, V('2-5')));
  if (a1 > 0) {
    if (card(540, 1170, 860, 150, seg(t, V('2-2'), V('2-2') + .4), { a: a1 })) { text('1862 · 越界筑路', 0, 22, 62, { font: 'MaShan', col: RED }); ctx.restore(); }
    text('跑马场  →  静安寺', 540, 1330, 46, { weight: 600, a: a1 * seg(t, V('2-2') + 3.2, V('2-2') + 3.7) });
    text('英文名：Bubbling Well Road（涌泉路）', 540, 1410, 36, { weight: 600, a: a1 * seg(t, V('2-2') + 6.2, V('2-2') + 6.7) });
    text('大商场 · 电影院', 540, 1500, 44, { font: 'MaShan', a: a1 * seg(t, V('2-4'), V('2-4') + .5) });
  }
  // 1945：路牌替换
  if (t > V('2-5') - .2) {
    const a = ss(seg(t, V('2-5') - .2, V('2-5') + .3));
    ctx.save(); ctx.globalAlpha = a;
    flipSign(t, V('2-5') + 2.6, '静安寺路', '南京西路', 290, 1200, { size: 66 });
    flipSign(t, V('2-6') + 1.6, '大马路', '南京东路', 790, 1200, { size: 66, w: 374 });
    text('西', 290, 1330, 40, { weight: 600, a: seg(t, V('2-7'), V('2-7') + .4) }); text('东', 790, 1330, 40, { weight: 600, a: seg(t, V('2-7'), V('2-7') + .4) });
    ctx.restore();
    stampBox('1945', 540, 1420, seg(t, V('2-5'), V('2-5') + .35), { size: 84, rot: -.08 });
    if (t > V('2-7')) { const p = seg(t, V('2-7'), V('2-7') + .8); ctx.save(); ctx.strokeStyle = NAVY; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(540 - 430 * p, 1270); ctx.lineTo(540 + 430 * p, 1270); ctx.stroke(); ctx.restore(); text('一条南京路，分了东西', 540, 1530, 46, { font: 'MaShan', a: seg(t, V('2-7') + .8, V('2-7') + 1.3) }); }
  }
}

// ================= 镜 3：霞飞路（61.5–86） =================
function leafShadows(t, x0, y0, w, h, a) {   // 梧桐树影：几片慢慢晃的影子（代码叠化）
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(20,30,20,.09)';
  const r = rng(41); for (let i = 0; i < 26; i++) { const bx = x0 + r() * w, by = y0 + r() * h * .7, s = 40 + r() * 70, ph = r() * 6; const x = bx + Math.sin(t * .5 + ph) * 22, y = by + Math.cos(t * .4 + ph) * 12; ctx.beginPath(); ctx.ellipse(x, y, s, s * .62, ph, 0, 6.3); ctx.fill(); }
  ctx.restore();
}
function shot3(t) {
  ctx.drawImage(paper, 0, 0);
  const u = seg(t, 61.5, 86);
  photo('avenue_joffre', 540, 640, 940, 700, { z: lerp(1.12, 1.3, u), x: lerp(-.1, .25, u), y: lerp(.1, -.1, u) }, { filter: 'sepia(.45) contrast(1.05)', caption: credit('avenue_joffre'), rot: .006 });
  leafShadows(t, 70, 290, 940, 700, .9);
  // 路名沿革：西江路 → 宝昌路 → 霞飞路（不写改名年份）
  const d = CUES.find(c => c.id === '3-2').est, T0 = V('3-2');
  const names = [['西江路', T0 + d * .14, '#5a4a3a'], ['宝昌路', T0 + d * .36, '#5a4a3a'], ['霞飞路', T0 + d * .8, SIGN]];
  names.forEach(([n, tt, bg], i) => { const p = back(seg(t, tt, tt + .4)); if (p <= 0) return; ctx.save(); ctx.translate(210 + i * 330, 1200); ctx.scale(p, p); roadSign(n, 0, 0, { size: i === 2 ? 66 : 56, bg }); ctx.restore(); if (i < 2) text('→', 375 + i * 330, 1218, 56, { a: seg(t, names[i + 1][1] - .3, names[i + 1][1]) }); });
  text('以法国将军霞飞命名', 540, 1340, 40, { weight: 600, a: seg(t, T0 + d * .55, T0 + d * .55 + .5) });
  const d4 = CUES.find(c => c.id === '3-4').est;
  [['国泰大戏院', 0], ['咖啡馆', d4 * .22], ['绸缎庄', d4 * .38]].forEach(([s, dt], i) => hand(s, [250, 560, 830][i], 1460, 50, seg(t, V('3-4') + dt, V('3-4') + dt + .7), { align: 'center', font: 'MaShan', col: RED }));
}

// ================= 镜 4：改名两波（86–113，路牌翻牌，示意） =================
function shot4(t) {
  ctx.drawImage(paper, 0, 0);
  const d2 = CUES.find(c => c.id === '4-2').est;
  hand('租界一收回，路名先改', 540, 400, 60, seg(t, V('4-1'), V('4-1') + 1.4), { align: 'center', font: 'MaShan' });
  // 上：爱多亚路 →（1943）大上海路
  pole(540, 560, 760); const tA = V('4-2') + d2 * .22;
  flipSign(t, tA, '爱多亚路', '大上海路', 540, 620, { size: 72 });
  stampBox('1943', 880, 560, seg(t, tA + .3, tA + .65), { size: 56, rot: .1 });
  // 下：霞飞路 →（1943）泰山路 →（1950）淮海中路
  pole(540, 960, 1160); const tB = V('4-2') + d2 * .68, tC = V('4-5');
  if (t < tC) flipSign(t, tB, '霞飞路', '泰山路', 540, 1020, { size: 72, w: 400 });
  else flipSign(t, tC, '泰山路', '淮海中路', 540, 1020, { size: 72, w: 400 });
  stampBox('1943', 880, 960, seg(t, tB + .3, tB + .65), { size: 56, rot: .1, a: 1 - ss(seg(t, tC - .2, tC + .2)) });
  stampBox('1950', 880, 960, seg(t, tC + .3, tC + .65), { size: 56, rot: -.08 });
  // 1945 又改了一轮：不写改成什么（不在锁定史实里），两块牌子晃一晃
  if (t > V('4-3')) { const a = ss(seg(t, V('4-3'), V('4-3') + .3)) * (1 - ss(seg(t, V('4-4') - .3, V('4-4') + .2))); text('1945 · 又改了一轮', 540, 1300, 54, { font: 'MaShan', col: RED, a }); }
  if (t > V('4-5')) text('纪念淮海战役', 540, 1250, 48, { font: 'MaShan', col: RED, a: seg(t, V('4-5') + 2.2, V('4-5') + 2.7) });
  if (t > V('4-6')) hand('路还是那条路，牌子换了主人', 540, 1420, 56, seg(t, V('4-6'), V('4-6') + 2), { align: 'center', font: 'MaShan' });
  tagAt(SW - 170, 160, 1);
}

// ================= 镜 5：威海卫路（113–138.5，顶视示意图） =================
function topRoad(t, o = {}) {
  const y = o.y ?? 860, h = 120;
  ctx.save();
  // 两侧街坊（手绘小块）
  const r = rng(o.seed ?? 9); ctx.strokeStyle = 'rgba(31,51,80,.55)'; ctx.lineWidth = 2;
  for (const side of [-1, 1]) for (let x = 60; x < 1010; x += 104) for (let k = 0; k < 2; k++) { const w = 78 + r() * 18, hh = 62 + r() * 26, yy = side < 0 ? y - h / 2 - 22 - k * 100 - hh : y + h / 2 + 22 + k * 100; if (r() < .12) continue; ctx.fillStyle = `rgba(${o.warm ? '200,150,100' : '31,51,80'},${.08 + r() * .08})`; ctx.fillRect(x, yy, w, hh); ctx.strokeRect(x, yy, w, hh); for (let j = 10; j < w + hh; j += 12) { ctx.beginPath(); ctx.moveTo(x + Math.min(j, w), yy + Math.max(0, j - w)); ctx.lineTo(x + Math.max(0, j - hh), yy + Math.min(j, hh)); ctx.globalAlpha = .35; ctx.stroke(); ctx.globalAlpha = 1; } }
  // 马路
  ctx.fillStyle = 'rgba(31,51,80,.16)'; ctx.fillRect(0, y - h / 2, SW, h); ctx.strokeStyle = NAVY; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, y - h / 2); ctx.lineTo(SW, y - h / 2); ctx.moveTo(0, y + h / 2); ctx.lineTo(SW, y + h / 2); ctx.stroke();
  ctx.setLineDash([44, 34]); ctx.strokeStyle = 'rgba(245,238,222,.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SW, y); ctx.stroke(); ctx.setLineDash([]);
  text('西', 40, y + 14, 34, { weight: 600 }); text('东', 1040, y + 14, 34, { weight: 600 });
  ctx.restore();
}
function shot5(t) {
  ctx.drawImage(paper, 0, 0);
  topRoad(t);
  if (card(540, 400, 800, 150, seg(t, V('5-2'), V('5-2') + .4))) { text('威海卫路 · 1901 年筑路', 0, 22, 60, { font: 'MaShan', col: RED }); ctx.restore(); }
  text('名字来自：山东 · 威海卫', 540, 540, 42, { weight: 600, a: seg(t, V('5-2') + 3.6, V('5-2') + 4.1) });
  // 大字路名：「卫」字淡出，剩下三个字靠拢
  const d3 = CUES.find(c => c.id === '5-3').est, tw = V('5-3') + d3 * .55, fade = ss(seg(t, tw, tw + 1.2)), close = eio(seg(t, tw + 1, tw + 2));
  const a0 = ss(seg(t, V('5-1'), V('5-1') + .6)), Z = 150, X = [-225, -75, 75, 225], X2 = [-150, 0, 0, 150];
  ['威', '海', '卫', '路'].forEach((ch, i) => { const x = 540 + lerp(X[i], X2[i], close), a = i === 2 ? 1 - fade : 1; text(ch, x, 1330, Z, { font: 'MaShan', col: i === 2 ? RED : INK, a: a0 * a }); });
  if (fade > 0 && fade < 1) { ctx.save(); ctx.globalAlpha = .8 * (1 - fade); ctx.strokeStyle = STAMP; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(540 + 75, 1280, 96, 0, 6.3); ctx.stroke(); ctx.restore(); }
  if (t > V('5-4')) { const p = seg(t, V('5-4') + 1.6, V('5-4') + 2.6); ctx.save(); ctx.strokeStyle = STAMP; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(60, 1000); ctx.lineTo(60 + 960 * p, 1000); ctx.stroke(); if (p > 0) { ctx.beginPath(); ctx.moveTo(60, 980); ctx.lineTo(60, 1020); ctx.stroke(); } if (p >= 1) { ctx.beginPath(); ctx.moveTo(1020, 980); ctx.lineTo(1020, 1020); ctx.stroke(); } ctx.restore(); text('路还是那么长', 540, 1070, 42, { weight: 600, col: STAMP, a: seg(t, V('5-4') + 2.4, V('5-4') + 2.9) }); }
  tagAt(SW - 170, 160, 1);
}

// ================= 镜 6：汽配街（138.5–163.5，示意街景） =================
const WORDS = ['汽配', '修配', '五金'];
function shopRow(t, y, n, x0, wAll, litAt, seed) {
  const r = rng(seed), w = wAll / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * w, hh = 150 + r() * 40, lit = ss(seg(t, litAt(i), litAt(i) + .35));
    ctx.save(); ctx.strokeStyle = NAVY; ctx.lineWidth = 2.5;
    ctx.fillStyle = `rgba(31,51,80,${.06 + r() * .06})`; ctx.fillRect(x + 4, y - hh, w - 8, hh); ctx.strokeRect(x + 4, y - hh, w - 8, hh);
    ctx.fillStyle = 'rgba(31,51,80,.5)'; ctx.fillRect(x + w * .3, y - 64, w * .4, 64);                       // 门
    // 招牌：亮起来是暖黄底
    const sw = w - 22, sh = 46, sx = x + 11, sy = y - hh + 12;
    ctx.fillStyle = `rgb(${Math.round(lerp(205, 236, lit))},${Math.round(lerp(196, 190, lit))},${Math.round(lerp(176, 96, lit))})`; ctx.fillRect(sx, sy, sw, sh); ctx.strokeRect(sx, sy, sw, sh);
    ctx.restore();
    text(WORDS[(i + seed) % 3], x + w / 2, y - hh + 47, 32, { weight: 700, font: 'NotoSans', col: NAVY, a: .35 + .65 * lit });
  }
}
function shot6(t) {
  ctx.drawImage(paper, 0, 0);
  const first = V('6-2') + 1.2, all = V('6-3') + .8;
  // 三排店铺：第一家先亮，再一家家亮满
  const order = (row, i) => (row === 1 && i === 2) ? first : all + ((row * 5 + i * 3) % 17) * .19;
  [[720, 6, 11], [980, 6, 12], [1240, 6, 13]].forEach(([y, n, sd], row) => { shopRow(t, y, n, 40, 1000, i => order(row, i), sd); ctx.save(); ctx.strokeStyle = NAVY; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(1060, y); ctx.stroke(); ctx.restore(); });
  hand('不靠名字，靠行当', 540, 440, 64, seg(t, V('6-1') + 1.2, V('6-1') + 2.4), { align: 'center', font: 'MaShan', a: 1 - ss(seg(t, V('6-2') - .3, V('6-2'))) });
  if (t > V('6-2') && t < V('6-3') + .3) { const a = 1 - ss(seg(t, V('6-3') - .2, V('6-3') + .3)); if (card(540, 420, 860, 150, seg(t, V('6-2'), V('6-2') + .4), { a })) { text('1923 · 头一家中国人的汽配店', 0, 20, 50, { font: 'MaShan', col: RED }); ctx.restore(); } }
  if (t > V('6-3')) { if (card(540, 420, 900, 190, seg(t, V('6-3') + .2, V('6-3') + .6))) { text('1949 年 · 230 家汽修汽配店', 0, -6, 56, { font: 'MaShan', col: RED }); text('占全上海的一半', 0, 58, 38, { weight: 600, a: seg(t, V('6-3') + 5, V('6-3') + 5.5) }); ctx.restore(); } }
  // 半个上海的汽车都在这条路上修：小汽车沿街开过
  if (t > V('6-4')) for (let i = 0; i < 5; i++) { const x = ((t - V('6-4')) * 190 + i * 260) % 1400 - 160, y = 1400; ctx.save(); ctx.globalAlpha = ss(seg(t, V('6-4'), V('6-4') + .5)); ctx.fillStyle = NAVY; ctx.beginPath(); ctx.roundRect(x, y - 44, 120, 34, 8); ctx.fill(); ctx.beginPath(); ctx.roundRect(x + 24, y - 70, 66, 30, 8); ctx.fill(); ctx.fillStyle = PAPER; ctx.fillRect(x + 32, y - 64, 22, 18); ctx.fillRect(x + 60, y - 64, 22, 18); ctx.fillStyle = NAVY; for (const wx of [x + 26, x + 94]) { ctx.beginPath(); ctx.arc(wx, y - 8, 13, 0, 6.3); ctx.fill(); } ctx.restore(); }
  ctx.save(); ctx.strokeStyle = NAVY; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(20, 1408); ctx.lineTo(1060, 1408); ctx.stroke(); ctx.restore();
  tagAt(SW - 170, 160, 1);
}

// ================= 镜 7：个人记忆段（163.5–192，暖调） =================
// 柔焦街景：给「威海路现状」留的空位，用模糊的暖色街景示意承托
const softStreet = (() => {
  const c = new OffscreenCanvas(940, 760), g = c.getContext('2d'), r = rng(23);
  const sky = g.createLinearGradient(0, 0, 0, 760); sky.addColorStop(0, '#f1d9a8'); sky.addColorStop(.55, '#e9b77a'); sky.addColorStop(1, '#b98a62'); g.fillStyle = sky; g.fillRect(0, 0, 940, 760);
  // 两侧房子向远处收拢
  for (const side of [0, 1]) for (let i = 0; i < 7; i++) { const k = i / 7, x0 = side ? 940 - k * 330 : k * 330, w = 150 * (1 - k * .6), top = 180 + k * 190 + r() * 30, bot = 760 - k * 170; g.fillStyle = `rgb(${150 + r() * 40 + k * 30},${105 + r() * 30 + k * 30},${80 + r() * 20 + k * 30})`; g.fillRect(side ? x0 - w : x0, top, w, bot - top); g.fillStyle = 'rgba(250,225,160,.8)'; for (let j = 0; j < 4; j++) g.fillRect((side ? x0 - w : x0) + 14 + (j % 2) * w * .45, top + 30 + Math.floor(j / 2) * 70, w * .28, 34); }
  g.fillStyle = '#8f7566'; g.beginPath(); g.moveTo(330, 760); g.lineTo(440, 400); g.lineTo(500, 400); g.lineTo(610, 760); g.closePath(); g.fill();
  for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(60,45,40,.8)'; const k = i / 5; g.beginPath(); g.ellipse(470 + (i % 2 ? 1 : -1) * (30 + k * 90), 470 + k * 240, 12 + k * 22, 8 + k * 12, 0, 0, 6.3); g.fill(); }
  const out = new OffscreenCanvas(940, 760), og = out.getContext('2d'); og.filter = 'blur(9px)'; og.drawImage(c, -10, -10, 960, 780); return out;
})();
function memoCard(s, cx, cy, p, o = {}) { if (p <= 0) return; const z = o.size ?? 50; ctx.save(); ctx.font = `${z}px MaShan`; const w = ctx.measureText(s).width + 90; ctx.restore(); if (card(cx, cy, w, z * 2.3, p, { rot: o.rot ?? 0, bg: '#f4e6c4', border: o.border ?? RED })) { text(s, 0, z * .36, z, { font: 'MaShan', col: o.col ?? INK }); ctx.restore(); } }
function shot7(t) {
  ctx.drawImage(paper, 0, 0);
  ctx.save(); ctx.fillStyle = 'rgba(235,170,90,.16)'; ctx.fillRect(0, 0, SW, SH); ctx.restore();   // 基调转暖
  const u = seg(t, 163.5, 192), z = lerp(1.0, 1.06, u);
  ctx.save(); ctx.translate(540, 660); ctx.rotate(-.006); ctx.fillStyle = 'rgba(30,20,10,.3)'; ctx.fillRect(-470 - 14, -380 - 8, 940 + 40, 760 + 44); ctx.fillStyle = '#f2ead6'; ctx.fillRect(-494, -404, 988, 808); ctx.beginPath(); ctx.rect(-470, -380, 940, 760); ctx.clip(); ctx.drawImage(softStreet, -470 * z, -380 * z, 940 * z, 760 * z); ctx.restore();
  tagAt(SW - 170, 160, 1);
  // 三张字卡：文字全部来自第 7 段锁定稿
  memoCard('民立中学对面 · 姆妈的化工贸汽配店', 540, 1160, seg(t, V('7-2'), V('7-2') + .45), { size: 50, rot: -.01 });
  memoCard('威海路 369 号', 540, 1300, seg(t, V('7-3'), V('7-3') + .45), { size: 62, rot: .012, col: RED });
  const p4 = seg(t, V('7-4') + 2.2, V('7-4') + 2.65);
  if (p4 > 0) { ctx.save(); ctx.font = '84px MaShan'; ctx.restore(); if (card(540, 1470, 820, 170, p4, { bg: '#f4e6c4', border: STAMP })) { text('「三六九，抓现钞」', 0, 30, 84, { font: 'MaShan', col: STAMP }); ctx.restore(); } }
  // 我家的门牌，正好是这三个数：369 号字卡亮一圈
  if (t > V('7-5')) { const a = ss(seg(t, V('7-5') + .8, V('7-5') + 1.3)) * (.7 + .3 * Math.sin(t * 3.2)); ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#e09a3a'; ctx.lineWidth = 8; ctx.strokeRect(540 - 225, 1300 - 82, 450, 164); ctx.restore(); }
}

// ================= 镜 8：收尾（192–214）+ 片尾卡（214–222） =================
function shot8(t) {
  ctx.drawImage(paper, 0, 0);
  const rows = [['静安寺路', '南京西路'], ['霞飞路', '淮海中路'], ['威海卫路', '威海路']];
  const d1 = CUES.find(c => c.id === '8-1').est;
  rows.forEach(([a, b], i) => {
    const y = 520 + i * 300, t0 = V('8-1') + i * d1 * .26, p = back(seg(t, t0, t0 + .4)); if (p <= 0) return;
    ctx.save(); ctx.translate(0, y); ctx.scale(1, p); ctx.translate(0, -y);
    roadSign(a, 280, y, { size: 58, bg: '#5a4a3a', w: 380 }); roadSign(b, 800, y, { size: 58, w: 380 });
    ctx.restore(); text('→', 540, y + 20, 64, { a: clamp(p) });
  });
  hand('路两边的日子，一直往下过', 540, 1400, 58, seg(t, V('8-1') + d1 * .55, V('8-1') + d1 * .55 + 1.6), { align: 'center', font: 'MaShan' });
  tagAt(SW - 170, 160, 1 - seg(t, 213, 214));
  // 渐暗
  ctx.save(); ctx.fillStyle = `rgba(31,40,60,${.42 * ss(seg(t, V('8-2'), 213.5))})`; ctx.fillRect(0, 0, SW, SH); ctx.restore();
}
function endCard(t) {
  const a = ss(seg(t, 214, 215)); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.drawImage(paper, 0, 0); ctx.restore();
  hand('下一集', 540, 720, 72, seg(t, 214.4, 215.2), { align: 'center', font: 'MaShan', col: RED });
  hand('公园门口的牌子', 540, 890, 120, seg(t, 215, 216.6), { align: 'center', font: 'MaShan' });
  ctx.save(); ctx.globalAlpha = ss(seg(t, 216.6, 217.2)); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(260, 960); ctx.lineTo(820, 964); ctx.stroke(); ctx.restore();
  stampBox('租界百年', 540, 1130, seg(t, 217.2, 217.6), { size: 96, rot: -.04 });
}

// ---------------- 字幕（黑体白字描边）与水印 ----------------
function subtitles(t) {
  const s = SUBS.find(s => t >= s.t0 && t < s.t1); if (!s) return;
  const a = ss(seg(t, s.t0, s.t0 + .15)) * (1 - ss(seg(t, s.t1 - .15, s.t1)));
  const ls = s.text.split('\n'); ls.forEach((l, i) => text(l, SW / 2, (ls.length > 1 ? 1650 : 1684) + i * 66, 50, { font: 'NotoSans', col: '#ffffff', stroke: 'rgba(12,16,26,.92)', sw: 9, weight: 700, a }));
}
function watermark() { text('熊吉大王', SW - 44, SH - 66, 40, { align: 'right', col: '#f3ead6', stroke: 'rgba(30,20,10,.45)', sw: 5, a: .5, font: 'LongCang' }); }

// ---------------- 一帧 ----------------
const SHOTS = [[0, 27.4, shot1], [27, 61.9, shot2], [61.5, 86.4, shot3], [86, 113.4, shot4], [113, 138.9, shot5], [138.5, 163.9, shot6], [163.5, 192.4, shot7], [192, 222, shot8]];
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  const cur = SHOTS.findLast(s => t >= s[0]); cur[2](t);
  const tr = SHOTS.find((s, i) => i > 0 && t >= s[0] && t < s[0] + .4);
  if (tr) { const prev = SHOTS[SHOTS.indexOf(tr) - 1], p = eio(seg(t, tr[0], tr[0] + .4)), x = SW * (1 - p);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, SH); ctx.clip(); prev[2](t); ctx.restore();
    ctx.save(); const g = ctx.createLinearGradient(x, 0, x + 40, 0); g.addColorStop(0, 'rgba(40,25,10,.35)'); g.addColorStop(1, 'rgba(40,25,10,0)'); ctx.fillStyle = g; ctx.fillRect(x, 0, 40, SH); ctx.restore(); }
  endCard(t);
  corner(t);
  grain(t, .06); scratches(t, .16);
  ctx.save(); ctx.fillStyle = `rgba(20,10,0,${.03 * h1(Math.floor(t * 12))})`; ctx.fillRect(0, 0, SW, SH); ctx.restore();
  subtitles(t);
  watermark();
}

// ---------------- 声音事件 ----------------
const EV = [];
for (const [a] of SHOTS.slice(1)) EV.push({ t: a, type: 'page' });
EV.push({ t: 1.2, type: 'unhook' }, { t: 2.0, type: 'hang' });
{ const d2 = CUES.find(c => c.id === '4-2').est, d32 = CUES.find(c => c.id === '3-2').est;
  for (const tt of [V('2-5') + 2.6, V('2-6') + 1.6, V('4-2') + d2 * .22, V('4-2') + d2 * .68, V('4-5')]) EV.push({ t: tt, type: 'flip' });
  for (const k of [.14, .36, .8]) EV.push({ t: V('3-2') + d32 * k, type: 'hang' }); }
for (const id of ['2-2', '5-2', '6-2', '6-3', '7-2', '7-3']) EV.push({ t: V(id), type: 'card' });
EV.push({ t: V('7-4') + 2.2, type: 'card' });
EV.push({ t: V('1-4') + .6, type: 'stamp' }, { t: V('2-5'), type: 'stamp' }, { t: 217.2, type: 'stamp' });
for (let k = 0; k < 17; k++) EV.push({ t: V('6-3') + .8 + k * .19, type: 'light' }); EV.push({ t: V('6-2') + 1.2, type: 'light' });
EV.push({ t: V('6-4'), type: 'cars', dur: 6 });
for (const dt of [1.0, 4.6, 9.4, 15.2, 21.0]) EV.push({ t: 163.5 + dt, type: 'wrench' });
for (let i = 0; i < 3; i++) EV.push({ t: V('8-1') + i * CUES.find(c => c.id === '8-1').est * .26, type: 'hang' });
EV.sort((a, b) => a.t - b.t);

window.DUR = DUR; window.EV = EV; window.render = render;
window.TEXTS = t => { const s = SUBS.find(s => t >= s.t0 && t < s.t1); return s ? [{ id: 'sub' + s.t0, text: s.text, x0: 80, y0: 1600, x1: 1000, y1: 1760 }] : []; };
window.READY = true;
