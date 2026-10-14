/* Planification par cartes (4.0.0) : les petits-déjeuners, les collations et les repas choisis pour une période (cartes),
   les surprises, la répartition sur les jours (planDays) et les épices et petits trucs des courses (pantryList).
   Une carte :
   - petit-déjeuner : { id } (PD) ;
   - collation : { id, cs } (SNACK, glucides des jours de séance SNACK_CS) ;
   - repas : { prot, starch, recette } (recette : une recette du couple, ou null pour un plat simple).
   s : surprise (petit-déjeuner, collation : true ; repas : 'full', ou 'prot' / 'starch' pour l'aliment choisi, l'autre tiré).
   Une surprise est tirée une fois, à la création de la carte, puis répétée comme les autres. */
const PLAN_MAX = {pd:3, co:3, meal:5};
const MEAL_SURPRISE = ['full', 'prot', 'starch'];
/** Cartes relues et validées : identifiants connus (has), au plus PLAN_MAX par étape, sans doublon. */
function cleanCards(o){
  const src = o && typeof o === 'object' ? o : {}, out = {pd:[], co:[], meal:[]};
  const list = function(k){ return Array.isArray(src[k]) ? src[k] : []; };
  list('pd').forEach(function(c){
    if (!c || !has(PD, c.id) || out.pd.length >= PLAN_MAX.pd || out.pd.some(function(x){ return x.id === c.id; })) return;
    out.pd.push(c.s === true ? {id:c.id, s:true} : {id:c.id});
  });
  list('co').forEach(function(c){
    if (!c || !has(SNACK, c.id) || out.co.length >= PLAN_MAX.co || out.co.some(function(x){ return x.id === c.id; })) return;
    const x = {id:c.id, cs:has(SNACK_CS, c.cs) ? c.cs : 'banane'};
    if (c.s === true) x.s = true;
    out.co.push(x);
  });
  list('meal').forEach(function(c){
    if (!c || !has(PROT, c.prot) || !has(STARCH, c.starch) || out.meal.length >= PLAN_MAX.meal) return;
    const x = {prot:c.prot, starch:c.starch, recette:recipeOf(c) || null};
    if (out.meal.some(function(y){ return y.prot === x.prot && y.starch === x.starch && y.recette === x.recette; })) return;
    if (MEAL_SURPRISE.indexOf(c.s) >= 0) x.s = c.s;
    out.meal.push(x);
  });
  return out;
}
/* Surprises : au hasard parmi les aliments proposés (off), pas une carte déjà prise (s'il en reste) */
function surprisePd(cards, off, rand){
  const r = rand || Math.random, ok = allowed('pd', off), fresh = ok.filter(function(id){ return !cards.some(function(c){ return c.id === id; }); });
  const l = fresh.length ? fresh : ok;
  return {id:l[Math.min(l.length - 1, Math.floor(r() * l.length))], s:true};
}
function surpriseCo(cards, rand){
  const r = rand || Math.random, fresh = SNACK_ORDER.filter(function(id){ return !cards.some(function(c){ return c.id === id; }); });
  const l = fresh.length ? fresh : SNACK_ORDER;
  return {id:l[Math.min(l.length - 1, Math.floor(r() * l.length))], cs:'banane', s:true};
}
/* Un repas surprise : fix = { prot } ou { starch } (surprise partielle, l'autre est tiré) ou {} (complète). La protéine évite
   celles déjà prises, le poisson est favorisé s'il n'y en a pas encore (× 3), les légumes secs aussi ; un féculent déjà pris
   pèse 0,3 ; un couple déjà pris, ou dont toutes les recettes sont à éviter, est écarté s'il reste autre chose. La recette du
   couple est tirée selon les préférences (favorite × 2, jamais une à éviter) ; sans recette possible, un plat simple. */
function surpriseMeal(cards, fix, off, prefs, rand){
  const r = rand || Math.random, f = fix || {};
  const prots = allowed('prot', off), sts = allowed('starch', off);
  const hasFish = cards.some(function(c){ return FISH.indexOf(c.prot) >= 0; }), hasLeg = cards.some(function(c){ return LEGUMES.indexOf(c.starch) >= 0; });
  const taken = function(p, s){ return cards.some(function(c){ return c.prot === p && c.starch === s; }); };
  const prot = f.prot && has(PROT, f.prot) ? f.prot : tieredPick(r, prots, function(p){
    if (cards.some(function(c){ return c.prot === p; })) return 0;
    if (f.starch && (taken(p, f.starch) || couplePref(p, f.starch, prefs) === 0)) return 0;
    return FISH.indexOf(p) >= 0 && !hasFish ? 3 : 1;
  });
  const starch = f.starch && has(STARCH, f.starch) ? f.starch : tieredPick(r, sts, function(s){
    if (taken(prot, s) || couplePref(prot, s, prefs) === 0) return 0;
    let w = cards.some(function(c){ return c.starch === s; }) ? 0.3 : 1;
    if (LEGUMES.indexOf(s) >= 0 && !hasLeg) w *= 3;
    return w;
  });
  const recs = recipesFor(prot, starch).filter(function(id){ return recipePref(id, prefs) > 0; });
  const recette = recs.length ? tieredPick(r, recs, function(id){ return recipePref(id, prefs); }) : null;
  return {prot:prot, starch:starch, recette:recette, s:f.prot ? 'prot' : f.starch ? 'starch' : 'full'};
}
/* Les plats de chaque jour d'après les cartes. days : [{ libre }] dans l'ordre des dates.
   - Petits-déjeuners et collations : les cartes tournent, une par jour, dans l'ordre (jour 1 la première…).
   - Repas : par blocs de 7 jours, chaque carte autant de fois (écart d'une au plus), comme le batch cooking : les moins
     nombreuses aux cartes servies d'abord (celles qui se congèlent mal, poisson en tête), repas dans l'ordre des jours, deux
     cartes en cours à la fois, pas deux fois de suite la même ; jamais la même protéine midi et soir si c'est possible
     (échange avec le repas le plus proche, sans repousser après le 3e jour une recette qui se congèle mal). Un plat simple
     se congèle (il se cuisine le jour même). Le dîner d'un repas libre reçoit une carte d'une autre protéine, sans compter.
   Renvoie [{ pdBase, co, cs, dej, diner }] (dej et diner : { prot, starch, recette ? }). */
function planDays(days, cards){
  const c0 = cleanCards(cards), out = days.map(function(){ return {}; });
  days.forEach(function(d, i){
    if (c0.pd.length) out[i].pdBase = c0.pd[i % c0.pd.length].id;
    if (c0.co.length){ const c = c0.co[i % c0.co.length]; out[i].co = c.id; out[i].cs = c.cs; }
  });
  if (!c0.meal.length) return out;
  const gel = function(e){ return !e.c.recette || RECIPES[e.c.recette].gel; };
  for (let b = 0; b < days.length; b += BATCH_BLOCK){
    const block = days.slice(b, b + BATCH_BLOCK), slots = [];
    block.forEach(function(d, i){ slots.push({i:i, slot:'dej'}); if (!(d && d.libre)) slots.push({i:i, slot:'diner'}); });
    const m = slots.length, nr = Math.min(c0.meal.length, m), cnt = [];
    for (let j = 0; j < nr; j++) cnt.push(Math.floor(m / nr) + (j >= nr - m % nr ? 1 : 0));
    const ent = c0.meal.slice(0, nr).map(function(c, j){ return {c:c, j:j}; });
    ent.forEach(function(e){ e.key = (gel(e) ? 2 : 0) + (FISH.indexOf(e.c.prot) >= 0 ? 0 : 1); });
    ent.sort(function(a, x){ return a.key - x.key || a.j - x.j; });
    ent.forEach(function(e, j){ e.left = cnt[j]; });
    /* Une protéine servie plus de fois que le bloc n'a de jours (deux cartes de la même protéine) : ses parts en plus vont
       à une carte d'une autre protéine qui en a une de moins */
    const nd = block.length, perP = function(p){ return ent.filter(function(e){ return e.c.prot === p; }).reduce(function(a, e){ return a + e.left; }, 0); };
    for (let guard = 0; guard < 10; guard++){
      const over = ent.find(function(e){ return perP(e.c.prot) > nd && e.left === Math.max.apply(null, cnt); });
      const under = over && ent.find(function(e){ return e.c.prot !== over.c.prot && e.left < over.left && perP(e.c.prot) + 1 <= nd; });
      if (!under) break;
      const t = over.left; over.left = under.left; under.left = t;
    }
    const at = block.map(function(){ return {}; });
    let prev = null;
    slots.forEach(function(sl){
      const other = sl.slot === 'diner' && at[sl.i].dej ? at[sl.i].dej.c.prot : null;
      const live = ent.filter(function(e){ return e.left > 0; });
      const okP = function(l){ return l.filter(function(e){ return e.c.prot !== other; }); };
      let cand = okP(live.slice(0, 2));
      if (!cand.length) cand = okP(live);
      if (!cand.length) cand = live;
      const score = function(e){ return e.left + (gel(e) ? 0 : 100) - (e === prev ? 0.5 : 0); };
      const e = cand.reduce(function(best, x){ return score(x) > score(best) ? x : best; });
      e.left--; prev = e; at[sl.i][sl.slot] = e;
    });
    const clash = function(i){ return at[i].dej && at[i].diner && at[i].dej.c.prot === at[i].diner.c.prot; };
    const fresh = function(e, i){ return gel(e) || i < FRIDGE_DAYS || block.length <= FRIDGE_DAYS; };
    block.forEach(function(d, i){
      if (!clash(i)) return;
      const others = slots.filter(function(sl){ return sl.i !== i; }).sort(function(a, x){ return Math.abs(a.i - i) - Math.abs(x.i - i); });
      for (let t = 0; t < others.length; t++){
        const sl = others[t], a = at[i].diner, x = at[sl.i][sl.slot];
        if (!fresh(x, i) || !fresh(a, sl.i)) continue;
        at[i].diner = x; at[sl.i][sl.slot] = a;
        if (!clash(i) && !clash(sl.i)) return;
        at[i].diner = a; at[sl.i][sl.slot] = x;
      }
    });
    const meal = function(e){ const o = {prot:e.c.prot, starch:e.c.starch}; if (e.c.recette) o.recette = e.c.recette; return o; };
    block.forEach(function(d, i){
      const dej = at[i].dej, din = at[i].diner || ent.find(function(e){ return e.c.prot !== dej.c.prot; }) || dej;
      out[b + i].dej = meal(dej); out[b + i].diner = meal(din);
    });
  }
  return out;
}
/* Épices et petits trucs (4.0.0) : pour la liste de courses, sans quantités, ceux des recettes choisies (leurs aromates) et des
   petits-déjeuners et collations qui en demandent. entries : [{ ch, res }] (plats de la date et sa journée buildDay : seules
   les recettes vraiment servies comptent, pas un dîner de repas libre ni un repas remplacé par un imprévu).
   Noms ramenés à l'essentiel (« ail en chemise » → ail, « persil plat (beaucoup) » → persil), triés. */
const PANTRY_SAME = {'ail en chemise':'ail', 'ail en poudre':'ail', 'citron confit':'citron', 'zeste de citron':'citron', 'persil plat':'persil',
  'moutarde à l’ancienne':'moutarde', 'paprika doux':'paprika', 'fécule de maïs':'fécule de maïs'};
/* Petits-déjeuners : [ligne qui montre la recette (pas sa version sucrée d'un jour de sortie longue), ce qu'il demande] */
const PANTRY_PD = {painperdu:['lait', ['cannelle']], bircher:['lait', ['cannelle']], brouillade:['epi', ['poivre']]};
const PANTRY_CO = {rizaulait:['vanille'], thon:['citron', 'poivre'], muffins:['poivre']};
function pantryName(a){ const x = a.replace(/\s*\(.*\)\s*/g, '').trim(); return has(PANTRY_SAME, x) ? PANTRY_SAME[x] : x; }
function pantryList(entries){
  const set = {};
  const add = function(a){ const n = pantryName(a); if (n) set[n] = true; };
  entries.forEach(function(e){
    if (!e || !e.res) return;
    e.res.secs.forEach(function(s){
      if (s.recipe && !s.libre && has(RECIPES, s.recipe)) RECIPES[s.recipe].aro.split(/,\s*/).forEach(add);
      if (s.id === 'pd' && e.ch && has(PANTRY_PD, e.ch.pdBase) && s.items.some(function(i){ return i.key === PANTRY_PD[e.ch.pdBase][0]; })) PANTRY_PD[e.ch.pdBase][1].forEach(add);
      if (s.id === 'co' && s.pick === 'co' && e.ch && has(PANTRY_CO, e.ch.co)) PANTRY_CO[e.ch.co].forEach(add);
    });
  });
  return Object.keys(set).sort(function(a, b){ return a.localeCompare(b, 'fr'); });
}
