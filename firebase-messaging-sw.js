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

// Notifikace na pozadí (když je karta zavřená / na pozadí)
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'MojeBudky.cz';
  const body  = payload.notification?.body  || '';
  return self.registration.showNotification(title, {
    body,
    icon:    '/mojebudky/img/icon-192.png',
    badge:   '/mojebudky/img/icon-192.png',
    vibrate: [200, 100, 200],
    data:    { url: payload.data?.url || 'https://pkobelka.github.io/mojebudky/' }
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || 'https://pkobelka.github.io/mojebudky/';
  e.waitUntil(clients.openWindow(url));
});
