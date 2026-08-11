/* _shot.js — App Store用スクリーンショット撮影ハーネス。
 * 本番アセットには含めない。docs/のコピー(site/)に対してのみ注入する。
 * ?shot=<画面名> を付けて開くと、サンプルデータを流し込み目的の画面まで自動で進め、
 * 撮影可能になった時点で document.title を SHOT-READY にする。
 */
(() => {
  const shot = new URLSearchParams(location.search).get('shot') || 'home';
  const P = 'kintore:';

  // タブを使い回すので、前回の撮影分(記録途中の状態など)を必ず消してから積む
  Object.keys(localStorage).filter(k => k.startsWith(P)).forEach(k => localStorage.removeItem(k));

  // IAP審査用スクショは「App Store版の購入前ユーザー」でないと購入画面が出ない。
  // Web版は課金導線を持たない設計なので、ここだけStoreKitをモックする。
  if (shot === 'paywall') {
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        NativePurchases: {
          getPurchases: async () => ({ purchases: [] }),
          getProduct: async () => ({ product: { priceString: '¥720' } }),
          purchaseProduct: async () => ({}),
          restorePurchases: async () => ({}),
        }
      }
    };
  }

  // アプリの Data.dateKey と同じくローカル時刻基準で作る(UTCだとJSTで1日ズレる)
  const K = (back) => {
    const x = new Date(); x.setDate(x.getDate() - back);
    const p = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  };
  const today = K(0);
  const uid = (() => { let n = 0; return () => 'sx' + (++n).toString(36); })();
  const sets = (n, wt, reps, done) => Array.from({ length: n }, () => ({ id: uid(), weight: wt, reps, warmup: false, done }));

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const click = (sel) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.click(); return !!el; };
  const tab = (name) => click(`.tabbar button[data-tab="${name}"]`);

  // このリスナは app.js の boot より先に登録されるため先に走る。
  // データ投入は同期で終わらせ、boot が空のストレージを読まないようにする。
  document.addEventListener('DOMContentLoaded', () => {
    Store.ensureSeed();
    const exList = JSON.parse(localStorage.getItem(P + 'exercises') || '[]');
    const byName = (n) => (exList.find(e => e.name === n) || exList[0]).id;

    // ---- 掲載用のサンプルデータ(空っぽの画面を撮らないため、現実的な量を入れる) ----
    const sessions = [
      // 今日: 進行中(記録画面の撮影に使う)
      { id: 'sess-today', date: today, name: '胸・肩の日', note: '', startedAt: today + 'T19:12:00.000Z', finishedAt: null, done: false,
        exercises: [
          { id: 'we1', exerciseId: byName('ベンチプレス'), note: '', sets: sets(3, 82.5, 8, true).concat(sets(1, 85, 6, false)) },
          { id: 'we2', exerciseId: byName('ショルダープレス'), note: '', sets: sets(3, 22, 12, true) },
          { id: 'we3t', exerciseId: byName('ケーブルフライ'), note: '', sets: sets(3, 20, 15, true) }
        ] },
      { id: 'sess-b', date: K(1), name: '背中の日', note: '', startedAt: K(1) + 'T19:00:00.000Z', finishedAt: K(1) + 'T20:20:00.000Z', done: true,
        exercises: [
          { id: 'we3', exerciseId: byName('デッドリフト'), note: '', sets: sets(4, 120, 6, true) },
          { id: 'we4', exerciseId: byName('ラットプルダウン'), note: '', sets: sets(3, 60, 12, true) }
        ] },
      { id: 'sess-c', date: K(3), name: '脚の日', note: '', startedAt: K(3) + 'T19:00:00.000Z', finishedAt: K(3) + 'T20:40:00.000Z', done: true,
        exercises: [{ id: 'we5', exerciseId: byName('スクワット'), note: '', sets: sets(5, 100, 8, true) }] },
      { id: 'sess-d', date: K(4), name: '胸・肩の日', note: '', startedAt: K(4) + 'T19:00:00.000Z', finishedAt: K(4) + 'T20:10:00.000Z', done: true,
        exercises: [{ id: 'we6', exerciseId: byName('ベンチプレス'), note: '', sets: sets(4, 80, 8, true) }] },
      { id: 'sess-e', date: K(6), name: '背中の日', note: '', startedAt: K(6) + 'T19:00:00.000Z', finishedAt: K(6) + 'T20:15:00.000Z', done: true,
        exercises: [{ id: 'we7', exerciseId: byName('デッドリフト'), note: '', sets: sets(4, 115, 6, true) }] }
    ];
    const supps = [
      { id: 'sp1', name: 'ホエイプロテイン', dose: '30g', slots: ['postW'], days: 'all', order: 0 },
      { id: 'sp2', name: 'クレアチン', dose: '5g', slots: ['postW'], days: 'all', order: 1 },
      { id: 'sp3', name: 'マルチビタミン', dose: '1粒', slots: ['morning'], days: 'all', order: 2 },
      { id: 'sp4', name: 'EAA', dose: '10g', slots: ['preW'], days: 'training', order: 3 }
    ];
    const meal = (slot, name, kcal, protein) => ({ id: uid(), slot, name, kcal, protein });
    const logs = [
      { date: today, bedTime: '23:40', wakeTime: '07:10', sleepHours: 7.5, sleepQuality: 4, weight: 72.4,
        meals: [meal('breakfast', 'オートミールと卵', 420, 24), meal('lunch', '鶏胸肉と白米', 760, 52),
                meal('snack', 'プロテイン', 120, 24), meal('dinner', 'サーモンと野菜', 640, 38)],
        calories: 1940, protein: 138 },
      { date: K(1), bedTime: '23:20', wakeTime: '06:50', sleepHours: 7.5, sleepQuality: 4, weight: 72.6, calories: 2050, protein: 132 },
      { date: K(2), restDay: true, bedTime: '00:10', wakeTime: '07:30', sleepHours: 7.3, sleepQuality: 5, weight: 72.7, calories: 1880, protein: 118 },
      { date: K(3), bedTime: '23:50', wakeTime: '06:40', sleepHours: 6.8, sleepQuality: 3, weight: 72.8, calories: 2100, protein: 141 },
      { date: K(4), bedTime: '23:30', wakeTime: '07:00', sleepHours: 7.5, sleepQuality: 4, weight: 72.9, calories: 1990, protein: 126 },
      { date: K(5), bedTime: '00:30', wakeTime: '07:00', sleepHours: 6.5, sleepQuality: 3, weight: 73.1, calories: 1820, protein: 104 },
      { date: K(6), bedTime: '23:10', wakeTime: '06:40', sleepHours: 7.5, sleepQuality: 5, weight: 73.2, calories: 2030, protein: 134 }
    ];
    const templates = [
      { id: 'tpl1', name: '胸・肩の日', description: 'プッシュ', order: 0,
        exercises: [{ exerciseId: byName('ベンチプレス'), sets: 4, reps: 8, weight: 82.5 },
                    { exerciseId: byName('ショルダープレス'), sets: 3, reps: 12, weight: 22 }] },
      { id: 'tpl2', name: '背中の日', description: 'プル', order: 1,
        exercises: [{ exerciseId: byName('デッドリフト'), sets: 4, reps: 6, weight: 120 }] }
    ];
    const L = localStorage;
    L.setItem(P + 'sessions', JSON.stringify(sessions));
    L.setItem(P + 'dailyLogs', JSON.stringify(logs));
    L.setItem(P + 'templates', JSON.stringify(templates));
    L.setItem(P + 'supplements', JSON.stringify(supps));
    L.setItem(P + 'suppLogs', JSON.stringify([
      { date: today, taken: ['sp3|morning', 'sp4|preW'] },
      { date: K(1), taken: ['sp1|postW', 'sp2|postW', 'sp3|morning'] },
      { date: K(2), taken: ['sp3|morning'] },
      { date: K(3), taken: ['sp1|postW', 'sp2|postW', 'sp3|morning', 'sp4|preW'] }
    ]));
    // 掲載画像は有料機能も写したいのでプレミアム扱い。
    // ただしIAP審査用スクショだけは「購入前の無料ユーザー」でなければならない。
    L.setItem(P + 'premium', JSON.stringify(shot !== 'paywall'));
    L.setItem(P + 'settings', JSON.stringify({
      unit: 'kg', lang: 'ja', restDefault: 180, restAuto: false, goalVolume: 5000,
      goalSleep: 7.5, goalProtein: 130, goalCalories: 2000,
      // 記録画面の掲載画像は「セット入力＋走っているタイマー」を1枚で見せたいので
      // コンパクト表示にする(全画面タイマーだと他が何も写らない)
      timerStyle: shot === 'session' ? 'compact' : 'large',
      restSound: true, restVibe: true, seedVersion: 4, intervalBtnMig: 1, rest180Mig: 1
    }));

    // ここから先は app.js の boot() が走ったあとに動かす
    const go = {
      // ホーム: 3本柱ダッシュボード
      async home() { tab('workout'); },
      // 記録画面: セット入力 + インターバルタイマー
      async session() {
        tab('workout'); await wait(120);
        click('[data-act="resume"]'); await wait(200);
        // インターバルタイマーを走らせた状態を撮る(このアプリの目玉のひとつ)
        if (!click('[data-act="rest-start"]')) throw new Error('インターバル開始ボタンが見つからない');
        await wait(400);
      },
      // 体調: 睡眠・食事・サプリのチェックリスト
      async cond() { tab('condition'); },
      // グラフ: 3本柱のバランス
      async balance() { tab('graph'); },
      // IAP審査用: プレミアムの購入画面(価格・購入ボタン・復元ボタンが写ること)
      async paywall() {
        tab('graph'); await wait(150);
        if (!click('[data-act="graph-view"][data-v="exercise"]')) throw new Error('種目別タブが見つからない');
        await wait(200);
        if (!click('#view-graph .lock-card')) throw new Error('ロックカードが見つからない');
        await wait(350);
        if (!$('[data-act="premium-buy"]')) throw new Error('購入ボタンが出ていない');
      },
      // 種目解説: イラスト + 鍛える筋肉 + フォームの要点
      async exercise() {
        tab('workout'); await wait(120);
        click('[data-act="resume"]'); await wait(180);
        click('[data-act="pick-ex"]'); await wait(220);
        const info = $('[data-act="ex-info"]');
        if (!info) throw new Error('種目の解説ボタンが見つからない');
        info.click(); await wait(300);
        // 上から撮ると体の図が途中で切れるので、イラスト〜鍛える筋肉〜体の図が
        // 1画面に収まる位置までシートを送る。
        // 解説シートはピッカーの上に積まれるので、最後のオーバーレイを掴む。
        const sheets = $$('.sheet-overlay .sheet');
        const sheet = sheets[sheets.length - 1];
        if (!sheet) throw new Error('解説シートが見つからない');
        // 動作イラストのPNGが読み込まれるまでシートの高さが確定せず、
        // scrollTop を入れても0に丸められる。画像の読み込みを待ってから送る。
        await Promise.all($$('.sheet img').map(im => im.complete ? null :
          new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); })));
        await wait(200);
        sheet.scrollTop = 250;
        await wait(250);
        if (sheet.scrollTop < 100) throw new Error('シートがスクロールしなかった (scrollTop=' + sheet.scrollTop + ')');
      }
    };
    setTimeout(async () => {
      await wait(200);
      try { await (go[shot] || go.home)(); } catch (e) { window.__err = String(e && e.message || e); }
      await wait(500);
      document.title = 'SHOT-READY';
    }, 0);
  });
})();
