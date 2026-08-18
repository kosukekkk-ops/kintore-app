/* test-exercise-edit.js — カスタム種目の「部位を間違えて登録してしまう」問題まわりを、
 * 実際に画面を操作して検証する。
 *
 * 背景: 追加シートの部位が「胸」で既定選択されていたため、部位を触らずに保存すると
 * 黙って胸になり、部位別ボリューム(プレミアム機能)の集計まで狂っていた。
 * 使い方: node tools/test-exercise-edit.js
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

function boot(seed) {
  const dom = new JSDOM(indexHtml, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window, d = dom.window.document;
  w.scrollTo = () => {};
  if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.localStorage.setItem('kintore:settings', JSON.stringify({ unit: 'kg', lang: 'ja', seedVersion: 4, intervalBtnMig: 1, rest180Mig: 1 }));
  w.eval(bundle);
  d.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  const $ = (s) => d.querySelector(s);
  const $$ = (s) => Array.from(d.querySelectorAll(s));
  const click = (s) => { const e = typeof s === 'string' ? $(s) : s; if (!e) return false; e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return true; };
  const type = (s, v) => { const e = $(s); if (!e) return false; e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); return true; };
  const exs = () => JSON.parse(w.localStorage.getItem('kintore:exercises') || '[]');
  const toastText = () => ($('.toast') || {}).textContent || '';
  const closeSheets = () => { $$('.sheet-overlay').forEach(o => o.remove()); d.body.classList.remove('sheet-open'); };
  if (seed) seed({ w, d, $, $$, exs });
  return { w, d, $, $$, click, type, exs, toastText, closeSheets };
}

let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  OK   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  → ' + extra : '')); }
};

// 記録画面まで進めてカスタム種目追加シートを開く
function openNewExSheet(a) {
  a.click('[data-act="start-empty"]');
  a.click('[data-act="pick-ex"]');
  a.click('[data-act="new-exercise"]');
  return !!a.$('[data-in="newexname"]');
}

/* ---------- 1. 追加時に部位を選ばせる ---------- */
console.log('\n[1] 部位を選ばずに保存できないこと（今回のバグの本体）');
{
  const a = boot();
  ok(openNewExSheet(a), 'カスタム種目追加シートが開く');
  ok(a.$$('.chips .chip.active').length === 0, '部位が既定で選択されていない（以前は「胸」が選択済みだった）');
  const before = a.exs().length;
  a.type('[data-in="newexname"]', 'シュラッグ2');
  a.click('[data-act="save-newex"]');
  ok(a.exs().length === before, '部位未選択では作成されない');
  ok(/部位を選んで/.test(a.toastText()), '部位を選ぶよう案内が出る', a.toastText());
  // 部位を選べば作れる
  a.click('.chips [data-act="newex-muscle"][data-key="back"]');
  a.click('[data-act="save-newex"]');
  const made = a.exs().find(e => e.name === 'シュラッグ2');
  ok(!!made, '部位を選べば作成できる');
  ok(made && made.muscle === 'back', '選んだ部位(背中)で保存される', made && made.muscle);
}

/* ---------- 2. シード種目と同名の重複を作らせない ---------- */
console.log('\n[2] 同名の種目が既にあるとき');
{
  const a = boot();
  openNewExSheet(a);
  const before = a.exs().length;
  const seeded = a.exs().find(e => e.name === 'シュラッグ');
  ok(!!seeded && seeded.muscle === 'shoulder', '初期種目のシュラッグは「肩」で入っている', seeded && seeded.muscle);
  a.type('[data-in="newexname"]', 'シュラッグ');
  a.click('.chips [data-act="newex-muscle"][data-key="chest"]');
  a.click('[data-act="save-newex"]');
  ok(a.exs().length === before, '同名は作成されない（部位違いの重複ができない）');
  ok(/既にあります/.test(a.toastText()) && /肩/.test(a.toastText()), '既存の部位を添えて知らせる', a.toastText());
}

/* ---------- 3. あとから部位を直せる ---------- */
console.log('\n[3] 登録済みの種目の部位を直せること');
{
  const a = boot();
  // 「胸」で登録してしまったカスタム種目を再現
  const list = a.exs();
  list.push({ id: 'wrong1', name: 'シュラッグ(自作)', muscle: 'chest', custom: true, order: list.length });
  a.w.localStorage.setItem('kintore:exercises', JSON.stringify(list));
  // その種目を使った記録も用意（部位別集計が直ることを見るため）
  a.w.localStorage.setItem('kintore:sessions', JSON.stringify([{
    id: 'sx', date: K(1), name: '背中の日', startedAt: K(1) + 'T19:00', finishedAt: K(1) + 'T20:00', done: true,
    exercises: [{ id: 'we1', exerciseId: 'wrong1', sets: [{ id: 's1', weight: 25, reps: 30, warmup: false, done: true }] }]
  }]));
  a.click('.tabbar button[data-tab="workout"]');

  a.click('[data-act="start-empty"]');
  a.click('[data-act="pick-ex"]');
  a.type('[data-in="pickq"]', 'シュラッグ(自作)');
  ok(!!a.$('[data-act="ex-info"]'), '検索で見つかる');
  a.click('[data-act="ex-info"]');
  ok(!!a.$('[data-act="ex-edit"]'), '解説シートに「編集」がある');
  a.click('[data-act="ex-edit"]');
  ok(!!a.$('[data-in="exeditname"]'), '編集シートが開く');
  const sheetTxt = a.$$('.sheet-overlay').slice(-1)[0].textContent;
  ok(/1回使われています/.test(sheetTxt), '使用回数が案内される', sheetTxt.slice(0, 80));
  a.click('.chips [data-act="exedit-muscle"][data-key="back"]');
  a.click('[data-act="save-exedit"]');
  const fixed = a.exs().find(e => e.id === 'wrong1');
  ok(fixed && fixed.muscle === 'back', '部位が背中に直る', fixed && fixed.muscle);
  ok(fixed && fixed.name === 'シュラッグ(自作)', '名前は変わらない');

  // 過去の記録の部位別ボリュームが胸→背中に移ったか
  a.closeSheets();
  a.click('.tabbar button[data-tab="graph"]');
  a.click('[data-act="graph-view"][data-v="exercise"]');
  const g = a.$('#view-graph').textContent;
  ok(!/胸/.test(g), '部位別ボリュームに「胸」が出なくなる', g.slice(0, 120));
  ok(/背中/.test(g), '「背中」として集計される');
}

/* ---------- 4. 名前も直せる / 重複はブロック ---------- */
console.log('\n[4] 名前の変更と重複チェック');
{
  const a = boot();
  const list = a.exs();
  list.push({ id: 'w2', name: 'マイ種目', muscle: 'arm', custom: true, order: list.length });
  a.w.localStorage.setItem('kintore:exercises', JSON.stringify(list));
  a.click('.tabbar button[data-tab="workout"]');
  a.click('[data-act="start-empty"]');
  a.click('[data-act="pick-ex"]');
  a.type('[data-in="pickq"]', 'マイ種目');
  a.click('[data-act="ex-info"]');
  a.click('[data-act="ex-edit"]');
  a.type('[data-in="exeditname"]', 'ベンチプレス');   // 既存のシード名にぶつける
  a.click('[data-act="save-exedit"]');
  ok(a.exs().find(e => e.id === 'w2').name === 'マイ種目', '既存名への変更はブロックされる');
  ok(/既にあります/.test(a.toastText()), '理由が出る', a.toastText());
  a.type('[data-in="exeditname"]', 'マイ種目2');
  a.click('[data-act="save-exedit"]');
  ok(a.exs().find(e => e.id === 'w2').name === 'マイ種目2', '別名なら変更できる');
}

/* ---------- 5. 削除は未使用のときだけ ---------- */
console.log('\n[5] 種目の削除');
{
  const a = boot();
  const list = a.exs();
  list.push({ id: 'unused1', name: '未使用種目', muscle: 'abs', custom: true, order: list.length });
  list.push({ id: 'used1', name: '使用中種目', muscle: 'abs', custom: true, order: list.length + 1 });
  a.w.localStorage.setItem('kintore:exercises', JSON.stringify(list));
  a.w.localStorage.setItem('kintore:sessions', JSON.stringify([{
    id: 'sy', date: K(1), name: '', startedAt: K(1) + 'T19:00', finishedAt: K(1) + 'T20:00', done: true,
    exercises: [{ id: 'we', exerciseId: 'used1', sets: [{ id: 's', weight: 10, reps: 10, warmup: false, done: true }] }]
  }]));
  a.click('.tabbar button[data-tab="workout"]');

  const openEdit = (name) => {
    a.closeSheets();
    a.click('[data-act="start-empty"]');
    a.click('[data-act="pick-ex"]');
    a.type('[data-in="pickq"]', name);
    a.click('[data-act="ex-info"]');
    a.click('[data-act="ex-edit"]');
  };
  openEdit('使用中種目');
  ok(!a.$('[data-act="del-exercise"]'), '記録で使われている種目に削除ボタンを出さない');
  openEdit('未使用種目');
  ok(!!a.$('[data-act="del-exercise"]'), '未使用の種目には削除ボタンが出る');
  a.click('[data-act="del-exercise"]');
  a.click('[data-act="confirm-ok"]');
  ok(!a.exs().find(e => e.id === 'unused1'), '削除できる');
  ok(!!a.exs().find(e => e.id === 'used1'), '使用中の種目は残る');
}

/* ---------- 6. 既存の記録を壊していないか ---------- */
console.log('\n[6] 回帰');
{
  const a = boot();
  ok(a.exs().length >= 80, '初期種目のシードが従来どおり', String(a.exs().length));
  const shrug = a.exs().find(e => e.name === 'シュラッグ');
  ok(shrug && shrug.muscle === 'shoulder', 'シード側のシュラッグは肩のまま');
  for (const tab of ['workout', 'history', 'graph', 'menu', 'condition']) {
    a.click(`.tabbar button[data-tab="${tab}"]`);
    const v = a.$('.view.active');
    if (!v || v.textContent.trim().length < 5) { fail++; console.log('  FAIL タブ ' + tab + ' が空'); }
  }
  ok(true, '全タブが描画される');
}

console.log(`\n=== ${pass} passed / ${fail} failed ===`);
process.exit(fail ? 1 : 0);
