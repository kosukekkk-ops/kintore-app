/* build-screens.js — 全画面のHTMLをjsdomで機械的に収集し、注記できる1枚のHTMLにまとめる。
 * 実物のCSSとフォントをそのまま埋め込み、各画面をiframeで隔離して再現するため、
 * スクリーンショットではなく「本物のUI」がそのまま並ぶ(拡大しても崩れない)。
 * 使い方: node tools/build-screens.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('C:/Users/kosuk/Claude/fe-master-app/node_modules/jsdom');

const DOCS = path.join(__dirname, '..', 'docs');
const OUT = process.argv[2] || path.join(__dirname, '..', 'screens.html');

/* ---------- アプリをjsdomで起動 ---------- */
const indexHtml = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
const dom = new JSDOM(indexHtml, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:4174/' });
const w = dom.window, d = w.document;

// 画面計測系はjsdomに無いので最低限のダミーを用意(描画結果には影響しない)
w.scrollTo = () => {};
if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

/* ---------- デモデータ(空画面ばかりにならないよう現実的な内容を入れる) ---------- */
// アプリの Data.dateKey と同じくローカル時刻基準で作る(UTCだとJSTで1日ズレる)
const K = (back) => {
  const x = new Date(); x.setDate(x.getDate() - back);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};
const today = K(0);

// 先に種目マスタを作るためシードだけ走らせる → そのあと本データを流し込む
const bundle = ['js/storage.js', 'js/data.js', 'js/charts.js', 'js/app.js']
  .map(f => fs.readFileSync(path.join(DOCS, f), 'utf8')).join('\n;\n');

// storage/data だけ先に評価して種目IDを得る
const pre = new JSDOM('<!doctype html><body>', { runScripts: 'outside-only', url: 'http://localhost:4174/' });
pre.window.eval(['js/storage.js', 'js/data.js'].map(f => fs.readFileSync(path.join(DOCS, f), 'utf8')).join('\n;\n') + '\n;Store.ensureSeed();');
const exList = JSON.parse(pre.window.localStorage.getItem('kintore:exercises'));
const byName = (n) => (exList.find(e => e.name === n) || exList[0]).id;

const mkSets = (n, wt, reps, done) => Array.from({ length: n }, (_, i) => ({ id: 's' + Math.random().toString(36).slice(2, 7), weight: wt, reps, warmup: false, done }));
const sessions = [
  { id: 'sess-a', date: today, name: '胸の日', note: '調子よかった', startedAt: today + 'T19:00:00Z', finishedAt: null, done: false,
    exercises: [
      { id: 'we1', exerciseId: byName('ベンチプレス'), note: '', sets: mkSets(3, 80, 10, true).concat(mkSets(1, 85, 8, false)) },
      { id: 'we2', exerciseId: byName('インクラインチェストプレス'), note: '', sets: mkSets(3, 50, 12, true) }
    ] },
  { id: 'sess-b', date: K(2), name: '背中の日', note: '', startedAt: K(2) + 'T19:00:00Z', finishedAt: K(2) + 'T20:10:00Z', done: true,
    exercises: [
      { id: 'we3', exerciseId: byName('デッドリフト'), note: 'フォーム意識', sets: mkSets(4, 100, 8, true) },
      { id: 'we4', exerciseId: byName('ラットプルダウン'), note: '', sets: mkSets(3, 55, 12, true) }
    ] },
  { id: 'sess-c', date: K(4), name: '脚の日', note: '', startedAt: K(4) + 'T19:00:00Z', finishedAt: K(4) + 'T20:30:00Z', done: true,
    exercises: [{ id: 'we5', exerciseId: byName('スクワット'), note: '', sets: mkSets(4, 90, 10, true) }] },
  { id: 'sess-d', date: K(6), name: '', note: '', startedAt: K(6) + 'T19:00:00Z', finishedAt: K(6) + 'T20:00:00Z', done: true,
    exercises: [{ id: 'we6', exerciseId: byName('トレッドミル'), note: '', sets: [{ id: 'sc1', duration: 30, distance: 5, done: true }] }] }
];
const supps = [
  { id: 'sp1', name: 'プロテイン', dose: '30g', slots: ['postW'], days: 'all', order: 0 },
  { id: 'sp2', name: 'クレアチン', dose: '5g', slots: ['postW'], days: 'all', order: 1 },
  { id: 'sp3', name: 'マルチビタミン', dose: '1粒', slots: ['morning'], days: 'all', order: 2 },
  { id: 'sp4', name: 'EAA', dose: '10g', slots: ['preW'], days: 'training', order: 3 }
];
const logs = [
  { date: today, bedTime: '23:30', wakeTime: '07:00', sleepHours: 7.5, sleepQuality: 4, weight: 72.5,
    meals: [
      { id: 'm1', slot: 'breakfast', name: 'オートミール', kcal: 350, protein: 12 },
      { id: 'm2', slot: 'lunch', name: '鶏胸肉と白米', kcal: 720, protein: 48 },
      { id: 'm3', slot: 'snack', name: 'プロテイン', kcal: 120, protein: 24 }
    ], calories: 1190, protein: 84 },
  { date: K(1), restDay: true, sleepHours: 8, sleepQuality: 5, weight: 72.6 },
  { date: K(2), bedTime: '00:10', wakeTime: '06:40', sleepHours: 6.5, sleepQuality: 3, weight: 72.4, calories: 2200, protein: 140 },
  { date: K(3), noFood: true, sleepHours: 7, sleepQuality: 4, weight: 72.7 },
  { date: K(4), sleepHours: 7.2, sleepQuality: 4, weight: 72.8, calories: 2050, protein: 125 },
  { date: K(5), sleepHours: 6.8, sleepQuality: 3, weight: 72.9 },
  { date: K(6), sleepHours: 7.6, sleepQuality: 5, weight: 73.0, calories: 1980, protein: 118 }
];
const templates = [
  { id: 'tpl1', name: 'プッシュの日', description: '胸・肩・三頭', order: 0,
    exercises: [{ exerciseId: byName('ベンチプレス'), sets: 4, reps: 8, weight: 80 }, { exerciseId: byName('ショルダープレス'), sets: 3, reps: 12, weight: 40 }] },
  { id: 'tpl2', name: 'プルの日', description: '背中・二頭', order: 1,
    exercises: [{ exerciseId: byName('デッドリフト'), sets: 4, reps: 8, weight: 100 }] }
];

const LS = w.localStorage;
LS.setItem('kintore:exercises', JSON.stringify(exList));
LS.setItem('kintore:sessions', JSON.stringify(sessions));
LS.setItem('kintore:dailyLogs', JSON.stringify(logs));
LS.setItem('kintore:templates', JSON.stringify(templates));
LS.setItem('kintore:supplements', JSON.stringify(supps));
LS.setItem('kintore:suppLogs', JSON.stringify([{ date: today, taken: ['sp3|morning'] }]));
LS.setItem('kintore:settings', JSON.stringify({ unit: 'kg', lang: 'ja', restDefault: 180, restAuto: false, goalVolume: 5000, goalSleep: 7.5, goalProtein: 120, goalCalories: 2000, timerStyle: 'large', seedVersion: 4, intervalBtnMig: 1, rest180Mig: 1 }));

w.eval(bundle);
// jsdomでは readyState が 'loading' のままなので、boot() を起こすために自分で発火する
d.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));

/* ---------- 収集 ---------- */
const $ = (s) => d.querySelector(s);
const $$ = (s) => Array.from(d.querySelectorAll(s));
const click = (s) => { const e = $(s); if (!e) return false; e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return true; };
const clickText = (sel, text) => { const e = $$(sel).find(x => (x.textContent || '').includes(text)); if (!e) return false; e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return true; };
const setVal = (s, v) => { const e = $(s); if (!e) return false; e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); return true; };

const screens = [];
function grab(cat, name, desc) {
  const view = $('.view.active');
  const extras = ['#session-abar', '#cond-abar', '#timer-bar', '#timer-big']
    .map(s => $(s)).filter(Boolean).map(e => e.outerHTML)
    .concat($$('.sheet-overlay').map(e => e.outerHTML));
  screens.push({
    id: 'S' + String(screens.length + 1).padStart(2, '0'),
    cat, name, desc,
    bodyClass: d.body.className,
    html: (view ? view.outerHTML : '') + $('nav.tabbar').outerHTML + extras.join('')
  });
}
const closeSheets = () => { $$('.sheet-overlay').forEach(o => o.remove()); d.body.classList.remove('sheet-open'); };
const tab = (t) => click(`.tabbar button[data-tab="${t}"]`);

// --- 記録タブ ---
tab('workout');
grab('記録', 'ホーム（記録中）', '進行中セッションがある状態。達成リング＝運動、下に睡眠/食事/サプリの3本柱カード、今日のメニュー、主CTA。');

click('[data-act="resume"]');
grab('記録', 'ワークアウト記録画面', 'セット表(重量・回数・完了✓・削除)、種目ごとの🗑と⋯、下部固定バー(破棄/完了して保存/インターバル)。');

click('[data-act="ex-menu"]');
grab('記録', '種目メニュー（⋯）', 'この種目について／種目メモ／並び替え／削除。');
closeSheets();

click('[data-act="pick-ex"]');
grab('記録', '種目を選ぶ（ピッカー）', '検索・部位チップ・最近使った種目・サブ部位見出し・器具タグ・ⓘ。今回スクロール貫通を修正した画面。');

click('.pick-info');
grab('記録', '種目の詳細', '動作イメージ図、鍛える筋肉、筋肉マップ、フォームのポイント、外部検索リンク。ピッカーの上に重なる。');
closeSheets();

click('[data-act="pick-ex"]');
click('[data-act="new-exercise"]');
grab('記録', 'カスタム種目を追加', '種目名と部位チップ。戻るでピッカーへ復帰。');
closeSheets();

click('[data-act="rest-start"]');
grab('記録', 'レストタイマー（大表示）', '全画面。巨大な残り時間＋30秒/一時停止/削除。右上▾で小バーに縮小。');

click('[data-act="timer-min"]');
grab('記録', 'レストタイマー（小バー）', '下部の細いバー。進捗ラインつき。タップで大表示へ戻る。');
click('[data-act="timer-skip"]');

click('[data-act="finish-session"]');
grab('記録', '保存時の確認（✓なし）', '完了チェックのないセットが残っている場合の確認。✓を付けて保存／未実施として削除。');
closeSheets();

click('[data-act="close-session"]');
click('[data-act="rm-calc"]');
grab('記録', 'RM計算機', '重量と回数から推定1RMと%換算表。');
closeSheets();

// 進行中の衝突(進行中セッションがある状態でしか出ない)
click('[data-act="start-empty"]');
grab('記録', '進行中ワークアウトの確認', '記録中に新規開始しようとしたとき。進行中を開く／保存して新規／破棄して新規。');
closeSheets();

// 休養日のホーム(進行中があると出ないので、一時的に完了扱いにして撮り、あとで戻す)
const keepSessions = LS.getItem('kintore:sessions');
const keepLogs = LS.getItem('kintore:dailyLogs');
const tmpS = JSON.parse(keepSessions); tmpS.find(s => s.id === 'sess-a').done = true;
LS.setItem('kintore:sessions', JSON.stringify(tmpS));
const tmpL = JSON.parse(keepLogs);
const tRec = tmpL.find(l => l.date === today); if (tRec) tRec.restDay = true; else tmpL.push({ date: today, restDay: true });
LS.setItem('kintore:dailyLogs', JSON.stringify(tmpL));
tab('history'); tab('workout');
grab('記録', 'ホーム（休養日）', '休養日にすると今日のメニューが休養日カードに変わる。連続記録は途切れない。');
LS.setItem('kintore:sessions', keepSessions);
LS.setItem('kintore:dailyLogs', keepLogs);
tab('history'); tab('workout');

// --- 履歴タブ ---
tab('history');
grab('履歴', '履歴（カレンダー＋一覧）', '月カレンダー(実施日=塗り、休養日=破線)、未完了のワークアウト、すべての記録。');

click('[data-act="open-session"]');
grab('履歴', '履歴の詳細', '種目数/セット数/総量のタイル、種目ごとのセット内訳、編集・再開／削除。');
click('[data-act="hist-back"]');

// 記録のある日をタップすると詳細へ飛ぶので、記録の無い日を選ぶ
const emptyCell = $$('.cal-cell').find(c => c.dataset.date && !c.classList.contains('has'));
if (emptyCell) emptyCell.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
grab('履歴', '日付タップのシート', '記録の無い日をタップしたとき。この日に記録を追加／休養日にする（記録漏れの救済）。');
closeSheets();

// --- グラフタブ ---
tab('graph');
grab('グラフ', 'グラフ（バランス）', '3本柱の記録状況ドット(記録あり/オフ/未記録)、達成度バー、直近14日の推移。');

click('[data-act="graph-view"][data-v="exercise"]');
grab('グラフ', 'グラフ（種目別）', '種目セレクタ、最大重量/ボリューム切替、自己ベストのタイル、部位別ボリューム。');
click('[data-act="graph-view"][data-v="balance"]');

// --- メニュータブ ---
tab('menu');
grab('メニュー', 'テンプレート一覧', '登録したメニューと開始ボタン。');

click('[data-act="edit-template"]');
grab('メニュー', 'テンプレート編集', '名前・説明・種目ごとのセット/回数/重量、削除。');
click('[data-act="menu-back"]');
closeSheets();

// --- 体調タブ ---
tab('condition');
grab('体調', '体調（一覧）', '今日のサプリ チェックリスト、今日の睡眠/食事/体重への入口、体重推移、記録一覧。');

click('[data-act="go-sleep"]');
grab('体調', '睡眠の記録', '就寝・起床から睡眠時間を自動計算し目標と比較。睡眠の質★とメモ。');
click('[data-act="cond-back"]');

click('[data-act="go-food"]');
grab('体調', '食事の記録', '摂取/目標バーと残りkcal、朝昼夕間食の区分ごとに品目を積む。食べなかった日のトグル。');

click('[data-act="food-add"][data-slot="dinner"]');
grab('体調', '食事の品目を追加', '品目名(任意)・カロリー・タンパク質。');
closeSheets();
click('[data-act="cond-back"]');

click('[data-act="weight-sheet"]');
grab('体調', '体重の記録', '日付と体重だけの軽量シート。');
closeSheets();

click('[data-act="supps-manage"]');
grab('体調', 'サプリ管理（マイサプリ）', '登録済みサプリの用量・タイミング・頻度。');

click('[data-act="supp-add"]');
grab('体調', 'サプリを追加', '定番プリセット18種、名前・用量・タイミング(複数選択)・毎日/トレ日のみ。');
closeSheets();
click('[data-act="supps-back"]');

// --- 設定 ---
tab('workout');
click('[data-act="open-settings"]');
grab('設定', '設定', '単位、言語、テーマ(ライム/オレンジ)、1日の目標、レストタイマー、データ、お問い合わせ。');

click('[data-act="contact"]');
grab('設定', 'お問い合わせ', '内容と返信先を入力して開発者へ送信。');
closeSheets();

/* ---------- 出力(実CSS＋フォントを埋め込み、iframeで隔離再現) ---------- */
let css = fs.readFileSync(path.join(DOCS, 'css', 'style.css'), 'utf8');
// フォントをdata URIに差し替え(外部参照を無くし、単体で開いても崩れないように)
['sg-500', 'sg-600', 'sg-700', 'jm-500', 'jm-700'].forEach(f => {
  const b64 = fs.readFileSync(path.join(DOCS, 'fonts', f + '.woff2')).toString('base64');
  css = css.split(`url('../fonts/${f}.woff2')`).join(`url(data:font/woff2;base64,${b64})`);
});
// 種目画像もdata URIへ(詳細画面用)
const imgFile = path.join(DOCS, 'exercise-images', 'ベンチプレス.png');
let benchB64 = '';
if (fs.existsSync(imgFile)) benchB64 = 'data:image/png;base64,' + fs.readFileSync(imgFile).toString('base64');
screens.forEach(s => {
  s.html = s.html.replace(/src="exercise-images\/[^"]*"/g, benchB64 ? `src="${benchB64}"` : 'src=""');
});

const cats = [];
screens.forEach(s => { if (!cats.includes(s.cat)) cats.push(s.cat); });

const page = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0f1113">
<title>筋トレ記録アプリ — 画面設計と修正メモ</title>
<style>
  :root{--bg:#0f1113;--panel:#171a1d;--line:#282d31;--tx:#e9edf0;--dim:#9aa3aa;--acc:#c6ff3a;--warn:#ff9526}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.7 -apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif}
  header{position:sticky;top:0;z-index:10;background:rgba(15,17,19,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:14px 16px}
  h1{margin:0;font-size:17px}
  .sub{font-size:12px;color:var(--dim);margin-top:2px}
  .bar{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  .bar button{background:var(--panel);border:1px solid var(--line);color:var(--tx);border-radius:999px;padding:7px 13px;font:600 12px inherit;cursor:pointer}
  .bar button.pri{background:var(--acc);color:#0f1113;border-color:var(--acc)}
  main{padding:16px;max-width:1100px;margin:0 auto}
  .cat{font:700 12px inherit;letter-spacing:.14em;color:var(--dim);margin:26px 0 10px;text-transform:uppercase}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:16px}
  .top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .id{font:700 12px ui-monospace,monospace;color:#0f1113;background:var(--acc);border-radius:6px;padding:2px 7px}
  .nm{font-weight:700;font-size:16px}
  .ds{font-size:13px;color:var(--dim);margin:8px 0 12px}
  .body{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
  .frame{width:375px;height:640px;flex:none;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:#0c0e0d;position:relative}
  .frame iframe{width:375px;height:812px;border:0;display:block;transform:scale(.788);transform-origin:0 0}
  .frame{width:296px;height:640px}
  .note{flex:1;min-width:260px}
  .note label{display:block;font:600 11px inherit;letter-spacing:.1em;color:var(--dim);margin-bottom:6px;text-transform:uppercase}
  textarea{width:100%;min-height:150px;background:#101315;border:1px solid var(--line);border-radius:12px;color:var(--tx);
    font:14px/1.7 inherit;padding:12px;resize:vertical}
  textarea:focus{outline:none;border-color:var(--acc)}
  textarea.has{border-color:var(--warn)}
  .tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
  .tags button{background:#101315;border:1px solid var(--line);color:var(--dim);border-radius:8px;padding:5px 9px;font:12px inherit;cursor:pointer}
  .tags button:hover{color:var(--tx);border-color:var(--acc)}
  .count{position:fixed;right:16px;bottom:16px;background:var(--acc);color:#0f1113;border:0;border-radius:999px;
    padding:13px 20px;font:700 14px inherit;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:20}
  dialog{background:var(--panel);color:var(--tx);border:1px solid var(--line);border-radius:16px;max-width:min(720px,92vw);width:100%;padding:18px}
  dialog::backdrop{background:rgba(0,0,0,.65)}
  dialog textarea{min-height:50vh}
  .row{display:flex;gap:8px;margin-top:12px}
  .row button{flex:1;border-radius:10px;padding:11px;font:700 14px inherit;cursor:pointer;border:1px solid var(--line);background:#101315;color:var(--tx)}
  .row button.pri{background:var(--acc);color:#0f1113;border-color:var(--acc)}
  @media(max-width:720px){ .body{flex-direction:column} .frame{width:100%;max-width:296px} }
</style>

<header>
  <h1>筋トレ記録アプリ — 全画面 と 修正メモ</h1>
  <div class="sub">${screens.length}画面 / v49時点。各画面の右側に修正点を書いてください。入力は自動保存されます。</div>
  <div class="bar">
    <button class="pri" onclick="exportAll()">メモを書き出す</button>
    <button onclick="toggleAll()">画面を折りたたむ</button>
    <button onclick="if(confirm('入力したメモを全部消します。よろしいですか？')){localStorage.removeItem(KEY);location.reload()}">メモを消去</button>
  </div>
</header>

<main id="main"></main>
<button class="count" onclick="exportAll()"><span id="cnt">0</span> 件の修正メモ</button>

<dialog id="dlg">
  <b>修正メモ（このままコピーして渡してください）</b>
  <textarea id="out" readonly></textarea>
  <div class="row">
    <button class="pri" onclick="copyOut()">コピー</button>
    <button onclick="document.getElementById('dlg').close()">閉じる</button>
  </div>
</dialog>

<script>
const KEY='kintore-screen-notes-v1';
const CSS=${JSON.stringify(css)};
const SCREENS=${JSON.stringify(screens)};
const TAGS=['配色が見にくい','文字が小さい','余白が窮屈','導線が分かりにくい','不要な要素','情報が足りない','ボタン位置','文言を変えたい'];
let notes={}; try{notes=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}

function frameDoc(s){
  return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>'+CSS+
    '\\n#app{min-height:812px}.sheet{max-height:700px}body{overflow:hidden}</style></head>'+
    '<body class="'+(s.bodyClass||'')+'"><div id="app">'+s.html+'</div></body></html>';
}
function render(){
  const main=document.getElementById('main');
  let cur='';
  SCREENS.forEach(s=>{
    if(s.cat!==cur){ cur=s.cat; const h=document.createElement('div'); h.className='cat'; h.textContent=s.cat; main.appendChild(h); }
    const c=document.createElement('div'); c.className='card';
    c.innerHTML='<div class="top"><span class="id">'+s.id+'</span><span class="nm">'+s.name+'</span></div>'+
      '<div class="ds">'+s.desc+'</div>'+
      '<div class="body"><div class="frame"><iframe loading="lazy" data-id="'+s.id+'"></iframe></div>'+
      '<div class="note"><label>'+s.id+' の修正点</label>'+
      '<div class="tags">'+TAGS.map(t=>'<button data-t="'+t+'" data-id="'+s.id+'">+ '+t+'</button>').join('')+'</div>'+
      '<textarea data-id="'+s.id+'" placeholder="例）ここの文字が小さい / このボタンは要らない / 並び順を変えたい"></textarea></div></div>';
    main.appendChild(c);
  });
  // iframeは画面に近づいたものだけ生成する(全部同時に作ると重いため)
  const io=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting || e.target.dataset.loaded) return;
      e.target.dataset.loaded='1';
      e.target.setAttribute('srcdoc', frameDoc(SCREENS.find(x=>x.id===e.target.dataset.id)));
    });
  },{rootMargin:'800px'});
  document.querySelectorAll('iframe').forEach(f=>io.observe(f));
  document.querySelectorAll('textarea[data-id]').forEach(t=>{
    t.value=notes[t.dataset.id]||'';
    t.classList.toggle('has', !!t.value.trim());
    t.addEventListener('input',()=>{
      notes[t.dataset.id]=t.value;
      localStorage.setItem(KEY,JSON.stringify(notes));
      t.classList.toggle('has', !!t.value.trim());
      updateCount();
    });
  });
  document.querySelectorAll('.tags button').forEach(b=>{
    b.addEventListener('click',()=>{
      const t=document.querySelector('textarea[data-id="'+b.dataset.id+'"]');
      t.value=(t.value?t.value.replace(/\\n$/,'')+'\\n':'')+'・'+b.dataset.t+' → ';
      t.dispatchEvent(new Event('input'));
      t.focus(); t.setSelectionRange(t.value.length,t.value.length);
    });
  });
  updateCount();
}
function updateCount(){
  document.getElementById('cnt').textContent=Object.values(notes).filter(v=>v&&v.trim()).length;
}
let folded=false;
function toggleAll(){
  folded=!folded;
  document.querySelectorAll('.frame').forEach(f=>f.style.display=folded?'none':'');
}
function exportAll(){
  const lines=['# 画面の修正メモ（筋トレ記録アプリ v49）',''];
  SCREENS.forEach(s=>{
    const v=(notes[s.id]||'').trim();
    if(!v) return;
    lines.push('## '+s.id+' '+s.name+'（'+s.cat+'）');
    lines.push(v); lines.push('');
  });
  if(lines.length<3) lines.push('（まだ記入がありません）');
  document.getElementById('out').value=lines.join('\\n');
  document.getElementById('dlg').showModal();
}
function copyOut(){
  const o=document.getElementById('out');
  o.removeAttribute('readonly'); o.select();
  try{ navigator.clipboard.writeText(o.value); }catch(e){ document.execCommand('copy'); }
  o.setAttribute('readonly','');
  alert('コピーしました');
}
render();
</script>`;

fs.writeFileSync(OUT, page, 'utf8');
// 収集漏れの自動チェック(空の画面・出るはずのシートが無い等)
const MUST = {
  S03: 'この種目について', S04: '種目を選ぶ', S05: '鍛える筋肉', S06: 'カスタム種目',
  S07: 'レスト中', S08: 'レスト中', S09: '完了チェック', S10: '1RM', S11: '進行中のワークアウト',
  S12: '今日は休養日', S15: 'この日に記録を追加', S19: 'テンプレート', S21: '就寝', S22: '朝食',
  S23: '食べたものを追加', S24: '体重', S25: 'マイサプリ', S26: '定番から選ぶ', S28: 'お問い合わせ'
};
let warn = 0;
console.log('screens: ' + screens.length);
screens.forEach(s => {
  const text = s.html.replace(/<[^>]+>/g, ' ');
  const need = MUST[s.id];
  const ng = (need && text.indexOf(need) < 0) || s.html.length < 2000;
  if (ng) warn++;
  console.log('  ' + (ng ? 'NG ' : 'ok ') + s.id + ' ' + s.name + '  (' + s.html.length + ')' + (ng && need ? '  ← "' + need + '" が見つからない' : ''));
});
if (warn) console.log('!! 要確認: ' + warn + '件');
console.log('written: ' + OUT + '  (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
