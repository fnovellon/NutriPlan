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
  /* « aujourd'hui », « demain », « hier » ou « jeudi 8 octobre » */
  const dayRel = function(d){ const r = {'-1':'hier', '0':'aujourd’hui', '1':'demain'}[dayDiff(d)]; return r || dayLabel(d); };

  /* Jour affiché (calendrier) : selDate à midi, sel = son jour de la semaine */
  let selDate = today, sel = todayJs, plan = null, ch = null, prevQty = new Map();
  const selIso = function(){ return isoDate(selDate); };

  /* Choix des plats relus et validés ; ce qui manque vient de base (sinon des choix par défaut du jour de la semaine) */
  const cleanCh = function(c, js, base){
    const d = base || DEFAULT_CHOICES[js];
    const out = {pdBase:d.pdBase, dej:Object.assign({}, d.dej), diner:Object.assign({}, d.diner)};
    if (c && typeof c === 'object'){
      if (has(PD, c.pdBase)) out.pdBase = c.pdBase;
      ['dej', 'diner'].forEach(function(s){
        if (c[s] && typeof c[s] === 'object'){
          if (has(PROT, c[s].prot)) out[s].prot = c[s].prot;
          if (has(STARCH, c[s].starch)) out[s].starch = c[s].starch;
          if (has(DESSERT, c[s].dessert)) out[s].dessert = c[s].dessert;
          if (has(RECIPES, c[s].recette)) out[s].recette = c[s].recette; else delete out[s].recette;
        }
      });
    }
    /* Une recette ne reste que si elle va avec la protéine et le féculent du repas */
    ['dej', 'diner'].forEach(function(s){ if (!recipeOf(out[s])) delete out[s].recette; });
    return out;
  };
  /* Après un changement de protéine ou de féculent : la recette qui ne va plus est retirée */
  const dropRecipes = function(c){ ['dej', 'diner'].forEach(function(s){ if (has(c[s], 'recette') && !recipeOf(c[s])) delete c[s].recette; }); };
  /* Plats d'une date : les siens (plans[date].ch), sinon les derniers choisis pour ce jour de la semaine, sinon ceux par défaut */
  const choicesFor = function(iso, js){
    const rec = store.plans[iso], mem = withAllowed(cleanCh(store.choices[js], js), cleanProfile(prof).off);
    return rec && rec.ch && typeof rec.ch === 'object' ? cleanCh(rec.ch, js, mem) : mem;
  };
  /* Semaine type des réglages : séances habituelles et jour du repas libre */
  const semOf = function(){ return cleanProfile(prof).semaine; };
  /* Plan d'une date : ce qui est enregistré, le reste de la semaine type. Le repas libre de la semaine type ne compte pas
     si un autre jour de la même semaine en a un enregistré (un seul par semaine). */
  const planFor = function(iso){
    const d = fromIso(iso), rec = store.plans[iso], p = cleanPlan(rec, d.getDay(), semOf());
    if (p.libre && !(rec && typeof rec === 'object' && has(rec, 'libre')) && weekOf(d).some(function(x){
      const i = isoDate(x), o = store.plans[i];
      return i !== iso && o && typeof o === 'object' && has(o, 'libre') && o.libre === true;
    })) p.libre = false;
    return p;
  };
  const loadSel = function(){ sel = selDate.getDay(); plan = planFor(selIso()); ch = choicesFor(selIso(), sel); };
  /* Enregistre une date champ par champ (séances, repas libre, plats) : ce qui n'a jamais été touché reste à la semaine type */
  const writeDay = function(iso, f){
    const old = store.plans[iso] && typeof store.plans[iso] === 'object' ? store.plans[iso] : {}, rec = {};
    ['seances', 'libre', 'ch'].forEach(function(k){ if (has(f, k)) rec[k] = f[k]; else if (has(old, k)) rec[k] = old[k]; });
    store.plans[iso] = rec;
  };
  const savePlan = function(f){ writeDay(selIso(), f); persist(); };
  /* Plats choisis : pour cette date, et en mémoire pour ce jour de la semaine (repris par les jours pas encore choisis) */
  const saveCh = function(){ writeDay(selIso(), {ch:ch}); store.choices[sel] = ch; persist(); };
  /* Un seul repas libre par semaine : l'activer un jour le retire des autres jours de la même semaine */
  const clearOtherLibre = function(){
    const moved = [];
    weekOf(selDate).forEach(function(d){
      const iso = isoDate(d);
      if (iso === selIso()) return;
      if (planFor(iso).libre){ writeDay(iso, {libre:false}); moved.push(DAYS.find(function(x){ return x.js === d.getDay(); }).long); }
    });
    if (!moved.length) return '';
    return 'Un seul repas libre par semaine' + NB + ': ' + (moved.length > 1 ? 'ceux de ' + moved.join(' et de ') + ' sont retirés.' : 'celui de ' + moved[0] + ' est retiré.');
  };
  /* Actions des boutons (data-action) : chaque écran ajoute les siennes à côté de son code (Object.assign(ACTIONS, {…})),
     le clic est traité dans ui/actions.js. Une action reçoit le bouton et sa valeur (data-value) ; elle renvoie un message
     (même vide) pour que la page soit redessinée ensuite (message sous les séances, repères de la semaine, focus gardé),
     rien si elle a fini. */
  const ACTIONS = {};
