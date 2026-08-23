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

function boot(seed, pre) {
  const dom = new JSDOM(indexHtml, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window, d = dom.window.document;
  w.scrollTo = () => {};
  if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.localStorage.setItem('kintore:settings', JSON.stringify({ unit: 'kg', lang: 'ja', seedVersion: 4, intervalBtnMig: 1, rest180Mig: 1 }));
  // pre は eval の前に走る。旧SEED_VERSIONの端末を再現して移行処理を通すために使う。
  if (pre) pre({ w, d });
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
  ok(!!seeded && seeded.muscle === 'back', '初期種目のシュラッグは「背中」で入っている', seeded && seeded.muscle);
  a.type('[data-in="newexname"]', 'シュラッグ');
  a.click('.chips [data-act="newex-muscle"][data-key="chest"]');
  a.click('[data-act="save-newex"]');
  ok(a.exs().length === before, '同名は作成されない（部位違いの重複ができない）');
  ok(/既にあります/.test(a.toastText()) && /背中/.test(a.toastText()), '既存の部位を添えて知らせる', a.toastText());
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
  const e4 = a.$('#exedit-err');
  ok(e4 && !e4.hidden && /別の種目が使っています/.test(e4.textContent), '理由がシート内に出る', e4 && e4.textContent);
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
  ok(shrug && shrug.muscle === 'back', 'シード側のシュラッグは背中');
  for (const tab of ['workout', 'history', 'graph', 'menu', 'condition']) {
    a.click(`.tabbar button[data-tab="${tab}"]`);
    const v = a.$('.view.active');
    if (!v || v.textContent.trim().length < 5) { fail++; console.log('  FAIL タブ ' + tab + ' が空'); }
  }
  ok(true, '全タブが描画される');
}

/* ---------- 7. 設定の「種目の管理」から直せること ---------- */
console.log('');
console.log('[7] 設定 → 種目の管理');
{
  const a = boot();
  const list = a.exs();
  list.push({ id: 'mine1', name: 'マイシュラッグ', muscle: 'chest', custom: true, order: list.length });
  a.w.localStorage.setItem('kintore:exercises', JSON.stringify(list));
  a.click('.tabbar button[data-tab="workout"]');
  a.click('[data-act="open-settings"]');
  ok(!!a.$('[data-act="ex-manage"]'), '設定に「種目の管理」がある');
  a.click('[data-act="ex-manage"]');
  const v = a.$('#view-settings').textContent;
  ok(/自分で追加した種目/.test(v), '自分で追加した種目の見出しが出る');
  ok(/最初から入っている種目/.test(v), '初期種目の見出しも出る');
  ok(v.indexOf('自分で追加した種目') < v.indexOf('最初から入っている種目'), '自分の種目が先に並ぶ');
  a.type('[data-in="exq"]', 'マイシュラッグ');
  const v2 = a.$('#view-settings').textContent;
  ok(/マイシュラッグ/.test(v2) && !/ベンチプレス/.test(v2), '検索で絞り込める');
  a.click('[data-act="ex-edit"][data-id="mine1"]');
  ok(!!a.$('[data-in="exeditname"]'), '一覧から編集シートが開く');
  a.click('.chips [data-act="exedit-muscle"][data-key="back"]');
  a.click('[data-act="save-exedit"]');
  ok(a.exs().find(e => e.id === 'mine1').muscle === 'back', '部位を背中に直せる');
  a.click('[data-act="ex-manage-back"]');
  ok(/種目の管理/.test(a.$('#view-settings').textContent), '設定一覧に戻れる');
}

/* ---------- 8. 履歴詳細から直せること（間違いに気づく画面） ---------- */
console.log('');
console.log('[8] 履歴の詳細画面から直せる');
{
  const a = boot();
  const list = a.exs();
  list.push({ id: 'hx1', name: 'シュラッグ自作', muscle: 'chest', custom: true, order: list.length });
  a.w.localStorage.setItem('kintore:exercises', JSON.stringify(list));
  a.w.localStorage.setItem('kintore:sessions', JSON.stringify([{
    id: 'sh', date: K(1), name: '背中の日', startedAt: K(1) + 'T19:00', finishedAt: K(1) + 'T20:00', done: true,
    exercises: [{ id: 'we', exerciseId: 'hx1', sets: [{ id: 's', weight: 25, reps: 30, warmup: false, done: true }] }]
  }]));
  a.click('.tabbar button[data-tab="history"]');
  // 「すべての記録」リストは廃止したので、実際の導線と同じくカレンダーの日をタップして開く
  a.click('.cal-cell[data-date="' + K(1) + '"]');
  const det = a.$('#view-history').textContent;
  ok(/シュラッグ自作/.test(det), '履歴の詳細が開く');
  ok(/胸/.test(det), '(修正前)胸と表示されている');
  ok(!!a.$('.tap-row[data-act="ex-edit"]'), '種目行から編集に行ける');
  a.click('.tap-row[data-act="ex-edit"]');
  ok(!!a.$('[data-in="exeditname"]'), '編集シートが開く');
  a.click('.chips [data-act="exedit-muscle"][data-key="back"]');
  a.click('[data-act="save-exedit"]');
  const det2 = a.$('#view-history').textContent;
  ok(/背中/.test(det2) && !/胸/.test(det2), 'その場で背中に直る', det2.slice(0, 80));
}

/* ---------- 9. シードの分類訂正が既存端末に届くこと（シュラッグ 肩→背中） ---------- */
console.log('');
console.log('[9] シードの部位訂正が既存の端末に反映される');
{
  const seedList = boot().exs();   // 現行シードの一覧を取る
  // 旧バージョン(SEED_VERSION=4, シュラッグ=肩)の端末を再現して起動させる
  const a = boot(null, ({ w }) => {
    const old = seedList.map(e => e.name === 'シュラッグ' ? Object.assign({}, e, { muscle: 'shoulder' }) : e);
    w.localStorage.setItem('kintore:exercises', JSON.stringify(old));
    w.localStorage.setItem('kintore:settings', JSON.stringify({ unit: 'kg', lang: 'ja', seedVersion: 4, intervalBtnMig: 1, rest180Mig: 1 }));
  });
  const after = a.exs().find(e => e.name === 'シュラッグ');
  ok(after && after.muscle === 'back', '旧データのシュラッグが背中に訂正される', after && after.muscle);
  ok(a.exs().filter(e => e.name === 'シュラッグ').length === 1, '重複して増えたりしない');
  const st = JSON.parse(a.w.localStorage.getItem('kintore:settings'));
  ok(st.seedVersion === 5, 'seedVersionが5に上がる', String(st.seedVersion));
}

/* ---------- 10. ユーザーが自分で直した種目は上書きしない ---------- */
console.log('');
console.log('[10] 自分で直した部位はシードの訂正より優先される');
{
  const seedList = boot().exs();
  const a = boot(null, ({ w }) => {
    // ユーザーが「シュラッグは肩でいい」と自分で編集した状態(edited=true)
    const old = seedList.map(e => e.name === 'シュラッグ' ? Object.assign({}, e, { muscle: 'shoulder', edited: true }) : e);
    w.localStorage.setItem('kintore:exercises', JSON.stringify(old));
    w.localStorage.setItem('kintore:settings', JSON.stringify({ unit: 'kg', lang: 'ja', seedVersion: 4, intervalBtnMig: 1, rest180Mig: 1 }));
  });
  const after = a.exs().find(e => e.name === 'シュラッグ');
  ok(after && after.muscle === 'shoulder', '編集済みの種目は肩のまま守られる', after && after.muscle);
}

/* ---------- 11. 編集するとeditedが立つ ---------- */
console.log('');
console.log('[11] 編集したら以後シードに上書きされない印がつく');
{
  const a = boot();
  a.click('.tabbar button[data-tab="workout"]');
  a.click('[data-act="open-settings"]');
  a.click('[data-act="ex-manage"]');
  a.type('[data-in="exq"]', 'シュラッグ');
  const target = a.exs().find(e => e.name === 'シュラッグ');
  ok(!target.edited, '初期状態ではeditedが立っていない');
  a.click('[data-act="ex-edit"][data-id="' + target.id + '"]');
  a.click('.chips [data-act="exedit-muscle"][data-key="shoulder"]');
  a.click('[data-act="save-exedit"]');
  const after = a.exs().find(e => e.id === target.id);
  ok(after.muscle === 'shoulder' && after.edited === true, '編集するとeditedが立つ');
}

/* ---------- 12. 新規インストールは最初から背中 ---------- */
console.log('');
console.log('[12] 新規インストール');
{
  const a = boot();
  const s = a.exs().find(e => e.name === 'シュラッグ');
  ok(s && s.muscle === 'back', '最初からシュラッグは背中', s && s.muscle);
  ok(a.exs().filter(e => e.name === 'シュラッグ').length === 1, '重複していない');
}

/* ---------- 13. 同名の重複があっても部位は直せる（今回の詰み） ---------- */
console.log('');
console.log('[13] 同名の重複があっても部位を直せる');
{
  const a = boot();
  // 初期種目のシュラッグ(背中)がある状態で、自作の「シュラッグ」(胸)を持っている端末
  const list = a.exs();
  list.push({ id: 'mine', name: 'シュラッグ', muscle: 'chest', custom: true, order: list.length });
  a.w.localStorage.setItem('kintore:exercises', JSON.stringify(list));
  a.click('.tabbar button[data-tab="workout"]');
  a.click('[data-act="open-settings"]');
  a.click('[data-act="ex-manage"]');
  a.click('[data-act="ex-edit"][data-id="mine"]');
  ok(!!a.$('[data-in="exeditname"]'), '編集シートが開く');
  // 名前は触らず部位だけ背中に変えて保存
  a.click('.chips [data-act="exedit-muscle"][data-key="back"]');
  a.click('[data-act="save-exedit"]');
  const after = a.exs().find(e => e.id === 'mine');
  ok(after && after.muscle === 'back', '名前が重複していても部位を保存できる', after && after.muscle);
}

/* ---------- 14. 名前を既存名に変えるのは今も止める ---------- */
console.log('');
console.log('[14] 名前を他の種目とぶつけるのは止める');
{
  const a = boot();
  const list = a.exs();
  list.push({ id: 'mine2', name: 'マイ種目', muscle: 'arm', custom: true, order: list.length });
  a.w.localStorage.setItem('kintore:exercises', JSON.stringify(list));
  a.click('.tabbar button[data-tab="workout"]');
  a.click('[data-act="open-settings"]');
  a.click('[data-act="ex-manage"]');
  a.click('[data-act="ex-edit"][data-id="mine2"]');
  a.type('[data-in="exeditname"]', 'ベンチプレス');
  a.click('[data-act="save-exedit"]');
  ok(a.exs().find(e => e.id === 'mine2').name === 'マイ種目', '既存名への変更はブロックされる');
  const errEl = a.$('#exedit-err');
  ok(errEl && !errEl.hidden && /別の種目が使っています/.test(errEl.textContent), 'エラーはシート内に出る(トーストではない)', errEl && errEl.textContent);
}

/* ---------- 15. 重複を1つにまとめられる ---------- */
console.log('');
console.log('[15] 重複した種目をまとめる');
{
  const a = boot();
  const list = a.exs();
  const seedShrug = list.find(e => e.name === 'シュラッグ');
  list.push({ id: 'mine3', name: 'シュラッグ', muscle: 'chest', custom: true, order: list.length });
  a.w.localStorage.setItem('kintore:exercises', JSON.stringify(list));
  a.w.localStorage.setItem('kintore:sessions', JSON.stringify([{
    id: 'sm', date: K(1), name: '背中の日', startedAt: K(1) + 'T19:00', finishedAt: K(1) + 'T20:00', done: true,
    exercises: [{ id: 'we', exerciseId: 'mine3', sets: [{ id: 's', weight: 25, reps: 30, warmup: false, done: true }] }]
  }]));
  a.click('.tabbar button[data-tab="workout"]');
  a.click('[data-act="open-settings"]');
  a.click('[data-act="ex-manage"]');
  a.click('[data-act="ex-edit"][data-id="mine3"]');
  const sheetTxt = a.$$('.sheet-overlay').slice(-1)[0].textContent;
  ok(/同じ名前の種目がもう1つあります/.test(sheetTxt), '重複していることを知らせる', sheetTxt.slice(0, 60));
  ok(!!a.$('[data-act="merge-exercise"]'), 'まとめるボタンが出る');
  a.click('[data-act="merge-exercise"]');
  a.click('[data-act="confirm-ok"]');
  ok(!a.exs().find(e => e.id === 'mine3'), '重複した方が消える');
  ok(a.exs().filter(e => e.name === 'シュラッグ').length === 1, 'シュラッグが1つになる');
  const ss = JSON.parse(a.w.localStorage.getItem('kintore:sessions'));
  ok(ss[0].exercises[0].exerciseId === seedShrug.id, '記録は残った方に付け替わる');
}

/* ---------- 16. カレンダーのドットが部位カラーになっていること ---------- */
console.log('');
console.log('[16] カレンダーの部位ドット');
{
  const a = boot();
  const ex = a.exs();
  const id = (n) => ex.find(e => e.name === n).id;
  const set = (w, r) => ({ id: 'x' + w + r, weight: w, reps: r, warmup: false, done: true });
  const day = K(1);
  a.w.localStorage.setItem('kintore:sessions', JSON.stringify([
    // 背中 7000kg > 腕 1200kg の日。記録順は腕→背中にして、量順に並ぶことを確認する
    { id: 'd1', date: day, name: '', startedAt: day + 'T19:00', finishedAt: day + 'T20:00', done: true,
      exercises: [
        { id: 'w1', exerciseId: id('アームカール'), sets: [set(20, 20), set(20, 20), set(20, 20)] },
        { id: 'w2', exerciseId: id('デッドリフト'), sets: [set(100, 10), set(100, 10), set(100, 10), set(100, 10), set(100, 10), set(100, 10), set(100, 10)] }
      ] },
    // 有酸素だけの日
    { id: 'd2', date: K(2), name: '', startedAt: K(2) + 'T19:00', finishedAt: K(2) + 'T20:00', done: true,
      exercises: [{ id: 'w3', exerciseId: id('トレッドミル'), sets: [{ id: 'c', duration: 30, distance: 5, done: true }] }] },
  ]));
  a.click('.tabbar button[data-tab="history"]');
  const cell = a.$('.cal-cell[data-date="' + day + '"]');
  ok(!!cell, '記録のある日のセルがある');
  const dots = Array.from(cell.querySelectorAll('.mk i')).map(i => i.getAttribute('style') || '');
  ok(dots.length === 2, 'やった部位の数だけドットが出る', String(dots.length));
  ok(/--m-back/.test(dots[0]), '1つ目はボリュームの大きい背中', dots[0]);
  ok(/--m-arm/.test(dots[1]), '2つ目は腕(記録順ではなく量順)', dots[1]);
  ok(!dots.some(d => d === ''), '白の無色ドットは残っていない');
  const cardio = a.$('.cal-cell[data-date="' + K(2) + '"] .mk i');
  ok(cardio && /--m-cardio/.test(cardio.getAttribute('style')), '有酸素だけの日も有酸素色で出る');
  const leg = a.$('.cal-legend');
  ok(!!leg, '凡例がある');
  ok(/背中/.test(leg.textContent) && /腕/.test(leg.textContent) && /有酸素/.test(leg.textContent), 'その月に出た部位が凡例にある');
  ok(!/胸/.test(leg.textContent), 'やっていない部位は凡例に出ない');
  ok(!/すべての記録/.test(a.$('#view-history').textContent), '「すべての記録」リストは無くなっている');
  a.click('.cal-cell[data-date="' + day + '"]');
  ok(!!a.$('.sheet-overlay') || /デッドリフト/.test(a.$('#view-history').textContent), '日をタップすれば記録に辿り着ける');
}

console.log(`\n=== ${pass} passed / ${fail} failed ===`);
process.exit(fail ? 1 : 0);
