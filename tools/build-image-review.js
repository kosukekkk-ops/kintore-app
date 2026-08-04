/* build-image-review.js — 全種目イラストを点検して不良を洗い出すためのページを生成。
 * 画像は同じ場所(exercise-images/)を参照するので軽い。
 * 使い方: node tools/build-image-review.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('C:/Users/kosuk/Claude/fe-master-app/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(DOCS, 'images-review.html');

// 種目マスタを読む(部位でグループ化するため)
const pre = new JSDOM('<!doctype html><body>', { runScripts: 'outside-only', url: 'http://localhost/' });
pre.window.eval(['js/storage.js', 'js/data.js'].map(f => fs.readFileSync(path.join(DOCS, f), 'utf8')).join('\n;\n') + '\n;window.__D=Data;');
const D = pre.window.__D;

const имена = new Set(fs.readdirSync(path.join(DOCS, 'exercise-images'))
  .filter(f => f.endsWith('.png') && !f.startsWith('_') && !f.startsWith('ChatGPT'))
  .map(f => f.replace(/\.png$/, '')));

const items = D.SEED_EXERCISES.map(e => ({
  name: e.name,
  muscle: e.muscle,
  muscleJa: D.MUSCLES.find(m => m.key === e.muscle).ja,
  hasImg: имена.has(e.name)
}));

const page = `<!doctype html><html lang="ja"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0f1113">
<title>種目イラストの点検</title>
<style>
  :root{--bg:#0f1113;--panel:#171a1d;--line:#282d31;--tx:#e9edf0;--dim:#9aa3aa;--acc:#c6ff3a;--ng:#ff6b4a}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.7 -apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif}
  header{position:sticky;top:0;z-index:10;background:rgba(15,17,19,.95);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:13px 16px}
  h1{margin:0;font-size:16px}
  .sub{font-size:12px;color:var(--dim);margin-top:2px}
  .bar{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  .bar button{background:var(--panel);border:1px solid var(--line);color:var(--tx);border-radius:999px;padding:7px 13px;font:600 12px inherit;cursor:pointer}
  .bar button.pri{background:var(--acc);color:#0f1113;border-color:var(--acc)}
  main{padding:14px;max-width:1200px;margin:0 auto}
  .cat{font:700 12px inherit;letter-spacing:.14em;color:var(--dim);margin:22px 0 10px;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
  .it{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .12s}
  .it.bad{border-color:var(--ng);box-shadow:0 0 0 1px var(--ng)}
  .it .ph{background:#eef1e9;aspect-ratio:1;display:flex;align-items:center;justify-content:center}
  .it .ph img{width:100%;height:100%;object-fit:contain;display:block}
  .it .ph.none{background:var(--panel);color:var(--dim);font-size:11px}
  .it .nm{font-size:12px;padding:8px 10px;line-height:1.4}
  .it .st{font:700 10px inherit;color:var(--ng);padding:0 10px 8px;display:none}
  .it.bad .st{display:block}
  .note{padding:0 10px 10px}
  .note textarea{width:100%;min-height:52px;background:#101315;border:1px solid var(--line);border-radius:8px;color:var(--tx);font:12px/1.6 inherit;padding:7px;resize:vertical;display:none}
  .it.bad .note textarea{display:block}
  .count{position:fixed;right:14px;bottom:14px;background:var(--acc);color:#0f1113;border:0;border-radius:999px;padding:13px 20px;font:700 14px inherit;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:20}
  dialog{background:var(--panel);color:var(--tx);border:1px solid var(--line);border-radius:16px;max-width:min(720px,92vw);width:100%;padding:18px}
  dialog::backdrop{background:rgba(0,0,0,.65)}
  dialog textarea{width:100%;min-height:46vh;background:#101315;border:1px solid var(--line);border-radius:10px;color:var(--tx);font:13px/1.7 inherit;padding:12px}
  .row{display:flex;gap:8px;margin-top:12px}
  .row button{flex:1;border-radius:10px;padding:11px;font:700 14px inherit;cursor:pointer;border:1px solid var(--line);background:#101315;color:var(--tx)}
  .row button.pri{background:var(--acc);color:#0f1113;border-color:var(--acc)}
</style></head><body>

<header>
  <h1>種目イラストの点検</h1>
  <div class="sub">おかしい絵をタップして印を付けてください（例：手足の数が合わない・姿勢が不自然・種目と違う）。自動保存されます。</div>
  <div class="bar">
    <button class="pri" onclick="exportAll()">結果を書き出す</button>
    <button onclick="showBad()">印だけ表示</button>
    <button onclick="showAll()">全部表示</button>
    <button onclick="if(confirm('印を全部消します。よろしいですか？')){localStorage.removeItem(KEY);location.reload()}">印を消去</button>
  </div>
</header>

<main id="main"></main>
<button class="count" onclick="exportAll()"><span id="cnt">0</span> 件</button>

<dialog id="dlg">
  <b>直したいイラスト（このままコピーして渡してください）</b>
  <textarea id="out" readonly></textarea>
  <div class="row"><button class="pri" onclick="copyOut()">コピー</button><button onclick="document.getElementById('dlg').close()">閉じる</button></div>
</dialog>

<script>
const KEY='kintore-image-review-v1';
const ITEMS=${JSON.stringify(items)};
let marks={}; try{marks=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}

function render(){
  const main=document.getElementById('main');
  const cats=[];
  ITEMS.forEach(i=>{ if(!cats.includes(i.muscleJa)) cats.push(i.muscleJa); });
  cats.forEach(c=>{
    const h=document.createElement('div'); h.className='cat'; h.textContent=c; main.appendChild(h);
    const g=document.createElement('div'); g.className='grid';
    ITEMS.filter(i=>i.muscleJa===c).forEach(i=>{
      const d=document.createElement('div'); d.className='it'; d.dataset.name=i.name;
      d.innerHTML=(i.hasImg
          ? '<div class="ph"><img loading="lazy" src="exercise-images/'+encodeURIComponent(i.name)+'.png" alt=""></div>'
          : '<div class="ph none">イラストなし<br>(自作図で表示)</div>')
        +'<div class="nm">'+i.name+'</div><div class="st">要修正</div>'
        +'<div class="note"><textarea placeholder="どこがおかしい？(任意)"></textarea></div>';
      g.appendChild(d);
    });
    main.appendChild(g);
  });

  document.querySelectorAll('.it').forEach(el=>{
    const n=el.dataset.name, m=marks[n];
    if(m){ el.classList.add('bad'); el.querySelector('textarea').value=m.note||''; }
    el.addEventListener('click',e=>{
      if(e.target.tagName==='TEXTAREA') return;
      if(el.classList.contains('bad')){ el.classList.remove('bad'); delete marks[n]; }
      else { el.classList.add('bad'); marks[n]={note:''}; }
      save();
    });
    el.querySelector('textarea').addEventListener('input',ev=>{
      if(marks[n]) { marks[n].note=ev.target.value; save(); }
    });
  });
  updateCount();
}
function save(){ localStorage.setItem(KEY,JSON.stringify(marks)); updateCount(); }
function updateCount(){ document.getElementById('cnt').textContent=Object.keys(marks).length; }
function showBad(){ document.querySelectorAll('.it').forEach(el=>el.style.display=el.classList.contains('bad')?'':'none'); }
function showAll(){ document.querySelectorAll('.it').forEach(el=>el.style.display=''); }
function exportAll(){
  const ks=Object.keys(marks);
  const lines=['# 直したい種目イラスト（'+ks.length+'件）',''];
  ITEMS.forEach(i=>{ if(!marks[i.name]) return;
    lines.push('- '+i.name+'（'+i.muscleJa+'）'+(marks[i.name].note?' … '+marks[i.name].note:'')); });
  if(!ks.length) lines.push('（まだ印がありません）');
  document.getElementById('out').value=lines.join('\\n');
  document.getElementById('dlg').showModal();
}
function copyOut(){
  const o=document.getElementById('out'); o.removeAttribute('readonly'); o.select();
  try{ navigator.clipboard.writeText(o.value); }catch(e){ document.execCommand('copy'); }
  o.setAttribute('readonly',''); alert('コピーしました');
}
render();
</script></body></html>`;

fs.writeFileSync(OUT, page, 'utf8');
console.log('種目: ' + items.length + ' / イラストあり: ' + items.filter(i => i.hasImg).length + ' / なし: ' + items.filter(i => !i.hasImg).length);
console.log('written: ' + OUT + ' (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
