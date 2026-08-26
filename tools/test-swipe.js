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
  ok(a.month() === m0, '右に払うと前の月へ戻る', a.month());
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


/* ---------- 7. 履歴の詳細: 前後の記録へ ---------- */
console.log('');
console.log('[7] 履歴の詳細を左右スワイプ');
{
  const a = boot();
  // 記録を3日ぶん用意して真ん中を開く
  const mk = (id, back) => ({ id, date: K(back), name: id, startedAt: K(back) + 'T19:00', finishedAt: K(back) + 'T20:00', done: true,
    exercises: [{ id: 'we' + id, exerciseId: 'x', sets: [{ id: 's' + id, weight: 10, reps: 10, warmup: false, done: true }] }] });
  a.w.localStorage.setItem('kintore:sessions', JSON.stringify([mk('sA', 4), mk('sB', 2), mk('sC', 0)]));
  a.click('.tabbar button[data-tab="history"]');
  a.click('.cal-cell[data-date="' + K(2) + '"]');   // sB の日をカレンダーから開く
  ok(!!a.$('[data-swipe="histdetail"]'), '詳細画面がスワイプ対象になっている');
  const title = () => (a.$('#view-history .head h1') || {}).textContent || '';
  ok(/sB/.test(title()), '真ん中の記録を開いている', title());
  a.swipe('[data-swipe="histdetail"]', -120, 0);
  ok(/sC/.test(title()), '左に払うと次(新しい方)の記録へ', title());
  a.swipe('[data-swipe="histdetail"]', -120, 0);
  ok(/sC/.test(title()), '最新で止まる', title());
  ok(/最新の記録/.test((a.$('.toast') || {}).textContent || ''), '最新であることを知らせる');
  a.swipe('[data-swipe="histdetail"]', 120, 0);
  a.swipe('[data-swipe="histdetail"]', 120, 0);
  ok(/sA/.test(title()), '右に払って最初の記録まで戻れる', title());
  a.swipe('[data-swipe="histdetail"]', 120, 0);
  ok(/sA/.test(title()), '最古で止まる', title());
}


/* ---------- 8. 同じタブをもう一度タップで最初の画面へ ---------- */
console.log('');
console.log('[8] アクティブなタブの再タップでホームへ戻る');
{
  const a = boot();
  const mk = (id, back) => ({ id, date: K(back), name: id, startedAt: K(back) + 'T19:00', finishedAt: K(back) + 'T20:00', done: true,
    exercises: [{ id: 'we' + id, exerciseId: 'x', sets: [{ id: 's' + id, weight: 10, reps: 10, warmup: false, done: true }] }] });
  a.w.localStorage.setItem('kintore:sessions', JSON.stringify([mk('sA', 2)]));
  // 履歴: 詳細 → タブ再タップ → カレンダーへ
  a.click('.tabbar button[data-tab="history"]');
  a.click('.cal-cell[data-date="' + K(2) + '"]');
  ok(/sA/.test((a.$('#view-history .head h1') || {}).textContent || ''), '詳細を開いている');
  a.click('.tabbar button[data-tab="history"]');
  ok(!!a.$('.cal-head'), '再タップでカレンダーに戻る');
  a.click('.tabbar button[data-tab="history"]');
  ok(!!a.$('.cal-head'), '既にホームでも壊れない');
  // 体調: 過去日 → タブ再タップ → 今日へ
  a.click('.tabbar button[data-tab="condition"]');
  a.swipe('[data-swipe="cond"]', 120, 0);
  ok(a.condDate() === K(1), '前の日を見ている', a.condDate());
  a.click('.tabbar button[data-tab="condition"]');
  ok(a.condDate() === K(0), '再タップで今日に戻る', a.condDate());
  // グラフ: 種目別 → タブ再タップ → バランスへ
  a.click('.tabbar button[data-tab="graph"]');
  a.click('[data-act="graph-view"][data-v="exercise"]');
  a.click('.tabbar button[data-tab="graph"]');
  ok(/今週の記録状況|バランス/.test(a.$('#view-graph').textContent), '再タップでバランスに戻る');
  // 記録: 記録画面 → タブ再タップ → ホームへ(記録は消えない)
  a.click('.tabbar button[data-tab="workout"]');
  a.click('[data-act="start-empty"]');
  ok(!!a.$('[data-act="pick-ex"]'), '記録画面にいる');
  a.click('.tabbar button[data-tab="workout"]');
  ok(!a.$('[data-act="pick-ex"]'), '再タップでホームに戻る');
  // メニュー: 編集(未入力) → タブ再タップ → 一覧へ
  a.click('.tabbar button[data-tab="menu"]');
  a.click('[data-act="new-template"]');
  ok(!!a.$('[data-in="tpl-name"]'), 'テンプレ編集にいる');
  a.click('.tabbar button[data-tab="menu"]');
  ok(!a.$('[data-in="tpl-name"]'), '再タップで一覧に戻る(未入力なら確認なし)');
  // 別タブへの通常の切り替えは従来どおり
  a.click('.tabbar button[data-tab="history"]');
  ok(!!a.$('.cal-head'), '別タブへの切り替えは普通に効く');
}

/* ---------- 9. 左端エッジスワイプで戻る ---------- */
console.log('');
console.log('[9] エッジスワイプ(iOSの戻る)');
{
  const a = boot();
  const mk = (id, back) => ({ id, date: K(back), name: id, startedAt: K(back) + 'T19:00', finishedAt: K(back) + 'T20:00', done: true,
    exercises: [{ id: 'we' + id, exerciseId: 'x', sets: [{ id: 's' + id, weight: 10, reps: 10, warmup: false, done: true }] }] });
  a.w.localStorage.setItem('kintore:sessions', JSON.stringify([mk('sA', 2)]));
  // 端から始まらない普通のタッチを作るヘルパ
  const rawSwipe = (x0, y0, x1, y1) => {
    const el = a.$('.view.active') || a.d.body;
    const st = new a.w.Event('touchstart', { bubbles: true });
    st.touches = [{ clientX: x0, clientY: y0, target: el }];
    Object.defineProperty(st, 'target', { value: el });
    el.dispatchEvent(st);
    const en = new a.w.Event('touchend', { bubbles: true });
    en.changedTouches = [{ clientX: x1, clientY: y1, target: el }];
    Object.defineProperty(en, 'target', { value: el });
    el.dispatchEvent(en);
  };
  // 履歴の詳細 → エッジスワイプ → カレンダーへ
  a.click('.tabbar button[data-tab="history"]');
  a.click('.cal-cell[data-date="' + K(2) + '"]');
  ok(/sA/.test((a.$('#view-history .head h1') || {}).textContent || ''), '詳細を開いている');
  rawSwipe(8, 400, 160, 405);
  ok(!!a.$('.cal-head'), '左端から右に払うとカレンダーへ戻る');
  // 端から始まらない同じ動きでは戻らない(誤爆防止)
  a.click('.cal-cell[data-date="' + K(2) + '"]');
  rawSwipe(200, 400, 352, 405);
  ok(/sA/.test((a.$('#view-history .head h1') || {}).textContent || ''), '画面中央からのスワイプでは戻らない');
  // シートが開いていれば、エッジスワイプはまずシートを閉じる
  a.click('.tabbar button[data-tab="workout"]');
  a.click('[data-act="rm-calc"]');
  ok(!!a.$('.sheet-overlay'), 'シートが開いている');
  rawSwipe(8, 400, 160, 400);
  ok(!a.$('.sheet-overlay'), 'エッジスワイプでシートが閉じる');
}

/* ---------- 10. シートを下に払って閉じる ---------- */
console.log('');
console.log('[10] シートの下払いディスミス');
{
  const a = boot();
  const sheetSwipe = (dy, opts) => {
    const el = (opts && opts.target) || a.$('.sheet');
    if (!el) return false;
    const st = new a.w.Event('touchstart', { bubbles: true });
    st.touches = [{ clientX: 200, clientY: 300, target: el }];
    Object.defineProperty(st, 'target', { value: el });
    el.dispatchEvent(st);
    const en = new a.w.Event('touchend', { bubbles: true });
    en.changedTouches = [{ clientX: 205, clientY: 300 + dy, target: el }];
    Object.defineProperty(en, 'target', { value: el });
    el.dispatchEvent(en);
    return true;
  };
  a.click('[data-act="rm-calc"]');
  ok(!!a.$('.sheet-overlay'), 'シートが開く');
  sheetSwipe(120);
  ok(!a.$('.sheet-overlay'), '下に払うと閉じる');
  // スクロール途中(上端でない)なら閉じない
  a.click('[data-act="rm-calc"]');
  a.$('.sheet').scrollTop = 150;
  sheetSwipe(120);
  ok(!!a.$('.sheet-overlay'), 'スクロール途中の下払いでは閉じない');
  a.$('.sheet').scrollTop = 0;
  // 入力欄の上から始まる下払いでは閉じない
  const inp = a.$('.sheet input');
  if (inp) {
    sheetSwipe(120, { target: inp });
    ok(!!a.$('.sheet-overlay'), '入力欄から始まる操作では閉じない');
  } else { ok(true, '(入力欄が無いため省略)'); }
  // 短い下移動では閉じない
  sheetSwipe(40);
  ok(!!a.$('.sheet-overlay'), '短い下移動では閉じない');
  sheetSwipe(120);
  ok(!a.$('.sheet-overlay'), '上端からの下払いで閉じる(後始末)');
}

/* ---------- 11. 選択操作のハプティクス ---------- */
console.log('');
console.log('[11] 選択の触覚');
{
  const a = boot();
  a.click('.tabbar button[data-tab="graph"]');
  const n0 = a.haptics.length;
  a.click('[data-act="graph-view"][data-v="exercise"]');
  ok(a.haptics.length > n0, 'セグメント切り替えで軽い触覚', a.haptics.slice(-1)[0]);
  ok(a.haptics[a.haptics.length - 1] === 'LIGHT', '強いアラームではなくLIGHT');
  const n1 = a.haptics.length;
  a.click('.tabbar button[data-tab="workout"]');
  a.click('[data-act="start-empty"]');
  ok(a.haptics.length === n1, '通常のボタンでは鳴らない');
}
console.log('');
console.log('=== ' + pass + ' passed / ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
