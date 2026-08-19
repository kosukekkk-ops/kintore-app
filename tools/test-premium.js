/* test-premium.js — 無料版/プレミアム版のゲーティングをjsdomで実際に画面を動かして検証する。
 *
 * Web(PWA)版はストアが無いため常に全開放。課金対象はネイティブ版だけなので、
 * window.Capacitor をモックして「App Store版の無料ユーザー」を再現し、
 * ロックが出る/出ないと購入・復元の導線を実画面から確認する。
 * 使い方: node tools/test-premium.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, '..', 'node_modules', 'jsdom'));

const DOCS = path.join(__dirname, '..', 'docs');
const FILES = ['js/storage.js', 'js/premium.js', 'js/legal.js', 'js/native.js', 'js/data.js', 'js/charts.js', 'js/app.js'];
const bundle = FILES.map(f => fs.readFileSync(path.join(DOCS, f), 'utf8')).join('\n;\n');
const indexHtml = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');

const K = (back) => {
  const x = new Date(); x.setDate(x.getDate() - back);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};

// 種目IDを得るためにシードだけ先に走らせる
const pre = new JSDOM('<!doctype html><body>', { runScripts: 'outside-only', url: 'http://localhost:4174/' });
pre.window.eval(['js/storage.js', 'js/data.js'].map(f => fs.readFileSync(path.join(DOCS, f), 'utf8')).join('\n;\n') + '\n;Store.ensureSeed();');
const exList = JSON.parse(pre.window.localStorage.getItem('kintore:exercises'));
const byName = (n) => (exList.find(e => e.name === n) || exList[0]).id;

const sets = (n, wt, reps) => Array.from({ length: n }, (_, i) => ({ id: 'x' + n + i, weight: wt, reps, warmup: false, done: true }));

/* opts: { native, premium, templates, supps } */
function boot(opts) {
  const dom = new JSDOM(indexHtml, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:4174/' });
  const w = dom.window, d = w.document;
  w.scrollTo = () => {};
  if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  // App Store版の再現。getPurchases はキャッシュとズレていない前提の値を返す。
  if (opts.native) {
    const PID = 'io.github.kosukekkkops.torelog.premium';
    // 実StoreKitに合わせ、購入したらentitlementsにも現れるようにする
    // storeOwned を分けて渡せるようにする。機種変更・返金の直後は
    // 「端末のフラグ」と「StoreKitの実態」がズレている状態を作れる必要がある。
    let owned = opts.storeOwned === undefined ? !!opts.premium : opts.storeOwned;
    const np = {
      getPurchases: async () => ({ purchases: owned ? [{ productIdentifier: PID }] : [] }),
      getProduct: async () => ({ product: { priceString: '¥980' } }),
      purchaseProduct: async () => { owned = true; return {}; },
      restorePurchases: async () => { owned = !!opts.restorable; return {}; },
    };
    w.Capacitor = { isNativePlatform: () => true, Plugins: { NativePurchases: np } };
    w.__np = np;
    w.__setOwned = (v) => { owned = v; };
  }
  const LS = w.localStorage;
  LS.setItem('kintore:exercises', JSON.stringify(exList));
  LS.setItem('kintore:sessions', JSON.stringify([
    { id: 'a', date: K(2), name: '胸', startedAt: K(2) + 'T19:00', finishedAt: K(2) + 'T20:00', done: true,
      exercises: [{ id: 'w1', exerciseId: byName('ベンチプレス'), sets: sets(4, 80, 10) }] },
    { id: 'b', date: K(5), name: '背中', startedAt: K(5) + 'T19:00', finishedAt: K(5) + 'T20:00', done: true,
      exercises: [{ id: 'w2', exerciseId: byName('デッドリフト'), sets: sets(4, 100, 8) }] },
  ]));
  LS.setItem('kintore:dailyLogs', JSON.stringify([
    { date: K(0), sleepHours: 7.5, sleepQuality: 4, calories: 2000, protein: 120 },
    { date: K(1), sleepHours: 7.0, sleepQuality: 4, calories: 1900, protein: 110 },
    { date: K(2), sleepHours: 6.5, sleepQuality: 3, calories: 2100, protein: 130 },
  ]));
  LS.setItem('kintore:templates', JSON.stringify(
    Array.from({ length: opts.templates || 0 }, (_, i) => ({ id: 'tpl' + i, name: 'メニュー' + i, description: '', order: i, exercises: [] }))));
  LS.setItem('kintore:supplements', JSON.stringify(
    Array.from({ length: opts.supps || 0 }, (_, i) => ({ id: 'sp' + i, name: 'サプリ' + i, dose: '', slots: ['morning'], days: 'all', order: i }))));
  LS.setItem('kintore:premium', JSON.stringify(!!opts.premium));
  LS.setItem('kintore:settings', JSON.stringify({ unit: 'kg', lang: 'ja', seedVersion: 4, intervalBtnMig: 1, rest180Mig: 1 }));

  w.eval(bundle);
  d.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  const $ = (s) => d.querySelector(s);
  const $$ = (s) => Array.from(d.querySelectorAll(s));
  const click = (s) => { const e = $(s); if (!e) return false; e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return true; };
  const tab = (x) => click(`.tabbar button[data-tab="${x}"]`);
  const sheetText = () => ($('.sheet-overlay') || {}).textContent || '';
  const closeSheets = () => { $$('.sheet-overlay').forEach(o => o.remove()); d.body.classList.remove('sheet-open'); };
  return { w, d, $, $$, click, tab, sheetText, closeSheets };
}

let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  OK   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  → ' + extra : '')); }
};

/* ---------- 1. Web(PWA)版: ストアが無いので全開放 ---------- */
console.log('\n[1] Web版(ストアなし) = 全機能開放');
{
  const a = boot({ native: false, templates: 5, supps: 5 });
  a.tab('graph');
  ok(!a.$('.lock-card'), 'グラフにロックが出ない');
  a.click('[data-act="graph-view"][data-v="exercise"]');
  ok(!a.$('.lock-card') && !!a.$('[data-in="graph-ex"]'), '種目別グラフが開く');
  a.tab('menu');
  ok(!a.$('.quota'), '無料枠バッジが出ない');
  a.click('[data-act="new-template"]');
  ok(!!a.$('[data-in="tpl-name"]'), '5件目でもメニューを追加できる');
  a.tab('settings');
  a.click('[data-act="open-settings"]');
  ok(!/プレミアム/.test(a.$('#view-settings').textContent), '設定にプレミアム欄が出ない');
}

/* ---------- 2. App Store版・無料ユーザー ---------- */
console.log('\n[2] App Store版・無料ユーザー = ロックと購入導線');
{
  const a = boot({ native: true, premium: false, templates: 3, supps: 3 });
  a.tab('graph');
  const g = a.$('#view-graph').textContent;
  ok(/今週の記録状況/.test(g), 'バランスの記録状況カードは無料で見られる', g.slice(0, 60));
  ok(/3本柱の達成度/.test(g), 'バランスの達成度カードは無料で見られる');
  ok(!!a.$('.lock-card') && !/推移（直近14日）/.test(g), '14日推移がロックされている');
  a.click('[data-act="graph-view"][data-v="exercise"]');
  ok(!!a.$('.lock-card') && !a.$('[data-in="graph-ex"]'), '種目別グラフがロックされている');

  // ロックカードをタップ → ペイウォールが理由付きで開く
  a.click('.lock-card');
  const txt = a.sheetText();
  ok(/トレログ プレミアム/.test(txt), 'ペイウォールが開く');
  ok(/種目別/.test(txt), '開いた理由が書かれている', txt.slice(0, 80));
  ok(/購入を復元/.test(txt), '復元ボタンがある(Apple必須)');
  ok(/メニューを無制限に/.test(txt) && /サプリを無制限に/.test(txt), '解放される内容が列挙されている');
  a.closeSheets();

  // 上限に当たる操作
  a.tab('menu');
  ok(/無料枠 3\/3/.test(a.$('#view-menu').textContent), '無料枠の残量が表示される');
  a.click('[data-act="new-template"]');
  ok(/メニューの保存は無料版では3件まで/.test(a.sheetText()), '4件目でペイウォール', a.sheetText().slice(0, 60));
  ok(!a.$('[data-in="tpl-name"]'), '編集画面には進まない');
  a.closeSheets();

  a.tab('condition');
  a.click('[data-act="supps-manage"]') || a.click('[data-act="supp-manage"]');
  a.click('[data-act="supp-add"]');
  ok(/サプリの登録は無料版では3件まで/.test(a.sheetText()), '4件目のサプリでペイウォール', a.sheetText().slice(0, 60));
  a.closeSheets();

  a.click('[data-act="open-settings"]');
  const st = a.$('#view-settings').textContent;
  ok(/プレミアム/.test(st), '設定にプレミアム欄がある');
  ok(/購入を復元/.test(st), '設定からも復元できる(Apple必須)');
  a.click('[data-act="export"]');
  ok(/バックアップの書き出し/.test(a.sheetText()), '書き出しでペイウォール', a.sheetText().slice(0, 60));
}

/* ---------- 3. App Store版・購入済み ---------- */
console.log('\n[3] App Store版・購入済み = 全機能開放');
{
  const a = boot({ native: true, premium: true, templates: 5, supps: 5 });
  a.tab('graph');
  ok(!a.$('.lock-card'), 'バランスにロックが無い');
  a.click('[data-act="graph-view"][data-v="exercise"]');
  ok(!!a.$('[data-in="graph-ex"]') && !a.$('.lock-card'), '種目別グラフが開く');
  a.tab('menu');
  ok(!a.$('.quota'), '無料枠バッジが消える');
  a.click('[data-act="new-template"]');
  ok(!!a.$('[data-in="tpl-name"]'), '6件目のメニューを追加できる');
  a.click('[data-act="menu-back"]'); a.closeSheets();
  a.click('[data-act="open-settings"]');
  ok(/ご利用中/.test(a.$('#view-settings').textContent), '設定が購入済み表示になる');
}

/* ---------- 4. 購入フロー(モックのStoreKit経由) ---------- */
console.log('\n[4] 購入と復元');
(async () => {
  {
    const a = boot({ native: true, premium: false, templates: 0, supps: 0 });
    a.click('[data-act="open-settings"]');
    a.click('[data-act="paywall"]');
    ok(/トレログ プレミアム/.test(a.sheetText()), '設定からペイウォールを開ける');
    a.click('[data-act="premium-buy"]');
    await new Promise(r => setTimeout(r, 30));
    ok(JSON.parse(a.w.localStorage.getItem('kintore:premium')) === true, '購入でフラグが立つ');
    a.tab('graph');
    a.click('[data-act="graph-view"][data-v="exercise"]');
    ok(!a.$('.lock-card'), '購入直後にロックが外れる');
  }
  {
    // 別端末で購入済み(端末フラグは未購入のまま) → 起動時のsyncで解放される
    const a = boot({ native: true, premium: false, storeOwned: true });
    await new Promise(r => setTimeout(r, 60));
    ok(JSON.parse(a.w.localStorage.getItem('kintore:premium')) === true, '起動時syncで購入済みを検出');
  }
  {
    // 返金・購入取消(端末フラグは購入済みのまま) → 起動時のsyncでロックが戻る
    const a = boot({ native: true, premium: true, storeOwned: false });
    await new Promise(r => setTimeout(r, 60));
    ok(JSON.parse(a.w.localStorage.getItem('kintore:premium')) === false, '返金後はプレミアムが外れる');
  }
  {
    // 起動時syncが遅れて返る間に購入 → 古い「未購入」で上書きされない
    const a = boot({ native: true, premium: false });
    const orig = a.w.__np.getPurchases;
    a.w.__np.getPurchases = () => new Promise(r => setTimeout(() => orig().then(r), 120));
    a.d.dispatchEvent(new a.w.Event('DOMContentLoaded', { bubbles: true }));
    a.click('[data-act="open-settings"]');
    a.click('[data-act="paywall"]');
    a.click('[data-act="premium-buy"]');
    await new Promise(r => setTimeout(r, 250));
    ok(JSON.parse(a.w.localStorage.getItem('kintore:premium')) === true, '遅れて返ったsyncが購入を打ち消さない');
  }
  {
    // 復元できる購入が無いとき
    const a = boot({ native: true, premium: false, restorable: false });
    a.click('[data-act="open-settings"]');
    a.click('[data-act="premium-restore"]');
    await new Promise(r => setTimeout(r, 40));
    ok(JSON.parse(a.w.localStorage.getItem('kintore:premium')) === false, '復元対象が無ければ解放されない');
  }
  {
    // 他端末で購入済み → 復元で解放
    const a = boot({ native: true, premium: false, restorable: true });
    a.click('[data-act="open-settings"]');
    a.click('[data-act="premium-restore"]');
    await new Promise(r => setTimeout(r, 40));
    ok(JSON.parse(a.w.localStorage.getItem('kintore:premium')) === true, '復元でプレミアムが戻る');
  }

  console.log(`\n=== ${pass} passed / ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
