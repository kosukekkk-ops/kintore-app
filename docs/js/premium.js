/* premium.js — プレミアム(買い切りIAP)の状態管理と購入処理
 *
 * 方針(サーバーレス):
 * - 購入状態の真実はStoreKit。localStorageのフラグは表示を即時にするための
 *   キャッシュで、ネイティブ起動時に Premium.sync() が必ず照合し直す。
 * - Web/PWA版にはストアが無いため全機能開放のまま(課金はApp Store版のみ)。
 * - プラグインは @capgo/native-purchases。バンドラ無し構成のため、
 *   window.Capacitor.Plugins 経由で呼び出す(ネイティブ側で自動登録される)。
 *
 * 無料で使える範囲 / プレミアムで解放される範囲は LIMITS を単一の出典とし、
 * app.js 側はここを参照してゲートする(判定が散らばると線引きがズレるため)。
 */
const Premium = (() => {
  const PRODUCT_ID = 'io.github.kosukekkkops.torelog.premium';

  // 無料版の上限。記録そのもの(ワークアウト・セット・睡眠・食事・体重)は
  // 記録アプリの生命線なので一切制限しない。制限するのは「積み上げ」と「分析」のみ。
  const LIMITS = { templates: 3, supps: 3 };

  const isNative = () =>
    !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = () =>
    (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativePurchases) || null;

  let cachedPrice = null;
  // 購入/復元が完了した時刻。起動時のsync()が遅れて返ってきたときに、
  // その後に成立した購入を「未購入」で上書きしてしまうのを防ぐ目印。
  let lastGrantAt = 0;

  // 今プレミアムか(同期的・描画用)。Webは常にtrue=全機能開放。
  function unlocked() {
    if (!isNative()) return true;
    return !!Store.getPremium();
  }

  // 無料枠の残り判定。unlocked() なら常に true。
  function canAdd(kind, currentCount) {
    if (unlocked()) return true;
    const max = LIMITS[kind];
    return max == null || currentCount < max;
  }
  function limitOf(kind) { return LIMITS[kind]; }

  // StoreKitの現在のentitlementsと端末フラグを同期(起動時・復元時に呼ぶ)。
  // onlyCurrentEntitlements: 共有端末で他人のApple IDの購入が漏れて見えるのを防ぐ。
  async function sync() {
    const np = plugin();
    if (!np) return unlocked();
    const startedAt = Date.now();
    try {
      const { purchases } = await np.getPurchases({ onlyCurrentEntitlements: true });
      const has = (purchases || []).some(t => t.productIdentifier === PRODUCT_ID);
      // 問い合わせ中に購入が成立していたら、その結果のほうが新しいので触らない
      if (!has && lastGrantAt >= startedAt) return true;
      Store.setPremium(has);
      return has;
    } catch (e) {
      console.warn('Premium.sync failed', e);
      return unlocked();   // 照会失敗時は現状のフラグを維持(オフライン等)
    }
  }

  // ストア上の表示価格(例 "¥720")。取得失敗時は空文字。
  async function price() {
    if (cachedPrice) return cachedPrice;
    const np = plugin();
    if (!np) return '';
    try {
      const { product } = await np.getProduct({ productIdentifier: PRODUCT_ID });
      cachedPrice = (product && product.priceString) || '';
      return cachedPrice;
    } catch (e) {
      console.warn('Premium.price failed', e);
      return '';
    }
  }

  // 購入。成功でtrue、ユーザーキャンセル等は例外がthrowされる。
  async function buy() {
    const np = plugin();
    if (!np) throw new Error('この端末では購入できません');
    await np.purchaseProduct({ productIdentifier: PRODUCT_ID });
    lastGrantAt = Date.now();
    Store.setPremium(true);
    return true;
  }

  // 購入を復元(Apple必須要件)。復元後にentitlementsを照合して結果を返す。
  async function restore() {
    const np = plugin();
    if (!np) throw new Error('この端末では復元できません');
    await np.restorePurchases();
    const has = await sync();
    if (has) lastGrantAt = Date.now();
    return has;
  }

  return { PRODUCT_ID, LIMITS, isNative, unlocked, canAdd, limitOf, sync, price, buy, restore };
})();
