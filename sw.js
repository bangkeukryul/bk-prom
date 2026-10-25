/* sw.js — BK프롬 오프라인 캐시: 앱 파일은 인터넷 우선(업데이트 바로 반영) · 끊기면 저장본 */
const VERSION = 'bk-prom-v3';
const FONTS = 'bk-prom-fonts';
/* 같은 주소를 BK톡톡 · BK쇼츠와 함께 쓰므로, 지울 때는 BK프롬 것('bk-prom-'으로 시작)만 지운다 */
const APP = ['./', './index.html', './style.css', './app.js', './db.js', './admin.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('bk-prom-') && k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/bk-prom/')) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
    return res;
  }).catch(() => caches.open(VERSION).then(c => c.match(req, { ignoreSearch: true }))
    .then(hit => hit || (req.mode === 'navigate' ? caches.open(VERSION).then(c => c.match('./index.html')) : undefined))));
});
