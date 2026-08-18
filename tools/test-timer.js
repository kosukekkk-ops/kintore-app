/* test-timer.js — レストタイマーが「スマホを置いても鳴る」ことを検証する。
 *
 * WKWebViewのJSタイマーは背面に回ると止まるため、setIntervalだけでは
 * 置いた瞬間に沈黙する。前面=アプリ内アラーム / 背面=ローカル通知 の
 * 張り替えが正しく動くかを、実際に画面を操作して確かめる。
 * 使い方: node tools/test-timer.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, '..', 'node_modules', 'jsdom'));

const DOCS = path.join(__dirname, '..', 'docs');
const FILES = ['js/storage.js', 'js/premium.js', 'js/legal.js', 'js/native.js', 'js/data.js', 'js/charts.js', 'js/app.js'];
const bundle = FILES.map(f => fs.readFileSync(path.join(DOCS, f), 'utf8')).join('\n;\n');
const indexHtml = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');

/* opts: { native, permission } */
function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM(indexHtml, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window, d = w.document;
  w.scrollTo = () => {};
  if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

  const log = { scheduled: [], cancelled: 0, haptics: [], permAsked: 0, beeps: 0 };
  // WebAudio は鳴らせないので「鳴らそうとしたこと」だけ数える
  w.AudioContext = function () {
    return {
      state: 'running', currentTime: 0, resume() {},
      createOscillator: () => ({ type: '', frequency: {}, connect() {}, start() { log.beeps++; }, stop() {} }),
      createGain: () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }),
      destination: {},
    };
  };
  if (opts.native) {
    const perm = opts.permission === undefined ? 'granted' : opts.permission;
    w.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        LocalNotifications: {
          checkPermissions: async () => ({ display: 'prompt' }),
          requestPermissions: async () => { log.permAsked++; return { display: perm }; },
          schedule: async (o) => { log.scheduled.push(o.notifications[0]); },
          cancel: async () => { log.cancelled++; },
        },
        Haptics: {
          notification: async (o) => { log.haptics.push('notif:' + o.type); },
          impact: async (o) => { log.haptics.push('impact:' + o.style); },
        },
      },
    };
  }
  // アプリが背面に回るのを再現する
  let hidden = false;
  Object.defineProperty(d, 'hidden', { configurable: true, get: () => hidden });
  const setHidden = (v) => { hidden = v; d.dispatchEvent(new w.Event('visibilitychange', { bubbles: true })); };

  w.localStorage.setItem('kintore:settings', JSON.stringify({
    unit: 'kg', lang: 'ja', restDefault: opts.restDefault || 180, restSound: true, restVibe: true,
    seedVersion: 4, intervalBtnMig: 1, rest180Mig: 1,
  }));
  w.eval(bundle);
  d.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));

  const $ = (s) => d.querySelector(s);
  const click = (s) => { const e = $(s); if (!e) return false; e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return true; };
  const settle = () => new Promise(r => setTimeout(r, 60));
  return { w, d, $, click, log, setHidden, settle };
}

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  OK   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  -> ' + extra : '')); }
};

async function startRest(a) {
  a.click('[data-act="start-empty"]');
  a.click('[data-act="rest-start"]');
  await a.settle();
}

(async () => {
  console.log('\n[1] アプリを開いたまま = アプリ内アラームだけ');
  {
    const a = boot({ native: true });
    await startRest(a);
    ok(!!a.$('#timer-bar, #timer-big'), 'タイマーが起動する');
    ok(a.log.scheduled.length === 0, '前面では通知を予約しない（アプリ内と二重に鳴るため）', JSON.stringify(a.log.scheduled));
    ok(a.log.permAsked === 1, 'タイマー開始時に通知の許可を聞く', String(a.log.permAsked));
  }

  console.log('\n[2] スマホを置いた/他アプリに移った');
  {
    const a = boot({ native: true });
    await startRest(a);
    a.setHidden(true); await a.settle();
    ok(a.log.scheduled.length === 1, '背面に回ると通知を予約する', String(a.log.scheduled.length));
    const n = a.log.scheduled[0];
    ok(n && n.title === 'レスト終了', '通知の文言が入っている', n && n.title);
    ok(n && n.sound === 'default', '通知音が指定されている');
    ok(n && n.schedule && n.schedule.at && typeof n.schedule.at.getTime === 'function', '終了時刻が指定されている');
    const diff = n ? n.schedule.at.getTime() - Date.now() : 0;
    ok(diff > 170000 && diff <= 180000, '3分後に鳴るよう予約される', Math.round(diff / 1000) + '秒後');
    a.setHidden(false); await a.settle();
    ok(a.log.cancelled >= 1, '前面に戻ると予約を取り消す（二重通知を防ぐ）');
  }

  console.log('\n[3] 停止・一時停止・延長で予約が追従する');
  {
    const a = boot({ native: true });
    await startRest(a);
    a.setHidden(true); await a.settle();
    const before = a.log.scheduled.length;
    a.setHidden(false); await a.settle();
    a.click('[data-act="timer-pause"]');
    a.setHidden(true); await a.settle();
    ok(a.log.scheduled.length === before, '一時停止中は予約しない', String(a.log.scheduled.length));
    a.setHidden(false); await a.settle();
    a.click('[data-act="timer-pause"]');
    a.setHidden(true); await a.settle();
    ok(a.log.scheduled.length === before + 1, '再開すると予約し直す');
    const t1 = a.log.scheduled[a.log.scheduled.length - 1].schedule.at.getTime();
    a.setHidden(false); await a.settle();
    a.click('[data-act="timer-add"]');
    a.setHidden(true); await a.settle();
    const t2 = a.log.scheduled[a.log.scheduled.length - 1].schedule.at.getTime();
    ok(t2 - t1 >= 28000 && t2 - t1 <= 32000, '+30秒で予約時刻も30秒後ろにずれる', Math.round((t2 - t1) / 1000) + '秒');
    a.setHidden(false); await a.settle();
    const c = a.log.cancelled;
    a.click('[data-act="timer-skip"]');
    await a.settle();
    ok(a.log.cancelled > c, 'タイマーを消すと予約も取り消す');
  }

  console.log('\n[4] 時間になったときの鳴り方（前面）');
  {
    const a = boot({ native: true, restDefault: 1 });
    const before = { beeps: a.log.beeps, hap: a.log.haptics.length };
    await startRest(a);
    await new Promise(r => setTimeout(r, 1800));
    ok(a.log.beeps > before.beeps, '音を鳴らそうとする', String(a.log.beeps));
    ok(a.log.haptics.length > before.hap, 'ハプティクスが鳴る（iOSにnavigator.vibrateは無い）', a.log.haptics.slice(0, 3).join(','));
    ok(/notif:WARNING/.test(a.log.haptics.join(',')), '通知パターンの振動を使う');
  }

  console.log('\n[5] 通知を拒否された場合');
  {
    const a = boot({ native: true, permission: 'denied' });
    await startRest(a);
    a.setHidden(true); await a.settle();
    ok(a.log.scheduled.length === 0, '予約はしない（例外で落ちない）');
    ok(!!a.$('#timer-bar, #timer-big'), 'タイマー自体は動き続ける');
  }

  console.log('\n[6] Web版（プラグイン無し）');
  {
    const a = boot({ native: false, restDefault: 1 });
    await startRest(a);
    a.setHidden(true); await a.settle();
    a.setHidden(false); await a.settle();
    ok(a.log.scheduled.length === 0 && a.log.haptics.length === 0, 'ネイティブ機能は呼ばれない');
    await new Promise(r => setTimeout(r, 1800));
    ok(a.log.beeps > 0, 'WebAudioのビープは鳴る');
  }

  console.log('\n=== ' + pass + ' passed / ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})();
