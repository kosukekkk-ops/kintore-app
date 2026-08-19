/* native.js — レストタイマーをネイティブの力で「置いても鳴る」ようにする層。
 *
 * WKWebView の JS タイマーはアプリを離れた瞬間に止まる。つまり setInterval だけに
 * 頼ると、スマホを置いた瞬間にアラームが動かなくなり、戻ってきて初めて鳴る。
 * ジムで使うタイマーとしては役に立たないので、他のタイマーアプリと同じく
 * 「終了時刻のローカル通知を先に予約しておく」方式を併用する。
 *
 * 役割分担:
 *   アプリを開いたまま … WebAudioのビープ＋ハプティクス(この層のvibrate)
 *   画面ロック/他アプリ … 予約済みのローカル通知(音＋バイブはOSが鳴らす)
 * 二重に鳴らないよう、前面に戻ってきた時点で予約済み通知は取り消す。
 *
 * Web(PWA)版にはプラグインが無いため、すべて安全に何もしない。
 */
const Native = (() => {
  const REST_NOTIF_ID = 1001;   // レスト終了通知。使い回して常に1件だけにする

  const isNative = () =>
    !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plug = (name) =>
    (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;

  let permission = null;   // null=未確認 / true=許可 / false=拒否

  /* 通知の許可。初回にタイマーを開始した瞬間に聞く(起動直後に聞くと理由が分からない)。 */
  async function ensureNotifyPermission() {
    const ln = plug('LocalNotifications');
    if (!ln) return false;
    if (permission !== null) return permission;
    try {
      let st = await ln.checkPermissions();
      if (st.display === 'prompt' || st.display === 'prompt-with-rationale') {
        st = await ln.requestPermissions();
      }
      permission = st.display === 'granted';
      return permission;
    } catch (e) {
      console.warn('notify permission failed', e);
      permission = false;
      return false;
    }
  }

  /* 終了時刻に鳴らすローカル通知を予約する。atMs はエポックミリ秒。 */
  async function scheduleRestDone(atMs, body) {
    const ln = plug('LocalNotifications');
    if (!ln) return false;
    if (!(await ensureNotifyPermission())) return false;
    // 直前すぎるとOSに弾かれることがあるので、過去/ほぼ同時なら予約しない
    if (atMs - Date.now() < 1000) return false;
    try {
      await cancelRestDone();
      await ln.schedule({
        notifications: [{
          id: REST_NOTIF_ID,
          title: (typeof Data !== 'undefined' ? Data.t('notif_rest_title') : 'Rest finished'),
          body: body || (typeof Data !== 'undefined' ? Data.t('notif_rest_body') : ''),
          schedule: { at: new Date(atMs), allowWhileIdle: true },
          sound: 'default',
        }],
      });
      return true;
    } catch (e) {
      console.warn('schedule failed', e);
      return false;
    }
  }

  async function cancelRestDone() {
    const ln = plug('LocalNotifications');
    if (!ln) return;
    try { await ln.cancel({ notifications: [{ id: REST_NOTIF_ID }] }); }
    catch (e) { /* 予約が無いときのエラーは無視 */ }
  }

  /* 触覚フィードバック。iOSには navigator.vibrate が無いのでHapticsを使う。
   * 単発では弱いので、通知パターン(強)を少しずらして重ねる。 */
  function vibrate() {
    const h = plug('Haptics');
    if (h) {
      try {
        h.notification({ type: 'WARNING' });
        setTimeout(() => { try { h.impact({ style: 'HEAVY' }); } catch (e) {} }, 260);
        setTimeout(() => { try { h.impact({ style: 'HEAVY' }); } catch (e) {} }, 520);
        return true;
      } catch (e) { /* 落ちたらWeb側にフォールバック */ }
    }
    if (navigator.vibrate) {
      try { navigator.vibrate([220, 120, 220, 120, 380]); return true; } catch (e) {}
    }
    return false;
  }
  /* 軽い触覚。スワイプで送れたことを指に返すための短い一発。
   * アラーム用の vibrate() は強すぎるので分けている。 */
  function tick() {
    const h = plug('Haptics');
    if (h) { try { h.impact({ style: 'LIGHT' }); return true; } catch (e) { /* 非対応 */ } }
    return false;
  }
  function vibrateStop() {
    if (navigator.vibrate) { try { navigator.vibrate(0); } catch (e) {} }
  }

  return { isNative, ensureNotifyPermission, scheduleRestDone, cancelRestDone, vibrate, vibrateStop, tick, REST_NOTIF_ID };
})();
