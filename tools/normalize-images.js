/* normalize-images.js — 種目画像を「透過 + サイズ統一」に整える。
 *  - 白背景は画像の外周から連結している部分だけを透過にする(図の内側の白は残す)
 *  - 余白をトリムし、全画像で図の占有率を揃えてから300×300に収める
 * 元画像はgit管理下なので、失敗しても git checkout で戻せる。
 * 使い方: node tools/normalize-images.js [--dry]
 */
const sharp = require('C:/Users/kosuk/Claude/fe-master-app/node_modules/sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'docs', 'exercise-images');
const DRY = process.argv.includes('--dry');
const SIZE = 300;
const INSET = 10;             // 上下左右の余白(px)。図はこの内側いっぱいに収める
const BG_MIN = 236;           // これ以上明るい画素を背景候補とみなす

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png') && !f.startsWith('_') && !f.startsWith('ChatGPT'));

// 外周から連結する明るい画素だけ透明にする(内側の白＝シューズやハイライトは保持)
function clearOuterBackground(data, W, H) {
  const isBg = (i) => data[i] >= BG_MIN && data[i + 1] >= BG_MIN && data[i + 2] >= BG_MIN;
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, 0, x, H - 1); }
  for (let y = 0; y < H; y++) { stack.push(0, y, W - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (seen[p]) continue;
    const i = p * 4;
    if (!isBg(i)) continue;
    seen[p] = 1;
    data[i + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  return seen;
}

// 不透明な画素の外接矩形
function contentBox(data, W, H) {
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return (x1 < 0) ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

(async () => {
  const report = [];
  for (const f of files) {
    const p = path.join(DIR, f);
    try {
      const { data, info } = await sharp(p).flatten({ background: '#ffffff' }).ensureAlpha()
        .raw().toBuffer({ resolveWithObject: true });
      const W = info.width, H = info.height;
      clearOuterBackground(data, W, H);
      const box = contentBox(data, W, H);
      if (!box) { report.push({ f, skip: '中身が空' }); continue; }

      const before = +((box.width * box.height) / (W * H) * 100).toFixed(0);
      const inner = SIZE - INSET * 2;
      const buf = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } })
        .extract(box)
        .resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer(); // raw入力のままだとtoBuffer()が生画素を返しcompositeで読めない
      const out = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: buf, gravity: 'center' }])
        .png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer(); // 平面的なベクター画は減色で3.5倍軽くなる(劣化は目視で確認済み)

      if (!DRY) fs.writeFileSync(p, out);
      const m = await sharp(out).metadata();
      const chk = await sharp(out).raw().toBuffer({ resolveWithObject: true });
      const nb = contentBox(chk.data, chk.info.width, chk.info.height);
      report.push({ f, before, fit: Math.max(nb.width, nb.height), alpha: m.hasAlpha, kb: +(out.length / 1024).toFixed(1) });
    } catch (e) {
      report.push({ f, skip: e.message });
    }
  }

  const oks = report.filter(r => !r.skip);
  const ngs = report.filter(r => r.skip);
  const inner = SIZE - INSET * 2;
  console.log((DRY ? '[確認のみ] ' : '') + '処理: ' + oks.length + '枚 / スキップ: ' + ngs.length + '枚');
  console.log('占有率 いま: 最小' + Math.min(...oks.map(r => r.before)) + '% 最大' + Math.max(...oks.map(r => r.before)) + '%');
  console.log('枠いっぱいに収まった: ' + oks.filter(r => r.fit === inner).length + '/' + oks.length + ' (長辺が' + inner + 'px)');
  console.log('透過あり: ' + oks.filter(r => r.alpha).length + '/' + oks.length);
  console.log('平均サイズ: ' + (oks.reduce((a, r) => a + r.kb, 0) / oks.length).toFixed(1) + 'KB');
  ngs.forEach(r => console.log('  スキップ ' + r.f + ' → ' + r.skip));
})();
