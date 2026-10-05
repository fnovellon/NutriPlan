/* Lignes de chaque repas : petit-déjeuner, collation, shaker, goûter, ravito ; déjeuner et dîner (protéine, féculent dosé
   ensuite, légumes ou recette, ajout du soir). Portions × k (poids), × kp (k × facteur de protéines) pour celles ajustées. */
/* Petit-déjeuner : menu de sortie longue si longue ; banane dès qu'il y a une séance moyenne ou longue */
function breakfast(long, banane, base, k, kp){
  const items = [];
  /* Salé : pain complet, œufs et une tranche de jambon (portions fixes comme les œufs), sans skyr ni amandes.
     Les jours de sortie longue, version sucrée au pain (plus digeste 1h30 avant de partir). */
  if (base === 'sale' && !long){
    const g = sc(80, 10, k), n = pieces(2, k), j = sc(45, 5, k);
    items.push(it('base', grams(g), 'pain complet', slices(g, 40), mac('pain', g)));
    items.push(it('oeufs', String(n), n > 1 ? 'œufs' : 'œuf', n > 1 ? 'à la coque, pochés ou brouillés sans matière grasse' : 'à la coque, poché ou brouillé sans matière grasse', unitMac('oeuf', n)));
    items.push(it('jambon', grams(j), 'jambon blanc', slices(j, 45), mac('jambon', j)));
    if (banane) items.push(it('fruit', '1', 'banane', null, unitMac('banane', 1)));
    else items.push(it('fruit', grams(125), 'fruits rouges', 'surgelés, c’est parfait', mac('fruitsRouges', 125)));
    return items;
  }
  if (base === 'pain' || base === 'sale'){
    const g = sc(long ? 110 : 80, 10, k);
    items.push(it('base', grams(g), 'pain complet', slices(g, 40) + (base === 'sale' ? ', en version sucrée avant la sortie longue (plus digeste)' : ''), mac('pain', g)));
  }
  /* Avec les flocons, jamais moins de 2,5 fois leur poids en skyr (3.19.0, arrondi à 10 g au-dessus) : sinon le porridge ou
     les flocons trempés ne se mangent pas. Comme SKYR_MIN, ce plancher ne suit pas l'objectif de protéines. */
  let skyrOats = 0;
  if (base !== 'pain' && base !== 'sale'){
    const g = sc(long ? 80 : 60, 5, k);
    items.push(it('base', grams(g), 'flocons d’avoine ou muesli', 'muesli sans sucre ajouté. En porridge, ou trempés la veille dans le skyr', mac('avoine', g)));
    skyrOats = Math.ceil(g * OATS_SKYR / 10) * 10;
  }
  const sk = Math.max(SKYR_MIN, skyrOats, sc(long ? 150 : 250, 10, kp));
  items.push(adj(it('skyr', grams(sk), 'skyr nature', null, mac('skyr', sk))));
  if (long || banane){
    items.push(it('fruit', '1', 'banane', null, unitMac('banane', 1)));
  } else {
    items.push(it('fruit', grams(125), 'fruits rouges', 'surgelés, c’est parfait', mac('fruitsRouges', 125)));
  }
  if (long){ const mi = sc(15, 5, k); items.push(it('miel', grams(mi), 'miel', null, mac('miel', mi))); }
  const am = sc(15, 5, k);
  items.push(it('am', grams(am), 'amandes', null, mac('amandes', am)));
  return items;
}
/* Collation : œufs, + banane s'il y a une séance, + compote s'il y a une moyenne ou une longue */
/* Déjà des œufs dans la journée (petit-déjeuner salé, « Œufs + jambon ») : skyr et amandes à la place, presque la même
   chose (2 œufs : 144 kcal, 12,6 g de protéines, 9,6 g de lipides ; 100 g de skyr et 15 g d'amandes : 151, 14, 7,9) */
function snackItems(seance, grosse, k, oeufs){
  const n = pieces(2, k), items = [];
  if (oeufs){
    const sk = Math.max(SKYR_MIN, sc(100, 10, k)), am = sc(15, 5, k);
    items.push(it('csk', grams(sk), 'skyr nature', 'à la place des œufs, déjà au menu aujourd’hui', mac('skyr', sk)));
    items.push(it('cam', grams(am), 'amandes', null, mac('amandes', am)));
  } else items.push(it('oe', String(n), n > 1 ? 'œufs' : 'œuf', n > 1 ? 'durs ou mollets, préparés à l’avance' : 'dur ou mollet, préparé à l’avance', unitMac('oeuf', n)));
  if (seance) items.push(it('ban', '1', 'banane', null, unitMac('banane', 1)));
  if (grosse) items.push(it('comp', '1', 'compote', 'sans sucre ajouté', unitMac('compote', 1)));
  return items;
}
/* Shaker de protéines, une dose à l'eau : protéines saisies (au plus kcal / 4),
   le reste des kcal partagé à parts égales entre glucides et lipides */
function shakerMac(p){
  const prot = Math.min(p.shakerProt, p.shakerKcal / 4), rest = p.shakerKcal - 4 * prot;
  return {kcal:p.shakerKcal, p:prot, c:rest / 8, f:rest / 18};
}
function shakerItem(p){ return it('shk', '1', 'shaker de protéines', 'une dose, à l’eau', shakerMac(p), null, {id:'shaker', n:1}); }
function gouterItems(k, kp){
  const sk = Math.max(SKYR_MIN, sc(150, 10, kp)), am = sc(15, 5, k);
  return [
    adj(it('skyr', grams(sk), 'skyr nature', null, mac('skyr', sk))),
    it('pom', '1', 'pomme', null, unitMac('pomme', 1)),
    it('am', grams(am), 'amandes', null, mac('amandes', am))
  ];
}
function adj(item){ item.adj = true; return item; }
/* Féculent dosé en calories : changer de féculent ne change pas le total de la journée */
function starchItem(id, kcal){
  const S = STARCH[id];
  const q = Math.max(S.step, Math.round(kcal / (S.f[0] / 100) / S.step) * S.step);
  const k = q / 100;
  return it('st', grams(q), S.name, null, {kcal:S.f[0]*k, p:S.f[1]*k, c:S.f[2]*k, f:S.f[3]*k},
    S.cook ? {raw:S.raw, ways:S.cook.map(function(w){ return {g:Math.round(q * w[0] / 10) * 10, adj:w[1]}; })} : null, {id:id, g:q});
}
function dessertOf(choice){ return choice && has(DESSERT, choice.dessert) ? choice.dessert : 'aucun'; }
/* Repas : protéine, féculent (dosé ensuite), légumes ou ceux de la recette choisie (avec sa matière grasse et ses ajouts),
   puis l'ajout du soir (amandes, parmesan), avec la note de la recette s'il y en a une */
/* Batch cooking, chiffres ronds (3.17.0) : poids fixés d'une boîte, choice.g (ligne p1) et choice.g2 (p2), au pas de la
   portion (0 : pas fixé) ; seulement avec une recette qui va (recipeOf). Crevettes : g2 = halloumi ; œufs-jambon : g2 = jambon
   (les œufs restent à l'unité). Une portion fixée n'est pas ajustée à l'objectif de protéines (pas adj).
   @returns {?Array<?number>} [p1, p2], null si rien n'est fixé */
const BATCH_GRAMS = {poulet:[10, 0], boeuf:[10, 0], poisson:[10, 0], saumon:[10, 0], crevettes:[10, 5], tofu:[10, 0], oeufs:[0, 5]};
function fixedGrams(choice){
  if (!choice || !has(BATCH_GRAMS, choice.prot) || !recipeOf(choice)) return null;
  const st = BATCH_GRAMS[choice.prot];
  const ok = function(v, s){ return s > 0 && Number.isInteger(v) && v >= s && v <= 1000 && v % s === 0; };
  const g = [ok(choice.g, st[0]) ? choice.g : null, ok(choice.g2, st[1]) ? choice.g2 : null];
  return g[0] === null && g[1] === null ? null : g;
}
function mainItems(slot, choice, k, kp){
  const P = PROT[choice.prot], rec = recipeOf(choice), extra = P[slot](k), fx = P.fixe ? null : fixedGrams(choice);
  if (rec && RECIPES[rec].soir) extra.forEach(function(i){ i.note = RECIPES[rec].soir; });
  return P.base(P.fixe ? k : kp, fx).map(function(i){ return P.fixe || (fx && fx[i.key === 'p2' ? 1 : 0] !== null) ? i : adj(i); }).concat([it('st', '', '', null, null)],
    rec ? recipeItems(rec) : [it('leg', grams(250), 'légumes', 'au moins, et plus si tu as faim (≈' + NB + '30' + NB + 'kcal les 100' + NB + 'g)', mac('legumes', 250))], extra);
}
function fuel(d, rate){
  const g = Math.round(rate * d / 5) * 5;
  return it('fuel', grams(g), 'glucides pendant l’effort', rate + NB + 'g par heure' + NB + ': boisson d’effort, gels ou pâtes de fruits', {kcal:g * 4, p:0, c:g, f:0}, null, {id:'ravito', g:g});
}
