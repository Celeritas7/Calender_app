const CACHE = 'mycal-v8';
const SHELL = ['./', './index.html', './css/styles.css', './js/akatsuki-client.js', './js/cal-adapter.js', './js/app.js', './js/notifications.js', './js/sukkiri.js', './js/sukkiri-trash.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('mycal-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache Supabase/API traffic — always live
  if (url.origin !== location.origin) { if (!/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host)) return; }
  // App shell: network-first so updates land, cache as offline fallback
  e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});

// Receive Akatsuki pushes in this Calendar installation.
self.addEventListener('push', e => {
 let d={}; try { d=e.data?e.data.json():{}; } catch { d={body:'Open Akatsuki to view your reminder.'}; }
 if(d.expires_at && Date.parse(d.expires_at)<=Date.now()) return;
 e.waitUntil(self.registration.showNotification(d.title || 'Calendar · Akatsuki',{
  body:d.body || '',tag:d.tag || 'calendar-alert',icon:'./icons/icon-192.png',
  data:{url:'https://celeritas7.github.io/Akatsuki/#broadcast'}
 }));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();
 // Open the shared record, where Done/Snooze updates every linked app.
 const target='https://celeritas7.github.io/Akatsuki/#broadcast';
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  const existing=clients.find(c=>c.url.startsWith('https://celeritas7.github.io/Akatsuki/'));
  if(existing){await existing.navigate(target);return existing.focus();}
  return self.clients.openWindow(target);
 }));
});
