  /* Interface (tout ce fichier et les suivants sont dans if (typeof document !== 'undefined'){ … }, voir src/page.html).
     État : stockage, profil, dates, jour affiché, plats et plan d'un jour, enregistrement. */
  /* Stockage v2 (séances). Au premier chargement, la v1 (activité par sport) est convertie et laissée intacte. */
  const KEY = 'repas-du-jour:v2', OLD_KEY = 'repas-du-jour:v1';
  const readObj = function(k){
    try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch (e) { return null; }
  };
  const persist = function(){ try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  let store = readObj(KEY), migrated = false;
  if (!store){
    const old = readObj(OLD_KEY);
    store = {plans:{}, choices:{}};
    if (old){
      if (old.plans && typeof old.plans === 'object') Object.keys(old.plans).forEach(function(k){ const m = migratePlan(old.plans[k]); if (m) store.plans[k] = m; });
      if (old.choices && typeof old.choices === 'object' && !Array.isArray(old.choices)) store.choices = old.choices;
      migrated = true;
    }
  }
  if (!store.plans || typeof store.plans !== 'object') store.plans = {};
  if (!store.choices || typeof store.choices !== 'object') store.choices = {};
  /* Profil : clé séparée, seules les valeurs saisies sont gardées (les autres prennent les valeurs par défaut) */
  const PKEY = 'repas-du-jour:profil:v1';
  let prof = {};
  try { prof = profileFields(JSON.parse(localStorage.getItem(PKEY) || '{}')); } catch (e) { prof = {}; }
  if (!has(prof, 'mode')) prof.mode = cleanProfile(prof).mode;
  const saveProf = function(){ try { localStorage.setItem(PKEY, JSON.stringify(prof)); } catch (e) {} };

  const noon = function(){ const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
  let today = noon(), todayJs = today.getDay();
  /* Jours passés depuis plus de 21 jours effacés ; les jours à venir (planifiés) sont gardés */
  const purge = function(){
    let n = 0;
    Object.keys(store.plans).forEach(function(k){
      const d = new Date(k + 'T12:00:00');
      if (!/^\d{4}-\d\d-\d\d$/.test(k) || isNaN(d.getTime()) || today - d > 21 * 864e5){ delete store.plans[k]; n++; }
    });
    return n;
  };
  if (purge() || migrated) persist();

  const $ = function(id){ return document.getElementById(id); };
  const isoDate = function(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const fromIso = function(k){ const d = new Date(k + 'T12:00:00'); return isNaN(d.getTime()) ? null : d; };
  const addDays = function(d, n){ const x = new Date(d); x.setDate(d.getDate() + n); x.setHours(12, 0, 0, 0); return x; };
  const dayDiff = function(d){ return Math.round((d - today) / 864e5); };
  /* Les 7 jours (lundi → dimanche) de la semaine d'une date : règle du repas libre, bandeau du calendrier */
  const weekOf = function(d){ const mon = addDays(d, -((d.getDay() + 6) % 7)); return [0, 1, 2, 3, 4, 5, 6].map(function(i){ return addDays(mon, i); }); };
  /* Libellés d'une date : « jeudi 1er octobre » (jour et mois liés par une espace insécable) */
  const dayLabel = function(d){
    return d.toLocaleDateString('fr-FR', {weekday:'long'}) + ' ' + (d.getDate() === 1 ? '1er' : d.getDate()) + NB + d.toLocaleDateString('fr-FR', {month:'long'});
  };
  const cap = function(t){ return t.charAt(0).toUpperCase() + t.slice(1); };
  const low = function(t){ return t.charAt(0).toLowerCase() + t.slice(1); };
  /* Recette de saison (4.3.0) : une feuille après son nom, si elle n'est pas de toute l'année et qu'elle est de la saison de d */
  const LEAF = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20c-.5-8.5 4.5-14.5 15-15-.5 10.5-6.5 15.5-15 15z"/><path d="M5 20l8-8"/></svg>';
  const leafFor = function(id, d){ return seasonal(id) && inSeason(id, seasonOf(d)) ? '<span class="leaf" role="img" aria-label="de saison" title="De saison">' + LEAF + '</span>' : ''; };
  /* Ses saisons, en une phrase : « De saison : automne et hiver. », « Toute l'année. » */
  const seasonLine = function(id){ return seasonal(id) ? 'De saison' + NB + ': ' + low(seasonsText(id)) + '.' : 'Toute l’année.'; };
  /* « aujourd'hui », « demain », « hier » ou « jeudi 8 octobre » */
  const dayRel = function(d){ const r = {'-1':'hier', '0':'aujourd’hui', '1':'demain'}[dayDiff(d)]; return r || dayLabel(d); };

  /* Jour affiché (calendrier) : selDate à midi, sel = son jour de la semaine */
  let selDate = today, sel = todayJs, plan = null, ch = null, prevQty = new Map();
  const selIso = function(){ return isoDate(selDate); };

  /* Collation choisie (3.29.0, co et cs, absentes = œufs durs, banane et compote) : reprise de from */
  const keepSnack = function(c, from){ ['co', 'cs'].forEach(function(f){ if (from && has(from, f)) c[f] = from[f]; }); return c; };
  /* Choix des plats relus et validés ; ce qui manque vient de base (sinon des choix par défaut du jour de la semaine) */
  const cleanCh = function(c, js, base){
    const d = base || DEFAULT_CHOICES[js];
    const out = keepSnack({pdBase:d.pdBase, dej:Object.assign({}, d.dej), diner:Object.assign({}, d.diner)}, d);
    if (c && typeof c === 'object'){
      if (has(PD, c.pdBase)) out.pdBase = c.pdBase;
      if (has(SNACK, c.co)) out.co = c.co;
      if (has(SNACK_CS, c.cs)) out.cs = c.cs;
      ['dej', 'diner'].forEach(function(s){
        if (c[s] && typeof c[s] === 'object'){
          if (has(PROT, c[s].prot)) out[s].prot = c[s].prot;
          if (has(STARCH, c[s].starch)) out[s].starch = c[s].starch;
          if (has(DESSERT, c[s].dessert)) out[s].dessert = c[s].dessert;
          if (has(RECIPES, c[s].recette)) out[s].recette = c[s].recette; else delete out[s].recette;
          ['g', 'g2'].forEach(function(f){ if (has(c[s], f)) out[s][f] = c[s][f]; });
        }
      });
    }
    /* Une recette ne reste que si elle va avec la protéine et le féculent du repas ; les poids fixés d'une boîte de batch
       cooking (g, g2, 3.17.0) que s'ils sont valides, avec elle */
    ['dej', 'diner'].forEach(function(s){
      if (!recipeOf(out[s])) delete out[s].recette;
      const fx = fixedGrams(out[s]);
      if (!fx || fx[0] === null) delete out[s].g;
      if (!fx || fx[1] === null) delete out[s].g2;
    });
    return out;
  };
  /* Après un changement de protéine ou de féculent : la recette qui ne va plus est retirée, avec les poids fixés de sa boîte */
  const dropRecipes = function(c){ ['dej', 'diner'].forEach(function(s){ if (has(c[s], 'recette') && !recipeOf(c[s])){ delete c[s].recette; delete c[s].g; delete c[s].g2; } }); };
  /* Plats d'une date : les siens (plans[date].ch), sinon les derniers choisis pour ce jour de la semaine, sinon ceux par défaut */
  const choicesFor = function(iso, js){
    const rec = store.plans[iso], mem = withAllowed(cleanCh(store.choices[js], js), cleanProfile(prof).off);
    return rec && rec.ch && typeof rec.ch === 'object' ? cleanCh(rec.ch, js, mem) : mem;
  };
  /* Semaine type des réglages : séances habituelles et jour du repas libre */
  const semOf = function(){ return cleanProfile(prof).semaine; };
  /* Repas libres enregistrés pour une date (5.0.0), sinon null (ils viennent de la semaine type) */
  const recLibre = function(iso){ const o = store.plans[iso]; return o && typeof o === 'object' && has(o, 'libre') ? cleanLibre(o.libre) : null; };
  /* Plan d'une date : ce qui est enregistré, le reste de la semaine type. Le repas plaisir de la semaine type (le dîner de
     son jour) ne compte pas si un autre jour de la même semaine a un repas plaisir enregistré (un par semaine). */
  const basePlan = function(iso){
    const d = fromIso(iso), p = cleanPlan(store.plans[iso], d.getDay(), semOf());
    if (hasLibre(p) && !recLibre(iso) && weekOf(d).some(function(x){
      const i = isoDate(x), l = recLibre(i);
      return i !== iso && l && LIBRE_SLOTS.some(function(s){ return l[s] === 'plaisir'; });
    })) p.libre = {};
    return p;
  };
  /* Veille d'une sortie longue (3.28.0) : la durée de celle du lendemain (prévue ou de la semaine type), pour recharger */
  const planFor = function(iso){
    const p = basePlan(iso), l = basePlan(isoDate(addDays(fromIso(iso), 1))).seances.find(function(x){ return x.taille === 'longue'; });
    if (l) p.veille = l.duree;
    /* Numéro du jour (3.31.0) : la recette proposée sous un repas tourne d'un jour à l'autre */
    p.jour = Math.round(fromIso(iso).getTime() / 864e5);
    return p;
  };
  const loadSel = function(){ sel = selDate.getDay(); plan = planFor(selIso()); ch = choicesFor(selIso(), sel); };
  /* Enregistre une date champ par champ (séances, repas libre, plats, imprévu) : ce qui n'a jamais été touché reste à la semaine
     type ; un champ à null est retiré (imprévu, 3.26.0) */
  const writeDay = function(iso, f){
    const old = store.plans[iso] && typeof store.plans[iso] === 'object' ? store.plans[iso] : {}, rec = {};
    ['seances', 'libre', 'ch', 'imprevu'].forEach(function(k){ if (has(f, k)){ if (f[k] !== null) rec[k] = f[k]; } else if (has(old, k)) rec[k] = old[k]; });
    store.plans[iso] = rec;
  };
  const savePlan = function(f){ writeDay(selIso(), f); persist(); };
  /* Plan sans repas libre, et sans l'imprévu de ce repas (3.26.0) : pour les quantités d'une recette à ce repas, comme la
     page les donnerait (un imprévu sur un autre repas reste compté) */
  const planForMeal = function(p, slot){
    const im = cleanImprevu(p.imprevu);
    return Object.assign({}, p, {libre:{}}, im && im.slot === slot ? {imprevu:null} : {});
  };
  /* Plats choisis : pour cette date, et en mémoire pour ce jour de la semaine (repris par les jours pas encore choisis) */
  const saveCh = function(){ writeDay(selIso(), {ch:ch}); store.choices[sel] = ch; persist(); };
  /* Repas libres (5.0.0) : autant qu'on veut, au déjeuner et au dîner ; un seul repas plaisir par semaine (lundi →
     dimanche). Les autres repas plaisir de la semaine de d, sauf iso|slot : [{ iso, slot, d, rec }] (rec : enregistré ;
     sinon celui de la semaine type) */
  const MEAL_AT = {dej:'midi', diner:'soir'};
  const otherPlaisirs = function(d, iso, slot){
    const out = [];
    weekOf(d).forEach(function(x){
      const i = isoDate(x), l = cleanLibre(planFor(i).libre);
      LIBRE_SLOTS.forEach(function(s){ if (l[s] === 'plaisir' && !(i === iso && s === slot)) out.push({iso:i, slot:s, d:x, rec:!!recLibre(i)}); });
    });
    return out;
  };
  /* « samedi soir », « ce midi » (le jour affiché) */
  const mealAt = function(d, slot){
    const dd = dayDiff(d);
    if (isoDate(d) === selIso() && dd === 0) return slot === 'dej' ? 'ce midi' : 'ce soir';
    return DAYS.find(function(x){ return x.js === d.getDay(); }).long + ' ' + MEAL_AT[slot];
  };
  /* Actions des boutons (data-action) : chaque écran ajoute les siennes à côté de son code (Object.assign(ACTIONS, {…})),
     le clic est traité dans ui/actions.js. Une action reçoit le bouton et sa valeur (data-value) ; elle renvoie un message
     (même vide) pour que la page soit redessinée ensuite (message sous les séances, repères de la semaine, focus gardé),
     rien si elle a fini. */
  const ACTIONS = {};
