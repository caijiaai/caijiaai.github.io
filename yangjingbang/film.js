// 《租界百年》第 2 集《洋泾浜》—— 竖屏 1080×1920，老照片 + 动效
// 画面时间点全部取自 cues.json（旁白时间表）：每块旁白的目标起始秒 = 该镜内容出现后约 0.3 秒
const SW = 1080, SH = 1920, DUR = 222;
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
const CORNER = [[0.3, 7.6, '今日 · 延安东路'], [8.3, 44.6, '洋泾浜 · 一八四五 / 一八四九'], [45.2, 64.6, '东新桥 · 八仙桥'], [65.3, 104.6, '洋泾浜两岸 · 码头洋行'], [105.3, 134.6, '1914'], [135.3, 164.6, '爱多亚路 · 1916'], [165.3, 189.6, '1943 · 1945 · 1950'], [190.3, 216, '延安东路 · 今日']];
function corner(t) {
  for (const [a, b, s] of CORNER) if (t > a && t < b) {
    const p = seg(t, a, a + .8), q = 1 - seg(t, b - .4, b);
    hand(s, 64, 200, 58, p, { a: q, col: t < 8 ? '#f3ead6' : INK });
    ctx.save(); ctx.globalAlpha = q * p; ctx.strokeStyle = t < 8 ? '#f3ead6' : INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(64, 220); ctx.lineTo(64 + 300 * p, 224); ctx.stroke(); ctx.restore();
  }
}
// 示意标记：动画镜头右上角标“示意”，与老照片区分
function schematicTag(a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a * .85; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2; ctx.strokeRect(SW - 170, 160, 110, 50); text('示意', SW - 115, 196, 30, { col: '#7a5a3a', weight: 600 }); ctx.restore(); }

// ---------------- 地图几何：洋泾浜由东（黄浦江）向西 ----------------
const MAPX0 = 60, MAPX1 = 950;   // 西端 ~ 东端（河口接黄浦江）
const creekY = x => 980 + 28 * Math.sin((x - 80) / 260) - 70 * ss((340 - x) / 260);   // 西段微微一拐
const creekW = 34;
const bridgesX = [905, 815, 725, 640, 548, 455, 365, 270, 175];
function creekPath(off, x0 = MAPX0, x1 = MAPX1, step = 6) { const P = []; for (let x = x0; x <= x1; x += step) P.push([x, creekY(x) + off]); return P; }
function poly(P, close) { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (const p of P) ctx.lineTo(p[0], p[1]); if (close) ctx.closePath(); }
function inkLine(P, w = 2.4, col = INK, p = 1) { if (p <= 0 || P.length < 2) return; const n = Math.max(2, Math.floor(P.length * clamp(p))); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; poly(P.slice(0, n)); ctx.stroke(); ctx.restore(); }
// 老地图底：街区排线、黄浦江、河
function mapBase(t, o = {}) {
  const a = o.a ?? 1; ctx.save(); ctx.globalAlpha = a;
  // 黄浦江（右侧，竖向）
  ctx.fillStyle = 'rgba(120,140,140,.32)'; ctx.beginPath(); ctx.moveTo(960, -200); ctx.bezierCurveTo(990, 600, 940, 1300, 985, 2200); ctx.lineTo(1300, 2200); ctx.lineTo(1300, -200); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(960, -200); ctx.bezierCurveTo(990, 600, 940, 1300, 985, 2200); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.moveTo(960, -200); ctx.bezierCurveTo(990, 600, 940, 1300, 985, 2200); ctx.lineTo(1300, 2200); ctx.lineTo(1300, -200); ctx.closePath(); ctx.clip(); ctx.strokeStyle = 'rgba(62,43,30,.35)'; ctx.lineWidth = 1.2; for (let y = -200; y < 2200; y += 16) { ctx.beginPath(); ctx.moveTo(940, y); ctx.lineTo(1300, y + 4); ctx.stroke(); } ctx.restore();
  text('黄 浦 江', 1030, 640, 40, { rot: Math.PI / 2, col: INK, a: .8, font: 'MaShan' });
  // 街区（排线小块）
  const r = rng(31); ctx.strokeStyle = 'rgba(62,43,30,.45)'; ctx.lineWidth = 1;
  for (let y = 300; y < 1700; y += 92) for (let x = 90; x < 930; x += 120) {
    const yy = y + (r() - .5) * 12, w = 80 + r() * 26, h = 58 + r() * 14, cy = creekY(x + w / 2);
    if (Math.abs(yy + h / 2 - cy) < 95) continue; if (r() < .18) continue;
    ctx.strokeRect(x, yy, w, h); for (let k = 8; k < w + h; k += 9) { ctx.beginPath(); ctx.moveTo(x + Math.min(k, w), yy + Math.max(0, k - w)); ctx.lineTo(x + Math.max(0, k - h), yy + Math.min(k, h)); ctx.stroke(); }
  }
  ctx.restore();
}
function creek(t, o = {}) {
  const top = creekPath(-creekW / 2), bot = creekPath(creekW / 2).reverse();
  ctx.save(); ctx.globalAlpha = o.a ?? 1;
  ctx.fillStyle = o.fill ?? 'rgba(110,135,138,.55)'; poly([...top, ...bot], true); ctx.fill();
  ctx.save(); poly([...top, ...bot], true); ctx.clip(); ctx.strokeStyle = 'rgba(40,40,40,.25)'; ctx.lineWidth = 1; const ph = (t * 18) % 12; for (let y = 700; y < 1200; y += 8) { ctx.beginPath(); ctx.moveTo(0 - ph, y); ctx.lineTo(1100 - ph, y + 2); ctx.stroke(); } ctx.restore();
  inkLine(creekPath(-creekW / 2), 2.4, INK, o.p ?? 1); inkLine(creekPath(creekW / 2), 2.4, INK, o.p ?? 1);
  ctx.restore();
}
function bridgeIcon(x, y, s, a = 1, col = INK) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 30 * s, y + 8 * s); ctx.quadraticCurveTo(x, y - 26 * s, x + 30 * s, y + 8 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 30 * s, y - 2 * s); ctx.quadraticCurveTo(x, y - 36 * s, x + 30 * s, y - 2 * s); ctx.stroke();
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * 11 * s, y - 13 * s - (2 - Math.abs(k)) * 5 * s); ctx.lineTo(x + k * 11 * s, y - 2 * s - (2 - Math.abs(k)) * 5 * s); ctx.stroke(); }
  ctx.restore();
}
// 路牌（搪瓷）
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
    const s = Math.max(w / im.width, h / im.height) * kb.z, iw = im.width * s, ih = im.height * s;
    ctx.filter = 'sepia(.75) contrast(1.08) brightness(.97)';
    ctx.drawImage(im, -iw / 2 + kb.x * (iw - w) / 2, -ih / 2 + kb.y * (ih - h) / 2, iw, ih); ctx.filter = 'none';
  } else { ctx.fillStyle = '#cdbb98'; ctx.fillRect(-w / 2, -h / 2, w, h); }
  const v = ctx.createRadialGradient(0, 0, Math.min(w, h) * .3, 0, 0, Math.max(w, h) * .7); v.addColorStop(0, 'rgba(40,25,10,0)'); v.addColorStop(1, 'rgba(40,25,10,.45)'); ctx.fillStyle = v; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  if (o.caption) text(o.caption, cx, cy + h / 2 + 46, 24, { col: '#5a4532', a: o.a ?? 1 });
}
// 照片说明只写地点：照片年代不在锁定史实里，不上屏
const CAP = { creek: '洋泾浜', quay: '洋泾浜河岸', dock: '洋泾浜边的洋行', avenue: '爱多亚路', avenue2: '爱多亚路' };
const credit = k => CAP[k] ?? '';

// ================= 镜 1：今天的延安东路退回成河（0–8） =================
function shot1(t) {
  const z = lerp(2.3, 1.0, eio(seg(t, 3.2, 7.6))), wet = ss(seg(t, 1.6, 3.0)), old = ss(seg(t, 4.5, 7.8));
  ctx.fillStyle = `rgb(${lerp(58, 233, old) | 0},${lerp(62, 222, old) | 0},${lerp(68, 198, old) | 0})`; ctx.fillRect(0, 0, SW, SH);
  if (old > 0) { ctx.globalAlpha = old; ctx.drawImage(paper, 0, 0); ctx.globalAlpha = 1; }
  ctx.save(); ctx.translate(SW / 2, 980); ctx.scale(z, z); ctx.translate(-700, -creekY(700));
  if (old > 0) mapBase(t, { a: old });
  // 现代街区（灰块），慢慢褪掉
  const r = rng(3); ctx.globalAlpha = 1 - old;
  for (let y = 300; y < 1700; y += 92) for (let x = 90; x < 930; x += 120) { const cy = creekY(x + 50); if (Math.abs(y + 30 - cy) < 120) continue; ctx.fillStyle = `rgba(${90 + r() * 30},${95 + r() * 30},${105 + r() * 30},1)`; ctx.fillRect(x, y, 86 + r() * 20, 60 + r() * 14); ctx.fillStyle = 'rgba(255,230,160,.25)'; for (let k = 0; k < 6; k++) ctx.fillRect(x + 8 + k * 13, y + 10, 6, 6); }
  ctx.globalAlpha = 1;
  // 路面 → 河面：从东（江）往西一路“退”成水
  const RW = 120, top = creekPath(-RW / 2, -400, 1100), bot = creekPath(RW / 2, -400, 1100).reverse();
  ctx.fillStyle = `rgb(${lerp(70, 112, wet) | 0},${lerp(72, 136, wet) | 0},${lerp(78, 138, wet) | 0})`; poly([...top, ...bot], true); ctx.fill();
  const front = lerp(1100, -500, wet);   // 水的前沿（x），东边先变成水
  ctx.save(); poly([...top, ...bot], true); ctx.clip();
  if (wet < 1) { ctx.fillStyle = 'rgb(72,74,80)'; ctx.fillRect(-500, 0, front + 500, 2000); }
  // 车道线与车（只在还没变成水的地方）
  for (const off of [-30, 0, 30]) { ctx.strokeStyle = off ? 'rgba(230,230,220,.6)' : 'rgba(240,200,90,.8)'; ctx.lineWidth = 3; ctx.setLineDash(off ? [26, 22] : []); ctx.lineDashOffset = 0; inkLine(creekPath(off, -400, Math.min(1100, front)), 3, ctx.strokeStyle); }
  ctx.setLineDash([]);
  for (let i = 0; i < 18; i++) {
    const lane = i % 2 ? -15 : 15, dir = i % 2 ? 1 : -1, sp = 120 + h1(i) * 60, x = ((h1(i + 9) * 1500 + dir * sp * t) % 1500 + 1500) % 1500 - 400;
    if (x > front) continue; const y = creekY(x) + lane * 2.4, ang = Math.atan2(creekY(x + 4) - creekY(x - 4), 8);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = ['#b8b4a8', '#7f8c9a', '#a55a4a', '#d8d4c8', '#4a5560'][i % 5]; ctx.beginPath(); ctx.roundRect(-22, -10, 44, 20, 6); ctx.fill();
    ctx.fillStyle = dir > 0 ? 'rgba(255,240,190,.8)' : 'rgba(220,60,40,.8)'; ctx.fillRect(dir > 0 ? 18 : -22, -8, 4, 5); ctx.fillRect(dir > 0 ? 18 : -22, 3, 4, 5); ctx.restore();
  }
  // 水纹
  if (wet > 0) { ctx.strokeStyle = 'rgba(230,240,240,.35)'; ctx.lineWidth = 1.6; for (let k = 0; k < 40; k++) { const x = -400 + h1(k) * 1500; if (x < front) continue; const y = creekY(x) + (h1(k + 3) - .5) * RW * .8, ph = Math.sin(t * 2 + k) * 6; ctx.beginPath(); ctx.moveTo(x - 20 + ph, y); ctx.quadraticCurveTo(x + ph, y - 5, x + 20 + ph, y); ctx.stroke(); } }
  ctx.restore();
  ctx.strokeStyle = old > .5 ? INK : '#2a2c30'; ctx.lineWidth = 3; inkLine(top, 3, ctx.strokeStyle); inkLine(bot.slice().reverse(), 3, ctx.strokeStyle);
  ctx.restore();
  // 反差：路 → 河
  if (t > 1.0 && t < 6.5) { const a = ss(seg(t, 1.0, 1.4)) * (1 - ss(seg(t, 6.0, 6.5))); text('路', 300, 560, 150, { col: '#f3ead6', a: a * (1 - wet), font: 'MaShan', stroke: 'rgba(20,20,20,.5)', sw: 10 }); text('河', 300, 560, 150, { col: '#f3ead6', a: a * wet, font: 'MaShan', stroke: 'rgba(20,20,20,.5)', sw: 10 }); text('→', 540, 545, 90, { col: '#f3ead6', a: a * (1 - Math.abs(wet - .5) * 2) }); }
  schematicTag(1 - old);
}

// ================= 镜 2：老地图（8–45） =================
function map2(t) {
  ctx.drawImage(paper, 0, 0);
  const zin = lerp(1.0, 1.08, seg(t, 8, 44));
  ctx.save(); ctx.translate(SW / 2, 980); ctx.scale(zin, zin); ctx.translate(-SW / 2 + 40, -980);
  mapBase(t); creek(t);
  // 洋泾浜标名 + 尺度
  hand('洋 泾 浜', 470, creekY(470) + 12, 46, seg(t, V('2-1'), V('2-1') + 1), { align: 'center', font: 'MaShan', col: '#f3ead6' });
  if (t > V('2-1') + 1.6) {
    const a = ss(seg(t, V('2-1') + 1.6, V('2-1') + 2.4)) * (1 - ss(seg(t, V('2-2') - .2, V('2-2') + .4)));
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#7a2a1a'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); inkLine(creekPath(-90, 80, 940), 2.5, '#7a2a1a'); ctx.setLineDash([]); ctx.restore();
    text('不到 2 公里', 510, creekY(510) - 110, 40, { col: '#7a2a1a', a, weight: 600 });
    text('不到 20 米宽', 760, creekY(760) + 120, 36, { col: '#7a2a1a', a, weight: 600 });
  }
  // 北岸英租界、南岸法租界：上色（老地图分区）
  const en = ss(seg(t, V('2-2'), V('2-2') + 1.6)), fr = ss(seg(t, V('2-3'), V('2-3') + 1.6));
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(205,140,120,${.38 * en})`; poly([[60, 260], [950, 260], ...creekPath(-creekW / 2).reverse()], true); ctx.fill();
  ctx.fillStyle = `rgba(130,160,195,${.38 * fr})`; poly([...creekPath(creekW / 2), [950, 1720], [60, 1720]], true); ctx.fill();
  ctx.restore();
  hand('英租界', 330, 560, 92, seg(t, V('2-2'), V('2-2') + 1), { font: 'MaShan' }); hand('1845', 330, 650, 70, seg(t, V('2-2') + .6, V('2-2') + 1.4));
  hand('法租界', 330, 1260, 92, seg(t, V('2-3'), V('2-3') + 1), { font: 'MaShan' }); hand('1849', 330, 1345, 70, seg(t, V('2-3') + .6, V('2-3') + 1.4));
  // 界河：红色虚线沿河闪两下
  if (t > V('2-4')) { const a = ss(seg(t, V('2-4'), V('2-4') + .6)) * (.65 + .35 * Math.cos((t - V('2-4')) * 5) * (1 - seg(t, V('2-4') + 1.5, V('2-4') + 2.5))); ctx.save(); ctx.setLineDash([22, 14]); inkLine(creekPath(0), 5, `rgba(150,30,20,${a})`, seg(t, V('2-4'), V('2-4') + 1.4)); ctx.restore(); hand('界 河', 820, creekY(820) - 40, 44, seg(t, V('2-4') + .8, V('2-4') + 1.6), { col: '#8a2414', font: 'MaShan', align: 'center' }); }
  // 两岸小路
  if (t > V('2-5')) { inkLine(creekPath(-creekW / 2 - 26, 70, 945), 3, '#5a3a22', seg(t, V('2-5'), V('2-5') + 1.2)); hand('松江路（英租界）', 160, creekY(160) - 60, 44, seg(t, V('2-5') + .5, V('2-5') + 1.6)); }
  if (t > V('2-6')) { inkLine(creekPath(creekW / 2 + 26, 70, 945), 3, '#5a3a22', seg(t, V('2-6'), V('2-6') + 1.2)); hand('孔子路（法租界）', 160, creekY(160) + 100, 44, seg(t, V('2-6') + .5, V('2-6') + 1.6)); }
  // 走桥：一座桥 + 一个人走过
  if (t > V('2-7')) { const u = seg(t, V('2-7'), V('2-7') + 2.6); bridgeIcon(640, creekY(640) + 10, 1.2, ss(seg(t, V('2-7'), V('2-7') + .5))); const y = lerp(creekY(640) - 70, creekY(640) + 80, u); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(640, y - 16, 7, 0, 6.3); ctx.fill(); ctx.fillRect(637, y - 9, 6, 18); }
  // 九座桥：一座一座出来，带编号
  if (t > V('2-8')) bridgesX.forEach((x, i) => { const p = back(seg(t, V('2-8') + i * .28, V('2-8') + i * .28 + .4)); if (p <= 0) return; bridgeIcon(x, creekY(x) + 10, .9 * p, 1); text(String(i + 1), x, creekY(x) - 38, 30, { col: '#8a2414', a: clamp(p), weight: 600 }); });
  ctx.restore();
  if (IMG.creek && t < V('2-2') + .8) { const a = ss(seg(t, 8.4, 9.0)) * (1 - ss(seg(t, V('2-2') - .2, V('2-2') + .6))), u = seg(t, 8.4, V('2-2') + .6); photo('creek', 540, 600 - 40 * (1 - a), 940, 610, { z: lerp(1.04, 1.2, u), x: lerp(-.3, .3, u), y: 0 }, { rot: -.015, a, caption: credit('creek') }); }
  schematicTag(0);
}

// ================= 镜 3：桥浮起又淡去，只剩地名（45–65） =================
function shot3(t) {
  ctx.drawImage(paper, 0, 0);
  const z = lerp(1.08, 1.5, eio(seg(t, 45, 50)));
  ctx.save(); ctx.translate(SW / 2, 980); ctx.scale(z, z); ctx.translate(-SW / 2 + 40, -980);
  mapBase(t, { a: .6 }); creek(t, { a: .8 });
  bridgesX.forEach((x, i) => { const u = seg(t, 45.4 + i * .25, 47.6 + i * .25); const a = 1 - ss(u); if (a <= 0) return; bridgeIcon(x, creekY(x) + 10 - 120 * eo(u), .9 + .3 * u, a); });
  ctx.restore();
  // 地名牌
  const s1 = back(seg(t, V('3-2') + 1.5, V('3-2') + 2.0)), s2 = back(seg(t, V('3-2') + 2.4, V('3-2') + 2.9));
  ctx.save(); ctx.fillStyle = `rgba(233,222,198,${.85 * ss(seg(t, V('3-2'), V('3-2') + 1))})`; ctx.fillRect(0, 0, SW, SH); ctx.restore();
  if (s1 > 0) sign(540, 700, 640 * s1, 230 * s1, [['东新桥', 26, 110]], { seed: 4, rot: -.02 });
  if (s2 > 0) sign(540, 1060, 640 * s2, 230 * s2, [['八仙桥', 26, 110]], { seed: 6, rot: .015 });
  // “桥就在地名里”：每块牌子里的“桥”字下面亮一道
  if (t > V('3-3')) { const p = seg(t, V('3-3'), V('3-3') + .8); for (const y of [700, 1060]) { ctx.save(); ctx.strokeStyle = '#e8b24a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(540 + 70, y + 64); ctx.lineTo(540 + 70 + 110 * p, y + 64); ctx.stroke(); ctx.restore(); } bridgeIcon(540, 1330, 1.6, ss(seg(t, V('3-3') + .4, V('3-3') + 1.2)) * (1 - ss(seg(t, 62, 64.5)))); }
}

// ================= 镜 4：码头洋行 + 顺口溜（65–105） =================
function shot4(t) {
  ctx.drawImage(paper, 0, 0);
  const u = seg(t, 65, 105);
  if (!IMG.dock && IMG.creek) photo('creek', 540, 640, 900, 820, { z: lerp(1.25, 1.45, u), x: lerp(.7, -.4, u), y: lerp(-.2, .3, u) }, { rot: -.012, caption: credit('creek') });
  else if (IMG.dock) { const sw = ss(seg(t, 84.5, 85.5)); photo('dock', 540, 640, 900, 820, { z: lerp(1.04, 1.2, u), x: 0, y: lerp(.5, -.5, u) }, { rot: -.012, caption: credit('dock'), a: 1 - sw }); if (IMG.quay && sw > 0) photo('quay', 540, 640, 900, 820, { z: lerp(1.0, 1.15, seg(t, 84.5, 105)), x: lerp(-.6, .6, seg(t, 84.5, 105)), y: 0 }, { rot: .01, caption: credit('quay'), a: sw }); }
  else if (!IMG.creek) drawnDock(t);
  // 上海话夹英语：两个对话气泡
  const b = (s, x, y, p, flip) => { if (p <= 0) return; const sc = back(p); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.fillStyle = '#f7f0de'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-150, -60, 300, 110, 30); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(flip ? 60 : -60, 48); ctx.lineTo(flip ? 90 : -90, 100); ctx.lineTo(flip ? 20 : -20, 50); ctx.fill(); ctx.stroke(); text(s, 0, 14, 46, { weight: 600 }); ctx.restore(); };
  const qa = 1 - ss(seg(t, V('4-3') - .3, V('4-3') + .3));
  if (qa > 0) { ctx.save(); ctx.globalAlpha = qa; b('上海话', 300, 1190, seg(t, V('4-2'), V('4-2') + .4), false); b('English', 780, 1190, seg(t, V('4-2') + .7, V('4-2') + 1.1), true); text('＋', 540, 1220, 70, { a: ss(seg(t, V('4-2') + 1, V('4-2') + 1.4)) }); ctx.restore(); hand('“洋泾浜英语”', 540, 1400, 80, seg(t, V('4-2') + 2.6, V('4-2') + 3.6), { align: 'center', font: 'MaShan', a: qa }); }
  // 顺口溜字卡（全集笑点）
  if (t > V('4-3')) {
    const p = back(seg(t, V('4-3'), V('4-3') + .5)), bob = Math.sin((t - V('4-3')) * 6) * 4 * (1 - seg(t, V('4-4') + 2, V('4-4') + 3));
    ctx.save(); ctx.translate(540, 1130 + bob); ctx.rotate(-.03); ctx.scale(p, p);
    ctx.fillStyle = '#efe2bf'; ctx.strokeStyle = '#8a2414'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(-430, -230, 860, 460, 24); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-410, -210, 820, 420, 18); ctx.stroke();
    text('老上海顺口溜', 0, -140, 44, { col: '#8a2414', weight: 600 });
    const p1 = seg(t, V('4-4'), V('4-4') + .5), p2 = seg(t, V('4-4') + 1.7, V('4-4') + 2.2);
    if (p1 > 0) { ctx.save(); ctx.scale(back(p1), back(p1)); text('来是“康姆”', 0, -30, 96, { font: 'MaShan', col: INK }); ctx.restore(); }
    if (p2 > 0) { ctx.save(); ctx.translate(0, 110); ctx.scale(back(p2), back(p2)); text('去是“谷”', 0, 0, 96, { font: 'MaShan', col: INK }); ctx.restore(); }
    // 注音：康姆 = come，谷 = go
    const p3 = seg(t, V('4-5'), V('4-5') + .5), p4 = seg(t, V('4-5') + 1.0, V('4-5') + 1.5);
    if (p3 > 0) text('come', 335, -40, 46, { col: '#8a2414', a: p3, font: 'NotoSerif', weight: 600, rot: .06 });
    if (p4 > 0) text('go', 300, 100, 46, { col: '#8a2414', a: p4, font: 'NotoSerif', weight: 600, rot: .06 });
    ctx.restore();
    // pidgin ← business 小注
    const p5 = seg(t, V('4-5') + 3.0, V('4-5') + 3.6);
    if (p5 > 0) text('pidgin 一词，源自 business 的讹音', 540, 1450, 34, { a: p5 * (1 - seg(t, V('4-6') - .4, V('4-6'))), col: '#5a4532' });
  }
  // “洋泾浜”= 英语不地道：盖章
  if (t > V('4-6') + 3.6) {
    const p = seg(t, V('4-6') + 3.6, V('4-6') + 3.9), sc = lerp(1.6, 1, eo(p));
    ctx.save(); ctx.translate(800, 880); ctx.rotate(-.18); ctx.scale(sc, sc); ctx.globalAlpha = clamp(p * 1.4) * .9;
    ctx.strokeStyle = '#a8231a'; ctx.lineWidth = 8; ctx.strokeRect(-150, -80, 300, 160); text('洋泾浜', 0, 30, 84, { col: '#a8231a', font: 'MaShan' }); ctx.restore();
    text('＝ 英语讲得不地道', 540, 1450, 46, { a: seg(t, V('4-6') + 4.3, V('4-6') + 4.8), weight: 600 });
  }
}
// 没有照片时：画出来的码头洋行（明显是插画，不冒充照片）
function drawnDock(t) {
  ctx.save(); ctx.translate(540, 760); const z = lerp(1, 1.12, seg(t, 65, 105)); ctx.scale(z, z); ctx.translate(-540, -760);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  const B = [[110, 260, 300], [270, 230, 360], [410, 200, 300], [560, 260, 380], [720, 240, 320], [860, 180, 290]];
  for (const [x, w, h] of B) { ctx.fillStyle = 'rgba(200,180,140,.5)'; ctx.fillRect(x, 820 - h, w * .62, h); ctx.strokeRect(x, 820 - h, w * .62, h); for (let r = 0; r < Math.floor(h / 50); r++) for (let c = 0; c < 3; c++) ctx.strokeRect(x + 14 + c * (w * .62 - 28) / 3, 820 - h + 18 + r * 50, 18, 26); }
  ctx.fillStyle = 'rgba(110,135,138,.5)'; ctx.fillRect(60, 860, 960, 260); ctx.beginPath(); ctx.moveTo(60, 860); ctx.lineTo(1020, 860); ctx.stroke();
  for (let i = 0; i < 4; i++) { const x = 180 + i * 220 + Math.sin(t + i) * 10; ctx.beginPath(); ctx.moveTo(x - 60, 960); ctx.lineTo(x + 60, 960); ctx.lineTo(x + 40, 990); ctx.lineTo(x - 40, 990); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, 960); ctx.lineTo(x, 860); ctx.lineTo(x + 45, 900); ctx.lineTo(x, 940); ctx.stroke(); }
  ctx.restore(); schematicTag(1);
}

// ================= 镜 5：填浜筑路（示意动画，105–135） =================
function shot5(t) {
  ctx.drawImage(paper, 0, 0);
  const z = lerp(1.3, 1.15, seg(t, 105, 135));
  ctx.save(); ctx.translate(SW / 2, 980); ctx.scale(z, z); ctx.translate(-SW / 2 + 40, -980);
  mapBase(t, { a: .55 });
  const murk = ss(seg(t, 105.5, 108)), fill = seg(t, V('5-2'), V('5-3') + 4.5), road = ss(seg(t, V('5-3') + 2.5, V('5-3') + 7));
  creek(t, { fill: `rgba(${lerp(110, 105, murk) | 0},${lerp(135, 110, murk) | 0},${lerp(138, 80, murk) | 0},.6)` });
  // 发臭：几道气味线
  if (murk > 0 && fill < .3) for (let k = 0; k < 7; k++) { const x = 140 + k * 120, y = creekY(x) - 20, ph = (t * 1.3 + k * .3) % 1; ctx.save(); ctx.globalAlpha = murk * (1 - ph) * (1 - seg(fill, 0, .3)); ctx.strokeStyle = '#5a6a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); for (let j = 0; j < 12; j++) ctx.lineTo(x + Math.sin(j * .9 + t * 3) * 7, y - ph * 60 - j * 6); ctx.stroke(); ctx.restore(); }
  // 桥又堵路
  const bri = ss(seg(t, 108.5, 109.5)) * (1 - ss(seg(fill, .1, .3)));
  bridgesX.forEach(x => bridgeIcon(x, creekY(x) + 10, .9, bri));
  // 填：土从两岸倒进河里，一段一段由东往西
  if (fill > 0) {
    const xf = lerp(MAPX1 + 20, MAPX0 - 20, fill);
    const top = creekPath(-creekW / 2 - 1, xf, MAPX1 + 20), bot = creekPath(creekW / 2 + 1, xf, MAPX1 + 20).reverse();
    if (top.length > 1) { ctx.fillStyle = '#a88a5e'; poly([...top, ...bot], true); ctx.fill(); ctx.save(); poly([...top, ...bot], true); ctx.clip(); const r = rng(9); for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(80,55,30,${r() * .5})`; ctx.fillRect(xf + r() * (MAPX1 - xf + 20), creekY(MAPX1) - 90 + r() * 260, 3, 3); } ctx.restore(); }
    // 夯：一个夯锤在前沿起落
    const ph = Math.abs(Math.sin((t - V('5-2')) * Math.PI * 2.4)); const hx = xf + 30, hy = creekY(hx) - 30 - ph * 50;
    if (fill < 1) { ctx.save(); ctx.fillStyle = INK; ctx.fillRect(hx - 18, hy, 36, 26); ctx.fillRect(hx - 3, hy - 60, 6, 60); ctx.restore(); }
  }
  // 马路从河道上长出来：并成一条宽路
  if (road > 0) {
    const w = lerp(creekW, creekW + 52 + 30, road), top = creekPath(-w / 2), bot = creekPath(w / 2).reverse();
    ctx.fillStyle = `rgba(150,145,135,${road})`; poly([...top, ...bot], true); ctx.fill();
    inkLine(creekPath(-w / 2), 3, INK, road); inkLine(creekPath(w / 2), 3, INK, road);
    ctx.save(); ctx.setLineDash([18, 16]); inkLine(creekPath(0), 2, `rgba(240,235,220,${road})`); ctx.restore();
  }
  // “当时上海最宽的路”：宽度箭头
  if (t > V('5-3') + 6) { const a = ss(seg(t, V('5-3') + 6, V('5-3') + 6.6)), x = 560, y0 = creekY(x) - 48, y1 = creekY(x) + 48; ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#8a2414'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y0 - 30); ctx.lineTo(x, y1 + 30); ctx.stroke(); for (const [y, d] of [[y0 - 30, 1], [y1 + 30, -1]]) { ctx.beginPath(); ctx.moveTo(x - 14, y + 18 * d); ctx.lineTo(x, y); ctx.lineTo(x + 14, y + 18 * d); ctx.stroke(); } ctx.restore(); text('当时上海最宽的路', x + 30, y1 + 110, 46, { a, col: '#8a2414', weight: 600, align: 'left' }); }
  ctx.restore();
  schematicTag(1);
}

// ================= 镜 6：爱多亚路（135–165） =================
function shot6(t) {
  ctx.drawImage(paper, 0, 0);
  const u = seg(t, 135, 165);
  if (IMG.avenue) photo('avenue', 540, 560, 940, 700, { z: lerp(1.02, 1.18, u), x: lerp(.4, -.4, u), y: 0 }, { rot: .01, caption: credit('avenue'), a: 1 - .35 * ss(seg(t, V('6-5'), V('6-5') + .6)) });
  else { ctx.save(); ctx.globalAlpha = .9; mapBase(t, { a: .5 }); ctx.restore(); }
  // 英国名？法国名？两张小牌拔河
  const tug = t > V('6-2') && t < V('6-4') + .2;
  if (tug) { const a = ss(seg(t, V('6-2'), V('6-2') + .4)) * (1 - ss(seg(t, V('6-4') - .3, V('6-4') + .2))), sw = Math.sin((t - V('6-2')) * 5) * 18;
    ctx.save(); ctx.globalAlpha = a; sign(300 + sw, 1080, 380, 150, [['英国名', 18, 56]], { bg: '#7a2a24', seed: 2, rot: -.05 }); sign(780 + sw, 1080, 380, 150, [['不 干', 18, 56]], { bg: '#2f4a6b', seed: 3, rot: .05 }); ctx.restore(); }
  // Edward VII + 法文读法
  if (t > V('6-4') && t < V('6-5') + .2) { const a = 1 - ss(seg(t, V('6-5') - .3, V('6-5') + .2)); text('Edward VII', 540, 1020, 92, { a: a * seg(t, V('6-4'), V('6-4') + .6), font: 'NotoSerif', weight: 600, col: '#3e2b1e' }); text('英国国王的名 · 法文的读法', 540, 1120, 44, { a: a * seg(t, V('6-4') + 2.4, V('6-4') + 3), col: '#5a4532', weight: 600 }); }
  // 路牌特写
  if (t > V('6-5')) { const p = back(seg(t, V('6-5'), V('6-5') + .5)), z = lerp(1, 1.08, seg(t, V('6-5'), 165)); sign(540, 1020, 860 * p * z, 330 * p * z, [['爱多亚路', -12, 120], ['AVENUE  EDWARD  VII', 92, 46]], { seed: 8 }); }
  if (t > V('6-6')) { const a = ss(seg(t, V('6-6'), V('6-6') + .6)); text('英', 330, 1290, 60, { col: '#7a2a24', a, font: 'MaShan' }); text('＋', 540, 1290, 60, { a }); text('法', 750, 1290, 60, { col: '#2f4a6b', a, font: 'MaShan' }); }
}

// ================= 镜 7：路牌翻页（165–190） =================
const NAMES = [['爱多亚路', '1916', 0], ['大上海路', '1943', V('7-2')], ['中正东路', '1945', V('7-2') + 2.6], ['延安东路', '1950', V('7-4')]];
function shot7(t) {
  ctx.drawImage(paper, 0, 0);
  let k = 0; for (let i = 0; i < NAMES.length; i++) if (t >= NAMES[i][2]) k = i;
  const flipT = NAMES[k][2], f = seg(t, flipT, flipT + .45);
  // 翻牌：旧牌往上翻走（压扁），新牌从下翻出
  if (k > 0 && f < 1) { const old = NAMES[k - 1]; sign(540, 860, 860, 330, [[old[0], 34, 130]], { sy: Math.max(.02, 1 - f * 2), seed: k }); if (f > .5) sign(540, 860, 860, 330, [[NAMES[k][0], 34, 130]], { sy: (f - .5) * 2, seed: k + 1, bg: k === 3 ? '#2a5a46' : '#2f4a6b' }); }
  else sign(540, 860, 860, 330, [[NAMES[k][0], 34, 130]], { seed: k + 1, bg: k === 3 ? '#2a5a46' : '#2f4a6b' });
  // 年份戳 + 时间轴
  for (let i = 0; i < NAMES.length; i++) { const on = t >= NAMES[i][2] + (i ? .3 : 0) || i === 0, x = 200 + i * 227; const a = on ? 1 : .25; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = i === k ? '#8a2414' : INK; ctx.beginPath(); ctx.arc(x, 1220, i === k ? 16 : 10, 0, 6.3); ctx.fill(); ctx.restore(); text(NAMES[i][1], x, 1300, 44, { a, weight: 600, col: i === k ? '#8a2414' : INK }); text(NAMES[i][0], x, 1360, 32, { a: a * .9 }); }
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(200, 1220); ctx.lineTo(881, 1220); ctx.stroke(); ctx.restore();
  // 1950：“正式改名”，章
  if (t > V('7-3')) { const p = seg(t, V('7-3'), V('7-3') + .35); ctx.save(); ctx.translate(820, 560); ctx.rotate(.15); const sc = lerp(1.5, 1, eo(p)); ctx.scale(sc, sc); ctx.globalAlpha = clamp(p * 1.4) * .9; ctx.strokeStyle = '#a8231a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 110, 0, 6.3); ctx.stroke(); text('1950', 0, -6, 58, { col: '#a8231a', weight: 600 }); text('五月', 0, 50, 36, { col: '#a8231a', weight: 600 }); ctx.restore(); }
}

// ================= 镜 8：弯道（今昔对比占位，190–216）+ 片尾卡 =================
function shot8(t) {
  ctx.drawImage(paper, 0, 0);
  const z = lerp(1.0, 1.25, eio(seg(t, 190, 200))), cx = lerp(540, 380, eio(seg(t, V('8-3'), V('8-3') + 4)));
  ctx.save(); ctx.translate(SW / 2, 980); ctx.scale(z, z); ctx.translate(-cx, -980);
  mapBase(t, { a: .45 });
  // 今天的路（示意）
  const w = creekW + 82, top = creekPath(-w / 2, -300, 1000), bot = creekPath(w / 2, -300, 1000).reverse();
  ctx.fillStyle = 'rgba(150,145,135,.9)'; poly([...top, ...bot], true); ctx.fill(); inkLine(creekPath(-w / 2, -300, 1000), 3); inkLine(creekPath(w / 2, -300, 1000), 3);
  ctx.save(); ctx.setLineDash([18, 16]); inkLine(creekPath(0, -300, 1000), 2, 'rgba(240,235,220,.9)'); ctx.restore();
  hand('外滩', 830, creekY(830) - 110, 54, seg(t, V('8-3'), V('8-3') + .8), { align: 'center' }); hand('西藏路', 140, creekY(140) - 110, 54, seg(t, V('8-3') + 1.4, V('8-3') + 2.2), { align: 'center' });
  // 一个小车点从外滩往西开，到弯道处“微微一拐”
  if (t > V('8-3')) { const u = eio(seg(t, V('8-3') + .5, V('8-3') + 6)), x = lerp(930, 120, u), y = creekY(x) + 14, ang = Math.atan2(creekY(x - 3) - creekY(x + 3), -6); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = '#8a2414'; ctx.beginPath(); ctx.roundRect(-18, -9, 36, 18, 5); ctx.fill(); ctx.restore(); }
  // 弯道：圈出来
  if (t > V('8-3') + 3.6) { const a = ss(seg(t, V('8-3') + 3.6, V('8-3') + 4.2)); ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#8a2414'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(290, creekY(290), 150, 110, 0, 0, 6.3 * seg(t, V('8-3') + 3.6, V('8-3') + 4.4)); ctx.stroke(); ctx.restore(); }
  // 河床还躺在马路底下：淡淡的河的轮廓透出来
  if (t > V('8-4')) { const a = ss(seg(t, V('8-4') + 2, V('8-4') + 3.5)); ctx.save(); ctx.globalAlpha = a * .8; ctx.fillStyle = 'rgba(90,130,140,.45)'; poly([...creekPath(-creekW / 2, -300, 1000), ...creekPath(creekW / 2, -300, 1000).reverse()], true); ctx.fill(); ctx.setLineDash([10, 8]); inkLine(creekPath(-creekW / 2, -300, 1000), 2, 'rgba(40,70,80,.9)'); inkLine(creekPath(creekW / 2, -300, 1000), 2, 'rgba(40,70,80,.9)'); ctx.restore(); hand('洋泾浜的河床', 600, creekY(600) + 130, 48, seg(t, V('8-4') + 3.2, V('8-4') + 4.2), { align: 'center', col: '#2f5560' }); }
  ctx.restore();
  schematicTag(1 - seg(t, 215, 216));
}
function endCard(t) {
  const a = ss(seg(t, 216.2, 217.2)); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.drawImage(paper, 0, 0); ctx.restore();
  hand('《租界百年》', 540, 760, 96, seg(t, 216.6, 217.6), { align: 'center', font: 'MaShan' });
  hand('第二集 · 洋泾浜', 540, 900, 110, seg(t, 217.4, 218.6), { align: 'center', font: 'MaShan' });
  ctx.save(); ctx.globalAlpha = ss(seg(t, 218.4, 219)); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(300, 970); ctx.lineTo(780, 974); ctx.stroke(); ctx.restore();
  hand('熊吉大王', 540, 1120, 80, seg(t, 219, 220), { align: 'center' });
}

// ---------------- 字幕与水印 ----------------
function subtitles(t) {
  const s = SUBS.find(s => t >= s.t0 && t < s.t1); if (!s) return;
  const a = ss(seg(t, s.t0, s.t0 + .15)) * (1 - ss(seg(t, s.t1 - .15, s.t1)));
  text(s.text, SW / 2, 1580, 54, { col: '#f8f1df', stroke: 'rgba(28,18,8,.88)', sw: 9, weight: 600, a });
}
function watermark() { text('熊吉大王', SW - 44, SH - 66, 40, { align: 'right', col: '#f3ead6', stroke: 'rgba(30,20,10,.45)', sw: 5, a: .5, font: 'LongCang' }); }

// ---------------- 一帧 ----------------
// 镜与镜之间用纸面上的划变（像翻过一张旧纸），不硬切
const SHOTS = [[0, 8.4, shot1], [8, 45.4, map2], [45, 65.4, shot3], [65, 105.4, shot4], [105, 135.4, shot5], [135, 165.4, shot6], [165, 190.4, shot7], [190, 222, shot8]];
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  let cur = SHOTS.findLast(s => t >= s[0]); cur[2](t);
  const nxt = SHOTS.find(s => s[0] > cur[0] && t >= s[0] - 0.0001 && t < s[1]);
  // 过渡：下一镜从右往左盖过来（0.4 s），边缘带一道纸影
  const tr = SHOTS.find((s, i) => i > 0 && t >= s[0] && t < s[0] + .4);
  if (tr && tr !== SHOTS[0]) { const i = SHOTS.indexOf(tr), prev = SHOTS[i - 1]; const p = eio(seg(t, tr[0], tr[0] + .4)), x = SW * (1 - p);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, SH); ctx.clip(); prev[2](t); ctx.restore();
    ctx.save(); const g = ctx.createLinearGradient(x, 0, x + 40, 0); g.addColorStop(0, 'rgba(40,25,10,.35)'); g.addColorStop(1, 'rgba(40,25,10,0)'); ctx.fillStyle = g; ctx.fillRect(x, 0, 40, SH); ctx.restore(); }
  endCard(t);
  corner(t);
  grain(t, t < 6 ? .03 : .07); if (t > 6) scratches(t, .2);
  // 轻微的放映闪烁
  ctx.save(); ctx.fillStyle = `rgba(20,10,0,${t > 6 ? .03 * h1(Math.floor(t * 12)) : 0})`; ctx.fillRect(0, 0, SW, SH); ctx.restore();
  subtitles(t);
  watermark();
}

// ---------------- 声音事件 ----------------
const EV = [];
EV.push({ t: 1.6, type: 'water', dur: 1.6 });
EV.push({ t: V('2-2'), type: 'write' }, { t: V('2-3'), type: 'write' }, { t: V('2-5'), type: 'write' }, { t: V('2-6'), type: 'write' }, { t: V('2-4'), type: 'pen' });
bridgesX.forEach((x, i) => EV.push({ t: V('2-8') + i * .28, type: 'bridge', i }));
EV.push({ t: 45.4, type: 'rise', dur: 3 }, { t: V('3-2') + 1.5, type: 'sign' }, { t: V('3-2') + 2.4, type: 'sign' });
EV.push({ t: V('4-2'), type: 'pop' }, { t: V('4-2') + .7, type: 'pop' }, { t: V('4-3'), type: 'card' }, { t: V('4-4'), type: 'pop' }, { t: V('4-4') + 1.7, type: 'pop' }, { t: V('4-6') + 3.6, type: 'stamp' });
EV.push({ t: V('5-2'), type: 'fill', dur: 9 }); for (let k = 0; k < 22; k++) EV.push({ t: V('5-2') + k / 2.4, type: 'tamp' });
EV.push({ t: V('6-5'), type: 'sign' });
for (const [, , tt] of NAMES.slice(1)) EV.push({ t: tt, type: 'flip' }); EV.push({ t: V('7-3'), type: 'stamp' });
EV.push({ t: V('8-3') + .5, type: 'car', dur: 5.5 });
for (const [a] of SHOTS.slice(1)) EV.push({ t: a, type: 'page' });
EV.sort((a, b) => a.t - b.t);

window.DUR = DUR; window.EV = EV; window.render = render;
window.TEXTS = t => { const s = SUBS.find(s => t >= s.t0 && t < s.t1); return s ? [{ id: 'sub' + s.t0, text: s.text, x0: 100, y0: 1520, x1: 980, y1: 1600 }] : []; };
window.READY = true;
