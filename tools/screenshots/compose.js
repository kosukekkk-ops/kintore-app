/* compose.js — 端末キャプチャにApp Store掲載用のコピーを載せて1290x2796に仕上げる。
 * アプリが漆黒テーマなので、背景も同系の暗色にしつつ端末のふちをライムで浮かせる。
 * 実行: node tools/screenshots/compose.js
 */
const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '..', '..', 'node_modules', 'sharp'));

const SRC = path.join(__dirname, 'out');
const DST = path.join(__dirname, 'store');

const W = 1290, H = 2796;
const INK = '#EAF0E6';
const ACCENT = '#C6FF3A';
const FONT = 'Yu Gothic UI, Yu Gothic, Meiryo, sans-serif';

// 端末画像の配置(全体が収まるサイズ。切り落とさない)
const DW = 1045, DH = Math.round(H * DW / W), DX = Math.round((W - DW) / 2), DY = 400, RADIUS = 118;
// ヘッドレス撮影にはステータスバー(セーフエリア)が無く、画面最上部の文字が
// 角丸に食われる。実機と同じ見え方にするため、上に同色の帯を足してから角を丸める。
const BAND = 64;
const APP_BG = '#0c0e0d';

// 並び順 = App Storeでの表示順。検索結果には先頭3枚しか出ないので、
// 「何のアプリか」→「何ができるか」→「他と何が違うか」の順に置く。
const SHEETS = [
  { src: 'home',     l1: '筋トレ・睡眠・食事',       l2: '3本柱をひとつの画面で' },
  { src: 'session',  l1: 'タップだけで素早く記録',   l2: 'インターバルも自動で計測' },
  { src: 'balance',  l1: '崩れている柱が、ひと目で', l2: '今週の記録状況と達成度' },
  { src: 'cond',     l1: 'サプリの飲み忘れを防ぐ',   l2: 'タイミング別チェックリスト' },
  { src: 'exercise', l1: '88種目にイラストと解説',   l2: '鍛える筋肉とフォームの要点' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function build(sheet, index) {
  const bg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
           <stop offset="0" stop-color="#1a2013"/>
           <stop offset="0.5" stop-color="#0f120e"/>
           <stop offset="1" stop-color="#080a07"/>
         </linearGradient>
         <radialGradient id="glow" cx="0.5" cy="0.12" r="0.55">
           <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.14"/>
           <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
         </radialGradient>
       </defs>
       <rect width="${W}" height="${H}" fill="url(#g)"/>
       <rect width="${W}" height="${H}" fill="url(#glow)"/>
       <text x="${W / 2}" y="196" text-anchor="middle" font-family="${FONT}" font-size="58" font-weight="700" fill="${INK}">${esc(sheet.l1)}</text>
       <text x="${W / 2}" y="308" text-anchor="middle" font-family="${FONT}" font-size="74" font-weight="700" fill="${ACCENT}">${esc(sheet.l2)}</text>
     </svg>`);

  const PH = DH + BAND;   // ステータスバー帯を足した端末プレートの高さ
  const shotBuf = await sharp(path.join(SRC, sheet.src + '.png')).resize(DW, DH).png().toBuffer();
  const plate = await sharp({ create: { width: DW, height: PH, channels: 3, background: APP_BG } })
    .composite([{ input: shotBuf, left: 0, top: BAND }])
    .png().toBuffer();

  // 端末画像を角丸に抜く
  const mask = Buffer.from(
    `<svg width="${DW}" height="${PH}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${DW}" height="${PH}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`);
  const device = await sharp(plate)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png().toBuffer();

  // アプリも背景も暗いので、ふちを1本入れないと端末の輪郭が消える
  const edge = Buffer.from(
    `<svg width="${DW}" height="${PH}" xmlns="http://www.w3.org/2000/svg">
       <rect x="1.5" y="1.5" width="${DW - 3}" height="${PH - 3}" rx="${RADIUS}" ry="${RADIUS}"
             fill="none" stroke="${ACCENT}" stroke-opacity="0.28" stroke-width="3"/></svg>`);

  if (DY + PH > H) throw new Error(`端末プレートが縦にはみ出す: ${DY + PH} > ${H}`);
  const out = path.join(DST, String(index + 1).padStart(2, '0') + '.png');
  await sharp(bg)
    .composite([{ input: device, left: DX, top: DY }, { input: edge, left: DX, top: DY }])
    // App Storeのスクリーンショットはアルファチャンネルがあるとアップロードで弾かれる
    .removeAlpha()
    .png({ compressionLevel: 9 }).toFile(out);
  return out;
}

(async () => {
  const missing = SHEETS.filter(s => !fs.existsSync(path.join(SRC, s.src + '.png')));
  if (missing.length) throw new Error('先に capture.js が必要です: ' + missing.map(m => m.src).join(', '));
  fs.rmSync(DST, { recursive: true, force: true });
  fs.mkdirSync(DST, { recursive: true });
  for (let i = 0; i < SHEETS.length; i++) {
    const f = await build(SHEETS[i], i);
    const m = await sharp(f).metadata();
    if (m.width !== W || m.height !== H) throw new Error(`サイズ不正 ${f}: ${m.width}x${m.height}`);
    if (m.hasAlpha) throw new Error(`アルファが残っている(App Storeで弾かれる): ${f}`);
    console.log(path.basename(f), SHEETS[i].src.padEnd(9), `${m.width}x${m.height}`, Math.round(fs.statSync(f).size / 1024) + 'KB');
  }
  console.log('→ store/ を kintore-app/store/screenshots/ にコピーしてください');
})();
