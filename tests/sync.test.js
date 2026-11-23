// Synchronisation entre appareils (5.1.0) : le découpage en entrées, leurs dates et la fusion (engine/sync.js), plusieurs
// appareils simulés avec un serveur en mémoire, puis l'interface (ui/sync.js) avec un faux Firebase partagé par deux pages.
const assert = require('assert');
const { loadEngine, openPage, rng } = require('./lib');
const A = loadEngine();
const plain = x => JSON.parse(JSON.stringify(x));
const KEYS = { v2: 'repas-du-jour:v2', profil: 'repas-du-jour:profil:v1', planifs: 'repas-du-jour:planifs:v1', manges: 'repas-du-jour:manges:v1' };
const SKEY = 'repas-du-jour:sync:v1';

// --- 1. Identifiants, empreinte, découpage et recollage -------------------------------------------------------------
assert.deepStrictEqual(['profil', 'planifs', 'p.2026-10-07', 'c.0', 'c.6', 'm.2026-10-07', 'c.7', 'p.__proto__', '__proto__', 'constructor', 'p.2026-1-1', 'x.2026-10-07', 5, null].map(A.syncStoreOf),
  ['profil', 'planifs', 'v2', 'v2', 'v2', 'manges', null, null, null, null, null, null, null, null], 'identifiants');
assert(A.syncHash('{"a":1}') === A.syncHash('{"a":1}') && A.syncHash('{"a":1}') !== A.syncHash('{"a":2}'), 'empreinte');
const sample = {
  v2: JSON.stringify({ plans: { '2026-10-07': { seances: [{ taille: 'petite', moment: 'soir' }], libre: { dej: 'dehors' } }, '2026-10-08': { ch: { pdBase: 'pain' } } }, choices: { 3: { pdBase: 'sale' } } }),
  profil: JSON.stringify({ poids: 70, age: 30 }),
  planifs: JSON.stringify({ list: [{ from: '2026-10-08', to: '2026-10-10', checked: [] }] }),
  manges: JSON.stringify({ '2026-10-07': ['pd', 'dej'] })
};
const sp = A.syncSplit(sample);
assert.deepStrictEqual(Object.keys(sp.entries).sort(), ['c.3', 'm.2026-10-07', 'p.2026-10-07', 'p.2026-10-08', 'planifs', 'profil'], 'entrées');
assert.deepStrictEqual(plain(sp.bad), [], 'rien d’illisible');
const back = A.syncJoin({ v2: null, profil: null, planifs: null, manges: null }, sp.entries);
for (const k of Object.keys(sample)) assert.deepStrictEqual(JSON.parse(back[k]), JSON.parse(sample[k]), 'recollé à l’identique : ' + k);
// Recoller sur l'existant : seules les entrées données changent ; null efface ; identifiants et JSON invalides ignorés
const j2 = A.syncJoin(sample, { 'p.2026-10-08': null, 'c.4': '{"pdBase":"avoine"}', 'p.__proto__': '{"x":1}', 'c.9': '{}', 'm.2026-10-09': 'pas du json', profil: '[1]' });
assert.deepStrictEqual(Object.keys(j2), ['v2'], 'seule v2 touchée');
const v2b = JSON.parse(j2.v2);
assert(!('2026-10-08' in v2b.plans) && v2b.choices[4].pdBase === 'avoine' && v2b.choices[3].pdBase === 'sale' && Object.keys(v2b.plans).length === 1 && !({}).x, 'recollage partiel');
assert.strictEqual(A.syncJoin(sample, { profil: null }).profil, null, 'profil effacé : clé retirée');
// Clé illisible : ses entrées ne comptent pas (ni changées, ni effacées)
const bad = A.syncSplit(Object.assign({}, sample, { v2: '{oups' }));
assert.deepStrictEqual(plain(bad.bad), ['v2'] , 'v2 illisible');
assert(!Object.keys(bad.entries).some(id => /^[pc]\./.test(id)), 'pas d’entrée de v2 illisible');

// --- 2. Dates des changements et fusion -----------------------------------------------------------------------------
{
  const meta = A.cleanSyncMeta(null);
  assert.deepStrictEqual(plain(A.syncDiff(sp, meta, 1000)), [], 'première fois : rien n’est daté');
  assert(meta.init && Object.values(meta.t).every(t => t === 0) && meta.dirty.length === 0, 'tout à 0');
  const s2 = A.syncSplit(Object.assign({}, sample, { profil: JSON.stringify({ poids: 69, age: 30 }) }));
  assert.deepStrictEqual(plain(A.syncDiff(s2, meta, 2000)), ['profil'], 'profil changé');
  assert(meta.t.profil === 2000 && meta.dirty.includes('profil') && meta.t['c.3'] === 0, 'daté et à envoyer');
  // Effacé : marqué 'x', daté ; une clé illisible ne passe pas pour un effacement
  const v2c = JSON.parse(sample.v2); delete v2c.plans['2026-10-08'];
  const s3 = A.syncSplit(Object.assign({}, sample, { profil: s2.entries.profil, v2: JSON.stringify(v2c) }));
  assert.deepStrictEqual(plain(A.syncDiff(s3, meta, 3000)), ['p.2026-10-08'], 'jour effacé');
  assert(meta.seen['p.2026-10-08'] === 'x' && meta.t['p.2026-10-08'] === 3000, 'effacement daté');
  assert.deepStrictEqual(plain(A.syncDiff(A.syncSplit(Object.assign({}, sample, { profil: s2.entries.profil, v2: '{oups' })), meta, 4000)), [], 'v2 illisible : rien d’effacé');
  // Fusion : plus récent en ligne → appliqué ; plus ancien → ignoré ; à égalité → rien ; ce qui est à envoyer
  const m = A.syncMerge(s3, meta, [
    { id: 'c.3', v: '{"pdBase":"wrap"}', t: 2500, s: 10 }, { id: 'profil', v: '{"poids":80}', t: 1500, s: 11 },
    { id: 'm.2026-10-07', v: sp.entries['m.2026-10-07'], t: 0, s: 12 }, { id: 'p.__proto__', v: '{}', t: 9e12, s: 13 }, { id: 'p.2026-10-09', v: null, t: 5, s: 14 }], false);
  assert.deepStrictEqual(plain(m.apply), { 'c.3': '{"pdBase":"wrap"}' }, 'appliqué : seulement le plus récent qui change quelque chose');
  assert.deepStrictEqual(plain(m.push).map(x => x.id).sort(), ['p.2026-10-08', 'profil'], 'envoyés : les changements d’ici');
  assert(m.push.find(x => x.id === 'p.2026-10-08').v === null && meta.last === 14 && meta.t['c.3'] === 2500, 'effacement envoyé, dernière heure du serveur');
  // Le serveur a plus récent pour une entrée à envoyer : il gagne, elle n'est plus à envoyer
  const m2 = A.syncMerge(s3, meta, [{ id: 'profil', v: '{"poids":75}', t: 2600, s: 15 }], false);
  assert(m2.apply.profil === '{"poids":75}' && !m2.push.some(x => x.id === 'profil') && !meta.dirty.includes('profil'), 'conflit : le plus récent gagne');
  // Première liaison : la copie en ligne l'emporte sur tout ce qu'elle contient ; le reste est envoyé
  const meta2 = A.cleanSyncMeta(null); A.syncDiff(sp, meta2, 1); A.syncDiff(A.syncSplit(Object.assign({}, sample, { profil: '{"poids":60}' })), meta2, 9e12);
  const m3 = A.syncMerge(A.syncSplit(Object.assign({}, sample, { profil: '{"poids":60}' })), meta2, [{ id: 'profil', v: '{"poids":70}', t: 5, s: 1 }], true);
  assert(m3.apply.profil === '{"poids":70}' && m3.push.length === 5 && !m3.push.some(x => x.id === 'profil'), 'première liaison');
  // État relu : champs inconnus ou abîmés écartés
  const cm = A.cleanSyncMeta({ init: true, seen: { 'p.2026-10-07': 'a', __proto__: { x: 1 }, 'c.9': 'b' }, t: { profil: -1, planifs: 'x', 'c.1': 5 }, dirty: ['profil', 'profil', 'zz'], uid: 7, on: 'oui', last: NaN });
  assert.deepStrictEqual(plain(cm), { init: true, seen: { 'p.2026-10-07': 'a' }, t: { 'c.1': 5 }, dirty: ['profil'], uid: null, email: '', on: false, last: 0, at: 0, pending: false }, 'état relu');
}

// --- 3. Plusieurs appareils au hasard, un serveur en mémoire : à la fin, tous identiques, la dernière écriture gagne -----
{
  const R = rng(20261122);
  for (let run = 0; run < 400; run++){
    const server = { docs: {}, s: 0 };
    const pull = since => Object.keys(server.docs).filter(id => server.docs[id].s > since).map(id => Object.assign({ id }, server.docs[id]));
    const push = list => list.forEach(x => { server.docs[x.id] = { v: x.v, t: x.t, s: ++server.s }; });
    let clock = 1000;
    const dev = Array.from({ length: R.int(2, 3) }, (_, i) => ({ raw: i === 0 ? Object.assign({}, sample) : { v2: null, profil: null, planifs: null, manges: null }, meta: A.cleanSyncMeta(null), linked: false }));
    const truth = {};   // dernière écriture voulue : id → { v, t }
    const edit = d => {
      clock += R.int(0, 3);   // souvent à la même milliseconde qu'une autre modification
      const date = '2026-10-' + String(R.int(1, 9)).padStart(2, '0'), v2 = JSON.parse(d.raw.v2 || '{"plans":{},"choices":{}}');
      const kind = R.int(0, 3);
      if (kind === 0) v2.plans[date] = { seances: [], n: R.int(0, 99) };
      else if (kind === 1) delete v2.plans[date];
      else if (kind === 2) v2.choices[R.int(0, 6)] = { pdBase: R.pick(['pain', 'sale', 'wrap']) };
      else { d.raw.profil = JSON.stringify({ poids: R.int(50, 90) }); }
      if (kind < 3) d.raw.v2 = JSON.stringify(v2);
      A.syncDiff(A.syncSplit(d.raw), d.meta, clock);
    };
    // Une synchronisation en deux temps : lire et fusionner, puis envoyer ; entre les deux, d'autres appareils peuvent écrire
    // (le serveur garde la dernière écriture reçue, même plus ancienne)
    const pullDev = d => {
      const first = !d.linked, split = A.syncSplit(d.raw);
      A.syncDiff(split, d.meta, clock);
      const m = A.syncMerge(split, d.meta, pull(first ? 0 : d.meta.last), first);
      Object.assign(d.raw, A.syncJoin(d.raw, m.apply));
      d.linked = true;
      d.out = m.push;
    };
    const pushDev = d => {
      if (!d.out) return;
      push(d.out);
      d.out.forEach(x => { const i = d.meta.dirty.indexOf(x.id); if (i >= 0) d.meta.dirty.splice(i, 1); });
      d.out = null;
    };
    const syncDev = d => { pullDev(d); pushDev(d); };
    dev.forEach(d => A.syncDiff(A.syncSplit(d.raw), d.meta, clock));
    syncDev(dev[0]);
    for (let step = 0; step < 40; step++){ const d = R.pick(dev), x = R.next(); if (x < 0.5) edit(d); else if (x < 0.7) pullDev(d); else if (x < 0.85) pushDev(d); else syncDev(d); }
    dev.forEach(pushDev);
    for (let k = 0; k < 3; k++) dev.forEach(syncDev);
    const norm = d => JSON.stringify(Object.entries(A.syncSplit(d.raw).entries).sort());
    dev.forEach((d, i) => assert.strictEqual(norm(d), norm(dev[0]), `run ${run} : appareil ${i} différent`));
    // Ce qui reste en ligne = ce qu'ont les appareils (effacements compris)
    const live = Object.keys(server.docs).filter(id => server.docs[id].v !== null).sort();
    assert.deepStrictEqual(live, Object.keys(A.syncSplit(dev[0].raw).entries).sort(), `run ${run} : serveur ≠ appareils`);
    void truth;
  }
}

// --- 4. L'interface, avec un faux Firebase : deux appareils, un compte ------------------------------------------------
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 5)); };
const makeServer = () => ({ docs: {}, s: 0, pulls: 0, pushes: [], wipeFail: false });
function fakeFirebase(server, account, o = {}){
  let cb = null;
  const a = {
    user: o.signedIn ? account : null,
    onUser(f){ cb = f; Promise.resolve().then(() => f(a.user)); },
    signIn(){ if (o.signInError) return Promise.reject(o.signInError); a.user = account; Promise.resolve().then(() => cb && cb(a.user)); return Promise.resolve(); },
    signOut(){ a.user = null; if (cb) cb(null); return Promise.resolve(); },
    pull(uid, since){ server.pulls++; const d = server.docs[uid] || {}; return Promise.resolve(Object.keys(d).filter(id => d[id].s > since).map(id => Object.assign({ id }, d[id]))); },
    push(uid, list){ const d = server.docs[uid] || (server.docs[uid] = {}); [...list].forEach(x => { d[x.id] = { v: x.v, t: x.t, s: ++server.s }; server.pushes.push(x.id); }); return Promise.resolve(); },
    wipe(uid){ if (server.wipeFail) return Promise.reject({ code: 'unavailable' }); delete server.docs[uid]; return Promise.resolve(); }
  };
  return a;
}
const clock = { now: new Date(2026, 9, 7, 9).getTime() };
const device = (server, storage, o = {}) => {
  const st = { reloads: 0 };
  const errors = [];
  const dom = openPage({ clock, errors, storage, setup: win => { if (o.flash) win.sessionStorage.setItem('repas-du-jour:sync-flash', '1'); win.__repasSync = { adapter: fakeFirebase(server, { uid: 'u1', email: 'moi@exemple.fr' }, o), reload: () => { st.reloads++; }, delay: 0, poll: o.poll || 0 }; } });
  const d = dom.window.document, $ = s => d.querySelector(s);
  return Object.assign(st, { dom, d, $, errors, ls: dom.window.localStorage, click: s => { const e = $(s); assert(e, 'introuvable : ' + s); e.click(); },
    snapshot: () => { const o = {}; for (let i = 0; i < dom.window.localStorage.length; i++){ const k = dom.window.localStorage.key(i); o[k] = dom.window.localStorage.getItem(k); } return o; },
    meta: () => JSON.parse(dom.window.localStorage.getItem(SKEY) || 'null') });
};
(async () => {
  const server = makeServer();
  // Appareil A : un profil, un jour prévu ; se connecte depuis les réglages, tout est envoyé (la copie en ligne est vide)
  let a = device(server, { [KEYS.profil]: JSON.stringify({ age: 40, taille: 180, poids: 75 }), [KEYS.v2]: JSON.stringify({ plans: { '2026-10-07': { seances: [{ taille: 'petite', moment: 'soir' }] } }, choices: {} }), 'repas-du-jour:repas:v1': '2026-10-07' });
  a.click('#gear'); a.click('#tab-appli');
  assert(/son administrateur peut techniquement y accéder/.test(a.$('#sync-s').textContent) && a.$('#sync-in') && a.$('#eff-sync').hidden, 'réglages : pas connecté');
  assert(a.meta() && a.meta().init && !a.meta().on, 'dates de départ posées sans connexion');
  a.click('#sync-in');
  await flush();
  assert(/^Connecté avec moi@exemple\.fr\. Dernière synchronisation\s:\saujourd’hui à 9\sh\s00\.$/.test(a.$('#sync-st').textContent), 'connecté : ' + a.$('#sync-st').textContent);
  assert.deepStrictEqual(Object.keys(server.docs.u1).sort(), ['p.2026-10-07', 'profil'], 'envoyé : ' + Object.keys(server.docs.u1 || {}));
  assert(a.reloads === 0 && a.meta().on && a.meta().uid === 'u1' && a.$('#sync-out') && !a.$('#eff-sync').hidden, 'rien à reprendre, pas de rechargement');
  // Appareil B, neuf : l'accueil s'ouvre ; « Se connecter avec Google » reprend le profil et le jour, la page se recharge
  const b0 = device(server, {});
  assert(!b0.$('#accueil').hidden && b0.$('#acc-sync'), 'accueil avec la connexion');
  b0.click('#acc-sync');
  await flush();
  assert.strictEqual(b0.reloads, 1, 'B : rechargé après la reprise');
  assert(JSON.parse(b0.ls.getItem(KEYS.profil)).poids === 75 && JSON.parse(b0.ls.getItem(KEYS.v2)).plans['2026-10-07'], 'B : profil et jour repris');
  // B rechargé : plus d'accueil, connecté tout seul, rien de nouveau
  let b = device(server, b0.snapshot(), { signedIn: true, flash: true });
  await flush();
  assert(b.$('#accueil').hidden && b.reloads === 0 && b.$('#hint').textContent === 'Tes données sont à jour avec tes autres appareils.', 'B rechargé : ' + b.$('#hint').textContent);
  assert.deepStrictEqual(b.d.querySelectorAll('#sess .chip[data-action="sess"]').length, 1, 'B : la séance de A');
  // B change un plat (une minute plus tard) : envoyé tout seul ; A le reprend à sa prochaine synchronisation
  clock.now += 60000;
  b.click('[data-action="open-pick"][data-kind="dessert"][data-slot="dej"]'); b.click('#sheet [data-value="chocolat"]');
  await flush();
  assert(server.docs.u1['p.2026-10-07'] && JSON.parse(server.docs.u1['p.2026-10-07'].v).ch.dej.dessert === 'chocolat', 'B : plat envoyé');
  a.click('#sync-now');
  await flush();
  assert(a.reloads === 1 && JSON.parse(a.ls.getItem(KEYS.v2)).plans['2026-10-07'].ch.dej.dessert === 'chocolat', 'A : plat de B repris');
  // A rouvert ; un formulaire en cours : ce qui vient de B attend, rien n'est écrit ni rechargé
  a = device(server, a.snapshot(), { signedIn: true });
  await flush();
  clock.now += 60000;
  b.click('#sw-lib-diner');
  await flush();
  a.click('#open-repas');
  a.click('#repas-h');   // un clic dans le formulaire : synchronisation (délai 0 ici)
  await flush();
  assert(a.reloads === 0 && !JSON.parse(a.ls.getItem(KEYS.v2)).plans['2026-10-07'].libre && /arrivent dès que tu reviens à ta journée/.test(a.$('#sync-st').textContent), 'occupé : en attente ' + a.$('#sync-st').textContent);
  a.click('#repas [data-action="fermer"]');
  await flush();
  assert(a.reloads === 1 && JSON.parse(a.ls.getItem(KEYS.v2)).plans['2026-10-07'].libre.diner, 'revenu à la journée : repris');
  // Le même jour changé ici puis là-bas : le plus récent (B) gagne, A le reprend
  a = device(server, a.snapshot(), { signedIn: true }); await flush();
  clock.now += 60000; a.click('#sw-lib-dej'); await flush();
  clock.now += 60000; b.click('#sw-lib-diner'); await flush();
  const won = JSON.parse(server.docs.u1['p.2026-10-07'].v).libre;
  a.click('#gear'); a.click('#tab-appli'); a.click('#sync-now'); await flush();
  assert(!won.diner && !won.dej && a.reloads === 1 && JSON.stringify(JSON.parse(a.ls.getItem(KEYS.v2)).plans['2026-10-07'].libre) === '{}', 'le plus récent (B) gagne : ' + JSON.stringify(won));
  // À la même milliseconde, deux valeurs différentes : le même choix partout, après quelques synchronisations
  a = device(server, a.snapshot(), { signedIn: true }); await flush();
  clock.now += 60000; a.click('#sw-lib-dej'); b.click('#sw-lib-diner'); await flush();
  let pa = a, pb = b;
  for (let k = 0; k < 3; k++){
    for (const which of ['a', 'b']){
      const x = which === 'a' ? pa : pb;
      x.click('#gear'); x.click('#tab-appli'); x.click('#sync-now'); await flush();
      if (x.reloads){ const y = device(server, x.snapshot(), { signedIn: true }); await flush(); if (which === 'a') pa = y; else pb = y; }
    }
  }
  const lib = x => JSON.stringify(JSON.parse(x.ls.getItem(KEYS.v2)).plans['2026-10-07'].libre);
  assert(lib(pa) === lib(pb) && lib(pa) === JSON.stringify(JSON.parse(server.docs.u1['p.2026-10-07'].v).libre), 'même milliseconde : ' + lib(pa) + ' / ' + lib(pb));
  a = pa; b = pb;
  // En direct (5.2.0) : une page ouverte sans rien toucher reçoit ce qui change ailleurs (vérification toutes les 30 ms ici)
  const live = device(server, a.snapshot(), { signedIn: true, poll: 30 }); await flush();
  clock.now += 60000; b.click('#sw-lib-dej'); await flush();
  const pulls0 = server.pulls;
  await new Promise(r => setTimeout(r, 150));
  assert(live.reloads === 1 && server.pulls > pulls0 && JSON.parse(live.ls.getItem(KEYS.v2)).plans['2026-10-07'].libre.dej, 'en direct : reçu sans rien toucher');
  live.dom.window.close();
  // Se déconnecter : les données restent, plus de Firebase au démarrage
  b.click('#gear'); b.click('#tab-appli'); b.click('#sync-out'); await flush();
  assert(b.$('#sync-st').textContent === 'Déconnecté. Tes données restent sur cet appareil.' && !b.meta().on && b.ls.getItem(KEYS.profil), 'déconnecté');
  const pulls = server.pulls; device(server, b.snapshot()); await flush();
  assert.strictEqual(server.pulls, pulls, 'déconnecté : pas de synchronisation au démarrage');
  // Connexion annulée : un message, rien d'autre
  const c = device(makeServer(), {}, { signInError: { code: 'auth/popup-closed-by-user' } });
  c.click('#acc-sync'); await flush();
  assert(c.$('#acc-sync-msg').textContent === 'Connexion annulée.' && c.$('#sync-err').textContent === 'Connexion annulée.' && !c.meta().pending, 'connexion annulée');
  // Tout effacer, connecté : la copie en ligne d'abord ; sans réseau, rien n'est effacé
  a = device(server, a.snapshot(), { signedIn: true }); await flush();
  a.click('#gear'); a.click('#tab-appli'); a.click('#eff-btn');
  assert(!a.$('#eff-sync').hidden, 'la copie en ligne sera effacée aussi');
  server.wipeFail = true;
  a.click('[data-action="eff-ok"]'); await flush();
  assert(/^Ta copie en ligne n’a pas pu être effacée\s:\spas de réseau.*Rien n’a été effacé\.$/.test(a.$('#eff-msg').textContent) && a.ls.getItem(KEYS.profil) && server.docs.u1, 'effacement refusé : ' + a.$('#eff-msg').textContent);
  server.wipeFail = false;
  a.click('[data-action="eff-ok"]'); await flush();
  assert(!server.docs.u1 && !a.ls.getItem(KEYS.profil) && !a.$('#accueil').hidden, 'tout effacé, en ligne aussi');
  [a, b, c].forEach(x => assert.deepStrictEqual(x.errors, [], 'erreur dans la page : ' + x.errors.join(' | ')));
  console.log('synchronisation OK (moteur, 400 simulations à plusieurs appareils, interface à deux appareils, en direct)');
})().catch(e => { console.error(e); process.exit(1); });
