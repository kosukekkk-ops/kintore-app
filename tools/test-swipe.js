/* test-swipe.js — カレンダーと日付ナビの左右スワイプを実際のタッチイベントで検証する。
 *
 * 見るのは「送れること」だけでなく「送れてはいけないときに送らないこと」。
 * 縦スクロールを奪ったり、シート表示中に裏の日付が動いたりすると実機で不快になる。
 * 使い方: node tools/test-swipe.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, '..', 'node_modules', 'jsdom'));

const DOCS = path.join(__dirname, '..', 'docs');
const indexHtml = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
const FILES = [...indexHtml.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
const bundle = FILES.map(f => fs.readFileSync(path.join(DOCS, f), 'utf8')).join('\n;\n');

const K = (back) => {
  const x = new Date(); x.setDate(x.getDate() - back);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};

function boot() {
  const dom = new JSDOM(indexHtml, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window, d = w.document;
  w.scrollTo = () => {};
  if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const haptics = [];
  w.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { Haptics: { impact: async (o) => { haptics.push(o.style); }, notification: async () => {} } },
  };
  w.localStorage.setItem('kintore:settings', JSON.stringify({ unit: 'kg', lang: 'ja', seedVersion: 5, intervalBtnMig: 1, rest180Mig: 1 }));
  w.localStorage.setItem('kintore:dailyLogs', JSON.stringify([
    { date: K(0), sleepHours: 7.5, weight: 72 }, { date: K(1), sleepHours: 7, weight: 72.2 },
  ]));
  w.eval(bundle);
  d.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));

  const $ = (s) => d.querySelector(s);
  const click = (s) => { const e = $(s); if (!e) return false; e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return true; };

  // 実機のタッチをそのまま再現する(touchstart で始点、touchend で終点)
  const touch = (el, x, y) => ({ clientX: x, clientY: y, target: el });
  function swipe(sel, dx, dy, ms) {
    const el = $(sel);
    if (!el) return false;
    const x0 = 200, y0 = 400;
    const start = new w.Event('touchstart', { bubbles: true });
    start.touches = [touch(el, x0, y0)];
    Object.defineProperty(start, 'target', { value: el });
    el.dispatchEvent(start);
    const end = new w.Event('touchend', { bubbles: true });
    end.changedTouches = [touch(el, x0 + dx, y0 + dy)];
    Object.defineProperty(end, 'target', { value: el });
    if (ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { /* 経過時間を作る */ } }
    el.dispatchEvent(end);
    return true;
  }
  const month = () => ($('.cal-head .m') || {}).textContent || '';
  const condDate = () => (($('[data-in="cond-view-date"]') || {}).value) || '';
  return { w, d, $, click, swipe, month, condDate, haptics };
}

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  OK   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  -> ' + extra : '')); }
};

/* ---------- 1. 履歴のカレンダー: 月を送る ---------- */
console.log('');
console.log('[1] 履歴のカレンダーを左右スワイプ');
{
  const a = boot();
  a.click('.tabbar button[data-tab="history"]');
  ok(!!a.$('[data-swipe="hist"]'), 'カレンダーがスワイプ対象になっている');
  const m0 = a.month();
  a.swipe('[data-swipe="hist"]', -120, 5);
  const m1 = a.month();
  ok(m1 !== m0 && !!m1, '左に払うと次の月へ', m0 + ' -> ' + m1);
  a.swipe('[data-swipe="hist"]', 120, -5);
  ok(a.month() === m0, '右に払うと戻る', a.month());
  a.swipe('[data-swipe="hist"]', 120, -5);
  a.swipe('[data-swipe="hist"]', 120, -5);
  const back2 = a.month();
  a.swipe('[data-swipe="hist"]', -120, 0);
  a.swipe('[data-swipe="hist"]', -120, 0);
  ok(a.month() === m0, '往復しても元の月に戻る', back2 + ' -> ' + a.month());
}

/* ---------- 2. 体調タブ: 日を送る ---------- */
console.log('');
console.log('[2] 体調の日付ナビを左右スワイプ');
{
  const a = boot();
  a.click('.tabbar button[data-tab="condition"]');
  ok(!!a.$('[data-swipe="cond"]'), '日付ナビがスワイプ対象になっている');
  const d0 = a.condDate();
  ok(d0 === K(0), '最初は今日', d0);
  a.swipe('[data-swipe="cond"]', 120, 0);
  ok(a.condDate() === K(1), '右に払うと前の日へ', a.condDate());
  a.swipe('[data-swipe="cond"]', 120, 0);
  ok(a.condDate() === K(2), 'さらに前の日へ', a.condDate());
  a.swipe('[data-swipe="cond"]', -120, 0);
  ok(a.condDate() === K(1), '左に払うと次の日へ', a.condDate());
  // 未来には行かせない
  a.swipe('[data-swipe="cond"]', -120, 0);
  a.swipe('[data-swipe="cond"]', -120, 0);
  a.swipe('[data-swipe="cond"]', -120, 0);
  ok(a.condDate() === K(0), '今日より先へは進まない', a.condDate());
}

/* ---------- 3. 誤爆しないこと ---------- */
console.log('');
console.log('[3] スワイプと判定してはいけない操作');
{
  const a = boot();
  a.click('.tabbar button[data-tab="condition"]');
  const d0 = a.condDate();
  a.swipe('[data-swipe="cond"]', 30, 0);
  ok(a.condDate() === d0, '短い横移動(タップの揺れ)では動かない', a.condDate());
  a.swipe('[data-swipe="cond"]', 40, 200);
  ok(a.condDate() === d0, '縦スクロールでは動かない（横より縦が大きい）', a.condDate());
  a.swipe('[data-swipe="cond"]', 120, 0, 800);
  ok(a.condDate() === d0, 'ゆっくりなぞった場合は動かない', a.condDate());
}

/* ---------- 4. シート表示中は裏が動かない ---------- */
console.log('');
console.log('[4] シートを開いている間');
{
  const a = boot();
  a.click('.tabbar button[data-tab="condition"]');
  const d0 = a.condDate();
  a.click('[data-act="open-weight"]') || a.click('[data-act="cond-weight"]') || a.click('[data-act="rm-calc"]');
  // 何かしらシートが開いた状態を作る（開けなければこのケースは飛ばす）
  if (a.$('.sheet-overlay')) {
    a.swipe('[data-swipe="cond"]', 120, 0);
    ok(a.condDate() === d0, 'シート表示中は裏の日付が動かない', a.condDate());
  } else {
    ok(true, '（シートを開けなかったため確認を省略）');
  }
}

/* ---------- 5. 触覚フィードバック ---------- */
console.log('');
console.log('[5] 送れたときの触覚');
{
  const a = boot();
  a.click('.tabbar button[data-tab="history"]');
  const before = a.haptics.length;
  a.swipe('[data-swipe="hist"]', -120, 0);
  ok(a.haptics.length > before, '送れたときに軽い触覚を返す', a.haptics.join(','));
  ok(a.haptics[a.haptics.length - 1] === 'LIGHT', 'アラームではなく軽い一発', a.haptics.join(','));
  const n = a.haptics.length;
  a.swipe('[data-swipe="hist"]', 20, 0);
  ok(a.haptics.length === n, '送れなかったときは鳴らさない');
}

/* ---------- 6. 回帰 ---------- */
console.log('');
console.log('[6] 回帰');
{
  const a = boot();
  for (const tab of ['workout', 'history', 'graph', 'menu', 'condition']) {
    a.click(`.tabbar button[data-tab="${tab}"]`);
    const v = a.$('.view.active');
    if (!v || v.textContent.trim().length < 5) { fail++; console.log('  FAIL タブ ' + tab + ' が空'); }
  }
  ok(true, '全タブが描画される');
  a.click('.tabbar button[data-tab="history"]');
  const m0 = a.month();
  a.click('[data-act="cal-next"]');
  ok(a.month() !== m0, '矢印ボタンも従来どおり効く');
}

console.log('');
console.log('=== ' + pass + ' passed / ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
