/* Lignes de chaque repas : petit-déjeuner, collation, shaker, goûter, ravito ; déjeuner et dîner (protéine, féculent dosé
   ensuite, légumes ou recette, ajout du soir). Portions × k (poids), × kp (k × facteur de protéines) pour celles ajustées. */
/* Petit-déjeuner : menu de sortie longue si long ; banane dès qu'il y a une séance moyenne ou longue (banane).
   Bases (PD) : avoine, pain, salé, et depuis la 3.29.0 sept recettes. Portions × k ; le skyr × kp (ajusté à l'objectif de
   protéines, jamais sous SKYR_MIN) ; œufs et jambon fixes (× k). Les bases salées (PD[base].sale) laissent la place, les
   jours de sortie longue, à la version sucrée au pain (plus digeste 1h30 avant de partir) ; les recettes sucrées y prennent
   un peu plus de flocons (+ 20 g) ou de pain (+ 30 g) et 15 g de miel. */
function breakfast(long, banane, base, k, kp){
  const items = [];
  const fruit = function(g){
    if (banane || long) items.push(it('fruit', '1', 'banane', null, unitMac('banane', 1)));
    else items.push(it('fruit', grams(g), 'fruits rouges', 'surgelés, c’est parfait', mac('fruitsRouges', g)));
  };
  /* Skyr ajusté à l'objectif de protéines, jamais sous un petit pot (ni sous min) */
  const skyr = function(ref, note, min){ const g = Math.max(SKYR_MIN, min || 0, sc(ref, 10, kp)); items.push(adj(it('skyr', grams(g), 'skyr nature', note, mac('skyr', g)))); };
  const miel = function(){ if (long){ const g = sc(15, 5, k); items.push(it('miel', grams(g), 'miel', null, mac('miel', g))); } };
  const eggs = function(n, note1, noteN){ items.push(it('oeufs', String(n), n > 1 ? 'œufs' : 'œuf', n > 1 ? noteN : note1, unitMac('oeuf', n))); };
  const oats = function(g, note){ items.push(it('base', grams(g), 'flocons d’avoine', note, mac('avoine', g))); };
  const lait = function(g, note){ items.push(it('lait', grams(g), 'lait demi-écrémé', '≈' + NB + g + NB + 'ml' + (note ? ', ' + note : ''), mac('lait', g))); };
  /* Salé : pain complet, œufs et une tranche de jambon (portions fixes comme les œufs), sans skyr ni amandes */
  if (base === 'sale' && !long){
    const g = sc(80, 10, k), n = pieces(2, k), j = sc(45, 5, k);
    items.push(it('base', grams(g), 'pain complet', slices(g, 40), mac('pain', g)));
    eggs(n, 'à la coque, poché ou brouillé sans matière grasse', 'à la coque, pochés ou brouillés sans matière grasse');
    items.push(it('jambon', grams(j), 'jambon blanc', slices(j, 45), mac('jambon', j)));
    fruit(125);
    return items;
  }
  /* Brouillade (3.29.0) : œufs brouillés aux épinards et aux champignons, pain complet, skyr à côté */
  if (base === 'brouillade' && !long){
    const n = pieces(2, k), g = sc(60, 10, k);
    eggs(n, 'brouillé à la poêle antiadhésive, sans matière grasse', 'brouillés à la poêle antiadhésive, sans matière grasse');
    items.push(it('epi', grams(100), 'épinards', 'frais ou surgelés, tombés à la poêle avant les œufs', mac('epinards', 100)));
    items.push(it('chp', grams(60), 'champignons de Paris', 'émincés, avec les épinards', mac('champignon', 60)));
    items.push(it('pain', grams(g), 'pain complet', slices(g, 40) + ', grillé', mac('pain', g)));
    skyr(150, 'à côté');
    fruit(100);
    return items;
  }
  /* Wrap œufs-jambon (3.29.0) : à emporter, roulé dans une tortilla complète */
  if (base === 'wrap' && !long){
    const n = pieces(2, k), j = sc(45, 5, k);
    items.push(it('tort', '1', 'tortilla complète', 'garnie puis roulée, à emporter dans un papier', unitMac('tortilla', 1)));
    eggs(n, 'en omelette fine, à la poêle antiadhésive sans matière grasse', 'en omelette fine, à la poêle antiadhésive sans matière grasse');
    items.push(it('jambon', grams(j), 'jambon blanc', slices(j, 45), mac('jambon', j)));
    items.push(it('tom', grams(80), 'tomate', 'en rondelles, ou de la salade', mac('tomate', 80)));
    fruit(125);
    return items;
  }
  /* Pancakes avoine-banane (3.29.0) : flocons, banane et œufs mixés, cuits sans matière grasse */
  if (base === 'pancakes'){
    oats(sc(long ? 60 : 40, 5, k), 'mixés avec la banane et les œufs, cuits en petits pancakes à la poêle antiadhésive');
    items.push(it('fruit', '1', 'banane', 'écrasée dans la pâte', unitMac('banane', 1)));
    eggs(pieces(2, k), 'dans la pâte', 'dans la pâte');
    skyr(100, 'à côté, avec les fruits rouges');
    items.push(it('fr', grams(50), 'fruits rouges', 'surgelés, c’est parfait', mac('fruitsRouges', 50)));
    miel();
    return items;
  }
  /* Pain perdu (3.29.0) : pain complet trempé dans l'œuf battu avec le lait et la cannelle, doré sans beurre */
  if (base === 'painperdu'){
    const g = sc(long ? 110 : 80, 10, k);
    items.push(it('base', grams(g), 'pain complet', slices(g, 40) + ', rassis c’est mieux', mac('pain', g)));
    eggs(pieces(1, k), typo('battu avec le lait et une pincée de cannelle ; le pain y trempe, puis dore à la poêle antiadhésive, sans beurre'), typo('battus avec le lait et une pincée de cannelle ; le pain y trempe, puis dore à la poêle antiadhésive, sans beurre'));
    lait(sc(100, 10, k));
    skyr(150, 'à côté, ou en nappage');
    fruit(125);
    miel();
    return items;
  }
  /* Bircher (3.29.0) : flocons trempés la veille dans le skyr et le lait, pomme râpée, cannelle */
  if (base === 'bircher'){
    const g = sc(long ? 70 : 50, 5, k);
    oats(g, 'trempés la veille au frigo dans le skyr et le lait, avec une pincée de cannelle');
    skyr(200, null, Math.ceil(g * OATS_SKYR / 10) * 10);
    lait(sc(60, 10, k));
    items.push(it('fruit', '1', 'pomme', 'râpée le matin', unitMac('pomme', 1)));
    const am = sc(10, 5, k);
    items.push(it('am', grams(am), 'amandes', 'concassées', mac('amandes', am)));
    miel();
    return items;
  }
  /* Porridge choco-banane (3.29.0) : flocons cuits dans le lait avec le cacao, banane et skyr dessus */
  if (base === 'porridge'){
    oats(sc(long ? 70 : 50, 5, k), 'cuits 3 à 5' + NB + 'min dans le lait, avec le cacao');
    lait(sc(150, 10, k));
    items.push(it('cacao', grams(8), 'cacao non sucré', typo('1 c. à soupe rase'), mac('cacao', 8)));
    items.push(it('fruit', '1', 'banane', 'en rondelles dessus', unitMac('banane', 1)));
    skyr(150, 'dessus, une fois tiède');
    miel();
    return items;
  }
  /* Smoothie à emporter (3.29.0) : tout mixé, à boire en route */
  if (base === 'smoothie'){
    skyr(250, 'mixé avec le reste, à emporter dans une gourde');
    items.push(it('fruit', '1', 'banane', null, unitMac('banane', 1)));
    items.push(it('fr', grams(100), 'fruits rouges', 'surgelés, c’est parfait', mac('fruitsRouges', 100)));
    lait(sc(100, 10, k));
    oats(sc(long ? 50 : 30, 5, k), 'mixés avec le reste, ils épaississent');
    miel();
    return items;
  }
  /* Pain, ou une base salée les jours de sortie longue (version sucrée au pain) */
  if (base === 'pain' || has(PD, base) && PD[base].sale){
    const g = sc(long ? 110 : 80, 10, k);
    items.push(it('base', grams(g), 'pain complet', slices(g, 40) + (base !== 'pain' ? ', en version sucrée avant la sortie longue (plus digeste)' : ''), mac('pain', g)));
  }
  /* Avec les flocons, jamais moins de 2,5 fois leur poids en skyr (3.19.0, arrondi à 10 g au-dessus) : sinon le porridge ou
     les flocons trempés ne se mangent pas. Comme SKYR_MIN, ce plancher ne suit pas l'objectif de protéines. */
  let skyrOats = 0;
  if (items.length === 0){
    const g = sc(long ? 80 : 60, 5, k);
    items.push(it('base', grams(g), 'flocons d’avoine ou muesli', 'muesli sans sucre ajouté. En porridge, ou trempés la veille dans le skyr', mac('avoine', g)));
    skyrOats = Math.ceil(g * OATS_SKYR / 10) * 10;
  }
  skyr(long ? 150 : 250, null, skyrOats);
  fruit(125);
  miel();
  const am = sc(15, 5, k);
  items.push(it('am', grams(am), 'amandes', null, mac('amandes', am)));
  return items;
}
/* Collation (3.29.0 : au choix, kind, ch.co) :
   - œufs durs (par défaut) ou muffins œuf-épinards ; déjà des œufs dans la journée (petit-déjeuner aux œufs hors sortie
     longue, « Œufs + jambon ») : skyr et amandes à la place, presque la même chose (2 œufs : 144 kcal, 12,6 g de
     protéines, 9,6 g de lipides ; 100 g de skyr et 15 g d'amandes : 151, 14, 7,9) ;
   - mug cake skyr-cacao (un œuf, il reste) ; bouchées concombre-thon (½ boîte) ;
   - riz au lait protéiné : il fait aussi la partie glucides.
   Puis, s'il y a une séance (carbs, ch.cs) : banane, + compote s'il y a une moyenne ou une longue ; ou boules d'énergie
   (2, ou 3 avec une moyenne ou une longue). */
function snackItems(seance, grosse, k, oeufs, kind, carbs){
  const items = [], K = has(SNACK, kind) ? kind : 'oeufs';
  if (K === 'rizaulait'){
    const r = sc(30, 5, k), l = sc(200, 10, k), sk = Math.max(SKYR_MIN, sc(100, 10, k));
    items.push(it('rzr', grams(r), 'riz rond', typo('cuit 25 min à feu doux dans le lait, avec vanille ou cannelle ; se prépare pour 3 jours'), mac('rizrond', r)));
    items.push(it('rzl', grams(l), 'lait demi-écrémé', '≈' + NB + l + NB + 'ml', mac('lait', l)));
    items.push(it('rzs', grams(sk), 'skyr nature', 'mélangé une fois tiède', mac('skyr', sk)));
    return items;
  }
  if (oeufs && (K === 'oeufs' || K === 'muffins')){
    const sk = Math.max(SKYR_MIN, sc(100, 10, k)), am = sc(15, 5, k);
    items.push(it('csk', grams(sk), 'skyr nature', 'à la place des œufs, déjà au menu aujourd’hui', mac('skyr', sk)));
    items.push(it('cam', grams(am), 'amandes', null, mac('amandes', am)));
  } else if (K === 'muffins'){
    const n = pieces(2, k), pm = sc(10, 5, k);
    items.push(it('mfo', String(n), n > 1 ? 'œufs' : 'œuf', typo('en muffins : battus avec les épinards hachés et le parmesan, 20 min à 180 °C ; une fournée se garde 3 jours au frigo'), unitMac('oeuf', n)));
    items.push(it('mfe', grams(40), 'épinards', 'frais ou surgelés', mac('epinards', 40)));
    items.push(it('mfp', grams(pm), 'parmesan', 'râpé', mac('parmesan', pm)));
  } else if (K === 'mugcake'){
    const n = pieces(1, k), sk = sc(80, 10, k), f = sc(15, 5, k);
    items.push(it('mko', String(n), n > 1 ? 'œufs' : 'œuf', typo('mélangé dans un mug avec le skyr, les flocons et le cacao, 1 min 30 au micro-ondes'), unitMac('oeuf', n)));
    items.push(it('mks', grams(sk), 'skyr nature', null, mac('skyr', sk)));
    items.push(it('mka', grams(f), 'flocons d’avoine', null, mac('avoine', f)));
    items.push(it('mkc', grams(5), 'cacao non sucré', typo('1 c. à café'), mac('cacao', 5)));
  } else if (K === 'thon'){
    const t = mac('thon', 55);
    items.push(it('tht', '½', 'boîte de thon au naturel', 'environ 55' + NB + 'g égoutté, mélangé au skyr, sur les rondelles de concombre', t, null, {id:'thon', n:0.5}));
    items.push(it('thc', grams(150), 'concombre', 'en rondelles épaisses', mac('concombre', 150)));
    items.push(it('ths', grams(30), 'skyr nature', 'avec le thon, citron et poivre', mac('skyr', 30)));
    items.push(it('thg', '2', 'galettes de riz soufflé', null, unitMac('galette', 2)));
  } else {
    const n = pieces(2, k);
    items.push(it('oe', String(n), n > 1 ? 'œufs' : 'œuf', n > 1 ? 'durs ou mollets, préparés à l’avance' : 'dur ou mollet, préparé à l’avance', unitMac('oeuf', n)));
  }
  if (!seance) return items;
  if (carbs === 'boules'){
    const b = grosse ? 3 : 2, f = sc(10 * b, 5, k), s = sc(10 * b, 5, k), a = sc(5 * b, 5, k);
    items.push(it('bof', grams(f), 'flocons d’avoine', typo('pour ' + b + ' boules d’énergie : mixés avec les fruits secs et les amandes, roulés en boules ; une fournée se garde une semaine au frais'), mac('avoine', f)));
    items.push(it('bos', grams(s), 'fruits secs', 'abricots, pruneaux ou figues', mac('fruitsSecs', s)));
    items.push(it('boa', grams(a), 'amandes', null, mac('amandes', a)));
    return items;
  }
  items.push(it('ban', '1', 'banane', null, unitMac('banane', 1)));
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
