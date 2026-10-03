/* La journée : limites (féculents, lipides, protéines), partage des féculents entre déjeuner et dîner, construction de la
   journée pour un facteur de protéines donné (composeDay) et recherche de ce facteur (buildDay). Règles : CLAUDE.md,
   « Règles de calcul », « Objectif de protéines », « Portions au poids ». */
/* Féculent de chaque repas : plancher en énergie (90 kcal à 72 kg, ≈ 20 g de glucides) et plafond en grammes, une
   portion sportive (cap de STARCH, à 72 kg : 120 g de grains crus, 100 g de lentilles, 400 g de pommes de terre ou de
   patate douce, 300 g de gnocchis) ; les deux × k. Au-delà, un budget d'encas (voir composeDay). */
const STARCH_MIN = 90;
function starchCap(id, k){ const S = STARCH[id]; return S.cap * k * S.f[0] / 100; }
/* Lipides à 72 kg, mis à l'échelle k : plancher 55 g (≈ 0,76 g/kg), plafond 95 g */
const FAT_MIN = 55, FAT_MAX = 95;
/* Protéines : objectif = g/kg du profil × poids (borné comme les portions, 47 à 101 kg), à ±10 % sur la journée.
   Les portions de viande, poisson, œufs (déjeuner, dîner) et le skyr (petit-déjeuner, goûter) sont multipliées par un
   facteur pf, borné à 0,5-1,5, qui reste le plus près possible de 1 (le menu de référence) : il ne bouge que si la
   journée sort de la fourchette, et juste assez pour y rentrer. */
const PROT_BAND = 0.1, PF_MIN = 0.5, PF_MAX = 1.5;
/* Skyr du petit-déjeuner et du goûter : jamais moins d'un petit pot */
const SKYR_MIN = 100;
function protTarget(p){ return p.prot * REF_KG * scaleOf(p); }
/* Partage l'énergie des féculents entre déjeuner et dîner, entre plancher et plafond (caps : kcal du plafond de chaque repas).
   off : kcal du dessert de chaque repas, prises sur le féculent du même repas (l'autre compense s'il touche une limite).
   rest > 0 : les deux sont au plafond ; rest < 0 : les deux sont au plancher. */
function splitStarch(budget, share, k, off, caps){
  const o = off || {dej:0, diner:0};
  const lo = STARCH_MIN * k;
  const clampA = function(x){ return Math.min(Math.max(lo, caps.dej), Math.max(lo, x)); };
  const clampB = function(x){ return Math.min(Math.max(lo, caps.diner), Math.max(lo, x)); };
  const avail = budget - o.dej - o.diner;
  let ka = clampA(budget * share - o.dej);
  const kb = clampB(avail - ka);
  ka = clampA(avail - kb);
  return {dej:ka, diner:kb, rest:avail - ka - kb};
}
function setStarch(sec, item){ sec.items = sec.items.map(function(i){ return i.key === 'st' ? item : i; }); }
function allItems(secs){ return secs.reduce(function(a, s){ return a.concat(s.items); }, []); }
/* Construit la journée pour un facteur de protéines pf donné (voir buildDay).
   @param {Plan} plan  @param {Choices} ch  @param {Profile} pr  @param {number} pf */
function composeDay(plan, ch, pr, pf){
  const en = energy(plan, pr);
  const S = plan.seances.slice().sort(function(a, b){ return MOMENT_RANK[a.moment] - MOMENT_RANK[b.moment]; });
  const at = function(m){ return S.filter(function(x){ return x.moment === m; }); };
  const matin = at('matin'), midi = at('midi'), soir = at('soir');
  const long = S.some(function(x){ return x.taille === 'longue'; });
  const grosse = S.some(function(x){ return x.taille !== 'petite'; });
  const last = S.length ? S[S.length - 1].moment : null;
  const k = scaleOf(pr), kp = k * pf, shaker = pr.shaker === 'oui', protFloor = (1 - PROT_BAND) * protTarget(pr);
  /* Œufs déjà au menu (petit-déjeuner salé hors sortie longue, « Œufs + jambon » midi ou soir) : pas d'œufs à la collation */
  const oeufs = (ch.pdBase === 'sale' && !long) || ch.dej.prot === 'oeufs' || ch.diner.prot === 'oeufs';
  const secs = [];

  const pd = {id:'pd', title:'Petit-déjeuner', when:null, pick:'pd', items:breakfast(long, grosse, ch.pdBase, k, kp)};
  if (long) pd.when = '1h30 à 2' + NB + 'h avant la sortie';
  else if (matin.length) pd.when = '1h30 avant la séance';
  secs.push(pd);

  /* recipe : la recette choisie ; suggest : celle proposée pour la protéine et le féculent du repas */
  const meal = function(slot, title){
    const c = ch[slot];
    return {id:slot, title:title, when:null, pick:slot, items:mainItems(slot, c, k, kp), recipe:recipeOf(c), suggest:recipesFor(c.prot, c.starch)[0] || null};
  };
  const lunch = meal('dej', 'Déjeuner'), dinner = meal('diner', 'Dîner');
  let co = null, nb = 0;
  /* Marge cuisine : kcal réservées pour la matière grasse de cuisson et les ajouts, moitié au déjeuner, moitié au dîner,
     comptées en lipides (l'huile de cuisson en est l'essentiel). Un repas avec une recette choisie a sa propre matière grasse. */
  const margeDej = Math.round(pr.marge / 2 / 5) * 5;
  [[lunch, margeDej], [dinner, pr.marge - margeDej]].forEach(function(x){
    if (x[1] > 0 && !x[0].recipe) x[0].items.push(it('marge', '≈' + NB + x[1], 'kcal pour la cuisine', 'huile de cuisson, sauce, fromage râpé… (les épices ne comptent pas)', {kcal:x[1], p:0, c:0, f:x[1] / 9}, null, {id:'marge', kcal:x[1]}));
  });
  /* Dessert choisi, en fin de repas */
  [[lunch, ch.dej], [dinner, ch.diner]].forEach(function(x){
    const d = dessertOf(x[1]);
    if (d !== 'aucun') x[0].items.push(DESSERT[d].item());
  });

  /* Un bandeau par séance, à son moment */
  const bands = function(list){
    list.forEach(function(x){
      const b = {band:true, id:'band' + (nb++), title:SIZES[x.taille].band, sub:null, items:[]};
      if (x.taille === 'longue'){ b.sub = 'Vélo ou course, ' + dureeLabel(x.duree) + '.'; b.items = [fuel(x.duree, pr.ravito)]; }
      secs.push(b);
    });
  };
  /* Shaker (s'il est pris) juste après la dernière séance du jour ; sans séance, dans la collation de l'après-midi */
  const shakerSec = function(when){ if (shaker) secs.push({id:'shk', title:'Shaker', when:when, items:[shakerItem(pr)]}); };

  if (matin.length){
    bands(matin);
    if (!long && !soir.length){
      co = {id:'co', title:'Collation', when:'juste après la séance', items:snackItems(true, grosse, k, oeufs)};
      if (last === 'matin' && shaker) co.items.push(shakerItem(pr));
      secs.push(co);
    } else if (last === 'matin'){
      shakerSec(long ? 'juste après la sortie' : 'juste après la séance');
    }
  }
  if (midi.length){
    secs.push({id:'sw', title:'Avant la séance', when:'vers 11' + NB + 'h' + NB + '30', items:[it('ban', '1', 'banane', null, unitMac('banane', 1))]});
    bands(midi);
    if (last === 'midi') shakerSec('juste après la séance');
    lunch.when = 'après la séance';
    if (dessertOf(ch.dej) === 'aucun') lunch.items.push(it('comp', '1', 'compote', 'sans sucre ajouté, en dessert', unitMac('compote', 1)));
  } else if (long){
    lunch.when = 'après la sortie';
  }
  secs.push(lunch);
  if (!co){
    if (long) co = {id:'co', title:'Goûter', when:null, items:gouterItems(k, kp)};
    else if (soir.length) co = {id:'co', title:'Collation', when:'1h30 avant la séance', items:snackItems(true, grosse, k, oeufs)};
    else co = {id:'co', title:'Collation', when:'dans l’après-midi', items:snackItems(S.length > 0, grosse, k, oeufs)};
    if (!S.length && shaker) co.items.push(shakerItem(pr));
    secs.push(co);
  }
  if (soir.length){
    bands(soir);
    shakerSec('juste après la séance');
    dinner.when = 'après la séance';
  }
  secs.push(dinner);

  /* Les féculents complètent jusqu'à l'objectif, répartis selon les séances qui précèdent chaque repas.
     Au-delà de leur plafond (une portion sportive), le reste devient un budget d'encas dans la collation (ou le goûter),
     compté en glucides. */
  const before = matin.concat(midi).reduce(function(a, x){ return a + seanceCost(x, pr); }, 0);
  const after = soir.reduce(function(a, x){ return a + seanceCost(x, pr); }, 0);
  const wDej = 45 + 0.05 * before, wDiner = 30 + 0.02 * before + 0.07 * after;
  const fill = function(){
    co.items = co.items.filter(function(i){ return i.key !== 'encas'; });
    const fixed = total(allItems(secs).filter(function(i){ return i.key !== 'st' && i.key !== 'des'; })).kcal;
    const des = function(sec){ return total(sec.items.filter(function(i){ return i.key === 'des'; })).kcal; };
    const sp = splitStarch(en.target - fixed, wDej / (wDej + wDiner), k, {dej:des(lunch), diner:des(dinner)},
      {dej:starchCap(ch.dej.starch, k), diner:starchCap(ch.diner.starch, k)});
    setStarch(lunch, starchItem(ch.dej.starch, sp.dej));
    setStarch(dinner, starchItem(ch.diner.starch, sp.diner));
    if (sp.rest >= 30){
      const kc = Math.round(sp.rest / 10) * 10;
      co.items.push(it('encas', '≈' + NB + fmtInt(kc), 'kcal d’encas', 'pour tes séances, à répartir autour d’elles si c’est beaucoup' + NB + ': pain complet et miel, fruits secs, riz au lait, barre de céréales', {kcal:kc, p:0, c:kc / 4, f:0}, null, {id:'encas', kcal:kc}));
    }
  };
  fill();
  let tot = total(allItems(secs));
  /* Planchers, revérifiés ensemble car chaque ajout réajuste les féculents (qui portent un peu de protéines et de lipides).
     Aussi le jour du repas libre : la journée est d'abord celle d'un jour normal, puis seul le dîner est remplacé.
     - protéines (objectif hors d'atteinte des portions, thon deux fois…) : skyr le soir, 150 g × k, un peu plus si besoin (jusqu'au double) ;
     - lipides (peu ou pas de marge cuisine, petites portions) : de l'huile en plus au dîner. */
  let skyr = 0, gras = 0, soirSec = null;
  const skyrMax = sc(300, 10, k);
  for (let pass = 0; pass < 12; pass++){
    const lowP = tot.p < protFloor && skyr < skyrMax, lowF = tot.f < FAT_MIN * k && gras < 60;
    if (!lowP && !lowF) break;
    /* Protéines d'abord : le skyr réajuste les féculents et apporte un peu de lipides, l'huile est revue au passage suivant */
    if (lowP){
      skyr = skyr ? Math.min(skyrMax, skyr + Math.max(10, Math.ceil((protFloor - tot.p) / 0.105 / 10) * 10)) : sc(150, 10, k);
      const item = it('skyr', grams(skyr), 'skyr nature', null, mac('skyr', skyr));
      if (soirSec) soirSec.items = [item];
      else { soirSec = {id:'soir', title:'Soir', when:'pour compléter tes protéines', items:[item]}; secs.push(soirSec); }
    }
    else {
      gras += Math.ceil((FAT_MIN * k - tot.f + 0.5) / 5) * 5;
      dinner.items = dinner.items.filter(function(i){ return i.key !== 'gras'; });
      dinner.items.push(it('gras', grams(gras), 'huile d’olive', 'en plus, pour tes lipides', mac('huile', gras)));
    }
    fill();
    tot = total(allItems(secs));
  }
  const ecart = tot.kcal - en.target;

  /* Repas libre : remplace le dîner du jour normal et son skyr du soir s'il y en a un (budget = les deux + 300 × k) */
  let libre = null;
  if (plan.libre){
    const soirKcal = soirSec ? total(soirSec.items).kcal : 0;
    if (soirSec) secs.splice(secs.indexOf(soirSec), 1);
    libre = Math.round((total(dinner.items).kcal + soirKcal + 300 * k) / 50) * 50;
    secs[secs.indexOf(dinner)] = {id:'diner', title:'Repas libre', when:(dinner.when ? dinner.when + ', ' : '') + 'resto ou entre amis', libre:true,
      items:[it('lib', fmtInt(libre), 'kcal environ', 'de quoi te faire plaisir, sans peser', {kcal:libre, p:0, c:0, f:0}, null, {id:'libre', n:1, kcal:libre})]};
    tot = total(allItems(secs));
  }
  const adjP = total(allItems(secs).filter(function(i){ return i.adj; })).p, soirP = soirSec && !plan.libre ? total(soirSec.items).p : 0;
  return {secs:secs, tot:tot, libre:libre, energy:en, ecart:ecart, scale:k, adjP:adjP, soirP:soirP};
}
/* Journée complète. Le facteur de protéines pf part de 1 (menu de référence) et ne bouge que si les protéines de la journée
   sortent de la fourchette objectif ± 10 % : il vise alors juste à l'intérieur (à 2 % du bord, pour absorber les arrondis).
   Quelques passes, car les féculents réajustés portent aussi des protéines. Le jour du repas libre, pf est cherché sur
   la même journée sans repas libre (le repas libre n'a pas de macros connues).
   @param {Plan} plan  @param {Choices} ch  @param {*} [profile] champs du profil, validés ici  @returns {Day} */
function buildDay(plan, ch, profile){
  const pr = cleanProfile(profile), T = protTarget(pr), lo = (1 - PROT_BAND) * T, hi = (1 + PROT_BAND) * T;
  const base = plan.libre ? Object.assign({}, plan, {libre:false}) : plan;
  let pf = 1, r = composeDay(base, ch, pr, pf);
  for (let pass = 0; pass < 5; pass++){
    const P = r.tot.p - r.soirP, adj1 = r.adjP / pf;
    if (P >= lo && P <= hi) break;
    /* Rien d'ajustable (thon midi et soir, petit-déjeuner salé) : la journée ne dépend pas de pf, comptée en butée */
    if (adj1 <= 0){ pf = P > hi ? PF_MIN : PF_MAX; break; }
    const aim = P > hi ? hi - 0.02 * T : lo + 0.02 * T;
    const next = Math.min(PF_MAX, Math.max(PF_MIN, (aim - (P - r.adjP)) / adj1));
    /* Presque rien à gagner : on s'arrête, sauf pour atteindre la borne (une pièce d'œuf peut en dépendre) */
    if (next === pf || (Math.abs(next - pf) < 0.01 && next > PF_MIN && next < PF_MAX)) break;
    pf = next;
    r = composeDay(base, ch, pr, pf);
  }
  if (plan.libre) r = composeDay(plan, ch, pr, pf);
  r.prot = {target:T, low:lo, high:hi, floor:lo, factor:pf};
  delete r.adjP; delete r.soirP;
  return r;
}
