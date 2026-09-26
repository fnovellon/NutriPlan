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
vm.runInContext(m[1] + '\n;globalThis.__api = {APP_VERSION, buildDay, energy, bmr, restNeed, seanceCost, dayCost, cleanProfile, profileFields, cleanPlan, migratePlan, emptyPlan, DEFAULT_CHOICES, PROT_ORDER, STARCH_ORDER, STARCH_MIN, STARCH_MAX};', ctx);
const { APP_VERSION, buildDay, energy, bmr, restNeed, seanceCost, dayCost, cleanProfile, profileFields, cleanPlan, migratePlan, emptyPlan, DEFAULT_CHOICES, PROT_ORDER, STARCH_ORDER, STARCH_MIN, STARCH_MAX } = ctx.__api;

const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg} : ${a} au lieu de ${b}`);
const plain = x => JSON.parse(JSON.stringify(x));
const petite = moment => ({ taille: 'petite', moment });
const moyenne = moment => ({ taille: 'moyenne', moment });
const longue = duree => ({ taille: 'longue', moment: 'matin', duree });
const day = (seances, extra) => Object.assign({ seances, libre: false }, extra);
const SETS = {
  'repos': [],
  'petite le soir': [petite('soir')],
  'petite le matin': [petite('matin')],
  'petite à midi': [petite('midi')],
  'moyenne le soir': [moyenne('soir')],
  'moyenne le matin': [moyenne('matin')],
  'petite + moyenne le soir': [petite('soir'), moyenne('soir')],
  'petite le matin + moyenne le soir': [petite('matin'), moyenne('soir')],
  'deux moyennes': [moyenne('matin'), moyenne('soir')],
  'longue 2 h': [longue(2)],
  'longue 3 h + petite le soir': [longue(3), petite('soir')],
  'quatre séances': [petite('matin'), petite('midi'), moyenne('soir'), petite('soir')]
};
const starchKcal = r => ['dej', 'diner'].map(id => r.secs.find(s => s.id === id).items.find(i => i.key === 'st').m.kcal);
const ids = r => r.secs.map(s => s.id).join(' ');

// 1. Formules de dépense (valeurs calculées à la main)
const P = cleanProfile({});
near(bmr(P), 1662.5, 0.01, 'Mifflin-St Jeor homme 72 kg, 178 cm, 35 ans');
near(bmr(cleanProfile({ sexe: 'f', poids: 60, taille: 165, age: 30 })), 1320.25, 0.01, 'Mifflin-St Jeor femme');
near(bmr(cleanProfile({ gras: 15 })), 1846.4, 0.01, 'Cunningham 72 kg à 15 % de masse grasse');
near(restNeed(P), 2327.5, 0.01, 'dépense de repos, activité assise');
near(restNeed(cleanProfile({ neat: 'debout' })), 1662.5 * 1.7, 0.01, 'dépense de repos, debout');
// Modes : automatique ou manuel (dépense saisie d'un jour sans sport). Profil de l'utilisateur : 30 ans, 168 cm, 71 kg.
const me = { age: 30, taille: 168, poids: 71 };
near(bmr(cleanProfile(me)), 1615, 0.01, 'Mifflin-St Jeor 71 kg, 168 cm, 30 ans');
assert.strictEqual(cleanProfile(me).mode, 'auto', 'mode par défaut');
assert.strictEqual(energy(day([]), cleanProfile(me)).restSource, 'calcul', 'dépense calculée en automatique');
const manual = x => energy(day([]), cleanProfile(Object.assign({ mode: 'manuel' }, me, x)));
assert(manual({ repos: 2400 }).restSource === 'saisie' && manual({ repos: 2400 }).rest === 2400, 'dépense saisie en manuel');
assert.strictEqual(manual({}).restSource, 'calcul', 'manuel sans dépense : le calcul prend le relais');
near(manual({}).rest, 1615 * 1.4, 0.01, 'manuel sans dépense');
for (const bad of [1000, 1190, 6010]) assert.strictEqual(manual({ repos: bad }).restSource, 'calcul', `dépense hors bornes acceptée : ${bad}`);
assert.strictEqual(manual({ repos: 1200 }).rest, 1200, 'borne basse de la dépense saisie');
assert.strictEqual(energy(day([]), cleanProfile(Object.assign({ mode: 'auto', repos: 2400 }, me))).restSource, 'calcul', 'la dépense saisie est ignorée en automatique');
near(energy(day([moyenne('soir')]), cleanProfile({ mode: 'manuel', repos: 2400, poids: 71 })).need, 2400 + 6.3 * 71, 0.01, 'en manuel, la séance est calculée avec le poids');
// Profils enregistrés avant la 1.3.0 (sans mode)
assert.strictEqual(cleanProfile({ repos: 2500 }).mode, 'manuel', 'ancien profil avec dépense valide');
near(restNeed(cleanProfile({ repos: 2500 })), 2500, 0, 'ancien profil : dépense saisie conservée');
assert.strictEqual(cleanProfile({ repos: 1000 }).mode, 'auto', 'ancien profil avec dépense invalide');
assert.strictEqual(cleanProfile({}).mode, 'auto', 'profil vide');
assert.strictEqual(cleanProfile({ mode: 'constructor', repos: 2500 }).mode, 'manuel', 'mode invalide ignoré');

// 2. Coût des séances par taille (72 kg) et réglages du profil
near(seanceCost(petite('soir'), P), 4 * 72, 1e-9, 'petite');
near(seanceCost(moyenne('soir'), P), 6.3 * 72, 1e-9, 'moyenne');
near(seanceCost(longue(2), P), 7 * 72 * 2, 1e-9, 'longue 2 h');
near(seanceCost(longue(3), P), 1512, 1e-9, 'longue 3 h');
const tuned = cleanProfile({ kcalPetite: 300, kcalMoyenne: 520, kcalLongueH: 600 });
assert(seanceCost(petite('matin'), tuned) === 300 && seanceCost(moyenne('matin'), tuned) === 520 && seanceCost(longue(2.5), tuned) === 1500, 'calories réglées');
near(dayCost(day(SETS['petite + moyenne le soir']), P), 288 + 453.6, 1e-9, 'plusieurs séances');
assert.strictEqual(cleanProfile({ kcalPetite: 50 }).kcalPetite, null, 'calories de séance hors bornes ignorées');

// 3. Déficit : % de la dépense d'un jour sans sport, le même chaque jour
const e = energy(day([]), P);
near(e.deficit, 2327.5 * 0.15, 1e-9, 'déficit de 15 %');
assert.strictEqual(e.target, 1980, 'objectif d’un jour sans séance');
near(e.kgWeek, e.deficit * 7 / 7700, 1e-9, 'perte par semaine');
for (const [name, set] of Object.entries(SETS)) {
  const x = energy(day(set), P);
  near(x.deficit, e.deficit, 1e-9, `${name} : même déficit`);
  near(x.need - x.deficit, x.target, 5, `${name} : objectif`);
}
assert.strictEqual(energy(day([moyenne('soir')]), cleanProfile({ deficit: 0 })).target, Math.round((2327.5 + 453.6) / 10) * 10, 'déficit nul');

// 4. Profil : valeurs hors limites ou piégées ignorées
assert.deepStrictEqual(plain(profileFields({ mode: 'x', age: '35', sexe: 'x', neat: 'constructor', deficit: 40, ravito: 10, gras: null, poids: 70 })), { poids: 70 });
assert.deepStrictEqual(plain(profileFields('nimporte')), {});

// 5. Plan d'un jour et conversion des plans d'avant la 2.0.0
assert.deepStrictEqual(plain(emptyPlan(3)), { seances: [], libre: false }, 'jour sans séance');
assert.strictEqual(emptyPlan(6).libre, true, 'repas libre du samedi par défaut');
assert.deepStrictEqual(plain(cleanPlan({ seances: [petite('aube'), { taille: 'constructor' }, 'x', longue(7), longue(2), moyenne('midi'), petite('soir'), petite('matin'), petite('soir')], libre: 1 }, 3)),
  { seances: [petite('soir'), longue(2), moyenne('midi'), petite('soir')], libre: true }, 'séances nettoyées : moment par défaut, une seule longue, 4 au plus');
assert.deepStrictEqual(plain(cleanPlan({ seances: [{ taille: 'longue', moment: 'soir', duree: 3 }] }, 6)), { seances: [longue(3)], libre: true }, 'longue toujours le matin');
assert.deepStrictEqual(plain(cleanPlan('abc', 2)), { seances: [], libre: false }, 'plan corrompu');
const old = (activity, extra) => plain(migratePlan(Object.assign({ activity, moment: 'soir', duree: 2, natation: false, libre: false }, extra)));
assert.deepStrictEqual(old('repos'), { seances: [], libre: false }, 'repos');
assert.deepStrictEqual(old('muscu'), { seances: [petite('soir')], libre: false }, 'muscu');
assert.deepStrictEqual(old('course', { moment: 'matin' }), { seances: [moyenne('matin')], libre: false }, 'course le matin');
assert.deepStrictEqual(old('double'), { seances: [petite('soir'), moyenne('soir')], libre: false }, 'muscu + course');
assert.deepStrictEqual(old('longue', { duree: 2.5, libre: true }), { seances: [longue(2.5)], libre: true }, 'sortie longue');
assert.deepStrictEqual(old('repos', { natation: true }), { seances: [petite('midi')], libre: false }, 'natation');
assert.deepStrictEqual(old('longue', { natation: true }).seances.length, 1, 'pas de natation un jour de sortie longue');

// 6. Toutes les combinaisons avec le profil par défaut : apport ≈ objectif, planchers respectés
let n = 0;
for (const [name, set] of Object.entries(SETS)) for (const pdBase of ['avoine', 'pain']) {
  for (const p1 of PROT_ORDER) for (const s1 of STARCH_ORDER) for (const p2 of PROT_ORDER) for (const s2 of STARCH_ORDER) {
    const combo = `${name}/${pdBase}/${p1}+${s1}/${p2}+${s2}`;
    const r = buildDay(day(set), { pdBase, dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } });
    assert(Math.abs(r.ecart) <= r.energy.target * 0.03, `${combo} : ${Math.round(r.tot.kcal)} kcal pour un objectif de ${r.energy.target}`);
    assert(r.tot.p >= 140, `${combo} : ${Math.round(r.tot.p)} g de protéines`);
    assert(r.tot.f >= 55 && r.tot.f <= 95, `${combo} : ${r.tot.f.toFixed(1)} g de lipides`);
    for (const k of starchKcal(r)) assert(k >= STARCH_MIN - 20 && k <= STARCH_MAX + 20, `${combo} : ${Math.round(k)} kcal de féculent dans un repas`);
    n++;
  }
}

// 7. Changer de féculent ne change pas le total de la journée (dosage en calories)
for (const [name, set] of Object.entries(SETS)) {
  const totals = STARCH_ORDER.map(s => buildDay(day(set), { pdBase: 'avoine', dej: { prot: 'poulet', starch: s }, diner: { prot: 'poisson', starch: s } }).tot.kcal);
  assert(Math.max(...totals) - Math.min(...totals) <= 40, `${name} : le total varie de ${Math.round(Math.max(...totals) - Math.min(...totals))} kcal selon le féculent`);
}

// 8. Déficits extrêmes : planchers toujours tenus, jamais nettement sous l'objectif
for (const deficit of [0, 25]) for (const [name, set] of Object.entries(SETS)) {
  for (const p1 of PROT_ORDER) for (const s1 of STARCH_ORDER) for (const p2 of PROT_ORDER) for (const s2 of STARCH_ORDER) {
    const combo = `${deficit} %/${name}/${p1}+${s1}/${p2}+${s2}`;
    const r = buildDay(day(set), { pdBase: 'avoine', dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } }, { deficit });
    assert(r.tot.p >= 140 && r.tot.f >= 55, `${combo} : P ${Math.round(r.tot.p)} g, L ${r.tot.f.toFixed(1)} g`);
    assert(r.ecart >= -r.energy.target * 0.03, `${combo} : ${Math.round(-r.ecart)} kcal sous l'objectif`);
    if (r.ecart > r.energy.target * 0.03) {
      for (const k of starchKcal(r)) assert(k <= STARCH_MIN + 20, `${combo} : au-dessus de l'objectif sans être au plancher`);
    }
  }
}

// 9. Très grosse journée : féculents au plafond, pain complet en plus au goûter
const big = buildDay(day(SETS['longue 3 h + petite le soir']), DEFAULT_CHOICES[6], { deficit: 0 });
assert(big.secs.find(s => s.id === 'co').items.some(i => i.key === 'xtra'), 'pas de complément au-delà du plafond');
assert(Math.abs(big.ecart) <= big.energy.target * 0.03, 'grosse journée loin de l’objectif');

// 10. Construction de la journée selon les séances
const r0 = set => buildDay(day(set), DEFAULT_CHOICES[3]);
assert.strictEqual(ids(r0([])), 'pd dej co diner', 'repos');
assert.strictEqual(ids(r0([petite('soir')])), 'pd dej co band0 shk diner', 'petite le soir');
assert.strictEqual(ids(r0([moyenne('matin')])), 'pd band0 co dej diner', 'moyenne le matin');
assert.strictEqual(ids(r0([petite('midi')])), 'pd sw band0 shk dej co diner', 'petite à midi');
assert.strictEqual(ids(r0([longue(2)])), 'pd band0 shk dej co diner', 'longue');
assert.strictEqual(ids(r0(SETS['petite le matin + moyenne le soir'])), 'pd band0 dej co band1 shk diner', 'matin + soir');
assert.strictEqual(ids(r0([moyenne('soir'), petite('matin')])), ids(r0(SETS['petite le matin + moyenne le soir'])), 'séances rangées par moment');
const secOf = (r, id) => r.secs.find(s => s.id === id);
const keys = s => s.items.map(i => i.key).join(' ');
assert.strictEqual(secOf(r0([]), 'co').when, 'dans l’après-midi', 'collation d’un jour sans séance');
assert.strictEqual(secOf(r0([petite('soir')]), 'co').when, '1h30 avant la séance', 'collation avant la séance du soir');
assert.strictEqual(secOf(r0([moyenne('matin')]), 'co').when, 'juste après la séance', 'collation après la séance du matin');
assert.strictEqual(secOf(r0([longue(2)]), 'co').title, 'Goûter', 'goûter de sortie longue');
assert(/^oe shk/.test(keys(secOf(r0([]), 'co'))), 'repos : œufs et shaker, sans banane');
assert.strictEqual(keys(secOf(r0([petite('soir')]), 'co')), 'oe ban', 'petite : banane');
assert.strictEqual(keys(secOf(r0([moyenne('soir')]), 'co')), 'oe ban comp', 'moyenne : banane et compote');
assert(/^oe ban comp shk/.test(keys(secOf(r0([moyenne('matin')]), 'co'))), 'shaker dans la collation après la séance du matin');
const fruit = set => secOf(r0(set), 'pd').items.find(i => i.key === 'fruit').name;
assert(fruit([]) === 'fruits rouges' && fruit([petite('soir')]) === 'fruits rouges' && fruit([moyenne('soir')]) === 'banane', 'fruit du petit-déjeuner');
assert(secOf(r0([petite('midi')]), 'dej').items.some(i => i.key === 'comp') && secOf(r0([petite('midi')]), 'dej').when === 'après la séance', 'séance à midi : compote au déjeuner');
assert.strictEqual(secOf(r0([moyenne('soir')]), 'diner').when, 'après la séance', 'dîner après la séance');
assert.strictEqual(secOf(r0([longue(2)]), 'pd').when, '1h30 à 2 h avant la sortie', 'petit-déjeuner avant la sortie');
// Un seul shaker par jour, juste après la dernière séance
for (const [name, set] of Object.entries(SETS)) for (const libre of [false, true]) {
  const r = buildDay(day(set, { libre }), DEFAULT_CHOICES[3]);
  assert.strictEqual(r.secs.flatMap(s => s.items).filter(i => i.key === 'shk').length, 1, `${name} : un shaker par jour`);
  const i = r.secs.findIndex(s => s.id === 'shk');
  if (i >= 0) assert(r.secs[i - 1].band, `${name} : le shaker ne suit pas la séance`);
}
// Féculents : la plus grosse part au repas qui suit les séances
const [dj, dn] = starchKcal(r0([moyenne('soir')]));
assert(dn > dj, 'séance le soir : plus de féculents au dîner');
const [dj2, dn2] = starchKcal(r0([longue(2)]));
assert(dj2 > dn2, 'sortie longue : plus de féculents au déjeuner');

// 11. Repas libre : budget arrondi à 50, compté dans le total, pas de skyr du soir, macros hors repas libre
for (const [name, set] of Object.entries(SETS)) {
  const normal = buildDay(day(set), DEFAULT_CHOICES[6]);
  const r = buildDay(day(set, { libre: true }), DEFAULT_CHOICES[6]);
  const dinner = normal.secs.find(s => s.id === 'diner');
  assert(r.libre > 0 && r.libre % 50 === 0, `${name} : budget libre ${r.libre}`);
  near(r.libre, dinner.items.reduce((a, i) => a + i.m.kcal, 0) + 300, 25, `${name} : budget libre`);
  assert(r.secs.some(s => s.title === 'Repas libre') && !r.secs.some(s => s.id === 'soir'), `${name} : sections du repas libre`);
  assert(r.tot.kcal > normal.tot.kcal, `${name} : repas libre non compté`);
}

// 12. Ravito : suit la durée et le réglage
const fuelOf = (d, ravito) => buildDay(day([longue(d)]), DEFAULT_CHOICES[6], ravito ? { ravito } : {}).secs.find(s => s.band).items[0].m.c;
assert(fuelOf(1.5) < fuelOf(2) && fuelOf(2) < fuelOf(2.5) && fuelOf(2.5) < fuelOf(3), 'ravito non proportionnel à la durée');
assert.strictEqual(fuelOf(3), 180, 'ravito de 60 g/h par défaut');
assert.strictEqual(fuelOf(3, 45), 135, 'ravito réglé à 45 g/h');

// 13. Poids cuit et macros de chaque aliment
const wed = buildDay(emptyPlan(3), DEFAULT_CHOICES[3]);
const itemOf = (r, sec, key) => r.secs.find(s => s.id === sec).items.find(i => i.key === key);
assert.deepStrictEqual(plain(itemOf(wed, 'dej', 'p1').cook), { raw: 'cru', ways: [{ g: 135, adj: 'cuit' }] }, 'poulet 180 g cru');
const riz = itemOf(wed, 'dej', 'st');
assert.strictEqual(riz.cook.ways[0].g, Math.round(parseInt(riz.qty, 10) * 3 / 10) * 10, 'riz cuit = cru × 3');
assert.strictEqual(itemOf(wed, 'diner', 'p1').cook.ways[0].g, 160, 'poisson blanc 200 g cru');
const pdt = buildDay(day([]), { pdBase: 'avoine', dej: { prot: 'crevettes', starch: 'pdt' }, diner: { prot: 'saumon', starch: 'pates' } });
assert(!itemOf(pdt, 'dej', 'p1').cook, 'pas de poids cuit pour les crevettes cuites');
assert.strictEqual(itemOf(pdt, 'diner', 'st').cook.ways[0].adj, 'cuites', 'accord des pâtes');
for (const [starch, raw] of [['pdt', 'crues'], ['patate', 'crue']]) {
  const st = itemOf(buildDay(day([]), { pdBase: 'avoine', dej: { prot: 'poulet', starch }, diner: { prot: 'poisson', starch: 'riz' } }), 'dej', 'st');
  const q = parseInt(st.qty, 10);
  assert.deepStrictEqual(plain(st.cook), { raw, ways: [{ g: Math.round(q / 10) * 10, adj: 'à l’eau' }, { g: Math.round(q * 0.75 / 10) * 10, adj: 'au four' }] }, starch);
}
assert(!itemOf(buildDay(day([]), { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'gnocchis' }, diner: { prot: 'poisson', starch: 'riz' } }), 'dej', 'st').cook, 'pas de poids cuit pour les gnocchis');
for (const set of Object.values(SETS)) {
  const r = buildDay(day(set), DEFAULT_CHOICES[6]);
  for (const s of r.secs) for (const i of s.items) assert(i.m && isFinite(i.m.kcal), `${i.name} sans macros`);
}

// 14. Shaker : composition du profil
const shk = x => buildDay(day([]), DEFAULT_CHOICES[3], x).secs.flatMap(s => s.items).find(i => i.key === 'shk').m;
const s0 = shk({});
assert(s0.kcal === 120 && s0.p === 24 && s0.c === 3 && Math.abs(s0.f - 4 / 3) < 1e-9, 'shaker par défaut');
const s1 = shk({ shakerKcal: 160, shakerProt: 30 });
near(4 * s1.p + 4 * s1.c + 9 * s1.f, 160, 1e-9, 'kcal du shaker réglé');
assert(s1.p === 30 && s1.c === 5, 'macros du shaker réglé');
const s2 = shk({ shakerKcal: 100, shakerProt: 30 });
assert(s2.p === 25 && s2.c === 0 && s2.f === 0, 'protéines limitées à kcal / 4');
assert.strictEqual(cleanProfile({ shakerKcal: 200, shakerProt: 5 }).shakerKcal, 120, 'shaker hors bornes ignoré');
const plus = buildDay(day([]), DEFAULT_CHOICES[3], { shakerKcal: 160 }).tot.kcal - buildDay(day([]), DEFAULT_CHOICES[3]).tot.kcal;
assert(Math.abs(plus) <= 30, `un shaker plus calorique ne change pas le total (${Math.round(plus)} kcal)`);

// 15. Version : la même partout, notée en tête des nouveautés
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
assert(/^\d+\.\d+\.\d+$/.test(APP_VERSION), 'version mal formée : ' + APP_VERSION);
assert.strictEqual(pkg.version, APP_VERSION, 'version de package.json');
assert.strictEqual(lock.version, APP_VERSION, 'version de package-lock.json');
assert.strictEqual((changelog.match(/^## (\d+\.\d+\.\d+)/m) || [])[1], APP_VERSION, 'dernière version de CHANGELOG.md');

console.log(`moteur OK (${n} combinaisons vérifiées)`);
