/* check-codemagic.js — codemagic.yaml を push する前に検証する。
 *
 * Codemagic は YAML として正しくてもスキーマ検証で弾く。実際に踏んだ例:
 *   WHATS_NEW: ""  → "ensure this value has at least 1 characters"
 * 空文字は許されず、1文字以上の文字列か数値か真偽値でなければならない。
 * この手のミスはCodemagicの画面に貼るまで気づけないので、ここで先に落とす。
 *
 * 使い方: node tools/check-codemagic.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const YAML = path.join(ROOT, 'codemagic.yaml');

const BUNDLE_ID = 'io.github.kosukekkkops.torelog';
const PRODUCT_ID = 'io.github.kosukekkkops.torelog.premium';
const REQUIRED_WORKFLOWS = ['ios-release', 'iap-setup', 'release-prep',
  'screenshots-upload', 'release-submit', 'status-check', 'fix-availability'];

let fail = 0;
const ok = (c, label, extra) => {
  if (c) console.log('  ok   ' + label);
  else { fail++; console.log('  NG   ' + label + (extra ? '  -> ' + extra : '')); }
};

/* ---- 1. パースできるか ---- */
let doc;
try {
  const out = execFileSync('npx', ['--yes', 'js-yaml', YAML], { encoding: 'utf8', shell: true });
  doc = JSON.parse(out);
  ok(true, 'YAMLとして解析できる');
} catch (e) {
  console.log('  NG   YAMLの解析に失敗: ' + String(e.message).slice(0, 200));
  process.exit(1);
}

/* ---- 2. 文字コード・改行 ---- */
const raw = fs.readFileSync(YAML);
ok(!(raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF), 'BOMが付いていない');
ok(!/\r\n/.test(raw.toString('latin1')), '改行がLF');
ok(!/^\t/m.test(raw.toString('utf8')), '行頭にタブがない');

/* ---- 3. workflow が揃っているか ---- */
const wfs = doc.workflows || {};
ok(Object.keys(doc).every(k => k === 'workflows' || k === 'definitions'),
  'トップレベルは workflows(と definitions)のみ', Object.keys(doc).join(','));
REQUIRED_WORKFLOWS.forEach(w => ok(!!wfs[w], 'workflow ' + w + ' がある'));

/* ---- 4. 各workflowの中身 ---- */
for (const [name, wf] of Object.entries(wfs)) {
  const env = wf.environment || {};
  const vars = env.vars || {};

  ok(typeof wf.name === 'string' && wf.name.length > 0, name + ': name がある');
  ok(!!wf.instance_type, name + ': instance_type がある');
  ok(Array.isArray(wf.scripts) && wf.scripts.length > 0, name + ': scripts がある');
  (wf.scripts || []).forEach((sc, i) => {
    ok(sc && typeof sc.script === 'string' && sc.script.trim().length > 0,
      name + ': scripts[' + i + '] に中身がある');
  });

  // ここが今回踏んだ罠。空文字はCodemagicのスキーマ検証で必ず落ちる。
  for (const [k, v] of Object.entries(vars)) {
    const isEmpty = v === null || v === undefined || String(v).length === 0;
    ok(!isEmpty, name + ': 環境変数 ' + k + ' が空でない',
      '空文字はCodemagicが受け付けない(1文字以上/数値/真偽値のみ)');
  }

  // 全workflowが同じ変数グループを見ている前提
  ok(Array.isArray(env.groups) && env.groups.includes('appstore'),
    name + ': 変数グループ appstore を参照している', JSON.stringify(env.groups));

  // IDの取り違えは別アプリを更新する事故になるので厳密に見る
  if (vars.BUNDLE_ID) ok(vars.BUNDLE_ID === BUNDLE_ID, name + ': BUNDLE_ID が正しい', vars.BUNDLE_ID);
  if (vars.PRODUCT_ID) ok(vars.PRODUCT_ID === PRODUCT_ID, name + ': PRODUCT_ID が正しい', vars.PRODUCT_ID);
}

/* ---- 5. アプリ側の設定と食い違っていないか ---- */
const cap = JSON.parse(fs.readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8'));
ok(cap.appId === BUNDLE_ID, 'capacitor.config.json の appId が一致', cap.appId);
const premium = fs.readFileSync(path.join(ROOT, 'docs', 'js', 'premium.js'), 'utf8');
ok(premium.includes("PRODUCT_ID = '" + PRODUCT_ID + "'"), 'premium.js のプロダクトIDが一致');
const pbx = fs.readFileSync(path.join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');
ok(pbx.includes('PRODUCT_BUNDLE_IDENTIFIER = ' + BUNDLE_ID + ';'), 'Xcodeプロジェクトのバンドルidが一致');

/* ---- 6. macOSで解決できないパスが混ざっていないか ---- */
const pkg = fs.readFileSync(path.join(ROOT, 'ios', 'App', 'CapApp-SPM', 'Package.swift'), 'utf8');
ok(!/path: "[^"]*\\/.test(pkg), 'Package.swift のパスがPOSIX区切り',
  'Windowsで cap sync すると \\ 区切りになりmacOSのSPMが解決できない');

console.log(fail ? ('\n=== ' + fail + ' 件の問題 ===') : '\n=== すべてOK ===');
process.exit(fail ? 1 : 0);
