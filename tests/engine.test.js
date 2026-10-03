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
vm.runInContext(m[1] + '\n;globalThis.__api = {APP_VERSION, buildDay, energy, bmr, restNeed, seanceCost, dayCost, cleanProfile, profileFields, cleanPlan, migratePlan, emptyPlan, scaleOf, DEFAULT_CHOICES, PROT_ORDER, STARCH_ORDER, STARCH_MIN, starchCap, FAT_MIN, FAT_MAX, DESSERT_ORDER, composeDay, protTarget, PF_MIN, PF_MAX, refTable, FOOD, UNIT, STARCH, PD_ORDER, WEEK_GOALS, weekBalance, weekNeeds, randomChoices, cleanWeek, cleanSeances, RECIPES, RFOOD, VEG_IDS, recipesFor, recipeOf, withAllowed, shoppingList, SHOP_AISLES, total, batchChoices, batchCook, FRIDGE_DAYS, YIELD, batchSwapOptions, batchSwap, batchSwapPick, batchRound, fixedGrams, HAM_SLICES, BATCH_GRAMS};', ctx);
const { APP_VERSION, buildDay, energy, bmr, restNeed, seanceCost, dayCost, cleanProfile, profileFields, cleanPlan, migratePlan, emptyPlan, scaleOf, DEFAULT_CHOICES, PROT_ORDER, STARCH_ORDER, STARCH_MIN, starchCap, FAT_MIN, FAT_MAX, DESSERT_ORDER, composeDay, protTarget, PF_MIN, PF_MAX, refTable, FOOD, UNIT, STARCH, PD_ORDER, WEEK_GOALS, weekBalance, weekNeeds, randomChoices, cleanWeek, cleanSeances, RECIPES, RFOOD, VEG_IDS, recipesFor, recipeOf, withAllowed, shoppingList, SHOP_AISLES, total, batchChoices, batchCook, FRIDGE_DAYS, YIELD, batchSwapOptions, batchSwap, batchSwapPick, batchRound, fixedGrams, HAM_SLICES, BATCH_GRAMS } = ctx.__api;

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
// Féculents entre leur plancher (kcal) et leur plafond (portion sportive en grammes, × k) ; tolérance d'arrondi
const starchOk = (r, s1, s2, k) => starchKcal(r).every((kc, i) => kc >= STARCH_MIN * k - 20 && kc <= starchCap([s1, s2][i], k) + 20);
// Protéines dans la fourchette objectif ± 10 % (tolérance : œufs à l'unité), sauf portions en butée
const protOk = r => r.tot.p >= r.prot.low - 0.5 && (r.tot.p <= r.prot.high + 0.03 * r.prot.target || r.prot.factor <= PF_MIN + 0.02);
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

// 6. Toutes les combinaisons de plats avec le profil par défaut : apport ≈ objectif, planchers respectés
// (base du petit-déjeuner en alternance : chaque couple de plats est vu avec l'avoine, le pain et le salé sur l'ensemble)
let n = 0;
for (const [name, set] of Object.entries(SETS)) {
  for (const [i1, p1] of PROT_ORDER.entries()) for (const s1 of STARCH_ORDER) for (const p2 of PROT_ORDER) for (const [i2, s2] of STARCH_ORDER.entries()) {
    const pdBase = PD_ORDER[(i1 + i2 + n) % PD_ORDER.length];
    const combo = `${name}/${pdBase}/${p1}+${s1}/${p2}+${s2}`;
    const r = buildDay(day(set), { pdBase, dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } });
    assert(Math.abs(r.ecart) <= r.energy.target * 0.03, `${combo} : ${Math.round(r.tot.kcal)} kcal pour un objectif de ${r.energy.target}`);
    assert(protOk(r), `${combo} : ${Math.round(r.tot.p)} g de protéines (${Math.round(r.prot.low)} à ${Math.round(r.prot.high)}, facteur ${r.prot.factor.toFixed(2)})`);
    assert(r.tot.f >= 55 && r.tot.f <= fatCap(r, 1), `${combo} : ${r.tot.f.toFixed(1)} g de lipides`);
    assert(starchOk(r, s1, s2, 1), `${combo} : féculents ${starchKcal(r).map(Math.round).join(' + ')} kcal`);
    n++;
  }
}

// 7. Changer de féculent ne change pas le total de la journée (dosage en calories)
for (const [name, set] of Object.entries(SETS)) {
  const totals = STARCH_ORDER.map(s => buildDay(day(set), { pdBase: 'avoine', dej: { prot: 'poulet', starch: s }, diner: { prot: 'poisson', starch: s } }).tot.kcal);
  // Tolérance : arrondis des portions (les protéines suivent aussi le féculent : lentilles et quinoa en apportent plus)
  assert(Math.max(...totals) - Math.min(...totals) <= Math.max(40, 0.015 * buildDay(day(set), DEFAULT_CHOICES[3]).energy.target), `${name} : le total varie de ${Math.round(Math.max(...totals) - Math.min(...totals))} kcal selon le féculent`);
}

// 8. Déficits extrêmes : planchers toujours tenus, jamais nettement sous l'objectif (féculent du dîner en rotation)
for (const deficit of [0, 25]) for (const [name, set] of Object.entries(SETS)) {
  for (const p1 of PROT_ORDER) for (const [j1, s1] of STARCH_ORDER.entries()) for (const [j2, p2] of PROT_ORDER.entries()) for (const s2 of [STARCH_ORDER[(j1 + j2) % STARCH_ORDER.length], STARCH_ORDER[(j1 + 2 * j2 + 3) % STARCH_ORDER.length]]) {
    const combo = `${deficit} %/${name}/${p1}+${s1}/${p2}+${s2}`;
    const r = buildDay(day(set), { pdBase: 'avoine', dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } }, { deficit });
    assert(r.tot.p >= r.prot.floor - 0.5 && r.tot.f >= 55, `${combo} : P ${Math.round(r.tot.p)} g, L ${r.tot.f.toFixed(1)} g`);
    assert(r.ecart >= -r.energy.target * 0.03, `${combo} : ${Math.round(-r.ecart)} kcal sous l'objectif`);
    if (r.ecart > r.energy.target * 0.03) {
      for (const k of starchKcal(r)) assert(k <= STARCH_MIN + 20, `${combo} : au-dessus de l'objectif sans être au plancher`);
    }
  }
}

// 9. Très grosse journée : féculents à leur plafond (portion sportive), le reste en budget d'encas compté en glucides
const big = buildDay(day(SETS['longue 3 h + petite le soir']), DEFAULT_CHOICES[6], { deficit: 0 });
const encas = big.secs.find(s => s.id === 'co').items.find(i => i.key === 'encas');
assert(encas && encas.m.kcal >= 30 && encas.m.c === encas.m.kcal / 4 && encas.m.p === 0 && /pain complet et miel/.test(encas.note), 'pas d’encas au-delà du plafond');
assert(/^≈\s[\d\s]+$/.test(encas.qty) && encas.m.kcal % 10 === 0, 'budget d’encas arrondi à 10 kcal : ' + encas.qty);
assert(Math.abs(big.ecart) <= big.energy.target * 0.03, 'grosse journée loin de l’objectif');
assert.strictEqual(big.secs.find(s => s.id === 'dej').items.find(i => i.key === 'st').qty, '120\u00a0g', 'pâtes du samedi à leur plafond');
for (const [id, g] of [['riz', 120], ['pates', 120], ['quinoa', 120], ['lentilles', 100], ['pdt', 400], ['patate', 400], ['gnocchis', 300]]) {
  near(starchCap(id, 1), g * STARCH[id].f[0] / 100, 1e-9, `plafond de ${id}`);
}
assert(!buildDay(day([]), DEFAULT_CHOICES[3]).secs.some(s => s.items.some(i => i.key === 'encas')), 'encas un jour de repos');

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
const keys = s => s.items.map(i => i.key).filter(k => k !== 'encas').join(' ');
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
// Collation : des œufs tout court (plus de marinade depuis la 3.8.0)
const oe = secOf(r0([]), 'co').items.find(i => i.key === 'oe');
assert(oe.qty === '2' && oe.name === 'œufs' && oe.note === 'durs ou mollets, préparés à l’avance' && oe.m.kcal === UNIT.oeuf[0] * 2 && oe.buy.id === 'oeuf', 'œufs de la collation');
// Déjà des œufs dans la journée (salé, « Œufs + jambon ») : skyr et amandes à la collation, presque la même chose
const coOf = (c, set, prof) => secOf(buildDay(day(set || []), Object.assign({}, DEFAULT_CHOICES[3], c), prof || {}), 'co').items;
const coKeys = (c, set, prof) => coOf(c, set, prof).map(i => i.key).join(' ');
assert(/^oe/.test(coKeys({})) && /^oe/.test(coKeys({ dej: { prot: 'thon', starch: 'riz' } })), 'œufs à la collation sans autres œufs (l’œuf dur du thon ne compte pas)');
for (const c of [{ pdBase: 'sale' }, { dej: { prot: 'oeufs', starch: 'riz' } }, { diner: { prot: 'oeufs', starch: 'riz' } }]) {
  const co = coOf(c);
  assert(/^csk cam/.test(coKeys(c)) && !co.some(i => i.key === 'oe'), 'skyr et amandes à la collation : ' + JSON.stringify(c));
  assert.deepStrictEqual(plain(co.slice(0, 2).map(i => [i.qty, i.name, i.note])), [['100\u00a0g', 'skyr nature', 'à la place des œufs, déjà au menu aujourd’hui'], ['15\u00a0g', 'amandes', null]], 'collation sans œufs : portions');
  near(co[0].m.kcal + co[1].m.kcal, 2 * UNIT.oeuf[0], 10, 'collation sans œufs : mêmes calories');
  near(co[0].m.p + co[1].m.p, 2 * UNIT.oeuf[1], 2, 'collation sans œufs : mêmes protéines');
  near(co[0].m.f + co[1].m.f, 2 * UNIT.oeuf[3], 2, 'collation sans œufs : mêmes lipides');
}
assert(/^csk cam ban comp shk/.test(coKeys({ pdBase: 'sale' }, [moyenne('matin')])), 'collation sans œufs après la séance du matin, avec le shaker');
assert.strictEqual(coOf({ pdBase: 'sale' }, [], { poids: 120 })[0].qty, '140\u00a0g', 'skyr de la collation × k');
assert.strictEqual(coOf({ pdBase: 'sale' }, [], { poids: 50 })[0].qty, '100\u00a0g', 'skyr de la collation : jamais sous 100 g');
// Sortie longue : le salé redevient sucré (pas d'œufs le matin), le goûter ne change pas
assert(coKeys({ pdBase: 'sale' }, [longue(2)]).split(' ').includes('skyr'), 'goûter de sortie longue inchangé');
// Petit-déjeuner, trois bases : avoine (ou muesli), pain complet, salé (pain, œufs, une tranche de jambon, fruit ; ni skyr ni amandes)
const pdOf = (pdBase, set, prof) => secOf(buildDay(day(set), Object.assign({}, DEFAULT_CHOICES[3], { pdBase }), prof || {}), 'pd').items;
const line = (items, key) => { const i = items.find(x => x.key === key); return i ? [i.qty, i.name, i.note].join(' | ') : null; };
assert.strictEqual(line(pdOf('avoine', []), 'base'), '60\u00a0g | flocons d’avoine ou muesli | muesli sans sucre ajouté. En porridge, ou trempés la veille dans le skyr', 'avoine ou muesli');
assert.strictEqual(pdOf('pain', []).map(i => i.key).join(' '), 'base skyr fruit am', 'pain complet');
const sale = pdOf('sale', []);
assert.strictEqual(sale.map(i => i.key).join(' '), 'base oeufs jambon fruit', 'salé : ni skyr ni amandes');
assert.deepStrictEqual(plain(sale.map(i => [i.qty, i.name])), [['80\u00a0g', 'pain complet'], ['2', 'œufs'], ['45\u00a0g', 'jambon blanc'], ['125\u00a0g', 'fruits rouges']], 'salé : portions');
assert(line(sale, 'oeufs').endsWith('à la coque, pochés ou brouillés sans matière grasse') && line(sale, 'jambon').endsWith('1 tranche'), 'salé : notes');
assert(!sale.some(i => i.adj), 'salé : portions fixes (pas ajustées à l’objectif de protéines)');
assert.strictEqual(pdOf('sale', [moyenne('soir')]).find(i => i.key === 'fruit').name, 'banane', 'salé : banane les jours de séance moyenne');
// 52 kg : portions × k, un œuf ; sortie longue : version sucrée au pain, dite dans la note
assert.deepStrictEqual(plain(pdOf('sale', [], { sexe: 'f', poids: 52 }).map(i => i.qty)), ['60\u00a0g', '1', '35\u00a0g', '125\u00a0g'], 'salé à 52 kg');
assert.strictEqual(line(pdOf('sale', [], { poids: 45 }), 'oeufs'), '1 | œuf | à la coque, poché ou brouillé sans matière grasse', 'salé : un œuf');
const saleLong = pdOf('sale', [longue(2)]), painLong = pdOf('pain', [longue(2)]);
assert.deepStrictEqual(plain(saleLong.map(i => [i.key, i.qty])), plain(painLong.map(i => [i.key, i.qty])), 'salé un jour de sortie longue = version sucrée au pain');
assert.strictEqual(saleLong[0].note, 'environ 3 tranches, en version sucrée avant la sortie longue (plus digeste)', 'sortie longue : version sucrée dite');
// Thon midi et soir avec le salé : plus rien ne s'ajuste à l'objectif de protéines, la journée est comptée en butée
const thonSale = { pdBase: 'sale', dej: { prot: 'thon', starch: 'riz' }, diner: { prot: 'thon', starch: 'lentilles' } };
const ts = buildDay(day([]), thonSale);
assert(ts.tot.p > ts.prot.high && ts.prot.factor === PF_MIN, `thon deux fois et salé : ${Math.round(ts.tot.p)} g, facteur ${ts.prot.factor}`);
const tsLow = buildDay(day([]), { pdBase: 'sale', dej: { prot: 'thon', starch: 'gnocchis' }, diner: { prot: 'thon', starch: 'pdt' } }, { prot: 2.2, shaker: 'non' });
assert(tsLow.prot.factor === PF_MAX && tsLow.secs.some(sec => sec.id === 'soir'), 'thon deux fois et salé, objectif haut : butée haute et skyr du soir');
// Salé et sucré ont presque les mêmes lipides au petit-déjeuner (œufs ≈ amandes), le total du jour ne bouge pas
const fatPd = items => items.reduce((a, i) => a + i.m.f, 0);
near(fatPd(sale), fatPd(pdOf('avoine', [])), 1, 'lipides du petit-déjeuner salé');
for (const [name, set] of Object.entries(SETS)) {
  const t = PD_ORDER.map(pdBase => buildDay(day(set), Object.assign({}, DEFAULT_CHOICES[3], { pdBase })).tot.kcal);
  assert(Math.max(...t) - Math.min(...t) <= 40, `${name} : la base du petit-déjeuner change le total (${t.map(Math.round).join(', ')})`);
}
// Un seul shaker par jour, juste après la dernière séance
for (const [name, set] of Object.entries(SETS)) for (const libre of [false, true]) {
  const r = buildDay(day(set, { libre }), DEFAULT_CHOICES[3]);
  assert.strictEqual(r.secs.flatMap(s => s.items).filter(i => i.key === 'shk').length, 1, `${name} : un shaker par jour`);
  const i = r.secs.findIndex(s => s.id === 'shk');
  if (i >= 0) assert(r.secs[i - 1].band, `${name} : le shaker ne suit pas la séance`);
}
// Féculents : la plus grosse part au repas qui suit les séances (même féculent aux deux repas : mêmes plafonds)
const rizRiz = set => buildDay(day(set), { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz' }, diner: { prot: 'poisson', starch: 'riz' } });
const [dj, dn] = starchKcal(rizRiz([moyenne('soir')]));
assert(dn > dj, 'séance le soir : plus de féculents au dîner');
const [dj2, dn2] = starchKcal(rizRiz([longue(2)]));
assert(dj2 >= dn2, 'sortie longue : au moins autant de féculents au déjeuner (les deux peuvent être au plafond)');

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
// Le jour du repas libre est d'abord un jour normal (planchers de secours compris) : seuls le dîner et le skyr du soir
// sont remplacés, par leur énergie + 300 × k (corrigé en 3.3.2 : les autres repas changeaient les jours à huile ou skyr de secours)
const sameDay = (label, set, ch, prof) => {
  const normal = buildDay(day(set), ch, prof), r = buildDay(day(set, { libre: true }), ch, prof);
  const qty = (x, id) => x.secs.find(s => s.id === id).items.map(i => i.qty + ' ' + i.name).join(', ');
  normal.secs.filter(s => s.id !== 'diner' && s.id !== 'soir').forEach(s => assert.strictEqual(qty(r, s.id), qty(normal, s.id), `${label} : ${s.title} changé par le repas libre`));
  const evening = normal.secs.filter(s => s.id === 'diner' || s.id === 'soir').reduce((a, s) => a + s.items.reduce((b, i) => b + i.m.kcal, 0), 0);
  assert.strictEqual(r.libre, Math.round((evening + 300 * r.scale) / 50) * 50, `${label} : budget du repas libre`);
  assert.strictEqual(r.ecart, normal.ecart, `${label} : écart du jour libre`);
  assert(!r.secs.some(s => s.id === 'soir'), `${label} : skyr du soir le jour du repas libre`);
  return normal;
};
const oil = sameDay('58 kg sans marge', [petite('matin')], DEFAULT_CHOICES[2], { poids: 58, sexe: 'f', shaker: 'non', marge: 0 });
assert(oil.secs.find(s => s.id === 'diner').items.some(i => i.key === 'gras'), 'cas sans huile de secours : le test ne vérifie plus rien');
const soir = sameDay('thon deux fois, salé, 2,2 g/kg, sans shaker', [], { pdBase: 'sale', dej: { prot: 'thon', starch: 'gnocchis' }, diner: { prot: 'thon', starch: 'pdt' } }, { prot: 2.2, shaker: 'non' });
assert(soir.secs.some(s => s.id === 'soir'), 'cas sans skyr du soir : le test ne vérifie plus rien');
for (const [name, set] of Object.entries(SETS)) sameDay(name, set, DEFAULT_CHOICES[6]);

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
// Remplacement en note : même énergie que l'œuf dur du thon, quel que soit le poids (corrigé en 3.3.2).
// Lipides du dîner avec viande blanche ou poisson blanc : 25 g d'amandes fixes, plus d'avocat (3.10.0)
const thonPoulet = { pdBase: 'avoine', dej: { prot: 'thon', starch: 'riz' }, diner: { prot: 'poulet', starch: 'riz' } };
for (const poids of [45, 72, 110]) {
  const r = composeDay(day([]), thonPoulet, cleanProfile({ poids }), 1);
  const am = r.secs.find(s => s.id === 'diner').items.find(i => i.key === 'dam'), oeuf = r.secs.find(s => s.id === 'dej').items.find(i => i.key === 'p2');
  assert(am && am.qty === '25\u00a0g' && am.name === 'amandes' && am.note === 'sur les légumes ou en fin de repas' && am.buy.id === 'amandes' && am.buy.g === 25, `${poids} kg : 25 g d’amandes au dîner`);
  near(am.m.kcal, FOOD.amandes[0] * 0.25, 1e-9, 'amandes du dîner');
  assert.strictEqual(oeuf.note, 'ou 20\u00a0g de parmesan', `${poids} kg : parmesan pour un œuf dur`);
  near(FOOD.parmesan[0] * 0.2, oeuf.m.kcal, 0.15 * oeuf.m.kcal, 'parmesan ≈ œuf dur');
}
for (const p of PROT_ORDER) {
  const r = buildDay(day([]), { pdBase: 'avoine', dej: { prot: p, starch: 'riz' }, diner: { prot: p, starch: 'riz' } });
  const names = r.secs.flatMap(s => s.items).map(i => i.name);
  assert(!names.some(n => /avocat/.test(n)) && !Object.prototype.hasOwnProperty.call(FOOD, 'avocat'), 'plus d’avocat');
  assert.strictEqual(r.secs.find(s => s.id === 'diner').items.some(i => i.key === 'dam'), p === 'poulet' || p === 'poisson', `${p} : amandes au dîner seulement avec viande blanche ou poisson blanc`);
  assert(!r.secs.find(s => s.id === 'dej').items.some(i => i.key === 'dam'), `${p} : pas d’amandes au déjeuner`);
}
// Accords : « 1 œuf » (collation, déjeuner), « une demi-tranche » aux plus petites portions (corrigé en 3.3.2)
const tiny = composeDay(day([]), oeufsJambon, cleanProfile({ poids: 45 }), 0.5);
const tinyCo = composeDay(day([]), DEFAULT_CHOICES[3], cleanProfile({ poids: 45 }), 0.5);
assert.deepStrictEqual([itemOf(tinyCo, 'co', 'oe').qty, itemOf(tinyCo, 'co', 'oe').name, itemOf(tinyCo, 'co', 'oe').note], ['1', 'œuf', 'dur ou mollet, préparé à l’avance'], 'un œuf à la collation');
assert.deepStrictEqual([itemOf(tiny, 'dej', 'p1').qty, itemOf(tiny, 'dej', 'p1').name], ['1', 'œuf'], 'un œuf');
assert.strictEqual(itemOf(tiny, 'dej', 'p2').note, 'environ une demi-tranche', 'demi-tranche de jambon');
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
  for (const [name, set] of Object.entries(SETS)) for (const pdBase of PD_ORDER) {
    for (const p1 of PROT_ORDER) for (const p2 of PROT_ORDER) for (const [s1, s2] of [['riz', 'pdt'], ['lentilles', 'quinoa'], ['gnocchis', 'pates']]) {
      const combo = `${who}/${name}/${pdBase}/${p1}+${s1}/${p2}+${s2}`;
      const r = buildDay(day(set), { pdBase, dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } }, prof);
      assert(protOk(r), `${combo} : ${Math.round(r.tot.p)} g de protéines (${Math.round(r.prot.low)} à ${Math.round(r.prot.high)})`);
      assert(r.tot.f >= FAT_MIN * k - 0.5 && r.tot.f <= fatCap(r, k), `${combo} : ${r.tot.f.toFixed(1)} g de lipides (${Math.round(FAT_MIN * k)} à ${Math.round(fatCap(r, k))})`);
      assert(r.ecart >= -r.energy.target * 0.03, `${combo} : ${Math.round(-r.ecart)} kcal sous l'objectif`);
      if (r.ecart > r.energy.target * 0.03) {
        for (const kc of starchKcal(r)) assert(kc <= STARCH_MIN * k + 20, `${combo} : au-dessus de l'objectif sans être au plancher`);
      }
      assert(starchOk(r, s1, s2, k), `${combo} : féculents ${starchKcal(r).map(Math.round).join(' + ')} kcal`);
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
const lean = buildDay(day([]), { pdBase: 'sale', dej: { prot: 'thon', starch: 'gnocchis' }, diner: { prot: 'thon', starch: 'pdt' } }, { shaker: 'non', prot: 2.2 });
assert(lean.secs.some(s => s.id === 'soir') && lean.prot.factor === PF_MAX && lean.tot.p >= lean.prot.floor - 0.5, 'skyr du soir de secours sans shaker');

// 18. Objectif de protéines en g/kg, à ± 10 % sur la journée : portions de viande, poisson, œufs et skyr ajustées au plus juste
assert(cleanProfile({}).prot === 2 && cleanProfile({ prot: 2.2 }).prot === 2.2 && cleanProfile({ prot: 1.6 }).prot === 1.6 && cleanProfile({ prot: 5 }).prot === 2 && cleanProfile({ prot: 1 }).prot === 2, 'bornes de l’objectif de protéines : 1,6 à 2,2');
// 3.11.1 : un objectif enregistré au-dessus de 2,2 (permis jusqu'à 3,0 avant) devient 2,2, pas la valeur par défaut
assert(cleanProfile({ prot: 2.4 }).prot === 2.2 && cleanProfile({ prot: 3 }).prot === 2.2 && profileFields({ prot: 2.6 }).prot === 2.2 && cleanProfile({ prot: 3.1 }).prot === 2, 'objectif enregistré au-dessus de 2,2');
near(protTarget(cleanProfile({})), 144, 1e-9, 'objectif par défaut : 2 × 72 kg');
near(protTarget(cleanProfile({ poids: 150, prot: 2 })), 2 * 72 * 1.4, 1e-9, 'objectif sur le poids borné');
const pday = (set, ch, x) => buildDay(day(set), ch || DEFAULT_CHOICES[1], x);
const pq = (r, sec, key) => r.secs.find(s => s.id === sec).items.find(i => i.key === key).qty;
// Chaque journée (toutes les journées types) : protéines dans la fourchette objectif ± 10 %, portions au plus près du menu de base
let npt = 0;
for (const prot of [1.8, 2, 2.2]) for (const [name, set] of Object.entries(SETS)) for (const p1 of PROT_ORDER) for (const p2 of PROT_ORDER) for (const [s1, s2] of [['riz', 'pdt'], ['pates', 'gnocchis'], ['lentilles', 'quinoa']]) {
  const r = pday(set, { pdBase: 'avoine', dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } }, { prot });
  const combo = `${prot} g/kg/${name}/${p1}+${s1}/${p2}+${s2}`;
  assert(protOk(r), `${combo} : ${Math.round(r.tot.p)} g (${Math.round(r.prot.low)} à ${Math.round(r.prot.high)}, facteur ${r.prot.factor.toFixed(2)})`);
  // Au plus près du menu de base : portions réduites → la journée reste au-dessus de l'objectif ; augmentées → en dessous
  if (r.prot.factor < 1 - 0.02 && r.prot.factor > PF_MIN + 0.02) assert(r.tot.p >= r.prot.target - 1, `${combo} : ${Math.round(r.tot.p)} g, portions réduites plus que nécessaire`);
  if (r.prot.factor > 1 + 0.02 && r.prot.factor < PF_MAX - 0.02) assert(r.tot.p <= r.prot.target + 1, `${combo} : ${Math.round(r.tot.p)} g, portions augmentées plus que nécessaire`);
  npt++;
}
assert.strictEqual(pday([], DEFAULT_CHOICES[4], { prot: 2.2 }).prot.factor, 1, 'dans la fourchette, le menu de base ne bouge pas');
assert.strictEqual(pq(pday([], DEFAULT_CHOICES[1]), 'dej', 'p1'), pq(buildDay(day([], { libre: true }), DEFAULT_CHOICES[1]), 'dej', 'p1'), 'portions changées par le repas libre');
// Plus d'objectif, plus de viande et moins de féculents ; le total du jour ne bouge pas
const p20 = pday([], undefined, { prot: 2 }), p26 = pday([], undefined, { prot: 2.2 });
assert(parseInt(pq(p26, 'dej', 'p1')) > parseInt(pq(p20, 'dej', 'p1')) && parseInt(pq(p26, 'pd', 'skyr')) > parseInt(pq(p20, 'pd', 'skyr')), 'objectif plus haut, portions plus grandes');
assert(starchKcal(p26)[0] < starchKcal(p20)[0], 'objectif plus haut, moins de féculents');
near(p26.tot.kcal, p20.tot.kcal, 30, 'total du jour indépendant de l’objectif de protéines');
// Valeurs de référence (lundi : poulet + riz, crevettes + quinoa ; 72 kg, 2 g/kg) : poulet 130 g, skyr 190 g
assert(pq(p20, 'dej', 'p1') === '130\u00a0g' && pq(p20, 'pd', 'skyr') === '190\u00a0g', `2 g/kg : poulet ${pq(p20, 'dej', 'p1')}, skyr ${pq(p20, 'pd', 'skyr')}`);

// 19. Desserts : pris sur le féculent du même repas, total du jour inchangé
// Menu de base de ces tests : riz et pâtes un jour sans séance, loin de leurs plafonds
const RIZ_PATES = { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz' }, diner: { prot: 'poisson', starch: 'pates' } };
const withDes = (dej, diner, base) => {
  const b = base || RIZ_PATES;
  return { pdBase: b.pdBase, dej: Object.assign({}, b.dej, { dessert: dej }), diner: Object.assign({}, b.diner, { dessert: diner }) };
};
const desOf = (r, id) => (r.secs.find(s => s.id === id) || { items: [] }).items.filter(i => i.key === 'des');
const DES_KCAL = { fruit: 80, compote: 60, fruitsSecs: 74, chocolat: 114 };
const desDay = day([]);
const sansDes = buildDay(desDay, RIZ_PATES);
assert.strictEqual(DESSERT_ORDER.join(), 'aucun,fruit,compote,fruitsSecs,chocolat', 'liste des desserts');
for (const d of ['fruit', 'compote', 'fruitsSecs', 'chocolat']) {
  const r = buildDay(desDay, withDes(d, 'aucun'));
  const l = desOf(r, 'dej');
  assert(l.length === 1 && Math.round(l[0].m.kcal) === DES_KCAL[d] && !desOf(r, 'diner').length, `${d} : ligne du dessert au déjeuner`);
  assert.strictEqual(r.secs.find(s => s.id === 'dej').items.slice(-1)[0].key, 'des', `${d} : le dessert termine le repas`);
  near(r.tot.kcal, sansDes.tot.kcal, 30, `${d} : total du jour inchangé`);
  const [a0, b0] = starchKcal(sansDes), [a1, b1] = starchKcal(r);
  near(a0 - a1, DES_KCAL[d], 20, `${d} : féculent du déjeuner diminué du dessert`);
  near(b1, b0, 20, `${d} : féculent du dîner inchangé`);
  const rd = buildDay(desDay, withDes('aucun', d));
  near(starchKcal(sansDes)[1] - starchKcal(rd)[1], DES_KCAL[d], 20, `${d} : féculent du dîner diminué du dessert`);
}
assert.strictEqual(desOf(buildDay(desDay, withDes('chocolat', 'fruit')), 'diner')[0].name, 'fruit', 'dessert du dîner');
assert(!buildDay(desDay, withDes('constructor', '__proto__')).secs.some(s => s.items.some(i => i.key === 'des')), 'dessert invalide ignoré');
assert(!buildDay(desDay, DEFAULT_CHOICES[3]).secs.some(s => s.items.some(i => i.key === 'des')), 'sans dessert enregistré : aucun');
// Séance à midi : le dessert choisi remplace la compote automatique du déjeuner
const midiDay = day([petite('midi')]);
const midiKeys = ch => buildDay(midiDay, ch).secs.find(s => s.id === 'dej').items.map(i => i.key).filter(k => k === 'comp' || k === 'des').join();
assert.strictEqual(midiKeys(withDes('aucun', 'aucun')), 'comp', 'séance à midi sans dessert : compote');
assert.strictEqual(midiKeys(withDes('fruit', 'aucun')), 'des', 'séance à midi : le dessert remplace la compote');
assert.strictEqual(midiKeys(withDes('aucun', 'chocolat')), 'comp', 'le dessert du dîner ne touche pas la compote de midi');
// Repas libre : pas de dessert au dîner
assert(!desOf(buildDay(day([], { libre: true }), withDes('aucun', 'chocolat')), 'diner').length, 'dessert affiché avec le repas libre');
// Garde-fous : 12 journées types × tous les couples de desserts × protéines variées (chaque protéine avec deux autres) × féculents variés
let nd = 0;
for (const [name, set] of Object.entries(SETS)) for (const d1 of DESSERT_ORDER) for (const d2 of DESSERT_ORDER) {
  for (const [i, p1] of PROT_ORDER.entries()) for (const p2 of [PROT_ORDER[(i + 1) % PROT_ORDER.length], PROT_ORDER[(i + 3) % PROT_ORDER.length], p1]) for (const [s1, s2] of [['riz', 'pdt'], ['lentilles', 'quinoa'], ['gnocchis', 'pates'], ['poischiches', 'boulgour']]) {
    const combo = `${name}/${d1}+${d2}/${p1}+${s1}/${p2}+${s2}`;
    const r = buildDay(day(set), { pdBase: 'avoine', dej: { prot: p1, starch: s1, dessert: d1 }, diner: { prot: p2, starch: s2, dessert: d2 } });
    const choco = [d1, d2].filter(d => d === 'chocolat').length * 8.4;
    assert(r.tot.p >= r.prot.floor - 0.5, `${combo} : ${Math.round(r.tot.p)} g de protéines`);
    assert(r.tot.f >= FAT_MIN && r.tot.f <= fatCap(r, 1) + choco, `${combo} : ${r.tot.f.toFixed(1)} g de lipides`);
    assert(r.ecart >= -r.energy.target * 0.03, `${combo} : ${Math.round(-r.ecart)} kcal sous l'objectif`);
    if (r.ecart > r.energy.target * 0.03) for (const kc of starchKcal(r)) assert(kc <= STARCH_MIN + 20, `${combo} : au-dessus de l'objectif sans être au plancher`);
    assert(starchOk(r, s1, s2, 1), `${combo} : féculents ${starchKcal(r).map(Math.round).join(' + ')} kcal`);
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

// Repères de la semaine (Santé publique France) : comptés sur les journées construites, repas libre exclu
const wd = (dej, diner, extra) => buildDay(day([], extra && extra.libre ? { libre: true } : {}), Object.assign({ pdBase: (extra && extra.pd) || 'avoine', dej: { prot: dej[0], starch: dej[1] }, diner: { prot: diner[0], starch: diner[1] } }));
const wk = weekBalance([wd(['saumon', 'riz'], ['poisson', 'lentilles']), wd(['thon', 'poischiches'], ['boeuf', 'pates'], { pd: 'sale' }), wd(['oeufs', 'riz'], ['saumon', 'riz'], { libre: true })]);
const g = (r, slot, key) => r.secs.find(x => x.id === slot).items.find(i => i.key === key);
const d2 = wd(['thon', 'poischiches'], ['boeuf', 'pates'], { pd: 'sale' }), d3 = wd(['oeufs', 'riz'], ['saumon', 'riz'], { libre: true });
assert.strictEqual(wk.poisson, 3, 'poisson : saumon, poisson blanc, thon (le saumon du repas libre ne compte pas)');
assert.strictEqual(wk.gras, 1, 'poisson gras');
assert.strictEqual(wk.legumes, 2, 'légumes secs : lentilles et pois chiches');
near(wk.rouge, g(d2, 'diner', 'p1').buy.g * 0.75, 1e-9, 'viande rouge : bœuf cru × 0,75');
near(wk.charcuterie, g(d2, 'pd', 'jambon').buy.g + g(d3, 'dej', 'p2').buy.g, 1e-9, 'charcuterie : jambon du salé et des « Œufs + jambon »');
assert.deepStrictEqual(plain(weekNeeds({ poisson: 2, gras: 1, legumes: 2, rouge: 500, charcuterie: 150 })), [], 'semaine équilibrée (limites comprises)');
assert.deepStrictEqual(plain(weekNeeds({ poisson: 0, gras: 0, legumes: 1, rouge: 501, charcuterie: 151 })), ['charcuterie', 'rouge', 'gras', 'poisson', 'legumes'], 'ordre des besoins');
assert.deepStrictEqual(plain(WEEK_GOALS), { poisson: 2, gras: 1, legumes: 2, rouge: 500, charcuterie: 150 }, 'repères');
// Tirage équilibré : jamais « Œufs + jambon » avec le salé ; bœuf et salé écartés si la semaine déborde ; poisson et légumes secs favorisés
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };
for (let i = 0; i < 400; i++) {
  const rnd = seq([(i * 0.618) % 1, (i * 0.377) % 1, (i * 0.123) % 1, (i * 0.851) % 1]);
  const c = randomChoices(rnd, []);
  if (c.pdBase === 'sale') assert(c.dej.prot !== 'oeufs' && c.diner.prot !== 'oeufs', 'œufs + jambon avec le salé');
  const full = randomChoices(seq([(i * 0.618) % 1, (i * 0.377) % 1]), [], { poisson: 2, gras: 1, legumes: 2, rouge: 480, charcuterie: 140 }, 1);
  assert(full.pdBase !== 'sale' && ![full.dej.prot, full.diner.prot].some(p => p === 'boeuf' || p === 'oeufs'), 'semaine pleine : ni bœuf, ni charcuterie en plus');
}
const count = (bal, test, n = 3000) => { let x = 0, s = 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < n; i++) if (test(randomChoices(rnd, [], bal, 1))) x++; return x / n; };
const fishOf = c => [c.dej.prot, c.diner.prot].filter(p => ['poisson', 'saumon', 'thon'].includes(p)).length;
const legOf = c => [c.dej.starch, c.diner.starch].filter(st => ['lentilles', 'poischiches'].includes(st)).length;
const empty = { poisson: 0, gras: 0, legumes: 0, rouge: 0, charcuterie: 0 }, done = { poisson: 2, gras: 1, legumes: 2, rouge: 0, charcuterie: 0 };
assert(count(empty, c => fishOf(c) > 0) > count(done, c => fishOf(c) > 0) + 0.2, 'poisson favorisé tant qu’il en manque');
assert(count(empty, c => c.dej.prot === 'saumon' || c.diner.prot === 'saumon') > count({ ...empty, gras: 1 }, c => c.dej.prot === 'saumon' || c.diner.prot === 'saumon') + 0.1, 'poisson gras favorisé tant qu’il manque');
assert(count(empty, c => legOf(c) > 0) > count(done, c => legOf(c) > 0) + 0.2, 'légumes secs favorisés tant qu’il en manque');
// Sans repère (bal absent) : tirage uniforme, comme avant ; aux bornes, premier et dernier choix proposés
assert.deepStrictEqual(plain(randomChoices(() => 0, [])), { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz', dessert: 'aucun', recette: 'poulet-riz' }, diner: { prot: 'boeuf', starch: 'riz', dessert: 'aucun', recette: 'boeuf-riz' } }, 'tirage au plus bas (recette choisie d’office)');
assert.deepStrictEqual(plain(randomChoices(() => 0.9999, [])), { pdBase: 'sale', dej: { prot: 'tofu', starch: 'gnocchis', dessert: 'chocolat', recette: 'tofu-gnocchis' }, diner: { prot: 'thon', starch: 'gnocchis', dessert: 'chocolat', recette: 'thon-gnocchis' } }, 'tirage au plus haut (salé : pas d’« Œufs + jambon »)');

// Semaine type (3.11.0) : séances habituelles par jour et soir du repas libre ; un jour pas encore rempli les reprend
const sem = cleanWeek({ jours: { 1: [petite('soir'), moyenne('matin')], 3: [longue(2.5), longue(3), petite('midi')], 5: [], 9: [petite('soir')], x: 1 }, libre: 0 });
assert.deepStrictEqual(plain(sem), { jours: { 1: [{ taille: 'petite', moment: 'soir' }, { taille: 'moyenne', moment: 'matin' }], 3: [{ taille: 'longue', moment: 'matin', duree: 2.5 }, { taille: 'petite', moment: 'midi' }] }, libre: 0 }, 'semaine type validée');
assert.deepStrictEqual(plain(cleanWeek(null)), { jours: {}, libre: 6 }, 'pas de semaine type');
assert.deepStrictEqual(plain(cleanWeek({ jours: 'x', libre: 7 })), { jours: {}, libre: 6 }, 'semaine type abîmée');
assert.strictEqual(cleanWeek({ libre: 2.5 }).libre, 6, 'repas libre : un jour entier');
assert.deepStrictEqual(plain(emptyPlan(1, sem)), { seances: [{ taille: 'petite', moment: 'soir' }, { taille: 'moyenne', moment: 'matin' }], libre: false }, 'lundi : séances de la semaine type');
assert(emptyPlan(0, sem).libre && !emptyPlan(6, sem).libre && emptyPlan(6).libre, 'repas libre : jour de la semaine type, samedi sans elle');
const e1 = emptyPlan(1, sem); e1.seances[0].moment = 'matin';
assert.strictEqual(sem.jours[1][0].moment, 'soir', 'la semaine type n’est pas modifiée par un jour');
// Ce qui est enregistré l'emporte, champ par champ ; sans semaine type, rien ne change (repos, samedi)
assert.deepStrictEqual(plain(cleanPlan({ ch: {} }, 1, sem)), plain(emptyPlan(1, sem)), 'jour avec des plats seulement : séances de la semaine type');
assert.deepStrictEqual(plain(cleanPlan({ seances: [] }, 1, sem).seances), [], 'repos enregistré : gardé');
assert.strictEqual(cleanPlan({ libre: false }, 0, sem).libre, false, 'repas libre retiré : gardé');
assert.deepStrictEqual(plain(cleanPlan({ libre: true }, 1, sem).seances), plain(sem.jours[1]), 'repas libre seul : séances de la semaine type');
assert.deepStrictEqual(plain(cleanPlan(undefined, 3)), { seances: [], libre: false }, 'sans semaine type : repos');
assert.deepStrictEqual(plain(cleanSeances([petite('matin'), { taille: 'x' }, longue(4), longue(2)])), [{ taille: 'petite', moment: 'matin' }, { taille: 'longue', moment: 'matin', duree: 2 }], 'séances validées');
// Profil : la semaine type n'est gardée que si elle diffère de celle par défaut
assert(!('semaine' in profileFields({ semaine: { jours: {}, libre: 6 } })) && profileFields({ semaine: { jours: {}, libre: 3 } }).semaine.libre === 3, 'semaine type dans le profil');
assert.deepStrictEqual(plain(cleanProfile({}).semaine), { jours: {}, libre: 6 }, 'semaine type par défaut');
// Les séances de la semaine type comptent dans la dépense du jour
assert(energy(emptyPlan(1, sem), cleanProfile({})).target > energy(emptyPlan(1), cleanProfile({})).target, 'séances de la semaine type comptées');

// 17. Recettes (3.12.0) : une par couple protéine × féculent ; choisie, ses légumes, sa matière grasse et ses ajouts remplacent la
// ligne « légumes » et la marge cuisine du repas, le féculent s'ajuste et le total du jour ne bouge pas
assert.strictEqual(Object.keys(RECIPES).length, 80, '80 recettes');
for (const p of PROT_ORDER) for (const st of STARCH_ORDER) {
  const ids = plain(recipesFor(p, st)), x = RECIPES[p + '-' + st];
  assert.deepStrictEqual(ids, [p + '-' + st], `recette de ${p} × ${st}`);
  assert(x.p === p && x.s === st && x.min > 0 && x.steps.length === 3 && x.t && x.aro, `recette ${p}-${st} complète`);
  assert.strictEqual(Object.values(x.leg).reduce((a, g) => a + g, 0), 250, `${p}-${st} : 250 g de légumes`);
  for (const v of Object.keys(x.leg)) assert(VEG_IDS.includes(v) && FOOD[v] && RFOOD[v], `${p}-${st} : légume ${v} connu`);
  for (const c of x.cuis) assert(FOOD[c[0]] && c[1] > 0 && c[2] && c[3], `${p}-${st} : matière grasse ${c[0]}`);
  assert(new Set(x.cuis.map(c => c[0])).size === x.cuis.length, `${p}-${st} : une ligne par matière grasse`);
  for (const a of Object.keys(x.plus)) assert(['skyr', 'miel'].includes(a) && x.plus[a] > 0, `${p}-${st} : ajout ${a}`);
  for (const t of [x.t, x.aro, ...x.steps, x.soir || ''].concat(x.cuis.map(c => c[3]))) {
    assert(!/ [:;?!%]/.test(t) && !/\d (g|min|ml|°C)\b/.test(t) && !/c\. à/.test(t) && !/'/.test(t), `typographie : ${t}`);
  }
}
// recipeOf : la recette doit aller avec la protéine et le féculent ; identifiants inconnus ou hérités refusés
assert.strictEqual(recipeOf({ prot: 'poulet', starch: 'riz', recette: 'poulet-riz' }), 'poulet-riz', 'recette valide');
for (const bad of [{ prot: 'poulet', starch: 'pates', recette: 'poulet-riz' }, { prot: 'boeuf', starch: 'riz', recette: 'poulet-riz' }, { prot: 'poulet', starch: 'riz', recette: 'x' },
  { prot: 'poulet', starch: 'riz', recette: '__proto__' }, { prot: 'poulet', starch: 'riz', recette: 'constructor' }, { prot: 'poulet', starch: 'riz', recette: 3 }, { prot: 'poulet', starch: 'riz' }, null]) {
  assert.strictEqual(recipeOf(bad), null, 'recette refusée : ' + JSON.stringify(bad));
}
const RC = { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz', recette: 'poulet-riz' }, diner: { prot: 'poulet', starch: 'pdt' } };
const RC0 = { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz' }, diner: { prot: 'poulet', starch: 'pdt' } };
for (const set of [[], [moyenne('soir')], [longue(2)]]) {
  const a = composeDay(day(set), RC, cleanProfile({}), 1), b = composeDay(day(set), RC0, cleanProfile({}), 1);
  const dj = a.secs.find(s => s.id === 'dej'), dn = a.secs.find(s => s.id === 'diner'), keys = dj.items.map(i => i.key);
  assert(!keys.includes('leg') && !keys.includes('marge') && dn.items.some(i => i.key === 'leg') && dn.items.some(i => i.key === 'marge'), 'recette : ni « légumes » ni marge au déjeuner, le dîner les garde');
  assert.deepStrictEqual(plain(keys.filter(k => /^[vfx]-/.test(k))), ['v-oignon', 'v-poivron', 'v-epinards', 'f-huile', 'f-coco', 'x-skyr'], 'lignes de la recette, dans l’ordre');
  const line = key => dj.items.find(i => i.key === key);
  assert(line('v-oignon').qty === '70 g' && line('v-oignon').name === 'oignon' && line('v-oignon').buy.id === 'oignon' && line('v-oignon').buy.g === 70, 'oignon');
  near(line('v-epinards').m.kcal, FOOD.epinards[0] * 0.8, 1e-9, 'épinards');
  assert(line('f-huile').qty === '5 g' && line('f-huile').note === '1 c. à café' && line('f-coco').qty === '15 g', 'matière grasse en grammes, mesure en note');
  near(line('f-coco').m.f, FOOD.coco[3] * 0.15, 1e-9, 'lait de coco');
  assert(line('x-skyr').qty === '40 g' && line('x-skyr').note === 'pour la sauce', 'skyr de la sauce');
  assert(dj.recipe === 'poulet-riz' && dj.suggest === 'poulet-riz' && dn.recipe === null && dn.suggest === 'poulet-pdt', 'recette choisie et suggestion');
  // À protéines fixes, le féculent du jour compense exactement ce que la recette change (arrondis)
  const fixedOf = r => total(r.secs.flatMap(s => s.items).filter(i => i.key !== 'st' && i.key !== 'encas')).kcal;
  near(starchKcal(b).reduce((x, y) => x + y) - starchKcal(a).reduce((x, y) => x + y), fixedOf(a) - fixedOf(b), 25, 'féculents ajustés à la recette');
  near(buildDay(day(set), RC).tot.kcal, buildDay(day(set), RC0).tot.kcal, 30, 'recette : total du jour inchangé');
}
// L'ajout du soir garde son rôle, avec la note de la recette
const amOf = c => buildDay(day([]), c).secs.find(s => s.id === 'diner').items.find(i => i.key === 'dam');
assert.strictEqual(amOf({ pdBase: 'avoine', dej: { prot: 'boeuf', starch: 'riz' }, diner: { prot: 'poulet', starch: 'riz', recette: 'poulet-riz' } }).note, 'effilées et grillées à sec, sur le curry', 'amandes : note de la recette');
assert.strictEqual(amOf({ pdBase: 'avoine', dej: { prot: 'boeuf', starch: 'riz' }, diner: { prot: 'poulet', starch: 'pdt', recette: 'poulet-pdt' } }).note, 'sur les légumes ou en fin de repas', 'amandes : note habituelle sans note de recette');
assert.strictEqual(buildDay(day([]), { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz' }, diner: { prot: 'boeuf', starch: 'riz', recette: 'boeuf-riz' } }).secs.find(s => s.id === 'diner').items.find(i => i.key === 'pm').note, 'râpé sur le chili, comme un cheddar', 'parmesan : note de la recette');
// Recette qui ne va plus (féculent changé) : ignorée, le repas reste comme avant
assert.deepStrictEqual(plain(buildDay(day([]), { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'pates', recette: 'poulet-riz' }, diner: RC0.diner })),
  plain(buildDay(day([]), { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'pates' }, diner: RC0.diner })), 'recette d’un autre féculent ignorée');
// Repas libre : le dîner (avec sa recette) est remplacé, ses lignes partent avec lui
const libR = buildDay(day([], { libre: true }), { pdBase: 'avoine', dej: RC0.dej, diner: { prot: 'poulet', starch: 'riz', recette: 'poulet-riz' } });
assert(libR.libre && !libR.secs.flatMap(s => s.items).some(i => /^[vfx]-/.test(i.key)), 'repas libre : plus de lignes de recette');
// Mémoire du jour de la semaine : la recette reste si sa protéine et son féculent restent proposés
assert.strictEqual(withAllowed({ pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz', recette: 'poulet-riz' }, diner: RC0.diner }, []).dej.recette, 'poulet-riz', 'recette gardée');
assert(!('recette' in withAllowed({ pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz', recette: 'poulet-riz' }, diner: RC0.diner }, ['starch:riz']).dej), 'féculent retiré : recette oubliée');
// Courses : les légumes et la matière grasse de la recette, chacun dans un rayon
const shopR = shoppingList([buildDay(day([]), RC)]), shopLine = id => shopR.flatMap(g => g.lines).find(l => l.id === id);
assert(shopLine('oignon').qty === '70 g' && shopLine('coco').qty === '15 g' && shopLine('huile').qty === '5 g', 'courses : oignon, lait de coco, huile');
const aisleIds = SHOP_AISLES.flatMap(g => g.ids);
for (const id of VEG_IDS.concat(['huile', 'coco', 'creme', 'lait', 'sesame', 'tahini', 'olives', 'parmesan'])) assert.strictEqual(aisleIds.filter(x => x === id).length, 1, `courses : ${id} dans un rayon`);
// Garde-fous avec les recettes : 12 journées types × 3 bases × les 80 recettes au déjeuner (dîner : une autre recette)
let nr = 0;
for (const [name, set] of Object.entries(SETS)) for (const pdBase of PD_ORDER) PROT_ORDER.forEach((p1, i) => STARCH_ORDER.forEach((s1, j) => {
  const p2 = PROT_ORDER[(i + j + 1) % 8], s2 = STARCH_ORDER[(j + 3) % 10];
  const c = { pdBase, dej: { prot: p1, starch: s1, recette: p1 + '-' + s1 }, diner: { prot: p2, starch: s2, recette: p2 + '-' + s2 } };
  const combo = `recettes/${name}/${pdBase}/${p1}-${s1}/${p2}-${s2}`, r = buildDay(day(set), c);
  assert(Math.abs(r.ecart) <= r.energy.target * 0.03, `${combo} : écart de ${Math.round(r.ecart)} kcal`);
  assert(protOk(r), `${combo} : ${Math.round(r.tot.p)} g de protéines`);
  assert(r.tot.f >= FAT_MIN - 0.5 && r.tot.f <= fatCap(r, 1) + 1, `${combo} : ${r.tot.f.toFixed(1)} g de lipides`);
  assert(starchOk(r, s1, s2, 1), `${combo} : féculents hors bornes`);
  nr++;
}));

// 18. Correctif 3.13.0 : le facteur de protéines va jusqu'à sa borne (œufs-jambon midi et soir : 2 œufs à 0,508, 1 à 0,5)
{
  const prof = { sexe: 'h', age: 23, taille: 220, poids: 71.2, neat: 'debout', prot: 1.8, ravito: 70 };
  const set = [moyenne('matin'), petite('midi'), longue(1.5)], c = { pdBase: 'avoine', dej: { prot: 'oeufs', starch: 'riz', dessert: 'chocolat' }, diner: { prot: 'oeufs', starch: 'pates', dessert: 'chocolat' } };
  const a = buildDay(cleanPlan({ seances: set, libre: false }, 3), c, prof), b = buildDay(cleanPlan({ seances: set, libre: false }, 3), c, { ...prof, prot: 1.9 });
  assert(a.prot.factor === PF_MIN && a.tot.p <= a.prot.high + 0.5, `œufs-jambon : facteur ${a.prot.factor}, ${Math.round(a.tot.p)} g pour ${Math.round(a.prot.high)} au plus`);
  assert(b.tot.p >= a.tot.p - 8, 'objectif plus haut, pas moins de protéines');
}

// 19. Batch cooking (3.13.0) : quelques recettes qui se gardent, répétées midi et soir, cuisinées la veille
const lcg = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const week = (len, libre) => Array.from({ length: len }, (_, i) => ({ libre: i === libre }));
let nb = 0;
for (const n of [3, 4, 5]) for (const k of [0.65, 1, 1.4]) for (let seed = 1; seed <= 40; seed++) {
  const days = week(7, 5), cs = batchChoices(days, n, [], k, lcg(seed)), combo = `batch ${n} recettes, k ${k}, graine ${seed}`;
  assert.strictEqual(cs.length, 7, combo + ' : un choix par jour');
  const served = [];
  cs.forEach((c, i) => {
    for (const slot of ['dej', 'diner']) assert(recipeOf(c[slot]) === c[slot].recette && RECIPES[c[slot].recette].box, `${combo} : recette qui se garde`);
    assert(c.dej.prot !== c.diner.prot, `${combo} : même protéine midi et soir le jour ${i}`);
    if (c.pdBase === 'sale') assert(c.dej.prot !== 'oeufs' && c.diner.prot !== 'oeufs', `${combo} : œufs-jambon avec le salé`);
    served.push({ i, id: c.dej.recette });
    if (!days[i].libre) served.push({ i, id: c.diner.recette });
  });
  const count = {};
  served.forEach(x => { count[x.id] = (count[x.id] || 0) + 1; });
  const counts = Object.values(count);
  assert(counts.length === n && Math.max(...counts) - Math.min(...counts) <= 1 && counts.reduce((a, x) => a + x, 0) === 13, `${combo} : ${JSON.stringify(count)}`);
  assert.strictEqual(new Set(Object.keys(count).map(id => RECIPES[id].p)).size, n, `${combo} : protéines différentes`);
  // Une recette qui se congèle mal est mangée dans les 3 premiers jours
  served.forEach(x => assert(RECIPES[x.id].gel || x.i < FRIDGE_DAYS, `${combo} : ${x.id} (se congèle mal) le jour ${x.i}`));
  // Repères de la semaine : viande rouge sous sa limite ; jambon par paquet, 0 ou 4 tranches (une par petit-déjeuner salé,
  // deux par boîte d'œufs-jambon), jamais de salé avec les œufs-jambon (3.17.0)
  const res = cs.map((c, i) => buildDay({ seances: [], libre: days[i].libre }, c, { poids: 72 * k }));
  const bal = weekBalance(res);
  const slicesH = cs.filter(c => c.pdBase === 'sale').length + 2 * cs.reduce((a, c, i) => a + [c.dej, c.diner].filter((m, j) => m.prot === 'oeufs' && !(j && days[i].libre)).length, 0);
  assert(bal.rouge <= 500.5 && [0, HAM_SLICES].includes(slicesH), `${combo} : ${JSON.stringify(bal)}, ${slicesH} tranches`);
  // Fiche : une recette par recette servie, boîtes = repas servis, totaux = somme des boîtes, frigo 3 jours après la veille
  const blocks = batchCook(res.map(r => ({ res: r })));
  assert(blocks.length === 1 && blocks[0].recipes.length === n, `${combo} : fiche`);
  for (const r of blocks[0].recipes) {
    assert.strictEqual(r.boxes.length, count[r.id], `${combo} : boîtes de ${r.id}`);
    r.boxes.forEach(b => assert.strictEqual(b.fridge, b.day + 1 <= FRIDGE_DAYS, `${combo} : frigo ou congélateur`));
    const st = res.flatMap(x => x.secs).filter(s => s.recipe === r.id && !s.libre).flatMap(s => s.items).filter(i => i.key === 'st').reduce((a, i) => a + i.buy.g, 0);
    const line = r.totals.find(t => t.id === RECIPES[r.id].s);
    assert.strictEqual(line.qty, st < 1000 ? st + ' g' : (Math.round(st / 10) / 100).toLocaleString('fr-FR') + ' kg', `${combo} : féculent à cuire`);
  }
  // Changer une recette (3.16.0) : chacune peut être remplacée ; la remplaçante prend toutes ses boîtes, rien d'autre ne
  // bouge, et les règles du batch tiennent (protéines, congélation, viande rouge et charcuterie)
  const bdays = cs.map((ch, i) => ({ ch, libre: days[i].libre }));
  for (const id of Object.keys(count)) {
    const opts = batchSwapOptions(bdays, id, [], k), sw = `${combo}, ${id}`;
    assert(opts.length > 0, `${sw} : aucune recette de remplacement`);
    const others = Object.keys(count).filter(x => x !== id);
    opts.forEach(x => assert(x !== id && RECIPES[x].box && !others.includes(x) && !others.some(o => RECIPES[o].p === RECIPES[x].p), `${sw} : ${x} proposée`));
    const same = opts.filter(x => RECIPES[x].p === RECIPES[id].p);
    assert.deepStrictEqual(opts.slice(0, same.length), same, `${sw} : même protéine d'abord`);
    const pickd = batchSwapPick(bdays, id, [], k, lcg(seed));
    assert(opts.includes(pickd) && pickd === batchSwapPick(bdays, id, [], k, lcg(seed)), `${sw} : au hasard`);
    for (const nid of new Set([opts[0], opts[opts.length - 1], pickd])) {
      const after = batchSwap(bdays, id, nid, []), x = RECIPES[nid], sn = `${sw} → ${nid}`;
      after.forEach((c, i) => {
        for (const slot of ['dej', 'diner']) {
          const was = cs[i][slot];
          if (was.recette === id) assert(c[slot].recette === nid && c[slot].prot === x.p && c[slot].starch === x.s && c[slot].dessert === was.dessert, `${sn} : repas remplacé`);
          else assert.deepStrictEqual(plain(c[slot]), plain(was), `${sn} : autre repas changé`);
        }
        if (!days[i].libre) assert(c.dej.prot !== c.diner.prot, `${sn} : même protéine midi et soir le jour ${i}`);
        if (c.pdBase === 'sale') assert(c.dej.prot !== 'oeufs' && c.diner.prot !== 'oeufs', `${sn} : œufs-jambon avec le salé`);
        assert(c.pdBase === cs[i].pdBase || (x.p === 'oeufs' && cs[i].pdBase === 'sale' && c.pdBase === 'avoine'), `${sn} : petit-déjeuner changé`);
        if (!x.gel) ['dej', 'diner'].forEach(slot => { if (cs[i][slot].recette === id && !(slot === 'diner' && days[i].libre)) assert(i < FRIDGE_DAYS, `${sn} : se congèle mal, le jour ${i}`); });
      });
      const meals = after.flatMap((c, i) => days[i].libre ? [c.dej] : [c.dej, c.diner]);
      const beef = meals.filter(m => m.prot === 'boeuf').length * Math.round(150 * k / 10) * 10 * 0.75;
      if (x.p === 'boeuf') assert(beef <= 500.5, `${sn} : viande rouge ${beef}`);
      if (x.p === 'oeufs') assert(count[id] === 2 && after.every(c => c.pdBase !== 'sale'), `${sn} : œufs-jambon, ${count[id]} boîtes`);
      const fiche = batchCook(after.map((c, i) => ({ res: buildDay({ seances: [], libre: days[i].libre }, c, { poids: 72 * k }) })))[0].recipes;
      assert(fiche.find(r => r.id === nid).boxes.length === count[id] && !fiche.some(r => r.id === id), `${sn} : boîtes de la remplaçante`);
    }
  }
  nb++;
}
// Même tirage, même résultat ; aliments retirés jamais proposés ; jour même : boîtes du 4e jour encore au frigo
assert.deepStrictEqual(plain(batchChoices(week(7, 5), 4, [], 1, lcg(9))), plain(batchChoices(week(7, 5), 4, [], 1, lcg(9))), 'batch reproductible');
const offB = ['prot:poulet', 'prot:boeuf', 'starch:riz', 'starch:pates'];
batchChoices(week(7, -1), 4, offB, 1, lcg(3)).forEach(c => ['dej', 'diner'].forEach(sl => assert(!['poulet', 'boeuf'].includes(c[sl].prot) && !['riz', 'pates'].includes(c[sl].starch), 'batch : aliment retiré')));
const resB = batchChoices(week(7, -1), 4, [], 1, lcg(5)).map(c => ({ res: buildDay({ seances: [], libre: false }, c) }));
assert(batchCook(resB, 0)[0].recipes.every(r => r.boxes.every(b => b.fridge === b.day <= FRIDGE_DAYS)), 'cuisiné le jour même : 3 jours de plus');
// Périodes courtes et longues : 2 jours → 2 recettes ; 10 jours → deux blocs, le second de 3 jours
const two = batchChoices(week(2, -1), 5, [], 1, lcg(2));
assert.strictEqual(new Set(two.flatMap(c => [c.dej.recette, c.diner.recette])).size, 2, '2 jours : 2 recettes');
const ten = batchChoices(week(10, -1), 4, [], 1, lcg(4)).map(c => ({ res: buildDay({ seances: [], libre: false }, c) }));
const tb = batchCook(ten);
assert(tb.length === 2 && tb[1].start === 7 && tb[1].recipes.reduce((a, r) => a + r.boxes.length, 0) === 6 && tb[1].recipes.every(r => r.boxes.every(b => b.fridge)), '10 jours : deux blocs');
// Recette servie une fois, ou qui ne se garde pas : pas dans la fiche
const once = buildDay(day([]), { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz', recette: 'poulet-riz' }, diner: { prot: 'poisson', starch: 'riz', recette: 'poisson-riz' } });
assert.deepStrictEqual(plain(batchCook([{ res: once }, { res: once }])).map(b => b.recipes.map(r => r.id)), [['poulet-riz']], 'papillote (ne se garde pas) hors de la fiche');
assert.deepStrictEqual(plain(batchCook([{ res: once }])), [], 'une seule fois : pas de batch');
// Changer une recette : aliments retirés jamais proposés ; plus rien de possible → liste vide, pas de tirage ; œufs-jambon
// à la place d'une recette servie un jour au petit-déjeuner salé → petit-déjeuner sucré (la première autre base proposée)
const offS = ['prot:poulet', 'prot:saumon', 'starch:riz', 'starch:quinoa'], wS = week(7, 5);
const csS = batchChoices(wS, 4, offS, 1, lcg(8)).map((ch, i) => ({ ch, libre: wS[i].libre }));
batchSwapOptions(csS, csS[0].ch.dej.recette, offS, 1).forEach(x => assert(!['poulet', 'saumon'].includes(RECIPES[x].p) && !['riz', 'quinoa'].includes(RECIPES[x].s), 'changer : aliment retiré proposé'));
const solo = ['prot:boeuf', 'prot:poisson', 'prot:saumon', 'prot:crevettes', 'prot:oeufs', 'prot:thon', 'prot:tofu', 'starch:pates', 'starch:pdt', 'starch:patate', 'starch:quinoa', 'starch:semoule', 'starch:boulgour', 'starch:lentilles', 'starch:poischiches', 'starch:gnocchis'];
const dSolo = [0, 1].map(() => ({ ch: { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz', recette: 'poulet-riz' }, diner: { prot: 'poulet', starch: 'riz', recette: 'poulet-riz' } }, libre: false }));
assert(batchSwapOptions(dSolo, 'poulet-riz', solo, 1).length === 0 && batchSwapPick(dSolo, 'poulet-riz', solo, 1, lcg(1)) === null, 'changer : rien de possible');
const dSale = [{ ch: { pdBase: 'sale', dej: { prot: 'tofu', starch: 'riz', recette: 'tofu-riz', dessert: 'fruit' }, diner: { prot: 'poisson', starch: 'pates', recette: 'poisson-pates' } }, libre: false },
  { ch: { pdBase: 'sale', dej: { prot: 'poisson', starch: 'pates', recette: 'poisson-pates' }, diner: { prot: 'tofu', starch: 'riz', recette: 'tofu-riz', g: 150 } }, libre: false },
  { ch: { pdBase: 'sale', dej: { prot: 'poulet', starch: 'pdt', recette: 'poulet-pdt' }, diner: { prot: 'thon', starch: 'pates' } }, libre: false }];
assert(batchSwapOptions(dSale, 'tofu-riz', [], 1).includes('oeufs-riz'), 'changer : œufs-jambon possible pour 2 boîtes');
const sw2 = batchSwap(dSale, 'tofu-riz', 'oeufs-riz', []);
assert(sw2.every(c => c.pdBase === 'avoine') && sw2[0].dej.dessert === 'fruit' && sw2[0].diner.recette === 'poisson-pates' && !('g' in sw2[1].diner), 'changer : œufs-jambon (4 tranches), plus de salé dans le bloc, poids fixés oubliés, le reste gardé');
assert(batchSwap(dSale, 'tofu-riz', 'oeufs-riz', ['pd:avoine'])[0].pdBase === 'pain', 'changer : avoine retirée → pain');
// Œufs-jambon pour 3 boîtes : 6 tranches, pas proposé ; ni s'il ne reste que le salé
const dSale3 = dSale.slice(0, 2).concat([{ ch: { pdBase: 'avoine', dej: { prot: 'tofu', starch: 'riz', recette: 'tofu-riz' }, diner: { prot: 'poulet', starch: 'pdt', recette: 'poulet-pdt' } }, libre: false }]);
assert(!batchSwapOptions(dSale3, 'tofu-riz', [], 1).some(x => RECIPES[x].p === 'oeufs') && batchSwapOptions(dSale3, 'tofu-riz', [], 1).length > 0, 'changer : œufs-jambon pour 3 boîtes');
assert(!batchSwapOptions(dSale, 'tofu-riz', ['pd:avoine', 'pd:pain'], 1).some(x => RECIPES[x].p === 'oeufs'), 'changer : œufs-jambon sans autre base que le salé');

// 20. Batch cooking, chiffres ronds (3.17.0) : poids fixés d'une boîte (g, g2) et arrondi aux 100 g par recette
{
  const base = { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz', recette: 'poulet-riz' }, diner: { prot: 'poisson', starch: 'pates', recette: 'poisson-pates' } };
  const withG = (slot, f) => { const c = plain(base); Object.assign(c[slot], f); return c; };
  const p1 = (r, slot, key) => r.secs.find(s => s.id === slot).items.find(i => i.key === (key || 'p1'));
  const r0 = buildDay(day([]), base), r1 = buildDay(day([]), withG('dej', { g: 170 }));
  assert(p1(r1, 'dej').qty === '170 g' && !p1(r1, 'dej').adj && p1(r0, 'dej').adj, 'poids fixé : la ligne, pas ajustée');
  assert(Math.abs(r1.tot.kcal - r0.tot.kcal) <= 0.03 * r0.energy.target, 'poids fixé : le féculent compense');
  // Ignoré : sans recette, au mauvais pas, hors bornes, pas un nombre, protéine qui ne se pèse pas
  [{ g: 175 }, { g: 0 }, { g: -10 }, { g: 2000 }, { g: '170' }, { g: null }].forEach(f => assert(p1(buildDay(day([]), withG('dej', f)), 'dej').adj, 'poids fixé invalide : ' + JSON.stringify(f)));
  const noRec = plain(base); delete noRec.dej.recette; noRec.dej.g = 170;
  assert(p1(buildDay(day([]), noRec), 'dej').adj && fixedGrams(noRec.dej) === null, 'poids fixé sans recette ignoré');
  assert(fixedGrams({ prot: 'thon', starch: 'riz', recette: 'thon-riz', g: 100 }) === null, 'thon : boîtes, pas de poids fixé');
  const cr = buildDay(day([]), Object.assign(plain(base), { dej: { prot: 'crevettes', starch: 'riz', recette: 'crevettes-riz', g: 130, g2: 55 } }));
  assert(p1(cr, 'dej').qty === '130 g' && p1(cr, 'dej', 'p2').qty === '55 g' && !p1(cr, 'dej', 'p2').adj, 'crevettes et halloumi fixés');
  const oe = buildDay(day([]), Object.assign(plain(base), { dej: { prot: 'oeufs', starch: 'riz', recette: 'oeufs-riz', g: 3, g2: 90 } }));
  assert(p1(oe, 'dej', 'p2').qty === '90 g' && !p1(oe, 'dej', 'p2').adj && p1(oe, 'dej').adj && /^2 tranches$/.test(p1(oe, 'dej', 'p2').note), 'œufs-jambon : jambon fixé, œufs à l’unité');
  // Arrondi sur des semaines tirées au hasard, séances variées : un chiffre rond par recette (sauf garde-fous), le reste
  // inchangé, protéines et énergie jamais plus loin de leur cible, bœuf sous 500 g cuits ; déjà arrondi : ne bouge plus
  const PL = [[], [{ taille: 'petite', moment: 'soir' }], [{ taille: 'moyenne', moment: 'matin' }], [{ taille: 'longue', moment: 'matin', duree: 2 }], [{ taille: 'petite', moment: 'midi' }, { taille: 'moyenne', moment: 'soir' }]];
  const strip = c => JSON.stringify(c, (key, v) => key === 'g' || key === 'g2' ? undefined : v);
  const off3 = r => Math.abs(r.tot.kcal - r.energy.target) / r.energy.target;
  const band = r => Math.max(0, r.prot.low - r.tot.p, r.tot.p - r.prot.high);
  let elig = 0, done = 0;
  for (const n of [3, 4, 5]) for (const k of [0.65, 1, 1.4]) for (let seed = 1; seed <= 12; seed++) {
    const rr = lcg(seed * 7), combo = `arrondi ${n} recettes, k ${k}, graine ${seed}`;
    const plans = Array.from({ length: 7 }, (_, i) => cleanPlan({ seances: PL[Math.floor(rr() * PL.length)], libre: i === 5 }, i));
    const cs = batchChoices(plans.map(p => ({ libre: p.libre, long: p.seances.some(x => x.taille === 'longue') })), n, [], k, rr);
    const prof = { poids: 72 * k, prot: [1.8, 2, 2.2][seed % 3] };
    const out = batchRound(plans.map((plan, i) => ({ plan, ch: cs[i] })), prof);
    out.forEach((c, i) => assert.strictEqual(strip(c), strip(cs[i]), `${combo} : jour ${i} changé`));
    const res = out.map((c, i) => buildDay(plans[i], c, prof)), nat = cs.map((c, i) => buildDay(plans[i], c, prof));
    const nrm = (chs, i) => buildDay(Object.assign({}, plans[i], { libre: false }), chs[i], prof);
    out.forEach((c, i) => {
      const a = nrm(out, i), b = nrm(cs, i);
      assert(band(a) <= band(b) + 1e-9 && off3(a) <= Math.max(0.03, off3(b)) + 1e-9, `${combo} : jour ${i}, protéines ${Math.round(a.tot.p)} (${Math.round(b.tot.p)}) ou énergie ${(off3(a) * 100).toFixed(1)} %`);
    });
    const beef = rs => rs.reduce((t, r) => t + r.secs.filter(s => !s.libre).flatMap(s => s.items).filter(i => i.buy && i.buy.id === 'boeuf').reduce((a, i) => a + i.buy.g, 0), 0) * 0.75;
    assert(beef(res) <= Math.max(500.5, beef(nat)), `${combo} : bœuf ${beef(res)}`);
    const fiche = batchCook(res.map(r => ({ res: r })))[0];
    (fiche ? fiche.recipes : []).forEach(rc => {
      const x = RECIPES[rc.id], mine = out.flatMap((c, i) => ['dej', 'diner'].filter(sl => c[sl].recette === rc.id && !(sl === 'diner' && plans[i].libre)).map(sl => c[sl]));
      if (x.p === 'oeufs') return assert(mine.every(m => m.g2 === Math.round(90 * k / 5) * 5 && !('g' in m)), `${combo} : jambon des œufs-jambon`);
      if (!BATCH_GRAMS[x.p]) return assert(mine.every(m => !('g' in m) && !('g2' in m)), `${combo} : ${rc.id} sans poids fixé`);
      elig++;
      const tot = id => { const t = rc.totals.find(z => z.id === id); return Number(t.qty.replace(/[^\d,]/g, '').replace(',', '.')) * (/kg/.test(t.qty) ? 1000 : 1); };
      if (mine.every(m => 'g' in m)) { done++; assert(tot(x.p) % 100 === 0, `${combo} : ${rc.id} ${tot(x.p)} g`); }
      if (x.p === 'crevettes' && mine.every(m => 'g2' in m)) assert(tot('halloumi') % 100 === 0, `${combo} : halloumi ${tot('halloumi')} g`);
      assert(mine.every(m => 'g' in m) || mine.every(m => !('g' in m)), `${combo} : ${rc.id} arrondie en partie`);
    });
    assert.strictEqual(JSON.stringify(batchRound(plans.map((plan, i) => ({ plan, ch: out[i] })), prof)), JSON.stringify(out), `${combo} : déjà arrondi, ne bouge plus`);
    // Après un changement de recette : seule la nouvelle est arrondie, les autres gardent leurs poids
    const days = out.map((ch, i) => ({ ch, libre: plans[i].libre })), id = out[0].dej.recette, opts = batchSwapOptions(days, id, [], k);
    if (opts.length) {
      const nid = opts[opts.length - 1], sw = batchRound(batchSwap(days, id, nid, []).map((ch, i) => ({ plan: plans[i], ch })), prof);
      sw.forEach((c, i) => ['dej', 'diner'].forEach(sl => {
        const was = out[i][sl];
        if (was.recette === id) return;
        assert(strip(c[sl]) === strip(was) && (!('g' in was) || c[sl].g === was.g) && (!('g2' in was) || c[sl].g2 === was.g2), `${combo} : autre recette changée`);
      }));
    }
  }
  assert(done >= elig * 0.95, `arrondi : ${done} recettes sur ${elig}`);
}

console.log(`moteur OK (${n} combinaisons vérifiées, ${nf} pour d'autres corpulences, ${nd} avec desserts, ${npt} objectifs de protéines, ${nr} avec recettes, ${nb} semaines en batch cooking)`);
