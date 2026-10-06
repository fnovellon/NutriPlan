/* Choix des plats : aliments proposés ou retirés (cleanOff, allowed, withAllowed), « Décide pour moi » (randomChoices) et
   tirage pondéré partagé avec le batch cooking (tieredPick). */
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
/* Recettes favorites et à éviter (3.25.0) : identifiants de RECIPES, sans doublon */
function cleanRecipeIds(o){
  if (!Array.isArray(o)) return [];
  return o.slice(0, 200).filter(function(x, i, a){ return typeof x === 'string' && has(RECIPES, x) && a.indexOf(x) === i; });
}
/* Poids d'une recette dans les tirages : 0 à éviter (jamais tirée), 2 favorite, 1 sinon ; prefs : { fav, ban } (le profil) */
function recipePref(id, prefs){
  if (!prefs || !id) return 1;
  if (prefs.ban && prefs.ban.indexOf(id) >= 0) return 0;
  return prefs.fav && prefs.fav.indexOf(id) >= 0 ? 2 : 1;
}
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
/* « Décide pour moi » : chaque choix tiré au hasard parmi les aliments proposés (rand : nombres dans [0, 1[, Math.random par
   défaut), jamais la même protéine au déjeuner et au dîner (s'il en reste au moins deux), jamais « Œufs + jambon » avec le
   petit-déjeuner salé (s'il reste autre chose). Avec bal (weekBalance du reste de la semaine) et k, le tirage équilibre :
   poisson (et poisson gras) et légumes secs trois fois plus probables tant qu'il en manque, bœuf, « Œufs + jambon » et salé
   écartés s'ils feraient dépasser la viande rouge ou la charcuterie. Sans bal : tirage uniforme. La recette du couple
   protéine × féculent est choisie d'office (tirée au hasard s'il y en a plusieurs).
   Avec prefs (3.25.0, recettes favorites et à éviter, seulement quand les plats sont des recettes) : chaque couple pèse le
   poids de sa recette (recipePref : 0 à éviter, 2 favorite), la protéine la part de ses couples (le tirage du couple garde
   donc les poids ci-dessus, multipliés) ; une recette à éviter n'est jamais tirée (s'il ne reste qu'elle, le couple vient
   sans recette).
   @param {function():number} [rand]  @param {string[]} [off] aliments retirés  @param {Object} [bal] weekBalance du reste de la semaine
   @param {number} [k] facteur de portions  @param {{fav:string[], ban:string[]}} [prefs]  @returns {Choices} */
function randomChoices(rand, off, bal, k, prefs){
  const r = rand || Math.random, kk = k || 1, c = bal ? Object.assign({}, bal) : null;
  const pp = prefs && ((prefs.fav && prefs.fav.length) || (prefs.ban && prefs.ban.length)) ? prefs : null;
  const cp = function(p, s){ return recipePref(recipesFor(p, s)[0], pp); };
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
    const prots = allowed('prot', off), other = prots.filter(function(p){ return p !== not; }), sts = allowed('starch', off);
    /* Préférences : la protéine pèse la part pondérée de ses couples, le féculent le poids de la recette du couple */
    const share = function(p){
      const t = sts.reduce(function(a, s){ return a + starchW(s); }, 0), u = sts.reduce(function(a, s){ return a + starchW(s) * cp(p, s); }, 0);
      return t > 0 ? u / t : 1;
    };
    const prot = pick(other.length ? other : prots, pp ? function(p){ const w = protW(p); return w > 0 ? w * share(p) : w; } : protW);
    const starch = pick(sts, pp ? function(s){ return starchW(s) * cp(prot, s); } : starchW);
    if (c){
      if (FISH.indexOf(prot) >= 0){ c.poisson++; if (prot === 'saumon') c.gras++; }
      if (prot === 'boeuf') c.rouge += boeufCuit;
      if (prot === 'oeufs') c.charcuterie += jambonOeufs;
      if (LEGUMES.indexOf(starch) >= 0) c.legumes++;
    }
    const o = {prot:prot, starch:starch, dessert:pick(allowed('dessert', off))}, recs = recipesFor(prot, starch);
    const okR = recs.filter(function(id){ return recipePref(id, pp) > 0; });
    if (okR.length) o.recette = okR.length > 1 ? pick(okR) : okR[0];
    return o;
  };
  const dej = meal(null);
  return {pdBase:pdBase, dej:dej, diner:meal(dej.prot)};
}
