// Comparaison avec une version de référence, pour une restructuration sans changement visible : le moteur et
// l'interface de la page actuelle doivent donner exactement les mêmes résultats que la référence, lue dans git.
//   - moteur : toutes les données de premier niveau ; chaque fonction appelée sur des milliers d'entrées au hasard
//     (valides pour la plupart, d'après le nom de ses paramètres, parfois abîmées) ; journées complètes ; batch cooking ;
//   - interface : les deux pages côte à côte (jsdom, même horloge, même hasard), les mêmes actions au hasard sur chacune
//     (boutons, champs, retour du téléphone, Échap, jour suivant, rechargement), puis écran, focus, champs, historique,
//     stockage et erreurs comparés après chaque action.
// npm run test:ref ; REF=<commit> : autre référence (par défaut HEAD, le dernier commit ; la restructuration de la 3.15.0 a été
// vérifiée contre REF=9f47bbc). FUZZ, SEED : comme les tests de fond.
process.env.TZ = 'Europe/Paris';
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { html, rng, settings, checker, openPage } = require('./lib');

const REF = process.env.REF || 'HEAD';
let refHtml;
try {
  refHtml = execFileSync('git', ['show', REF + ':index.html'], { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e){
  console.error('comparaison : référence ' + REF + ' introuvable dans git (historique trop court ? git fetch --deepen=200)');
  process.exit(1);
}
const { factor, seed } = settings(3150);
const R = rng(seed);
const C = checker('comparaison avec ' + REF.slice(0, 7));
const UNDEF = { __undef: 1 };

// Valeur lisible et comparable (fonctions, undefined, NaN et Infinity compris)
const ser = v => {
  try { return JSON.stringify(v, (k, x) => typeof x === 'function' ? 'ƒ' : x === undefined ? '∅' : typeof x === 'number' && !isFinite(x) ? String(x) : x); }
  catch (e){ return '!' + e.name; }
};
// Première différence entre deux textes, avec un peu de contexte
const diff = (a, b) => {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const cut = s => JSON.stringify(s.slice(Math.max(0, i - 100), i + 200));
  return 'à ' + i + '\n    réf. : ' + cut(a) + '\n    act. : ' + cut(b);
};
// Copie fraîche d'une entrée pour chaque version ({__rand: graine} → tirages reproductibles, UNDEF → undefined)
const mat = v => {
  if (!v || typeof v !== 'object') return v;
  if (v === UNDEF) return undefined;
  if (v.__rand !== undefined) return rng(v.__rand).next;
  if (Array.isArray(v)) return v.map(mat);
  const o = {};
  Object.keys(v).forEach(k => { o[k] = mat(v[k]); });
  return o;
};
const plain = v => JSON.parse(JSON.stringify(v));

// --- 1. Moteur ---------------------------------------------------------------------------------------------------------
const RAND_SRC = 'function __seeded(s){ s >>>= 0; return function(){ s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }';
function engine(page){
  const m = page.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('script introuvable');
  const ctx = vm.createContext({});
  vm.runInContext(RAND_SRC, ctx);
  vm.runInContext(m[1], ctx);
  const scripts = new Map();
  return {
    src: m[1],
    has: name => vm.runInContext('typeof ' + name + ' !== "undefined"', ctx),
    get: name => vm.runInContext(name, ctx),
    // Appel avec Math.random fixé (graine rs) et un temps limité : renvoie la valeur ou le type d'erreur
    call(name, args, rs){
      if (!scripts.has(name)) scripts.set(name, new vm.Script(name + '.apply(null, __args)'));
      ctx.__args = args;
      vm.runInContext('Math.random = __seeded(' + rs + ')', ctx);
      try { return { v: scripts.get(name).runInContext(ctx, { timeout: 3000 }) }; }
      catch (e){ return { err: e && e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ? 'temps dépassé' : String(e && e.name) }; }
    }
  };
}
const A = engine(refHtml), B = engine(html);

// Déclarations de premier niveau de la référence (function, const, let, var ; plusieurs par ligne possibles)
const NAMES = [];
A.src.split('\n').forEach(line => {
  let m = /^function\s+([A-Za-z_$][\w$]*)/.exec(line);
  if (m) return NAMES.push(m[1]);
  m = /^(?:const|let|var)\s+(.*)$/.exec(line);
  if (m) for (const x of m[1].matchAll(/(?:^|,\s*)([A-Za-z_$][\w$]*)\s*=(?!=)/g)) NAMES.push(x[1]);
});
const names = [...new Set(NAMES)].filter(n => A.has(n));
const fns = names.filter(n => typeof A.get(n) === 'function');
// Données : identiques ; fonctions : présentes, même nombre de paramètres
names.forEach(n => {
  if (!C.ok(B.has(n), 'nom disparu', n)) return;
  const a = A.get(n), b = B.get(n);
  if (typeof a === 'function') C.ok(typeof b === 'function' && a.length === b.length, 'fonction : nombre de paramètres', n);
  else { const sa = ser(a), sb = ser(b); C.ok(sa === sb, 'donnée différente', () => n + ' ' + diff(sa, sb)); }
});

// Tirages d'entrées
const arr = x => Array.from(x);
const IDS = {
  food: Object.keys(A.get('FOOD')), unit: Object.keys(A.get('UNIT')), prot: arr(A.get('PROT_ORDER')), starch: arr(A.get('STARCH_ORDER')),
  pd: arr(A.get('PD_ORDER')), dessert: arr(A.get('DESSERT_ORDER')), recipe: Object.keys(A.get('RECIPES'))
};
const BAD = ['', 'x', '__proto__', 'constructor', 'toString', null, 3];
const STR = [].concat(IDS.prot, IDS.starch, IDS.pd, IDS.dessert, IDS.recipe.slice(0, 12), ['petite', 'moyenne', 'longue', 'matin', 'midi', 'soir', 'dej', 'diner', 'pd', 'prot', 'starch', 'dessert', 'auto', 'manuel', 'h', 'f', 'assis', 'mixte', 'debout', 'oui', 'non', '2026-10-07', 'prot:thon', 'du texte à l\'apostrophe : oui ? 10 %'], BAD);
const id = kind => R.chance(.05) ? R.pick(BAD) : R.pick(IDS[kind]);
const PR = A.get('PROFILE_RANGES');
function profileRaw(){
  const p = {};
  if (R.chance(.5)) p.mode = R.pick(['auto', 'manuel', 'x']);
  if (R.chance(.7)) p.sexe = R.pick(['h', 'f', 'x']);
  if (R.chance(.8)) p.age = R.int(PR.age[0] - 2, PR.age[1] + 2);
  if (R.chance(.8)) p.taille = R.int(PR.taille[0], PR.taille[1]);
  if (R.chance(.9)) p.poids = R.chance(.8) ? R.between(45, 110, 0.1) : R.between(PR.poids[0] - 5, PR.poids[1] + 5, 0.1);
  if (R.chance(.3)) p.gras = R.between(PR.gras[0], PR.gras[1], 0.5);
  if (R.chance(.3)) p.repos = R.int(PR.repos[0] - 100, PR.repos[1]);
  if (R.chance(.6)) p.neat = R.pick(['assis', 'mixte', 'debout', 'x']);
  if (R.chance(.7)) p.deficit = R.int(0, 26);
  if (R.chance(.5)) p.prot = R.chance(.85) ? R.between(1.6, 2.2, 0.1) : R.between(1, 3.2, 0.1);
  if (R.chance(.4)) p.ravito = R.between(30, 90, 5);
  if (R.chance(.4)) p.shaker = R.pick(['oui', 'non', 'x']);
  if (R.chance(.3)){ p.shakerKcal = R.int(90, 170); p.shakerProt = R.between(5, 45, 0.5); }
  if (R.chance(.2)) p.kcalPetite = R.between(100, 1000, 10);
  if (R.chance(.2)) p.kcalMoyenne = R.between(150, 1500, 10);
  if (R.chance(.2)) p.kcalLongueH = R.between(200, 1200, 10);
  if (R.chance(.5)) p.marge = R.between(0, 300, 25);
  if (R.chance(.2)) p.off = offRaw();
  if (R.chance(.2)) p.semaine = week();
  if (R.chance(.05)) p[R.pick(['age', 'poids', 'prot', 'marge', 'deficit'])] = R.pick(['abc', '', null, -1, 1e9, '72']);
  return p;
}
const seance = () => ({ taille: R.chance(.95) ? R.pick(['petite', 'moyenne', 'longue']) : R.pick(BAD), moment: R.chance(.95) ? R.pick(['matin', 'midi', 'soir']) : 'nuit', duree: R.pick([1.5, 2, 2.5, 3, 0, 9, '2']) });
const list = () => { const s = []; for (let i = R.int(0, 6); i > 0; i--) s.push(seance()); return s; };
const week = () => {
  if (R.chance(.05)) return R.pick([null, 'x', [], { jours: 'x' }]);
  const jours = {};
  for (let i = R.int(0, 7); i > 0; i--) jours[R.chance(.95) ? R.int(0, 6) : R.pick(['7', 'x'])] = list();
  return { jours, libre: R.chance(.9) ? R.int(0, 6) : R.pick([7, -1, 'x']) };
};
const planRaw = () => R.chance(.05) ? R.pick([null, 'x', {}, { seances: 'x' }]) : Object.assign({ seances: list() }, R.chance(.8) ? { libre: R.chance(.2) } : {});
const offRaw = () => { const o = []; for (let i = R.int(0, 8); i > 0; i--) o.push(R.chance(.9) ? R.pick(['pd', 'prot', 'starch', 'dessert']) + ':' + R.pick(STR) : R.pick(BAD)); return o; };
const choice = () => {
  const o = { prot: id('prot'), starch: id('starch') };
  if (R.chance(.7)) o.dessert = id('dessert');
  if (R.chance(.4)) o.recette = o.prot + '-' + o.starch;
  else if (R.chance(.1)) o.recette = id('recipe');
  return o;
};
const choices = () => R.chance(.03) ? R.pick([null, {}, 'x']) : { pdBase: id('pd'), dej: choice(), diner: choice() };
const call = (E, name, args) => E.call(name, mat(args), 1);
const viaRef = (name, args) => { const r = call(A, name, args); return r.err ? null : plain(r.v); };
const profile = () => viaRef('cleanProfile', [profileRaw()]);
const plan = () => viaRef('cleanPlan', [planRaw(), R.int(0, 6), R.chance(.3) ? week() : UNDEF]);
const off = () => viaRef('cleanOff', [offRaw()]);
const bal = () => ({ poisson: R.int(0, 4), gras: R.int(0, 2), legumes: R.int(0, 4), rouge: R.int(0, 900), charcuterie: R.int(0, 400) });

// Journées complètes calculées par la référence (entrées des courses, de la semaine, du batch cooking)
const DAYS = [];
for (let i = 0; i < 80; i++){ const r = call(A, 'buildDay', [plan(), choices(), profileRaw()]); if (!r.err) DAYS.push(plain(r.v)); }
const days = n => { const o = []; for (let i = n || R.int(1, 8); i > 0; i--) o.push(R.pick(DAYS)); return o; };
const anyItem = () => R.pick(R.pick(R.pick(DAYS).secs.filter(s => s.items.length)).items);

const GEN = {
  num: () => R.chance(.03) ? NaN : R.chance(.5) ? R.pick([0, 1, -1, 0.5, 2, 3, 10, 45, 72, 100, 150, 999, 1000, 1500]) : R.between(0, 2000),
  step: () => R.pick([1, 5, 10]), k: () => R.chance(.5) ? R.pick([0.65, 0.72, 1, 1.18, 1.4]) : R.between(0.5, 1.6),
  pf: () => R.chance(.5) ? R.pick([0.5, 0.508, 1, 1.2, 1.5]) : R.between(0.4, 1.6),
  kcal: () => R.between(-100, 2500), share: () => R.next(), n: () => R.pick([3, 4, 5, 4, 2, 6, 'x']), lead: () => R.pick([0, 1, 2, UNDEF]),
  caps: () => ({ dej: R.between(100, 1500), diner: R.between(100, 1500) }), offMeal: () => R.chance(.1) ? UNDEF : { dej: R.pick([0, 60, 80, 115]), diner: R.pick([0, 60, 80, 115]) },
  str: () => R.pick(STR), food: () => R.chance(.05) ? R.pick(BAD) : R.pick(IDS.food), unit: () => R.chance(.05) ? R.pick(BAD) : R.pick(IDS.unit),
  prot: () => id('prot'), starch: () => id('starch'), pd: () => id('pd'), recipe: () => id('recipe'),
  kind: () => R.pick(['pd', 'prot', 'starch', 'dessert', 'x']), slot: () => R.pick(['dej', 'diner', 'dej', 'diner', 'pd', 'x']),
  js: () => R.chance(.95) ? R.int(0, 6) : R.pick([7, -1, 'x']), duree: () => R.pick([1.5, 2, 2.5, 3, 0, 4, UNDEF]),
  bool: () => R.chance(.5), list, seance, week, planRaw, plan, v1: () => R.chance(.05) ? R.pick([null, 'x']) : { activity: R.pick(['repos', 'muscu', 'course', 'double', 'longue', 'x']), moment: R.pick(['matin', 'soir', 'x']), duree: R.pick([1.5, 2, 3]), natation: R.chance(.3), libre: R.chance(.2) },
  choices, choice, profileRaw, profile, offRaw, off, bal, rand: () => ({ __rand: R.int(1, 1e9) }),
  days: () => days(), daysLibre: () => { const o = []; for (let i = R.int(1, 31); i > 0; i--) o.push(R.chance(.97) ? { libre: R.chance(.15) } : null); return o; },
  daysRes: () => days().map(res => ({ res })), arr: () => { const o = []; for (let i = R.int(0, 6); i > 0; i--) o.push(R.pick(STR)); return o; },
  weights: () => { const o = []; for (let i = R.int(0, 6); i > 0; i--) o.push(R.pick([-1, 0, 0.3, 1, 3, 6])); return o; },
  item: anyItem, items: () => { const o = []; for (let i = R.int(0, 6); i > 0; i--) o.push(anyItem()); return o; },
  sec: () => R.pick(R.pick(DAYS).secs), secs: () => R.pick(DAYS).secs, obj: () => R.pick([{ a: 1 }, A.get('FOOD') && plain(A.get('FOOD')), {}, null]),
  m: () => ({ kcal: R.between(0, 500), p: R.between(0, 40), c: R.between(0, 80), f: R.between(0, 30) }),
  cook: () => R.chance(.5) ? UNDEF : { raw: 'cru', ways: [{ g: '≈ 100 g', adj: 'cuit' }] }, buy: () => R.chance(.3) ? UNDEF : { id: R.pick(IDS.food), g: R.int(1, 500) },
  seanceOrNull: () => R.chance(.3) ? null : R.chance(.5) ? seance() : R.pick(['matin', 'soir'])
};
// Paramètres de chaque fonction (nom de la fonction → genre de chaque paramètre) ; une fonction absente d'ici reçoit des
// entrées au hasard parmi tous les genres
const HINT = {
  has: ['obj', 'str'], grams: ['num'], mac: ['food', 'num'], unitMac: ['unit', 'num'], it: ['str', 'str', 'str', 'str', 'm', 'cook', 'buy'],
  scaleOf: ['profile'], sc: ['num', 'step', 'k'], pieces: ['num', 'k'], slices: ['num', 'num'], meat: ['num', 'str', 'str', 'food'],
  total: ['items'], fmtInt: ['num'], swapGrams: ['num', 'food'], typo: ['str'], recipesFor: ['prot', 'starch'], recipeOf: ['choice'], recipeItems: ['recipe'],
  cleanSeances: ['list'], cleanWeek: ['week'], emptyPlan: ['js', 'week'], cleanPlan: ['planRaw', 'js', 'week'], migratePlan: ['v1'],
  cleanOff: ['offRaw'], allowed: ['kind', 'off'], withAllowed: ['choices', 'off'], weekBalance: ['days'], weekNeeds: ['bal'],
  tieredPick: ['rand', 'arr', 'weights'], randomChoices: ['rand', 'off', 'bal', 'k'], batchChoices: ['daysLibre', 'n', 'off', 'k', 'rand'], batchCook: ['daysRes', 'lead'],
  profileFields: ['profileRaw'], cleanProfile: ['profileRaw'], bmr: ['profile'], restSource: ['profile'], restNeed: ['profile'], seanceCost: ['seance', 'profile'],
  dayCost: ['plan', 'profile'], energy: ['plan', 'profile'], dureeLabel: ['duree'], breakfast: ['bool', 'bool', 'pd', 'k', 'k'], snackItems: ['seanceOrNull', 'bool', 'k', 'bool'],
  shakerMac: ['profile'], shakerItem: ['profile'], gouterItems: ['k', 'k'], starchCap: ['starch', 'k'], protTarget: ['profile'], adj: ['item'], starchItem: ['starch', 'kcal'],
  splitStarch: ['kcal', 'share', 'k', 'offMeal', 'caps'], dessertOf: ['choice'], mainItems: ['slot', 'choice', 'k', 'k'], setStarch: ['sec', 'item'], allItems: ['secs'], fuel: ['duree', 'num'],
  composeDay: ['plan', 'choices', 'profile', 'pf'], buildDay: ['planRaw', 'choices', 'profileRaw'], shopQty: ['num'], shoppingList: ['days']
};
const KINDS = Object.keys(GEN);
function compare(name, args, rs){
  const a = A.call(name, mat(args), rs), b = B.call(name, mat(args), rs);
  const sa = a.err ? 'erreur ' + a.err : ser(a.v), sb = b.err ? 'erreur ' + b.err : ser(b.v);
  return C.ok(sa === sb, 'résultat différent : ' + name, () => ser(args).slice(0, 600) + '\n  ' + diff(sa, sb));
}
// Chaque fonction, sur des entrées surtout valides
const CALLS = Math.round(100 * factor);
let calls = 0;
fns.forEach(name => {
  const hint = HINT[name], n = A.get(name).length;
  for (let i = 0; i < CALLS; i++){
    const kinds = hint && R.chance(.85) ? hint : Array.from({ length: R.chance(.8) ? n : R.int(0, n + 1) }, () => R.pick(KINDS));
    const args = kinds.map(k => R.chance(.03) ? R.pick([UNDEF, null]) : GEN[k]());
    calls++;
    if (!compare(name, args, R.int(1, 1e9))) break;
  }
});
// Journées complètes, puis périodes de batch cooking (plats tirés, journées construites, fiche de cuisine)
const NDAYS = Math.round(1000 * factor);
for (let i = 0; i < NDAYS; i++){ calls++; compare('buildDay', [planRaw(), choices(), profileRaw()], 1); }
for (let i = 0; i < Math.round(40 * factor); i++){
  const libre = GEN.daysLibre(), args = [libre, R.pick([3, 4, 5]), off(), GEN.k(), GEN.rand()];
  calls++;
  if (!compare('batchChoices', args, 1)) continue;
  const chs = plain(call(A, 'batchChoices', args).v), prof = profileRaw();
  const res = chs.map((ch, j) => {
    const r = call(A, 'buildDay', [viaRef('cleanPlan', [{ seances: list(), libre: !!(libre[j] && libre[j].libre) }, j % 7]), ch, prof]);
    return r.err ? null : { res: plain(r.v) };
  });
  if (res.some(x => !x)){ C.ok(false, 'batch cooking : journée impossible à construire', () => ser([libre, chs])); continue; }
  calls++;
  compare('batchCook', [res, R.pick([0, 1, 2])], 1);
}

// --- 2. Interface ------------------------------------------------------------------------------------------------------
const PKEY = 'repas-du-jour:profil:v1', KEY = 'repas-du-jour:v2', RKEY = 'repas-du-jour:repas:v1', V1 = 'repas-du-jour:v1', CKEY = 'repas-du-jour:courses:v1';
const clock = { now: 0 };
// Les deux pages, même stockage au départ, même horloge, même suite de Math.random
function one(page, storage, rs){
  const errors = [];
  const dom = openPage({ html: page, clock, storage, errors, setup: win => { win.Math.random = rng(rs).next; } });
  return { dom, errors };
}
const pair = (storage, rs) => [one(refHtml, storage, rs), one(html, storage, rs)];
const css = page => (page.match(/<style>([\s\S]*?)<\/style>/) || [])[1];
C.ok(css(refHtml) === css(html), 'feuille de style différente', () => diff(css(refHtml), css(html)));
// Ce que montre une page : écran (sans script ni style), focus, champs, historique, stockage, erreurs
function shot(p){
  const w = p.dom.window, d = w.document;
  const part = el => [...el.childNodes].filter(n => !(n.nodeType === 1 && /^(SCRIPT|STYLE)$/.test(n.tagName)))
    .map(n => n.nodeType === 1 ? n.outerHTML : n.nodeType === 3 ? n.textContent : n.nodeType === 8 ? '<!--' + n.data + '-->' : '').join('');
  const act = d.activeElement;
  const ls = {};
  for (let i = 0; i < w.localStorage.length; i++){ const k = w.localStorage.key(i); ls[k] = w.localStorage.getItem(k); }
  return {
    écran: [...d.documentElement.attributes].map(a => a.name + '=' + a.value).join(' ') + '\n' + part(d.head) + '\n' + part(d.body),
    focus: act ? act.tagName + '#' + act.id + '[' + [...d.querySelectorAll(act.tagName)].indexOf(act) + ']' : '-',
    champs: [...d.querySelectorAll('input, select, textarea')].map(e => e.value + (e.checked ? '✓' : '')).join('|'),
    historique: w.history.length + ' ' + JSON.stringify(w.history.state),
    stockage: Object.keys(ls).sort().map(k => k + '=' + ls[k]).join('\n'),
    erreurs: p.errors.join('|'), titre: d.title
  };
}
// Éléments qu'un doigt peut toucher : visibles, hors panneau inerte, actifs, hors <details> fermé (sauf son résumé)
const touchable = d => [...new Set(d.querySelectorAll('button, [role="checkbox"], [role="switch"], [data-action], input, summary'))]
  .filter(e => !e.closest('[hidden], [inert]') && !e.disabled && !(e.tagName === 'A' && !e.dataset.action) && !(e.closest('details:not([open])') && e.tagName !== 'SUMMARY' && !e.closest('summary')));
const iso = t => { const x = new Date(t); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
function inputValue(e){
  const t = e.type, lo = Number(e.min || 0), hi = Number(e.max || 100);
  if (t === 'date') return R.chance(.1) ? R.pick(['', '2026-02-30', 'x']) : iso(clock.now + 864e5 * R.int(-40, 60));
  if (t === 'range'){ const st = Number(e.step) || 1; return String(lo + Math.round(R.int(0, Math.round((hi - lo) / st))) * st); }
  return R.chance(.4) ? R.pick(['', '0', '-5', 'abc', '2,5', '1e9', String(lo), String(hi)]) : String(R.chance(.5) ? Math.round(lo + R.next() * (hi - lo)) : Math.round((lo + R.next() * (hi - lo)) * 10) / 10);
}
// Une action au hasard, décidée sur la référence, appliquée de la même façon aux deux pages
function step(ps){
  const d0 = ps[0].dom.window.document, t = R.next();
  if (t < .72){
    const list = touchable(d0);
    if (!list.length) return 'rien à toucher';
    const i = R.int(0, list.length - 1), e0 = list[i];
    const label = (e0.tagName + ' ' + (e0.id ? '#' + e0.id + ' ' : '') + (e0.dataset.action || '') + ' ' + (e0.dataset.value || e0.dataset.key || '')).trim();
    const input = e0.tagName === 'INPUT' && e0.type !== 'checkbox' ? inputValue(e0) : null;
    const how = { focus: R.chance(.5), change: R.chance(.6), blur: R.chance(.3) };
    ps.forEach(p => {
      const w = p.dom.window, e = touchable(w.document)[i];
      if (!e) throw new Error('élément absent : ' + label);
      if (e.tagName === 'SUMMARY'){ const det = e.closest('details'); det.open = !det.open; det.dispatchEvent(new w.Event('toggle')); return; }
      if (input !== null){
        e.focus();
        e.value = input;
        e.dispatchEvent(new w.Event('input', { bubbles: true }));
        if (how.change) e.dispatchEvent(new w.Event('change', { bubbles: true }));
        if (how.blur) e.blur();
        return;
      }
      if (how.focus) e.focus();
      e.click();
    });
    return label + (input !== null ? ' = ' + input : '');
  }
  if (t < .82){ ps.forEach(p => p.dom.window.dispatchEvent(new p.dom.window.PopStateEvent('popstate', { state: null }))); return 'retour du téléphone'; }
  if (t < .86){ ps.forEach(p => p.dom.window.document.dispatchEvent(new p.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); return 'Échap'; }
  if (t < .90){
    const n = R.pick([1, 1, 2, 7]);
    clock.now += 864e5 * n;
    const ev = R.pick(['focus', 'visibilitychange', 'pageshow']);
    ps.forEach(p => { const w = p.dom.window; (ev === 'visibilitychange' ? w.document : w).dispatchEvent(new w.Event(ev)); });
    return '+' + n + ' j, ' + ev;
  }
  if (t < .92){
    // Android : l'appli peut être installée (bouton dans les réglages), puis l'est
    const done = R.chance(.3);
    ps.forEach(p => {
      const w = p.dom.window, ev = new w.Event('beforeinstallprompt', { cancelable: true });
      ev.prompt = () => Promise.resolve(); ev.userChoice = Promise.resolve({ outcome: 'accepted' });
      w.dispatchEvent(ev);
      if (done) w.dispatchEvent(new w.Event('appinstalled'));
    });
    return done ? 'appli installée' : 'installation proposée';
  }
  return 'rechargement';
}
const RUNS = 8, STEPS = Math.round(25 * factor);
let actions = 0;
const today = new Date(2026, 9, 7, 9).getTime();
const STARTS = [
  () => ({}),                                                    // premier lancement : accueil
  () => ({ [PKEY]: JSON.stringify({ age: 35, taille: 178, poids: 71 }), [RKEY]: iso(today) }),
  () => ({ [PKEY]: JSON.stringify({ sexe: 'f', age: 26, taille: 160, poids: 50, shaker: 'non', marge: 0, off: ['prot:thon', 'starch:riz'] }) }),
  () => ({ [PKEY]: JSON.stringify({ poids: 110, prot: 2.4, semaine: { jours: { 1: [{ taille: 'petite', moment: 'soir' }], 3: [{ taille: 'longue', moment: 'matin', duree: 2 }] }, libre: 5 } }), [RKEY]: iso(today) }),
  // Données d'avant la 2.0.0 (converties au chargement) et stockage abîmé
  () => ({ [PKEY]: '{}', [V1]: JSON.stringify({ '2026-10-07': { activity: 'double', moment: 'matin', natation: true, libre: false }, '2026-10-10': { activity: 'longue', duree: 2.5 } }) }),
  () => ({ [PKEY]: '{"poids":"abc"', [KEY]: '[1,2', [CKEY]: 'null', [RKEY]: '2026-10-07' }),
  () => ({ [PKEY]: JSON.stringify({ age: 40, taille: 170, poids: 80, mode: 'manuel', repos: 2600 }), [RKEY]: iso(today), [KEY]: JSON.stringify({ plans: { '2026-10-07': { seances: [{ taille: 'moyenne', moment: 'midi' }], ch: { pdBase: 'sale', dej: { prot: 'oeufs', starch: 'pdt', dessert: 'chocolat', recette: 'oeufs-pdt' }, diner: { prot: 'saumon', starch: 'riz', recette: 'saumon-riz' } } }, '2026-09-01': { seances: [] } }, choices: { 3: { pdBase: 'pain', dej: { prot: 'thon', starch: 'riz' }, diner: { prot: 'thon', starch: 'pates' } } } }), [CKEY]: JSON.stringify({ from: '2026-10-07', to: '2026-10-13', checked: ['riz|1 kg'] }) }),
  () => ({ [PKEY]: JSON.stringify({ age: 30, taille: 175, poids: 68, prot: 1.6 }) })
];
for (let run = 0; run < RUNS; run++){
  clock.now = today;
  const rs = R.int(1, 1e9);
  let ps = pair(STARTS[run % STARTS.length](), rs);
  const log = ['ouverture ' + run];
  const same = () => {
    const a = shot(ps[0]), b = shot(ps[1]);
    return Object.keys(a).every(k => C.ok(a[k] === b[k], 'interface : ' + k + ' différent', () => log.slice(-8).join(' › ') + '\n  ' + diff(a[k], b[k])));
  };
  if (!same()) continue;
  for (let s = 0; s < STEPS; s++){
    let label;
    try { label = step(ps); } catch (e){ C.ok(false, 'interface : action impossible', () => e.message + ' après ' + log.slice(-6).join(' › ')); break; }
    if (label === 'rechargement'){
      const store = p => { const w = p.dom.window, o = {}; for (let i = 0; i < w.localStorage.length; i++){ const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
      const st = ps.map(store), rs2 = R.int(1, 1e9);
      ps = [one(refHtml, st[0], rs2), one(html, st[1], rs2)];
    }
    log.push(label);
    actions++;
    if (!same()) break;
  }
}

C.done(names.length + ' noms, ' + calls + ' appels du moteur, ' + actions + ' actions sur l’interface, graine ' + seed);
