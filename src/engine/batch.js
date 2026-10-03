/* Batch cooking (3.13.0) : pour une période (jours consécutifs, par blocs de 7 à partir du premier), quelques recettes qui
   se gardent (3, 4 ou 5) répétées aux déjeuners et aux dîners, cuisinées en une fois la veille du bloc. Un plat cuisiné se
   garde 3 jours au frigo (FRIDGE_DAYS) : les boîtes mangées plus tard vont au congélateur. */
const BATCH_BLOCK = 7, BATCH_N = [3, 4, 5], FRIDGE_DAYS = 3;
/* Plats d'une période en batch cooking. days : [{libre}] dans l'ordre des dates ; renvoie les choix de chaque jour
   ({pdBase, dej, diner}, recette comprise ; rand comme randomChoices). Par bloc :
   - n recettes au plus (au moins deux repas chacune), parmi celles qui se gardent et dont la protéine et le féculent sont
     proposés ; protéines différentes et féculents variés autant que possible ; poisson, poisson gras et légumes secs
     favorisés tant que le bloc en manque ; bœuf et « Œufs + jambon » écartés d'abord s'ils feraient dépasser la viande rouge
     ou la charcuterie (repas du bloc, au nombre de boîtes le plus haut), comme une protéine qui aurait plus de repas que le
     bloc n'a de jours ; une recette qui se congèle mal seulement si ses boîtes tiennent dans les 3 premiers jours (une par
     jour au plus, avec les autres qui se congèlent mal, une seule par protéine) et qu'il en reste deux qui se congèlent bien
     pour la suite ;
   - boîtes : les moins nombreuses aux recettes servies d'abord (celles qui se congèlent mal, poisson en tête) ; repas
     répartis dans l'ordre des jours, deux recettes en cours à la fois (celle qui se congèle mal, sinon la plus fournie,
     d'abord), en alternant ; jamais la
     même protéine au déjeuner et au dîner si c'est possible (échange avec le repas le plus proche) ;
   - petit-déjeuner comme randomChoices (pas de salé avec « Œufs + jambon », charcuterie comptée), desserts au hasard ; le
     dîner d'un repas libre reçoit une recette du bloc d'une autre protéine, sans boîte.
   @param {{libre:boolean}[]} days  @param {number} n  @param {string[]} [off]  @param {number} [k]  @param {function():number} [rand]
   @returns {Choices[]} */
function batchChoices(days, n, off, k, rand){
  const r = rand || Math.random, kk = k || 1, nn = BATCH_N.indexOf(n) >= 0 ? n : 4;
  const pick = function(a, w){ return tieredPick(r, a, w); };
  const jambonSale = sc(45, 5, kk), jambonOeufs = sc(90, 5, kk), boeufCuit = sc(150, 10, kk) * YIELD.boeuf;
  const prots = allowed('prot', off), starches = allowed('starch', off);
  const ok = Object.keys(RECIPES).filter(function(id){ return prots.indexOf(RECIPES[id].p) >= 0 && starches.indexOf(RECIPES[id].s) >= 0; });
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
    const ct = cnt[nr - 1], c = {poisson:0, gras:0, legumes:0, rouge:0, charcuterie:0}, chosen = [], perProt = {}, perFresh = {};
    cnt.forEach(function(){
      const usedP = chosen.map(function(id){ return RECIPES[id].p; }), usedS = chosen.map(function(id){ return RECIPES[id].s; });
      const noGel = chosen.filter(function(id){ return !RECIPES[id].gel; }).length, fresh = pool.filter(function(id){ return chosen.indexOf(id) < 0; });
      const id = pick(fresh.length ? fresh : pool, function(id){
        const x = RECIPES[id];
        if (x.p === 'boeuf' && c.rouge + ct * boeufCuit > WEEK_GOALS.rouge) return -1;
        if (x.p === 'oeufs' && c.charcuterie + ct * jambonOeufs > WEEK_GOALS.charcuterie) return -1;
        if ((perProt[x.p] || 0) + ct > block.length || (!x.gel && (noGel >= maxNoGel || (perFresh[x.p] || 0) + ct > FRIDGE_DAYS))) return -1;
        if (usedP.indexOf(x.p) >= 0) return 0;
        let w = usedS.indexOf(x.s) >= 0 ? 0.3 : 1;
        if (FISH.indexOf(x.p) >= 0 && c.poisson < WEEK_GOALS.poisson) w *= x.p === 'saumon' && c.gras < WEEK_GOALS.gras ? 6 : 3;
        if (LEGUMES.indexOf(x.s) >= 0 && c.legumes < WEEK_GOALS.legumes) w *= 3;
        return w;
      });
      const x = RECIPES[id];
      if (FISH.indexOf(x.p) >= 0){ c.poisson += ct; if (x.p === 'saumon') c.gras += ct; }
      if (LEGUMES.indexOf(x.s) >= 0) c.legumes += ct;
      if (x.p === 'boeuf') c.rouge += ct * boeufCuit;
      if (x.p === 'oeufs') c.charcuterie += ct * jambonOeufs;
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
    block.forEach(function(d, i){
      const dej = at[i].dej, din = at[i].diner || ent.find(function(e){ return prot(e) !== prot(dej); }) || dej;
      const oe = prot(dej) === 'oeufs' || prot(din) === 'oeufs';
      const pdBase = pick(allowed('pd', off), function(x){
        if (x !== 'sale') return 1;
        if (oe) return -1;
        return c.charcuterie + jambonSale > WEEK_GOALS.charcuterie ? 0 : 1;
      });
      if (pdBase === 'sale') c.charcuterie += jambonSale;
      const meal = function(e){ const x = RECIPES[e.id]; return {prot:x.p, starch:x.s, dessert:pick(allowed('dessert', off)), recette:e.id}; };
      out.push({pdBase:pdBase, dej:meal(dej), diner:meal(din)});
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
/* Plats du bloc avec nid à la place de id : protéine, féculent et recette ; dessert gardé. Un jour où elle devient
   « Œufs + jambon », le petit-déjeuner salé passe à la première autre base proposée (pas de salé avec les œufs-jambon).
   @param {{ch:Choices, libre:boolean}[]} days  @param {string} id  @param {string} nid  @param {string[]} [off]  @returns {Choices[]} */
function batchSwap(days, id, nid, off){
  const x = RECIPES[nid], sweet = allowed('pd', off).filter(function(b){ return b !== 'sale'; })[0];
  return days.map(function(d){
    const c = {pdBase:d.ch.pdBase, dej:Object.assign({}, d.ch.dej), diner:Object.assign({}, d.ch.diner)};
    let hit = false;
    ['dej', 'diner'].forEach(function(s){ if (c[s].recette === id){ c[s].prot = x.p; c[s].starch = x.s; c[s].recette = nid; hit = true; } });
    if (hit && x.p === 'oeufs' && c.pdBase === 'sale' && sweet) c.pdBase = sweet;
    return c;
  });
}
/* Recettes qui peuvent remplacer id dans le bloc, mêmes règles que le tirage : elles se gardent (sinon toutes), protéine et
   féculent proposés ; ni une recette déjà dans le bloc, ni la protéine d'une autre recette du bloc, ni la protéine de l'autre
   repas d'un jour où elle est servie ; bœuf ou « Œufs + jambon » seulement sous 500 g de viande rouge cuite et 150 g de
   charcuterie sur le bloc après le changement (portions de base × k) ; une recette qui se congèle mal seulement si tous ses
   repas tombent dans les 3 premiers jours. Celles de la même protéine d'abord, puis dans l'ordre de RECIPES.
   @returns {string[]} */
function batchSwapOptions(days, id, off, k){
  const kk = k || 1, prots = allowed('prot', off), starches = allowed('starch', off);
  const jambonSale = sc(45, 5, kk), jambonOeufs = sc(90, 5, kk), boeufCuit = sc(150, 10, kk) * YIELD.boeuf;
  const ok = Object.keys(RECIPES).filter(function(x){ return prots.indexOf(RECIPES[x].p) >= 0 && starches.indexOf(RECIPES[x].s) >= 0; });
  const keep = ok.filter(function(x){ return RECIPES[x].box; }), pool = keep.length ? keep : ok;
  const meals = batchMeals(days), mine = meals.filter(function(m){ return m.c.recette === id; });
  const usedR = days.reduce(function(a, d){ return a.concat([d.ch.dej.recette, d.ch.diner.recette]); }, []).filter(function(r){ return r && r !== id; });
  const usedP = usedR.filter(function(r){ return has(RECIPES, r); }).map(function(r){ return RECIPES[r].p; });
  const p0 = has(RECIPES, id) ? RECIPES[id].p : null;
  return pool.filter(function(x){
    const r = RECIPES[x];
    if (x === id || usedR.indexOf(x) >= 0 || usedP.indexOf(r.p) >= 0) return false;
    if (mine.some(function(m){ const o = days[m.i].ch[m.slot === 'dej' ? 'diner' : 'dej']; return !days[m.i].libre && o.recette !== id && o.prot === r.p; })) return false;
    if (!r.gel && days.length > FRIDGE_DAYS && mine.some(function(m){ return m.i >= FRIDGE_DAYS; })) return false;
    if (r.p === 'boeuf' || r.p === 'oeufs'){
      const after = batchSwap(days, id, x, off), lim = {rouge:0, charcuterie:0};
      after.forEach(function(c, i){
        if (c.pdBase === 'sale') lim.charcuterie += jambonSale;
        ['dej', 'diner'].forEach(function(s){
          if (s === 'diner' && days[i].libre) return;
          if (c[s].prot === 'boeuf') lim.rouge += boeufCuit;
          if (c[s].prot === 'oeufs') lim.charcuterie += jambonOeufs;
        });
      });
      if (r.p === 'boeuf' && lim.rouge > WEEK_GOALS.rouge + 0.5) return false;
      if (r.p === 'oeufs' && lim.charcuterie > WEEK_GOALS.charcuterie + 0.5) return false;
    }
    return true;
  }).sort(function(a, b){ return (RECIPES[a].p === p0 ? 0 : 1) - (RECIPES[b].p === p0 ? 0 : 1); });
}
/* « Une autre au hasard » : parmi batchSwapOptions, tirée comme au batch (poisson × 3 tant que le bloc, sans elle, n'a pas
   2 repas de poisson, saumon × 6 s'il manque le poisson gras ; légumes secs × 3 tant qu'il en manque 2 ; féculent d'une
   autre recette du bloc × 0,3). null s'il n'y en a aucune. */
function batchSwapPick(days, id, off, k, rand){
  const opts = batchSwapOptions(days, id, off, k);
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
    return w;
  });
}
