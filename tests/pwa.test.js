// Appli installable (PWA) : manifeste, icônes, lien dans la page, et service worker simulé (cache, réseau d'abord,
// hors connexion) sans navigateur.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Manifeste : nom, plein écran, couleurs de la page, icônes présentes à la bonne taille
const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.strictEqual(man.name, 'Repas du jour', 'nom de l’appli');
assert(man.short_name && man.short_name.length <= 12, 'nom court (sous l’icône) : ' + man.short_name);
assert.strictEqual(man.lang, 'fr', 'langue');
assert.strictEqual(man.display, 'standalone', 'plein écran');
assert(man.start_url === './' && man.scope === './' && man.id === './', 'adresses relatives (le site est dans un sous-dossier)');
assert(man.background_color === '#EEF1EB' && man.theme_color === '#EEF1EB', 'couleur papier');
const pngSize = file => { const b = fs.readFileSync(path.join(root, file)); assert.strictEqual(b.toString('hex', 0, 8), '89504e470d0a1a0a', file + ' n’est pas un PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
for (const icon of man.icons) {
  const [w, h] = pngSize(icon.src);
  assert.strictEqual(icon.sizes, w + 'x' + h, icon.src + ' : taille déclarée ' + icon.sizes + ', réelle ' + w + 'x' + h);
  assert.strictEqual(icon.type, 'image/png', icon.src);
}
assert(man.icons.some(i => i.sizes === '192x192' && i.purpose === 'any') && man.icons.some(i => i.sizes === '512x512' && i.purpose === 'any'), 'icônes 192 et 512');
assert(man.icons.some(i => i.purpose === 'maskable'), 'icône adaptée aux formes d’Android');

// Page : lien vers le manifeste, réglages de l'écran d'accueil de l'iPhone, service worker enregistré seulement en http(s)
assert(/<link rel="manifest" href="manifest\.webmanifest">/.test(html), 'lien vers le manifeste');
assert(/<meta name="apple-mobile-web-app-capable" content="yes">/.test(html) && /<meta name="apple-mobile-web-app-title" content="Repas">/.test(html), 'réglages iPhone');
assert(/<link rel="apple-touch-icon" href="data:image\/png;base64,/.test(html), 'icône de l’écran d’accueil de l’iPhone');
assert(/'serviceWorker' in navigator && \/\^https\?:\$\/\.test\(location\.protocol\)/.test(html) && /register\('sw\.js'\)/.test(html), 'enregistrement du service worker');

// Service worker simulé : cache en mémoire, réseau qu'on coupe à volonté
const src = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const ORIGIN = 'https://fnovellon.github.io', BASE = ORIGIN + '/NutriPlan/';
const abs = u => new URL(u, BASE).href;
const store = new Map();   // nom du cache → Map(url → réponse)
let online = true, fetched = [];
const response = (body, type) => ({ ok: type !== 'opaque', type: type || 'basic', body, clone(){ return response(body, type); } });
const cacheOf = name => {
  if (!store.has(name)) store.set(name, new Map());
  const m = store.get(name);
  return {
    addAll: urls => Promise.all(urls.map(u => fetchFn(abs(u)).then(r => m.set(abs(u), r)))),
    put: (req, res) => { m.set(typeof req === 'string' ? abs(req) : req.url, res); return Promise.resolve(); },
    keys: () => Promise.resolve([...m.keys()].map(url => ({ url })))
  };
};
const keyOf = (req, opts) => { const u = new URL(typeof req === 'string' ? abs(req) : req.url); if (opts && opts.ignoreSearch) u.search = ''; return u.href; };
const caches = {
  open: name => Promise.resolve(cacheOf(name)),
  keys: () => Promise.resolve([...store.keys()]),
  delete: name => Promise.resolve(store.delete(name)),
  match: (req, opts) => {
    const k = keyOf(req, opts);
    for (const m of store.values()) for (const [u, r] of m) if ((opts && opts.ignoreSearch ? keyOf(u, opts) : u) === k) return Promise.resolve(r);
    return Promise.resolve(undefined);
  }
};
function fetchFn(req){
  const url = typeof req === 'string' ? req : req.url;
  fetched.push(url);
  if (!online) return Promise.reject(new TypeError('hors connexion'));
  return Promise.resolve(response('réseau ' + url, /fonts\.googleapis/.test(url) ? 'opaque' : 'basic'));
}
const listeners = {};
const self = { location: new URL(BASE + 'sw.js'), addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() } };
vm.runInNewContext(src, { self, caches, fetch: fetchFn, URL, Promise });
const run = async (type, extra) => {
  let waited = null, answer = null;
  const e = Object.assign({ waitUntil: p => { waited = p; }, respondWith: p => { answer = p; } }, extra);
  listeners[type](e);
  if (waited) await waited;
  return answer ? await answer : null;
};
const nav = url => ({ request: { method: 'GET', mode: 'navigate', url: abs(url) } });
const get = url => ({ request: { method: 'GET', mode: 'cors', url: abs(url) } });

(async () => {
  // Installation : la page, le manifeste et les icônes sont gardés
  store.set('repas-du-jour-v0', new Map([[abs('vieux'), response('vieux')]]));
  await run('install');
  const CACHE = [...store.keys()].find(k => k !== 'repas-du-jour-v0');
  const kept = [...store.get(CACHE).keys()];
  for (const f of ['./', './index.html', './manifest.webmanifest', ...man.icons.map(i => i.src)]) assert(kept.includes(abs(f)), 'pas gardé à l’installation : ' + f);
  for (const f of man.icons.map(i => i.src).concat(['index.html', 'manifest.webmanifest'])) assert(fs.existsSync(path.join(root, f)), 'fichier absent : ' + f);
  // Activation : les anciennes copies sont effacées
  await run('activate');
  assert.deepStrictEqual([...store.keys()], [CACHE], 'ancienne copie non effacée');
  // En ligne : la page vient du réseau (nouvelle version tout de suite) et la copie est mise à jour
  fetched = [];
  let r = await run('fetch', nav('./'));
  assert(r.body === 'réseau ' + abs('./') && fetched.length === 1, 'page pas prise sur le réseau');
  // Hors connexion : la copie gardée, même avec des paramètres ou par index.html
  online = false;
  r = await run('fetch', nav('./?source=pwa'));
  assert.strictEqual(r.body, 'réseau ' + abs('./'), 'page hors connexion');
  store.get(CACHE).delete(abs('./'));
  r = await run('fetch', nav('./'));
  assert.strictEqual(r.body, 'réseau ' + abs('./index.html'), 'repli sur index.html hors connexion');
  // Polices : gardées au premier passage (même opaques), servies ensuite sans réseau
  online = true;
  const font = 'https://fonts.googleapis.com/css2?family=Archivo';
  await run('fetch', { request: { method: 'GET', mode: 'no-cors', url: font } });
  await new Promise(res => setTimeout(res, 0));
  online = false;
  r = await run('fetch', { request: { method: 'GET', mode: 'no-cors', url: font } });
  assert.strictEqual(r.body, 'réseau ' + font, 'police hors connexion');
  // Icônes : copie gardée d'abord ; autres sites (lien vers les nouveautés) et requêtes POST : pas touchées
  r = await run('fetch', get('icons/icon-192.png'));
  assert(r && r.body === 'réseau ' + abs('./icons/icon-192.png'), 'icône hors connexion');
  assert.strictEqual(await run('fetch', get('https://github.com/fnovellon/NutriPlan')), null, 'autre site intercepté');
  assert.strictEqual(await run('fetch', { request: { method: 'POST', mode: 'cors', url: abs('./') } }), null, 'POST intercepté');
  console.log('appli installable OK (manifeste, ' + man.icons.length + ' icônes, service worker)');
})().catch(e => { console.error(e); process.exit(1); });
