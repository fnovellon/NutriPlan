/* Séances par taille. Coût net par défaut = net × poids (MET·h nets ; pour la longue, par heure), réglable dans le profil. */
const SIZES = {
  petite:{band:'Petite séance', net:4},
  moyenne:{band:'Séance moyenne', net:6.3},
  longue:{band:'Sortie longue', net:7}
};
const MOMENTS = [['matin', 'Matin'], ['midi', 'Midi'], ['soir', 'Soir']];
const MOMENT_RANK = {matin:0, midi:1, soir:2};
const MAX_SEANCES = 4;
const DUREES = [[1.5,'1h30'],[2,'2' + NB + 'h'],[2.5,'2h30'],[3,'3' + NB + 'h et +']];
const DAYS = [
  {js:1, long:'lundi'}, {js:2, long:'mardi'}, {js:3, long:'mercredi'},
  {js:4, long:'jeudi'}, {js:5, long:'vendredi'}, {js:6, long:'samedi'},
  {js:0, long:'dimanche'}
];
/* Chaque jour part sans séance ; seul le repas libre du samedi est prévu par défaut */
/* Séances valides : au plus 4, une seule longue, toujours le matin */
function cleanSeances(list){
  const out = [];
  let long = false;
  (Array.isArray(list) ? list : []).forEach(function(x){
    if (!x || typeof x !== 'object' || !has(SIZES, x.taille) || out.length >= MAX_SEANCES) return;
    if (x.taille === 'longue'){
      if (long) return;
      long = true;
      out.push({taille:'longue', moment:'matin', duree:DUREES.some(function(d){ return d[0] === x.duree; }) ? x.duree : 2});
    } else {
      out.push({taille:x.taille, moment:has(MOMENT_RANK, x.moment) ? x.moment : 'soir'});
    }
  });
  return out;
}
/* Semaine type (réglages, 3.11.0) : séances habituelles par jour (clés getDay, 0 = dimanche) et jour du repas libre
   (samedi par défaut). Seuls les jours avec des séances sont gardés. */
function cleanWeek(o){
  const out = {jours:{}, libre:6};
  if (!o || typeof o !== 'object') return out;
  if (o.jours && typeof o.jours === 'object')
    for (let js = 0; js < 7; js++){ if (has(o.jours, String(js))){ const l = cleanSeances(o.jours[js]); if (l.length) out.jours[js] = l; } }
  if (Number.isInteger(o.libre) && o.libre >= 0 && o.libre <= 6) out.libre = o.libre;
  return out;
}
/* Jour pas encore rempli : les séances de la semaine type (aucune sans elle), repas libre son jour (samedi sans elle) */
function emptyPlan(js, sem){
  const w = sem || null, l = w && has(w.jours, String(js)) ? w.jours[js] : [];
  return {seances:l.map(function(x){ return Object.assign({}, x); }), libre:js === (w ? w.libre : 6)};
}
/* Plan d'un jour relu du stockage : ce qui n'est pas enregistré (séances, repas libre) vient de la semaine type */
function cleanPlan(p, js, sem){
  const out = emptyPlan(js, sem);
  if (!p || typeof p !== 'object') return out;
  if (has(p, 'libre')) out.libre = !!p.libre;
  if (has(p, 'seances')) out.seances = cleanSeances(p.seances);
  return out;
}
/* Plan enregistré avant la 2.0.0 (activité par sport) converti en séances */
function migratePlan(p){
  if (!p || typeof p !== 'object') return null;
  const m = p.moment === 'matin' ? 'matin' : 'soir', a = p.activity, list = [];
  if (a === 'muscu' || a === 'double') list.push({taille:'petite', moment:m});
  if (a === 'course' || a === 'double') list.push({taille:'moyenne', moment:m});
  if (a === 'longue') list.push({taille:'longue', moment:'matin', duree:p.duree});
  if (p.natation && a !== 'longue') list.push({taille:'petite', moment:'midi'});
  return {seances:list, libre:!!p.libre};
}

/* Aliments proposés : ceux retirés dans les réglages (profil off, entrées « type:id ») ne sont plus proposés ni tirés au
   hasard. Il en reste toujours au moins un par type ; « Aucun » dessert reste toujours possible. */
const CHOICE_IDS = {pd:PD_ORDER, prot:PROT_ORDER, starch:STARCH_ORDER, dessert:DESSERT_ORDER.filter(function(d){ return d !== 'aucun'; })};
function cleanOff(o){
  if (!Array.isArray(o)) return [];
  let out = [];
  o.slice(0, 100).forEach(function(x){
    if (typeof x !== 'string' || out.indexOf(x) >= 0) return;
    const i = x.indexOf(':'), kind = x.slice(0, i), id = x.slice(i + 1);
    if (i > 0 && has(CHOICE_IDS, kind) && CHOICE_IDS[kind].indexOf(id) >= 0) out.push(x);
  });
  Object.keys(CHOICE_IDS).forEach(function(kind){
    if (kind !== 'dessert' && CHOICE_IDS[kind].every(function(id){ return out.indexOf(kind + ':' + id) >= 0; }))
      out = out.filter(function(x){ return x.indexOf(kind + ':') !== 0; });
  });
  return out;
}
function allowed(kind, off){
  const all = kind === 'dessert' ? DESSERT_ORDER : CHOICE_IDS[kind], o = off || [];
  return all.filter(function(id){ return o.indexOf(kind + ':' + id) < 0; });
}
/* Plats proposés par l'appli (mémoire du jour de la semaine, choix par défaut) : un aliment retiré est remplacé par le
   suivant proposé dans la liste (un dessert retiré par « Aucun »), une protéine remplacée jamais par celle de l'autre repas
   (s'il en reste au moins deux). La recette choisie reste si sa protéine et son féculent restent. Les plats choisis pour une
   date ne passent pas par là. */
function withAllowed(c, off){
  const next = function(kind, id, avoid){
    const ok = allowed(kind, off);
    if (ok.indexOf(id) >= 0) return id;
    if (kind === 'dessert') return 'aucun';
    const all = CHOICE_IDS[kind], i = all.indexOf(id);
    for (let j = 1; j <= all.length; j++){ const x = all[(i + j) % all.length]; if (ok.indexOf(x) >= 0 && x !== avoid) return x; }
    return ok[0];
  };
  const dejProt = next('prot', c.dej.prot, allowed('prot', off).indexOf(c.diner.prot) >= 0 ? c.diner.prot : null);
  const meal = function(m, prot){
    const o = {prot:prot, starch:next('starch', m.starch), dessert:next('dessert', dessertOf(m))};
    if (recipeOf({prot:o.prot, starch:o.starch, recette:m.recette})) o.recette = m.recette;
    return o;
  };
  return {pdBase:next('pd', c.pdBase), dej:meal(c.dej, dejProt), diner:meal(c.diner, next('prot', c.diner.prot, dejProt))};
}
/* Repères de la semaine (Santé publique France, 2019) : poisson 2 fois dont 1 poisson gras, légumes secs au moins 2 fois,
   viande rouge 500 g cuits au plus, charcuterie 150 g au plus (le jambon blanc en est). Comptés sur des journées construites
   par buildDay (portions réelles), repas libre exclu ; viande rouge = bœuf cru × rendement de cuisson. */
const WEEK_GOALS = {poisson:2, gras:1, legumes:2, rouge:500, charcuterie:150};
const FISH = ['poisson', 'saumon', 'thon'], LEGUMES = ['lentilles', 'poischiches'];
function weekBalance(days){
  const b = {poisson:0, gras:0, legumes:0, rouge:0, charcuterie:0};
  days.forEach(function(r){ r.secs.forEach(function(s){
    if (s.libre) return;
    s.items.forEach(function(i){
      if (!i.buy) return;
      if ((s.id === 'dej' || s.id === 'diner') && i.key === 'p1' && FISH.indexOf(i.buy.id) >= 0){ b.poisson++; if (i.buy.id === 'saumon') b.gras++; }
      if (i.key === 'st' && LEGUMES.indexOf(i.buy.id) >= 0) b.legumes++;
      if (i.buy.id === 'boeuf') b.rouge += i.buy.g * YIELD.boeuf;
      if (i.buy.id === 'jambon') b.charcuterie += i.buy.g;
    });
  }); });
  return b;
}
/* Ce que la semaine demande encore, dans l'ordre d'importance : trop de charcuterie, trop de viande rouge, poisson gras,
   poisson, légumes secs. [] : semaine équilibrée. */
function weekNeeds(b){
  const out = [];
  if (b.charcuterie > WEEK_GOALS.charcuterie + 0.5) out.push('charcuterie');
  if (b.rouge > WEEK_GOALS.rouge + 0.5) out.push('rouge');
  if (b.gras < WEEK_GOALS.gras) out.push('gras');
  if (b.poisson < WEEK_GOALS.poisson) out.push('poisson');
  if (b.legumes < WEEK_GOALS.legumes) out.push('legumes');
  return out;
}
/* « Décide pour moi » : chaque choix tiré au hasard parmi les aliments proposés (rand : nombres dans [0, 1[, Math.random par
   défaut), jamais la même protéine au déjeuner et au dîner (s'il en reste au moins deux), jamais « Œufs + jambon » avec le
   petit-déjeuner salé (s'il reste autre chose). Avec bal (weekBalance du reste de la semaine) et k, le tirage équilibre :
   poisson (et poisson gras) et légumes secs trois fois plus probables tant qu'il en manque, bœuf, « Œufs + jambon » et salé
   écartés s'ils feraient dépasser la viande rouge ou la charcuterie. Sans bal : tirage uniforme. La recette du couple
   protéine × féculent est choisie d'office (tirée au hasard s'il y en a plusieurs). */
/* Tirage pondéré (rand : nombres dans [0, 1[). Poids > 0 : tirage pondéré ; 0 : écarté (repères) ; < 0 : écarté d'abord.
   Sans poids positif, tirage parmi les poids nuls, sinon parmi tous. */
function tieredPick(r, a, w){
  const ws = a.map(function(x){ return w ? w(x) : 1; }), sum = ws.reduce(function(t, x){ return t + Math.max(0, x); }, 0);
  const flat = function(b){ return b[Math.min(b.length - 1, Math.floor(r() * b.length))]; };
  if (sum <= 0){ const soft = a.filter(function(x, i){ return ws[i] === 0; }); return flat(soft.length ? soft : a); }
  let x = r() * sum;
  for (let i = 0; i < a.length; i++){ if (ws[i] > 0){ x -= ws[i]; if (x < 0) return a[i]; } }
  for (let i = a.length - 1; i >= 0; i--) if (ws[i] > 0) return a[i];
}
function randomChoices(rand, off, bal, k){
  const r = rand || Math.random, kk = k || 1, c = bal ? Object.assign({}, bal) : null;
  /* 0 : écarté par les repères ; < 0 : écarté d'abord (œufs-jambon avec le salé) */
  const pick = function(a, w){ return tieredPick(r, a, w); };
  const jambonSale = sc(45, 5, kk), jambonOeufs = sc(90, 5, kk), boeufCuit = sc(150, 10, kk) * YIELD.boeuf;
  const pdBase = pick(allowed('pd', off), function(x){ return c && x === 'sale' && c.charcuterie + jambonSale > WEEK_GOALS.charcuterie ? 0 : 1; });
  if (c && pdBase === 'sale') c.charcuterie += jambonSale;
  const protW = function(p){
    if (p === 'oeufs' && pdBase === 'sale') return -1;
    if (!c) return 1;
    if (p === 'boeuf' && c.rouge + boeufCuit > WEEK_GOALS.rouge) return 0;
    if (p === 'oeufs' && c.charcuterie + jambonOeufs > WEEK_GOALS.charcuterie) return 0;
    if (FISH.indexOf(p) >= 0 && c.poisson < WEEK_GOALS.poisson) return p === 'saumon' && c.gras < WEEK_GOALS.gras ? 6 : 3;
    return 1;
  };
  const starchW = function(s){ return c && LEGUMES.indexOf(s) >= 0 && c.legumes < WEEK_GOALS.legumes ? 3 : 1; };
  const meal = function(not){
    const prots = allowed('prot', off), other = prots.filter(function(p){ return p !== not; });
    const prot = pick(other.length ? other : prots, protW), starch = pick(allowed('starch', off), starchW);
    if (c){
      if (FISH.indexOf(prot) >= 0){ c.poisson++; if (prot === 'saumon') c.gras++; }
      if (prot === 'boeuf') c.rouge += boeufCuit;
      if (prot === 'oeufs') c.charcuterie += jambonOeufs;
      if (LEGUMES.indexOf(starch) >= 0) c.legumes++;
    }
    const o = {prot:prot, starch:starch, dessert:pick(allowed('dessert', off))}, recs = recipesFor(prot, starch);
    if (recs.length) o.recette = recs.length > 1 ? pick(recs) : recs[0];
    return o;
  };
  const dej = meal(null);
  return {pdBase:pdBase, dej:dej, diner:meal(dej.prot)};
}

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
     dîner d'un repas libre reçoit une recette du bloc d'une autre protéine, sans boîte. */
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
   Renvoie [{start, recipes:[{id, t, gel, boxes, totals}]}]. */
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

/* Profil et dépense énergétique */
const PROFILE_DEFAULT = {mode:'auto', sexe:'h', age:35, taille:178, poids:72, neat:'assis', gras:null, repos:null, deficit:15, ravito:60, shaker:'oui', shakerKcal:120, shakerProt:24, kcalPetite:null, kcalMoyenne:null, kcalLongueH:null, marge:150, prot:2, off:[], semaine:{jours:{}, libre:6}};
const PROFILE_RANGES = {age:[14,99], taille:[120,230], poids:[35,250], gras:[3,60], repos:[1200,6000], deficit:[0,25], ravito:[30,90], shakerKcal:[100,160], shakerProt:[10,40], kcalPetite:[100,1000], kcalMoyenne:[150,1500], kcalLongueH:[200,1200], marge:[0,300], prot:[1.6,2.2]};
/* Activité hors sport, en multiple du métabolisme de base (effet thermique des repas compris) */
const NEAT = {assis:1.4, mixte:1.55, debout:1.7};
const KCAL_PER_KG = 7700;

function profileFields(o){
  const out = {};
  if (!o || typeof o !== 'object') return out;
  if (o.mode === 'auto' || o.mode === 'manuel') out.mode = o.mode;
  if (o.shaker === 'oui' || o.shaker === 'non') out.shaker = o.shaker;
  if (o.sexe === 'h' || o.sexe === 'f') out.sexe = o.sexe;
  if (has(NEAT, o.neat)) out.neat = o.neat;
  Object.keys(PROFILE_RANGES).forEach(function(k){
    const v = o[k], r = PROFILE_RANGES[k];
    if (typeof v === 'number' && v >= r[0] && v <= r[1]) out[k] = v;
  });
  /* Objectif de protéines borné à 2,2 g/kg depuis la 3.11.1 : un objectif enregistré plus haut (jusqu'à 3,0, permis avant)
     devient 2,2 plutôt que la valeur par défaut */
  if (typeof o.prot === 'number' && o.prot > PROFILE_RANGES.prot[1] && o.prot <= 3) out.prot = PROFILE_RANGES.prot[1];
  if (Array.isArray(o.off)){ const off = cleanOff(o.off); if (off.length) out.off = off; }
  if (o.semaine && typeof o.semaine === 'object'){ const w = cleanWeek(o.semaine); if (Object.keys(w.jours).length || w.libre !== 6) out.semaine = w; }
  return out;
}
/* Profil complet. Enregistré avant la 1.3.0 (sans mode) : manuel s'il contient une dépense valide, sinon automatique. */
function cleanProfile(o){
  const f = profileFields(o);
  if (!f.mode) f.mode = has(f, 'repos') ? 'manuel' : 'auto';
  const out = Object.assign({}, PROFILE_DEFAULT, f);
  out.off = (f.off || []).slice();
  out.semaine = cleanWeek(f.semaine);
  return out;
}
/* Métabolisme de base : Cunningham si la masse grasse est connue (plus juste chez les sportifs), sinon Mifflin-St Jeor */
function bmr(p){
  if (p.gras !== null) return 500 + 22 * p.poids * (1 - p.gras / 100);
  return 10 * p.poids + 6.25 * p.taille - 5 * p.age + (p.sexe === 'f' ? -161 : 5);
}
/* Dépense d'un jour sans sport : saisie en mode manuel (bornes de PROFILE_RANGES), sinon calculée.
   En manuel sans dépense valide, le calcul prend le relais. */
function restSource(p){ return p.mode === 'manuel' && p.repos !== null ? 'saisie' : 'calcul'; }
function restNeed(p){ return restSource(p) === 'saisie' ? p.repos : bmr(p) * NEAT[p.neat]; }
/* Coût net d'une séance (le repos est déjà compté) : valeur du profil, sinon net × poids.
   Petite ≈ 1 h de muscu (5 MET), moyenne ≈ 7 km de course (≈ 0,9 kcal/kg/km), longue ≈ vélo d'endurance (8 MET) par heure. */
function seanceCost(x, p){
  if (x.taille === 'petite') return p.kcalPetite !== null ? p.kcalPetite : SIZES.petite.net * p.poids;
  if (x.taille === 'moyenne') return p.kcalMoyenne !== null ? p.kcalMoyenne : SIZES.moyenne.net * p.poids;
  return (p.kcalLongueH !== null ? p.kcalLongueH : SIZES.longue.net * p.poids) * x.duree;
}
function dayCost(plan, p){ return plan.seances.reduce(function(a, x){ return a + seanceCost(x, p); }, 0); }
/* Le déficit est un % de la dépense d'un jour sans sport, retiré chaque jour : les séances restent couvertes */
function energy(plan, p){
  const rest = restNeed(p), cost = dayCost(plan, p), deficit = rest * p.deficit / 100;
  return {bmr:bmr(p), rest:rest, mode:p.mode, restSource:restSource(p), cost:cost, need:rest + cost, deficit:deficit,
    target:Math.round((rest + cost - deficit) / 10) * 10, kgWeek:deficit * 7 / KCAL_PER_KG};
}

function dureeLabel(d){ const x = DUREES.find(function(a){ return a[0] === d; }); return x ? x[1] : DUREES[1][1]; }

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
  } else {
    const g = sc(long ? 80 : 60, 5, k);
    items.push(it('base', grams(g), 'flocons d’avoine ou muesli', 'muesli sans sucre ajouté. En porridge, ou trempés la veille dans le skyr', mac('avoine', g)));
  }
  const sk = Math.max(SKYR_MIN, sc(long ? 150 : 250, 10, kp));
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
function adj(item){ item.adj = true; return item; }
/* Féculent dosé en calories : changer de féculent ne change pas le total de la journée */
function starchItem(id, kcal){
  const S = STARCH[id];
  const q = Math.max(S.step, Math.round(kcal / (S.f[0] / 100) / S.step) * S.step);
  const k = q / 100;
  return it('st', grams(q), S.name, null, {kcal:S.f[0]*k, p:S.f[1]*k, c:S.f[2]*k, f:S.f[3]*k},
    S.cook ? {raw:S.raw, ways:S.cook.map(function(w){ return {g:Math.round(q * w[0] / 10) * 10, adj:w[1]}; })} : null, {id:id, g:q});
}
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
function dessertOf(choice){ return choice && has(DESSERT, choice.dessert) ? choice.dessert : 'aucun'; }
/* Repas : protéine, féculent (dosé ensuite), légumes ou ceux de la recette choisie (avec sa matière grasse et ses ajouts),
   puis l'ajout du soir (amandes, parmesan), avec la note de la recette s'il y en a une */
function mainItems(slot, choice, k, kp){
  const P = PROT[choice.prot], rec = recipeOf(choice), extra = P[slot](k);
  if (rec && RECIPES[rec].soir) extra.forEach(function(i){ i.note = RECIPES[rec].soir; });
  return P.base(P.fixe ? k : kp).map(function(i){ return P.fixe ? i : adj(i); }).concat([it('st', '', '', null, null)],
    rec ? recipeItems(rec) : [it('leg', grams(250), 'légumes', 'minimum, à volonté', mac('legumes', 250))], extra);
}
function setStarch(sec, item){ sec.items = sec.items.map(function(i){ return i.key === 'st' ? item : i; }); }
function allItems(secs){ return secs.reduce(function(a, s){ return a.concat(s.items); }, []); }
function fuel(d, rate){
  const g = Math.round(rate * d / 5) * 5;
  return it('fuel', grams(g), 'glucides pendant l’effort', rate + NB + 'g par heure' + NB + ': boisson d’effort, gels ou pâtes de fruits', {kcal:g * 4, p:0, c:g, f:0}, null, {id:'ravito', g:g});
}

/* Construit la journée pour un facteur de protéines pf donné (voir buildDay) */
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
   la même journée sans repas libre (le repas libre n'a pas de macros connues). */
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

/* Liste de courses : les achats (buy) de plusieurs journées construites par buildDay, additionnés et rangés par rayon.
   Poids crus, pièces entières, budgets en kcal.
   Renvoie [{title, lines:[{id, qty, name, note}]}], rayons et lignes vides omis. */
const SHOP_AISLES = [
  {title:'Viandes et poissons', ids:['poulet', 'boeuf', 'poisson', 'saumon', 'crevettes', 'jambon']},
  {title:'Crèmerie, œufs et tofu', ids:['skyr', 'oeufs', 'halloumi', 'parmesan', 'creme', 'lait', 'tofu']},
  {title:'Pain et féculents, poids crus', ids:['pain'].concat(STARCH_ORDER)},
  {title:'Fruits et légumes', ids:['legumes'].concat(VEG_IDS.filter(function(v){ return v !== 'pulpe'; }), ['fruitsRouges', 'banane', 'pomme', 'fruit'])},
  {title:'Épicerie', ids:['avoine', 'amandes', 'miel', 'fruitsSecs', 'chocolat', 'thon', 'pulpe', 'compote', 'huile', 'coco', 'olives', 'sesame', 'tahini']},
  {title:'Le reste', ids:['shaker', 'ravito', 'encas', 'marge', 'libre']}
];
function shopQty(g){
  if (g < 1000) return grams(Math.round(g));
  return (Math.round(g / 10) / 100).toLocaleString('fr-FR') + NB + 'kg';
}
function shoppingList(days){
  const sum = {};
  days.forEach(function(d){ d.secs.forEach(function(s){ s.items.forEach(function(i){
    if (!i.buy) return;
    const a = sum[i.buy.id] || (sum[i.buy.id] = {g:0, n:0, kcal:0});
    a.g += i.buy.g || 0; a.n += i.buy.n || 0; a.kcal += i.buy.kcal || 0;
  }); }); });
  const get = function(id){ return sum[id] || {g:0, n:0, kcal:0}; };
  const pl = function(n, one, many){ return n > 1 ? many : one; };
  const kc = function(k){ return '≈' + NB + fmtInt(Math.round(k / 10) * 10) + NB + 'kcal'; };
  const line = function(id){
    const a = get(id);
    if (id === 'oeufs'){
      const n = get('oeuf').n;
      return n ? {qty:String(n), name:pl(n, 'œuf', 'œufs'), note:null} : null;
    }
    const PIECES = {banane:['banane', 'bananes', null], pomme:['pomme', 'pommes', null], fruit:['fruit au choix', 'fruits au choix', 'pomme, poire, orange, 2 kiwis…'],
      thon:['boîte de thon au naturel', 'boîtes de thon au naturel', null], compote:['compote', 'compotes', 'pots sans sucre ajouté'],
      shaker:['dose de shaker', 'doses de shaker', null]};
    if (has(PIECES, id)) return a.n ? {qty:String(a.n), name:pl(a.n, PIECES[id][0], PIECES[id][1]), note:PIECES[id][2]} : null;
    if (id === 'libre') return a.n ? {qty:String(a.n), name:pl(a.n, 'repas libre', 'repas libres'), note:kc(a.kcal) + ' au total'} : null;
    if (id === 'encas') return a.kcal ? {qty:kc(a.kcal), name:'d’encas', note:'pain complet et miel, fruits secs, riz au lait, barre de céréales'} : null;
    if (id === 'marge') return a.kcal ? {qty:kc(a.kcal), name:'pour la cuisine', note:'environ ' + grams(Math.round(a.kcal / 9 / 5) * 5) + ' d’huile'} : null;
    if (!a.g) return null;
    if (id === 'ravito') return {qty:shopQty(a.g), name:'de glucides pour l’effort', note:'boisson d’effort, gels ou pâtes de fruits'};
    const NAMES = {poulet:'viande blanche maigre', boeuf:'bœuf haché 5' + NB + '%', poisson:'poisson blanc', saumon:'poisson gras', crevettes:'crevettes cuites',
      jambon:'jambon blanc', skyr:'skyr nature', halloumi:'halloumi', parmesan:'parmesan', tofu:'tofu ferme', pain:'pain complet', legumes:'légumes verts',
      fruitsRouges:'fruits rouges', avoine:'flocons d’avoine ou muesli', amandes:'amandes', miel:'miel', fruitsSecs:'fruits secs', chocolat:'chocolat noir', huile:'huile d’olive'};
    const NOTES = {poulet:'poulet, dinde ou filet mignon de porc', poisson:'cabillaud, colin…', saumon:'saumon, maquereau ou sardines à l’huile', tofu:'nature', avoine:'muesli sans sucre ajouté',
      jambon:slices(a.g, 45), pain:slices(a.g, 40), legumes:'au choix', fruitsRouges:'surgelés, c’est parfait', fruitsSecs:'abricots, pruneaux ou figues',
      chocolat:'70' + NB + '% ou plus'};
    return {qty:shopQty(a.g), name:has(STARCH, id) ? STARCH[id].name : has(NAMES, id) ? NAMES[id] : RFOOD[id][0],
      note:has(NOTES, id) ? NOTES[id] : has(RFOOD, id) ? RFOOD[id][1] : null};
  };
  return SHOP_AISLES.map(function(g){
    return {title:g.title, lines:g.ids.map(function(id){ const l = line(id); return l ? Object.assign({id:id}, l) : null; }).filter(Boolean)};
  }).filter(function(g){ return g.lines.length; });
}

