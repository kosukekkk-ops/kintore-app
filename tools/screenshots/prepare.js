/* prepare.js — docs/ を site/ に複製し、撮影ハーネス(_shot.js)を注入する。
 * 本番アセットを汚さないための隔離ステップ。実行: node tools/screenshots/prepare.js
 */
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', '..', 'docs');
const SITE = path.join(__dirname, 'site');

// 撮影に不要な巨大ファイルは複製しない(コピー時間の短縮)
const SKIP = new Set(['screens.html', 'images-review.html']);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith('_')) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

fs.rmSync(SITE, { recursive: true, force: true });
copyDir(DOCS, SITE);
fs.copyFileSync(path.join(__dirname, '_shot.js'), path.join(SITE, '_shot.js'));

// storage.js より前に _shot.js を読ませる。先に読ませることで _shot.js の
// DOMContentLoaded リスナが app.js の boot() より先に登録され、
// boot() が空のストレージを読むより前にサンプルデータを積める。
const idx = path.join(SITE, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
const anchor = '<script src="js/storage.js"></script>';
if (!html.includes(anchor)) throw new Error('index.html のスクリプト読み込み位置が変わっています');
html = html.replace(anchor, '<script src="_shot.js"></script>\n  ' + anchor);
// Service Worker は撮影の邪魔(古いキャッシュを掴む)なので殺す
html = html.replace('</body>', '  <script>if(navigator.serviceWorker){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()))}</script>\n</body>');
fs.writeFileSync(idx, html);

console.log('site/ を用意しました:', SITE);
