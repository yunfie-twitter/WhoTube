const CACHE_NAME = 'whotube-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/offline.html'
];

// インストール時に静的アセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 古いキャッシュの削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ネットワークリクエストの傍受とキャッシュ戦略
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // APIリクエストは Network-First
  if (url.pathname.startsWith('/api/')) {
    // ネットワークが低速、またはデータ節約モードの場合はキャッシュを優先
    const isSlowConnection = self.navigator.connection && 
      (self.navigator.connection.saveData || ['slow-2g', '2g'].includes(self.navigator.connection.effectiveType));

    if (isSlowConnection) {
      event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
      );
    } else {
      event.respondWith(
        fetch(event.request)
          .catch(() => caches.match(event.request))
      );
    }
    return;
  }

  // 静的アセットは Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // 有効なレスポンスかつ、期待通りの型であることを確認 (JSリクエストにHTMLが返ってくるのを防ぐ)
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type');
            const isJsRequest = event.request.url.endsWith('.js');
            const isHtmlResponse = contentType && contentType.includes('text/html');

            if (isJsRequest && isHtmlResponse) {
              // JSを期待しているのにHTMLが返ってきた場合はキャッシュせず、エラーとして扱う
              return networkResponse;
            }

            if (url.protocol === 'http:' || url.protocol === 'https:') {
              const cacheCopy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, cacheCopy);
              });
            }
          }
          return networkResponse;
        })
        .catch((error) => {
          if (cachedResponse) return cachedResponse;
          throw error;
        });

      return cachedResponse || fetchPromise;
    }).catch((error) => {
      // ネットワークエラーかつキャッシュなしの場合
      if (event.request.mode === 'navigate') {
        // オフライン動画ページなどを表示するため、アプリのシェル (index.html) を返す
        return caches.match('/') || caches.match('/index.html') || caches.match('/offline.html');
      }
      // respondWithに必ずResponseを返すか、エラーをスローしてブラウザのデフォルト挙動に任せる
      // ここではエラーをそのまま投げることで、TypeError: Failed to convert value to 'Response' を回避
      throw error;
    })
  );
});

// バックグラウンド同期
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-subscriptions') {
    event.waitUntil(syncSubscriptions());
  }
});

async function syncSubscriptions() {
  console.log('[SW] Syncing subscriptions in background...');
  // 実際の実装では IndexedDB 等から保留中のデータを読み取って API 送信
}

// プッシュ通知
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'WhoTube', body: '新しい通知があります' };
  
  const options = {
    body: data.body,
    icon: '/icons/launchericon-192x192.png',
    badge: '/favicon.png',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 通知クリック時の挙動
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
