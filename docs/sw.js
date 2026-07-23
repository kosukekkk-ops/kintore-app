/* sw.js — オフライン対応の Service Worker
 * アプリ本体を事前キャッシュし、通信なしでも記録・履歴・グラフ・体調管理が
 * すべて使えるようにする(データは端末内 localStorage 保存のためそもそも通信不要)。
 * ファイルを追加/削除/リネームしたら必ず ASSETS 一覧と CACHE 版数を更新すること。
 */
const CACHE = 'kintore-app-v12';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/data.js',
  './js/charts.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // 同一オリジンは cache-first、無ければネットワーク取得して追記
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
