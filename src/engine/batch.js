/* Batch cooking (3.13.0) : pour une période (jours consécutifs, par blocs de 7 à partir du premier), quelques recettes qui
   se gardent (3, 4 ou 5) répétées aux déjeuners et aux dîners, cuisinées en une fois la veille du bloc. Un plat cuisiné se
   garde 3 jours au frigo (FRIDGE_DAYS) : les boîtes mangées plus tard vont au congélateur. */
const BATCH_BLOCK = 7, BATCH_N = [3, 4, 5], FRIDGE_DAYS = 3;
/* Le jambon s'achète en paquet (3.17.0) : un bloc de batch cooking en compte 0 ou 4 tranches (une par petit-déjeuner salé,
   deux par boîte d'« Œufs + jambon ») ; 4 tranches, 180 g à 72 kg, dépassent un peu le repère de 150 g, toléré (weekNeeds). */
const HAM_SLICES = 4;
/* Plats d'une période en batch cooking. days : [{libre, long}] dans l'ordre des dates (long : sortie longue ce jour-là) ; renvoie les choix de chaque jour
   ({pdBase, dej, diner}, recette comprise ; rand comme randomChoices ; la collation n'est pas tirée). Par bloc :
   - n recettes au plus (au moins deux repas chacune), parmi celles qui se gardent et dont la protéine et le féculent sont
     proposés ; protéines différentes et féculents variés autant que possible ; poisson, poisson gras et légumes secs
     favorisés tant que le bloc en manque ; écartés d'abord : le bœuf s'il ferait dépasser la viande rouge (repas du bloc,
     au nombre de boîtes le plus haut), « Œufs + jambon » sauf pour 2 boîtes (4 tranches), une protéine qui aurait plus de repas que le
     bloc n'a de jours ; une recette qui se congèle mal seulement si ses boîtes tiennent dans les 3 premiers jours (une par
     jour au plus, avec les autres qui se congèlent mal, une seule par protéine) et qu'il en reste deux qui se congèlent bien
     pour la suite ;
   - boîtes : les moins nombreuses aux recettes servies d'abord (celles qui se congèlent mal, poisson en tête) ; repas
     répartis dans l'ordre des jours, deux recettes en cours à la fois (celle qui se congèle mal, sinon la plus fournie,
     d'abord), en alternant ; jamais la
     même protéine au déjeuner et au dîner si c'est possible (échange avec le repas le plus proche) ;
   - petits-déjeuners : 0 ou 4 tranches de jambon par bloc (HAM_SLICES). Avec « Œufs + jambon » (2 boîtes), aucun
     petit-déjeuner au jambon (salé, wrap) ; sinon 4 (jours sans sortie longue ni œufs-jambon, chacun une base au jambon au
     hasard) ou aucun, tirés pour en garder en moyenne autant qu'au hasard (probabilité : jours possibles × bases au jambon
     / bases proposées / 4) ; les autres jours, une autre base au hasard (une au jambon s'il ne reste qu'elles) ; desserts au hasard ; le dîner d'un repas libre reçoit une recette du bloc d'une autre
     protéine, sans boîte.
   - préférences (3.25.0, prefs : { fav, ban }) : une recette à éviter n'est jamais tirée (sauf s'il ne reste qu'elles), une
     favorite pèse double.
   @param {{libre:boolean, long?:boolean}[]} days  @param {number} n  @param {string[]} [off]  @param {number} [k]  @param {function():number} [rand]
   @param {{fav:string[], ban:string[]}} [prefs]  @returns {Choices[]} */
function batchChoices(days, n, off, k, rand, prefs){
  const r = rand || Math.random, kk = k || 1, nn = BATCH_N.indexOf(n) >= 0 ? n : 4;
  const pick = function(a, w){ return tieredPick(r, a, w); };
  const boeufCuit = sc(150, 10, kk) * YIELD.boeuf;
  const prots = allowed('prot', off), starches = allowed('starch', off), pds = allowed('pd', off);
  /* Bases avec une tranche de jambon (salé, wrap, 3.29.0) et les autres */
  const hams = pds.filter(function(x){ return PD[x].ham; }), sweet = pds.filter(function(x){ return !PD[x].ham; });
  const ok0 = Object.keys(RECIPES).filter(function(id){ return prots.indexOf(RECIPES[id].p) >= 0 && starches.indexOf(RECIPES[id].s) >= 0; });
  const okP = ok0.filter(function(id){ return recipePref(id, prefs) > 0; }), ok = okP.length ? okP : ok0;
  const keep = ok.filter(function(id){ return RECIPES[id].box; }), pool = keep.length ? keep : ok;
  const prot = function(e){ return RECIPES[e.id].p; };
  const out = [];
  for (let b = 0; b < days.length; b += BATCH_BLOCK){
    const block = days.slice(b, b + BATCH_BLOCK), slots = [];
    block.forEach(function(d, i){ slots.push({i:i, slot:'dej'}); if (!(d && d.libre)) slots.push({i:i, slot:'diner'}); });
    const m = slots.length, nr = Math.min(nn, m, Math.max(2, Math.floor(m / 2)));
    const cnt = [];
    for (let j = 0; j < nr; j++) cnt.push(Math.floor(m / nr) + (j >= nr - m % nr ? 1 : 0));
    /* Recettes qui se congèlent mal : autant que de boîtes (les moins nombreuses) qui tiennent dans les 3 premiers jours */
    const fridgeSlots = slots.filter(function(sl){ return sl.i < FRIDGE_DAYS; }).length;
    let maxNoGel = 0, used = 0;
    if (block.length <= FRIDGE_DAYS) maxNoGel = nr;
    else while (maxNoGel < nr - 2 && cnt[maxNoGel] <= FRIDGE_DAYS && used + cnt[maxNoGel] <= fridgeSlots){ used += cnt[maxNoGel]; maxNoGel++; }
    const ct = cnt[nr - 1], c = {poisson:0, gras:0, legumes:0, rouge:0}, chosen = [], perProt = {}, perFresh = {};
    cnt.forEach(function(){
      const usedP = chosen.map(function(id){ return RECIPES[id].p; }), usedS = chosen.map(function(id){ return RECIPES[id].s; });
      const noGel = chosen.filter(function(id){ return !RECIPES[id].gel; }).length, fresh = pool.filter(function(id){ return chosen.indexOf(id) < 0; });
      const id = pick(fresh.length ? fresh : pool, function(id){
        const x = RECIPES[id];
        if (x.p === 'boeuf' && c.rouge + ct * boeufCuit > WEEK_GOALS.rouge) return -1;
        if (x.p === 'oeufs' && (cnt.some(function(q){ return q * 2 !== HAM_SLICES; }) || !sweet.length)) return -1;
        if ((perProt[x.p] || 0) + ct > block.length || (!x.gel && (noGel >= maxNoGel || (perFresh[x.p] || 0) + ct > FRIDGE_DAYS))) return -1;
        if (usedP.indexOf(x.p) >= 0) return 0;
        let w = usedS.indexOf(x.s) >= 0 ? 0.3 : 1;
        if (FISH.indexOf(x.p) >= 0 && c.poisson < WEEK_GOALS.poisson) w *= x.p === 'saumon' && c.gras < WEEK_GOALS.gras ? 6 : 3;
        if (LEGUMES.indexOf(x.s) >= 0 && c.legumes < WEEK_GOALS.legumes) w *= 3;
        return w * recipePref(id, prefs);
      });
      const x = RECIPES[id];
      if (FISH.indexOf(x.p) >= 0){ c.poisson += ct; if (x.p === 'saumon') c.gras += ct; }
      if (LEGUMES.indexOf(x.s) >= 0) c.legumes += ct;
      if (x.p === 'boeuf') c.rouge += ct * boeufCuit;
      perProt[x.p] = (perProt[x.p] || 0) + ct;
      if (!x.gel) perFresh[x.p] = (perFresh[x.p] || 0) + ct;
      chosen.push(id);
    });
    const ent = chosen.map(function(id, j){ return {id:id, j:j, key:(RECIPES[id].gel ? 2 : 0) + (FISH.indexOf(RECIPES[id].p) >= 0 ? 0 : 1)}; })
      .sort(function(a, x){ return a.key - x.key || a.j - x.j; });
    ent.forEach(function(e, j){ e.left = cnt[j]; });
    const at = block.map(function(){ return {}; });
    let prev = null;
    slots.forEach(function(sl){
      const other = sl.slot === 'diner' && at[sl.i].dej ? prot(at[sl.i].dej) : null;
      const live = ent.filter(function(e){ return e.left > 0; });
      const okP = function(l){ return l.filter(function(e){ return prot(e) !== other; }); };
      let cand = okP(live.slice(0, 2));
      if (!cand.length) cand = okP(live);
      if (!cand.length) cand = live;
      /* Celles qui se congèlent mal d'abord, puis la plus fournie ; pas deux fois de suite la même */
      const score = function(e){ return e.left + (RECIPES[e.id].gel ? 0 : 100) - (e === prev ? 0.5 : 0); };
      const e = cand.reduce(function(best, x){ return score(x) > score(best) ? x : best; });
      e.left--; prev = e; at[sl.i][sl.slot] = e;
    });
    /* Même protéine midi et soir : le dîner est échangé avec le repas le plus proche qui règle les deux jours, sans repousser
       après le 3e jour une recette qui se congèle mal */
    const clash = function(i){ return at[i].dej && at[i].diner && prot(at[i].dej) === prot(at[i].diner); };
    const fresh = function(e, i){ return RECIPES[e.id].gel || i < FRIDGE_DAYS || block.length <= FRIDGE_DAYS; };
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
    const plates = block.map(function(d, i){ const dej = at[i].dej; return [dej, at[i].diner || ent.find(function(e){ return prot(e) !== prot(dej); }) || dej]; });
    /* Jambon du bloc : 0 ou 4 tranches (voir HAM_SLICES) */
    const eggs = plates.some(function(pl, i){ return prot(pl[0]) === 'oeufs' || (!(block[i] && block[i].libre) && prot(pl[1]) === 'oeufs'); });
    const free = [], sale = [];
    plates.forEach(function(pl, i){ if (!(block[i] && block[i].long) && prot(pl[0]) !== 'oeufs' && prot(pl[1]) !== 'oeufs') free.push(i); });
    if (sweet.length && hams.length && !eggs && free.length >= HAM_SLICES && r() < Math.min(1, free.length * hams.length / pds.length / HAM_SLICES))
      while (sale.length < HAM_SLICES) sale.push(free.splice(Math.min(free.length - 1, Math.floor(r() * free.length)), 1)[0]);
    block.forEach(function(d, i){
      const pdBase = sale.indexOf(i) >= 0 ? pick(hams) : pick(sweet.length ? sweet : pds);
      const meal = function(e){ const x = RECIPES[e.id]; return {prot:x.p, starch:x.s, dessert:pick(allowed('dessert', off)), recette:e.id}; };
      out.push({pdBase:pdBase, dej:meal(plates[i][0]), diner:meal(plates[i][1])});
    });
  }
  return out;
}
/* Fiche de batch cooking d'une période : days = [{res}] (résultats de buildDay, dates consécutives), par blocs de 7.
   Pour chaque recette qui se garde servie à au moins deux repas d'un bloc (repas libre exclu) : ses boîtes (jour depuis le début de la
   période, repas, frigo si elle est mangée 3 jours au plus après la cuisson de la veille du bloc, sinon congélateur ;
   protéine et féculent de la boîte) et ce qu'il faut cuire en tout (protéine, féculent, légumes, matière grasse, ajouts :
   somme des boîtes, valeurs des lignes de buildDay). lead : jours entre la cuisson et le premier jour (1 par défaut, la
   veille ; 0 si la période commence aujourd'hui), pour le premier bloc seulement.
   Renvoie [{start, recipes:[{id, t, gel, boxes, totals}]}].
   @param {{res:Day}[]} days  @param {number} [lead] */
function batchCook(days, lead){
  const blocks = [];
  for (let b = 0; b < days.length; b += BATCH_BLOCK){
    const by = {}, order = [];
    days.slice(b, b + BATCH_BLOCK).forEach(function(d, i){
      d.res.secs.forEach(function(sec){
        if ((sec.id !== 'dej' && sec.id !== 'diner') || sec.libre || !sec.recipe) return;
        if (!has(by, sec.recipe)){ by[sec.recipe] = []; order.push(sec.recipe); }
        by[sec.recipe].push({day:b + i, slot:sec.id, after:i + (b === 0 && lead === 0 ? 0 : 1), items:sec.items.filter(function(x){ return /^(p1|p2|st|[vfx]-)/.test(x.key) && x.buy; })});
      });
    });
    const recipes = order.filter(function(id){ return RECIPES[id].box && by[id].length >= 2; }).map(function(id){
      const x = RECIPES[id], tot = {}, ids = [];
      by[id].forEach(function(v){ v.items.forEach(function(i){
        const a = tot[i.buy.id] || (tot[i.buy.id] = {first:i, g:0, n:0, cooked:0});
        if (ids.indexOf(i.buy.id) < 0) ids.push(i.buy.id);
        a.g += i.buy.g || 0; a.n += i.buy.n || 0; a.cooked += i.cook && i.cook.ways.length === 1 ? i.cook.ways[0].g : 0;
      }); });
      const PLURAL = {oeuf:'œufs', thon:'boîtes de thon au naturel'};
      const totals = ids.map(function(bid){
        const a = tot[bid], i = a.first, k = i.key;
        if (a.n) return {id:bid, qty:String(a.n), name:a.n > 1 && has(PLURAL, bid) ? PLURAL[bid] : i.name, note:null};
        /* Oignons en unités (3.27.0) */
        if (bid === 'oignon') return {id:bid, qty:onionQty(a.g), name:onionName(a.g), note:onionNote(a.g)};
        const note = a.cooked ? '≈' + NB + shopQty(Math.round(a.cooked / 10) * 10) + ' ' + i.cook.ways[0].adj
          : /^f-/.test(k) ? i.note + ' par boîte' : /^v-/.test(k) ? RFOOD[bid][1] : null;
        return {id:bid, qty:shopQty(a.g), name:i.name, note:note};
      });
      const boxes = by[id].map(function(v){
        return {day:v.day, slot:v.slot, fridge:v.after <= FRIDGE_DAYS, parts:v.items.filter(function(i){ return /^(p1|p2|st)$/.test(i.key); }).map(function(i){
          return {qty:i.qty, name:i.name, cooked:i.cook ? i.cook.ways.map(function(w){ return '≈' + NB + grams(w.g) + ' ' + w.adj; }).join(' ou ') : null};
        })};
      });
      return {id:id, t:x.t, gel:x.gel, boxes:boxes, totals:totals};
    });
    if (recipes.length) blocks.push({start:b, recipes:recipes});
  }
  return blocks;
}
/* Changer une recette du batch cooking (3.16.0). days : les jours d'un bloc, [{ch, libre}] (plats de chaque date, repas
   libre) ; id : la recette à remplacer, partout où elle est dans le bloc (le dîner d'un repas libre compris). Les autres
   repas ne bougent pas. Repas servis : comme batchChoices (pas le dîner d'un repas libre). */
function batchMeals(days){
  const out = [];
  days.forEach(function(d, i){ ['dej', 'diner'].forEach(function(slot){ if (!(slot === 'diner' && d.libre)) out.push({i:i, slot:slot, c:d.ch[slot]}); }); });
  return out;
}
/* Plats du bloc avec nid à la place de id : protéine, féculent et recette ; dessert gardé, poids fixés (g, g2) oubliés. Si
   elle est « Œufs + jambon » (4 tranches), les petits-déjeuners au jambon du bloc (salé, wrap) passent à la première autre
   base proposée. La collation (co, cs) reste.
   @param {{ch:Choices, libre:boolean}[]} days  @param {string} id  @param {string} nid  @param {string[]} [off]  @returns {Choices[]} */
function batchSwap(days, id, nid, off){
  const x = RECIPES[nid], sweet = allowed('pd', off).filter(function(b){ return !PD[b].ham; })[0];
  return days.map(function(d){
    const c = Object.assign({}, d.ch, {dej:Object.assign({}, d.ch.dej), diner:Object.assign({}, d.ch.diner)});
    ['dej', 'diner'].forEach(function(s){
      if (c[s].recette !== id) return;
      const o = {prot:x.p, starch:x.s};
      if (has(c[s], 'dessert')) o.dessert = c[s].dessert;
      o.recette = nid;
      c[s] = o;
    });
    if (x.p === 'oeufs' && has(PD, c.pdBase) && PD[c.pdBase].ham && sweet) c.pdBase = sweet;
    return c;
  });
}
/* Recettes qui peuvent remplacer id dans le bloc, mêmes règles que le tirage : elles se gardent (sinon toutes), protéine et
   féculent proposés ; ni une recette déjà dans le bloc, ni la protéine d'une autre recette du bloc, ni la protéine de l'autre
   repas d'un jour où elle est servie ; bœuf seulement sous 500 g de viande rouge cuite sur le bloc après le changement
   (portions de base × k) ; « Œufs + jambon » seulement pour 2 repas (4 tranches de jambon) et s'il reste une base sans
   jambon ; une recette qui se congèle mal seulement si tous ses repas tombent dans les 3 premiers jours ; jamais une recette
   à éviter (3.25.0). Celles de la même protéine d'abord, puis dans l'ordre de RECIPES.
   @returns {string[]} */
function batchSwapOptions(days, id, off, k, prefs){
  const kk = k || 1, prots = allowed('prot', off), starches = allowed('starch', off);
  const boeufCuit = sc(150, 10, kk) * YIELD.boeuf, sweet = allowed('pd', off).some(function(b){ return !PD[b].ham; });
  const ok = Object.keys(RECIPES).filter(function(x){ return prots.indexOf(RECIPES[x].p) >= 0 && starches.indexOf(RECIPES[x].s) >= 0; });
  const keep = ok.filter(function(x){ return RECIPES[x].box; }), pool = keep.length ? keep : ok;
  const meals = batchMeals(days), mine = meals.filter(function(m){ return m.c.recette === id; });
  const usedR = days.reduce(function(a, d){ return a.concat([d.ch.dej.recette, d.ch.diner.recette]); }, []).filter(function(r){ return r && r !== id; });
  const usedP = usedR.filter(function(r){ return has(RECIPES, r); }).map(function(r){ return RECIPES[r].p; });
  const p0 = has(RECIPES, id) ? RECIPES[id].p : null;
  return pool.filter(function(x){
    const r = RECIPES[x];
    if (x === id || usedR.indexOf(x) >= 0 || usedP.indexOf(r.p) >= 0 || recipePref(x, prefs) === 0) return false;
    if (mine.some(function(m){ const o = days[m.i].ch[m.slot === 'dej' ? 'diner' : 'dej']; return !days[m.i].libre && o.recette !== id && o.prot === r.p; })) return false;
    if (!r.gel && days.length > FRIDGE_DAYS && mine.some(function(m){ return m.i >= FRIDGE_DAYS; })) return false;
    if (r.p === 'oeufs' && (mine.length !== 2 || !sweet)) return false;
    if (r.p === 'boeuf'){
      let rouge = 0;
      batchSwap(days, id, x, off).forEach(function(c, i){ ['dej', 'diner'].forEach(function(s){ if (!(s === 'diner' && days[i].libre) && c[s].prot === 'boeuf') rouge += boeufCuit; }); });
      if (rouge > WEEK_GOALS.rouge + 0.5) return false;
    }
    return true;
  }).sort(function(a, b){ return (RECIPES[a].p === p0 ? 0 : 1) - (RECIPES[b].p === p0 ? 0 : 1); });
}
/* « Une autre au hasard » : parmi batchSwapOptions, tirée comme au batch (poisson × 3 tant que le bloc, sans elle, n'a pas
   2 repas de poisson, saumon × 6 s'il manque le poisson gras ; légumes secs × 3 tant qu'il en manque 2 ; féculent d'une
   autre recette du bloc × 0,3 ; favorite × 2, 3.25.0). null s'il n'y en a aucune. */
function batchSwapPick(days, id, off, k, rand, prefs){
  const opts = batchSwapOptions(days, id, off, k, prefs);
  if (!opts.length) return null;
  const others = batchMeals(days).filter(function(m){ return m.c.recette !== id; }), c = {poisson:0, gras:0, legumes:0};
  others.forEach(function(m){
    if (FISH.indexOf(m.c.prot) >= 0){ c.poisson++; if (m.c.prot === 'saumon') c.gras++; }
    if (LEGUMES.indexOf(m.c.starch) >= 0) c.legumes++;
  });
  const usedS = others.filter(function(m){ return has(RECIPES, m.c.recette); }).map(function(m){ return RECIPES[m.c.recette].s; });
  return tieredPick(rand || Math.random, opts, function(x){
    const r = RECIPES[x];
    let w = usedS.indexOf(r.s) >= 0 ? 0.3 : 1;
    if (FISH.indexOf(r.p) >= 0 && c.poisson < WEEK_GOALS.poisson) w *= r.p === 'saumon' && c.gras < WEEK_GOALS.gras ? 6 : 3;
    if (LEGUMES.indexOf(r.s) >= 0 && c.legumes < WEEK_GOALS.legumes) w *= 3;
    return w * recipePref(x, prefs);
  });
}
/* Batch cooking, chiffres ronds (3.17.0). Pour chaque recette d'un bloc servie au moins deux fois (repas libre exclu), qui se
   garde et dont la protéine se pèse (BATCH_GRAMS : viande, poisson, crevettes et halloumi, tofu), le total de ses boîtes est
   arrondi aux 100 g les plus proches, puis réparti entre elles au pas de la portion, au prorata des portions du jour. Si un
   jour sortait de sa fourchette de protéines (ou s'en éloignait), s'écartait de plus de 3 % de son objectif d'énergie (ou
   plus qu'avant), passait au-dessus du plafond des lipides (ou plus haut), ou le bœuf du bloc des 500 g cuits, l'arrondi passe de l'autre côté (crevettes et halloumi : les
   combinaisons les plus proches d'abord, puis l'une des deux arrondie seule) ; sinon la recette garde ses portions. « Œufs + jambon » : 2 tranches de jambon par boîte (90 g × k), les œufs restent à l'unité. Poids fixés dans
   ch[repas].g et g2 (voir fixedGrams) : plus ajustés à l'objectif de protéines, le féculent du jour compense. Les recettes
   déjà arrondies (un repas avec g ou g2) ne bougent pas : après un changement de recette, seule la nouvelle l'est.
   @param {{plan:Plan, ch:Choices}[]} days  @param {*} [profile] champs du profil  @returns {Choices[]} */
function batchRound(days, profile){
  const copy = function(c){ return Object.assign({}, c, {dej:Object.assign({}, c.dej), diner:Object.assign({}, c.diner)}); };
  let out = days.map(function(d){ return copy(d.ch); });
  const k = scaleOf(cleanProfile(profile));
  /* Sans imprévu (3.26.0) : la boîte est cuisinée comme prévu */
  const build = function(chs, i){ return buildDay(Object.assign({}, days[i].plan, {imprevu:null}), chs[i], profile); };
  /* Protéines d'un jour comparées à sa fourchette sur la journée normale (le repas libre n'a pas de macros connues) */
  const normal = function(chs, i){ return buildDay(Object.assign({}, days[i].plan, {libre:false, imprevu:null}), chs[i], profile); };
  const sec = function(r, slot){ return r.secs.find(function(s){ return s.id === slot; }); };
  const grams = function(r, slot, key){ const x = sec(r, slot).items.find(function(i){ return i.key === key; }); return x && x.buy ? x.buy.g || 0 : 0; };
  const band = function(r){ return Math.max(0, r.prot.low - r.tot.p, r.tot.p - r.prot.high); };
  const off3 = function(r){ return Math.abs(r.tot.kcal - r.energy.target) / r.energy.target; };
  /* Lipides au-dessus de leur plafond (95 g × k, ou 35 % de l'objectif les grosses journées) */
  const fatOver = function(r){ return Math.max(0, r.tot.f - Math.max(FAT_MAX * r.scale, 0.35 * r.energy.target / 9)); };
  /* Partage target entre les boîtes au prorata de nat, au pas step, somme exacte */
  const share = function(target, nat, step){
    const sum = nat.reduce(function(a, x){ return a + x; }, 0), raw = nat.map(function(x){ return x * target / sum; });
    const g = raw.map(function(x){ return Math.max(step, Math.round(x / step) * step); });
    let diff = target - g.reduce(function(a, x){ return a + x; }, 0);
    while (diff !== 0){
      const up = diff > 0;
      let best = -1;
      g.forEach(function(x, j){ if ((up || x > step) && (best < 0 || (up ? raw[j] - x > raw[best] - g[best] : raw[j] - x < raw[best] - g[best]))) best = j; });
      if (best < 0) break;
      g[best] += up ? step : -step; diff += up ? -step : step;
    }
    return g;
  };
  for (let b = 0; b < days.length; b += BATCH_BLOCK){
    const served = [];
    for (let i = b; i < Math.min(days.length, b + BATCH_BLOCK); i++)
      ['dej', 'diner'].forEach(function(s){ if (!(s === 'diner' && days[i].plan.libre)) served.push({i:i, s:s}); });
    const order = [];
    served.forEach(function(m){
      const c = out[m.i][m.s], id = recipeOf(c);
      if (id && RECIPES[id].box && has(BATCH_GRAMS, c.prot) && order.indexOf(id) < 0) order.push(id);
    });
    /* Une recette restée telle quelle peut passer une fois les autres arrondies : nouveaux passages tant que ça bouge */
    for (let pass = 0, moved = true; moved && pass < 3; pass++){ moved = false; order.forEach(function(id){
      const meals = served.filter(function(m){ return recipeOf(out[m.i][m.s]) === id; });
      if (meals.length < 2 || meals.some(function(m){ return fixedGrams(out[m.i][m.s]); })) return;
      const p = RECIPES[id].p, st = BATCH_GRAMS[p], idx = [];
      meals.forEach(function(m){ if (idx.indexOf(m.i) < 0) idx.push(m.i); });
      const before = {};
      const norm0 = {};
      idx.forEach(function(i){ before[i] = build(out, i); norm0[i] = normal(out, i); });
      /* Combinaisons à essayer : [g des boîtes, g2 des boîtes] */
      let combos;
      if (p === 'oeufs') combos = [[null, meals.map(function(){ return sc(90, 5, k); })]];
      else {
        const parts = [0, 1].map(function(j){
          if (!st[j]) return [null];
          const nat = meals.map(function(m){ return grams(before[m.i], m.s, j ? 'p2' : 'p1'); }), T = nat.reduce(function(a, x){ return a + x; }, 0);
          const near = Math.max(100, Math.round(T / 100) * 100), other = T < near ? Math.floor(T / 100) * 100 : Math.ceil(T / 100) * 100;
          return (other === near || other < 100 ? [near] : [near, other]).map(function(t){ return share(t, nat, st[j]); }).concat([null]);
        });
        /* Les plus proches d'abord ; une partie laissée telle quelle (null) en dernier recours, pas les deux */
        combos = [];
        parts[0].forEach(function(a, x){ parts[1].forEach(function(c, y){ if (a || c) combos.push({g:[a, c], d:(a ? x : 3) + (c ? y : 3)}); }); });
        combos = combos.sort(function(u, v){ return u.d - v.d; }).map(function(u){ return u.g; });
      }
      const beefBlock = function(chs){
        let t = 0;
        served.forEach(function(m){ if (chs[m.i][m.s].prot === 'boeuf') t += grams(idx.indexOf(m.i) >= 0 ? build(chs, m.i) : before[m.i] || build(chs, m.i), m.s, 'p1'); });
        return t * YIELD.boeuf;
      };
      const beef0 = p === 'boeuf' ? beefBlock(out) : 0;
      for (let t = 0; t < combos.length; t++){
        const next = out.slice();
        meals.forEach(function(m, j){
          next[m.i] = next[m.i] === out[m.i] ? copy(out[m.i]) : next[m.i];
          if (combos[t][0]) next[m.i][m.s].g = combos[t][0][j];
          if (combos[t][1]) next[m.i][m.s].g2 = combos[t][1][j];
        });
        const okDays = idx.every(function(i){ const r = normal(next, i); return band(r) <= band(norm0[i]) + 1e-9 && off3(r) <= Math.max(0.03, off3(norm0[i])) + 1e-9 && fatOver(r) <= fatOver(norm0[i]) + 1e-9; });
        const okBeef = p !== 'boeuf' || beefBlock(next) <= Math.max(WEEK_GOALS.rouge + 0.5, beef0);
        if (okDays && okBeef){ out = next; moved = true; break; }
      }
    }); }
  }
  return out;
}
