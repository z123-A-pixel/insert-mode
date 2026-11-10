/* ============================================================
   交互式原理演示
   每个演示 = (host, D) => void，D 收集清理函数
   ============================================================ */

const REG = new Map();
const reg = (id, fn) => REG.set(id, fn);

export function mountVisual(id, host) {
  const fn = REG.get(id);
  if (!fn) return null;
  const D = [];
  try {
    fn(host, D);
  } catch (e) {
    console.error('viz', id, e);
  }
  return () => { D.forEach((f) => { try { f(); } catch (_) {} }); };
}

/* ---------------- 基础工具 ---------------- */

const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

function palette(el) {
  const d = isDark();
  const accent = (getComputedStyle(el).getPropertyValue('--accent') || '').trim() || '#0a84ff';
  return {
    d,
    cardFill: d ? '#242427' : '#ffffff',
    accent,
    fg: d ? '#f2f2f7' : '#1c1c1e',
    dim: d ? 'rgba(235,235,245,.58)' : 'rgba(60,60,67,.6)',
    faint: d ? 'rgba(235,235,245,.2)' : 'rgba(60,60,67,.16)',
    grid: d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)',
    panel: d ? '#242427' : '#f5f5f8',
    ok: '#30d158',
    warn: '#ff9f0a',
    bad: '#ff453a',
    blue: '#0a84ff',
    purple: '#bf5af2',
    teal: '#40c8e0'
  };
}

function mkCanvas(host, h, D) {
  const cv = document.createElement('canvas');
  cv.style.cssText = `display:block;width:100%;height:${h}px;border-radius:12px`;
  host.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W = 320;
  const fitters = [];
  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth || 320;
    cv.width = Math.max(1, Math.round(W * dpr));
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitters.forEach((f) => f());
  }
  fit();
  const onResize = () => fit();
  window.addEventListener('resize', onResize);
  D.push(() => window.removeEventListener('resize', onResize));
  return {
    cv, ctx, h,
    get w() { return W; },
    onFit(f) { fitters.push(f); },
    clear(fill) {
      ctx.clearRect(0, 0, W, h);
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, W, h); }
    }
  };
}

function txt(ctx, s, x, y, o = {}) {
  ctx.font = `${o.w || 600} ${o.s || 11}px ${o.mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : '-apple-system, "PingFang SC", "Helvetica Neue", sans-serif'}`;
  ctx.fillStyle = o.c || '#1c1c1e';
  ctx.textAlign = o.a || 'left';
  ctx.textBaseline = o.b || 'middle';
  ctx.fillText(s, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function box(ctx, x, y, w, h, { fill, stroke, r = 8, lw = 1 } = {}) {
  roundRect(ctx, x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function line(ctx, x1, y1, x2, y2, color, lw = 1, dash) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  if (dash) ctx.setLineDash(dash);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  if (dash) ctx.setLineDash([]);
}

function dot(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/* 控件 */
function ctrl(host) {
  const d = document.createElement('div');
  d.className = 'ctrl';
  host.appendChild(d);
  return d;
}

function slider(parent, label, min, max, val, step, fmt, onInput) {
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  row.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" value="${val}" step="${step}"><span class="ctrl-val"></span>`;
  const inp = row.querySelector('input');
  const out = row.querySelector('.ctrl-val');
  out.textContent = fmt(val);
  inp.addEventListener('input', () => {
    out.textContent = fmt(+inp.value);
    onInput(+inp.value);
  });
  parent.appendChild(row);
  return {
    set(v) { inp.value = v; out.textContent = fmt(v); }
  };
}

function seg(parent, items, value, onChange) {
  const d = document.createElement('div');
  d.className = 'seg';
  d.innerHTML = items.map((it) => `<button data-v="${it.v}" class="${it.v === value ? 'on' : ''}">${it.label}</button>`).join('');
  d.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    d.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    onChange(b.dataset.v);
  });
  parent.appendChild(d);
  return d;
}

function readout(parent, defs) {
  const d = document.createElement('div');
  d.className = 'readout';
  d.innerHTML = defs.map((x) => `<div><b>${x.v}</b><span>${x.k}</span></div>`).join('');
  parent.appendChild(d);
  return (vals) => {
    [...d.children].forEach((el, i) => {
      if (vals[i] != null) el.querySelector('b').textContent = vals[i];
    });
  };
}

function note(host, text) {
  const p = document.createElement('div');
  p.className = 'tiny muted';
  p.style.cssText = 'margin-top:9px;line-height:1.5';
  p.textContent = text;
  host.appendChild(p);
  return p;
}

function fmtNum(v, digits = 2) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
  if (a >= 1) return v.toFixed(digits).replace(/\.?0+$/, '');
  if (a === 0) return '0';
  if (a >= 0.001) return v.toFixed(3).replace(/\.?0+$/, '');
  return v.toExponential(1);
}

/* ============================================================
   1. 上拉 / 下拉
   ============================================================ */
reg('pullup', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 170, D);
  const st = { mode: 'up', sw: false };
  const c = ctrl(host);
  seg(c, [{ v: 'up', label: '上拉' }, { v: 'down', label: '下拉' }, { v: 'none', label: '悬空' }], 'up', (v) => { st.mode = v; draw(); });
  const srow = document.createElement('div');
  srow.className = 'ctrl-row';
  srow.innerHTML = `<label>按键</label><div class="seg" data-sw><button data-v="0" class="on">断开</button><button data-v="1">按下接地</button></div>`;
  c.appendChild(srow);
  srow.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    st.sw = b.dataset.v === '1';
    srow.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  });
  const upd = readout(host, [{ k: '引脚电平', v: '1' }, { k: '静态电流', v: '0 µA' }, { k: '状态', v: '确定' }]);

  function draw() {
    const { ctx, w: W, h: H } = cv;
    cv.clear(C.panel);
    const cx = Math.round(W * 0.36);
    const railY = 30, pinY = 88, gndY = 146;

    /* 电源轨 */
    line(ctx, cx - 54, railY, cx + 10, railY, C.accent, 2.5);
    txt(ctx, '3.3V', cx - 54, railY - 12, { s: 10, c: C.dim, mono: 1 });

    /* 电阻 */
    const hasR = st.mode !== 'none';
    if (hasR) {
      const rTop = railY + 8, rBot = pinY - 18;
      line(ctx, cx, railY, cx, rTop, C.accent, 2);
      box(ctx, cx - 9, rTop, 18, rBot - rTop, { fill: C.cardFill, stroke: C.accent, r: 3, lw: 1.6 });
      txt(ctx, '10k', cx + 16, (rTop + rBot) / 2, { s: 9.5, c: C.dim, mono: 1 });
    }
    line(ctx, cx, hasR ? pinY - 18 : railY, cx, pinY, hasR ? C.accent : C.faint, 2);

    /* 引脚节点 */
    dot(ctx, cx, pinY, 4, C.fg);
    line(ctx, cx, pinY, cx + 62, pinY, C.fg, 2);

    /* MCU */
    box(ctx, cx + 62, pinY - 30, 78, 60, { fill: C.card, stroke: C.faint, r: 10 });
    txt(ctx, 'GPIO', cx + 101, pinY - 12, { s: 10, c: C.dim, a: 'center' });
    const lvl = st.mode === 'up' ? (st.sw ? 0 : 1) : st.mode === 'down' ? 0 : null;
    txt(ctx, lvl === null ? '?' : String(lvl), cx + 101, pinY + 8, {
      s: 22, w: 800, a: 'center', mono: 1, c: lvl === null ? C.warn : lvl ? C.ok : C.bad
    });

    /* 下拉/开关到地 */
    if (st.mode === 'down') {
      const rTop = pinY + 22, rBot = gndY - 8;
      line(ctx, cx, pinY, cx, rTop, C.accent, 2);
      box(ctx, cx - 9, rTop, 18, rBot - rTop, { fill: C.cardFill, stroke: C.accent, r: 3, lw: 1.6 });
      line(ctx, cx, rBot, cx, gndY, C.accent, 2);
      txt(ctx, '10k', cx + 16, (rTop + rBot) / 2, { s: 9.5, c: C.dim, mono: 1 });
    } else if (st.mode === 'up') {
      line(ctx, cx, pinY, cx, gndY - 26, st.sw ? C.fg : C.faint, 2, st.sw ? null : [3, 3]);
      // 开关
      const sy = gndY - 22;
      dot(ctx, cx, sy, 3, st.sw ? C.fg : C.dim);
      if (st.sw) {
        line(ctx, cx, sy, cx, gndY, C.fg, 2);
      } else {
        line(ctx, cx, sy, cx + 13, sy - 12, C.dim, 2);
      }
      dot(ctx, cx, gndY, 3, st.sw ? C.fg : C.dim);
      txt(ctx, '按键', cx + 18, sy, { s: 9.5, c: C.dim });
    } else {
      // 悬空：画噪声
      ctx.strokeStyle = C.warn;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x <= 26; x++) {
        const y = pinY + Math.sin(x * 0.9) * 3.6;
        x ? ctx.lineTo(cx + x, y) : ctx.moveTo(cx + x, y);
      }
      ctx.stroke();
      txt(ctx, '天线效应', cx + 6, pinY - 16, { s: 9, c: C.warn });
    }

    /* 地 */
    line(ctx, cx - 26, gndY, cx + 26, gndY, C.dim, 2.5);
    for (let i = 1; i <= 2; i++) line(ctx, cx - 26 + i * 9, gndY + i * 4, cx + 26 - i * 9, gndY + i * 4, C.dim, 2);

    /* 电流路径 */
    if (st.mode === 'up' && st.sw) {
      ctx.strokeStyle = C.warn;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx + 3, railY + 4);
      ctx.lineTo(cx + 3, pinY);
      ctx.lineTo(cx + 3, gndY - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      txt(ctx, '0.33mA', cx + 44, pinY + 40, { s: 9.5, c: C.warn, mono: 1 });
    }

    // 状态文案
    const stateTxt = st.mode === 'none' ? '电平不确定' : st.sw ? '被拉到 0' : st.mode === 'up' ? '稳稳的 1' : '稳稳的 0';
    txt(ctx, stateTxt, W - 12, 16, { s: 10, c: C.dim, a: 'right' });

    const cur = st.mode === 'up' && st.sw ? '330 µA' : st.mode === 'down' ? '0 µA（始终接地）' : st.mode === 'none' ? '不确定' : '0 µA';
    upd([lvl === null ? '不确定' : String(lvl), cur, st.mode === 'none' ? '浮空' : st.sw ? '导通' : '截止']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   2. 分压 + ADC
   ============================================================ */
reg('divider', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 165, D);
  const st = { r1: 10, r2: 10, vin: 5 };
  const c = ctrl(host);
  const s1 = slider(c, 'R1', 1, 100, 10, 1, (v) => v + 'k', (v) => { st.r1 = v; draw(); });
  const s2 = slider(c, 'R2', 1, 100, 10, 1, (v) => v + 'k', (v) => { st.r2 = v; draw(); });
  const s3 = slider(c, 'Vin', 1.8, 24, 5, 0.1, (v) => v.toFixed(1) + 'V', (v) => { st.vin = v; draw(); });
  const upd = readout(host, [{ k: 'Vout', v: '' }, { k: 'ADC 码值', v: '' }, { k: '分压电流', v: '' }]);
  const nt = note(host, '分压电阻越小，抗干扰越好但越费电；给 ADC 采样时建议 R2 不超过 10k。');

  function draw() {
    const { ctx, w: W, h: H } = cv;
    cv.clear(C.panel);
    const vout = (st.vin * st.r2) / (st.r1 + st.r2);
    const cur = st.vin / ((st.r1 + st.r2) * 1000);
    const over = vout > 3.3;
    const code = Math.max(0, Math.min(4095, Math.round((vout / 3.3) * 4095)));

    const ax = Math.round(W * 0.3);
    line(ctx, ax, 22, ax, 44, C.accent, 2);
    txt(ctx, st.vin.toFixed(1) + 'V', ax + 10, 26, { s: 10, c: C.dim, mono: 1 });
    box(ctx, ax - 20, 44, 40, 20, { fill: C.cardFill, stroke: C.accent, r: 4, lw: 1.4 });
    txt(ctx, 'R1', ax, 54, { s: 9.5, c: C.fg, a: 'center' });
    txt(ctx, st.r1 + 'k', ax + 26, 54, { s: 9, c: C.dim, mono: 1 });
    line(ctx, ax, 64, ax, 84, C.accent, 2);

    dot(ctx, ax, 84, 3.5, C.fg);
    line(ctx, ax, 84, ax + 50, 84, C.fg, 2);
    txt(ctx, 'Vout', ax + 54, 84 - 10, { s: 9.5, c: C.dim });
    txt(ctx, vout.toFixed(2) + 'V', ax + 54, 84 + 6, { s: 13, w: 800, c: over ? C.bad : C.ok, mono: 1 });

    box(ctx, ax - 20, 96, 40, 20, { fill: C.cardFill, stroke: C.accent, r: 4, lw: 1.4 });
    txt(ctx, 'R2', ax, 106, { s: 9.5, c: C.fg, a: 'center' });
    txt(ctx, st.r2 + 'k', ax + 26, 106, { s: 9, c: C.dim, mono: 1 });
    line(ctx, ax, 116, ax, 132, C.accent, 2);

    /* ADC 柱 */
    const bx = W - 54, by = 26, bh = 104;
    box(ctx, bx, by, 26, bh, { fill: C.grid, r: 8 });
    const fillH = Math.max(0, Math.min(1, vout / 3.3)) * bh;
    ctx.save();
    roundRect(ctx, bx, by + bh - fillH, 26, fillH, 8);
    ctx.fillStyle = over ? C.bad : C.accent;
    ctx.fill();
    ctx.restore();
    line(ctx, bx - 4, by + bh - (3.3 / 3.3) * bh, bx + 30, by + bh - (3.3 / 3.3) * bh, C.dim, 1, [3, 3]);
    txt(ctx, '3.3V', bx + 13, by - 8, { s: 9, c: C.dim, a: 'center', mono: 1 });
    txt(ctx, String(code), bx + 13, by + bh + 14, { s: 11, w: 800, a: 'center', mono: 1, c: over ? C.bad : C.fg });

    if (over) {
      txt(ctx, '超量程！会烧 ADC 或钳位', 12, H - 12, { s: 10, c: C.bad });
    } else {
      txt(ctx, `误差 ±${(3.3 / 4095 / 2 * 1000).toFixed(1)}mV`, 12, H - 12, { s: 10, c: C.dim, mono: 1 });
    }
    upd([vout.toFixed(2) + ' V', String(code), (cur * 1000).toFixed(0) + ' µA']);
    nt.style.color = over ? 'var(--bad)' : '';
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   3. MOS 开关
   ============================================================ */
reg('mos', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 168, D);
  const st = { vgs: 0, load: 'led' };
  const c = ctrl(host);
  slider(c, 'Vgs', 0, 12, 0, 0.1, (v) => v.toFixed(1) + 'V', (v) => { st.vgs = v; draw(); });
  seg(c, [{ v: 'led', label: 'LED' }, { v: 'motor', label: '电机' }], 'led', (v) => { st.load = v; draw(); });
  const upd = readout(host, [{ k: '状态', v: '' }, { k: 'Rds(on)', v: '' }, { k: '负载电流', v: '' }]);
  note(host, 'Vgs 低于阈值（约 2V）时 MOS 处于线性区，会发热；开关应用必须给足 10V 或逻辑电平 4.5V。');

  function draw() {
    const { ctx, w: W } = cv;
    cv.clear(C.panel);
    const on = st.vgs >= 4.5;
    const partial = st.vgs >= 1.5 && st.vgs < 4.5;
    const rds = on ? 0.05 : partial ? 0.05 + (4.5 - st.vgs) * 2 : 1e9;
    const vdd = 12;
    const rload = st.load === 'led' ? 470 : 12;
    const i = on ? vdd / (rload + rds) : partial ? vdd / (rload + rds) : 0;

    const gx = 42, dy = 58;
    /* 漏极-源极 */
    line(ctx, gx + 60, 26, gx + 60, 40, C.accent, 2);
    txt(ctx, '12V', gx + 68, 26, { s: 10, c: C.dim, mono: 1 });

    /* 负载 */
    box(ctx, gx + 44, 40, 32, 26, {
      fill: on ? (st.load === 'led' ? 'rgba(255,214,10,.28)' : 'rgba(48,209,88,.2)') : C.grid,
      stroke: C.faint, r: 6
    });
    txt(ctx, st.load === 'led' ? 'LED' : 'M', gx + 60, 53, { s: 10, a: 'center', c: C.fg, w: 700 });
    line(ctx, gx + 60, 66, gx + 60, dy, on ? C.accent : C.faint, 2);

    /* MOS 符号 */
    line(ctx, gx + 34, dy, gx + 60, dy, C.fg, 2); // 栅极引线
    line(ctx, gx + 42, dy - 16, gx + 42, dy + 16, C.fg, 2.5); // 栅极板
    line(ctx, gx + 50, dy - 16, gx + 50, dy + 16, C.fg, 2); // 沟道
    line(ctx, gx + 50, dy - 12, gx + 60, dy - 12, C.fg, 2);
    line(ctx, gx + 50, dy, gx + 60, dy, C.fg, 2);
    line(ctx, gx + 50, dy + 12, gx + 60, dy + 12, C.fg, 2);
    line(ctx, gx + 60, dy + 12, gx + 60, dy + 26, C.fg, 2);
    txt(ctx, 'G', gx + 30, dy + 2, { s: 9, c: C.dim, a: 'right', mono: 1 });
    txt(ctx, 'S', gx + 64, dy + 26, { s: 9, c: C.dim, mono: 1 });

    /* 地 */
    line(ctx, gx + 40, dy + 26, gx + 80, dy + 26, C.dim, 2);
    for (let k = 1; k <= 2; k++) line(ctx, gx + 40 + k * 10, dy + 26 + k * 4, gx + 80 - k * 10, dy + 26 + k * 4, C.dim, 2);

    /* 栅极电压条 */
    const bx = 150, by = 36, bh = 96;
    txt(ctx, 'Vgs', bx + 14, by - 8, { s: 9, c: C.dim, a: 'center', mono: 1 });
    box(ctx, bx, by, 28, bh, { fill: C.grid, r: 8 });
    const hp = Math.min(1, st.vgs / 12) * bh;
    ctx.save(); roundRect(ctx, bx, by + bh - hp, 28, hp, 8);
    ctx.fillStyle = on ? C.ok : partial ? C.warn : C.faint; ctx.fill(); ctx.restore();
    line(ctx, bx - 2, by + bh - (2 / 12) * bh, bx + 30, by + bh - (2 / 12) * bh, C.bad, 1, [2, 2]);
    txt(ctx, 'Vth', bx + 32, by + bh - (2 / 12) * bh, { s: 8.5, c: C.bad, mono: 1 });

    txt(ctx, on ? '完全导通' : partial ? '线性区 · 发热' : '截止', 12, 20, { s: 11, w: 700, c: on ? C.ok : partial ? C.warn : C.dim });
    txt(ctx, `${(i * 1000).toFixed(0)} mA`, 12, 146, { s: 10, c: C.dim, mono: 1 });
    if (on) {
      for (let k = 0; k < 4; k++) {
        const t = (Date.now() / 400 + k / 4) % 1;
        dot(ctx, gx + 60, 40 + t * 22, 2, C.warn);
      }
    }
    upd([on ? '导通' : partial ? '线性区' : '截止', on ? '50mΩ' : partial ? fmtNum(rds) + 'Ω' : '∞', i ? (i * 1000).toFixed(0) + ' mA' : '0']);
  }
  cv.onFit(draw);
  draw();
  const id = setInterval(() => { if (document.body.contains(cv.cv)) draw(); else clearInterval(id); }, 160);
  D.push(() => clearInterval(id));
});

/* ============================================================
   4. LDO vs DCDC
   ============================================================ */
reg('power', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 150, D);
  const st = { vin: 12, vout: 3.3, i: 0.5 };
  const c = ctrl(host);
  slider(c, 'Vin', 5, 24, 12, 0.5, (v) => v.toFixed(1) + 'V', (v) => { st.vin = v; draw(); });
  slider(c, '负载', 0.05, 2, 0.5, 0.05, (v) => (v * 1000).toFixed(0) + 'mA', (v) => { st.i = v; draw(); });
  const upd = readout(host, [{ k: 'LDO 效率', v: '' }, { k: 'DCDC 效率', v: '' }, { k: 'LDO 发热', v: '' }]);

  function draw() {
    const { ctx, w: W } = cv;
    cv.clear(C.panel);
    const vout = 3.3;
    const ldoEff = vout / st.vin;
    const dcdcEff = 0.9;
    const loss = (st.vin - vout) * st.i;

    const barX = 60, barW = W - 60 - 52;
    const rows = [
      { name: 'LDO', eff: ldoEff, color: C.warn, y: 24 },
      { name: 'DCDC', eff: dcdcEff, color: C.ok, y: 62 }
    ];
    rows.forEach((r) => {
      txt(ctx, r.name, 12, r.y + 14, { s: 11, w: 700, c: C.fg });
      box(ctx, barX, r.y, barW, 28, { fill: C.grid, r: 9 });
      const w = Math.max(3, r.eff * barW);
      ctx.save(); roundRect(ctx, barX, r.y, w, 28, 9);
      ctx.fillStyle = r.color; ctx.globalAlpha = 0.85; ctx.fill(); ctx.restore();
      txt(ctx, (r.eff * 100).toFixed(0) + '%', barX + barW + 8, r.y + 14, { s: 12, w: 800, mono: 1, c: r.color });
      txt(ctx, r.name === 'LDO' ? '压差全变热' : '开关损耗小', barX + 10, r.y + 14, {
        s: 9.5, c: 'rgba(0,0,0,.55)', w: 600
      });
    });

    txt(ctx, `损耗 ${loss.toFixed(2)} W`, 12, 116, { s: 10.5, c: loss > 1 ? C.bad : C.dim, mono: 1, w: 700 });
    if (loss > 1) {
      txt(ctx, '需要散热片', 12, 132, { s: 9.5, c: C.bad });
      /* 温度计 */
      const tx = W - 26;
      box(ctx, tx, 100, 10, 30, { fill: C.grid, r: 5 });
      ctx.save(); roundRect(ctx, tx, 100 + 30 - Math.min(30, loss * 12), 10, Math.min(30, loss * 12), 5);
      ctx.fillStyle = C.bad; ctx.fill(); ctx.restore();
    }
    upd([(ldoEff * 100).toFixed(0) + '%', '90%', loss.toFixed(2) + ' W']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   5. RC 低通
   ============================================================ */
reg('rc', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 170, D);
  const st = { r: 10, c: 100 };
  const c = ctrl(host);
  slider(c, 'R', 0.1, 100, 10, 0.1, (v) => v + 'kΩ', (v) => { st.r = v; draw(); });
  slider(c, 'C', 1, 1000, 100, 1, (v) => v + 'nF', (v) => { st.c = v; draw(); });
  const upd = readout(host, [{ k: '截止频率', v: '' }, { k: '1kHz 衰减', v: '' }, { k: '时间常数 τ', v: '' }]);

  function draw() {
    const { ctx, w: W, h: H } = cv;
    cv.clear(C.panel);
    const R = st.r * 1000, Cc = st.c * 1e-9;
    const fc = 1 / (2 * Math.PI * R * Cc);
    const tau = R * Cc;

    const L = 34, Rr = W - 12, T = 16, B = H - 26;
    const fmin = 10, fmax = 1e6;
    const xOf = (f) => L + ((Math.log10(f) - Math.log10(fmin)) / (Math.log10(fmax) - Math.log10(fmin))) * (Rr - L);
    const yOf = (db) => B - ((db + 60) / 65) * (B - T);

    /* 网格 */
    [10, 100, 1000, 1e4, 1e5, 1e6].forEach((f) => {
      const x = xOf(f);
      line(ctx, x, T, x, B, C.grid, 1);
      txt(ctx, f >= 1000 ? f / 1000 + 'k' : String(f), x, B + 10, { s: 8.5, c: C.dim, a: 'center', mono: 1 });
    });
    [0, -20, -40, -60].forEach((db) => {
      const y = yOf(db);
      line(ctx, L, y, Rr, y, C.grid, 1);
      txt(ctx, db + 'dB', L - 4, y, { s: 8, c: C.dim, a: 'right', mono: 1 });
    });

    /* 曲线 */
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const f = fmin * Math.pow(fmax / fmin, i / 120);
      const h = 1 / Math.sqrt(1 + Math.pow(f / fc, 2));
      const db = 20 * Math.log10(h);
      const x = xOf(f), y = yOf(Math.max(-60, db));
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    /* 截止点 */
    const fx = xOf(Math.min(fmax, Math.max(fmin, fc)));
    line(ctx, fx, T, fx, B, C.bad, 1.2, [4, 3]);
    dot(ctx, fx, yOf(-3), 3.6, C.bad);
    txt(ctx, 'fc', fx + 4, T + 8, { s: 9, c: C.bad, mono: 1, w: 700 });

    const att = 20 * Math.log10(1 / Math.sqrt(1 + Math.pow(1000 / fc, 2)));
    upd([fmtNum(fc) + ' Hz', att.toFixed(1) + ' dB', fmtNum(tau * 1e6, 1) + ' µs']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   6. 时钟树
   ============================================================ */
reg('clock', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 190, D);
  const st = { n: 9 };
  const c = ctrl(host);
  slider(c, 'PLLN', 4, 16, 9, 1, (v) => '×' + v, (v) => { st.n = v; draw(); });
  const upd = readout(host, [{ k: 'SYSCLK', v: '' }, { k: 'APB1', v: '' }, { k: 'TIM2', v: '' }]);

  function draw() {
    const { ctx, w: W, h: H } = cv;
    cv.clear(C.panel);
    const hse = 8;
    const sys = hse * st.n;
    const apb1 = sys / 2, apb2 = sys, tim = sys; // 分频不为1时定时器翻倍

    const nodes = [
      { x: 10, y: 22, w: 62, h: 34, t: 'HSE', s: hse + 'M', c: C.dim },
      { x: 92, y: 22, w: 62, h: 34, t: 'PLL', s: st.n + '倍频', c: C.accent },
      { x: 176, y: 22, w: 66, h: 34, t: 'SYSCLK', s: sys + 'M', c: C.accent },
      { x: 258, y: 22, w: 60, h: 34, t: 'AHB /1', s: sys + 'M', c: C.dim },
      { x: 40, y: 108, w: 74, h: 34, t: 'APB1 /2', s: apb1 + 'M', c: C.warn },
      { x: 150, y: 108, w: 74, h: 34, t: 'APB2 /1', s: apb2 + 'M', c: C.dim },
      { x: 40, y: 158, w: 74, h: 26, t: 'TIM 时钟', s: tim + 'M', c: C.ok },
      { x: 260, y: 108, w: 58, h: 34, t: 'ADC', s: (sys / 6).toFixed(1) + 'M', c: C.dim }
    ];
    if (W < 330) {
      nodes.forEach((n) => { if (n.x + n.w > W - 4) n.x = W - 4 - n.w; });
    }

    const get = (i) => nodes[i];
    /* 连线 */
    const links = [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [4, 6], [5, 7]];
    links.forEach(([a, b]) => {
      const A = get(a), Bn = get(b);
      const x1 = A.x + A.w, y1 = A.y + A.h / 2;
      const x2 = Bn.x, y2 = Bn.y + Bn.h / 2;
      ctx.beginPath();
      ctx.strokeStyle = C.faint;
      ctx.lineWidth = 1.5;
      if (Math.abs(y1 - y2) < 2) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
      else if (a === 3) {
        const mx = x1 + 12;
        ctx.moveTo(x1, y1);
        ctx.lineTo(mx, y1);
        ctx.lineTo(mx, y2);
        ctx.lineTo(x2, y2);
      } else {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    });

    nodes.forEach((n) => {
      const active = n.t === 'SYSCLK' || n.t === 'PLL' || n.t === 'TIM 时钟';
      box(ctx, n.x, n.y, n.w, n.h, {
        fill: active ? C.cardFill : C.panel,
        stroke: active ? n.c : C.faint,
        r: 9,
        lw: active ? 1.6 : 1
      });
      txt(ctx, n.t, n.x + n.w / 2, n.y + n.h / 2 - 7, { s: 8.6, c: C.dim, a: 'center' });
      txt(ctx, n.s, n.x + n.w / 2, n.y + n.h / 2 + 7, {
        s: 11.5, w: 800, a: 'center', mono: 1, c: active ? n.c : C.fg
      });
    });

    /* 提示 */
    txt(ctx, sys > 72 ? '⚠ 超过 72M 需看 Flash 等待周期' : 'AHB 不分频，APB1 最高 36M', 12, H - 8, {
      s: 9.5, c: sys > 72 ? C.bad : C.dim
    });
    upd([sys + ' MHz', apb1 + ' MHz', tim + ' MHz']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   7. PWM
   ============================================================ */
reg('pwm', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 160, D);
  const st = { duty: 50, f: 1000 };
  const c = ctrl(host);
  slider(c, '占空比', 0, 100, 50, 1, (v) => v + '%', (v) => { st.duty = v; draw(); });
  slider(c, '频率', 100, 20000, 1000, 100, (v) => (v >= 1000 ? v / 1000 + 'kHz' : v + 'Hz'), (v) => { st.f = v; draw(); });
  const upd = readout(host, [{ k: '高电平时间', v: '' }, { k: '平均电压', v: '' }, { k: '周期', v: '' }]);

  function draw() {
    const { ctx, w: W, h: H } = cv;
    cv.clear(C.panel);
    const period = 1e6 / st.f; // us
    const ton = (period * st.duty) / 100;
    const L = 12, Rr = W - 12, top = 30, bot = 96, span = Rr - L;
    const cycles = 3;

    txt(ctx, `${period.toFixed(0)} µs`, W - 12, 14, { s: 9.5, c: C.dim, a: 'right', mono: 1 });

    ctx.beginPath();
    ctx.strokeStyle = C.faint;
    ctx.lineWidth = 1;
    ctx.moveTo(L, bot); ctx.lineTo(Rr, bot);
    ctx.moveTo(L, top); ctx.lineTo(Rr, top);
    ctx.stroke();

    const cw = span / cycles;
    ctx.beginPath();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2.2;
    for (let i = 0; i < cycles; i++) {
      const x0 = L + i * cw;
      const hi = cw * (st.duty / 100);
      ctx.moveTo(x0, bot);
      ctx.lineTo(x0, top);
      ctx.lineTo(x0 + hi, top);
      ctx.lineTo(x0 + hi, bot);
      if (i === cycles - 1) ctx.lineTo(x0 + cw, bot);
      else ctx.lineTo(x0 + cw, bot);
    }
    ctx.stroke();

    /* 占空比阴影 */
    for (let i = 0; i < cycles; i++) {
      const x0 = L + i * cw;
      ctx.fillStyle = C.accent;
      ctx.globalAlpha = 0.1;
      ctx.fillRect(x0, top, cw * (st.duty / 100), bot - top);
      ctx.globalAlpha = 1;
    }

    /* 平均线 */
    const avg = (3.3 * st.duty) / 100;
    const yAvg = bot - (avg / 3.3) * (bot - top);
    line(ctx, L, yAvg, Rr, yAvg, C.warn, 1.4, [4, 3]);
    txt(ctx, '平均 ' + avg.toFixed(2) + 'V', L + 2, yAvg - 8, { s: 9, c: C.warn, mono: 1 });

    /* LED 亮度 */
    const bx = W / 2 - 16, by = H - 44;
    const g = ctx.createRadialGradient(W / 2, by + 14, 2, W / 2, by + 14, 26);
    const a = 0.15 + (st.duty / 100) * 0.85;
    g.addColorStop(0, `rgba(255,214,10,${a})`);
    g.addColorStop(1, 'rgba(255,214,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(W / 2, by + 14, 26, 0, Math.PI * 2); ctx.fill();
    dot(ctx, W / 2, by + 14, 7, `rgba(255,214,10,${a})`);

    txt(ctx, `Ton ${ton.toFixed(0)}µs`, 12, H - 10, { s: 9.5, c: C.dim, mono: 1 });
    txt(ctx, `Ton/T ${(st.duty / 100).toFixed(2)}`, W - 12, H - 10, { s: 9.5, c: C.dim, a: 'right', mono: 1 });
    upd([ton.toFixed(0) + ' µs', avg.toFixed(2) + ' V', period.toFixed(0) + ' µs']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   8. ADC 量化
   ============================================================ */
reg('adc', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 168, D);
  const st = { bits: 12, fs: 2000 };
  const c = ctrl(host);
  seg(c, [{ v: '8', label: '8 位' }, { v: '10', label: '10 位' }, { v: '12', label: '12 位' }], '12', (v) => { st.bits = +v; draw(); });
  slider(c, '采样率', 200, 8000, 2000, 100, (v) => v + 'Hz', (v) => { st.fs = v; draw(); });
  const upd = readout(host, [{ k: 'LSB', v: '' }, { k: '量化误差', v: '' }, { k: '码值范围', v: '' }]);

  function draw() {
    const { ctx, w: W, h: H } = cv;
    cv.clear(C.panel);
    const L = 26, Rr = W - 12, top = 26, bot = 116;
    const N = st.bits;
    const LSB = 3.3 / Math.pow(2, N);

    /* 网格 */
    for (let i = 0; i <= 4; i++) {
      const y = top + ((bot - top) * i) / 4;
      line(ctx, L, y, Rr, y, C.grid, 1);
      txt(ctx, ((3.3 * (4 - i)) / 4).toFixed(1), L - 4, y, { s: 8, c: C.dim, a: 'right', mono: 1 });
    }
    ctx.translate(0, 0);

    /* 模拟信号 */
    const f = 2;
    ctx.beginPath();
    for (let x = 0; x <= Rr - L; x++) {
      const t = x / (Rr - L);
      const v = 1.65 + 1.5 * Math.sin(t * Math.PI * 4 * f * 0.25);
      const y = bot - (v / 3.3) * (bot - top);
      x ? ctx.lineTo(L + x, y) : ctx.moveTo(L, y);
    }
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    /* 采样点 */
    const samples = 26;
    const stepPx = (Rr - L) / samples;
    ctx.beginPath();
    for (let i = 0; i < samples; i++) {
      const x = L + i * stepPx;
      const t = i / samples;
      const v = Math.max(0, Math.min(3.3, 1.65 + 1.5 * Math.sin(t * Math.PI * 4 * f * 0.25)));
      const q = Math.round(v / LSB) * LSB;
      const y = bot - (q / 3.3) * (bot - top);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = C.warn;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    for (let i = 0; i < samples; i++) {
      const x = L + i * stepPx;
      const t = i / samples;
      const v = Math.max(0, Math.min(3.3, 1.65 + 1.5 * Math.sin(t * Math.PI * 4 * f * 0.25)));
      const q = Math.round(v / LSB) * LSB;
      dot(ctx, x, bot - (q / 3.3) * (bot - top), 1.8, C.warn);
    }

    txt(ctx, '模拟信号', L + 2, top - 10, { s: 9, c: C.accent });
    txt(ctx, '采样量化后', L + 56, top - 10, { s: 9, c: C.warn });
    txt(ctx, `${N} 位 · ${Math.pow(2, N)} 级 · LSB ${(LSB * 1000).toFixed(2)}mV`, W - 12, H - 10, {
      s: 9.5, c: C.dim, a: 'right', mono: 1
    });
    upd([(LSB * 1000).toFixed(2) + ' mV', '±' + (LSB * 500).toFixed(2) + ' mV', '0 ~ ' + (Math.pow(2, N) - 1)]);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   9. DMA
   ============================================================ */
reg('dma', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 150, D);
  const st = { on: true, bytes: 8 };
  const c = ctrl(host);
  seg(c, [{ v: '1', label: '用 DMA' }, { v: '0', label: '纯 CPU' }], '1', (v) => { st.on = v === '1'; draw(); });
  slider(c, '数据量', 1, 16, 8, 1, (v) => v + ' 字节', (v) => { st.bytes = v; draw(); });
  const upd = readout(host, [{ k: 'CPU 占用', v: '' }, { k: '搬运耗时', v: '' }, { k: '丢包风险', v: '' }]);

  function draw() {
    const { ctx, w: W } = cv;
    cv.clear(C.panel);
    const L = 62, Rr = W - 12;
    const rowY = [30, 66, 102];
    const labels = ['外设', 'DMA', 'CPU'];

    labels.forEach((l, i) => {
      txt(ctx, l, 12, rowY[i] + 9, { s: 10, w: 700, c: i === 2 ? C.fg : C.dim });
      line(ctx, L, rowY[i] + 9, Rr, rowY[i] + 9, C.grid, 1);
    });

    const unit = (Rr - L) / (st.bytes + 2);
    const dmaActive = st.on;
    for (let i = 0; i < st.bytes; i++) {
      const x = L + i * unit + 2;
      /* 外设产出 */
      box(ctx, x, rowY[0], unit - 4, 18, { fill: C.accent, r: 4 });
      if (dmaActive) {
        box(ctx, x, rowY[1], unit - 4, 18, { fill: C.purple, r: 4 });
        box(ctx, x, rowY[2], unit - 4, 18, { fill: 'rgba(48,209,88,.35)', r: 4 });
      } else {
        box(ctx, x, rowY[2], unit - 4, 18, { fill: C.ok, r: 4 });
        /* CPU 被占用：DMA 行留空 */
      }
    }

    txt(ctx, dmaActive ? 'DMA 后台搬运，CPU 继续跑别的任务' : 'CPU 逐字节搬运，期间干不了别的', 12, 136, {
      s: 9.5, c: dmaActive ? C.purple : C.warn
    });
    const usage = dmaActive ? Math.round((st.bytes * 2) / 100) : Math.min(100, st.bytes * 12);
    upd([usage + '%', (st.bytes * 0.8).toFixed(1) + ' µs', dmaActive ? '低' : st.bytes > 8 ? '高' : '中']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   10. NVIC 中断嵌套
   ============================================================ */
reg('irq', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 170, D);
  const st = { play: 0 };
  const c = ctrl(host);
  const btnRow = document.createElement('div');
  btnRow.className = 'ctrl-row';
  btnRow.innerHTML = `<label>时序</label><button class="btn sm" data-p>▶ 播放</button><button class="btn sm" data-r>重播</button>`;
  c.appendChild(btnRow);

  const L = 44, Rr = 0;
  const segs = [
    { row: 2, s: 0, e: 10, c: C.dim, t: '主循环' },
    { row: 1, s: 2, e: 8, c: C.warn, t: 'IRQ_A 优先级 1' },
    { row: 0, s: 4, e: 6, c: C.bad, t: 'IRQ_B 优先级 0' }
  ];
  const T = 14;

  function draw(t) {
    const { ctx, w: W, h: H } = cv;
    cv.clear(C.panel);
    const right = W - 10;
    const rows = [16, 62, 108];
    const names = ['IRQ_B', 'IRQ_A', '主循环'];

    /* 时间轴 */
    for (let i = 0; i <= 4; i++) {
      const x = L + ((right - L) * i) / 4;
      line(ctx, x, 8, x, 144, C.grid, 1);
      txt(ctx, (T * i / 4).toFixed(0) + 'ms', x, 154, { s: 8.5, c: C.dim, a: 'center', mono: 1 });
    }
    names.forEach((n, i) => txt(ctx, n, L - 6, rows[i] + 14, { s: 9, c: C.dim, a: 'right', mono: 1 }));

    const xOf = (ms) => L + ((right - L) * ms) / T;
    segs.forEach((sg) => {
      const x1 = xOf(sg.s), x2 = xOf(sg.e);
      box(ctx, x1, rows[sg.row], Math.max(3, x2 - x1), 28, { fill: sg.c, r: 6 });
      if (x2 - x1 > 52) txt(ctx, sg.t, x1 + 6, rows[sg.row] + 14, { s: 8.5, c: '#fff', w: 700 });
    });

    /* 抢占标注 */
    const px = xOf(4);
    line(ctx, px, 20, px, 100, C.bad, 1, [3, 3]);
    txt(ctx, '抢占', px + 4, 34, { s: 8.5, c: C.bad, mono: 1 });

    if (t != null) {
      const ph = xOf(t);
      line(ctx, ph, 4, ph, 148, C.accent, 1.5);
      dot(ctx, ph, 8, 3, C.accent);
    }
  }

  cv.onFit(() => draw(st.play));

  let raf = null;
  function play() {
    st.play = 0;
    const t0 = performance.now();
    cancelAnimationFrame(raf);
    const tick = (now) => {
      const el = (now - t0) / 420;
      st.play = Math.min(T, el);
      draw(st.play);
      if (st.play < T) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  btnRow.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-p')) play();
    if (e.target.hasAttribute('data-r')) { cancelAnimationFrame(raf); st.play = 0; draw(null); }
  });
  D.push(() => cancelAnimationFrame(raf));
  draw(null);
  note(host, '低优先级中断执行中被高优先级打断，B 返回后 A 继续，这就是嵌套。');
});

/* ============================================================
   11. 低功耗模式
   ============================================================ */
reg('lowpower', (host, D) => {
  const C = palette(host);
  const modes = [
    { n: 'Run', i: 20, unit: 'mA', d: '全速运行，所有时钟打开', w: '—', keep: '全部保持' },
    { n: 'Sleep', i: 5, unit: 'mA', d: '只停内核时钟，外设继续跑', w: '任意中断', keep: '全部保持' },
    { n: 'Stop', i: 20, unit: 'µA', d: '1.8V 域断电，SRAM 保持，时钟停振', w: 'EXTI / RTC / 唤醒脚', keep: 'SRAM + 寄存器' },
    { n: 'Standby', i: 2, unit: 'µA', d: '除备份域全断电，接近完全关机', w: 'WKUP 脚 / RTC / 看门狗', keep: '仅备份域' }
  ];
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:7px';
  host.appendChild(wrap);

  const detail = document.createElement('div');
  detail.className = 'readout';
  detail.style.marginTop = '10px';
  host.appendChild(detail);

  let sel = 1;
  const rows = modes.map((m, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:9px;cursor:pointer;padding:3px 0';
    const label = document.createElement('div');
    label.style.cssText = 'flex:0 0 58px;font-size:12px;font-weight:700';
    label.textContent = m.n;
    const track = document.createElement('div');
    track.style.cssText = 'flex:1;height:22px;border-radius:7px;background:var(--sep);overflow:hidden;position:relative';
    const bar = document.createElement('i');
    const pct = Math.max(4, (Math.log10(m.i * (m.unit === 'mA' ? 1000 : 1)) / Math.log10(20000)) * 100);
    bar.style.cssText = `display:block;height:100%;width:${pct}%;border-radius:7px;transition:width .5s var(--ease)`;
    track.appendChild(bar);
    const val = document.createElement('div');
    val.style.cssText = 'flex:0 0 54px;text-align:right;font-family:var(--mono);font-size:11px;font-weight:700';
    val.textContent = m.i + ' ' + m.unit;
    row.append(label, track, val);
    row.addEventListener('click', () => { sel = i; paint(); });
    wrap.appendChild(row);
    return { row, bar, m };
  });

  function paint() {
    rows.forEach((r, i) => {
      const on = i === sel;
      r.bar.style.background = on ? C.accent : 'rgba(128,128,128,.35)';
      r.bar.style.opacity = on ? 1 : 0.6;
      r.row.style.opacity = on ? 1 : 0.62;
      r.row.querySelector('div').style.color = on ? 'var(--accent)' : 'var(--label)';
    });
    const m = modes[sel];
    detail.innerHTML = `<div style="grid-column:1/-1"><b style="font-size:13px">${m.d}</b><span>唤醒源：${m.w} · ${m.keep}</span></div>`;
  }
  paint();
});

/* ============================================================
   12. 看门狗
   ============================================================ */
reg('watchdog', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 150, D);
  const st = { feed: 6, timeout: 10 };
  const c = ctrl(host);
  slider(c, '喂狗周期', 1, 20, 6, 1, (v) => v + 'ms', (v) => { st.feed = v; draw(); });
  slider(c, '超时时间', 5, 40, 10, 1, (v) => v + 'ms', (v) => { st.timeout = v; draw(); });
  const upd = readout(host, [{ k: '结果', v: '' }, { k: '喂狗次数', v: '' }, { k: '重置风险', v: '' }]);

  function draw() {
    const { ctx, w: W, h: H } = cv;
    cv.clear(C.panel);
    const L = 34, Rr = W - 12, top = 24, bot = 92;
    const totalMs = st.timeout * 3;

    line(ctx, L, bot + 6, Rr, bot + 6, C.faint, 1);
    txt(ctx, `0`, L, bot + 18, { s: 8.5, c: C.dim, a: 'center', mono: 1 });
    txt(ctx, `${totalMs}ms`, Rr, bot + 18, { s: 8.5, c: C.dim, a: 'right', mono: 1 });

    /* 超时台阶 */
    const xOf = (ms) => L + ((Rr - L) * ms) / totalMs;
    const yOf = (v) => bot - v * (bot - top);

    ctx.beginPath();
    ctx.strokeStyle = C.faint;
    ctx.setLineDash([3, 3]);
    for (let ms = st.timeout; ms < totalMs; ms += st.timeout) {
      ctx.moveTo(xOf(ms), top); ctx.lineTo(xOf(ms), bot);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    /* 计数器锯齿 */
    ctx.beginPath();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2;
    let t = 0, first = true;
    while (t <= totalMs) {
      const x0 = xOf(t);
      ctx.moveTo(x0, bot);
      const nextFeed = Math.min(totalMs, t + st.feed);
      if (nextFeed <= t) break;
      const frac = Math.min(1, (nextFeed - t) / st.timeout);
      ctx.lineTo(xOf(nextFeed), yOf(frac));
      if (frac >= 1) break;
      t = nextFeed;
      if (t < totalMs) { ctx.lineTo(xOf(t), bot); first = false; }
    }
    ctx.stroke();

    /* 喂狗标记 */
    let feeds = 0;
    for (let ms = st.feed; ms < totalMs; ms += st.feed) {
      feeds++;
      dot(ctx, xOf(ms), bot, 2.5, C.ok);
    }

    const ok = st.feed < st.timeout;
    if (!ok) {
      const rx = xOf(st.timeout);
      ctx.strokeStyle = C.bad; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(rx - 6, top - 2); ctx.lineTo(rx + 6, top + 10);
      ctx.moveTo(rx + 6, top - 2); ctx.lineTo(rx - 6, top + 10);
      ctx.stroke();
      txt(ctx, '复位', rx + 10, top + 4, { s: 9, c: C.bad, mono: 1 });
    }

    txt(ctx, ok ? '正常喂狗，计数器不会溢出' : '喂狗周期 ≥ 超时，一定会复位', 12, 14, { s: 9.5, c: ok ? C.ok : C.bad });
    upd([ok ? '正常' : '反复复位', String(feeds), ok ? '无' : '100%']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   13. UART 帧
   ============================================================ */
reg('uart', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 178, D);
  const st = { baud: 115200, data: 8, parity: 'none', stop: 1, byte: 0x55 };
  const c = ctrl(host);
  seg(c, [{ v: '9600', label: '9600' }, { v: '115200', label: '115200' }, { v: '921600', label: '921600' }], '115200',
    (v) => { st.baud = +v; draw(); });
  slider(c, '数据', 0, 255, 85, 1, (v) => '0x' + v.toString(16).toUpperCase().padStart(2, '0'),
    (v) => { st.byte = v; draw(); });
  const upd = readout(host, [{ k: '位时间', v: '' }, { k: '一帧', v: '' }, { k: '吞吐', v: '' }]);

  function draw() {
    const { ctx, w: W } = cv;
    cv.clear(C.panel);
    const bits = [];
    bits.push({ v: 0, n: '起始', c: C.warn });
    for (let i = 0; i < st.data; i++) bits.push({ v: (st.byte >> i) & 1, n: 'D' + i, c: C.accent });
    let ones = bits.filter((b) => b.v).length;
    if (st.parity === 'even') bits.push({ v: ones % 2, n: 'P', c: C.purple, hidden: st.parity === 'none' });
    for (let i = 0; i < st.stop; i++) bits.push({ v: 1, n: '停止', c: C.ok });

    const L = 12, Rr = W - 12;
    const bw = (Rr - L) / bits.length;
    const hiY = 44, loY = 100;

    /* 空闲线 */
    line(ctx, L, hiY, L + bw * 0.4, hiY, C.fg, 2.2);
    let x = L + bw * 0.4;
    const xs = [x];

    bits.forEach((b, i) => {
      const y = b.v ? hiY : loY;
      const prevY = i === 0 ? hiY : bits[i - 1].v ? hiY : loY;
      if (prevY !== y) { line(ctx, x, prevY, x, y, C.fg, 2.2); }
      line(ctx, x, y, x + bw, y, b.v ? C.fg : C.warn, 2.2);
      xs.push(x + bw);

      /* 采样点 */
      dot(ctx, x + bw / 2, y, 2.6, b.c);
      txt(ctx, String(b.v), x + bw / 2, y - 12, { s: 10, w: 800, a: 'center', mono: 1, c: b.c });
      txt(ctx, b.n, x + bw / 2, loY + 34, { s: 8.2, c: C.dim, a: 'center', mono: 1 });
      x += bw;
    });

    line(ctx, x, hiY, x + bw * 0.3, hiY, C.fg, 2.2);
    line(ctx, L, hiY, L, loY + 6, C.faint, 1, [2, 3]);

    const bitUs = 1e6 / st.baud;
    txt(ctx, `1 位 = ${bitUs.toFixed(2)} µs`, 12, 16, { s: 9.5, c: C.dim, mono: 1 });
    txt(ctx, `${bits.length} 位/帧`, W - 12, 16, { s: 9.5, c: C.dim, a: 'right', mono: 1 });

    const frameUs = bitUs * bits.length;
    const thru = (st.baud / bits.length / 10).toFixed(1);
    upd([bitUs.toFixed(2) + ' µs', frameUs.toFixed(0) + ' µs', thru + ' KB/s']);
  }
  cv.onFit(draw);
  draw();
  note(host, '接收方在起始位下降沿同步，之后每个位周期中点采样；两端时钟误差合计要小于 5%。');
});

/* ============================================================
   14. I2C 时序
   ============================================================ */
reg('i2c', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 190, D);
  const st = { step: 0 };
  const steps = ['起始', '地址 0x50+W', 'ACK', '数据 0x3C', 'ACK', '停止'];
  const c = ctrl(host);
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  row.innerHTML = `<label>时序</label><button class="btn sm" data-n>下一步 ›</button><button class="btn sm" data-r>重播</button>`;
  c.appendChild(row);
  const tip = note(host, '');

  const SCL = 52, SDA = 108;
  const bits = [
    { sda: [1, 1], scl: 1, n: '空闲' },
    { sda: [1, 0], scl: 1, n: 'START' },
    { sda: [1, 1, 0, 1, 0, 0, 0, 0], scl: 8, n: '地址' },
    { sda: [0], scl: 1, n: 'ACK' },
    { sda: [0, 0, 1, 1, 1, 1, 0, 0], scl: 8, n: '数据' },
    { sda: [0], scl: 1, n: 'ACK' },
    { sda: [0, 1], scl: 1, n: 'STOP' }
  ];

  function draw() {
    const { ctx, w: W, h: H } = cv;
    cv.clear(C.panel);
    const L = 34, Rr = W - 10;
    const total = bits.reduce((a, b) => a + Math.max(b.sda.length, 1), 0);
    const unit = (Rr - L) / Math.max(1, total);
    let x = L;

    txt(ctx, 'SCL', L - 6, SCL, { s: 9, c: C.dim, mono: 1, a: 'right' });
    txt(ctx, 'SDA', L - 6, SDA, { s: 9, c: C.dim, mono: 1, a: 'right' });

    bits.forEach((seg, si) => {
      const active = si <= st.step;
      const w = Math.max(seg.sda.length, 1) * unit;
      const alpha = active ? 1 : 0.22;

      ctx.globalAlpha = alpha;
      /* SCL */
      if (seg.n === 'START') line(ctx, x, SCL, x + w, SCL, C.accent, 2);
      else {
        const half = w / 2;
        line(ctx, x, SCL, x + half, SCL, C.accent, 2);
        line(ctx, x + half, SCL, x + half, SCL + 22, C.accent, 2);
        line(ctx, x + half, SCL + 22, x + w, SCL + 22, C.accent, 2);
        line(ctx, x + w, SCL + 22, x + w, SCL, C.accent, 2);
      }

      /* SDA */
      let px = x;
      const sw = w / seg.sda.length;
      seg.sda.forEach((v, i) => {
        const y = v ? SDA - 22 : SDA;
        if (i > 0) {
          const py = seg.sda[i - 1] ? SDA - 22 : SDA;
          if (py !== y) line(ctx, px, py, px, y, C.purple, 2);
        }
        line(ctx, px, y, px + sw, y, C.purple, 2);
        px += sw;
      });

      txt(ctx, seg.n, x + w / 2, 150, { s: 8, c: active ? C.dim : C.faint, a: 'center' });
      x += w;
    });

    /* START/STOP 标注 */
    ctx.globalAlpha = 1;
    const sx = L + unit * 0.6;
    line(ctx, sx, SDA - 40, sx, SDA + 6, C.warn, 1, [3, 3]);
    txt(ctx, 'START', sx + 3, SDA - 44, { s: 8.5, c: C.warn, mono: 1 });

    txt(ctx, st.step >= 1 ? 'SDA 在 SCL 高电平时拉低 = 起始' : '点击「下一步」逐段看', 12, 172, {
      s: 9, c: C.dim
    });
    tip.textContent = st.step === 0 ? '起始条件：SCL 高电平期间 SDA 下降。'
      : st.step === 1 ? '发 7 位地址 + 读写位，地址 0x50 左移一位后为 0xA0。'
      : st.step === 2 ? '从机拉低 SDA 应答，说明地址命中。'
      : st.step === 3 ? '传输 1 字节，高位先发，每字节后跟 1 位 ACK。'
      : st.step === 4 ? '收到 ACK 后继续发下一字节。'
      : '停止条件：SCL 高电平期间 SDA 上升。总线释放。';
  }

  cv.onFit(draw);
  row.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-n')) { st.step = Math.min(6, st.step + 1); draw(); }
    if (e.target.hasAttribute('data-r')) { st.step = 0; draw(); }
  });
  draw();
});

/* ============================================================
   15. SPI 四种模式
   ============================================================ */
reg('spi', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 180, D);
  const st = { cpol: 0, cpha: 0 };
  const c = ctrl(host);
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  row.innerHTML = `<label>模式</label><div class="seg" data-cpol><button data-v="0" class="on">CPOL=0</button><button data-v="1">CPOL=1</button></div>
  <div class="seg" data-cpha><button data-v="0" class="on">CPHA=0</button><button data-v="1">CPHA=1</button></div>`;
  c.appendChild(row);
  const upd = readout(host, [{ k: '模式', v: '' }, { k: '采样沿', v: '' }, { k: '空闲电平', v: '' }]);

  row.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const grp = b.closest('[data-cpol]') || b.closest('[data-cpha]');
    grp.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    if (grp.hasAttribute('data-cpol')) st.cpol = +b.dataset.v;
    else st.cpha = +b.dataset.v;
    draw();
  });

  function draw() {
    const { ctx, w: W } = cv;
    cv.clear(C.panel);
    const L = 34, Rr = W - 12;
    const data = [1, 0, 1, 0, 0, 1, 1, 0]; // 0xA6 高位先
    const n = data.length;
    const unit = (Rr - L) / (n + 1);
    const idle = st.cpol ? 1 : 0;
    const hiY = 46, loY = 46 + 26;
    const sckHi = 96, sckLo = 122;
    const yOf = (v, hi, lo) => (v ? hi : lo);

    txt(ctx, 'SCLK', L - 6, 109, { s: 9, c: C.dim, mono: 1, a: 'right' });
    txt(ctx, 'MOSI', L - 6, 59, { s: 9, c: C.dim, mono: 1, a: 'right' });
    txt(ctx, '采样', L - 6, 150, { s: 9, c: C.dim, mono: 1, a: 'right' });

    for (let i = 0; i < n; i++) {
      const x0 = L + i * unit;
      const edgeA = x0 + unit * 0.25;
      const edgeB = x0 + unit * 0.75;

      /* SCLK 一个周期 */
      const startV = st.cpol, midV = st.cpol ? 0 : 1;
      line(ctx, x0, yOf(startV, sckHi, sckLo), edgeA, yOf(startV, sckHi, sckLo), C.accent, 2);
      line(ctx, edgeA, yOf(startV, sckHi, sckLo), edgeA, yOf(midV, sckHi, sckLo), C.accent, 2);
      line(ctx, edgeA, yOf(midV, sckHi, sckLo), edgeB, yOf(midV, sckHi, sckLo), C.accent, 2);
      line(ctx, edgeB, yOf(midV, sckHi, sckLo), edgeB, yOf(startV, sckHi, sckLo), C.accent, 2);

      /* MOSI */
      const y = yOf(data[i], hiY, loY);
      line(ctx, x0, y, x0 + unit, y, C.purple, 2);

      /* 采样点 */
      const sampleEdge = st.cpha === 0 ? edgeA : edgeB;
      dot(ctx, sampleEdge, y, 3, C.ok);
      line(ctx, sampleEdge, y - 26, sampleEdge, 156, C.ok, 1, [2, 3]);
    }
    line(ctx, L + n * unit, yOf(idle, sckHi, sckLo), Rr, yOf(idle, sckHi, sckLo), C.accent, 2);

    const mode = st.cpol * 2 + st.cpha;
    txt(ctx, `模式 ${mode}`, W - 12, 14, { s: 12, w: 800, c: C.accent, a: 'right', mono: 1 });
    txt(ctx, '绿色 = 采样沿', 12, 172, { s: 9, c: C.dim });
    upd(['Mode ' + mode, st.cpha === 0 ? '第 1 个边沿' : '第 2 个边沿', st.cpol ? '高' : '低']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   16. CAN 仲裁
   ============================================================ */
reg('can', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 172, D);
  const st = { bit: 0, playing: false };
  const c = ctrl(host);
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  row.innerHTML = `<label>仲裁</label><button class="btn sm" data-p>▶ 播放</button><button class="btn sm" data-r>重置</button>`;
  c.appendChild(row);
  note(host, 'ID 越小优先级越高。显性位 0 会压过隐性位 1，先出现差异的节点继续发，另一个立刻退出发送。');

  const A = 0x123, B = 0x456;
  const bitsOf = (id) => id.toString(2).padStart(11, '0').split('').map(Number);

  function draw() {
    const { ctx, w: W } = cv;
    cv.clear(C.panel);
    const L = 44, Rr = W - 12;
    const ba = bitsOf(A), bb = bitsOf(B);
    const n = 11;
    const unit = (Rr - L) / n;
    const hiY = 40, loY = 66;
    const hiY2 = 106, loY2 = 132;

    txt(ctx, '节点 A', 38, 53, { s: 9, c: C.dim, mono: 1, a: 'right' });
    txt(ctx, '节点 B', 38, 119, { s: 9, c: C.dim, mono: 1, a: 'right' });
    txt(ctx, `ID 0x${A.toString(16).toUpperCase()}`, L, 20, { s: 9, c: C.accent, mono: 1 });
    txt(ctx, `ID 0x${B.toString(16).toUpperCase()}`, L + 80, 20, { s: 9, c: C.purple, mono: 1 });

    let loserAt = -1;
    for (let i = 0; i < n; i++) {
      if (ba[i] !== bb[i]) { loserAt = i; break; }
    }

    for (let i = 0; i < n; i++) {
      const x = L + i * unit;
      const a = ba[i], b = bb[i];
      const shown = i <= st.bit;
      const con = shown ? 1 : 0.18;

      ctx.globalAlpha = con;
      line(ctx, x, a ? hiY : loY, x + unit, a ? hiY : loY, C.accent, 2.4);
      line(ctx, x, b ? hiY2 : loY2, x + unit, b ? hiY2 : loY2, C.purple, 2.4);
      txt(ctx, String(a), x + unit / 2, a ? hiY - 10 : hiY + 12, { s: 8.5, a: 'center', c: C.accent, mono: 1 });
      txt(ctx, String(b), x + unit / 2, b ? hiY2 - 10 : hiY2 + 12, { s: 8.5, a: 'center', c: C.purple, mono: 1 });
      ctx.globalAlpha = 1;

      if (i === loserAt && st.bit >= i) {
        line(ctx, x - 2, hiY2 - 24, x - 2, loY2 + 14, C.bad, 1.6);
        txt(ctx, '退出', x + 2, loY2 + 22, { s: 8.5, c: C.bad, mono: 1 });
      }
    }

    txt(ctx, st.bit >= loserAt && loserAt >= 0 ? 'B 发了隐性 1，A 是显性 0 → B 退出，A 独占总线' : '逐位比较中…',
      12, 160, { s: 9.5, c: st.bit >= loserAt ? C.bad : C.dim });
  }

  cv.onFit(draw);
  let timer = null;
  function play() {
    clearInterval(timer);
    st.bit = 0;
    draw();
    timer = setInterval(() => {
      st.bit += 1;
      draw();
      if (st.bit >= 11) clearInterval(timer);
    }, 260);
  }
  row.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-p')) play();
    if (e.target.hasAttribute('data-r')) { clearInterval(timer); st.bit = 0; draw(); }
  });
  D.push(() => clearInterval(timer));
  draw();
});

/* ============================================================
   17. RS485 差分
   ============================================================ */
reg('rs485', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 176, D);
  const st = { term: true };
  const c = ctrl(host);
  seg(c, [{ v: '1', label: '有 120Ω 终端' }, { v: '0', label: '无终端' }], '1', (v) => { st.term = v === '1'; draw(); });
  const upd = readout(host, [{ k: '共模范围', v: '' }, { k: '差分幅度', v: '' }, { k: '最大节点', v: '' }]);

  function draw() {
    const { ctx, w: W } = cv;
    cv.clear(C.panel);

    /* 总线 */
    const y1 = 34, y2 = 52;
    line(ctx, 12, y1, W - 12, y1, C.ok, 2.2);
    line(ctx, 12, y2, W - 12, y2, C.bad, 2.2);
    txt(ctx, 'A', W - 8, y1 - 10, { s: 9, c: C.ok, mono: 1 });
    txt(ctx, 'B', W - 8, y2 + 16, { s: 9, c: C.bad, mono: 1 });

    /* 节点 */
    [0.14, 0.5, 0.86].forEach((p, i) => {
      const x = 12 + (W - 24) * p;
      line(ctx, x, y1, x, 78, C.faint, 1.4);
      line(ctx, x, y2, x, 78, C.faint, 1.4);
      box(ctx, x - 20, 78, 40, 26, { fill: C.card, stroke: C.faint, r: 7 });
      txt(ctx, 'N' + (i + 1), x, 91, { s: 9, a: 'center', c: C.dim, mono: 1 });
    });

    /* 终端电阻 */
    if (st.term) {
      [12, W - 12].forEach((x) => {
        box(ctx, x - 4, y1 + 2, 8, y2 - y1 - 4, { fill: C.warn, r: 2 });
      });
      txt(ctx, '120Ω', 14, y1 + 26, { s: 8, c: C.warn, mono: 1 });
      txt(ctx, '120Ω', W - 44, y1 + 26, { s: 8, c: C.warn, mono: 1 });
    }

    /* 波形 */
    const L = 12, Rr = W - 12, top = 128, bot = 166;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = L + ((Rr - L) * i) / 40;
      const base = (top + bot) / 2;
      const noise = st.term ? 0 : Math.sin(i * 2.3) * 6 * (i > 20 ? (i - 20) / 20 : 0);
      const y = base + Math.sin(i * 0.6) * 9 + noise;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = st.term ? C.accent : C.bad;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    txt(ctx, st.term ? '差分干净' : '末端反射，波形发抖', L, top - 12, { s: 9, c: st.term ? C.accent : C.bad });

    upd(['-7 ~ +12V', '±1.5 ~ 5V', st.term ? '32 台' : '可能 < 10 台']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   18. Modbus RTU 帧 + CRC
   ============================================================ */
reg('modbus', (host, D) => {
  const C = palette(host);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px';
  host.appendChild(wrap);

  const mk = (label, attrs, width) => {
    const d = document.createElement('div');
    d.style.cssText = `flex:1 1 ${width}px;min-width:${width}px`;
    d.innerHTML = `<div class="tiny muted" style="margin-bottom:4px;font-weight:600">${label}</div>`;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.value = attrs.v;
    inp.min = attrs.min; inp.max = attrs.max;
    inp.style.cssText = 'width:100%;padding:9px 10px;border-radius:10px;border:1px solid var(--sep);background:var(--card);font-size:14px;font-family:var(--mono)';
    d.appendChild(inp);
    wrap.appendChild(d);
    return inp;
  };
  const iAddr = mk('从机地址', { v: 1, min: 1, max: 247 }, 70);
  const iReg = mk('起始寄存器', { v: 0, min: 0, max: 65535 }, 84);
  const iQty = mk('数量', { v: 2, min: 1, max: 125 }, 60);

  const out = document.createElement('div');
  out.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap';
  host.appendChild(out);

  const info = document.createElement('div');
  info.className = 'tiny muted';
  info.style.cssText = 'margin-top:10px;line-height:1.5';
  host.appendChild(info);

  function crc16(buf) {
    let crc = 0xffff;
    for (const b of buf) {
      crc ^= b;
      for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
    }
    return crc;
  }

  function paint() {
    const a = Math.max(1, Math.min(247, +iAddr.value || 1));
    const r = Math.max(0, Math.min(65535, +iReg.value || 0));
    const q = Math.max(1, Math.min(125, +iQty.value || 1));
    const body = [a, 0x03, (r >> 8) & 255, r & 255, (q >> 8) & 255, q & 255];
    const crc = crc16(body);
    const frame = [...body, crc & 255, (crc >> 8) & 255];
    const names = ['从机', '功能码', '寄存器高', '寄存器低', '数量高', '数量低', 'CRC 低', 'CRC 高'];

    out.innerHTML = frame.map((b, i) => {
      const isCrc = i >= 6;
      return `<div style="flex:1 1 52px;text-align:center;padding:9px 4px;border-radius:10px;background:${isCrc ? 'var(--bad-soft)' : 'var(--accent-soft)'}">
        <div style="font-family:var(--mono);font-size:14px;font-weight:800;color:${isCrc ? 'var(--bad)' : 'var(--accent)'}">${b.toString(16).toUpperCase().padStart(2, '0')}</div>
        <div style="font-size:9px;color:var(--label-3);margin-top:2px">${names[i]}</div>
      </div>`;
    }).join('');

    info.innerHTML = `帧长度 8 字节 · CRC16 = <b style="font-family:var(--mono)">0x${crc.toString(16).toUpperCase().padStart(4, '0')}</b>（低字节先发）<br>
    从机回 03 功能码时，数据区前 1 字节是字节数 = 数量×2 = ${q * 2}。`;
  }

  [iAddr, iReg, iQty].forEach((el) => el.addEventListener('input', paint));
  paint();
});

/* ============================================================
   19. FreeRTOS 调度
   ============================================================ */
reg('sched', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 172, D);
  const st = { preempt: true };
  const c = ctrl(host);
  seg(c, [{ v: '1', label: '抢占式' }, { v: '0', label: '协作（不开抢占）' }], '1', (v) => { st.preempt = v === '1'; draw(); });
  const upd = readout(host, [{ k: 'H 响应延迟', v: '' }, { k: 'L 运行占比', v: '' }, { k: '抖动', v: '' }]);

  const T = 20;
  function draw() {
    const { ctx, w: W } = cv;
    cv.clear(C.panel);
    const L = 40, Rr = W - 10;
    const xOf = (ms) => L + ((Rr - L) * ms) / T;
    const rows = [22, 64, 106];
    const names = ['H p3', 'L p1', 'IDLE'];

    names.forEach((n, i) => txt(ctx, n, L - 6, rows[i] + 15, { s: 9, c: C.dim, a: 'right', mono: 1 }));
    for (let i = 0; i <= 4; i++) {
      const x = xOf((T * i) / 4);
      line(ctx, x, 12, x, 140, C.grid, 1);
      txt(ctx, (T * i / 4) + 'ms', x, 152, { s: 8.5, c: C.dim, a: 'center', mono: 1 });
    }

    /* 调度序列 */
    const seq = st.preempt
      ? [
          { r: 1, s: 0, e: 2, c: C.warn, t: 'L' },
          { r: 0, s: 2, e: 4, c: C.bad, t: 'H' },
          { r: 1, s: 4, e: 10, c: C.warn, t: 'L' },
          { r: 0, s: 10, e: 12, c: C.bad, t: 'H' },
          { r: 1, s: 12, e: 17, c: C.warn, t: 'L' },
          { r: 2, s: 17, e: 20, c: C.faint, t: 'idle' }
        ]
      : [
          { r: 1, s: 0, e: 10, c: C.warn, t: 'L' },
          { r: 0, s: 10, e: 12, c: C.bad, t: 'H' },
          { r: 1, s: 12, e: 17, c: C.warn, t: 'L' },
          { r: 2, s: 17, e: 20, c: C.faint, t: 'idle' }
        ];

    seq.forEach((s) => {
      const x1 = xOf(s.s), x2 = xOf(s.e);
      box(ctx, x1 + 1, rows[s.r], Math.max(4, x2 - x1 - 2), 30, { fill: s.c, r: 6 });
      if (x2 - x1 > 34) txt(ctx, s.t, x1 + 8, rows[s.r] + 15, { s: 9, c: '#fff', w: 700 });
    });

    /* 唤醒标注 */
    const wx = xOf(2);
    line(ctx, wx, 12, wx, 96, C.bad, 1, [3, 3]);
    txt(ctx, 'H 就绪', wx + 3, 12 + 8, { s: 8.5, c: C.bad, mono: 1 });

    const late = st.preempt ? 0 : 8;
    txt(ctx, st.preempt ? 'H 就绪后立刻抢占，延迟 < 1 个 tick' : `H 等到 L 主动让出，延迟 ${late}ms`,
      12, 166, { s: 9.5, c: st.preempt ? C.ok : C.bad });
    upd([st.preempt ? '0 ms' : late + ' ms', st.preempt ? '65%' : '85%', st.preempt ? '低' : '高']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   20. 队列
   ============================================================ */
reg('queue', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 150, D);
  const st = { cap: 5, items: [], t: 0, pBlock: false, cBlock: false, lastAdd: 0, lastTake: 0 };

  const c = ctrl(host);
  slider(c, '队列长度', 2, 8, 5, 1, (v) => v + ' 格', (v) => { st.cap = v; st.items = st.items.slice(0, v); draw(); });
  const upd = readout(host, [{ k: '队列占用', v: '' }, { k: '生产者', v: '' }, { k: '消费者', v: '' }]);

  function draw() {
    const { ctx, w: W } = cv;
    cv.clear(C.panel);
    const pad = 14;
    const bw = Math.min(46, (W - pad * 2) / st.cap - 6);
    const totalW = st.cap * (bw + 6) - 6;
    const x0 = (W - totalW) / 2;
    const y = 44;

    for (let i = 0; i < st.cap; i++) {
      const x = x0 + i * (bw + 6);
      const filled = i < st.items.length;
      box(ctx, x, y, bw, 44, {
        fill: filled ? C.accent : C.panel,
        stroke: filled ? 'transparent' : C.faint,
        r: 8
      });
      if (filled) txt(ctx, String(st.items[i]), x + bw / 2, y + 22, { s: 13, w: 800, a: 'center', c: '#fff', mono: 1 });
    }

    /* 生产者 / 消费者 */
    txt(ctx, '生产者', 12, 20, { s: 10, w: 700, c: st.pBlock ? C.bad : C.dim });
    txt(ctx, '消费者', W - 12, 20, { s: 10, w: 700, c: st.cBlock ? C.bad : C.dim, a: 'right' });
    ctx.strokeStyle = st.pBlock ? C.bad : C.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 34); ctx.lineTo(totalW * 0.2 + (W - totalW) / 2, 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W - 12, 34); ctx.lineTo(W - (totalW * 0.2 + (W - totalW) / 2), 34);
    ctx.stroke();

    const full = st.items.length >= st.cap;
    const empty = st.items.length === 0;
    txt(ctx, st.pBlock ? '队列满 → 生产者阻塞' : st.cBlock ? '队列空 → 消费者阻塞' : '正常流动',
      12, 128, { s: 9.5, c: st.pBlock || st.cBlock ? C.warn : C.ok });

    upd([`${st.items.length}/${st.cap}`, st.pBlock ? '阻塞' : '写入', st.cBlock ? '阻塞' : '读取']);
  }

  cv.onFit(draw);

  let acc = 0, last = performance.now();
  const timer = setInterval(() => {
    if (!document.body.contains(cv.cv)) return;
    const now = performance.now();
    acc += now - last;
    last = now;
    if (acc > 720) {
      acc = 0;
      if (st.items.length < st.cap) { st.items.push(Math.floor(now / 100) % 90 + 10); st.pBlock = false; }
      else st.pBlock = true;
      draw();
    }
    if (acc === 0) {
      setTimeout(() => {
        if (st.items.length) { st.items.shift(); st.cBlock = false; }
        else st.cBlock = true;
        draw();
      }, 380);
    }
  }, 120);
  D.push(() => clearInterval(timer));
  draw();
});

/* ============================================================
   21. 优先级反转
   ============================================================ */
reg('mutex', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 180, D);
  const st = { inherit: false };
  const c = ctrl(host);
  seg(c, [{ v: '0', label: '不继承优先级' }, { v: '1', label: '启用优先级继承' }], '0', (v) => { st.inherit = v === '1'; draw(); });
  const upd = readout(host, [{ k: 'H 等待时间', v: '' }, { k: 'M 抢占次数', v: '' }, { k: '系统响应', v: '' }]);

  const T = 20;
  function draw() {
    const { ctx, w: W } = cv;
    cv.clear(C.panel);
    const L = 40, Rr = W - 10;
    const xOf = (ms) => L + ((Rr - L) * ms) / T;
    const rows = [20, 56, 92];
    const names = ['H p3', 'M p2', 'L p1'];

    names.forEach((n, i) => txt(ctx, n, L - 6, rows[i] + 15, { s: 9, c: C.dim, a: 'right', mono: 1 }));
    for (let i = 0; i <= 4; i++) {
      const x = xOf((T * i) / 4);
      line(ctx, x, 10, x, 124, C.grid, 1);
      txt(ctx, (T * i / 4) + 'ms', x, 138, { s: 8.5, c: C.dim, a: 'center', mono: 1 });
    }

    /* H 等待段 */
    const hStart = 2, hEnd = st.inherit ? 7 : 16;
    line(ctx, xOf(hStart), rows[0] + 15, xOf(hEnd), rows[0] + 15, C.bad, 1, [3, 3]);
    txt(ctx, `等锁 ${hEnd - hStart}ms`, xOf(hStart) + 4, rows[0] + 4, { s: 8.5, c: C.bad, mono: 1 });

    const seqs = st.inherit
      ? [
          { r: 2, s: 0, e: 7, c: C.warn, t: 'L 持锁(继承到 p3)' },
          { r: 0, s: 7, e: 10, c: C.bad, t: 'H' },
          { r: 1, s: 10, e: 13, c: C.purple, t: 'M' },
          { r: 2, s: 13, e: 17, c: C.warn, t: 'L' },
          { r: 0, s: 17, e: 20, c: C.bad, t: 'H' }
        ]
      : [
          { r: 2, s: 0, e: 16, c: C.warn, t: 'L 持锁 被 M 抢占' },
          { r: 1, s: 3, e: 6, c: C.purple, t: 'M' },
          { r: 1, s: 8, e: 11, c: C.purple, t: 'M' },
          { r: 1, s: 12, e: 15, c: C.purple, t: 'M' },
          { r: 0, s: 16, e: 20, c: C.bad, t: 'H' }
        ];

    seqs.forEach((s) => {
      const x1 = xOf(s.s), x2 = xOf(s.e);
      box(ctx, x1 + 1, rows[s.r], Math.max(4, x2 - x1 - 2), 28, { fill: s.c, r: 6 });
      if (x2 - x1 > 60) txt(ctx, s.t, x1 + 5, rows[s.r] + 14, { s: 8, c: '#fff', w: 700 });
    });

    txt(ctx, st.inherit
      ? 'L 临时升到 p3，M 抢不动，H 只等 5ms'
      : 'M 一直在抢 L，H 被间接拖到 14ms —— 优先级反转',
      12, 162, { s: 9.5, c: st.inherit ? C.ok : C.bad, w: 600 });

    upd([(hEnd - hStart) + ' ms', st.inherit ? '0 次' : '3 次', st.inherit ? '可预测' : '不可预测']);
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   22. 任务状态机
   ============================================================ */
reg('states', (host, D) => {
  const C = palette(host);
  const cv = mkCanvas(host, 176, D);
  const st = { cur: 'ready' };

  const nodes = {
    running: { x: 0.5, y: 0.26, t: 'Running', c: C.ok },
    ready: { x: 0.18, y: 0.7, t: 'Ready', c: C.accent },
    blocked: { x: 0.5, y: 0.86, t: 'Blocked', c: C.warn },
    suspended: { x: 0.82, y: 0.7, t: 'Suspended', c: C.purple }
  };
  const edges = [
    ['ready', 'running', '调度器选中'],
    ['running', 'ready', '被抢占/时间片到'],
    ['running', 'blocked', 'vTaskDelay / 等队列'],
    ['blocked', 'ready', '超时/事件到达'],
    ['running', 'suspended', 'vTaskSuspend'],
    ['suspended', 'ready', 'vTaskResume']
  ];

  const btnWrap = document.createElement('div');
  btnWrap.className = 'ctrl';
  btnWrap.innerHTML = `<div class="seg" data-act>
    <button data-go="running">被调度</button>
    <button data-go="blocked">vTaskDelay</button>
    <button data-go="suspended">Suspend</button>
    <button data-go="ready">Resume</button>
  </div>`;
  host.appendChild(btnWrap);
  const tip = note(host, '任一瞬间，任务只处于四种状态之一。阻塞态的任务不占 CPU。');

  btnWrap.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-go]');
    if (!b) return;
    const go = b.dataset.go;
    if (go === 'running' && st.cur === 'blocked') st.cur = 'ready';
    if (go === 'suspended') st.cur = 'suspended';
    else if (go === 'ready') st.cur = 'ready';
    else if (go === 'blocked') st.cur = 'blocked';
    else st.cur = 'running';
    draw();
    tip.textContent = {
      running: 'Running：正在占用 CPU，同一核上永远只有一个任务处于此态。',
      blocked: 'Blocked：等待事件或延时，不参与调度，不消耗 CPU。',
      suspended: 'Suspended：被 vTaskSuspend 挂起，无超时，只能被 vTaskResume 唤醒。',
      ready: 'Ready：万事俱备只等 CPU，调度器按优先级从就绪链表里挑。'
    }[st.cur];
  });

  function draw() {
    const { ctx, w: W, h: H } = cv;
    cv.clear(C.panel);
    const pt = (k) => {
      const n = nodes[k];
      const radius = Math.min(W, H) * 0.42;
      return {
        x: W / 2 + (n.x - 0.5) * radius * 1.55,
        y: H / 2 - 6 + (n.y - 0.5) * radius * 1.55
      };
    };

    edges.forEach(([a, b]) => {
      const p1 = pt(a), p2 = pt(b);
      const active = (st.cur === a || st.cur === b);
      ctx.beginPath();
      ctx.strokeStyle = active ? C.dim : C.faint;
      ctx.lineWidth = 1.2;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    Object.keys(nodes).forEach((k) => {
      const n = nodes[k];
      const p = pt(k);
      const on = st.cur === k;
      box(ctx, p.x - 34, p.y - 15, 68, 30, {
        fill: on ? n.c : C.panel,
        stroke: on ? n.c : C.faint,
        r: 10,
        lw: on ? 2 : 1
      });
      txt(ctx, n.t, p.x, p.y, { s: 9.5, w: 700, a: 'center', c: on ? '#fff' : C.dim });
      if (on) {
        dot(ctx, p.x + 40, p.y - 15, 4.5, n.c);
      }
    });

    txt(ctx, '当前：' + nodes[st.cur].t, 12, 14, { s: 10, w: 700, c: nodes[st.cur].c });
  }
  cv.onFit(draw);
  draw();
});

/* ============================================================
   兜底：未知 id
   ============================================================ */
reg('none', () => {});