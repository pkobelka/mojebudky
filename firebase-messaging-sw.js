// Firebase Messaging Service Worker — MojeBudky.cz
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBEAhZNxq3REoy1vExIrnNEXlyFXHzP4uI",
  authDomain: "moje-budky.firebaseapp.com",
  databaseURL: "https://moje-budky-default-rtdb.firebaseio.com",
  projectId: "moje-budky",
  storageBucket: "moje-budky.firebasestorage.app",
  messagingSenderId: "325649258561",
  appId: "1:325649258561:web:b5571c3278d98405320ec0"
});

const messaging = firebase.messaging();

// Notifikace na pozadí (když appka není otevřená)
messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(n.title || 'MojeBudky', {
    body: n.body || '',
    icon: '/img/Favikon.png',
    badge: '/img/Favikon.png',
    tag: data.tag || 'mb-notif',
    data: { url: data.url || '/' }
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const found = cs.find(c => c.url.includes(self.location.origin));
    if (found) { found.focus(); }
    else { clients.openWindow(url); }
  }));
});
