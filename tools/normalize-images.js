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

/* 外周から届かない白い塊(腕と体の間、フレームに囲まれた隙間など)も背景とみなして消す。
 * 実測すると背景の隙間は1500〜5200px、マシンのハイライト等は440px以下ときれいに分かれるため、
 * 一定面積以上の塊だけを対象にして小さな白いディテールは残す。 */
const ENCLOSED_MIN = 400;
function clearEnclosedBackground(data, W, H) {
  const N = W * H;
  const near = (p) => data[p * 4 + 3] > 10 && data[p * 4] >= 232 && data[p * 4 + 1] >= 232 && data[p * 4 + 2] >= 232;
  const seen = new Uint8Array(N);
  for (let s = 0; s < N; s++) {
    if (seen[s] || !near(s)) continue;
    const comp = [s]; seen[s] = 1;
    for (let i = 0; i < comp.length; i++) {        // 配列を伸ばしながら走査(再帰でないのでスタック溢れしない)
      const p = comp[i], x = p % W, y = (p - x) / W;
      if (x + 1 < W) { const q = p + 1; if (!seen[q] && near(q)) { seen[q] = 1; comp.push(q); } }
      if (x - 1 >= 0) { const q = p - 1; if (!seen[q] && near(q)) { seen[q] = 1; comp.push(q); } }
      if (y + 1 < H) { const q = p + W; if (!seen[q] && near(q)) { seen[q] = 1; comp.push(q); } }
      if (y - 1 >= 0) { const q = p - W; if (!seen[q] && near(q)) { seen[q] = 1; comp.push(q); } }
    }
    if (comp.length >= ENCLOSED_MIN) for (const p of comp) data[p * 4 + 3] = 0;
  }
}

/* 床の影や光沢は真っ白に近い色で描かれており、表示に使う台紙(#eef1e9)より明るいため
 * うっすら浮いて見える。消すとマシンの白いハイライトまで失われるので、
 * 「ほぼ白」の画素を台紙と同じ色に塗り替えて溶け込ませる。
 * ハイライトは暗い本体の上にあるので、塗り替えても明暗差は保たれ見え方は変わらない。 */
const PLATE = [238, 241, 233]; // css の .pose-img の background と揃えること
function blendWhitesToPlate(data, W, H) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) continue;
    if (data[i] >= 226 && data[i + 1] >= 226 && data[i + 2] >= 226) {
      data[i] = PLATE[0]; data[i + 1] = PLATE[1]; data[i + 2] = PLATE[2];
    }
  }
}

/* 床の影のように薄く広がった部分は、しきい値で切ると小さな白い粒に砕けて残る。
 * 「絵のどこにも接していない宙に浮いた白」だけを消せば、マシンのハイライト
 * (必ず本体に接している)を守ったままゴミを取れる。 */
function clearFloatingSpecks(data, W, H) {
  const N = W * H;
  const light = (p) => data[p * 4 + 3] > 10 && data[p * 4] >= 226 && data[p * 4 + 1] >= 226 && data[p * 4 + 2] >= 226;
  const opaque = (p) => data[p * 4 + 3] > 10;
  const seen = new Uint8Array(N);
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let s = 0; s < N; s++) {
    if (seen[s] || !light(s)) continue;
    const comp = [s]; seen[s] = 1;
    for (let i = 0; i < comp.length; i++) {
      const p = comp[i], x = p % W, y = (p - x) / W;
      for (const [dx, dy] of NB) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (!seen[q] && light(q)) { seen[q] = 1; comp.push(q); }
      }
    }
    let touchesArt = false;
    for (const p of comp) {
      const x = p % W, y = (p - x) / W;
      for (const [dx, dy] of NB) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (opaque(q) && !light(q)) { touchesArt = true; break; }
      }
      if (touchesArt) break;
    }
    if (!touchesArt) for (const p of comp) data[p * 4 + 3] = 0;
  }
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
      clearEnclosedBackground(data, W, H);
      clearFloatingSpecks(data, W, H);
      const box = contentBox(data, W, H);
      if (!box) { report.push({ f, skip: '中身が空' }); continue; }

      const before = +((box.width * box.height) / (W * H) * 100).toFixed(0);
      const inner = SIZE - INSET * 2;
      const buf = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } })
        .extract(box)
        .resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer(); // raw入力のままだとtoBuffer()が生画素を返しcompositeで読めない
      // 縮小するとアンチエイリアスで薄い白がまた生まれるので、仕上げ後にもう一度掃除する
      const canvas = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: buf, gravity: 'center' }])
        .raw().toBuffer({ resolveWithObject: true });
      clearFloatingSpecks(canvas.data, canvas.info.width, canvas.info.height);
      blendWhitesToPlate(canvas.data, canvas.info.width, canvas.info.height);
      const out = await sharp(canvas.data, { raw: { width: canvas.info.width, height: canvas.info.height, channels: 4 } })
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
