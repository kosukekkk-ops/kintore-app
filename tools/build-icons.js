/* build-icons.js — docs/icons/icon.svg から配布用アイコン一式を生成する。
 *
 *  1) PWA用           docs/icons/icon-{180,192,512}.png     (透過なし・角丸はOS/ブラウザ任せ)
 *  2) App Store用     ios/.../AppIcon.appiconset/AppIcon-512@2x.png
 *                     → 1024x1024・アルファチャンネル無しが必須。あるとアップロード時に弾かれる。
 *  3) スプラッシュ    ios/.../Splash.imageset/*.png (2732角。中央にロゴ、背景は--bg)
 *
 *  実行: node tools/build-icons.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const ROOT = path.join(__dirname, '..');
const SVG = path.join(ROOT, 'docs', 'icons', 'icon.svg');
const ICONS = path.join(ROOT, 'docs', 'icons');
const APPICON = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
const SPLASH = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset');
const BG = { r: 0x0c, g: 0x0e, b: 0x0d };   // --bg (Night Gym)

const svg = fs.readFileSync(SVG);

// 角丸を「切り抜く」ためのマスク。iOSは自前でマスクするので使わないが、
// PWA(Android/デスクトップ)側は素材の角丸をそのまま表示するため必要。
const rounded = (size) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
     <rect width="${size}" height="${size}" rx="${Math.round(size * 112 / 512)}" fill="#fff"/>
   </svg>`);

async function png(size, { round }) {
  let img = sharp(svg, { density: 384 }).resize(size, size);
  if (round) {
    img = img.composite([{ input: rounded(size), blend: 'dest-in' }]);
  } else {
    img = img.flatten({ background: BG });   // アルファを潰す = App Store要件
  }
  return img.png({ compressionLevel: 9 }).toBuffer();
}

(async () => {
  fs.mkdirSync(APPICON, { recursive: true });
  fs.mkdirSync(SPLASH, { recursive: true });

  // --- PWA (maskable指定なので余白は素材側に持たせず、角丸のみ) ---
  for (const s of [180, 192, 512]) {
    fs.writeFileSync(path.join(ICONS, `icon-${s}.png`), await png(s, { round: true }));
  }

  // --- App Store (1024角・アルファ無し・角丸なし) ---
  fs.writeFileSync(path.join(APPICON, 'AppIcon-512@2x.png'), await png(1024, { round: false }));
  fs.writeFileSync(path.join(APPICON, 'Contents.json'), JSON.stringify({
    images: [{ idiom: 'universal', size: '1024x1024', filename: 'AppIcon-512@2x.png', platform: 'ios' }],
    info: { author: 'xcode', version: 1 },
  }, null, 2) + '\n');

  // --- スプラッシュ: 2732角の中央にロゴ(全幅の22%)。全デバイスでaspectFillされる ---
  const LOGO = 600;
  const logo = await sharp(svg, { density: 384 })
    .resize(LOGO, LOGO)
    .composite([{ input: rounded(LOGO), blend: 'dest-in' }])
    .png().toBuffer();
  const splash = await sharp({
    create: { width: 2732, height: 2732, channels: 3, background: BG },
  })
    .composite([{ input: logo, top: (2732 - LOGO) / 2, left: (2732 - LOGO) / 2 }])
    .png({ compressionLevel: 9 }).toBuffer();

  // ダーク固定アプリなので light/dark とも同一画像で良い
  const names = [
    'Default@1x~universal~anyany.png', 'Default@2x~universal~anyany.png', 'Default@3x~universal~anyany.png',
    'Default@1x~universal~anyany-dark.png', 'Default@2x~universal~anyany-dark.png', 'Default@3x~universal~anyany-dark.png',
    'splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png',
  ];
  for (const n of names) fs.writeFileSync(path.join(SPLASH, n), splash);
  fs.writeFileSync(path.join(SPLASH, 'Contents.json'), JSON.stringify({
    images: [
      { idiom: 'universal', filename: 'Default@1x~universal~anyany.png', scale: '1x' },
      { idiom: 'universal', filename: 'Default@2x~universal~anyany.png', scale: '2x' },
      { idiom: 'universal', filename: 'Default@3x~universal~anyany.png', scale: '3x' },
      { idiom: 'universal', filename: 'Default@1x~universal~anyany-dark.png', scale: '1x', appearances: [{ appearance: 'luminosity', value: 'dark' }] },
      { idiom: 'universal', filename: 'Default@2x~universal~anyany-dark.png', scale: '2x', appearances: [{ appearance: 'luminosity', value: 'dark' }] },
      { idiom: 'universal', filename: 'Default@3x~universal~anyany-dark.png', scale: '3x', appearances: [{ appearance: 'luminosity', value: 'dark' }] },
    ],
    info: { author: 'xcode', version: 1 },
  }, null, 2) + '\n');

  // 検証: App Storeアイコンにアルファが残っていないこと
  const meta = await sharp(path.join(APPICON, 'AppIcon-512@2x.png')).metadata();
  if (meta.hasAlpha) throw new Error('AppIconにアルファが残っている(App Storeで弾かれる)');
  console.log(`OK  AppIcon ${meta.width}x${meta.height} alpha=${meta.hasAlpha} / PWA 3枚 / Splash ${names.length}枚`);
})();
