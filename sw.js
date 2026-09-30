/* Service worker de Repas du jour : l'appli installée marche aussi hors connexion.
   - La page : réseau d'abord (une nouvelle version arrive dès qu'on est connecté), copie gardée si le réseau manque.
   - Manifeste, icônes et polices : copie gardée d'abord (ils ne changent pas), réseau sinon.
   Changer CACHE seulement si la liste CORE change ; les anciennes copies sont effacées à l'activation. */
'use strict';
const CACHE = 'repas-du-jour-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
const FONTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CORE); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
const keep = function(req, res){
  if (res && (res.ok || res.type === 'opaque')){ const copy = res.clone(); caches.open(CACHE).then(function(c){ return c.put(req, copy); }); }
  return res;
};
self.addEventListener('fetch', function(e){
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate'){
    e.respondWith(fetch(req).then(function(res){ return keep(req, res); }).catch(function(){
      return caches.match(req, {ignoreSearch:true}).then(function(hit){ return hit || caches.match('./'); }).then(function(hit){ return hit || caches.match('./index.html'); });
    }));
    return;
  }
  if (url.origin !== self.location.origin && FONTS.indexOf(url.hostname) < 0) return;
  e.respondWith(caches.match(req).then(function(hit){ return hit || fetch(req).then(function(res){ return keep(req, res); }); }));
});
