// 《租界百年》第 3 集《小刀会与华洋杂居》—— 竖屏 1080×1920，老照片 + 动效
// 画面时间点全部取自 cues.json（旁白时间表）：每块旁白的目标起始秒 = 该镜内容出现后约 0.3 秒
const SW = 1080, SH = 1920, DUR = 220;
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
  ctx.globalAlpha = o.a ?? 1; if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); x = 0; y = 0; }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw ?? 8; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.col ?? INK; ctx.fillText(s, x, y); ctx.restore();
}
// 手写体逐字写出（左到右）
function hand(s, x, y, size, p, o = {}) {
  if (p <= 0) return; ctx.save(); ctx.font = `${size}px ${o.font ?? 'LongCang'}`; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(s).width, x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  if (o.rot) { ctx.translate(x0, y); ctx.rotate(o.rot); ctx.translate(-x0, -y); }
  ctx.beginPath(); ctx.rect(x0 - 10, y - size * 1.3, (w + 20) * clamp(p), size * 1.8); ctx.clip();
  ctx.globalAlpha = o.a ?? 1; ctx.fillStyle = o.col ?? INK; ctx.fillText(s, x0, y); ctx.restore(); return w;
}
// 角标：年份或地名，手写在左上角
const CORNER = [[0.3, 15.6, '今日 · 石库门弄堂'], [16.3, 43.6, '上海县城 · 1845'], [44.3, 61.6, '1853 · 小刀会'], [62.3, 83.6, '县城被围 · 十七个月'], [84.3, 103.6, '租界 · 江边'], [104.3, 137.6, '1854 · 土地章程'], [138.3, 180.6, '里弄 · 石库门'], [181.3, 211.6, '今日 · 弄堂']];
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
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot ?? 0); ctx.scale(o.sx ?? 1, o.sy ?? 1); ctx.globalAlpha = o.a ?? 1;
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
  const im = IMG[key]; ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot ?? 0); ctx.globalAlpha = o.a ?? 1;
  ctx.fillStyle = 'rgba(30,20,10,.3)'; ctx.fillRect(-w / 2 - 14, -h / 2 - 8, w + 40, h + 44);
  ctx.fillStyle = '#f2ead6'; ctx.fillRect(-w / 2 - 24, -h / 2 - 24, w + 48, h + 48 + (o.caption ? 56 : 0));
  ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
  if (im) {
    const s = (o.fit === 'contain' ? Math.min : Math.max)(w / im.width, h / im.height) * kb.z, iw = im.width * s, ih = im.height * s;
    ctx.filter = o.filter ?? 'sepia(.75) contrast(1.08) brightness(.97)';
    ctx.drawImage(im, -iw / 2 + kb.x * (iw - w) / 2, -ih / 2 + kb.y * (ih - h) / 2, iw, ih); ctx.filter = 'none';
  } else { ctx.fillStyle = '#cdbb98'; ctx.fillRect(-w / 2, -h / 2, w, h); }
  const v = ctx.createRadialGradient(0, 0, Math.min(w, h) * .3, 0, 0, Math.max(w, h) * .7); v.addColorStop(0, 'rgba(40,25,10,0)'); v.addColorStop(1, 'rgba(40,25,10,.45)'); ctx.fillStyle = v; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  if (o.caption) text(o.caption, cx, cy + h / 2 + 46, o.capSize ?? 26, { col: '#5a4532', a: o.a ?? 1 });
}
// 照片说明只写地点：照片年代不在锁定史实里，不上屏

// 照片下方只标地点（或实物名），不标拍摄年份
const CAP = { county_map: '上海县城', coin: '小刀会钱币（实物）', customs: '江海关', xingrenli: '兴仁里（宁波路一带）' };
const credit = k => CAP[k] ?? '';
const RED = '#8a2414', STAMP = '#a8231a';
function tagAt(x, y, a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a * .85; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 110, 50); text('示意', x + 55, y + 36, 30, { col: '#7a5a3a', weight: 600 }); ctx.restore(); }
function card(cx, cy, w, h, p, o = {}) {   // 旧纸字卡
  if (p <= 0) return false; const sc = o.pop === false ? 1 : back(p);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot ?? 0); ctx.scale(sc, sc); ctx.globalAlpha = (o.a ?? 1) * clamp(p * 2);
  ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.fillRect(-w / 2 + 10, -h / 2 + 12, w, h);
  ctx.fillStyle = o.bg ?? '#efe2bf'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = o.border ?? RED; ctx.lineWidth = 5; ctx.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20);
  return true;
}
const endCardDone = () => ctx.restore();
function stampBox(s, cx, cy, p, o = {}) { if (p <= 0) return; const sc = lerp(1.6, 1, eo(p)); ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot ?? -.15); ctx.scale(sc, sc); ctx.globalAlpha = clamp(p * 1.5) * .9; ctx.strokeStyle = STAMP; ctx.lineWidth = 7; ctx.font = `${o.size ?? 70}px MaShan`; const w = ctx.measureText(s).width + 50; ctx.strokeRect(-w / 2, -(o.size ?? 70) * .75, w, (o.size ?? 70) * 1.25); text(s, 0, (o.size ?? 70) * .3, o.size ?? 70, { col: STAMP, font: 'MaShan' }); ctx.restore(); }
// 小人：一团身子 + 头；可背包袱
function person(x, y, s, o = {}) { ctx.save(); ctx.globalAlpha = o.a ?? 1; ctx.fillStyle = o.col ?? INK; ctx.beginPath(); ctx.arc(x, y - 52 * s, 9 * s, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 11 * s, y - 40 * s); ctx.lineTo(x + 11 * s, y - 40 * s); ctx.lineTo(x + 14 * s, y - 6 * s); ctx.lineTo(x - 14 * s, y - 6 * s); ctx.closePath(); ctx.fill(); const st = Math.sin(o.ph ?? 0) * 6 * s; ctx.lineWidth = 4 * s; ctx.strokeStyle = o.col ?? INK; ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 8 * s); ctx.lineTo(x - 5 * s + st, y); ctx.moveTo(x + 4 * s, y - 8 * s); ctx.lineTo(x + 5 * s - st, y); ctx.stroke(); if (o.bundle) { ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 42 * s); ctx.lineTo(x + 24 * s, y - 60 * s); ctx.stroke(); ctx.fillStyle = o.bundleCol ?? '#8a6a50'; ctx.beginPath(); ctx.arc(x + 26 * s, y - 56 * s, 9 * s, 0, 6.3); ctx.fill(); } ctx.restore(); }

// ---------------- 石库门单元（立面）：石门框 + 乌漆木门 + 门楣 + 老虎窗 + 晒台 ----------------
function shikumenUnit(x, y, w, h, o = {}) {   // (x, y) = 左下角；彩色程度 col 0..1
  const c = o.col ?? 1, mixc = (a, b) => `rgb(${a.map((v, i) => Math.round(lerp(b[i], v, c))).join(',')})`;
  const brick = mixc([168, 88, 74], [205, 190, 160]), stone = mixc([196, 188, 172], [214, 203, 178]), door = mixc([34, 28, 26], [90, 70, 52]), roof = mixc([88, 84, 90], [150, 135, 110]);
  ctx.save(); ctx.lineJoin = 'round';
  // 墙
  ctx.fillStyle = brick; ctx.fillRect(x, y - h, w, h); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x, y - h, w, h);
  ctx.strokeStyle = 'rgba(40,25,15,.25)'; ctx.lineWidth = 1; for (let yy = y - h + 18; yy < y; yy += 18) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  // 屋顶 + 老虎窗
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - 14, y - h); ctx.lineTo(x + w + 14, y - h); ctx.lineTo(x + w - 30, y - h - 70); ctx.lineTo(x + 30, y - h - 70); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  const dx = x + w * .5 - 40; ctx.fillStyle = mixc([230, 222, 205], [225, 214, 190]); ctx.fillRect(dx, y - h - 112, 80, 62); ctx.strokeRect(dx, y - h - 112, 80, 62); ctx.beginPath(); ctx.moveTo(dx - 12, y - h - 108); ctx.lineTo(dx + 40, y - h - 140); ctx.lineTo(dx + 92, y - h - 108); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeRect(dx + 14, y - h - 100, 52, 40); ctx.beginPath(); ctx.moveTo(dx + 40, y - h - 100); ctx.lineTo(dx + 40, y - h - 60); ctx.stroke();
  // 二楼窗
  ctx.fillStyle = mixc([120, 150, 160], [190, 175, 145]); for (const wx of [x + 28, x + w - 108]) { ctx.fillRect(wx, y - h + 40, 80, 90); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(wx, y - h + 40, 80, 90); ctx.beginPath(); ctx.moveTo(wx + 40, y - h + 40); ctx.lineTo(wx + 40, y - h + 130); ctx.stroke(); }
  // 石门框 + 门楣
  const gw = w * .5, gx = x + (w - gw) / 2, gh = h * .52;
  ctx.fillStyle = stone; ctx.fillRect(gx - 16, y - gh - 16, gw + 32, gh + 16); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(gx - 16, y - gh - 16, gw + 32, gh + 16);
  ctx.beginPath(); ctx.moveTo(gx - 30, y - gh - 16); ctx.quadraticCurveTo(gx + gw / 2, y - gh - 80, gx + gw + 30, y - gh - 16); ctx.closePath(); ctx.fillStyle = stone; ctx.fill(); ctx.stroke();
  ctx.fillStyle = door; ctx.fillRect(gx, y - gh, gw, gh); ctx.strokeStyle = 'rgba(200,190,170,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx + gw / 2, y - gh); ctx.lineTo(gx + gw / 2, y); ctx.stroke();
  ctx.fillStyle = mixc([200, 170, 90], [170, 150, 110]); for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(gx + gw / 2 + k * 14, y - gh * .5, 6, 0, 6.3); ctx.fill(); }
  ctx.restore();
  return { gx, gw, gh, top: y - h, dormer: [x + w * .5, y - h - 90] };
}
// 晒台：屋顶上一个小平台，竹竿上晾着衣服
function shaitai(x, y, w, c = 1, t = 0) { ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x, y - 40, w, 40); for (let k = x + 12; k < x + w; k += 18) { ctx.beginPath(); ctx.moveTo(k, y - 40); ctx.lineTo(k, y); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(x - 10, y - 110); ctx.lineTo(x + w + 10, y - 104); ctx.stroke(); const cols = [[120, 150, 190], [200, 80, 70], [235, 225, 200], [110, 140, 100]]; for (let i = 0; i < 4; i++) { const cx = x + 10 + i * (w / 4), sw = Math.sin(t * 2 + i) * 3, cc = cols[i].map(v => Math.round(lerp(190, v, c))); ctx.fillStyle = `rgb(${cc})`; ctx.fillRect(cx + sw, y - 106 + i * .5, w / 4 - 14, 50 + (i % 2) * 14); ctx.strokeRect(cx + sw, y - 106 + i * .5, w / 4 - 14, 50 + (i % 2) * 14); } ctx.restore(); }
// 1853 年的木板棚屋
function shack(x, y, w, h, s = 1) { ctx.save(); ctx.fillStyle = '#b89a72'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.fillRect(x, y - h, w, h); ctx.strokeRect(x, y - h, w, h); ctx.lineWidth = 1.2; for (let k = x + 14; k < x + w; k += 14) { ctx.beginPath(); ctx.moveTo(k, y - h); ctx.lineTo(k + (h1(k) - .5) * 3, y); ctx.stroke(); } ctx.fillStyle = '#8f7a62'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 12, y - h); ctx.lineTo(x + w / 2, y - h - 44 * s); ctx.lineTo(x + w + 12, y - h); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3a2e24'; ctx.fillRect(x + w * .38, y - h * .6, w * .24, h * .6); ctx.restore(); }

// ================= 镜 1：今天的石库门弄堂 → 退回 1853（0–16） =================
function lane(t, c, yBase = 1000) {   // 三个石库门单元并排（立面示意）
  const W0 = 330, x0 = 540 - W0 * 1.5; let info = [];
  for (let i = 0; i < 3; i++) info.push(shikumenUnit(x0 + i * W0, yBase, W0, 420, { col: c }));
  shaitai(x0 + 2 * W0 + 60, yBase - 420 - 6, 200, c, t);
  return info;
}
function shot1(t) {
  ctx.drawImage(paper, 0, 0);
  const split = eio(seg(t, 1.6, 2.8)), c = 1 - .65 * ss(seg(t, 2.6, 4));
  // 上半：今天的弄堂（示意）
  const info = lane(t, c, 1000 - 60 * split);
  text('今天', 90, 330, 44, { align: 'left', weight: 600, col: RED, a: ss(seg(t, 1.8, 2.4)) });
  // 天井 · 老虎窗 · 晒台：跟着旁白点到
  const ys = 0;
  const lab = (s, x, y, tx, ty, t0) => { const p = seg(t, t0, t0 + .4); if (p <= 0) return; ctx.save(); ctx.globalAlpha = p; ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + ys); ctx.lineTo(tx, ty + ys); ctx.stroke(); ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x, y + ys, 7, 0, 6.3); ctx.fill(); ctx.restore(); hand(s, tx, ty + ys - 8, 52, p * 2, { align: 'center', col: RED, font: 'MaShan' }); };
  const T2 = T('1-2'), k = CUES.find(c => c.id === '1-2').est / 13;
  lab('天井', info[1].gx + info[1].gw / 2, 1000 - 60 * split - 120, info[1].gx + info[1].gw / 2 + 10, 640, T2 - .1);
  lab('老虎窗', info[0].dormer[0], info[0].dormer[1] - 60 * split, 330, 400, T2 + 3 * k);
  lab('晒台', 860, 1000 - 60 * split - 470, 900, 400, T2 + 7 * k);
  // 下半：1853，木板棚屋 + 逃难的人（2.8 秒前划出来，形成对比）
  if (split > 0) {
    const yb = lerp(1920, 1060, split);
    ctx.save(); ctx.beginPath(); ctx.rect(0, yb, SW, SH - yb); ctx.clip();
    ctx.fillStyle = '#ddcfb2'; ctx.fillRect(0, yb, SW, SH); ctx.drawImage(paper, 0, 0);
    ctx.filter = 'sepia(.6)'; for (let i = 0; i < 5; i++) shack(70 + i * 196, yb + 330, 160, 120 + (i % 2) * 20); ctx.filter = 'none';
    const go = seg(t, V('1-4'), V('1-4') + 6);
    for (let i = 0; i < 9; i++) { const x = lerp(-80 - i * 70, 980 - i * 95, go), ph = t * 7 + i; if (go > 0) person(x, yb + 420 + (i % 3) * 18, 1.15, { bundle: i % 2 === 0, ph, a: .9 }); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, yb); ctx.lineTo(SW, yb); ctx.stroke(); ctx.restore();
    stampBox('1853', 860, yb + 90, seg(t, 2.6, 3.0), { size: 64 });
    text('逃难的人', 200, yb + 110, 46, { a: ss(seg(t, V('1-4') + 3.4, V('1-4') + 4)), weight: 600, col: INK });
  }
  tagAt(SW - 170, 160, 1);
}

// ================= 镜 2：分居之城（16–44） =================
function shot2(t) {
  ctx.drawImage(paper, 0, 0);
  const u = seg(t, 16, 44);
  // 租界：画在县城图上方（城北），一条界线示意
  const zj = ss(seg(t, V('2-2'), V('2-2') + .8));
  ctx.save(); ctx.globalAlpha = zj; ctx.fillStyle = 'rgba(205,140,120,.22)'; ctx.fillRect(70, 290, 940, 230); ctx.setLineDash([16, 10]); ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.strokeRect(70, 290, 940, 230); ctx.setLineDash([]); ctx.restore();
  hand('租界（城北）', 100, 350, 50, seg(t, V('2-2'), V('2-2') + .8), { font: 'MaShan', col: RED });
  hand('洋人住这里', 100, 420, 40, seg(t, V('2-2') + .3, V('2-2') + 1.1));
  // 县城图（供图）
  photo('county_map', 540, 900, 920, 712, { z: lerp(1.0, 1.06, u), x: 0, y: 0 }, { fit: 'contain', rot: -.008, caption: credit('county_map') });
  tagAt(890, 455, zj);
  { const p = seg(t, V('2-2') + 1.2, V('2-2') + 2); if (p > 0) { ctx.save(); ctx.globalAlpha = clamp(p * 2); ctx.fillStyle = 'rgba(242,234,214,.92)'; ctx.fillRect(330, 845, 420, 78); ctx.restore(); hand('中国人住县城', 540, 900, 52, p, { align: 'center', col: RED, font: 'MaShan' }); } }
  // 华洋分居：标题章
  stampBox('华洋分居', 300, 640, seg(t, V('2-1') + 3.8, V('2-1') + 4.2), { size: 72, rot: -.1 });
  hand('1845', 760, 640, 76, seg(t, V('2-1'), V('2-1') + .8), { font: 'MaShan', col: RED });
  // 章程字卡
  if (t > V('2-3')) {
    const p = seg(t, V('2-3'), V('2-3') + .5);
    if (card(540, 1150, 900, 300, p, { rot: .01 })) {
      text('《上海土地章程》', 0, -82, 46, { col: RED, weight: 600 });
      text('· 华人之间，不得租让土地', 0, -4, 44, { a: seg(t, V('2-3') + .9, V('2-3') + 1.4) });
      text('· 不得建房租给华人', 0, 68, 44, { a: seg(t, V('2-3') + 2.4, V('2-3') + 2.9) });
      ctx.restore();
    }
  }
  // 约 500 名本地农民 / 买办住在外头
  if (t > V('2-4')) {
    const a = ss(seg(t, V('2-4'), V('2-4') + .5)) * (1 - ss(seg(t, V('2-3') + 99, 999)));
    for (let i = 0; i < 12; i++) person(500 + (i % 6) * 60, 470 + Math.floor(i / 6) * 40, .7, { a: a * clamp((t - V('2-4') - i * .08) * 4), col: '#5a4532' });
    text('约 500 名本地农民', 690, 380, 40, { a, weight: 600, col: INK });
  }
  if (t > V('2-5')) {
    const p = seg(t, V('2-5') + 1.2, V('2-5') + 2.6), x = lerp(500, 1050, eio(p)), a = ss(seg(t, V('2-5'), V('2-5') + .4));
    person(x, 548, 1.1, { a, col: '#2f4a6b' }); text('买办', x, 600, 34, { a: a * (1 - p * .6), col: '#2f4a6b', weight: 600 });
    hand('买办：只能住在租界外头', 120, 590, 38, seg(t, V('2-5') + 2.4, V('2-5') + 3.2), { col: '#2f4a6b' });
  }
}

// ================= 镜 3：小刀会（44–62） =================
function gate(cx, cy, s, t, swap) {   // 城门（示意）
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.fillStyle = '#9a8f86'; ctx.fillRect(-300, -160, 600, 260); ctx.strokeRect(-300, -160, 600, 260);
  for (let x = -300; x < 300; x += 40) { ctx.fillRect(x, -190, 24, 30); ctx.strokeRect(x, -190, 24, 30); }
  ctx.strokeStyle = 'rgba(40,25,15,.3)'; ctx.lineWidth = 1; for (let y = -140; y < 100; y += 22) { ctx.beginPath(); ctx.moveTo(-300, y); ctx.lineTo(300, y); ctx.stroke(); }
  ctx.fillStyle = '#2c2420'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-80, 100); ctx.lineTo(-80, -30); ctx.arc(0, -30, 80, Math.PI, 0); ctx.lineTo(80, 100); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 城楼
  ctx.fillStyle = '#b4674e'; ctx.fillRect(-170, -290, 340, 100); ctx.strokeRect(-170, -290, 340, 100);
  ctx.fillStyle = '#6f6a64'; ctx.beginPath(); ctx.moveTo(-230, -285); ctx.lineTo(-150, -360); ctx.lineTo(150, -360); ctx.lineTo(230, -285); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 旗：旧旗落下、新旗升起
  const pole = -360 - 200; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(200, -360); ctx.lineTo(200, pole); ctx.stroke();
  const wave = k => Math.sin(t * 5 + k) * 8;
  const flag = (y, col, lab, a) => { if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(200, y); for (let k = 0; k <= 8; k++) ctx.lineTo(200 + k * 20, y + wave(k)); for (let k = 8; k >= 0; k--) ctx.lineTo(200 + k * 20, y + 90 + wave(k)); ctx.closePath(); ctx.fill(); ctx.stroke(); text(lab, 280, y + 60, 40, { col: '#f3ead6', font: 'MaShan' }); ctx.restore(); };
  flag(lerp(pole, -460, swap), '#5a6070', '县衙', 1 - swap); flag(lerp(-460, pole, swap), RED, '小刀会', swap);
  ctx.restore();
}
function shot3(t) {
  ctx.drawImage(paper, 0, 0);
  if (card(540, 400, 760, 190, seg(t, V('3-1'), V('3-1') + .4))) { text('1853 年 9 月', 0, 26, 92, { font: 'MaShan', col: RED }); ctx.restore(); }
  photo('coin', 230, 820, 250, 444, { z: 1, x: 0, y: 0 }, { fit: 'contain', filter: 'sepia(.4) contrast(1.05)', caption: credit('coin'), capSize: 24, a: ss(seg(t, 44.3, 45)) });
  const swap = ss(seg(t, V('3-3'), V('3-3') + 1.4)), gs = ss(seg(t, V('3-2'), V('3-2') + .6));
  ctx.save(); ctx.globalAlpha = gs; gate(680, 1050, .66, t, swap); ctx.restore();
  tagAt(870, 560, gs);
  hand('刘丽川', 470, 1180, 60, seg(t, V('3-2') + .2, V('3-2') + .9), { font: 'MaShan', col: RED });
  hand('小刀会占县城', 470, 1260, 46, seg(t, V('3-2') + 1.4, V('3-2') + 2.2));
  if (t > V('3-2') + 5.4) { if (card(540, 1400, 760, 150, seg(t, V('3-2') + 5.4, V('3-2') + 5.8), { rot: -.01 })) { text('总部：豫园 · 点春堂', 0, 18, 56, { font: 'MaShan', col: INK }); ctx.restore(); } }
  hand('县城换了主人', 680, 650, 54, seg(t, V('3-3') + 1, V('3-3') + 1.8), { align: 'center', col: RED, font: 'MaShan' });
}

// ================= 镜 4：围城，人流向北（62–84，示意地图） =================
function shot4(t) {
  ctx.drawImage(paper, 0, 0);
  const CX = 540, CY = 1080, R = 250;
  // 租界（北）+ 黄浦江（东）
  ctx.save(); ctx.fillStyle = 'rgba(205,140,120,.25)'; ctx.fillRect(80, 300, 920, 260); ctx.setLineDash([16, 10]); ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.strokeRect(80, 300, 920, 260); ctx.setLineDash([]); ctx.restore();
  text('租 界', 540, 450, 70, { font: 'MaShan', col: RED });
  ctx.save(); ctx.fillStyle = 'rgba(110,135,138,.45)'; ctx.beginPath(); ctx.moveTo(930, 260); ctx.bezierCurveTo(960, 800, 900, 1200, 960, 1500); ctx.lineTo(1080, 1500); ctx.lineTo(1080, 260); ctx.closePath(); ctx.fill(); ctx.restore();
  text('黄浦江', 1020, 900, 36, { rot: Math.PI / 2, col: INK, font: 'MaShan' });
  // 县城：一圈城墙
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(CX, CY, R, 0, 6.3); ctx.stroke(); ctx.fillStyle = 'rgba(150,140,120,.2)'; ctx.fill(); ctx.restore();
  text('县 城', CX, CY + 20, 60, { font: 'MaShan' });
  // 17 个月
  hand('十七个月', 120, 700, 70, seg(t, V('4-1'), V('4-1') + .8), { font: 'MaShan', col: RED });
  // 城里小刀会、城外清兵（营帐一圈）
  if (t > V('4-2')) { const p = seg(t, V('4-2'), V('4-2') + 1.6); text('城里：小刀会', CX, CY - 80, 40, { col: RED, weight: 600, a: clamp(p * 3) });
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283 + .17; if (i / 18 > p) continue; const x = CX + Math.cos(a) * (R + 70), y = CY + Math.sin(a) * (R + 70); ctx.save(); ctx.fillStyle = '#4b4a6a'; ctx.beginPath(); ctx.moveTo(x - 18, y + 12); ctx.lineTo(x, y - 18); ctx.lineTo(x + 18, y + 12); ctx.closePath(); ctx.fill(); ctx.restore(); }
    text('城外：清兵围城', CX, CY + R + 150, 40, { col: '#4b4a6a', weight: 600, a: seg(t, V('4-2') + 1.6, V('4-2') + 2.2) }); }
  // 房子烧了：城里起火
  if (t > V('4-3')) for (let i = 0; i < 7; i++) { const a = i * 2.1, rr = 60 + (i * 37) % 150, x = CX + Math.cos(a) * rr, y = CY + 70 + Math.sin(a) * rr * .6, f = ss(seg(t, V('4-3') + i * .25, V('4-3') + i * .25 + .4)), fl = Math.sin(t * 12 + i) * 4; ctx.save(); ctx.globalAlpha = f * .85; ctx.fillStyle = '#d06a2a'; ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.quadraticCurveTo(x - 10, y - 30 - fl, x, y - 44 - fl); ctx.quadraticCurveTo(x + 10, y - 30 + fl, x + 14, y); ctx.closePath(); ctx.fill(); ctx.restore(); }
  // 往哪里逃？
  if (t > V('4-4')) text('？', CX + 120, CY - 130, 110, { col: RED, font: 'MaShan', a: ss(seg(t, V('4-4'), V('4-4') + .3)) * (1 - ss(seg(t, V('4-5'), V('4-5') + .4))) });
  // 人流向北涌进租界：箭头 + 小点
  if (t > V('4-5')) {
    const p = seg(t, V('4-5'), V('4-5') + 1.2);
    for (const dx of [-120, 0, 120]) { ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 10; ctx.lineCap = 'round'; const y0 = CY - R + 10, y1 = lerp(y0, 590, eo(p)); ctx.beginPath(); ctx.moveTo(CX + dx, y0); ctx.lineTo(CX + dx * .8, y1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(CX + dx * .8 - 26, y1 + 30); ctx.lineTo(CX + dx * .8, y1); ctx.lineTo(CX + dx * .8 + 26, y1 + 30); ctx.stroke(); ctx.restore(); }
    for (let i = 0; i < 60; i++) { const ph = ((t - V('4-5')) * .45 + i / 60) % 1, x = CX + (h1(i) - .5) * 300, y = lerp(CY - R + 20, 380 + h1(i + 7) * 140, ph); ctx.fillStyle = INK; ctx.globalAlpha = clamp((t - V('4-5')) * 2) * (ph < .9 ? 1 : (1 - ph) * 10); ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
  }
  // 规矩不许住，可炮弹不认规矩
  if (t > V('4-6')) { stampBox('不许住', 820, 380, seg(t, V('4-6'), V('4-6') + .35), { size: 50, rot: .12 }); const p = seg(t, V('4-6') + 1.4, V('4-6') + 2.4); if (p > 0 && p < 1) { const x = lerp(160, 820, p), y = 900 - Math.sin(p * Math.PI) * 380; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.3); ctx.fill(); } if (p >= 1) { ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(730, 330); ctx.lineTo(910, 440); ctx.stroke(); ctx.restore(); } }
  tagAt(SW - 170, 160, 1);
}

// ================= 镜 5：人涌进来（84–104） =================
function shot5(t) {
  ctx.drawImage(paper, 0, 0);
  const u = seg(t, 84, 104);
  photo('customs', 540, 620, 960, 640, { z: lerp(1.05, 1.2, u), x: lerp(-.4, .4, u), y: 0 }, { filter: 'sepia(.7) contrast(1.05)', caption: credit('customs') });
  // 人流：一排小人从右往左（往租界里）走
  const go = seg(t, V('5-1'), V('5-1') + 8);
  for (let i = 0; i < 14; i++) { const x = lerp(1200 + i * 60, 80 + i * 60, eo(clamp(go * 1.4 - i * .04))); person(x, 1060 + (i % 3) * 14, .9, { bundle: i % 2 === 0, ph: t * 7 + i, a: clamp(go * 4) }); }
  // 约 500 → 两万多：不滚动数字（中间数不在锁定史实里），用小点一点点填满
  if (t > V('5-2')) {
    const hideCard = t > V('5-3') - .2 && t < V('5-4') - .2, a0 = seg(t, V('5-2'), V('5-2') + .4) * (hideCard ? 0 : 1);
    const p = seg(t, V('5-2') + 1.6, V('5-2') + 4.2), n = Math.round(lerp(5, 200, eio(p)));
    ctx.save(); ctx.globalAlpha = a0; ctx.fillStyle = INK; for (let i = 0; i < n; i++) { const x = 140 + (i % 25) * 33, y = 1190 + Math.floor(i / 25) * 22; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.3); ctx.fill(); } ctx.restore();
    text('租界里的中国人', 540, 1120, 44, { weight: 600, a: a0 });
    text('约 500', 300, 1430, 64, { font: 'NotoSerif', weight: 700, col: INK, a: a0 });
    text('→', 540, 1425, 64, { a: a0 * seg(t, V('5-2') + 1.6, V('5-2') + 2) });
    text('两万多', 780, 1435, 84, { font: 'MaShan', col: RED, a: a0 * seg(t, V('5-2') + 3.6, V('5-2') + 4.2) });
  }
  // 十七个月后，突围
  if (t > V('5-3')) { const a = 1 - ss(seg(t, V('5-4') - .3, V('5-4'))); if (a > 0 && card(540, 1150, 820, 300, seg(t, V('5-3'), V('5-3') + .4), { a, rot: -.01 })) { text('十七个月后', 0, -60, 52, { font: 'MaShan', col: RED }); text('小刀会突围', 0, 20, 58, { font: 'MaShan' }); text('刘丽川 死在城外', 0, 96, 46, { weight: 600, a: seg(t, V('5-3') + 3.4, V('5-3') + 4) }); ctx.restore(); } }
  if (t > V('5-4')) { hand('逃进租界的人，不走了', 540, 1520, 56, seg(t, V('5-4'), V('5-4') + 1.4), { align: 'center', font: 'MaShan' }); }
}

// ================= 镜 6：章程改了（104–138） =================
function shot6(t) {
  ctx.drawImage(paper, 0, 0);
  const doc = t > V('6-7');
  if (!doc) {
    // 领事 vs 洋行老板
    if (card(290, 640, 440, 520, seg(t, V('6-1'), V('6-1') + .4), { border: '#2f4a6b', rot: -.02 })) { text('领事', 0, -170, 66, { font: 'MaShan', col: '#2f4a6b' }); if (t > V('6-2')) { text('章程写得清清楚楚', 0, -40, 34, { a: seg(t, V('6-2'), V('6-2') + .4), weight: 600 }); text('华人不许住！', 0, 50, 54, { a: seg(t, V('6-2') + 1.6, V('6-2') + 2), font: 'MaShan', col: STAMP }); } ctx.restore(); }
    if (card(790, 640, 440, 520, seg(t, V('6-3'), V('6-3') + .4), { rot: .02 })) { text('洋行老板', 0, -170, 60, { font: 'MaShan', col: RED }); const its = [['有钱的', '带资金', 0], ['没钱的', '出力气', 1.6], ['房子', '租得出价钱', 3.4]]; its.forEach(([a, b, d], i) => { const p = seg(t, V('6-4') + d, V('6-4') + d + .4); text(`${a} → ${b}`, 0, -60 + i * 90, 38, { a: p, weight: 600 }); }); text('欢迎！', 0, 210, 54, { a: seg(t, V('6-5'), V('6-5') + .4), font: 'MaShan', col: RED }); ctx.restore(); }
    // 钱说了算：天平往洋行那边沉
    if (t > V('6-6')) { const tilt = .28 * eio(seg(t, V('6-6') + .4, V('6-6') + 1.6)), a = ss(seg(t, V('6-6'), V('6-6') + .4)); ctx.save(); ctx.globalAlpha = a; ctx.translate(540, 1200); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 220); ctx.moveTo(-90, 220); ctx.lineTo(90, 220); ctx.stroke(); ctx.rotate(tilt); ctx.beginPath(); ctx.moveTo(-300, 0); ctx.lineTo(300, 0); ctx.stroke(); for (const [x, lab, col] of [[-300, '规矩', '#2f4a6b'], [300, '钱', RED]]) { ctx.save(); ctx.translate(x, 0); ctx.rotate(-tilt); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, 90); ctx.moveTo(0, 0); ctx.lineTo(60, 90); ctx.moveTo(-80, 90); ctx.lineTo(80, 90); ctx.stroke(); text(lab, 0, 70, 46, { font: 'MaShan', col }); ctx.restore(); } ctx.restore(); }
  } else {
    // 修订章程：华洋分居划掉 → 华洋杂居
    if (card(540, 860, 900, 860, seg(t, V('6-7'), V('6-7') + .5), { rot: -.008 })) {
      text('《上海土地章程》', 0, -330, 56, { col: RED, weight: 600 }); text('修 订', 0, -255, 44, { weight: 600 });
      text('1854', 0, -150, 90, { font: 'MaShan', col: RED, a: seg(t, V('6-7') + .2, V('6-7') + .8) });
      text('英 · 美 · 法 三国领事', 0, -50, 44, { weight: 600, a: seg(t, V('6-7') + 1.6, V('6-7') + 2.2) });
      text('华洋分居', 0, 90, 84, { font: 'MaShan', a: seg(t, V('6-7') + 3.2, V('6-7') + 3.7) });
      const sp = seg(t, V('6-7') + 5.4, V('6-7') + 6.0); if (sp > 0) { ctx.strokeStyle = STAMP; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-200, 70); ctx.lineTo(-200 + 400 * sp, 64); ctx.stroke(); }
      text('华洋杂居', 0, 250, 92, { font: 'MaShan', col: RED, a: seg(t, V('6-8'), V('6-8') + .5) });
      text('（这次修订没有经过清政府会商同意）', 0, 370, 30, { a: seg(t, V('6-8') + 1.5, V('6-8') + 2.2), col: '#5a4532' });
      ctx.restore();
    }
    stampBox('合法', 830, 1300, seg(t, V('6-8') + 3.0, V('6-8') + 3.3), { size: 70, rot: -.18 });
  }
}

// ================= 镜 7：「里」和石库门（138–181） =================
function shot7(t) {
  ctx.drawImage(paper, 0, 0);
  const phaseA = t < V('7-5') + 1.5;   // 木板排屋
  if (phaseA) {
    const a = 1 - ss(seg(t, V('7-5') + .8, V('7-5') + 1.5));
    ctx.save(); ctx.globalAlpha = a;
    // 人来了：一群人站在空地上
    if (t < V('7-2') + 1) for (let i = 0; i < 10; i++) person(140 + i * 85, 1150 + (i % 2) * 20, 1.1, { bundle: i % 3 === 0, ph: 0, a: seg(t, V('7-1') - .2 + i * .05, V('7-1') + .3 + i * .05) * (1 - seg(t, V('7-2') + .4, V('7-2') + 1)) });
    // 一排连一排的木板排屋
    const rows = 4, per = 5;
    for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) { const k = r * per + i, tt = V('7-2') + .3 + k * .22, p = back(seg(t, tt, tt + .35)); if (p <= 0) continue; const y = 620 + r * 210, x = 90 + i * 186; ctx.save(); ctx.translate(x + 80, y); ctx.scale(1, p); ctx.translate(-x - 80, -y); shack(x, y, 160, 110, .8); ctx.restore(); }
    // 每排一块「×× 里」的牌子（只写一个「里」字，不编名字）
    for (let r = 0; r < rows; r++) { const p = seg(t, V('7-3') + 5.6 + r * .2, V('7-3') + 6 + r * .2); if (p <= 0) continue; ctx.save(); ctx.globalAlpha = a * p; ctx.fillStyle = '#efe2bf'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillRect(30, 520 + r * 210, 56, 80); ctx.strokeRect(30, 520 + r * 210, 56, 80); text('里', 58, 578 + r * 210, 46, { font: 'MaShan', col: RED }); ctx.restore(); }
    if (t > V('7-3') + 2.4) { const p = seg(t, V('7-3') + 2.4, V('7-3') + 2.9); if (card(540, 420, 700, 170, p, { rot: -.01 })) { text('十个月 · 八百多幢', 0, 22, 66, { font: 'MaShan', col: RED }); ctx.restore(); } }
    if (t > V('7-4')) stampBox('上海里弄的开端', 540, 1480, seg(t, V('7-4'), V('7-4') + .35), { size: 58, rot: -.05 });
    // 木板怕火
    if (t > V('7-5')) for (let i = 0; i < 4; i++) { const x = 250 + i * 190, y = 760, fl = Math.sin(t * 12 + i) * 5; ctx.save(); ctx.globalAlpha = ss(seg(t, V('7-5'), V('7-5') + .4)) * .9; ctx.fillStyle = '#d06a2a'; ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.quadraticCurveTo(x - 14, y - 44 - fl, x, y - 64 - fl); ctx.quadraticCurveTo(x + 14, y - 44 + fl, x + 20, y); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.restore(); tagAt(SW - 170, 160, a);
  }
  if (!phaseA || t > V('7-5') + .8) {
    const a = ss(seg(t, V('7-5') + .8, V('7-5') + 1.5));
    const toPhoto = ss(seg(t, V('7-8') - .2, V('7-8') + .6));
    // 石库门门框特写（示意）
    ctx.save(); ctx.globalAlpha = a * (1 - toPhoto * .75);
    const sc = lerp(1.5, 1.2, seg(t, V('7-5') + .8, V('7-8')));
    ctx.translate(540, 1150); ctx.scale(sc, sc); ctx.translate(-540, -1150);
    const u = shikumenUnit(290, 1240, 500, 640, { col: .35 });
    ctx.restore();
    if (toPhoto < 1) {
      ctx.save(); ctx.globalAlpha = a * (1 - toPhoto);
      hand('砖木结构', 540, 1420, 56, seg(t, V('7-5') + 1.5, V('7-5') + 2.3) * (1 - seg(t, V('7-6') - .3, V('7-6'))), { font: 'MaShan', col: RED, align: 'center' });
      if (t > V('7-6')) { hand('石头门框', 90, 1500, 50, seg(t, V('7-6'), V('7-6') + .8), { font: 'MaShan', col: RED }); hand('乌漆木门', 640, 1500, 50, seg(t, V('7-6') + 1.4, V('7-6') + 2.2), { font: 'MaShan', col: RED }); }
      if (t > V('7-7')) { if (card(540, 470, 720, 200, seg(t, V('7-7'), V('7-7') + .4))) { const sw = seg(t, V('7-7') + 3.0, V('7-7') + 3.5); text('石', -150, 34, 96, { font: 'MaShan' }); text('箍', 0, 34, 96, { font: 'MaShan', a: 1 - sw, col: '#5a4532' }); text('库', 0, 34, 96, { font: 'MaShan', a: sw, col: RED }); text('门', 150, 34, 96, { font: 'MaShan' }); ctx.restore(); } }
      ctx.restore(); tagAt(SW - 170, 160, a * (1 - toPhoto));
    }
    // 兴仁里旧照：原图 410×300，只放到 1.3 倍，小幅面
    if (toPhoto > 0) {
      photo('xingrenli', 540, 900, 533, 390, { z: 1, x: 0, y: 0 }, { a: toPhoto, caption: credit('xingrenli'), filter: 'sepia(.5) contrast(1.05)' });
      hand('1872', 540, 520, 96, seg(t, V('7-8') + .3, V('7-8') + 1.1), { align: 'center', font: 'MaShan', col: RED });
      if (t > V('7-9')) { if (card(540, 1300, 820, 170, seg(t, V('7-9'), V('7-9') + .4))) { text('公认最早的石库门里弄', 0, 20, 52, { font: 'MaShan', col: INK }); ctx.restore(); } }
    }
  }
}

// ================= 镜 8：今天的弄堂（今昔对比占位，181–212）+ 片尾卡 =================
function shot8(t) {
  ctx.drawImage(paper, 0, 0);
  const info = lane(t, 1, 1100);
  // 那扇石头门框：亮一圈
  if (t > V('8-4') + 1.4) { const g = info[1], a = ss(seg(t, V('8-4') + 1.4, V('8-4') + 2.2)) * (.7 + .3 * Math.sin(t * 3)); ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#e8b24a'; ctx.lineWidth = 8; ctx.strokeRect(g.gx - 22, 1100 - g.gh - 22, g.gw + 44, g.gh + 22); ctx.restore(); }
  // 门后头：逃进租界的那些人（淡淡的影子）
  if (t > V('8-5')) { const a = ss(seg(t, V('8-5') + .6, V('8-5') + 2.4)) * .55; for (let i = 0; i < 9; i++) person(150 + i * 100, 1290 + (i % 2) * 16, 1.2, { bundle: i % 2 === 0, a, col: '#6a5a48' }); }
  if (t > V('8-3')) { const a = 1 - ss(seg(t, V('8-4'), V('8-4') + .5)); text('约 500 → 两万多', 540, 1380, 60, { font: 'NotoSerif', weight: 700, col: RED, a: a * seg(t, V('8-3'), V('8-3') + .5) }); }
  if (t > V('8-6')) { if (card(540, 420, 860, 240, seg(t, V('8-6'), V('8-6') + .4))) { text('下一集', 0, -50, 40, { weight: 600, col: RED }); text('一城三治', 0, 40, 84, { font: 'MaShan' }); text('一条马路，三个衙门', 0, 100, 34, { a: seg(t, V('8-7'), V('8-7') + .5), weight: 600 }); ctx.restore(); } }
  tagAt(SW - 170, 160, 1 - seg(t, 211, 212));
}
function endCard(t) {
  const a = ss(seg(t, 212, 213)); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.drawImage(paper, 0, 0); ctx.restore();
  hand('《租界百年》', 540, 720, 96, seg(t, 212.4, 213.4), { align: 'center', font: 'MaShan' });
  hand('第三集', 540, 850, 80, seg(t, 213.2, 214), { align: 'center', font: 'MaShan' });
  hand('小刀会与华洋杂居', 540, 980, 96, seg(t, 213.8, 215.2), { align: 'center', font: 'MaShan' });
  ctx.save(); ctx.globalAlpha = ss(seg(t, 215.2, 215.8)); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(240, 1040); ctx.lineTo(840, 1044); ctx.stroke(); ctx.restore();
  hand('熊吉大王', 540, 1180, 80, seg(t, 215.8, 216.8), { align: 'center' });
}

// ---------------- 字幕与水印 ----------------
function subtitles(t) {
  const s = SUBS.find(s => t >= s.t0 && t < s.t1); if (!s) return;
  const a = ss(seg(t, s.t0, s.t0 + .15)) * (1 - ss(seg(t, s.t1 - .15, s.t1)));
  text(s.text, SW / 2, 1620, 54, { col: '#f8f1df', stroke: 'rgba(28,18,8,.88)', sw: 9, weight: 600, a });
}
function watermark() { text('熊吉大王', SW - 44, SH - 66, 40, { align: 'right', col: '#f3ead6', stroke: 'rgba(30,20,10,.45)', sw: 5, a: .5, font: 'LongCang' }); }

// ---------------- 一帧 ----------------
const SHOTS = [[0, 16.4, shot1], [16, 44.4, shot2], [44, 62.4, shot3], [62, 84.4, shot4], [84, 104.4, shot5], [104, 138.4, shot6], [138, 181.4, shot7], [181, 220, shot8]];
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  const cur = SHOTS.findLast(s => t >= s[0]); cur[2](t);
  // 过渡：下一镜从右往左盖过来（0.4 s），边缘一道纸影
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
EV.push({ t: 1.6, type: 'wipe' }, { t: 2.6, type: 'stamp' });
for (const id of ['2-1', '2-3', '3-1', '3-2', '5-3', '6-1', '6-3', '6-7', '7-3', '7-7', '7-9', '8-6']) EV.push({ t: V(id), type: 'card' });
EV.push({ t: V('2-1') + 3.8, type: 'stamp' }, { t: V('4-6'), type: 'stamp' }, { t: V('6-8') + 3.0, type: 'stamp' }, { t: V('7-4'), type: 'stamp' });
EV.push({ t: V('3-3'), type: 'flag', dur: 1.4 }, { t: V('4-3'), type: 'fire', dur: 3 }, { t: V('7-5'), type: 'fire', dur: 2.5 });
EV.push({ t: V('4-6') + 1.4, type: 'cannon' }, { t: V('6-7') + 5.4, type: 'strike' }, { t: V('6-6') + .4, type: 'scale' });
EV.push({ t: V('4-5'), type: 'crowd', dur: 6 }, { t: V('5-1'), type: 'crowd', dur: 8 }, { t: V('1-4'), type: 'crowd', dur: 6 });
for (let k = 0; k < 20; k++) EV.push({ t: V('7-2') + .3 + k * .22, type: 'plank' });
EV.push({ t: V('5-2') + 1.6, type: 'count', dur: 2.6 });
EV.sort((a, b) => a.t - b.t);

window.DUR = DUR; window.EV = EV; window.render = render;
window.TEXTS = t => { const s = SUBS.find(s => t >= s.t0 && t < s.t1); return s ? [{ id: 'sub' + s.t0, text: s.text, x0: 100, y0: 1560, x1: 980, y1: 1640 }] : []; };
window.READY = true;
