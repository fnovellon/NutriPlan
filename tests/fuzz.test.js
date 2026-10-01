// Tests de fond du moteur : des milliers de journées tirées au hasard (profils, séances, choix de repas), chacune
// vérifiée contre les règles de CLAUDE.md et recalculée à la main. Reproductible : graine fixe.
// Plus fort : FUZZ=10 npm test, ou npm run test:deep. Autre graine : SEED=123 npm test.
const assert = require('assert');
const { loadEngine, rng, settings, checker } = require('./lib');

const A = loadEngine();
const { factor, seed } = settings(20260928);
const R = rng(seed);
const C = checker('fond du moteur');
const NB = ' ';
const N = Math.round(3000 * factor);

// --- Tirages -------------------------------------------------------------------------------------------------------
const PR = A.PROFILE_RANGES;
function randProfile(){
  const p = {};
  if (R.chance(.5)) p.mode = R.pick(['auto', 'manuel']);
  if (R.chance(.7)) p.sexe = R.pick(['h', 'f']);
  if (R.chance(.8)) p.age = R.int(PR.age[0], PR.age[1]);
  if (R.chance(.8)) p.taille = R.int(PR.taille[0], PR.taille[1]);
  // Poids : surtout des corpulences courantes, parfois les extrêmes des bornes
  if (R.chance(.9)) p.poids = R.chance(.8) ? R.between(45, 110, 0.1) : R.between(PR.poids[0], PR.poids[1], 0.1);
  if (R.chance(.3)) p.gras = R.between(PR.gras[0], PR.gras[1], 0.5);
  if (R.chance(.3)) p.repos = R.int(PR.repos[0], PR.repos[1]);
  if (R.chance(.6)) p.neat = R.pick(['assis', 'mixte', 'debout']);
  if (R.chance(.7)) p.deficit = R.int(0, 25);
  if (R.chance(.5)) p.prot = R.between(1.6, 3, 0.1);
  if (R.chance(.4)) p.ravito = R.between(30, 90, 5);
  if (R.chance(.4)) p.shaker = R.pick(['oui', 'non']);
  if (R.chance(.3)){ p.shakerKcal = R.int(100, 160); p.shakerProt = R.between(10, 40, 0.5); }
  if (R.chance(.2)) p.kcalPetite = R.between(100, 1000, 10);
  if (R.chance(.2)) p.kcalMoyenne = R.between(150, 1500, 10);
  if (R.chance(.2)) p.kcalLongueH = R.between(200, 1200, 10);
  if (R.chance(.5)) p.marge = R.between(0, 300, 25);
  return p;
}
function randPlan(js, libre){
  const s = [];
  for (let i = R.int(0, 5); i > 0; i--) s.push({ taille: R.pick(['petite', 'moyenne', 'longue']), moment: R.pick(['matin', 'midi', 'soir']), duree: R.pick([1.5, 2, 2.5, 3]) });
  return A.cleanPlan({ seances: s, libre: libre === undefined ? R.chance(.15) : libre }, js);
}
const slot = () => ({ prot: R.pick(A.PROT_ORDER), starch: R.pick(A.STARCH_ORDER), dessert: R.pick(A.DESSERT_ORDER) });
const randChoices = () => ({ pdBase: R.pick(['avoine', 'pain']), dej: slot(), diner: slot() });
const copy = x => JSON.parse(JSON.stringify(x));

// --- Aides ---------------------------------------------------------------------------------------------------------
const near = (a, b, t) => Math.abs(a - b) <= t;
const fin = x => typeof x === 'number' && isFinite(x);
const sum = items => items.reduce((a, x) => ({ kcal: a.kcal + x.m.kcal, p: a.p + x.m.p, c: a.c + x.m.c, f: a.f + x.m.f }), { kcal: 0, p: 0, c: 0, f: 0 });
const sec = (r, id) => r.secs.find(s => s.id === id);
const starchOf = (r, id) => sec(r, id).items.find(x => x.key === 'st');
// Féculent au plancher (à un pas d'arrondi près) dans l'un des deux repas
const atFloor = (r, ch) => ['dej', 'diner'].some(id => {
  const s = sec(r, id); if (s.libre) return false;
  const S = A.STARCH[ch[id].starch];
  return starchOf(r, id).m.kcal <= A.STARCH_MIN * r.scale + S.f[0] * S.step / 100 + 0.01;
});
// Les deux féculents à leur plafond (à un pas près) : le reste va à l'encas, affiché seulement à partir de 30 kcal
const atCap = (r, ch) => ['dej', 'diner'].every(id => {
  const s = sec(r, id); if (s.libre) return true;
  const S = A.STARCH[ch[id].starch];
  return starchOf(r, id).m.kcal >= A.starchCap(ch[id].starch, r.scale) - S.f[0] * S.step / 100 - 0.01;
});
// Journée qui ne peut pas tomber pile sur l'objectif : féculent au plancher, ou les deux au plafond
const limited = (r, ch) => atFloor(r, ch) || atCap(r, ch);
const qtys = s => s.items.map(x => x.qty + ' ' + x.name).join(' | ');

// Aliment affiché → valeurs de la table (quantité en grammes ou en pièces)
const BYNAME = {
  'viande blanche maigre': ['food', 'poulet'], ['bœuf haché 5' + NB + '%']: ['food', 'boeuf'], 'poisson blanc': ['food', 'poisson'],
  'poisson gras': ['food', 'saumon'], 'tofu ferme': ['food', 'tofu'], 'fruits secs': ['food', 'fruitsSecs'], 'crevettes cuites': ['food', 'crevettes'], 'halloumi': ['food', 'halloumi'],
  'jambon blanc': ['food', 'jambon'], 'parmesan': ['food', 'parmesan'], 'skyr nature': ['food', 'skyr'],
  'flocons d’avoine': ['food', 'avoine'], 'pain complet': ['food', 'pain'], 'fruits rouges': ['food', 'fruitsRouges'],
  'amandes': ['food', 'amandes'], 'miel': ['food', 'miel'], 'légumes': ['food', 'legumes'], 'huile d’olive': ['food', 'huile'],
  'chocolat noir': ['food', 'chocolat'],
  'œufs': ['unit', 'oeuf'], 'œuf': ['unit', 'oeuf'], 'œuf dur': ['unit', 'oeuf'], 'œufs marinés': ['unit', 'oeufMarine'], 'œuf mariné': ['unit', 'oeufMarine'], 'banane': ['unit', 'banane'],
  'pomme': ['unit', 'pomme'], 'fruit': ['unit', 'pomme'], 'compote': ['unit', 'compote']
};
const YIELD = { 'viande blanche maigre': 0.75, ['bœuf haché 5' + NB + '%']: 0.75, 'poisson blanc': 0.8, 'poisson gras': 0.8 };
// Valeurs attendues d'une ligne d'après sa quantité affichée ; null si la ligne n'est pas un aliment connu
function expected(item, pr){
  const g = /^(\d+) g$/.exec(item.qty), n = /^(\d+)$/.exec(item.qty), bud = /^≈ ([\d  ]+)$/.exec(item.qty);
  const src = BYNAME[item.name];
  const st = A.STARCH_ORDER.find(id => A.STARCH[id].name === item.name);
  if (src && src[0] === 'food' && g) return A.FOOD[src[1]].map(v => v * g[1] / 100);
  if (src && src[0] === 'unit' && n) return A.UNIT[src[1]].map(v => v * n[1]);
  if (st && g) return A.STARCH[st].f.map(v => v * g[1] / 100);
  if (item.name === 'boîte de thon au naturel' && item.qty === '1') return A.FOOD.thon.map(v => v * 1.1);
  if (item.name === 'avocat' && item.qty === '½') return A.FOOD.avocat.map(v => v * 0.7);
  // Shaker : protéines saisies (au plus kcal / 4), le reste des kcal à parts égales entre glucides et lipides
  if (item.name === 'shaker de protéines' && item.qty === '1'){ const p = Math.min(pr.shakerProt, pr.shakerKcal / 4), rest = pr.shakerKcal - 4 * p; return [pr.shakerKcal, p, rest / 8, rest / 18]; }
  if (item.name === 'glucides pendant l’effort' && g) return [4 * g[1], 0, +g[1], 0];
  if (item.name === 'kcal pour la cuisine' && bud){ const k = +bud[1].replace(/\D/g, ''); return [k, 0, 0, k / 9]; }
  if (item.name === 'kcal d’encas' && bud){ const k = +bud[1].replace(/\D/g, ''); return [k, 0, k / 4, 0]; }
  if (item.name === 'kcal environ' && /^[\d  ]+$/.test(item.qty)){ const k = +item.qty.replace(/\D/g, ''); return [k, 0, 0, 0]; }
  return null;
}
// Dépense recalculée à la main (CLAUDE.md, « Dépense et objectif »)
function handEnergy(pr, plan){
  const manual = pr.mode === 'manuel' && pr.repos !== null;
  const bmr = pr.gras !== null ? 500 + 22 * pr.poids * (1 - pr.gras / 100) : 10 * pr.poids + 6.25 * pr.taille - 5 * pr.age + (pr.sexe === 'f' ? -161 : 5);
  const rest = manual ? pr.repos : bmr * { assis: 1.4, mixte: 1.55, debout: 1.7 }[pr.neat];
  const cost = plan.seances.reduce((a, x) => a + (x.taille === 'petite' ? (pr.kcalPetite !== null ? pr.kcalPetite : 4 * pr.poids)
    : x.taille === 'moyenne' ? (pr.kcalMoyenne !== null ? pr.kcalMoyenne : 6.3 * pr.poids)
    : (pr.kcalLongueH !== null ? pr.kcalLongueH : 7 * pr.poids) * x.duree), 0);
  const deficit = rest * pr.deficit / 100;
  return { rest, cost, deficit, target: Math.round((rest + cost - deficit) / 10) * 10, kgWeek: deficit * 7 / 7700 };
}

// --- A. Journées au hasard : chaque règle vérifiée -----------------------------------------------------------------
for (let i = 0; i < N; i++){
  const js = R.int(0, 6), prof = randProfile(), plan = randPlan(js), ch = randChoices();
  const input = JSON.stringify([prof, plan, ch]), cas = () => input;
  let r;
  try { r = A.buildDay(plan, ch, prof); } catch (e){ C.ok(false, 'exception', e.message + ' ' + input); continue; }
  C.ok(JSON.stringify([prof, plan, ch]) === input, 'entrée modifiée par buildDay', cas);
  const pr = A.cleanProfile(prof), k = A.scaleOf(pr), T = r.energy.target;
  const items = r.secs.flatMap(s => s.items);
  const long = plan.seances.some(x => x.taille === 'longue'), grosse = plan.seances.some(x => x.taille !== 'petite');
  const ids = r.secs.map(s => s.id);

  // Nombres, totaux, textes
  items.forEach(x => C.ok(x.m && [x.m.kcal, x.m.p, x.m.c, x.m.f].every(v => fin(v) && v >= 0), 'macros invalides', () => x.name + ' ' + JSON.stringify(x.m) + ' ' + input));
  const t = sum(items);
  ['kcal', 'p', 'c', 'f'].forEach(key => C.ok(near(t[key], r.tot[key], 1e-6), 'total ≠ somme des lignes', () => key + ' ' + input));
  C.ok(near(r.scale, Math.min(1.4, Math.max(0.65, pr.poids / 72)), 1e-12), 'facteur de portions', cas);
  items.forEach(x => {
    C.ok(typeof x.qty === 'string' && x.qty.length > 0, 'quantité vide', () => x.name + ' ' + input);
    [x.qty, x.name, x.note || ''].forEach(txt => {
      C.ok(!/NaN|undefined|null|Infinity|\[object/.test(txt), 'texte cassé', () => txt);
      C.ok(!/\d (g|kcal|km|%|h)\b/.test(txt) && !/ [:;?!%]/.test(txt), 'espace normale avant une unité ou : ; ? ! %', () => JSON.stringify(txt));
      C.ok(!/'/.test(txt), 'apostrophe droite', () => txt);
    });
    C.ok(/^(\d+ g|\d+|½|≈ [\d  ]+|[\d  ]+)$/.test(x.qty), 'format de quantité', () => JSON.stringify(x.qty) + ' ' + x.name);
  });

  // Quantité affichée ↔ valeurs comptées (table des aliments), poids cuits
  items.forEach(x => {
    const exp = expected(x, pr);
    if (!C.ok(exp !== null, 'ligne inconnue du test (à ajouter dans BYNAME ou expected)', () => x.qty + ' ' + x.name)) return;
    C.ok([x.m.kcal, x.m.p, x.m.c, x.m.f].every((v, j) => near(v, exp[j], 1e-6)), 'valeurs ≠ quantité affichée',
      () => x.qty + ' ' + x.name + ' : ' + [x.m.kcal, x.m.p, x.m.c, x.m.f].map(v => v.toFixed(1)) + ' au lieu de ' + exp.map(v => v.toFixed(1)));
    const g = parseInt(x.qty, 10), st = A.STARCH_ORDER.find(id => A.STARCH[id].name === x.name);
    if (YIELD[x.name]) C.ok(x.cook && x.cook.raw === 'cru' && x.cook.ways.length === 1 && x.cook.ways[0].g === Math.round(g * YIELD[x.name] / 5) * 5, 'poids cuit de la viande', () => x.qty + ' ' + x.name + ' ' + JSON.stringify(x.cook));
    if (st){
      const ways = A.STARCH[st].cook || [];
      C.ok((x.cook ? x.cook.ways.length : 0) === ways.length && ways.every((w, j) => x.cook.ways[j].g === Math.round(g * w[0] / 10) * 10 && x.cook.ways[j].adj === w[1]),
        'poids cuit du féculent', () => x.qty + ' ' + x.name + ' ' + JSON.stringify(x.cook));
    }
  });

  // Remplacements proposés en note (« ou 25 g d’amandes ») : à 15 % près de l'énergie de la ligne ; accords au singulier
  items.forEach(x => {
    const sw = /^ou (\d+)\u00A0g d(?:’|e )(amandes|parmesan)$/.exec(x.note || '');
    if (sw) C.ok(near(A.FOOD[sw[2]][0] * sw[1] / 100, x.m.kcal, 0.15 * x.m.kcal), 'remplacement pas équivalent', () => x.qty + ' ' + x.name + ' ' + x.note + ' (' + Math.round(x.m.kcal) + ' kcal)');
    if (x.qty === '1') C.ok(!/^(œufs|bananes|pommes|compotes|boîtes) /.test(x.name + ' '), 'pluriel après 1', () => x.qty + ' ' + x.name);
  });

  // Dépense et objectif recalculés à la main
  const h = handEnergy(pr, plan);
  C.ok(near(r.energy.rest, h.rest, 1e-6) && near(r.energy.cost, h.cost, 1e-6) && near(r.energy.deficit, h.deficit, 1e-6) && r.energy.target === h.target && near(r.energy.kgWeek, h.kgWeek, 1e-9),
    'dépense ≠ calcul à la main', () => JSON.stringify([r.energy, h]) + ' ' + input);
  if (!plan.libre) C.ok(near(r.ecart, r.tot.kcal - T, 1e-6), 'écart ≠ apport − objectif', cas);

  // Objectif : ±3 %, au-dessus seulement si un féculent est au plancher (aussi le jour du repas libre : journée normale)
  C.ok(r.ecart >= -0.03 * T, 'apport plus de 3 % sous l’objectif', () => Math.round(r.ecart) + ' / ' + T + ' ' + input);
  if (!plan.libre) C.ok(r.ecart <= 0.03 * T || atFloor(r, ch), 'apport au-dessus de l’objectif sans féculent au plancher', () => Math.round(r.ecart) + ' / ' + T + ' ' + input);

  // Protéines : dans la fourchette ; en dessous seulement si tout est au maximum (portions, skyr du soir), et la page le dit
  const soir = sec(r, 'soir');
  if (!plan.libre){
    const P = r.tot.p;
    C.ok(P >= r.prot.low - 0.5 || (r.prot.factor >= A.PF_MAX - 0.02 && soir && soir.items[0].qty === A.sc(300, 10, k) + NB + 'g'),
      'protéines sous la fourchette sans être au maximum', () => Math.round(P) + ' < ' + Math.round(r.prot.low) + ' pf ' + r.prot.factor.toFixed(2) + ' ' + input);
    C.ok(P <= r.prot.high + 0.03 * r.prot.target || r.prot.factor <= A.PF_MIN + 0.02,
      'protéines au-dessus de la fourchette sans portions au minimum', () => Math.round(P) + ' > ' + Math.round(r.prot.high) + ' pf ' + r.prot.factor.toFixed(2) + ' ' + input);
    C.ok(near(r.prot.target, pr.prot * 72 * k, 1e-9) && near(r.prot.low, 0.9 * r.prot.target, 1e-9) && near(r.prot.high, 1.1 * r.prot.target, 1e-9), 'fourchette de protéines', cas);
    C.ok(r.prot.factor >= A.PF_MIN - 1e-9 && r.prot.factor <= A.PF_MAX + 1e-9, 'facteur de protéines hors bornes', cas);
    // Skyr du soir : seulement s'il manque des protéines sans lui
    if (soir) C.ok(r.tot.p - soir.items[0].m.p < r.prot.low + 0.5, 'skyr du soir inutile', () => Math.round(r.tot.p) + ' ' + input);
  }
  // Skyr du petit-déjeuner et du goûter : jamais sous 100 g
  items.filter(x => x.name === 'skyr nature').forEach(x => C.ok(parseInt(x.qty, 10) >= 100, 'skyr sous 100 g', () => x.qty + ' ' + input));

  // Lipides : plancher toujours ; plafond (+ 8,4 g par chocolat) avec une marge cuisine d'au plus 150 kcal et un objectif
  // de protéines dans la fourchette conseillée (jusqu'à 2,4 g/kg, 47 kg et plus : au-delà, saumon, œufs ou halloumi
  // augmentés peuvent le dépasser d'environ 15 %), sauf si les féculents sont déjà au plancher (la page le dit)
  if (!plan.libre){
    C.ok(r.tot.f >= A.FAT_MIN * k - 0.5, 'lipides sous le plancher', () => r.tot.f.toFixed(1) + ' < ' + (A.FAT_MIN * k).toFixed(1) + ' ' + input);
    const choc = ['dej', 'diner'].filter(id => ch[id].dessert === 'chocolat').length;
    const huile = items.find(x => x.key === 'gras');
    if (pr.marge <= 150 && pr.prot <= 2.4 && pr.poids >= 47 && !atFloor(r, ch)) C.ok(r.tot.f <= Math.max(A.FAT_MAX * k, 0.35 * T / 9) + 8.4 * choc + 0.5, 'lipides au-dessus du plafond', () => r.tot.f.toFixed(1) + ' ' + input);
    // Huile de secours : seulement s'il manque des lipides sans elle
    if (huile) C.ok(r.tot.f - huile.m.f < A.FAT_MIN * k + 0.5, 'huile de secours inutile', () => r.tot.f.toFixed(1) + ' ' + input);
  }

  // Féculents : le bon aliment, entre un pas et le plafond en grammes ; encas seulement si les deux sont au plafond
  ['dej', 'diner'].forEach(id => {
    if (sec(r, id).libre) return;
    const S = A.STARCH[ch[id].starch], st = starchOf(r, id), g = parseInt(st.qty, 10);
    C.ok(st.name === S.name, 'mauvais féculent', () => st.name + ' ' + input);
    C.ok(g >= S.step && g % S.step === 0, 'féculent : arrondi ou quantité nulle', () => st.qty + ' ' + input);
    C.ok(g <= S.cap * k + S.step / 2 + 1e-9, 'féculent au-dessus de son plafond', () => st.qty + ' ' + S.name + ' > ' + (S.cap * k).toFixed(0) + ' ' + input);
    C.ok(st.m.kcal >= A.STARCH_MIN * k - S.f[0] * S.step / 200 - 1e-9 || g === S.step, 'féculent sous son plancher', () => st.qty + ' ' + S.name + ' ' + input);
  });
  const encas = items.filter(x => x.key === 'encas');
  C.ok(encas.length <= 1, 'plusieurs encas', cas);
  // Sans encas, féculents au plafond : il ne reste pas 30 kcal ou plus à placer (aux arrondis des féculents près)
  if (!encas.length && !plan.libre && atCap(r, ch)){
    const tol = ['dej', 'diner'].reduce((a, id) => { const S = A.STARCH[ch[id].starch]; return a + S.f[0] * S.step / 200; }, 0);
    C.ok(r.ecart > -30 - tol - 1e-6, 'reste de 30 kcal ou plus sans encas', () => Math.round(r.ecart) + ' ' + input);
  }
  if (encas.length){
    const kc = encas[0].m.kcal;
    C.ok(kc >= 30 && kc % 10 === 0, 'encas : arrondi ou trop petit', () => kc + ' ' + input);
    C.ok(sec(r, 'co').items.includes(encas[0]), 'encas hors de la collation', cas);
    ['dej', 'diner'].forEach(id => {
      if (sec(r, id).libre) return;
      const S = A.STARCH[ch[id].starch];
      C.ok(starchOf(r, id).m.kcal >= A.starchCap(ch[id].starch, k) - S.f[0] * S.step / 100, 'encas sans féculent au plafond', () => id + ' ' + input);
    });
  }

  // Structure de la journée
  C.ok(ids[0] === 'pd', 'petit-déjeuner pas en premier', () => ids.join(' '));
  C.ok(ids.filter(x => x === 'co').length === 1, 'une seule collation', () => ids.join(' '));
  C.ok(ids.indexOf('dej') < ids.indexOf('diner'), 'déjeuner après le dîner', () => ids.join(' '));
  C.ok(ids.slice(ids.indexOf('diner') + 1).every(x => x === 'soir'), 'après le dîner, seulement le skyr du soir', () => ids.join(' '));
  C.ok(ids.includes('sw') === plan.seances.some(x => x.moment === 'midi'), 'banane de 11 h 30', () => ids.join(' '));
  C.ok((sec(r, 'co').title === 'Goûter') === long, 'goûter les jours de sortie longue', () => ids.join(' '));
  const bands = r.secs.filter(s => s.band);
  C.ok(bands.length === plan.seances.length, 'un bandeau par séance', () => ids.join(' ') + ' ' + input);
  const order = { matin: 0, midi: 1, soir: 2 }, bandMoments = [];
  r.secs.forEach((s, j) => { if (s.band) bandMoments.push(ids.indexOf('dej') > j ? (ids.includes('sw') && ids.indexOf('sw') < j ? 1 : 0) : 2); });
  C.ok(bandMoments.every((m, j) => j === 0 || m >= bandMoments[j - 1]), 'bandeaux dans l’ordre de la journée', () => ids.join(' '));
  C.ok(JSON.stringify(bandMoments) === JSON.stringify(plan.seances.map(x => order[x.moment]).sort()), 'bandeau au mauvais moment', () => ids.join(' ') + ' ' + input);
  bands.filter(b => b.title === 'Sortie longue').forEach(b => {
    const d = plan.seances.find(x => x.taille === 'longue').duree;
    C.ok(b.items.length === 1 && b.items[0].qty === Math.round(pr.ravito * d / 5) * 5 + NB + 'g', 'ravito de la sortie longue', () => JSON.stringify(b.items) + ' ' + input);
  });
  C.ok(items.filter(x => x.key === 'shk').length === (pr.shaker === 'oui' ? 1 : 0), 'nombre de shakers', () => ids.join(' ') + ' ' + input);
  // Collation : œufs, + banane s'il y a une séance, + compote s'il y a une moyenne ou une longue ; goûter : skyr, pomme, amandes
  const co = sec(r, 'co'), coNames = co.items.map(x => x.name);
  if (long) C.ok(['skyr nature', 'pomme', 'amandes'].every(n => coNames.includes(n)), 'goûter incomplet', () => coNames.join(', '));
  else {
    const oe = co.items[0], nOe = A.pieces(2, k);
    C.ok(oe.qty === String(nOe) && oe.name === (nOe > 1 ? 'œufs marinés' : 'œuf mariné'), 'œufs de la collation', () => oe.qty + ' ' + oe.name);
    C.ok(coNames.includes('banane') === plan.seances.length > 0, 'banane de la collation', () => coNames.join(', ') + ' ' + input);
    C.ok(coNames.includes('compote') === grosse, 'compote de la collation', () => coNames.join(', ') + ' ' + input);
  }
  // Desserts : une ligne en fin de repas si choisi ; après une séance à midi, compote seulement sans dessert au déjeuner
  ['dej', 'diner'].forEach(id => {
    const s = sec(r, id); if (s.libre) return;
    const des = s.items.filter(x => x.key === 'des');
    C.ok(des.length === (ch[id].dessert !== 'aucun' ? 1 : 0), 'ligne de dessert', () => id + ' ' + qtys(s));
    if (des.length) C.ok(s.items[s.items.length - 1] === des[0] || s.items[s.items.length - 1].key === 'gras', 'dessert pas en fin de repas', () => qtys(s));
  });
  const comp = sec(r, 'dej').items.filter(x => x.key === 'comp').length;
  C.ok(comp === (plan.seances.some(x => x.moment === 'midi') && ch.dej.dessert === 'aucun' ? 1 : 0), 'compote du déjeuner après une séance à midi', () => qtys(sec(r, 'dej')));

  // Repas libre : la journée normale, dîner (et skyr du soir) remplacés par un budget = ce qu'ils valaient + 300 × k
  if (plan.libre){
    const n = A.buildDay(Object.assign({}, plan, { libre: false }), ch, prof);
    const d = sec(r, 'diner');
    C.ok(d.libre && d.items.length === 1 && !soir, 'repas libre : dîner remplacé, pas de skyr du soir', () => ids.join(' '));
    const was = sum(n.secs.filter(s => s.id === 'diner' || s.id === 'soir').flatMap(s => s.items)).kcal;
    C.ok(r.libre === Math.round((was + 300 * k) / 50) * 50 && r.libre > 0, 'budget du repas libre', () => r.libre + ' au lieu de ' + Math.round((was + 300 * k) / 50) * 50 + ' ' + input);
    C.ok(near(r.ecart, n.ecart, 1e-9), 'écart du jour libre ≠ jour normal', () => r.ecart + ' ' + n.ecart + ' ' + input);
    C.ok(near(r.tot.kcal, n.tot.kcal - was + r.libre, 1e-6), 'total du jour libre', cas);
    C.ok(r.prot.factor === n.prot.factor, 'portions du jour libre ≠ jour normal', cas);
    n.secs.filter(s => s.id !== 'diner' && s.id !== 'soir').forEach(s => {
      const same = r.secs.find(x => x.id === s.id);
      C.ok(same && qtys(same) === qtys(s), 'jour libre : autre repas différent du jour normal', () => s.id + ' : ' + (same ? qtys(same) : '—') + ' // ' + qtys(s) + ' ' + input);
    });
  } else C.ok(r.libre === null && !r.secs.some(s => s.libre), 'repas libre un jour normal', cas);

  // Achats (liste de courses) : chaque ligne dit ce qu'il faut acheter, d'accord avec sa quantité affichée
  items.forEach(x => {
    const b = x.buy, g = /^(\d+)\u00A0g$/.exec(x.qty);
    if (!C.ok(b && typeof b.id === 'string', 'ligne sans achat', () => x.qty + ' ' + x.name)) return;
    C.ok(['g', 'n', 'kcal'].some(k => fin(b[k]) && b[k] > 0), 'achat sans quantité', () => JSON.stringify(b));
    if (b.g !== undefined && x.key !== 'fuel') C.ok(g && +g[1] === b.g, 'achat en grammes ≠ quantité affichée', () => x.qty + ' ' + x.name + ' ' + JSON.stringify(b));
    if (b.n !== undefined && x.key !== 'lib') C.ok(x.qty === (b.n === 0.5 ? '½' : String(b.n)), 'achat en pièces ≠ quantité affichée', () => x.qty + ' ' + x.name + ' ' + JSON.stringify(b));
    if (b.kcal !== undefined) C.ok(near(b.kcal, x.m.kcal, 1e-9), 'budget ≠ kcal de la ligne', () => x.qty + ' ' + x.name);
    // Le bon aliment : celui de la table (le fruit du dessert est « au choix », pas une pomme)
    const st = A.STARCH_ORDER.find(id => A.STARCH[id].name === x.name);
    const want = x.name === 'fruit' ? 'fruit' : x.name === 'avocat' ? 'avocat' : x.name === 'boîte de thon au naturel' ? 'thon' : st || (BYNAME[x.name] && BYNAME[x.name][1]);
    if (want) C.ok(b.id === want, 'achat : mauvais aliment', () => x.name + ' → ' + b.id);
  });

  // Déterministe
  C.ok(JSON.stringify(A.buildDay(plan, ch, prof)) === JSON.stringify(r), 'résultat non déterministe', cas);
}

// --- B. Relations entre journées ---------------------------------------------------------------------------------
for (let i = 0; i < N / 3; i++){
  const js = R.int(0, 6), prof = randProfile(), plan = randPlan(js, false), ch = randChoices(), pr = A.cleanProfile(prof);
  const input = JSON.stringify([prof, plan, ch]);
  const r = A.buildDay(plan, ch, prof), T = r.energy.target;
  // Dessert ou féculent changé : le total ne bouge pas (hors féculents à une limite), aux arrondis près
  const nod = copy(ch); nod.dej.dessert = 'aucun'; nod.diner.dessert = 'aucun';
  const b = A.buildDay(plan, nod, prof);
  if (!limited(r, ch) && !limited(b, nod)) C.ok(near(r.tot.kcal, b.tot.kcal, 0.02 * T), 'un dessert change le total', () => Math.round(r.tot.kcal - b.tot.kcal) + ' ' + input);
  const sw = copy(ch); sw[R.pick(['dej', 'diner'])].starch = R.pick(A.STARCH_ORDER);
  const c = A.buildDay(plan, sw, prof);
  if (!limited(r, ch) && !limited(c, sw)) C.ok(near(r.tot.kcal, c.tot.kcal, 0.02 * T), 'changer de féculent change le total', () => Math.round(r.tot.kcal - c.tot.kcal) + ' ' + input);
  // Une séance de plus : objectif au moins aussi haut, apport aussi (sauf journée déjà au-dessus de l'objectif)
  if (plan.seances.length < 4){
    const p2 = A.cleanPlan({ seances: plan.seances.concat([{ taille: R.pick(['petite', 'moyenne']), moment: R.pick(['matin', 'midi', 'soir']) }]), libre: false }, js);
    const d = A.buildDay(p2, ch, prof);
    C.ok(d.energy.target >= T, 'séance en plus, objectif plus bas', () => input);
    if (r.ecart <= 0.03 * T) C.ok(d.tot.kcal >= r.tot.kcal - 0.02 * T, 'séance en plus, apport plus bas', () => Math.round(r.tot.kcal) + ' → ' + Math.round(d.tot.kcal) + ' ' + input);
  }
  // Plus de déficit : objectif plus bas ; plus de poids : objectif plus haut ; objectif de protéines plus haut : pas moins de protéines
  if (pr.deficit < 25) C.ok(A.buildDay(plan, ch, Object.assign({}, prof, { deficit: pr.deficit + 1 })).energy.target <= T, 'déficit plus haut, objectif plus haut', () => input);
  if (pr.poids <= 249) C.ok(A.buildDay(plan, ch, Object.assign({}, prof, { poids: pr.poids + 1 })).energy.target >= T, 'poids plus haut, objectif plus bas', () => input);
  if (pr.prot <= 2.9){
    const e = A.buildDay(plan, ch, Object.assign({}, prof, { prot: +(pr.prot + 0.1).toFixed(1) }));
    C.ok(e.tot.p >= r.tot.p - 8, 'objectif de protéines plus haut, moins de protéines', () => Math.round(r.tot.p) + ' → ' + Math.round(e.tot.p) + ' ' + input);
    C.ok(e.prot.factor >= r.prot.factor - 0.15, 'objectif de protéines plus haut, portions plus petites', () => r.prot.factor.toFixed(2) + ' → ' + e.prot.factor.toFixed(2) + ' ' + input);
  }
}

// --- C. Données abîmées : validation du stockage, jamais d'exception ni de pollution du prototype ----------------------
// Séances valides en trop : les 4 premières gardées, dans l'ordre, une seule sortie longue (toujours le matin)
for (let i = 0; i < N / 3; i++){
  const list = Array.from({ length: R.int(0, 8) }, () => ({ taille: R.pick(['petite', 'moyenne', 'longue']), moment: R.pick(['matin', 'midi', 'soir']), duree: R.pick([1.5, 2, 2.5, 3]) }));
  const want = [];
  list.forEach(x => {
    if (want.length >= 4 || (x.taille === 'longue' && want.some(y => y.taille === 'longue'))) return;
    want.push(x.taille === 'longue' ? { taille: 'longue', moment: 'matin', duree: x.duree } : { taille: x.taille, moment: x.moment });
  });
  const got = A.cleanPlan({ seances: list, libre: false }, 3).seances;
  C.ok(JSON.stringify(got) === JSON.stringify(want), 'cleanPlan : séances gardées', () => JSON.stringify(list) + ' → ' + JSON.stringify(got));
}
const WEIRD = [undefined, null, NaN, Infinity, -Infinity, 0, -1, 1e9, '', 'abc', '12', true, false, [], [1, 2], {}, { a: 1 },
  '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'petite', 'moyenne', 'longue', 'matin', 'midi', 'soir', 1.5, 2, 2.5, 3, '2', 72,
  'auto', 'manuel', 'h', 'f', 'oui', 'non', 'assis', 'muscu', 'course', 'double', 'prot:poulet', 'starch:riz', 'dessert:aucun', 'pd:constructor',
  ['prot:thon', 'prot:thon', 'pd:pain'], ['pd:avoine', 'pd:pain'], ['dessert:fruit', 5, null, 'prot:__proto__']];
// Aliments qu'on peut retirer des propositions (réglages) : « type:id »
const ALL_OFF = Object.entries(A.CHOICE_IDS).flatMap(([k, ids]) => ids.map(id => k + ':' + id));
const KEYS = ['seances', 'libre', 'taille', 'moment', 'duree', 'mode', 'sexe', 'age', 'poids', 'gras', 'repos', 'neat', 'deficit', 'prot',
  'ravito', 'shaker', 'shakerKcal', 'shakerProt', 'kcalPetite', 'kcalMoyenne', 'kcalLongueH', 'marge', 'off', 'activity', 'natation', '__proto__', 'constructor'];
const weird = d => d > 2 || R.chance(.6) ? R.pick(WEIRD) : R.chance(.5) ? Array.from({ length: R.int(0, 5) }, () => weirdObj(d + 1)) : weirdObj(d + 1);
const weirdObj = d => {
  const o = {};
  for (let j = R.int(0, 7); j > 0; j--) Object.defineProperty(o, R.pick(KEYS), { value: weird(d), enumerable: true, writable: true, configurable: true });
  return o;
};
const has = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
for (let i = 0; i < N * 2; i++){
  const x = R.chance(.2) ? weird(0) : weirdObj(0), js = R.int(0, 6);
  const show = () => { try { return JSON.stringify(x); } catch (e){ return String(x); } };
  try {
    const p = A.cleanPlan(x, js);
    C.ok(Array.isArray(p.seances) && typeof p.libre === 'boolean' && p.seances.length <= 4, 'cleanPlan : forme', show);
    C.ok(p.seances.filter(s => s.taille === 'longue').length <= 1, 'cleanPlan : deux sorties longues', show);
    p.seances.forEach(s => {
      C.ok(has(A.SIZES, s.taille) && has(A.MOMENT_RANK, s.moment), 'cleanPlan : séance invalide', show);
      if (s.taille === 'longue') C.ok(s.moment === 'matin' && A.DUREES.some(d => d[0] === s.duree), 'cleanPlan : sortie longue invalide', show);
      else C.ok(!has(s, 'duree'), 'cleanPlan : durée sur une séance courte', show);
    });
    const pr = A.cleanProfile(x);
    Object.entries(A.PROFILE_RANGES).forEach(([key, b]) => {
      const v = pr[key];
      C.ok((v === null && A.PROFILE_DEFAULT[key] === null) || (typeof v === 'number' && v >= b[0] && v <= b[1]), 'profil hors bornes', () => key + '=' + String(v) + ' ' + show());
    });
    C.ok(['auto', 'manuel'].includes(pr.mode) && ['h', 'f'].includes(pr.sexe) && has(A.NEAT, pr.neat) && ['oui', 'non'].includes(pr.shaker), 'profil : valeur énumérée invalide', show);
    C.ok(Object.keys(pr).every(key => has(A.PROFILE_DEFAULT, key)), 'profil : champ inconnu gardé', show);
    C.ok(Array.isArray(pr.off) && pr.off.every(o => ALL_OFF.includes(o)) && ['pd', 'prot', 'starch'].every(k => A.allowed(k, pr.off).length > 0), 'profil : aliments retirés invalides', show);
    const r = A.buildDay(p, A.DEFAULT_CHOICES[js], x);
    C.ok(fin(r.tot.kcal) && fin(r.tot.p), 'buildDay sur profil abîmé : total invalide', show);
    const mp = A.migratePlan(x);
    if (mp !== null) A.buildDay(A.cleanPlan(mp, js), A.DEFAULT_CHOICES[js], x);
    // Choix abîmés : protéine, féculent ou dessert invalides ne doivent pas passer (validés à la lecture dans la page)
    C.ok(A.dessertOf(x) === (typeof x === 'object' && x && has(A.DESSERT, x.dessert) ? x.dessert : 'aucun'), 'dessertOf', show);
  } catch (e){ C.ok(false, 'exception sur données abîmées', () => e.message + ' ' + show()); }
}
C.ok(({}).polluted === undefined && !('taille' in {}) && !('seances' in {}), 'Object.prototype pollué', '');

// --- Liste de courses : exactement la somme des achats des journées, rangée par rayon ------------------------------
{
  const PIECE = ['banane', 'pomme', 'fruit', 'thon', 'compote', 'shaker', 'libre'];
  const num = q => Number(q.replace(/[^\d,]/g, '').replace(',', '.'));
  const grams = q => /kg$/.test(q) ? num(q) * 1000 : num(q);
  for (let i = 0; i < N / 10; i++){
    const prof = randProfile(), days = Array.from({ length: R.int(1, 10) }, () => A.buildDay(randPlan(R.int(0, 6)), randChoices(), prof));
    const input = () => JSON.stringify(prof);
    const sum = {};
    days.forEach(d => d.secs.forEach(s => s.items.forEach(x => {
      const id = x.buy.id === 'oeuf' || x.buy.id === 'oeufMarine' ? 'oeufs' : x.buy.id, a = sum[id] || (sum[id] = { g: 0, n: 0, kcal: 0, mar: 0 });
      a.g += x.buy.g || 0; a.n += x.buy.n || 0; a.kcal += x.buy.kcal || 0; if (x.buy.id === 'oeufMarine') a.mar += x.buy.n;
    })));
    const list = A.shoppingList(days), lines = {};
    list.forEach(g => { C.ok(g.lines.length > 0 && typeof g.title === 'string', 'rayon vide', g.title); g.lines.forEach(l => { C.ok(!lines[l.id], 'aliment en double', l.id); lines[l.id] = l; }); });
    C.ok(Object.keys(sum).sort().join() === Object.keys(lines).sort().join(), 'achats oubliés ou en trop dans la liste', () => Object.keys(sum).sort().join() + ' // ' + Object.keys(lines).sort().join());
    Object.entries(lines).forEach(([id, l]) => {
      const a = sum[id] || {};
      [l.qty, l.name, l.note || ''].forEach(t => C.ok(!/NaN|undefined|null|Infinity/.test(t) && !/\d (g|kg|kcal)\b/.test(t), 'liste : texte cassé', () => JSON.stringify(l)));
      if (id === 'oeufs') C.ok(+l.qty === a.n && (a.mar === 0 ? !l.note : new RegExp(a.mar === a.n ? 'à mariner' : 'dont ' + a.mar + ' à mariner').test(l.note)), 'liste : œufs', () => JSON.stringify([l, a]));
      else if (id === 'avocat') C.ok(+l.qty === Math.ceil(Math.round(a.n * 2) / 2) && l.note.startsWith(String(Math.round(a.n * 2))), 'liste : avocats', () => JSON.stringify([l, a]));
      else if (PIECE.includes(id)) C.ok(+l.qty === a.n, 'liste : pièces', () => JSON.stringify([l, a]));
      else if (id === 'encas' || id === 'marge') C.ok(Math.abs(num(l.qty) - Math.round(a.kcal / 10) * 10) < 1e-6, 'liste : budget', () => JSON.stringify([l, a]));
      else C.ok(Math.abs(grams(l.qty) - a.g) <= (a.g >= 1000 ? 5 : 0.5), 'liste : grammes', () => JSON.stringify([l, a]) + ' ' + input());
    });
    C.ok(JSON.stringify(A.shoppingList(days)) === JSON.stringify(list), 'liste non déterministe', input);
  }
  C.ok(A.shoppingList([]).length === 0, 'liste vide', '');
}

// --- « Décide pour moi » : tirages toujours valides, jamais la même protéine midi et soir, tous les choix possibles ---
{
  const seenOpt = new Set();
  for (let i = 0; i < N; i++){
    const c = A.randomChoices(R.next), show = () => JSON.stringify(c);
    C.ok(['avoine', 'pain'].includes(c.pdBase), 'tirage : base invalide', show);
    ['dej', 'diner'].forEach(slot => {
      C.ok(has(A.PROT, c[slot].prot) && has(A.STARCH, c[slot].starch) && has(A.DESSERT, c[slot].dessert), 'tirage : choix invalide', show);
      seenOpt.add(slot + ':' + c[slot].prot).add(slot + ':' + c[slot].starch).add(slot + ':' + c[slot].dessert);
    });
    seenOpt.add(c.pdBase);
    C.ok(c.dej.prot !== c.diner.prot, 'tirage : même protéine midi et soir', show);
    const r = A.buildDay(A.emptyPlan(R.int(0, 6)), c, {});
    C.ok(fin(r.tot.kcal), 'tirage : journée invalide', show);
  }
  // Valeurs extrêmes du hasard (0 et presque 1) : toujours dans les listes
  [() => 0, () => 0.9999999999].forEach(f => { const c = A.randomChoices(f); C.ok(c.dej.prot !== c.diner.prot && has(A.STARCH, c.diner.starch) && has(A.DESSERT, c.diner.dessert), 'tirage aux bornes', () => JSON.stringify(c)); });
  C.ok(seenOpt.size === 2 + 2 * (A.PROT_ORDER.length + A.STARCH_ORDER.length + A.DESSERT_ORDER.length), 'tirage : des choix jamais tirés', () => seenOpt.size + ' choix tirés');
}

// --- Aliments proposés ou non (réglages) : retraits valides, jamais un aliment retiré tiré au hasard ni proposé à sa place --
{
  const EXTRA = ['prot:', ':riz', 'prot:constructor', '__proto__:poulet', 'dessert:aucun', 'starch:riz ', 'Prot:poulet', 7, null, {}, ['prot:poulet']];
  for (let i = 0; i < N; i++){
    const rate = R.pick([0.1, 0.3, 0.6, 0.9, 1]);
    const raw = ALL_OFF.filter(() => R.chance(rate)).concat(R.chance(.3) ? [R.pick(EXTRA), R.pick(EXTRA), R.pick(ALL_OFF)] : []);
    const off = A.cleanOff(raw), show = () => JSON.stringify(raw);
    C.ok(off.every(o => ALL_OFF.includes(o)) && new Set(off).size === off.length, 'cleanOff : entrée invalide ou en double', show);
    // Un retrait valide est gardé, sauf si tout un type est retiré (base, protéine, féculent : il en faut au moins un)
    Object.keys(A.CHOICE_IDS).forEach(k => {
      const asked = A.CHOICE_IDS[k].filter(id => raw.includes(k + ':' + id)), kept = A.CHOICE_IDS[k].filter(id => off.includes(k + ':' + id));
      const allOff = asked.length === A.CHOICE_IDS[k].length && k !== 'dessert';
      C.ok(kept.join() === (allOff ? '' : asked.join()), 'cleanOff : retrait perdu', () => k + ' ' + show());
      C.ok(A.allowed(k, off).length > 0, 'cleanOff : plus aucun choix', () => k + ' ' + show());
    });
    C.ok(A.allowed('dessert', off)[0] === 'aucun', 'aliments : « Aucun » toujours proposé en dessert', show);
    C.ok(JSON.stringify(A.cleanProfile({ off: raw }).off) === JSON.stringify(off) && (off.length ? JSON.stringify(A.profileFields({ off: raw }).off) === JSON.stringify(off) : !has(A.profileFields({ off: raw }), 'off')), 'profil : aliments retirés', show);
    const ok = k => A.allowed(k, off), prots = ok('prot');
    // Mémoire et choix par défaut : un aliment retiré remplacé par le suivant proposé (dessert : aucun), le reste gardé
    const c = R.chance(.5) ? randChoices() : copy(A.DEFAULT_CHOICES[R.int(0, 6)]), w = A.withAllowed(c, off), wshow = () => show() + ' ' + JSON.stringify(c) + ' → ' + JSON.stringify(w);
    const nextOk = (k, id, avoid) => { const all = A.CHOICE_IDS[k], i = all.indexOf(id); for (let j = 1; j <= all.length; j++){ const x = all[(i + j) % all.length]; if (ok(k).includes(x) && x !== avoid) return x; } return ok(k)[0]; };
    C.ok(w.pdBase === (ok('pd').includes(c.pdBase) ? c.pdBase : nextOk('pd', c.pdBase)), 'withAllowed : base', wshow);
    ['dej', 'diner'].forEach(sl => {
      const des = A.dessertOf(c[sl]);
      C.ok(w[sl].starch === (ok('starch').includes(c[sl].starch) ? c[sl].starch : nextOk('starch', c[sl].starch)), 'withAllowed : féculent', wshow);
      C.ok(w[sl].dessert === (ok('dessert').includes(des) ? des : 'aucun'), 'withAllowed : dessert', wshow);
      C.ok(prots.includes(w[sl].prot) && (!prots.includes(c[sl].prot) || w[sl].prot === c[sl].prot), 'withAllowed : protéine', wshow);
    });
    const replaced = !prots.includes(c.dej.prot) || !prots.includes(c.diner.prot);
    C.ok(!replaced || prots.length < 2 || w.dej.prot !== w.diner.prot, 'withAllowed : même protéine midi et soir après un remplacement', wshow);
    C.ok(Number.isFinite(A.buildDay(A.emptyPlan(3), w, {}).tot.kcal), 'withAllowed : journée invalide', wshow);
    // « Décide pour moi » : seulement des aliments proposés, protéines différentes s'il en reste au moins deux
    const r = A.randomChoices(R.next, off), rshow = () => show() + ' → ' + JSON.stringify(r);
    C.ok(ok('pd').includes(r.pdBase) && ['dej', 'diner'].every(sl => prots.includes(r[sl].prot) && ok('starch').includes(r[sl].starch) && ok('dessert').includes(r[sl].dessert)), 'tirage : aliment retiré', rshow);
    C.ok(prots.length < 2 || r.dej.prot !== r.diner.prot, 'tirage : même protéine midi et soir', rshow);
  }
  // Une seule protéine proposée : midi et soir, sans erreur
  const one = A.cleanOff(A.PROT_ORDER.slice(1).map(p => 'prot:' + p));
  C.ok(A.randomChoices(() => 0.5, one).dej.prot === 'poulet' && A.randomChoices(() => 0.5, one).diner.prot === 'poulet', 'une seule protéine proposée', JSON.stringify(one));
  // Tout retiré : rien n'est retenu (sauf les desserts), l'appli propose tout
  C.ok(JSON.stringify(A.cleanOff(ALL_OFF)) === JSON.stringify(A.CHOICE_IDS.dessert.map(d => 'dessert:' + d)), 'tout retiré', '');
  // Exemple écrit à la main : mardi (poulet midi, bœuf soir), poulet retiré → pas bœuf deux fois
  const tue = A.withAllowed(A.DEFAULT_CHOICES[2], ['prot:poulet']);
  C.ok(tue.dej.prot === 'poisson' && tue.diner.prot === 'boeuf', 'mardi sans poulet', () => JSON.stringify(tue));
}

// --- D. Données : complètes et cohérentes ------------------------------------------------------------------------
A.PROT_ORDER.forEach(p => A.STARCH_ORDER.forEach(s => C.ok(A.IDEAS[p] && typeof A.IDEAS[p][s] === 'string', 'idée de plat manquante', p + ' × ' + s)));
C.ok(Object.keys(A.PROT).sort().join() === A.PROT_ORDER.slice().sort().join(), 'PROT_ORDER ≠ PROT', '');
C.ok(Object.keys(A.STARCH).sort().join() === A.STARCH_ORDER.slice().sort().join(), 'STARCH_ORDER ≠ STARCH', '');
C.ok(Object.keys(A.DESSERT).sort().join() === A.DESSERT_ORDER.slice().sort().join(), 'DESSERT_ORDER ≠ DESSERT', '');
C.ok(Object.keys(A.DEFAULT_CHOICES).length === 7, 'choix par défaut : 7 jours', '');
Object.entries(A.DEFAULT_CHOICES).forEach(([js, c]) => C.ok(['avoine', 'pain'].includes(c.pdBase) && ['dej', 'diner'].every(s => has(A.PROT, c[s].prot) && has(A.STARCH, c[s].starch)), 'choix par défaut invalide', js));
A.STARCH_ORDER.forEach(id => { const S = A.STARCH[id]; C.ok(S.cap > 0 && S.step > 0 && S.f.length === 4 && S.label && S.name && (!S.cook || S.raw), 'féculent incomplet', id); });
// Valeurs des aliments : 4 nombres ≥ 0, énergie cohérente avec 4/4/9 à 20 % près (fibres, alcools de sucre, arrondis)
const tables = [['FOOD', A.FOOD], ['UNIT', A.UNIT], ['STARCH', Object.fromEntries(A.STARCH_ORDER.map(id => [id, A.STARCH[id].f]))]];
tables.forEach(([name, tab]) => Object.entries(tab).forEach(([key, v]) => {
  C.ok(v.length === 4 && v.every(x => fin(x) && x >= 0), 'valeurs d’aliment invalides', name + '.' + key);
  C.ok(Math.abs(4 * v[1] + 4 * v[2] + 9 * v[3] - v[0]) <= 0.2 * v[0], 'énergie ≠ 4/4/9 à 20 % près', () => name + '.' + key + ' ' + v.join(' '));
  C.ok(v[1] + v[2] + v[3] <= (name === 'UNIT' ? 200 : 100), 'plus de 100 g de macros pour 100 g', name + '.' + key);
}));
Object.entries(A.PROFILE_RANGES).forEach(([key, b]) => { const d = A.PROFILE_DEFAULT[key]; C.ok(d === null || (d >= b[0] && d <= b[1]), 'profil par défaut hors bornes', key); });
// Textes des données : typographie française (espace insécable avant : ; ? ! % et les unités, apostrophe courbe)
const strs = [];
const walk = o => { if (typeof o === 'string') strs.push(o); else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
walk([A.IDEAS, A.STARCH, A.SIZES, A.DUREES, A.MOMENTS, A.refTable(), A.PROT_ORDER.map(p => A.PROT[p].label), A.DESSERT_ORDER.map(d => A.DESSERT[d].label)]);
A.DESSERT_ORDER.filter(d => d !== 'aucun').forEach(d => walk(A.DESSERT[d].item()));
strs.forEach(s => {
  C.ok(!/\d (g|kcal|km|%|h)\b/.test(s) && !/ [:;?!%»]/.test(s) && !/« /.test(s), 'typographie des données', () => JSON.stringify(s));
  C.ok(!/'/.test(s), 'apostrophe droite dans les données', () => JSON.stringify(s));
});

assert(C.checks > N * 50, 'trop peu de vérifications : ' + C.checks);
C.done(N + ' journées au hasard, ' + Math.round(N / 3) + ' comparaisons, ' + N * 2 + ' données abîmées, ' + C.checks + ' vérifications, graine ' + seed);
