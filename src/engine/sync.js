/* Synchronisation entre appareils (5.1.0), sans réseau ni DOM : les données de l'appli découpées en entrées, chacune avec
   l'heure de sa dernière modification ; la plus récente gagne. Le transport (Firebase) est dans ui/sync.js.
   Entrées (identifiants) : 'p.AAAA-MM-JJ' (le plan d'une date, clé v2), 'c.0'…'c.6' (les plats en mémoire d'un jour de la
   semaine, v2), 'm.AAAA-MM-JJ' (les repas cochés d'une date), 'profil', 'planifs' (les clés entières). Valeur : le JSON de
   l'entrée, null si elle a été effacée. Pas la date d'ouverture du formulaire des repas (propre à l'appareil). */
const SYNC_STORES = {v2:'repas-du-jour:v2', profil:'repas-du-jour:profil:v1', planifs:'repas-du-jour:planifs:v1', manges:'repas-du-jour:manges:v1'};
const SYNC_KEY = 'repas-du-jour:sync:v1';
const SYNC_DATE = /^\d{4}-\d\d-\d\d$/;
/* Identifiant valide, et sa clé de stockage (sinon null) : jamais une propriété héritée (__proto__…) */
function syncStoreOf(id){
  if (id === 'profil' || id === 'planifs') return id;
  if (typeof id !== 'string') return null;
  const p = id.slice(0, 2), x = id.slice(2);
  if ((p === 'p.' || p === 'm.') && SYNC_DATE.test(x)) return p === 'p.' ? 'v2' : 'manges';
  if (p === 'c.' && /^[0-6]$/.test(x)) return 'v2';
  return null;
}
/* Empreinte d'une valeur (FNV-1a 32 bits) : de quoi voir qu'elle a changé sans la garder en double */
function syncHash(s){
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
const syncParse = function(s){
  if (s === null || s === undefined) return {o:null, ok:true};
  try { const o = JSON.parse(s); if (o && typeof o === 'object' && !Array.isArray(o)) return {o:o, ok:true}; } catch (e) {}
  return {o:null, ok:false};
};
/* raw : { v2, profil, planifs, manges } (chaînes du stockage, null si absentes). Renvoie { entries: { id: JSON }, bad: [clés
   illisibles] } : les entrées d'une clé illisible ne sont ni comparées ni remplacées (jamais prises pour des effacements). */
function syncSplit(raw){
  const out = {}, bad = [];
  const get = function(k){ const r = syncParse(raw[k]); if (!r.ok) bad.push(k); return r.o; };
  const v2 = get('v2');
  if (v2) [['plans', 'p.'], ['choices', 'c.']].forEach(function(x){
    const o = v2[x[0]];
    if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(function(k){ const id = x[1] + k; if (syncStoreOf(id)) out[id] = JSON.stringify(o[k]); });
  });
  const m = get('manges');
  if (m) Object.keys(m).forEach(function(k){ const id = 'm.' + k; if (syncStoreOf(id)) out[id] = JSON.stringify(m[k]); });
  ['profil', 'planifs'].forEach(function(k){ const o = get(k); if (o) out[k] = JSON.stringify(o); });
  return {entries:out, bad:bad};
}
/* Applique des entrées venues d'un autre appareil ({ id: JSON | null }) aux chaînes du stockage ; renvoie les nouvelles
   chaînes des clés touchées (null : clé à retirer). Une entrée invalide (identifiant, JSON) est ignorée. */
function syncJoin(raw, changes){
  const obj = {}, touched = {};
  const load = function(k){
    if (!has(obj, k)){ const r = syncParse(raw[k]); obj[k] = r.o || (k === 'v2' ? {plans:{}, choices:{}} : k === 'manges' ? {} : null); }
    return obj[k];
  };
  Object.keys(changes).forEach(function(id){
    const k = syncStoreOf(id), v = changes[id];
    if (!k) return;
    let val = null;
    if (v !== null){ try { val = JSON.parse(v); } catch (e) { return; } }
    if (k === 'profil' || k === 'planifs'){
      if (val !== null && (typeof val !== 'object' || Array.isArray(val))) return;
      obj[k] = val; touched[k] = true; return;
    }
    const o = load(k), x = id.slice(2);
    const box = k === 'manges' ? o : id.slice(0, 2) === 'p.' ? (o.plans && typeof o.plans === 'object' ? o.plans : (o.plans = {})) : (o.choices && typeof o.choices === 'object' ? o.choices : (o.choices = {}));
    if (val === null) delete box[x]; else box[x] = val;
    touched[k] = true;
  });
  const out = {};
  Object.keys(touched).forEach(function(k){ out[k] = obj[k] === null ? null : JSON.stringify(obj[k]); });
  return out;
}
/* État de la synchronisation relu du stockage : { init, seen: { id: empreinte | 'x' (effacée) }, t: { id: ms }, dirty: [id],
   uid (le dernier compte lié à cet appareil), email, on (connecté : Firebase chargé au démarrage), last (heure du serveur de la
   dernière entrée reçue), at (dernière synchronisation réussie), pending (connexion en cours, par redirection) } */
function cleanSyncMeta(o){
  const out = {init:false, seen:{}, t:{}, dirty:[], uid:null, email:'', on:false, last:0, at:0, pending:false};
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  out.init = o.init === true;
  ['seen', 't'].forEach(function(f){
    const s = o[f];
    if (s && typeof s === 'object' && !Array.isArray(s)) Object.keys(s).forEach(function(id){
      if (!syncStoreOf(id)) return;
      if (f === 'seen' ? typeof s[id] === 'string' : typeof s[id] === 'number' && isFinite(s[id]) && s[id] >= 0) out[f][id] = s[id];
    });
  });
  if (Array.isArray(o.dirty)) out.dirty = o.dirty.filter(function(id, i, a){ return syncStoreOf(id) && a.indexOf(id) === i; });
  if (typeof o.uid === 'string' && o.uid) out.uid = o.uid;
  if (typeof o.email === 'string') out.email = o.email.slice(0, 200);
  ['last', 'at'].forEach(function(f){ if (typeof o[f] === 'number' && isFinite(o[f]) && o[f] >= 0) out[f] = o[f]; });
  out.pending = o.pending === true;
  out.on = o.on === true;
  return out;
}
/* Ce qui a changé sur cet appareil depuis la dernière fois (meta modifié) : chaque entrée changée ou effacée prend l'heure
   now et devient à envoyer (dirty). La toute première fois (init), rien n'est daté : tout part à 0, la copie en ligne
   l'emportera. Les entrées d'une clé illisible ne bougent pas. Renvoie les identifiants changés. */
function syncDiff(split, meta, now){
  const e = split.entries, changed = [];
  const badId = function(id){ return split.bad.indexOf(syncStoreOf(id)) >= 0; };
  if (!meta.init){
    Object.keys(e).forEach(function(id){ meta.seen[id] = syncHash(e[id]); meta.t[id] = 0; });
    meta.init = true;
    return changed;
  }
  Object.keys(e).forEach(function(id){
    const h = syncHash(e[id]);
    if (meta.seen[id] !== h){ meta.seen[id] = h; meta.t[id] = now; changed.push(id); }
  });
  Object.keys(meta.seen).forEach(function(id){
    if (has(e, id) || meta.seen[id] === 'x' || badId(id)) return;
    meta.seen[id] = 'x'; meta.t[id] = now; changed.push(id);
  });
  changed.forEach(function(id){ if (meta.dirty.indexOf(id) < 0) meta.dirty.push(id); });
  return changed;
}
/* Fusion avec ce qui vient du serveur (remote : [{ id, v, t, s }], s : heure du serveur). first : première liaison de cet
   appareil à ce compte, la copie en ligne l'emporte sur tout ce qu'elle contient. Sinon, la plus récente gagne ; à la même
   heure, la plus grande valeur (le même choix sur tous les appareils). Le serveur garde la dernière écriture reçue, pas la
   plus récente : une entrée en ligne plus ancienne que celle d'ici est renvoyée. Renvoie { apply: { id: JSON | null }
   (seulement ce qui change ici), push: [{ id, v, t }] } ; meta suit (heures, empreintes, dirty, last). */
function syncMerge(split, meta, remote, first){
  const apply = {}, there = {};
  let last = meta.last;
  remote.forEach(function(r){
    if (!r || !syncStoreOf(r.id) || split.bad.indexOf(syncStoreOf(r.id)) >= 0) return;
    const v = typeof r.v === 'string' ? r.v : null, t = typeof r.t === 'number' && isFinite(r.t) ? r.t : 0;
    if (typeof r.s === 'number' && r.s > last) last = r.s;
    there[r.id] = true;
    const lt = first ? -1 : has(meta.t, r.id) ? meta.t[r.id] : -1;
    const cur = has(split.entries, r.id) ? split.entries[r.id] : null;
    if (t < lt || (t === lt && String(v) <= String(cur))){
      if (cur !== v && meta.dirty.indexOf(r.id) < 0) meta.dirty.push(r.id);
      return;
    }
    if (cur !== v) apply[r.id] = v;
    meta.t[r.id] = t;
    meta.seen[r.id] = v === null ? 'x' : syncHash(v);
    const d = meta.dirty.indexOf(r.id);
    if (d >= 0) meta.dirty.splice(d, 1);
  });
  meta.last = last;
  const ids = first ? Object.keys(split.entries).filter(function(id){ return !there[id]; }) : meta.dirty.slice();
  const push = ids.filter(function(id){ return syncStoreOf(id); }).map(function(id){
    return {id:id, v:has(split.entries, id) ? split.entries[id] : null, t:has(meta.t, id) ? meta.t[id] : 0};
  });
  return {apply:apply, push:push};
}
