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
vm.runInContext(m[1] + '\n;globalThis.__api = {APP_VERSION, buildDay, energy, bmr, restNeed, seanceCost, dayCost, cleanProfile, profileFields, cleanPlan, migratePlan, emptyPlan, scaleOf, DEFAULT_CHOICES, PROT_ORDER, STARCH_ORDER, STARCH_MIN, STARCH_MAX, FAT_MIN, FAT_MAX, DESSERT_ORDER, composeDay, protTarget, PF_MIN, PF_MAX, refTable, FOOD, UNIT, STARCH};', ctx);
const { APP_VERSION, buildDay, energy, bmr, restNeed, seanceCost, dayCost, cleanProfile, profileFields, cleanPlan, migratePlan, emptyPlan, scaleOf, DEFAULT_CHOICES, PROT_ORDER, STARCH_ORDER, STARCH_MIN, STARCH_MAX, FAT_MIN, FAT_MAX, DESSERT_ORDER, composeDay, protTarget, PF_MIN, PF_MAX, refTable, FOOD, UNIT, STARCH } = ctx.__api;

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
// Plafond des lipides : 95 g × k, ou 35 % de l'objectif les grosses journées (il est alors plus haut)
const fatCap = (r, k) => Math.max(FAT_MAX * k, 0.35 * r.energy.target / 9);

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
    assert(r.tot.p >= r.prot.floor - 0.5, `${combo} : ${Math.round(r.tot.p)} g de protéines`);
    assert(r.tot.f >= 55 && r.tot.f <= fatCap(r, 1), `${combo} : ${r.tot.f.toFixed(1)} g de lipides`);
    for (const k of starchKcal(r)) assert(k >= STARCH_MIN - 20 && k <= STARCH_MAX + 20, `${combo} : ${Math.round(k)} kcal de féculent dans un repas`);
    n++;
  }
}

// 7. Changer de féculent ne change pas le total de la journée (dosage en calories)
for (const [name, set] of Object.entries(SETS)) {
  const totals = STARCH_ORDER.map(s => buildDay(day(set), { pdBase: 'avoine', dej: { prot: 'poulet', starch: s }, diner: { prot: 'poisson', starch: s } }).tot.kcal);
  // Tolérance : arrondis des portions (les protéines suivent aussi le féculent : lentilles et quinoa en apportent plus)
  assert(Math.max(...totals) - Math.min(...totals) <= Math.max(40, 0.015 * buildDay(day(set), DEFAULT_CHOICES[3]).energy.target), `${name} : le total varie de ${Math.round(Math.max(...totals) - Math.min(...totals))} kcal selon le féculent`);
}

// 8. Déficits extrêmes : planchers toujours tenus, jamais nettement sous l'objectif
for (const deficit of [0, 25]) for (const [name, set] of Object.entries(SETS)) {
  for (const p1 of PROT_ORDER) for (const s1 of STARCH_ORDER) for (const p2 of PROT_ORDER) for (const s2 of STARCH_ORDER) {
    const combo = `${deficit} %/${name}/${p1}+${s1}/${p2}+${s2}`;
    const r = buildDay(day(set), { pdBase: 'avoine', dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } }, { deficit });
    assert(r.tot.p >= r.prot.floor - 0.5 && r.tot.f >= 55, `${combo} : P ${Math.round(r.tot.p)} g, L ${r.tot.f.toFixed(1)} g`);
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

// 13. Poids cuit et macros de chaque aliment (portions de référence : facteur de protéines 1)
const wed = composeDay(emptyPlan(3), DEFAULT_CHOICES[3], cleanProfile({}), 1);
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

// 15. Marge cuisine (matière grasse de cuisson comprise) : moitié au déjeuner, moitié au dîner, en lipides, prise sur les féculents
const margeOf = (x, set) => {
  const r = buildDay(day(set || []), DEFAULT_CHOICES[3], x);
  return { r, dej: (r.secs.find(s => s.id === 'dej').items.find(i => i.key === 'marge') || {}).m, diner: (r.secs.find(s => s.id === 'diner').items.find(i => i.key === 'marge') || {}).m };
};
const mg = margeOf({});
assert(mg.dej.kcal === 75 && mg.diner.kcal === 75 && mg.dej.p === 0 && mg.dej.c === 0 && Math.abs(mg.dej.f - 75 / 9) < 1e-9, 'marge par défaut : 75 + 75 kcal, en lipides');
assert(!mg.r.secs.flatMap(s => s.items).some(i => /huile/.test(i.name)), 'huile encore listée avec la marge par défaut');
const m0 = margeOf({ marge: 0 });
assert(!m0.dej && !m0.diner, 'marge nulle : aucune ligne');
const m3 = margeOf({ marge: 300 });
assert(m3.dej.kcal === 150 && m3.diner.kcal === 150, 'marge de 300 kcal');
const m25 = margeOf({ marge: 25 });
assert.strictEqual(m25.dej.kcal + m25.diner.kcal, 25, 'marge répartie sans arrondi perdu');
for (const set of [[], [moyenne('soir')], [longue(2)]]) {
  // À portions de protéines fixes, les féculents perdent exactement la marge en plus
  const a0 = composeDay(day(set), DEFAULT_CHOICES[3], cleanProfile({}), 1), b0 = composeDay(day(set), DEFAULT_CHOICES[3], cleanProfile({ marge: 300 }), 1);
  const lost = starchKcal(a0).reduce((x, y) => x + y) - starchKcal(b0).reduce((x, y) => x + y);
  near(lost, 150, 25, 'féculents diminués de la marge');
  const a = margeOf({}, set).r, b = margeOf({ marge: 300 }, set).r;
  near(b.tot.kcal, a.tot.kcal, 30, 'total du jour inchangé par la marge');
}
assert.strictEqual(cleanProfile({ marge: 400 }).marge, 150, 'marge hors bornes ignorée');
// Sans marge (cuisson sans matière grasse), l'huile de secours complète les lipides les jours maigres
const sansMarge = margeOf({ marge: 0 }).r, secours = sansMarge.secs.find(s => s.id === 'diner').items.find(i => i.key === 'gras');
assert(secours && /pour tes lipides/.test(secours.note) && sansMarge.tot.f >= 55, 'sans marge : huile de secours au dîner');

// 16. Portions mises à l'échelle du poids (référence 72 kg, k borné à 0,65-1,4), facteur de protéines fixé à 1
assert(scaleOf(cleanProfile({})) === 1 && scaleOf(cleanProfile({ poids: 36 })) === 0.65 && scaleOf(cleanProfile({ poids: 150 })) === 1.4, 'bornes de k');
const qtyOf = (x, sec, key, choices) => composeDay(day([]), choices || DEFAULT_CHOICES[3], cleanProfile(x), 1).secs.find(s => s.id === sec).items.find(i => i.key === key).qty;
const oeufsJambon = { pdBase: 'pain', dej: { prot: 'oeufs', starch: 'riz' }, diner: { prot: 'boeuf', starch: 'riz' } };
for (const poids of [71, 72, 73]) {
  const x = { poids };
  assert(qtyOf(x, 'dej', 'p1') === '180 g' && qtyOf(x, 'pd', 'skyr') === '250 g' && qtyOf(x, 'pd', 'am') === '15 g', `${poids} kg : portions de référence`);
  assert(qtyOf(x, 'dej', 'p1', oeufsJambon) === '3' && qtyOf(x, 'dej', 'p2', oeufsJambon) === '90 g' && qtyOf(x, 'pd', 'base', oeufsJambon) === '80 g', `${poids} kg : œufs, jambon, pain`);
}
const small = { sexe: 'f', age: 28, taille: 160, poids: 52 };
assert(qtyOf(small, 'dej', 'p1') === '130 g' && qtyOf(small, 'pd', 'skyr') === '180 g' && qtyOf(small, 'dej', 'p1', oeufsJambon) === '2', '52 kg : poulet 130 g, skyr 180 g, 2 œufs');
assert.strictEqual(buildDay(day([]), oeufsJambon, {}).secs.find(s => s.id === 'pd').items.find(i => i.key === 'base').note, '2 tranches', 'tranches de pain');
assert.strictEqual(buildDay(day([longue(2)]), oeufsJambon, {}).secs.find(s => s.id === 'pd').items.find(i => i.key === 'base').note, 'environ 3 tranches', 'tranches de pain, sortie longue');
assert.strictEqual(qtyOf({ poids: 100 }, 'dej', 'p1'), '250 g', '100 kg : poulet 250 g');
// Garde-fous pour d'autres corpulences : toutes les journées types × toutes les protéines (féculents variés)
const FRIENDS = {
  '52 kg, 20 %': { sexe: 'f', age: 28, taille: 160, poids: 52, deficit: 20 },
  '58 kg': { sexe: 'f', age: 30, taille: 165, poids: 58 },
  '58 kg sans shaker ni marge': { sexe: 'f', age: 30, taille: 165, poids: 58, shaker: 'non', marge: 0 },
  '85 kg': { age: 32, taille: 185, poids: 85 },
  '100 kg, 10 %': { age: 40, taille: 190, poids: 100, deficit: 10 }
};
let nf = 0;
for (const [who, prof] of Object.entries(FRIENDS)) {
  const k = scaleOf(cleanProfile(prof));
  for (const [name, set] of Object.entries(SETS)) for (const pdBase of ['avoine', 'pain']) {
    for (const p1 of PROT_ORDER) for (const p2 of PROT_ORDER) for (const [s1, s2] of [['riz', 'pdt'], ['lentilles', 'quinoa'], ['gnocchis', 'pates']]) {
      const combo = `${who}/${name}/${pdBase}/${p1}+${s1}/${p2}+${s2}`;
      const r = buildDay(day(set), { pdBase, dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } }, prof);
      assert(r.tot.p >= r.prot.floor - 0.5, `${combo} : ${Math.round(r.tot.p)} g de protéines pour un plancher de ${Math.round(r.prot.floor)}`);
      assert(r.tot.f >= FAT_MIN * k - 0.5 && r.tot.f <= fatCap(r, k), `${combo} : ${r.tot.f.toFixed(1)} g de lipides (${Math.round(FAT_MIN * k)} à ${Math.round(fatCap(r, k))})`);
      assert(r.ecart >= -r.energy.target * 0.03, `${combo} : ${Math.round(-r.ecart)} kcal sous l'objectif`);
      if (r.ecart > r.energy.target * 0.03) {
        for (const kc of starchKcal(r)) assert(kc <= STARCH_MIN * k + 20, `${combo} : au-dessus de l'objectif sans être au plancher`);
      }
      for (const kc of starchKcal(r)) assert(kc >= STARCH_MIN * k - 20 && kc <= STARCH_MAX * k + 20, `${combo} : ${Math.round(kc)} kcal de féculent`);
      nf++;
    }
  }
}

// 17. Shaker optionnel : sans shaker, ni section ni ligne ; le skyr du soir compense si besoin
assert.strictEqual(cleanProfile({}).shaker, 'oui', 'shaker par défaut');
assert.strictEqual(cleanProfile({ shaker: 'peut-être' }).shaker, 'oui', 'valeur de shaker invalide ignorée');
for (const [name, set] of Object.entries(SETS)) {
  const r = buildDay(day(set), DEFAULT_CHOICES[3], { shaker: 'non' });
  assert(!r.secs.some(s => s.id === 'shk') && !r.secs.flatMap(s => s.items).some(i => i.key === 'shk'), `${name} : shaker affiché alors qu'il est désactivé`);
  assert(r.tot.p >= r.prot.floor - 0.5, `${name} : ${Math.round(r.tot.p)} g de protéines sans shaker`);
}
// Thon deux fois (boîte fixe) sans shaker et objectif élevé : les portions sont au maximum, le skyr du soir complète
const thonThon = { pdBase: 'pain', dej: { prot: 'thon', starch: 'riz' }, diner: { prot: 'thon', starch: 'riz' } };
assert(!buildDay(day([]), thonThon, {}).secs.some(s => s.id === 'soir'), 'thon deux fois avec shaker : pas de skyr du soir');
const lean = buildDay(day([]), thonThon, { shaker: 'non', prot: 2.4 });
assert(lean.secs.some(s => s.id === 'soir') && lean.prot.factor === PF_MAX && lean.tot.p >= lean.prot.floor - 0.5, 'skyr du soir de secours sans shaker');

// 18. Objectif de protéines en g/kg : portions de viande, poisson, œufs et skyr ajustées sur la journée sans séance
assert(cleanProfile({}).prot === 2 && cleanProfile({ prot: 2.4 }).prot === 2.4 && cleanProfile({ prot: 5 }).prot === 2 && cleanProfile({ prot: 1 }).prot === 2, 'bornes de l’objectif de protéines');
near(protTarget(cleanProfile({})), 144, 1e-9, 'objectif par défaut : 2 × 72 kg');
near(protTarget(cleanProfile({ poids: 150, prot: 2 })), 2 * 72 * 1.4, 1e-9, 'objectif sur le poids borné');
const pday = (set, ch, x) => buildDay(day(set), ch || DEFAULT_CHOICES[1], x);
const pq = (r, sec, key) => r.secs.find(s => s.id === sec).items.find(i => i.key === key).qty;
// Un jour sans séance : l'objectif est atteint (− 5 % à + 7 %, les œufs s'arrondissent à l'unité), sauf si les portions sont en butée (thon, féculents riches en protéines)
let npt = 0;
for (const prot of [2, 2.2, 2.6]) for (const pdBase of ['avoine', 'pain']) for (const p1 of PROT_ORDER) for (const p2 of PROT_ORDER) for (const [s1, s2] of [['riz', 'pdt'], ['pates', 'gnocchis'], ['lentilles', 'quinoa']]) {
  const r = pday([], { pdBase, dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } }, { prot });
  const combo = `${prot} g/kg/${pdBase}/${p1}+${s1}/${p2}+${s2}`, T = r.prot.target;
  assert(r.tot.p >= r.prot.floor - 0.5, `${combo} : ${Math.round(r.tot.p)} g sous le plancher`);
  assert(r.tot.p <= T * 1.07 || r.prot.factor <= PF_MIN + 0.02, `${combo} : ${Math.round(r.tot.p)} g pour un objectif de ${Math.round(T)} (facteur ${r.prot.factor.toFixed(2)})`);
  assert(r.tot.p >= T * 0.95 || r.prot.factor >= PF_MAX - 0.02 || r.secs.some(s => s.id === 'soir'), `${combo} : ${Math.round(r.tot.p)} g pour un objectif de ${Math.round(T)}`);
  npt++;
}
// Mêmes portions les jours de séance (les féculents en plus apportent quelques protéines de plus), et le jour du repas libre
const ref = pday([]);
for (const set of [[petite('soir')], [moyenne('matin'), moyenne('soir')], [longue(2)]]) {
  const r = pday(set);
  assert(pq(r, 'dej', 'p1') === pq(ref, 'dej', 'p1') && pq(r, 'diner', 'p1') === pq(ref, 'diner', 'p1') && r.prot.factor === ref.prot.factor, 'portions de protéines changées par les séances');
  assert(r.tot.p >= ref.tot.p - 5, `jour de séance : ${Math.round(r.tot.p)} g contre ${Math.round(ref.tot.p)} g au repos`);
}
assert.strictEqual(pq(pday([], DEFAULT_CHOICES[1]), 'dej', 'p1'), pq(buildDay(day([], { libre: true }), DEFAULT_CHOICES[1]), 'dej', 'p1'), 'portions changées par le repas libre');
// Plus d'objectif, plus de viande et moins de féculents ; le total du jour ne bouge pas
const p20 = pday([], undefined, { prot: 2 }), p26 = pday([], undefined, { prot: 2.6 });
assert(parseInt(pq(p26, 'dej', 'p1')) > parseInt(pq(p20, 'dej', 'p1')) && parseInt(pq(p26, 'pd', 'skyr')) > parseInt(pq(p20, 'pd', 'skyr')), 'objectif plus haut, portions plus grandes');
assert(starchKcal(p26)[0] < starchKcal(p20)[0], 'objectif plus haut, moins de féculents');
near(p26.tot.kcal, p20.tot.kcal, 30, 'total du jour indépendant de l’objectif de protéines');
// Valeurs de référence (lundi : poulet + riz, crevettes + quinoa ; 72 kg, 2 g/kg) : poulet 110 g, skyr 160 g
assert(pq(p20, 'dej', 'p1') === '110\u00a0g' && pq(p20, 'pd', 'skyr') === '160\u00a0g', `2 g/kg : poulet ${pq(p20, 'dej', 'p1')}, skyr ${pq(p20, 'pd', 'skyr')}`);

// 19. Desserts : pris sur le féculent du même repas, total du jour inchangé
const withDes = (dej, diner, base) => {
  const b = base || DEFAULT_CHOICES[3];
  return { pdBase: b.pdBase, dej: Object.assign({}, b.dej, { dessert: dej }), diner: Object.assign({}, b.diner, { dessert: diner }) };
};
const desOf = (r, id) => (r.secs.find(s => s.id === id) || { items: [] }).items.filter(i => i.key === 'des');
const DES_KCAL = { fruit: 80, compote: 65, chocolat: 116 };
const moySoir = day([moyenne('soir')]);
const sansDes = buildDay(moySoir, DEFAULT_CHOICES[3]);
assert.strictEqual(DESSERT_ORDER.join(), 'aucun,fruit,compote,chocolat', 'liste des desserts');
for (const d of ['fruit', 'compote', 'chocolat']) {
  const r = buildDay(moySoir, withDes(d, 'aucun'));
  const l = desOf(r, 'dej');
  assert(l.length === 1 && Math.round(l[0].m.kcal) === DES_KCAL[d] && !desOf(r, 'diner').length, `${d} : ligne du dessert au déjeuner`);
  assert.strictEqual(r.secs.find(s => s.id === 'dej').items.slice(-1)[0].key, 'des', `${d} : le dessert termine le repas`);
  near(r.tot.kcal, sansDes.tot.kcal, 30, `${d} : total du jour inchangé`);
  const [a0, b0] = starchKcal(sansDes), [a1, b1] = starchKcal(r);
  near(a0 - a1, DES_KCAL[d], 20, `${d} : féculent du déjeuner diminué du dessert`);
  near(b1, b0, 20, `${d} : féculent du dîner inchangé`);
  const rd = buildDay(moySoir, withDes('aucun', d));
  near(starchKcal(sansDes)[1] - starchKcal(rd)[1], DES_KCAL[d], 20, `${d} : féculent du dîner diminué du dessert`);
}
assert.strictEqual(desOf(buildDay(moySoir, withDes('chocolat', 'fruit')), 'diner')[0].name, 'fruit', 'dessert du dîner');
assert(!buildDay(moySoir, withDes('constructor', '__proto__')).secs.some(s => s.items.some(i => i.key === 'des')), 'dessert invalide ignoré');
assert(!buildDay(moySoir, DEFAULT_CHOICES[3]).secs.some(s => s.items.some(i => i.key === 'des')), 'sans dessert enregistré : aucun');
// Séance à midi : le dessert choisi remplace la compote automatique du déjeuner
const midiDay = day([petite('midi')]);
const midiKeys = ch => buildDay(midiDay, ch).secs.find(s => s.id === 'dej').items.map(i => i.key).filter(k => k === 'comp' || k === 'des').join();
assert.strictEqual(midiKeys(withDes('aucun', 'aucun')), 'comp', 'séance à midi sans dessert : compote');
assert.strictEqual(midiKeys(withDes('fruit', 'aucun')), 'des', 'séance à midi : le dessert remplace la compote');
assert.strictEqual(midiKeys(withDes('aucun', 'chocolat')), 'comp', 'le dessert du dîner ne touche pas la compote de midi');
// Repas libre : pas de dessert au dîner
assert(!desOf(buildDay(day([], { libre: true }), withDes('aucun', 'chocolat')), 'diner').length, 'dessert affiché avec le repas libre');
// Garde-fous : 12 journées types × 16 couples de desserts × protéines (féculents variés)
let nd = 0;
for (const [name, set] of Object.entries(SETS)) for (const d1 of DESSERT_ORDER) for (const d2 of DESSERT_ORDER) {
  for (const p1 of PROT_ORDER) for (const p2 of PROT_ORDER) for (const [s1, s2] of [['riz', 'pdt'], ['lentilles', 'quinoa'], ['gnocchis', 'pates']]) {
    const combo = `${name}/${d1}+${d2}/${p1}+${s1}/${p2}+${s2}`;
    const r = buildDay(day(set), { pdBase: 'avoine', dej: { prot: p1, starch: s1, dessert: d1 }, diner: { prot: p2, starch: s2, dessert: d2 } });
    const choco = [d1, d2].filter(d => d === 'chocolat').length * 8.4;
    assert(r.tot.p >= r.prot.floor - 0.5, `${combo} : ${Math.round(r.tot.p)} g de protéines`);
    assert(r.tot.f >= FAT_MIN && r.tot.f <= fatCap(r, 1) + choco, `${combo} : ${r.tot.f.toFixed(1)} g de lipides`);
    assert(r.ecart >= -r.energy.target * 0.03, `${combo} : ${Math.round(-r.ecart)} kcal sous l'objectif`);
    if (r.ecart > r.energy.target * 0.03) for (const kc of starchKcal(r)) assert(kc <= STARCH_MIN + 20, `${combo} : au-dessus de l'objectif sans être au plancher`);
    for (const kc of starchKcal(r)) assert(kc >= STARCH_MIN - 20 && kc <= STARCH_MAX + 20, `${combo} : ${Math.round(kc)} kcal de féculent`);
    nd++;
  }
}

// 20. Table de référence : chaque aliment de FOOD, UNIT et STARCH une fois, avec ses propres valeurs
const refKeys = refTable().flatMap(g => g.rows.map(r => r.src + ':' + r.key));
const allKeys = Object.keys(FOOD).map(k => 'food:' + k).concat(Object.keys(UNIT).map(k => 'unit:' + k), Object.keys(STARCH).map(k => 'starch:' + k));
assert.strictEqual(refKeys.slice().sort().join(), allKeys.slice().sort().join(), 'table de référence incomplète ou en double');
for (const g of refTable()) for (const r of g.rows) {
  const v = r.src === 'food' ? FOOD[r.key] : r.src === 'unit' ? UNIT[r.key] : STARCH[r.key].f;
  assert(r.v.join() === v.join() && r.label, `valeurs de référence de ${r.key}`);
}

// 21. Version : la même partout, notée en tête des nouveautés
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
assert(/^\d+\.\d+\.\d+$/.test(APP_VERSION), 'version mal formée : ' + APP_VERSION);
assert.strictEqual(pkg.version, APP_VERSION, 'version de package.json');
assert.strictEqual(lock.version, APP_VERSION, 'version de package-lock.json');
assert.strictEqual((changelog.match(/^## (\d+\.\d+\.\d+)/m) || [])[1], APP_VERSION, 'dernière version de CHANGELOG.md');

console.log(`moteur OK (${n} combinaisons vérifiées, ${nf} pour d'autres corpulences, ${nd} avec desserts, ${npt} objectifs de protéines)`);
