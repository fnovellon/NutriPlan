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
  // Objectif de protéines : 1,6 à 2,2 g/kg ; parfois plus haut (enregistré avant la 3.11.1), relu comme 2,2
  if (R.chance(.5)) p.prot = R.chance(.85) ? R.between(1.6, 2.2, 0.1) : R.between(2.3, 3, 0.1);
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
// Recette : souvent celle du couple (choisie), parfois une qui ne va pas (ignorée)
const slot = () => {
  const o = { prot: R.pick(A.PROT_ORDER), starch: R.pick(A.STARCH_ORDER), dessert: R.pick(A.DESSERT_ORDER) };
  if (R.chance(.4)) o.recette = o.prot + '-' + o.starch;
  else if (R.chance(.05)) o.recette = R.pick(Object.keys(A.RECIPES));
  return o;
};
const randChoices = () => ({ pdBase: R.pick(A.PD_ORDER), dej: slot(), diner: slot() });
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
  'flocons d’avoine ou muesli': ['food', 'avoine'], 'pain complet': ['food', 'pain'], 'fruits rouges': ['food', 'fruitsRouges'],
  'amandes': ['food', 'amandes'], 'miel': ['food', 'miel'], 'légumes': ['food', 'legumes'], 'huile d’olive': ['food', 'huile'],
  'chocolat noir': ['food', 'chocolat'],
  'œufs': ['unit', 'oeuf'], 'œuf': ['unit', 'oeuf'], 'œuf dur': ['unit', 'oeuf'], 'banane': ['unit', 'banane'],
  'pomme': ['unit', 'pomme'], 'fruit': ['unit', 'pomme'], 'compote': ['unit', 'compote'],
  // Matières grasses des recettes nommées autrement que dans RFOOD
  'huile de sésame': ['food', 'huile'], 'parmesan râpé': ['food', 'parmesan']
};
// Légumes et matières grasses des recettes (3.12.0)
Object.entries(A.RFOOD).forEach(([id, x]) => { BYNAME[x[0]] = ['food', id]; });
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
  // Poids fixés d'une boîte de batch cooking (3.17.0) : près des portions de base × k (comme les laisse l'arrondi), parfois abîmés
  ['dej', 'diner'].forEach(sl => {
    const BASE = { poulet: [180, 0], boeuf: [150, 0], poisson: [200, 0], saumon: [160, 0], crevettes: [120, 60], tofu: [200, 0], oeufs: [0, 90] }[ch[sl].prot];
    if (!BASE || !R.chance(.25)) return;
    const k0 = A.scaleOf(A.cleanProfile(prof)), near = (b, st) => Math.max(st, Math.round(b * k0 * R.between(0.75, 1.3) / st) * st);
    if (BASE[0]) ch[sl].g = R.chance(.9) ? near(BASE[0], 10) : R.pick([175, 0, -10, '150', 5000, null]);
    if (BASE[1] && R.chance(.7)) ch[sl].g2 = R.chance(.9) ? near(BASE[1], 5) : R.pick([3, 'x', 1e6]);
  });
  const input = JSON.stringify([prof, plan, ch]), cas = () => input;
  let r;
  try { r = A.buildDay(plan, ch, prof); } catch (e){ C.ok(false, 'exception', e.message + ' ' + input); continue; }
  C.ok(JSON.stringify([prof, plan, ch]) === input, 'entrée modifiée par buildDay', cas);
  const pr = A.cleanProfile(prof), k = A.scaleOf(pr), T = r.energy.target;
  const items = r.secs.flatMap(s => s.items);
  const long = plan.seances.some(x => x.taille === 'longue'), grosse = plan.seances.some(x => x.taille !== 'petite');
  const ids = r.secs.map(s => s.id);
  // Skyr des flocons (3.19.0) : au moins 2,5 fois le poids des flocons
  { const pdi = sec(r, 'pd').items, oats = pdi.find(x => x.key === 'base' && x.buy.id === 'avoine'), sk = pdi.find(x => x.key === 'skyr');
    if (oats) C.ok(sk && sk.buy.g >= Math.ceil(oats.buy.g * 2.5 / 10) * 10, 'skyr sous 2,5 fois les flocons', cas); }
  // Poids fixés valides : la ligne les reprend et n'est pas ajustée ; sinon ignorés
  ['dej', 'diner'].forEach(sl => {
    const sc2 = sec(r, sl), fx = A.fixedGrams(ch[sl]);
    if (!sc2 || sc2.libre) return;
    ['p1', 'p2'].forEach((key, j) => {
      const it = sc2.items.find(x => x.key === key);
      if (it && fx && fx[j] !== null) C.ok(it.buy.g === fx[j] && !it.adj, 'poids fixé ≠ ligne', cas);
      else if (it && !A.PROT[ch[sl].prot].fixe) C.ok(it.adj, 'portion ni fixée ni ajustée', cas);
    });
  });

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
  items.filter(x => x.name === 'skyr nature' && x.key !== 'x-skyr').forEach(x => C.ok(parseInt(x.qty, 10) >= 100, 'skyr sous 100 g', () => x.qty + ' ' + input));
  // Recettes : choisie (et qui va avec la protéine et le féculent), ses lignes exactement, sans « légumes » ni marge cuisine ;
  // sinon les lignes habituelles. Suggestion : la recette du couple.
  ['dej', 'diner'].forEach(id => {
    const s = sec(r, id); if (s.libre) return;
    const rec = ch[id].recette && A.RECIPES[ch[id].recette] && A.RECIPES[ch[id].recette].p === ch[id].prot && A.RECIPES[ch[id].recette].s === ch[id].starch ? ch[id].recette : null;
    const keys = s.items.map(x => x.key), lines = s.items.filter(x => /^[vfx]-/.test(x.key)), show = () => id + ' ' + qtys(s) + ' ' + input;
    C.ok(s.recipe === rec && s.suggest === ch[id].prot + '-' + ch[id].starch, 'recette ou suggestion du repas', show);
    if (rec){
      const x = A.RECIPES[rec], want = Object.entries(x.leg).map(([v, g]) => 'v-' + v + ':' + g).concat(x.cuis.map(c => 'f-' + c[0] + ':' + c[1]), Object.entries(x.plus).map(([a, g]) => 'x-' + a + ':' + g));
      C.ok(lines.map(l => l.key + ':' + l.buy.g).join() === want.join() && !keys.includes('leg') && !keys.includes('marge'), 'lignes de la recette', show);
    } else C.ok(!lines.length && keys.includes('leg') && keys.includes('marge') === (id === 'dej' ? Math.round(pr.marge / 2 / 5) * 5 : pr.marge - Math.round(pr.marge / 2 / 5) * 5) > 0, 'repas sans recette', show);
  });
  // Petit-déjeuner selon la base : salé = pain, œufs, une tranche de jambon et fruit (portions × k, fixes), sauf les jours
  // de sortie longue (version sucrée au pain) ; sinon base, skyr, fruit (miel les jours de sortie longue), amandes
  {
    const pd = sec(r, 'pd').items, keys = pd.map(x => x.key).join(' '), sale = ch.pdBase === 'sale' && !long;
    const base = ch.pdBase === 'avoine' ? 'flocons d’avoine ou muesli' : 'pain complet';
    C.ok(keys === (sale ? 'base oeufs jambon fruit' : long ? 'base skyr fruit miel am' : 'base skyr fruit am') && pd[0].name === base, 'petit-déjeuner selon la base', () => ch.pdBase + ' : ' + keys + ' ' + input);
    if (sale) C.ok(pd[1].qty === String(A.pieces(2, k)) && pd[2].qty === Math.round(45 * k / 5) * 5 + NB + 'g' && !pd.some(x => x.adj), 'petit-déjeuner salé : portions', () => pd.map(x => x.qty).join(', ') + ' ' + input);
    if (ch.pdBase === 'sale' && long) C.ok(/version sucrée/.test(pd[0].note), 'sortie longue : version sucrée non dite', () => pd[0].note);
  }

  // Lipides : plancher toujours ; plafond (+ 8,4 g par chocolat) avec une marge cuisine d'au plus 150 kcal, dès 47 kg
  // (une marge de 250 kcal peut le dépasser d'environ 15 %), sauf si les féculents sont déjà au plancher (la page le dit)
  if (!plan.libre){
    C.ok(r.tot.f >= A.FAT_MIN * k - 0.5, 'lipides sous le plancher', () => r.tot.f.toFixed(1) + ' < ' + (A.FAT_MIN * k).toFixed(1) + ' ' + input);
    const choc = ['dej', 'diner'].filter(id => ch[id].dessert === 'chocolat').length;
    const huile = items.find(x => x.key === 'gras');
    // Repas avec recette : sa matière grasse (90 kcal au plus) à la place de la marge, plafond à 1 g près
    const recs = ['dej', 'diner'].filter(id => sec(r, id).recipe).length;
    if (pr.marge <= 150 && pr.poids >= 47 && !atFloor(r, ch)) C.ok(r.tot.f <= Math.max(A.FAT_MAX * k, 0.35 * T / 9) + 8.4 * choc + 0.5 + (recs ? 1 : 0), 'lipides au-dessus du plafond', () => r.tot.f.toFixed(1) + ' ' + input);
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
    // Déjà des œufs dans la journée (salé, « Œufs + jambon ») : skyr et amandes à la place des œufs
    const oeufs = ch.pdBase === 'sale' || ch.dej.prot === 'oeufs' || ch.diner.prot === 'oeufs';
    const oe = co.items[0], nOe = A.pieces(2, k);
    if (oeufs) C.ok(co.items[0].key === 'csk' && co.items[1].key === 'cam' && co.items[0].qty === Math.max(100, Math.round(100 * k / 10) * 10) + NB + 'g' && co.items[1].qty === Math.round(15 * k / 5) * 5 + NB + 'g' && !co.items.some(x => x.key === 'oe'), 'collation sans œufs', () => coNames.join(', ') + ' ' + input);
    else C.ok(oe.qty === String(nOe) && oe.name === (nOe > 1 ? 'œufs' : 'œuf') && oe.buy.id === 'oeuf', 'œufs de la collation', () => oe.qty + ' ' + oe.name);
    // Œufs de la journée : 4 au plus à 72 kg (salé ou « Œufs + jambon », jamais avec ceux de la collation), hors repas libre
    const eggs = items.filter(x => x.buy && x.buy.id === 'oeuf').reduce((t, x) => t + x.buy.n, 0);
    if (!plan.libre && ch.dej.prot !== 'oeufs' && ch.diner.prot !== 'oeufs') C.ok(eggs <= A.pieces(2, k) + 2, 'trop d’œufs dans la journée', () => eggs + ' ' + input);
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
    const want = x.name === 'fruit' ? 'fruit' : x.name === 'boîte de thon au naturel' ? 'thon' : st || (BYNAME[x.name] && BYNAME[x.name][1]);
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
  // Recette choisie ou retirée : le total ne bouge pas non plus
  const rc = copy(ch); ['dej', 'diner'].forEach(id => { if (rc[id].recette) delete rc[id].recette; else rc[id].recette = rc[id].prot + '-' + rc[id].starch; });
  const e2 = A.buildDay(plan, rc, prof);
  if (!limited(r, ch) && !limited(e2, rc)) C.ok(near(r.tot.kcal, e2.tot.kcal, 0.02 * T), 'une recette change le total', () => Math.round(r.tot.kcal - e2.tot.kcal) + ' ' + input);
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

// --- Imprévu (3.26.0) : un repas mangé autrement (à la place ou en plus), repris sur la suite de la journée -----------
{
  for (let i = 0; i < N / 3; i++){
    const js = R.int(0, 6), prof = randProfile(), plan = randPlan(js), ch = randChoices();
    const r0 = A.buildDay(plan, ch, prof), meals = r0.secs.filter(s => !s.band && !s.libre);
    const im = { slot: R.pick(meals).id, kcal: R.int(5, 300) * 10, mode: R.pick(['place', 'plus']) };
    const p1 = Object.assign({}, plan, { imprevu: im }), r = A.buildDay(p1, ch, prof), x = r.imprevu, input = JSON.stringify([prof, p1, ch]);
    C.ok(x && x.slot === im.slot && x.kcal === im.kcal && x.mode === im.mode, 'imprévu absent', () => input);
    if (!x) continue;
    // Mêmes repas dans le même ordre, mêmes portions de protéines (pf), repas d'avant identiques
    C.ok(r.secs.map(s => s.id).join() === r0.secs.map(s => s.id).join() && r.prot.factor === r0.prot.factor, 'imprévu : journée changée', () => input);
    const at = r.secs.findIndex(s => s.id === im.slot);
    r.secs.slice(0, at).forEach((s, j) => C.ok(JSON.stringify(s.items) === JSON.stringify(r0.secs[j].items), 'imprévu : un repas d’avant a changé', () => s.id + ' ' + input));
    // Le repas : une ligne à la place, ou ses lignes puis l'imprévu
    const s1 = r.secs[at], line = s1.items.filter(l => l.key === 'imp');
    C.ok(line.length === 1 && line[0].m.kcal === im.kcal && line[0].m.p === 0 && (im.mode === 'place' ? s1.items.length === 1 : JSON.stringify(s1.items.slice(0, -1)) === JSON.stringify(r0.secs[at].items)), 'imprévu : lignes du repas', () => qtys(s1) + ' ' + input);
    C.ok(x.delta === im.kcal - (im.mode === 'place' ? sum(r0.secs[at].items).kcal : 0), 'imprévu : écart avec le repas prévu', () => input);
    // Après : seuls les féculents et l'encas bougent ; féculents dans leurs bornes (à un pas près)
    r.secs.slice(at + 1).forEach((s, j) => {
      const keep = l => JSON.stringify(l.filter(y => y.key !== 'st' && y.key !== 'encas'));
      C.ok(keep(s.items) === keep(r0.secs[at + 1 + j].items), 'imprévu : autre chose que les féculents a bougé', () => s.id + ' ' + input);
    });
    const lo = A.STARCH_MIN * r.scale, step = id => { const S = A.STARCH[ch[id].starch]; return S.f[0] * S.step / 100; };
    const later = ['dej', 'diner'].filter(id => r.secs.findIndex(s => s.id === id) > at && !(plan.libre && id === 'diner'));
    later.forEach(id => {
      const v = starchOf(r, id).m.kcal, hi = Math.max(lo, A.starchCap(ch[id].starch, r.scale));
      C.ok(v >= Math.min(lo, starchOf(r0, id).m.kcal) - step(id) - 0.01 && v <= Math.max(hi, starchOf(r0, id).m.kcal) + step(id) + 0.01, 'imprévu : féculent hors de ses bornes', () => id + ' ' + Math.round(v) + ' ' + input);
    });
    // Le total : la journée sans imprévu + ce qui n'a pas pu être repris (over) ; tout est repris quand il y avait la place
    C.ok(near(r.tot.kcal, r0.tot.kcal + x.over, 0.01), 'imprévu : total ≠ journée + over', () => input);
    const coAt = r0.secs.findIndex(s => s.id === 'co'), enc = coAt > at && x.delta > 0 ? (r0.secs[coAt].items.find(y => y.key === 'encas') || { m: { kcal: 0 } }).m.kcal : 0;
    const room = enc + later.reduce((a, id) => { const v = starchOf(r0, id).m.kcal, hi = Math.max(lo, A.starchCap(ch[id].starch, r.scale)); return a + Math.max(0, x.delta > 0 ? v - lo : hi - v); }, 0);
    // Arrondis : un pas par féculent, 10 kcal ; un encas qui tomberait sous 30 kcal part en entier (jamais affiché en dessous)
    const slack = later.reduce((a, id) => a + step(id), 0) + 10 + (enc ? 30 : 0);
    if (Math.abs(x.delta) <= room - slack) C.ok(Math.abs(x.over) <= slack, 'imprévu pas repris malgré la place', () => Math.round(x.delta) + ' / ' + Math.round(room) + ' → ' + Math.round(x.over) + ' ' + input);
    else C.ok(Math.abs(x.delta - x.over) <= room + slack && (Math.abs(x.over) <= slack || Math.sign(x.over) === Math.sign(x.delta)), 'imprévu : plus repris que la place', () => Math.round(x.delta) + ' / ' + Math.round(room) + ' → ' + Math.round(x.over) + ' ' + input);
    // Repas libre : son budget ne bouge pas ; un imprévu à sa place (le dîner) est ignoré
    if (plan.libre){
      C.ok(r.libre === r0.libre, 'imprévu : budget du repas libre changé', () => input);
      C.ok(A.buildDay(Object.assign({}, plan, { imprevu: { slot: 'diner', kcal: 500, mode: 'plus' } }), ch, prof).imprevu === null, 'imprévu au repas libre', () => input);
    }
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
  'ravito', 'shaker', 'shakerKcal', 'shakerProt', 'kcalPetite', 'kcalMoyenne', 'kcalLongueH', 'marge', 'off', 'semaine', 'jours', '0', '3', '6', 'activity', 'natation', '__proto__', 'constructor'];
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
    const sw = pr.semaine;
    C.ok(sw && Number.isInteger(sw.libre) && sw.libre >= 0 && sw.libre <= 6 && Object.entries(sw.jours).every(([js, l]) => /^[0-6]$/.test(js) && Array.isArray(l) && l.length >= 1 && l.length <= 4 && l.every(x => has(A.SIZES, x.taille) && has(A.MOMENT_RANK, x.moment)) && l.filter(x => x.taille === 'longue').length <= 1), 'profil : semaine type invalide', show);
    for (let js = 0; js < 7; js++){ const e = A.cleanPlan(R.chance(.5) ? x : undefined, js, sw); C.ok(Array.isArray(e.seances) && e.seances.length <= 4 && typeof e.libre === 'boolean', 'cleanPlan avec semaine type : forme', show); }
    C.ok(Array.isArray(pr.off) && pr.off.every(o => ALL_OFF.includes(o)) && ['pd', 'prot', 'starch'].every(k => A.allowed(k, pr.off).length > 0), 'profil : aliments retirés invalides', show);
    const r = A.buildDay(p, A.DEFAULT_CHOICES[js], x);
    C.ok(fin(r.tot.kcal) && fin(r.tot.p), 'buildDay sur profil abîmé : total invalide', show);
    const mp = A.migratePlan(x);
    if (mp !== null) A.buildDay(A.cleanPlan(mp, js), A.DEFAULT_CHOICES[js], x);
    // Choix abîmés : protéine, féculent ou dessert invalides ne doivent pas passer (validés à la lecture dans la page)
    C.ok(A.dessertOf(x) === (typeof x === 'object' && x && has(A.DESSERT, x.dessert) ? x.dessert : 'aucun'), 'dessertOf', show);
    const ro = A.recipeOf(x);
    C.ok(ro === null || (has(A.RECIPES, ro) && A.RECIPES[ro].p === x.prot && A.RECIPES[ro].s === x.starch), 'recipeOf', show);
  } catch (e){ C.ok(false, 'exception sur données abîmées', () => e.message + ' ' + show()); }
}
C.ok(({}).polluted === undefined && !('taille' in {}) && !('seances' in {}), 'Object.prototype pollué', '');

// --- Semaine type : un jour pas encore rempli la reprend ; ce qui est enregistré l'emporte, champ par champ ----------
for (let i = 0; i < N / 3; i++){
  const jours = {};
  for (let js = 0; js < 7; js++) if (R.chance(.5)) jours[js] = randPlan(js, false).seances;
  const sem = A.cleanWeek({ jours, libre: R.int(0, 6) }), js = R.int(0, 6), show = () => JSON.stringify([sem, js]);
  const base = A.emptyPlan(js, sem);
  C.ok(JSON.stringify(base.seances) === JSON.stringify(sem.jours[js] || []) && base.libre === (js === sem.libre), 'jour par défaut ≠ semaine type', show);
  const rec = {}, seances = randPlan(js, false).seances;
  if (R.chance(.5)) rec.seances = seances;
  if (R.chance(.5)) rec.libre = R.chance(.5);
  if (R.chance(.5)) rec.ch = randChoices();
  const p = A.cleanPlan(rec, js, sem), q = () => show() + ' ' + JSON.stringify(rec);
  C.ok(JSON.stringify(p.seances) === JSON.stringify('seances' in rec ? A.cleanSeances(rec.seances) : base.seances), 'séances : enregistrées ou semaine type', q);
  C.ok(p.libre === ('libre' in rec ? rec.libre : base.libre), 'repas libre : enregistré ou semaine type', q);
  C.ok(JSON.stringify(A.cleanWeek(JSON.parse(JSON.stringify(sem)))) === JSON.stringify(sem), 'semaine type relue à l’identique', show);
}

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
      const id = x.buy.id === 'oeuf' ? 'oeufs' : x.buy.id, a = sum[id] || (sum[id] = { g: 0, n: 0, kcal: 0 });
      a.g += x.buy.g || 0; a.n += x.buy.n || 0; a.kcal += x.buy.kcal || 0;
    })));
    const list = A.shoppingList(days), lines = {};
    list.forEach(g => { C.ok(g.lines.length > 0 && typeof g.title === 'string', 'rayon vide', g.title); g.lines.forEach(l => { C.ok(!lines[l.id], 'aliment en double', l.id); lines[l.id] = l; }); });
    C.ok(Object.keys(sum).sort().join() === Object.keys(lines).sort().join(), 'achats oubliés ou en trop dans la liste', () => Object.keys(sum).sort().join() + ' // ' + Object.keys(lines).sort().join());
    Object.entries(lines).forEach(([id, l]) => {
      const a = sum[id] || {};
      [l.qty, l.name, l.note || ''].forEach(t => C.ok(!/NaN|undefined|null|Infinity/.test(t) && !/\d (g|kg|kcal)\b/.test(t), 'liste : texte cassé', () => JSON.stringify(l)));
      if (id === 'oeufs') C.ok(+l.qty === a.n && !l.note && l.name === (a.n > 1 ? 'œufs' : 'œuf'), 'liste : œufs', () => JSON.stringify([l, a]));
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
    C.ok(A.PD_ORDER.includes(c.pdBase), 'tirage : base invalide', show);
    ['dej', 'diner'].forEach(slot => {
      C.ok(has(A.PROT, c[slot].prot) && has(A.STARCH, c[slot].starch) && has(A.DESSERT, c[slot].dessert), 'tirage : choix invalide', show);
      C.ok(c[slot].recette === c[slot].prot + '-' + c[slot].starch && A.recipeOf(c[slot]) === c[slot].recette, 'tirage : recette pas choisie d’office', show);
      seenOpt.add(slot + ':' + c[slot].prot).add(slot + ':' + c[slot].starch).add(slot + ':' + c[slot].dessert);
    });
    seenOpt.add(c.pdBase);
    C.ok(c.dej.prot !== c.diner.prot, 'tirage : même protéine midi et soir', show);
    const r = A.buildDay(A.emptyPlan(R.int(0, 6)), c, {});
    C.ok(fin(r.tot.kcal), 'tirage : journée invalide', show);
  }
  // Valeurs extrêmes du hasard (0 et presque 1) : toujours dans les listes
  [() => 0, () => 0.9999999999].forEach(f => { const c = A.randomChoices(f); C.ok(c.dej.prot !== c.diner.prot && has(A.STARCH, c.diner.starch) && has(A.DESSERT, c.diner.dessert), 'tirage aux bornes', () => JSON.stringify(c)); });
  C.ok(seenOpt.size === A.PD_ORDER.length + 2 * (A.PROT_ORDER.length + A.STARCH_ORDER.length + A.DESSERT_ORDER.length), 'tirage : des choix jamais tirés', () => seenOpt.size + ' choix tirés');
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
      const keep = A.recipeOf({ prot: w[sl].prot, starch: w[sl].starch, recette: c[sl].recette });
      C.ok(w[sl].recette === (keep || undefined), 'withAllowed : recette', wshow);
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

// --- Repères de la semaine et tirage équilibré ----------------------------------------------------------------------
{
  for (let i = 0; i < N / 5; i++){
    const prof = randProfile(), days = Array.from({ length: R.int(1, 7) }, () => A.buildDay(randPlan(R.int(0, 6)), randChoices(), prof));
    const all = A.weekBalance(days), sum = days.map(d => A.weekBalance([d])).reduce((a, b) => { Object.keys(a).forEach(x => { a[x] += b[x]; }); return a; });
    C.ok(Object.keys(all).every(x => Math.abs(all[x] - sum[x]) < 1e-9), 'repères : somme des jours', () => JSON.stringify([all, sum]));
    C.ok(all.gras <= all.poisson && all.poisson <= 2 * days.length && all.legumes <= 2 * days.length && all.rouge >= 0 && all.charcuterie >= 0, 'repères : valeurs', () => JSON.stringify(all));
    days.forEach(d => { const dn = d.secs.find(x => x.id === 'diner'); if (dn.libre) C.ok(JSON.stringify(A.weekBalance([d])) === JSON.stringify(A.weekBalance([{ secs: d.secs.filter(x => x.id !== 'diner') }])), 'repères : repas libre compté', ''); });
    const needs = A.weekNeeds(all);
    C.ok(needs.includes('charcuterie') === all.charcuterie > 150.5 && needs.includes('rouge') === all.rouge > 500.5 && needs.includes('gras') === all.gras < 1 && needs.includes('poisson') === all.poisson < 2 && needs.includes('legumes') === all.legumes < 2, 'besoins de la semaine', () => JSON.stringify([all, needs]));
  }
  for (let i = 0; i < N; i++){
    const off = A.cleanOff(ALL_OFF.filter(() => R.chance(0.2))), k = R.pick([0.65, 0.8, 1, 1.2, 1.4]);
    const bal = { poisson: R.int(0, 3), gras: R.int(0, 1), legumes: R.int(0, 3), rouge: R.between(0, 600, 10), charcuterie: R.between(0, 200, 5) };
    const c = A.randomChoices(R.next, off, bal, k), show = () => JSON.stringify([off, bal, k, c]), ok = kind => A.allowed(kind, off);
    C.ok(ok('pd').includes(c.pdBase) && ['dej', 'diner'].every(sl => ok('prot').includes(c[sl].prot) && ok('starch').includes(c[sl].starch) && ok('dessert').includes(c[sl].dessert)), 'tirage équilibré : aliment retiré', show);
    C.ok(ok('prot').length < 2 || c.dej.prot !== c.diner.prot, 'tirage équilibré : même protéine', show);
    if (c.pdBase === 'sale' && ok('prot').some(p => p !== 'oeufs' && p !== c.dej.prot)) C.ok(c.dej.prot !== 'oeufs' && c.diner.prot !== 'oeufs', 'tirage : œufs + jambon avec le salé', show);
    const jS = Math.round(45 * k / 5) * 5, jO = Math.round(90 * k / 5) * 5, bC = Math.round(150 * k / 10) * 10 * 0.75;
    if (ok('pd').some(x => x !== 'sale') && bal.charcuterie + jS > 150) C.ok(c.pdBase !== 'sale', 'tirage : salé malgré la charcuterie', show);
    // Bœuf écarté s'il reste, pour chaque repas, une autre protéine sous les repères (la règle « pas deux fois la même » passe avant)
    const ham = bal.charcuterie + (c.pdBase === 'sale' ? jS : 0), okProt = p => p !== 'boeuf' && !(p === 'oeufs' && (c.pdBase === 'sale' || ham + jO > 150));
    if (bal.rouge + bC > 500 && ok('prot').filter(okProt).length >= 2) C.ok(c.dej.prot !== 'boeuf' && c.diner.prot !== 'boeuf', 'tirage : bœuf malgré la viande rouge', show);
  }
}

// --- Batch cooking : périodes, nombres de recettes, aliments retirés et corpulences au hasard ---------------------------
{
  let roundSeen = 0, roundMiss = 0;
  const ALL_OFF2 = Object.entries(A.CHOICE_IDS).flatMap(([k, ids]) => ids.map(id => k + ':' + id));
  for (let i = 0; i < N / 3; i++){
    const len = R.chance(.6) ? 7 : R.int(1, 31), n = R.pick([3, 4, 5, 3, 4, 5, 2, 6, 'x']), k = R.pick([0.65, 0.8, 1, 1.2, 1.4]);
    const off = A.cleanOff(ALL_OFF2.filter(() => R.chance(R.pick([0, 0.1, 0.3, 0.6]))));
    const days = Array.from({ length: len }, () => ({ libre: R.chance(.12), long: R.chance(.1) }));
    const cs = A.batchChoices(days, n, off, k, R.next), show = () => JSON.stringify([len, n, k, off, days.map(d => d.libre ? 1 : 0).join('')]);
    if (!C.ok(cs.length === len, 'batch : un choix par jour', show)) continue;
    const ok = kind => A.allowed(kind, off), nn = [3, 4, 5].includes(n) ? n : 4;
    const pool = Object.keys(A.RECIPES).filter(id => ok('prot').includes(A.RECIPES[id].p) && ok('starch').includes(A.RECIPES[id].s));
    const keep = pool.filter(id => A.RECIPES[id].box), gelOk = keep.filter(id => A.RECIPES[id].gel);
    // Protéines qui ne débordent jamais les repères (ni bœuf ni œufs-jambon), en tout et parmi les recettes qui se congèlent bien
    const free = new Set(keep.filter(id => !['boeuf', 'oeufs'].includes(A.RECIPES[id].p)).map(id => A.RECIPES[id].p)).size;
    const freeGel = new Set(gelOk.filter(id => !['boeuf', 'oeufs'].includes(A.RECIPES[id].p)).map(id => A.RECIPES[id].p)).size;
    cs.forEach((c, d) => {
      C.ok(ok('pd').includes(c.pdBase) && ['dej', 'diner'].every(sl => A.recipeOf(c[sl]) === c[sl].recette && ok('prot').includes(c[sl].prot) && ok('starch').includes(c[sl].starch) && ok('dessert').includes(c[sl].dessert)), 'batch : choix invalide ou retiré', () => show() + ' ' + JSON.stringify(c));
      if (keep.length) C.ok(A.RECIPES[c.dej.recette].box && A.RECIPES[c.diner.recette].box, 'batch : recette qui ne se garde pas', show);
      if (c.pdBase === 'sale' && ok('pd').length > 1) C.ok(c.dej.prot !== 'oeufs' && c.diner.prot !== 'oeufs', 'batch : œufs-jambon avec le salé', show);
    });
    for (let b = 0; b < len; b += 7){
      const blk = cs.slice(b, b + 7), bd = days.slice(b, b + 7), served = [];
      blk.forEach((c, d) => { served.push({ d, slot: 'dej', c: c.dej }); if (!bd[d].libre) served.push({ d, slot: 'diner', c: c.diner }); });
      const m = served.length, nr = Math.min(nn, m, Math.max(2, Math.floor(m / 2))), count = {};
      served.forEach(x => { count[x.c.recette] = (count[x.c.recette] || 0) + 1; });
      const cnt = Object.values(count), bshow = () => show() + ' bloc ' + b + ' ' + JSON.stringify(count);
      const pl = keep.length ? keep : pool;
      C.ok(cnt.length <= nr && (pl.length < nr || cnt.length === nr) && (cnt.length < nr || Math.max(...cnt) - Math.min(...cnt) <= 1), 'batch : nombre de recettes ou de boîtes', bshow);
      // Jamais la même protéine midi et soir quand les recettes du bloc ont toutes une protéine différente
      const perP = {};
      Object.entries(count).forEach(([id, x]) => { perP[A.RECIPES[id].p] = (perP[A.RECIPES[id].p] || 0) + x; });
      if (Object.keys(perP).length === cnt.length && cnt.length >= 2 && Object.values(perP).every(x => x <= bd.length) && (bd.length <= 3 || freeGel >= nr)) blk.forEach((c, d) => { if (!bd[d].libre) C.ok(c.dej.prot !== c.diner.prot, 'batch : même protéine midi et soir', bshow); });
      // Qui se congèle mal : dans les 3 premiers jours (assez de recettes qui se congèlent bien, protéines variées)
      if (bd.length > 3 && freeGel >= nr) served.forEach(x => C.ok(A.RECIPES[x.c.recette].gel || x.d < 3, 'batch : se congèle mal, servie après 3 jours', () => bshow() + ' ' + x.c.recette + ' jour ' + x.d));
      // Repères estimés (portions de base) : bœuf et jambon sous leurs limites quand il reste d'autres choix
      const beef = served.filter(x => x.c.prot === 'boeuf').length, oe = served.filter(x => x.c.prot === 'oeufs').length, sale = blk.filter(c => c.pdBase === 'sale').length;
      const enough = (bd.length > 3 ? freeGel : free) >= nr;
      if (enough) C.ok(beef * Math.round(150 * k / 10) * 10 * 0.75 <= 500 + 1e-9, 'batch : viande rouge', bshow);
      // Jambon par paquet (3.17.0) : 0 ou 4 tranches (salé : 1, boîte d'œufs-jambon : 2) ; pas de salé avec les œufs-jambon
      // ni un jour de sortie longue (sauf s'il ne reste que le salé)
      if (ok('pd').some(x => x !== 'sale')){
        C.ok(oe ? sale === 0 : [0, 4].includes(sale), 'batch : jambon, 0 ou 4 tranches', () => bshow() + ' salés ' + sale + ', œufs-jambon ' + oe);
        if (enough) C.ok(oe === 0 || oe === 2, 'batch : œufs-jambon, 2 boîtes', bshow);
        blk.forEach((c, d) => { if (c.pdBase === 'sale') C.ok(!bd[d].long, 'batch : salé un jour de sortie longue', bshow); });
      }
      // Changer une recette (3.16.0) : les recettes proposées sont exactement celles qui respectent les règles (recalculées
      // ici), la remplaçante prend tous les repas de l'ancienne (dîner d'un repas libre compris), rien d'autre ne bouge
      // Parfois, l'autre repas d'un jour où elle est servie a été changé à la main (sans recette)
      const id = R.pick(Object.keys(count)), blk2 = blk.map(c => ({ pdBase: c.pdBase, dej: Object.assign({}, c.dej), diner: Object.assign({}, c.diner) }));
      const hand = served.filter(x => x.c.recette === id && !bd[x.d].libre);
      if (hand.length && R.chance(.5)){ const h = R.pick(hand), o = blk2[h.d][h.slot === 'dej' ? 'diner' : 'dej']; if (o.recette !== id){ o.prot = R.pick(ok('prot')); o.starch = R.pick(ok('starch')); delete o.recette; } }
      const bdays = blk2.map((c, d) => ({ ch: c, libre: bd[d].libre }));
      const opts = A.batchSwapOptions(bdays, id, off, k), sshow = () => bshow() + ' changer ' + id + ' ' + JSON.stringify(blk2);
      const used = blk2.flatMap(c => [c.dej.recette, c.diner.recette]).filter(x => x && x !== id), usedP = used.map(x => A.RECIPES[x].p);
      const mine = served.filter(x => x.c.recette === id), sweet = ok('pd').find(p => p !== 'sale');
      const want = pl.filter(x => {
        const r = A.RECIPES[x];
        if (x === id || used.includes(x) || usedP.includes(r.p)) return false;
        if (mine.some(m => { const o = blk2[m.d][m.slot === 'dej' ? 'diner' : 'dej']; return !bd[m.d].libre && o.recette !== id && o.prot === r.p; })) return false;
        if (!r.gel && bd.length > 3 && mine.some(m => m.d >= 3)) return false;
        if (r.p === 'oeufs' && (mine.length !== 2 || !sweet)) return false;
        const nbf = blk2.reduce((a, c, d) => a + [c.dej, c.diner].filter((m, j) => (m.recette === id ? r.p : m.prot) === 'boeuf' && !(j === 1 && bd[d].libre)).length, 0);
        if (r.p === 'boeuf' && nbf * Math.round(150 * k / 10) * 10 * 0.75 > 500.5) return false;
        return true;
      });
      C.ok(opts.slice().sort().join() === want.slice().sort().join(), 'changer : recettes proposées', () => sshow() + ' ' + JSON.stringify([opts, want]));
      const pk = A.batchSwapPick(bdays, id, off, k, R.next);
      C.ok(opts.length ? opts.includes(pk) : pk === null, 'changer : au hasard', sshow);
      if (opts.length){
        const nid = R.pick(opts), after = A.batchSwap(bdays, id, nid, off), x = A.RECIPES[nid];
        after.forEach((c, d) => ['dej', 'diner'].forEach(sl => {
          const was = blk2[d][sl];
          C.ok(was.recette === id ? c[sl].recette === nid && c[sl].prot === x.p && c[sl].starch === x.s && c[sl].dessert === was.dessert : JSON.stringify(c[sl]) === JSON.stringify(was), 'changer : repas', () => sshow() + ' → ' + nid);
        }));
        if (x.p === 'oeufs') C.ok(after.every(c => c.pdBase !== 'sale'), 'changer : salé avec les œufs-jambon', () => sshow() + ' → ' + nid);
        after.forEach((c, d) => { if (!bd[d].libre && blk2[d].dej.prot !== blk2[d].diner.prot) C.ok(c.dej.prot !== c.diner.prot, 'changer : même protéine midi et soir', () => sshow() + ' → ' + nid + ' jour ' + d); });
      }
    }
    // Fiche : boîtes = repas servis des recettes qui se gardent (deux fois au moins par bloc), totaux = somme des boîtes
    if (i % 3) continue;
    // Chiffres ronds (3.17.0), une période sur trois : séances au hasard, protéine de chaque recette arrondie aux 100 g
    const prof = randProfile(), roundIt = i % 9 === 0;
    const plansF = days.map((d, j) => A.cleanPlan({ seances: d.long ? [{ taille: 'longue', moment: 'matin', duree: R.pick([1.5, 2, 3]) }] : R.chance(.5) ? [] : [{ taille: R.pick(['petite', 'moyenne']), moment: R.pick(['matin', 'midi', 'soir']) }], libre: d.libre }, j % 7));
    const chs = roundIt ? A.batchRound(plansF.map((plan, d) => ({ plan, ch: cs[d] })), prof) : cs;
    const res = chs.map((c, d) => A.buildDay(plansF[d], c, prof));
    if (roundIt){
      const strip = c => JSON.stringify(c, (key, v) => key === 'g' || key === 'g2' ? undefined : v);
      const nrm = (cc, d) => A.buildDay(Object.assign({}, plansF[d], { libre: false }), cc[d], prof);
      const band = r => Math.max(0, r.prot.low - r.tot.p, r.tot.p - r.prot.high), off3 = r => Math.abs(r.tot.kcal - r.energy.target) / r.energy.target;
      chs.forEach((c, d) => {
        C.ok(strip(c) === strip(cs[d]), 'arrondi : plats changés', show);
        const a = nrm(chs, d), b = nrm(cs, d);
        C.ok(band(a) <= band(b) + 1e-9 && off3(a) <= Math.max(0.03, off3(b)) + 1e-9, 'arrondi : protéines ou énergie plus loin', () => show() + ' jour ' + d + ' ' + JSON.stringify(prof));
        ['dej', 'diner'].forEach(sl => { const fx = A.fixedGrams(c[sl]); if (fx) ['p1', 'p2'].forEach((key, j) => { if (fx[j] !== null){ const it = res[d].secs.find(s => s.id === sl).items.find(x => x.key === key); C.ok(!it || (it.buy.g === fx[j] && !it.adj), 'arrondi : poids fixé ≠ ligne', show); } }); });
      });
    }
    const lead = R.pick([0, 1]), blocks = A.batchCook(res.map(r => ({ res: r })), lead);
    blocks.forEach(bl => bl.recipes.forEach(r => {
      // Arrondie : la protéine de toutes ses boîtes fait un compte rond
      const fixed = chs.slice(bl.start, bl.start + 7).flatMap((c, d) => ['dej', 'diner'].filter(sl => c[sl].recette === r.id && !(sl === 'diner' && days[bl.start + d].libre)).map(sl => c[sl]));
      if (roundIt && A.RECIPES[r.id].p !== 'oeufs' && fixed.length && fixed.every(m => 'g' in m)){
        roundSeen++;
        const t = r.totals.find(z => z.id === A.RECIPES[r.id].p), q = Number(t.qty.replace(/[^\d,]/g, '').replace(',', '.')) * (/kg$/.test(t.qty) ? 1000 : 1);
        C.ok(q % 100 === 0, 'arrondi : total pas rond', () => show() + ' ' + r.id + ' ' + t.qty);
      } else if (roundIt && A.BATCH_GRAMS[A.RECIPES[r.id].p] && A.RECIPES[r.id].p !== 'oeufs') roundMiss++;
      const secs = res.slice(bl.start, bl.start + 7).flatMap((x, d) => x.secs.filter(s => s.recipe === r.id && !s.libre).map(s => ({ s, d })));
      C.ok(r.boxes.length === secs.length && secs.length >= 2 && A.RECIPES[r.id].box, 'fiche : boîtes', () => show() + ' ' + r.id);
      r.boxes.forEach((bx, j) => C.ok(bx.day === bl.start + secs[j].d && bx.fridge === (secs[j].d + (bl.start === 0 && lead === 0 ? 0 : 1) <= 3), 'fiche : jour ou frigo', () => show() + ' ' + JSON.stringify(bx)));
      const sum = {};
      secs.forEach(({ s }) => s.items.filter(x => /^(p1|p2|st|[vfx]-)/.test(x.key)).forEach(x => { const a = sum[x.buy.id] || (sum[x.buy.id] = { g: 0, n: 0 }); a.g += x.buy.g || 0; a.n += x.buy.n || 0; }));
      C.ok(Object.keys(sum).sort().join() === r.totals.map(t => t.id).sort().join(), 'fiche : aliments à cuire', () => r.id);
      r.totals.forEach(t => {
        const a = sum[t.id], q = Number(t.qty.replace(/[^\d,]/g, '').replace(',', '.')) * (/kg$/.test(t.qty) ? 1000 : 1);
        C.ok(a && Math.abs(q - (a.n || a.g)) <= (a.g >= 1000 ? 5 : 1e-9), 'fiche : quantité à cuire ≠ somme des boîtes', () => r.id + ' ' + JSON.stringify([t, a]));
        [t.qty, t.name, t.note || ''].forEach(x => C.ok(!/NaN|undefined|null/.test(x) && !/\d (g|kg)\b/.test(x), 'fiche : texte cassé', () => JSON.stringify(t)));
      });
    }));
  }
  C.ok(roundSeen >= 0.85 * (roundSeen + roundMiss), 'arrondi : trop peu de recettes arrondies', () => roundSeen + ' sur ' + (roundSeen + roundMiss));
}

// --- D. Données : complètes et cohérentes ------------------------------------------------------------------------
// Recettes : une par couple, légumes et matières grasses connus (table, nom, rayon des courses)
A.PROT_ORDER.forEach(p => A.STARCH_ORDER.forEach(s => C.ok(JSON.stringify(A.recipesFor(p, s)) === JSON.stringify([p + '-' + s]), 'recette manquante', p + ' × ' + s)));
C.ok(Object.keys(A.RECIPES).length === A.PROT_ORDER.length * A.STARCH_ORDER.length, 'recettes en trop', '');
const aisles = A.SHOP_AISLES.flatMap(g => g.ids), refKeys = A.refTable().flatMap(g => g.rows.map(x => x.key));
Object.keys(A.RFOOD).forEach(id => C.ok(has(A.FOOD, id) && aisles.includes(id) && refKeys.includes(id), 'aliment de recette sans valeurs, rayon ou ligne de la table', id));
Object.values(A.RECIPES).forEach(x => {
  Object.keys(x.leg).forEach(v => C.ok(A.VEG_IDS.includes(v), 'légume inconnu', x.p + '-' + x.s + ' ' + v));
  x.cuis.forEach(c => C.ok(has(A.FOOD, c[0]) && aisles.includes(c[0]) && BYNAME[c[2]] && BYNAME[c[2]][1] === c[0], 'matière grasse inconnue', x.p + '-' + x.s + ' ' + c[0]));
});
C.ok(Object.keys(A.PROT).sort().join() === A.PROT_ORDER.slice().sort().join(), 'PROT_ORDER ≠ PROT', '');
C.ok(Object.keys(A.STARCH).sort().join() === A.STARCH_ORDER.slice().sort().join(), 'STARCH_ORDER ≠ STARCH', '');
C.ok(Object.keys(A.DESSERT).sort().join() === A.DESSERT_ORDER.slice().sort().join(), 'DESSERT_ORDER ≠ DESSERT', '');
C.ok(Object.keys(A.DEFAULT_CHOICES).length === 7, 'choix par défaut : 7 jours', '');
Object.entries(A.DEFAULT_CHOICES).forEach(([js, c]) => C.ok(A.PD_ORDER.includes(c.pdBase) && ['dej', 'diner'].every(s => has(A.PROT, c[s].prot) && has(A.STARCH, c[s].starch)), 'choix par défaut invalide', js));
A.STARCH_ORDER.forEach(id => { const S = A.STARCH[id]; C.ok(S.cap > 0 && S.step > 0 && S.f.length === 4 && S.label && S.name && (!S.cook || S.raw), 'féculent incomplet', id); });
// Valeurs des aliments : 4 nombres ≥ 0, énergie cohérente avec 4/4/9 à 20 % près (fibres, alcools de sucre, arrondis)
const tables = [['FOOD', A.FOOD], ['UNIT', A.UNIT], ['STARCH', Object.fromEntries(A.STARCH_ORDER.map(id => [id, A.STARCH[id].f]))]];
tables.forEach(([name, tab]) => Object.entries(tab).forEach(([key, v]) => {
  C.ok(v.length === 4 && v.every(x => fin(x) && x >= 0), 'valeurs d’aliment invalides', name + '.' + key);
  // Légumes : leurs fibres comptent (2 kcal/g), écart toléré jusqu'à 10 kcal pour 100 g
  C.ok(Math.abs(4 * v[1] + 4 * v[2] + 9 * v[3] - v[0]) <= Math.max(0.2 * v[0], 10), 'énergie ≠ 4/4/9 à 20 % près', () => name + '.' + key + ' ' + v.join(' '));
  C.ok(v[1] + v[2] + v[3] <= (name === 'UNIT' ? 200 : 100), 'plus de 100 g de macros pour 100 g', name + '.' + key);
}));
Object.entries(A.PROFILE_RANGES).forEach(([key, b]) => { const d = A.PROFILE_DEFAULT[key]; C.ok(d === null || (d >= b[0] && d <= b[1]), 'profil par défaut hors bornes', key); });
// Textes des données : typographie française (espace insécable avant : ; ? ! % et les unités, apostrophe courbe)
const strs = [];
const walk = o => { if (typeof o === 'string') strs.push(o); else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
walk([A.RECIPES, A.RFOOD, A.STARCH, A.SIZES, A.DUREES, A.MOMENTS, A.refTable(), A.PROT_ORDER.map(p => A.PROT[p].label), A.DESSERT_ORDER.map(d => A.DESSERT[d].label)]);
A.DESSERT_ORDER.filter(d => d !== 'aucun').forEach(d => walk(A.DESSERT[d].item()));
strs.forEach(s => {
  C.ok(!/\d (g|kcal|km|%|h)\b/.test(s) && !/ [:;?!%»]/.test(s) && !/« /.test(s), 'typographie des données', () => JSON.stringify(s));
  C.ok(!/'/.test(s), 'apostrophe droite dans les données', () => JSON.stringify(s));
});

assert(C.checks > N * 50, 'trop peu de vérifications : ' + C.checks);
C.done(N + ' journées au hasard, ' + Math.round(N / 3) + ' comparaisons, ' + N * 2 + ' données abîmées, ' + C.checks + ' vérifications, graine ' + seed);
