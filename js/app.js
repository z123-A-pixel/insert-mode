import { MODULES as RAW } from './data/index.js';
import { mountVisual } from './visuals.js';
import * as S from './store.js';

/* 单文件离线版（file://）与在线版的行为差异 */
const IS_FILE = location.protocol === 'file:';

/* ---------------- 数据整形 ---------------- */

const MODULES = RAW.map((m) => ({
  ...m,
  cards: m.chapters.map((c) => ({ ...c, moduleId: m.id, moduleTitle: m.title, accent: m.accent, icon: m.icon }))
}));

const ALL = MODULES.flatMap((m) => m.cards);
const CARD = new Map(ALL.map((c) => [c.id, c]));
const MOD = new Map(MODULES.map((m) => [m.id, m]));

S.init(ALL);

/* ---------------- 小工具 ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const rgba = (hex, a) => { const c = hexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; };
function shade(hex, amt) {
  const c = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}
function accentVars(hex) {
  return `--accent:${hex};--accent-deep:${shade(hex, -0.28)};--accent-soft:${rgba(hex, 0.12)};--accent-mid:${rgba(hex, 0.22)};`;
}

const ICONS = {
  home: '<path d="M3.5 10.6 12 3.6l8.5 7v8.9a1.5 1.5 0 0 1-1.5 1.5h-4.6v-6.1H9.6V21H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  book: '<path d="M5 4.2A1.7 1.7 0 0 1 6.7 2.5H19v19H6.7A1.7 1.7 0 0 1 5 19.8z"/><path d="M8.6 7.2h6.8M8.6 11h6.8M8.6 14.8h4.2"/>',
  refresh: '<path d="M20 11.4A8 8 0 1 0 12 20a8 8 0 0 0 6.2-2.9"/><path d="M20 4.2v5h-5"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m15.8 15.8 4.7 4.7"/>',
  person: '<circle cx="12" cy="8" r="3.9"/><path d="M4.6 20.4c1.7-3.5 4.2-5.2 7.4-5.2s5.7 1.7 7.4 5.2"/>',
  bolt: '<path d="M13.4 2.4 4.8 13.6h5.6l-.8 8 8.6-11.2h-5.6z"/>',
  chip: '<rect x="6.6" y="6.6" width="10.8" height="10.8" rx="2.6"/><rect x="9.9" y="9.9" width="4.2" height="4.2" rx="1"/><path d="M9.6 2.6v4M14.4 2.6v4M9.6 17.4v4M14.4 17.4v4M2.6 9.6h4M2.6 14.4h4M17.4 9.6h4M17.4 14.4h4"/>',
  radio: '<circle cx="12" cy="12" r="2.2"/><path d="M8.3 15.7a5.2 5.2 0 0 1 0-7.4M15.7 8.3a5.2 5.2 0 0 1 0 7.4M5.4 18.6a9.3 9.3 0 0 1 0-13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"/>',
  layers: '<path d="m12 3.4 8.6 4.8-8.6 4.8L3.4 8.2z"/><path d="m3.4 12.4 8.6 4.8 8.6-4.8"/><path d="m3.4 16.6 8.6 4.8 8.6-4.8"/>',
  bug: '<path d="M8.2 8.4h7.6v6a3.8 3.8 0 0 1-7.6 0z"/><path d="M9.4 8.4V7a2.6 2.6 0 0 1 5.2 0v1.4M8.2 11.4H4.6M19.4 11.4h-3.6M8.2 15h-3M18.8 15h-3M9.8 6.4 7.6 4.4M14.2 6.4l2.2-2"/>',
  trophy: '<path d="M7.6 3.8h8.8v5.1a4.4 4.4 0 0 1-8.8 0z"/><path d="M7.6 5H4.4v1.6a3 3 0 0 0 3 3M16.4 5h3.2v1.6a3 3 0 0 1-3 3M12 13.3v3.9M8.6 20.2h6.8"/>',
  back: '<path d="M14.6 4.8 7.4 12l7.2 7.2"/>',
  chevron: '<path d="m9.4 5.6 6.2 6.4-6.2 6.4"/>',
  check: '<path d="m4.8 12.6 4.6 4.6 9.8-10.4"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2"/>',
  trash: '<path d="M4.8 6.6h14.4M9.6 6.6V4.4h4.8v2.2M6.6 6.6l.9 13.2h9l.9-13.2"/>',
  share: '<path d="M12 3.4v11.2M8.2 7.2 12 3.4l3.8 3.8"/><path d="M5.4 12.6v6.6a1.4 1.4 0 0 0 1.4 1.4h10.4a1.4 1.4 0 0 0 1.4-1.4v-6.6"/>',
  shuffle: '<path d="M3.6 6.6h3.2l9.6 10.8h4M3.6 17.4h3.2l3.2-3.6M14.6 9.4l1.8-2.8h4"/><path d="M17.4 3.4 20.4 6.6l-3 3M17.4 14.4l3 3.2-3 3.2"/>',
  flag: '<path d="M6 3.4v17.2M6 4.6h11.4l-2.2 3.6 2.2 3.6H6z"/>',
  battery: '<rect x="2.8" y="7.6" width="16" height="8.8" rx="2.4"/><path d="M21.2 10.8v2.4"/><path d="M6.4 14.2V9.8M10 14.2V9.8M13.6 14.2V9.8"/>',
  code: '<path d="m8.6 8.2-4.2 3.8 4.2 3.8M15.4 8.2l4.2 3.8-4.2 3.8M13.6 5.4l-3.2 13.2"/>',
  terminal: '<rect x="2.8" y="4.6" width="18.4" height="14.8" rx="2.6"/><path d="m7 10 2.4 2.4L7 14.8M12.8 15h4.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.2 13.7a7.4 7.4 0 0 0 .1-3.4l2-1.4-1.9-3.3-2.3.9a7.4 7.4 0 0 0-2.9-1.7L13.8 2.2h-3.6l-.4 2.6a7.4 7.4 0 0 0-2.9 1.7l-2.3-.9-1.9 3.3 2 1.4a7.4 7.4 0 0 0 0 3.4l-2 1.4 1.9 3.3 2.3-.9a7.4 7.4 0 0 0 2.9 1.7l.4 2.6h3.6l.4-2.6a7.4 7.4 0 0 0 2.9-1.7l2.3.9 1.9-3.3z"/>'
};

function icon(name, size = 24) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ---------------- 主题 ---------------- */

function applyTheme() {
  const t = S.theme();
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
}

/* ---------------- 导航 ---------------- */

const NAV = [
  { hash: '#/', icon: 'home', label: '首页', match: ['/'] },
  { hash: '#/modules', icon: 'book', label: '模块', match: ['/modules', '/m'] },
  { hash: '#/review', icon: 'refresh', label: '复习', match: ['/review', '/c', '/wrong'] },
  { hash: '#/me', icon: 'person', label: '我的', match: ['/me', '/search'] }
];

let navStack = [];

function go(hash) {
  navStack.push(location.hash || '#/');
  location.hash = hash;
}
function back() {
  const p = navStack.pop();
  if (p && p !== location.hash) location.hash = p;
  else location.hash = '#/';
}

/* 跳到某路由；若已在该路由则直接重渲染（hash 不变不会触发 hashchange） */
function jump(hash) {
  if ((location.hash || '#/') === hash) route();
  else location.hash = hash;
}

function renderTabBar(path) {
  const bar = $('#tabbar');
  const show = ['/', '/modules', '/review', '/me', '/search', '/wrong'].some((r) => path === r);
  bar.classList.toggle('show', show);
  bar.innerHTML = show
    ? `<div class="inner">${NAV.map((n) => {
        const active = n.match.some((m) => path === m);
        return `<a href="${n.hash}" class="${active ? 'active' : ''}">${icon(n.icon, 24)}<span>${n.label}</span></a>`;
      }).join('')}</div>`
    : '';
}

/* ---------------- 通用片段 ---------------- */

function topbar(crumb, fallback) {
  return `<div class="topbar">
    <button class="back" data-act="back" aria-label="返回">${icon('back', 20)}<span>返回</span></button>
    <div class="crumb">${esc(crumb)}</div>
  </div>`;
}

function emptyState(emoji, title, desc, action) {
  return `<div class="empty"><div class="em">${emoji}</div><h3>${esc(title)}</h3><p>${esc(desc)}</p>${
    action ? `<div style="margin-top:16px"><button class="btn solid" data-act="${action.act}">${esc(action.label)}</button></div>` : ''
  }</div>`;
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 1800);
}

/* ---------------- 首页 ---------------- */

function viewHome() {
  const st = S.stats();
  const td = S.today();
  const pct = Math.min(100, Math.round((td.n / td.goal) * 100));
  const fresh = S.freshList().length;
  const due = st.due;
  const r = 30, c = 2 * Math.PI * r;

  const modCards = MODULES.map((m) => {
    const ms = S.moduleStats(m);
    return `<a class="mod-card" href="#/m/${m.id}" style="${accentVars(m.accent)}">
      <div class="mod-icon">${icon(m.icon, 21)}</div>
      <div>
        <div class="mod-name">${esc(m.title)}</div>
        <div class="mod-meta">${ms.total} 张 · 掌握 ${ms.mastered}</div>
        <div class="mod-bar"><i style="width:${ms.pct}%"></i></div>
      </div>
    </a>`;
  }).join('');

  return `<div class="page">
    <div class="page-head">
      <div class="eyebrow">${dateLabel()} · 连续 ${S.streak()} 天</div>
      <h1 class="title">嵌入式复习</h1>
      <p class="sub">${st.total} 个知识点，按遗忘曲线安排复习</p>
    </div>

    <div class="stack">
      ${S.storageOK() ? '' : `<div class="card tight" style="background:var(--warn-soft);border-color:transparent;box-shadow:none">
        <div class="tiny" style="line-height:1.55;color:var(--label)">这个环境不能保存数据：内容都能看、能复习，但关掉后进度不会保留。</div>
      </div>`}

      <div class="hero" style="--accent:#0a84ff;--accent-deep:#0a5bd0">
        <div class="hero-row">
          <div class="grow">
            <h2>今日复习</h2>
            <p>待复习 ${due} 张 · 新卡 ${fresh} 张</p>
          </div>
          <div class="ring">
            <svg viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="${r}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="7"/>
              <circle cx="36" cy="36" r="${r}" fill="none" stroke="#fff" stroke-width="7"
                stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c - (c * pct) / 100}"/>
            </svg>
            <div class="ring-txt">${pct}%</div>
          </div>
        </div>
        <button class="btn-primary" data-act="start" style="margin-top:16px">开始复习</button>
      </div>

      <div class="row-between" style="margin-top:8px">
        <h2 class="section" style="margin:0">知识模块</h2>
        <span class="tag">掌握 ${st.mastered}/${st.total}</span>
      </div>
      <div class="grid2">${modCards}</div>

      <h2 class="section">快捷入口</h2>
      <div class="card tight" style="padding:0">
        ${quickRow('shuffle', '随机抽一张', '打乱顺序抽查，检验真实记忆', 'random')}
        <div class="hr" style="margin:0 14px"></div>
        ${quickRow('flag', '错题本', `记错过的 ${S.wrongList().length} 张`, 'wrong')}
        <div class="hr" style="margin:0 14px"></div>
        ${quickRow('search', '全库搜索', '按关键词查知识点', 'search')}
      </div>
    </div>
  </div>`;
}

function quickRow(ic, title, desc, act) {
  return `<div class="row" data-act="${act}" style="padding:13px 14px;cursor:pointer">
    <div style="width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:var(--sep);color:var(--label-2)">${icon(ic, 19)}</div>
    <div class="grow"><div style="font-size:14.5px;font-weight:650">${esc(title)}</div>
    <div class="tiny muted">${esc(desc)}</div></div>
    <div style="color:var(--label-3)">${icon('chevron', 18)}</div>
  </div>`;
}

function dateLabel() {
  const d = new Date();
  const w = '日一二三四五六'[d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${w}`;
}

/* ---------------- 模块列表页 ---------------- */

function viewModules() {
  const items = MODULES.map((m) => {
    const ms = S.moduleStats(m);
    return `<div class="card card-press" data-act="mod" data-id="${m.id}" style="${accentVars(m.accent)}">
      <div class="row" style="align-items:flex-start">
        <div class="mod-icon" style="width:34px;height:34px;border-radius:11px">${icon(m.icon, 19)}</div>
        <div class="grow">
          <div class="row-between"><div class="mod-name">${esc(m.title)}</div>
          <span class="tiny mono" style="color:var(--label-3)">${ms.mastered}/${ms.total}</span></div>
          <div class="mod-meta">${esc(m.subtitle)}</div>
          <div class="mod-bar" style="margin-top:9px"><i style="width:${ms.pct}%"></i></div>
        </div>
      </div>
    </div>`;
  }).join('');

  return `<div class="page">
    <div class="page-head"><div class="eyebrow">知识库</div><h1 class="title">全部模块</h1>
    <p class="sub">六个方向，${ALL.length} 个知识点</p></div>
    <div class="stack">${items}</div>
  </div>`;
}

/* ---------------- 模块详情 ---------------- */

function viewModule(id) {
  const m = MOD.get(id);
  if (!m) return `<div class="page">${emptyState('🧭', '找不到模块', '它可能已被移除', { act: 'home', label: '回首页' })}</div>`;
  const ms = S.moduleStats(m);

  const rows = m.cards.map((c, i) => {
    const r = S.record(c.id);
    const lv = r ? r.lv : -1;
    const dot = lv >= 4 ? 'm3' : lv >= 1 ? 'm2' : lv === 0 && r ? 'm1' : '';
    return `<div class="chapter" data-act="card" data-id="${c.id}">
      <div class="idx">${String(i + 1).padStart(2, '0')}</div>
      <div class="grow">
        <div class="ct">${esc(c.title)}</div>
        <div class="cs">${esc(c.summary)}</div>
      </div>
      <div class="dot-state ${dot}"></div>
    </div>`;
  }).join('');

  const groups = [
    { lv: 1, name: '基础必备' },
    { lv: 2, name: '进阶' },
    { lv: 3, name: '资深' }
  ];

  return `<div class="page" style="${accentVars(m.accent)}">
    ${topbar(m.title)}
    <div class="page-head">
      <div class="row" style="gap:10px">
        <div class="mod-icon" style="width:44px;height:44px;border-radius:14px">${icon(m.icon, 23)}</div>
        <div class="grow">
          <h1 class="title sm" style="margin:0">${esc(m.title)}</h1>
          <div class="tiny muted" style="margin-top:3px">${esc(m.subtitle)}</div>
        </div>
      </div>
      <div class="readout" style="margin-top:14px;grid-template-columns:repeat(3,1fr)">
        <div><b>${ms.total}</b><span>知识点</span></div>
        <div><b>${ms.mastered}</b><span>已掌握</span></div>
        <div><b>${ms.pct}%</b><span>完成度</span></div>
      </div>
    </div>
    <div class="stack-s">${rows}</div>
  </div>`;
}

/* ---------------- 卡片内容 ---------------- */

function summaryCard(text) {
  return `<div class="card" style="background:var(--accent-soft);border-color:transparent;box-shadow:none">
    <div class="card-label" style="color:var(--accent)">一句话记住</div>
    <div style="font-size:16px;font-weight:700;line-height:1.5;letter-spacing:-0.01em">${esc(text)}</div>
  </div>`;
}

function analogyCard(text) {
  if (!text) return '';
  return `<div class="card analogy">
    <div class="card-label">打个比方</div>
    <div class="analogy-text">${esc(text)}</div>
  </div>`;
}

function exampleCard(text) {
  if (!text) return '';
  return `<div class="card example">
    <div class="card-label">开发里怎么用</div>
    <div class="prose">${esc(text)}</div>
  </div>`;
}

function pointsCard(points) {
  if (!points || !points.length) return '';
  return `<div class="card">
    <div class="card-label">核心要点</div>
    <ol class="points">${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
  </div>`;
}

function detailCard(detail) {
  if (!detail || !detail.length) return '';
  return `<div class="card">
    <div class="card-label">原理详解</div>
    <div class="prose">${detail.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
  </div>`;
}

function pitfallCard(list) {
  if (!list || !list.length) return '';
  return `<div class="card">
    <div class="card-label">常见坑</div>
    ${list.map((p) => `<div class="pitfall"><span class="ico">⚠️</span><span>${esc(p)}</span></div>`).join('')}
  </div>`;
}

function qaCard(list) {
  if (!list || !list.length) return '';
  return `<div class="card">
    <div class="card-label">自测 · 面试问答</div>
    ${list.map((x) => `<div class="qa-item">
      <div class="qa-q"><span class="qmark">Q</span><span>${esc(x.q)}</span></div>
      <div class="qa-a">${esc(x.a)}</div>
    </div>`).join('')}
  </div>`;
}

function vizCard(card) {
  if (!card.visual) return '';
  return `<div class="viz" data-viz="${esc(card.visual)}">
    <div class="viz-head">
      <div class="viz-title">交互演示</div>
      <div class="viz-badge">拖动试试</div>
    </div>
    <div class="viz-mount"></div>
  </div>`;
}

/* 选「掌握」后下次复习的间隔标签 */
function nextDueLabel(card) {
  const r = S.record(card.id);
  const lv = Math.min(7, ((r && r.lv) || 0) + 1);
  const d = [0, 1, 2, 4, 8, 16, 35, 75][lv];
  return d + ' 天后';
}

function cardView(card, opts = {}) {
  const m = MOD.get(card.moduleId);
  const compact = !!opts.compact;
  return `<div class="stack">
    <div style="padding:2px 2px 0">
      <div class="chips" style="margin-bottom:9px">
        <span class="lvl">L${card.level}</span>
        ${(card.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
        ${card.freq >= 3 ? '<span class="tag tag-accent">高频</span>' : ''}
      </div>
      <h1 class="title sm" style="margin:0">${esc(card.title)}</h1>
    </div>
    ${summaryCard(card.summary)}
    ${analogyCard(card.analogy)}
    ${vizCard(card)}
    ${pointsCard(card.points)}
    ${compact ? '' : exampleCard(card.example)}
    ${compact
      ? `<details class="acc"><summary>展开原理详解</summary><div class="acc-body prose">${(card.detail || []).map((p) => `<p>${esc(p)}</p>`).join('')}</div></details>`
      : detailCard(card.detail)}
    ${pitfallCard(card.pitfalls)}
    ${qaCard(card.qa)}
  </div>`;
}

/* ---------------- 卡片详情页 ---------------- */

function viewCard(id) {
  const c = CARD.get(id);
  if (!c) return `<div class="page">${emptyState('🧭', '找不到这张卡片', '', { act: 'home', label: '回首页' })}</div>`;
  const m = MOD.get(c.moduleId);
  const r = S.record(id);
  const lvTxt = r ? ['刚记错', '模糊', '熟悉', '熟练', '掌握', '很熟', '长期', '永久'][Math.min(7, r.lv)] : '未学习';

  return `<div class="page has-gradebar" style="${accentVars(c.accent)}">
    ${topbar(m.title)}
    <div class="stack">
      ${cardView(c)}
      <div class="card flat tight">
        <div class="row-between">
          <span class="tiny muted">状态</span>
          <span class="tiny" style="font-weight:650;color:var(--accent)">${lvTxt}${r ? ` · 第 ${r.seen} 次` : ''}</span>
        </div>
      </div>
    </div>
    <div class="gradebar">
      <button class="g0" data-act="grade" data-g="0">忘了<small>10 分钟后</small></button>
      <button class="g1" data-act="grade" data-g="1">模糊<small>12 小时后</small></button>
      <button class="g2" data-act="grade" data-g="2">掌握<small>${nextDueLabel(c)}</small></button>
    </div>
  </div>`;
}

/* ---------------- 复习会话 ---------------- */

let session = null;

function startSession() {
  const q = S.buildQueue(24);
  session = { queue: q, idx: 0, done: 0, ok: 0 };
  jump('#/review');
}

function viewReview() {
  if (!session) session = { queue: [], idx: 0, done: 0, ok: 0 };
  const { queue, idx } = session;

  if (!queue.length) {
    return `<div class="page">
      <div class="page-head"><div class="eyebrow">复习</div><h1 class="title">今天没有待复习</h1></div>
      ${emptyState('🌤', '都复习完了', '新卡可以随时开始，或者去模块里随便翻翻。', { act: 'start', label: '抽一批新卡' })}
    </div>`;
  }

  if (idx >= queue.length) {
    const total = session.done;
    const rate = total ? Math.round((session.ok / total) * 100) : 0;
    return `<div class="page">
      <div class="page-head"><div class="eyebrow">本轮完成</div><h1 class="title">复习结束</h1>
      <p class="sub">这一轮过了 ${total} 张，记住 ${rate}%</p></div>
      <div class="stack">
        <div class="stat-grid">
          <div class="stat-tile"><b>${total}</b><span>复习张数</span></div>
          <div class="stat-tile"><b>${rate}%</b><span>掌握率</span></div>
        </div>
        <button class="btn solid block" data-act="start">再来一轮</button>
        <button class="btn block" data-act="home">回首页</button>
      </div>
    </div>`;
  }

  const c = queue[idx];
  const pct = Math.round((idx / queue.length) * 100);

  return `<div class="page has-gradebar" style="${accentVars(c.accent)}">
    <div class="session-top">
      <button class="back" data-act="exit" style="border:0;background:none;color:var(--accent);font-size:16px;padding:0;display:flex;align-items:center;gap:2px;cursor:pointer">${icon('back', 20)} 退出</button>
      <div class="grow"></div>
      <span class="count">${idx + 1} / ${queue.length}</span>
    </div>
    <div class="progress-line"><i style="width:${pct}%"></i></div>
    ${cardView(c, { compact: true })}
    <div style="height:24px"></div>
    <div class="gradebar">
      <button class="g0" data-act="grade" data-g="0">忘了<small>10 分钟后</small></button>
      <button class="g1" data-act="grade" data-g="1">模糊<small>12 小时后</small></button>
      <button class="g2" data-act="grade" data-g="2">掌握<small>${nextDueLabel(c)}</small></button>
    </div>
  </div>`;
}

/* ---------------- 错题本 ---------------- */

function viewWrong() {
  const list = S.wrongList();
  const rows = list.map((c) => {
    const r = S.record(c.id);
    return `<div class="chapter" data-act="card" data-id="${c.id}" style="${accentVars(c.accent)}">
      <div class="idx" style="color:var(--bad);background:var(--bad-soft)">${r.wrong}</div>
      <div class="grow"><div class="ct">${esc(c.title)}</div><div class="cs">${esc(c.summary)}</div></div>
      <div class="dot-state m1"></div>
    </div>`;
  }).join('');

  return `<div class="page">
    ${topbar('错题本')}
    <div class="page-head"><div class="eyebrow">薄弱环节</div><h1 class="title">错题本</h1>
    <p class="sub">${list.length} 张卡片记过错，数字是错误次数</p></div>
    ${list.length ? `<div class="stack-s">${rows}</div>` : emptyState('✨', '还没有错题', '复习时选「忘了」的卡片会出现在这里。', { act: 'start', label: '开始复习' })}
  </div>`;
}

/* ---------------- 搜索 ---------------- */

let searchQ = '';

function searchIndex() {
  return ALL.map((c) => ({
    c,
    hay: [c.title, c.summary, (c.tags || []).join(' '), (c.points || []).join(' '), (c.detail || []).join(' ')]
      .join(' ').toLowerCase()
  }));
}
let IDX = null;

function highlight(text, q) {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}

function viewSearch() {
  if (!IDX) IDX = searchIndex();
  const q = searchQ.trim();
  let hits = [];
  if (q) {
    const lq = q.toLowerCase();
    hits = IDX.filter((x) => x.hay.includes(lq)).slice(0, 60);
  } else {
    hits = ALL.slice(0, 12).map((c) => ({ c }));
  }

  const rows = hits.map(({ c }) => `<div class="hit" data-act="card" data-id="${c.id}">
    <div class="hm">${esc(MOD.get(c.moduleId).title)}</div>
    <div class="ht">${highlight(c.title, q)}</div>
    <div class="hs">${esc(c.summary)}</div>
  </div>`).join('');

  return `<div class="page">
    <div class="page-head" style="padding-bottom:8px">
      <div class="eyebrow">检索</div><h1 class="title">搜索</h1>
    </div>
    <div class="searchbox" style="margin-bottom:14px">
      ${icon('search', 18)}
      <input id="q" type="search" placeholder="关键词：I2C、看门狗、优先级反转…" value="${esc(q)}" autocomplete="off" enterkeyhint="search">
    </div>
    <div class="tiny muted" style="padding:0 4px 10px">${q ? `找到 ${hits.length} 条` : '试试搜索：DMA、CAN、栈溢出、上拉电阻'}</div>
    <div class="stack-s">${rows}</div>
  </div>`;
}

/* ---------------- 我的 ---------------- */

function viewMe() {
  const st = S.stats();
  const td = S.today();
  const streak = S.streak();
  const week = S.weekSeries();
  const max = Math.max(1, ...week.map((w) => w.n));

  const bars = MODULES.map((m) => {
    const ms = S.moduleStats(m);
    return `<div class="bar-row">
      <div class="nm">${esc(m.title)}</div>
      <div class="tr"><i style="width:${ms.pct}%;background:${m.accent}"></i></div>
      <div class="vl">${ms.mastered}/${ms.total}</div>
    </div>`;
  }).join('');

  const weekBars = week.map((w) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">
    <div style="width:100%;height:56px;display:flex;align-items:flex-end">
      <div style="width:100%;border-radius:6px 6px 3px 3px;background:${w.n ? 'var(--accent)' : 'var(--sep)'};height:${Math.max(4, (w.n / max) * 56)}px;opacity:${w.n ? 1 : 0.5}"></div>
    </div>
    <div style="font-size:10px;color:var(--label-3);font-weight:600">${w.label}</div>
  </div>`).join('');

  return `<div class="page">
    <div class="page-head"><div class="eyebrow">学习档案</div><h1 class="title">我的</h1></div>
    <div class="stack">
      <div class="stat-grid">
        <div class="stat-tile"><b>${st.mastered}</b><span>已掌握 / 共 ${st.total}</span></div>
        <div class="stat-tile"><b>${streak}</b><span>连续学习天数</span></div>
        <div class="stat-tile"><b>${td.n}</b><span>今日复习张数</span></div>
        <div class="stat-tile"><b>${st.due}</b><span>待复习</span></div>
      </div>

      <div class="card">
        <div class="card-label">最近 7 天</div>
        <div style="display:flex;gap:8px">${weekBars}</div>
      </div>

      <div class="card">
        <div class="card-label">各模块掌握度</div>
        <div class="bars">${bars}</div>
      </div>

      <div class="card">
        <div class="card-label">外观</div>
        <div class="seg" data-act="theme">
          ${['auto', 'light', 'dark'].map((t) => `<button data-t="${t}" class="${S.theme() === t ? 'on' : ''}">${t === 'auto' ? '跟随系统' : t === 'light' ? '浅色' : '深色'}</button>`).join('')}
        </div>
        <div class="row-between" style="margin-top:16px">
          <span class="tiny muted">每日目标</span>
          <div class="row" style="gap:6px">
            <button class="btn sm" data-act="goal-" style="padding:6px 12px">−</button>
            <span class="mono" style="font-size:14px;font-weight:700;min-width:32px;text-align:center">${td.goal}</span>
            <button class="btn sm" data-act="goal+" style="padding:6px 12px">+</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-label">数据</div>
        <div class="stack-s">
          <button class="btn block" data-act="export">${icon('share', 17)} 导出学习记录</button>
          <label class="btn block" style="display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer">
            导入记录<input id="importFile" type="file" accept="application/json,.json" hidden>
          </label>
          <button class="btn block" data-act="reset" style="color:var(--bad)">${icon('trash', 17)} 清空所有进度</button>
        </div>
      </div>

      ${S.storageOK() ? '' : `<div class="card" style="background:var(--warn-soft);border-color:transparent;box-shadow:none">
        <div class="tiny" style="line-height:1.6">当前环境不允许网页保存数据，学习进度只在本次打开期间有效。</div>
      </div>`}

      <div class="card flat">
        <div class="card-label">${IS_FILE ? '离线版说明' : '装到主屏幕'}</div>
        <div class="tiny muted" style="line-height:1.6">
          ${IS_FILE
            ? '你打开的是单文件离线版：所有内容都在这个文件里，断网也能看。部分浏览器不允许本地文件保存数据，学习记录可能留不住；想长期用，请用在线链接打开后「添加到主屏幕」。'
            : '用 Safari 打开本页 → 点底部「分享」→「添加到主屏幕」。之后可全屏运行、离线可用，数据存在本机。'}
        </div>
      </div>

      <div class="tiny muted center" style="padding:8px 0 4px">
        嵌入式复习 · v1.0 · 共 ${ALL.length} 个知识点<br>
        内容随遗忘曲线安排，全部离线可读
      </div>
    </div>
  </div>`;
}

/* ---------------- 渲染 ---------------- */

let cleanups = [];

function cleanupViz() {
  for (const fn of cleanups) { try { fn(); } catch (e) { /* ignore */ } }
  cleanups = [];
}

function mountAllViz(root) {
  root.querySelectorAll('.viz').forEach((box) => {
    const id = box.dataset.viz;
    const slot = box.querySelector('.viz-mount');
    if (!id || !slot) return;
    try {
      const fn = mountVisual(id, slot);
      if (typeof fn === 'function') cleanups.push(fn);
    } catch (e) {
      console.error('可视化渲染失败', id, e);
      slot.innerHTML = `<div class="tiny muted center" style="padding:20px">演示加载失败</div>`;
    }
  });
}

function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const parts = raw.split('/').filter(Boolean);
  cleanupViz();

  let html = '';
  let path = '/';

  if (!parts.length) { html = viewHome(); path = '/'; }
  else if (parts[0] === 'm' && parts[1]) { html = viewModule(parts[1]); path = '/m'; }
  else if (parts[0] === 'c' && parts[1]) { html = viewCard(parts[1]); path = '/c'; }
  else if (parts[0] === 'modules') { html = viewModules(); path = '/modules'; }
  else if (parts[0] === 'review') { html = viewReview(); path = '/review'; }
  else if (parts[0] === 'search') { html = viewSearch(); path = '/search'; }
  else if (parts[0] === 'wrong') { html = viewWrong(); path = '/wrong'; }
  else if (parts[0] === 'me') { html = viewMe(); path = '/me'; }
  else { html = viewHome(); path = '/'; }

  const app = $('#app');
  app.innerHTML = html;
  renderTabBar(path);
  mountAllViz(app);
  window.scrollTo(0, 0);

  if (path === '/search') {
    const input = $('#q');
    if (input) {
      input.addEventListener('input', () => {
        searchQ = input.value;
        const page = $('#app .stack-s');
        if (!page) return;
        // 只重绘结果区，保持输入焦点
        const q = searchQ.trim();
        const lq = q.toLowerCase();
        const hits = q ? IDX.filter((x) => x.hay.includes(lq)).slice(0, 60) : ALL.slice(0, 12).map((c) => ({ c }));
        page.innerHTML = hits.map(({ c }) => `<div class="hit" data-act="card" data-id="${c.id}">
          <div class="hm">${esc(MOD.get(c.moduleId).title)}</div>
          <div class="ht">${highlight(c.title, q)}</div>
          <div class="hs">${esc(c.summary)}</div>
        </div>`).join('');
        const cnt = $('.tiny.muted');
        if (cnt) cnt.textContent = q ? `找到 ${hits.length} 条` : '试试搜索：DMA、CAN、栈溢出、上拉电阻';
      });
    }
  }
}

window.addEventListener('hashchange', route);

/* ---------------- 事件 ---------------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  const qa = e.target.closest('.qa-q');

  if (qa) {
    qa.parentElement.classList.toggle('open');
    return;
  }

  if (!el) return;
  const act = el.dataset.act;

  if (act === 'back') return back();
  if (act === 'home') { navStack = []; return jump('#/'); }
  if (act === 'start') return startSession();
  if (act === 'random') {
    const c = ALL[Math.floor(Math.random() * ALL.length)];
    go('#/c/' + c.id);
    return;
  }
  if (act === 'wrong') return go('#/wrong');
  if (act === 'search') return go('#/search');
  if (act === 'mod') return go('#/m/' + el.dataset.id);
  if (act === 'card') return go('#/c/' + el.dataset.id);
  if (act === 'exit') { session = null; navStack = []; return jump('#/'); }

  if (act === 'grade') {
    const g = Number(el.dataset.g);
    const isReview = location.hash.startsWith('#/review');
    let card = null;
    if (isReview && session && session.queue[session.idx]) card = session.queue[session.idx];
    else if (location.hash.startsWith('#/c/')) card = CARD.get(location.hash.split('/')[2]);
    if (!card) return;

    const rec = S.grade(card.id, g);

    if (isReview) {
      session.done += 1;
      if (g > 0) session.ok += 1;
      session.idx += 1;
      route();
    } else {
      const when = g === 0 ? '10 分钟后'
        : g === 1 ? '12 小时后'
        : Math.max(1, Math.round((rec.due - Date.now()) / 86400000)) + ' 天后';
      toast('已记录 · ' + when + '复习');
      route();
    }
    return;
  }

  if (act === 'theme') {
    const t = e.target.closest('button')?.dataset.t;
    if (!t) return;
    S.setTheme(t);
    applyTheme();
    route();
    return;
  }
  if (act === 'goal-' || act === 'goal+') {
    S.setGoal(S.goal() + (act === 'goal+' ? 5 : -5));
    route();
    return;
  }
  if (act === 'export') {
    const blob = new Blob([S.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `嵌入式复习-记录-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('已导出');
    return;
  }
  if (act === 'reset') {
    if (confirm('清空所有学习进度？此操作不可撤销。')) {
      S.resetAll();
      session = null;
      toast('已清空');
      route();
    }
    return;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'importFile') {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        S.importJSON(String(reader.result));
        applyTheme();
        toast('导入成功');
        route();
      } catch (err) {
        toast('导入失败：' + err.message);
      }
    };
    reader.readAsText(f);
  }
});

/* ---------------- 启动 ---------------- */

applyTheme();
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}