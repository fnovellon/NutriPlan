// Vérifie le moteur de calcul de index.html sans navigateur.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
assert(m, 'script introuvable dans index.html');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[1] + '\n;globalThis.__api = {APP_VERSION, buildDay, energy, bmr, restNeed, sessionCost, cleanProfile, profileFields, DEFAULT_PLAN, DEFAULT_CHOICES, PROT_ORDER, STARCH_ORDER, STARCH_MIN, STARCH_MAX};', ctx);
const { APP_VERSION, buildDay, energy, bmr, restNeed, sessionCost, cleanProfile, profileFields, DEFAULT_PLAN, DEFAULT_CHOICES, PROT_ORDER, STARCH_ORDER, STARCH_MIN, STARCH_MAX } = ctx.__api;

const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg} : ${a} au lieu de ${b}`);
const day = (activity, extra) => Object.assign({ activity, moment: 'soir', duree: 2, natation: false, libre: false }, extra);
const starchKcal = r => ['dej', 'diner'].map(id => r.secs.find(s => s.id === id).items.find(i => i.key === 'st').m.kcal);

// 1. Formules de dépense (valeurs calculées à la main)
const P = cleanProfile({});
near(bmr(P), 1662.5, 0.01, 'Mifflin-St Jeor homme 72 kg, 178 cm, 35 ans');
near(bmr(cleanProfile({ sexe: 'f', poids: 60, taille: 165, age: 30 })), 1320.25, 0.01, 'Mifflin-St Jeor femme');
near(bmr(cleanProfile({ gras: 15 })), 1846.4, 0.01, 'Cunningham 72 kg à 15 % de masse grasse');
near(restNeed(P), 2327.5, 0.01, 'dépense de repos, activité assise');
near(restNeed(cleanProfile({ neat: 'debout' })), 1662.5 * 1.7, 0.01, 'dépense de repos, debout');
// Modes : automatique (calcul à partir du profil) ou manuel (dépense saisie d'un jour sans sport). Profil de la capture : 30 ans, 168 cm, 71 kg.
const me = { age: 30, taille: 168, poids: 71 };
near(bmr(cleanProfile(me)), 1615, 0.01, 'Mifflin-St Jeor 71 kg, 168 cm, 30 ans');
assert.strictEqual(cleanProfile(me).mode, 'auto', 'mode par défaut');
assert.strictEqual(energy(day('repos'), cleanProfile(me)).restSource, 'calcul', 'dépense calculée en automatique');
const manual = x => energy(day('repos'), cleanProfile(Object.assign({ mode: 'manuel' }, me, x)));
assert(manual({ repos: 2400 }).restSource === 'saisie' && manual({ repos: 2400 }).rest === 2400, 'dépense saisie en manuel');
assert.strictEqual(manual({}).restSource, 'calcul', 'manuel sans dépense : le calcul prend le relais');
near(manual({}).rest, 1615 * 1.4, 0.01, 'manuel sans dépense');
for (const bad of [1000, 1190, 6010]) assert.strictEqual(manual({ repos: bad }).restSource, 'calcul', `dépense hors bornes acceptée : ${bad}`);
assert.strictEqual(manual({ repos: 1200 }).rest, 1200, 'borne basse de la dépense saisie');
assert.strictEqual(energy(day('repos'), cleanProfile(Object.assign({ mode: 'auto', repos: 2400 }, me))).restSource, 'calcul', 'la dépense saisie est ignorée en automatique');
near(energy(day('course'), cleanProfile({ mode: 'manuel', repos: 2400, poids: 71 })).need, 2400 + 8.8 * 71, 0.01, 'en manuel, la séance est calculée avec le poids');
// Profils enregistrés avant la 1.3.0 (sans mode)
assert.strictEqual(cleanProfile({ repos: 2500 }).mode, 'manuel', 'ancien profil avec dépense valide');
near(restNeed(cleanProfile({ repos: 2500 })), 2500, 0, 'ancien profil : dépense saisie conservée');
assert.strictEqual(cleanProfile({ repos: 1000 }).mode, 'auto', 'ancien profil avec dépense invalide');
assert.strictEqual(cleanProfile({}).mode, 'auto', 'profil vide');
assert.strictEqual(cleanProfile({ mode: 'constructor', repos: 2500 }).mode, 'manuel', 'mode invalide ignoré');
near(sessionCost(day('muscu'), P), 288, 0.01, 'muscu');
near(sessionCost(day('course'), P), 633.6, 0.01, 'course');
near(sessionCost(day('double'), P), 921.6, 0.01, 'muscu + course');
near(sessionCost(day('longue', { duree: 3 }), P), 1512, 0.01, 'vélo 3 h');
near(sessionCost(day('repos', { natation: true }), P), 324, 0.01, 'natation');
near(sessionCost(day('longue', { natation: true }), P), 1008, 0.01, 'pas de natation un jour de sortie longue');
const e = energy(day('repos'), P);
near(e.avg, (7 * 2327.5 + 2 * 288 + 3 * 633.6 + 1008) / 7, 0.01, 'dépense moyenne de la semaine type');
near(e.deficit, e.avg * 0.15, 0.01, 'déficit de 15 %');
assert.strictEqual(e.target, 1900, 'objectif du jour de repos');
near(e.kgWeek, e.deficit * 7 / 7700, 1e-9, 'perte par semaine');
for (const a of ['muscu', 'course', 'double', 'longue']) {
  const x = energy(day(a), P);
  near(x.need - x.deficit, x.target, 5, `${a} : le déficit est le même chaque jour`);
}
assert.strictEqual(energy(day('course'), cleanProfile({ deficit: 0 })).target, Math.round((2327.5 + 633.6) / 10) * 10, 'déficit nul');

// 2. Profil : valeurs hors limites ou piégées ignorées
assert.deepStrictEqual(JSON.parse(JSON.stringify(profileFields({ mode: 'x', age: '35', sexe: 'x', neat: 'constructor', deficit: 40, ravito: 10, gras: null, poids: 70 }))), { poids: 70 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(profileFields('nimporte'))), {});

// 3. Toutes les combinaisons avec le profil par défaut : apport ≈ objectif, planchers respectés
let n = 0;
for (const activity of ['repos', 'muscu', 'course', 'double', 'longue']) {
  for (const moment of ['matin', 'soir']) for (const natation of [false, true]) for (const pdBase of ['avoine', 'pain']) {
    for (const p1 of PROT_ORDER) for (const s1 of STARCH_ORDER) for (const p2 of PROT_ORDER) for (const s2 of STARCH_ORDER) {
      const combo = `${activity}/${moment}/${natation ? 'natation' : '-'}/${pdBase}/${p1}+${s1}/${p2}+${s2}`;
      const r = buildDay({ activity, moment, duree: 2, natation, libre: false }, { pdBase, dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } });
      assert(Math.abs(r.ecart) <= r.energy.target * 0.03, `${combo} : ${Math.round(r.tot.kcal)} kcal pour un objectif de ${r.energy.target}`);
      assert(r.tot.p >= 140, `${combo} : ${Math.round(r.tot.p)} g de protéines`);
      assert(r.tot.f >= 55 && r.tot.f <= 95, `${combo} : ${r.tot.f.toFixed(1)} g de lipides`);
      for (const k of starchKcal(r)) assert(k >= STARCH_MIN - 20 && k <= STARCH_MAX + 20, `${combo} : ${Math.round(k)} kcal de féculent dans un repas`);
      n++;
    }
  }
}

// 4. Changer de féculent ne change pas le total de la journée (dosage en calories)
for (const activity of ['repos', 'muscu', 'course', 'double', 'longue']) {
  const totals = STARCH_ORDER.map(s => buildDay(day(activity), { pdBase: 'avoine', dej: { prot: 'poulet', starch: s }, diner: { prot: 'poisson', starch: s } }).tot.kcal);
  assert(Math.max(...totals) - Math.min(...totals) <= 40, `${activity} : le total varie de ${Math.round(Math.max(...totals) - Math.min(...totals))} kcal selon le féculent`);
}

// 5. Déficits extrêmes : planchers toujours tenus, jamais nettement sous l'objectif
for (const deficit of [0, 25]) for (const activity of ['repos', 'muscu', 'course', 'double', 'longue']) {
  for (const p1 of PROT_ORDER) for (const s1 of STARCH_ORDER) for (const p2 of PROT_ORDER) for (const s2 of STARCH_ORDER) {
    const combo = `${deficit} %/${activity}/${p1}+${s1}/${p2}+${s2}`;
    const r = buildDay(day(activity, { duree: 3 }), { pdBase: 'avoine', dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } }, { deficit });
    assert(r.tot.p >= 140 && r.tot.f >= 55, `${combo} : P ${Math.round(r.tot.p)} g, L ${r.tot.f.toFixed(1)} g`);
    assert(r.ecart >= -r.energy.target * 0.03, `${combo} : ${Math.round(-r.ecart)} kcal sous l'objectif`);
    if (r.ecart > r.energy.target * 0.03) {
      for (const k of starchKcal(r)) assert(k <= STARCH_MIN + 20, `${combo} : au-dessus de l'objectif sans être au plancher`);
    }
  }
}

// 6. Très grosse journée : féculents au plafond, pain complet en plus au goûter
const big = buildDay(day('longue', { duree: 3 }), DEFAULT_CHOICES[6], { deficit: 0 });
assert(big.secs.find(s => s.id === 'co').items.some(i => i.key === 'xtra'), 'pas de complément au-delà du plafond');
assert(Math.abs(big.ecart) <= big.energy.target * 0.03, 'grosse journée loin de l’objectif');

// 7. Repas libre : budget arrondi à 50, compté dans le total, pas de skyr du soir, macros hors repas libre
for (const activity of ['repos', 'muscu', 'course', 'double', 'longue']) {
  const normal = buildDay(day(activity), DEFAULT_CHOICES[6]);
  const r = buildDay(day(activity, { libre: true }), DEFAULT_CHOICES[6]);
  const dinner = normal.secs.find(s => s.id === 'diner');
  assert(r.libre > 0 && r.libre % 50 === 0, `${activity} : budget libre ${r.libre}`);
  near(r.libre, dinner.items.reduce((a, i) => a + i.m.kcal, 0) + 300, 25, `${activity} : budget libre`);
  assert(r.secs.some(s => s.title === 'Repas libre') && !r.secs.some(s => s.id === 'soir'), `${activity} : sections du repas libre`);
  assert(r.tot.kcal > normal.tot.kcal, `${activity} : repas libre non compté`);
}

// 8. Ravito : suit la durée et le réglage
const fuelOf = (d, ravito) => buildDay(day('longue', { duree: d }), DEFAULT_CHOICES[6], ravito ? { ravito } : {}).secs.find(s => s.band).items[0].m.c;
assert(fuelOf(1.5) < fuelOf(2) && fuelOf(2) < fuelOf(2.5) && fuelOf(2.5) < fuelOf(3), 'ravito non proportionnel à la durée');
assert.strictEqual(fuelOf(3), 180, 'ravito de 60 g/h par défaut');
assert.strictEqual(fuelOf(3, 45), 135, 'ravito réglé à 45 g/h');

// 9. Version : la même partout, notée en tête des nouveautés
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
assert(/^\d+\.\d+\.\d+$/.test(APP_VERSION), 'version mal formée : ' + APP_VERSION);
assert.strictEqual(pkg.version, APP_VERSION, 'version de package.json');
assert.strictEqual(lock.version, APP_VERSION, 'version de package-lock.json');
assert.strictEqual((changelog.match(/^## (\d+\.\d+\.\d+)/m) || [])[1], APP_VERSION, 'dernière version de CHANGELOG.md');

console.log(`moteur OK (${n} combinaisons vérifiées)`);
