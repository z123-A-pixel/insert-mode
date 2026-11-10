/* 学习记录与间隔重复调度（轻量 SM-2 变体） */

const KEY = 'emb.review.v2';
const DAY = 86400000;

/* 每个掌握等级对应的下次间隔 */
const INTERVALS = [0, 1, 2, 4, 8, 16, 35, 75];

let CARDS = [];
let db = null;

function todayKey(ts = Date.now()) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function defaults() {
  return {
    v: 2,
    r: {},          // cardId -> { lv, due, seen, wrong, last }
    days: {},       // 'YYYY-MM-DD' -> { n, ok }
    settings: { theme: 'auto', dailyGoal: 20 },
    created: Date.now()
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    const base = defaults();
    return {
      ...base,
      ...parsed,
      r: parsed.r || {},
      days: parsed.days || {},
      settings: { ...base.settings, ...(parsed.settings || {}) }
    };
  } catch (e) {
    console.warn('读取本地记录失败，使用空白数据', e);
    return defaults();
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('保存失败', e);
  }
}

/* 有些环境（file:// 下的部分浏览器）禁止本地存储，先探测一次 */
let STORAGE_OK = true;
try {
  localStorage.setItem('__emb_probe', '1');
  localStorage.removeItem('__emb_probe');
} catch (e) {
  STORAGE_OK = false;
}

export const storageOK = () => STORAGE_OK;

export function init(cards) {
  CARDS = cards;
  db = load();
  const t = todayKey();
  if (!db.days[t]) db.days[t] = { n: 0, ok: 0 };
  save();
}

export const allCards = () => CARDS;
export const cardById = (id) => CARDS.find((c) => c.id === id);
export const record = (id) => db.r[id] || null;

export function dueList(now = Date.now()) {
  return CARDS.filter((c) => {
    const r = db.r[c.id];
    return r && r.due <= now;
  }).sort((a, b) => db.r[a.id].due - db.r[b.id].due);
}

export function freshList() {
  return CARDS.filter((c) => !db.r[c.id]);
}

export function wrongList() {
  return CARDS
    .filter((c) => db.r[c.id] && db.r[c.id].wrong > 0)
    .sort((a, b) => db.r[b.id].wrong - db.r[a.id].wrong);
}

export function grade(id, g) {
  const now = Date.now();
  const rec = db.r[id] || { lv: 0, due: 0, seen: 0, wrong: 0, last: 0 };
  if (g === 0) {
    rec.lv = 0;
    rec.wrong += 1;
    rec.due = now + 10 * 60 * 1000;
  } else if (g === 1) {
    rec.lv = Math.max(1, Math.min(rec.lv + 1, 3));
    rec.due = now + 0.5 * DAY;
  } else {
    rec.lv = Math.min(7, (rec.lv || 0) + 1);
    rec.due = now + INTERVALS[rec.lv] * DAY;
  }
  rec.seen += 1;
  rec.last = now;
  db.r[id] = rec;

  const t = todayKey(now);
  if (!db.days[t]) db.days[t] = { n: 0, ok: 0 };
  db.days[t].n += 1;
  if (g > 0) db.days[t].ok += 1;

  save();
  return rec;
}

export function nextIntervalLabel(g) {
  if (g === 0) return '10 分钟后';
  if (g === 1) return '12 小时后';
  return null;
}

export function stats() {
  const now = Date.now();
  let mastered = 0, learning = 0, seen = 0, due = 0;
  for (const c of CARDS) {
    const r = db.r[c.id];
    if (!r) continue;
    seen += 1;
    if (r.lv >= 4) mastered += 1;
    else learning += 1;
    if (r.due <= now) due += 1;
  }
  return {
    total: CARDS.length,
    seen,
    mastered,
    learning,
    untouched: CARDS.length - seen,
    due
  };
}

export function moduleStats(mod) {
  let total = 0, mastered = 0, seen = 0;
  for (const c of mod.cards) {
    total += 1;
    const r = db.r[c.id];
    if (r) {
      seen += 1;
      if (r.lv >= 4) mastered += 1;
    }
  }
  return { total, mastered, seen, pct: total ? Math.round((mastered / total) * 100) : 0 };
}

export function today() {
  const d = db.days[todayKey()] || { n: 0, ok: 0 };
  return { n: d.n, ok: d.ok, goal: db.settings.dailyGoal || 20 };
}

export function streak() {
  let s = 0;
  const cur = new Date();
  for (let i = 0; i < 400; i++) {
    const key = todayKey(cur.getTime() - i * DAY);
    const d = db.days[key];
    if (d && d.n > 0) s += 1;
    else if (i > 0) break;
  }
  return s;
}

export function weekSeries() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const ts = Date.now() - i * DAY;
    const d = new Date(ts);
    const key = todayKey(ts);
    out.push({
      label: '日一二三四五六'[d.getDay()],
      n: (db.days[key] && db.days[key].n) || 0
    });
  }
  return out;
}

export function buildQueue(limit = 24) {
  const now = Date.now();
  const due = dueList(now);
  const fresh = freshList();
  const q = [];
  for (const c of due.slice(0, limit)) q.push(c);
  const room = Math.max(0, limit - q.length);
  for (const c of fresh.slice(0, room)) q.push(c);
  return q;
}

export function theme() { return db.settings.theme || 'auto'; }
export function setTheme(t) { db.settings.theme = t; save(); }
export function goal() { return db.settings.dailyGoal || 20; }
export function setGoal(n) { db.settings.dailyGoal = Math.max(5, Math.min(200, n | 0)); save(); }

export function resetAll() {
  db = defaults();
  const t = todayKey();
  db.days[t] = { n: 0, ok: 0 };
  save();
}

export function exportJSON() {
  return JSON.stringify({ app: 'embedded-review', at: Date.now(), data: db }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const data = parsed && parsed.data ? parsed.data : parsed;
  if (!data || typeof data !== 'object' || !data.r) throw new Error('文件格式不对');
  const base = defaults();
  db = { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } };
  const t = todayKey();
  if (!db.days[t]) db.days[t] = { n: 0, ok: 0 };
  save();
}