// AquaControl – FCM service worker (push notifikace)
// Vlastní úzký scope, nekoliduje s offline sw.js.
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
const ICON = '/mojebudky/aqua/icon-192.png';
const APP_URL = 'https://pkobelka.github.io/mojebudky/aqua/';

// Nová verze SW se aktivuje hned (nečeká na zavření všech oken)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Notifikace na pozadí (zavřená/neaktivní karta)
messaging.onBackgroundMessage(payload => {
  const title = payload.data?.title || 'AquaControl';
  const body  = payload.data?.body  || '';
  return self.registration.showNotification(title, {
    body,
    icon:    ICON,
    badge:   ICON,
    vibrate: [200, 100, 200],
    tag:     payload.data?.push_id || undefined,
    data:    { url: payload.data?.url || APP_URL }
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || APP_URL;
  e.waitUntil(clients.openWindow(url));
});
