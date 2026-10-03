if (typeof document !== 'undefined'){
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

  /* Choix des plats : seule la sélection est affichée, dans une bulle ; la toucher ouvre le panneau des choix */
  const REPAS = {dej:'du déjeuner', diner:'du dîner'};
  /* Choix possibles d'une rangée ; src : les choix affichés (ceux du jour, ou le brouillon du formulaire des repas) */
  /* Libellé d'un aliment au choix (et ce qu'il regroupe) */
  const labelOf = function(kind, id){
    const x = kind === 'pd' ? PD[id] : kind === 'prot' ? PROT[id] : kind === 'starch' ? STARCH[id] : DESSERT[id];
    return {label:x.label, sub:x.sub || null};
  };
  /* Les aliments proposés (réglages) ; le choix actuel reste affiché même s'il n'est plus proposé */
  const pickDef = function(kind, slot, src){
    const c = src || ch, off = cleanProfile(prof).off;
    const cur = kind === 'pd' ? c.pdBase : kind === 'dessert' ? dessertOf(c[slot]) : c[slot][kind];
    const all = kind === 'pd' ? PD_ORDER : kind === 'prot' ? PROT_ORDER : kind === 'starch' ? STARCH_ORDER : DESSERT_ORDER, ok = allowed(kind, off);
    const opts = all.filter(function(id){ return id === cur || ok.indexOf(id) >= 0; }).map(function(id){ const l = labelOf(kind, id); return [id, l.label, l.sub]; });
    const LABEL = {pd:'Base', prot:'Protéine', starch:'Féculent', dessert:'Dessert'};
    return {label:LABEL[kind], title:kind === 'pd' ? 'Base du petit-déjeuner' : LABEL[kind] + ' ' + REPAS[slot], action:kind, current:cur, opts:opts};
  };
  const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  /* Une ligne de choix : le libellé, la sélection dans une bulle ; la toucher ouvre le panneau des choix.
     ctx : page (choix du jour affiché), repas (brouillon du formulaire), plan (assistant, choix enregistrés tout de suite) */
  const PFX = {page:'', repas:'r', plan:'p'};
  const selRow = function(kind, slot, src, ctx){
    const P = pickDef(kind, slot, src), id = PFX[ctx] + kind + (slot ? '-' + slot : '');
    const cur = P.opts.find(function(o){ return o[0] === P.current; });
    return '<div class="pick"><span class="pick-l" id="l-' + id + '">' + P.label + '</span>' +
      '<button type="button" class="sel" id="sel-' + id + '" data-action="open-pick" data-ctx="' + ctx + '" data-kind="' + kind + '"' + (slot ? ' data-slot="' + slot + '"' : '') +
      ' data-value="' + P.current + '" aria-haspopup="dialog" aria-labelledby="l-' + id + ' sel-' + id + '"><span>' + cur[1] + '</span>' + CHEVRON + '</button></div>';
  };
  const pickRow = function(kind, slot){ return selRow(kind, slot, ch, 'page'); };
  /* Calories et macros d'un aliment, en petit sous son nom */
  const macHTML = function(m){
    const g = function(cls, letter, title, v){ return '<span class="' + cls + '"><abbr title="' + title + '">' + letter + '</abbr>' + NB + Math.round(v) + NB + 'g</span>'; };
    return '<span class="mac"><span>' + fmtInt(m.kcal) + NB + 'kcal</span>' + g('p', 'P', 'protéines', m.p) + g('c', 'G', 'glucides', m.c) + g('f', 'L', 'lipides', m.f) + '</span>';
  };
  const itemHTML = function(secId, i, next){
    const key = secId + ':' + i.key, val = i.qty + '|' + i.name;
    const changed = prevQty.has(key) && prevQty.get(key) !== val;
    next.set(key, val);
    const q = '<span class="q"><span class="qty' + (changed ? ' bump' : '') + '">' + i.qty + '</span>' +
      (i.cook ? '<span class="ck">' + i.cook.raw + '</span>' +
        i.cook.ways.map(function(w){ return '<span class="ck">≈' + NB + grams(w.g) + ' ' + w.adj + '</span>'; }).join('') : '') + '</span>';
    return '<li>' + q + '<span class="name">' + i.name + (i.note ? '<span class="note">' + i.note + '</span>' : '') +
      (i.m && i.key !== 'lib' && i.key !== 'marge' && i.key !== 'encas' ? macHTML(i.m) : '') + '</span></li>';
  };
  /* Recette d'un repas (pas au repas libre). Proposée : sous les lignes du repas, « Suggestion : … », « Voir la recette » et
     « Choisir ». Choisie (3.14.0) : en tête du repas, à la place de ses ingrédients (détaillés dans sa fiche) : titre, temps,
     calories et macros de la recette (tout le repas sauf dessert et compote), « Voir la recette » et « Retirer ». */
  const RECIPE_OUT = ['des', 'comp'];
  const recipePart = function(s){ return s.items.filter(function(i){ return RECIPE_OUT.indexOf(i.key) < 0; }); };
  const recBtns = function(s, on){
    const of = REPAS[s.id];
    return '<div class="rec-b"><button type="button" class="reset' + (on ? ' is-main' : '') + '" id="rec-v-' + s.id + '" data-action="rec-view" data-slot="' + s.id + '" aria-haspopup="dialog" aria-label="Voir la recette ' + of + '">Voir la recette</button>' +
      '<button type="button" class="reset' + (on ? '' : ' is-main') + '" id="rec-c-' + s.id + '" data-action="' + (on ? 'rec-off' : 'rec-on') + '" data-slot="' + s.id + '"' +
      ' aria-label="' + (on ? 'Retirer la recette ' : 'Choisir la recette ') + of + '">' + (on ? 'Retirer' : 'Choisir') + '</button></div>';
  };
  const recMeta = function(x){ return '<p class="rec-m">' + x.min + NB + 'min' + (x.box ? ', se garde (à emporter)' : '') + '</p>'; };
  const recHTML = function(s){
    if (s.libre || s.recipe || !s.suggest) return '';
    const x = RECIPES[s.suggest];
    return '<div class="rec"><p class="rec-t">Suggestion' + NB + ': <span class="rec-n">' + x.t + '</span></p>' + recMeta(x) + recBtns(s, false) + '</div>';
  };
  const recCardHTML = function(s){
    const x = RECIPES[s.recipe];
    return '<div class="rec is-on"><h3 class="rec-h3">' + x.t + '</h3>' + recMeta(x) + '<p class="rec-k">' + macHTML(total(recipePart(s))) + '</p>' + recBtns(s, true) + '</div>';
  };
  const mealHTML = function(s, next){
    let picks = '';
    if (s.pick === 'pd') picks = '<div class="picks">' + pickRow('pd', null) + '</div>';
    else if (s.pick === 'dej' || s.pick === 'diner') picks = '<div class="picks">' + pickRow('prot', s.pick) + pickRow('starch', s.pick) + pickRow('dessert', s.pick) + '</div>';
    const kc = s.libre ? '' : '<span class="kcal">' + fmtInt(Math.round(total(s.items).kcal / 5) * 5) + NB + 'kcal</span>';
    const card = s.recipe && !s.libre, shown = card ? s.items.filter(function(i){ return RECIPE_OUT.indexOf(i.key) >= 0; }) : s.items;
    return '<section class="meal" aria-labelledby="h-' + s.id + '"><div class="meal-head"><h2 id="h-' + s.id + '">' + s.title +
      (s.when ? '<span class="when">' + s.when + '</span>' : '') + '</h2>' + kc + '</div>' + picks + (card ? recCardHTML(s) : '') +
      (shown.length ? '<ul class="items">' + shown.map(function(i){ return itemHTML(s.id, i, next); }).join('') + '</ul>' : '') + recHTML(s) + '</section>';
  };
  const bandHTML = function(s, next){
    return '<div class="band"><p class="band-t">' + s.title + '</p>' + (s.sub ? '<p class="band-s">' + s.sub + '</p>' : '') +
      (s.items.length ? '<ul class="items">' + s.items.map(function(i){ return itemHTML(s.id, i, next); }).join('') + '</ul>' : '') + '</div>';
  };

  /* Séances du jour affiché : une ligne par séance (moment ou durée, bouton pour la retirer), boutons d'ajout */
  const sessHTML = function(list, pre){
    const l = list || plan.seances, a = pre || '';
    const segBtn = function(action, i, value, label, on){
      return '<button type="button" data-action="' + a + action + '" data-index="' + i + '" data-value="' + value + '" aria-pressed="' + on + '">' + label + '</button>';
    };
    return l.length ? l.map(function(x, i){
      const name = SIZES[x.taille].band;
      const opts = x.taille === 'longue'
        ? DUREES.map(function(d){ return segBtn('sduree', i, d[0], d[1], d[0] === x.duree); }).join('')
        : MOMENTS.map(function(m){ return segBtn('smoment', i, m[0], m[1], m[0] === x.moment); }).join('');
      return '<div class="srow"><span class="s-t">' + name + (x.taille === 'longue' ? '<span class="a-s"> le matin</span>' : '') + '</span>' +
        '<button type="button" class="rm" data-action="' + a + 'rm" data-index="' + i + '" aria-label="Retirer' + NB + ': ' + name.toLowerCase() + '">×</button>' +
        '<div class="seg" role="group" aria-label="' + (x.taille === 'longue' ? 'Durée' : 'Moment') + ' de la séance">' + opts + '</div></div>';
    }).join('') : '<p class="rest-t">Repos, pas de séance.</p>';
  };
  const addDisabled = function(taille, list){ const l = list || plan.seances; return l.length >= MAX_SEANCES || (taille === 'longue' && l.some(function(x){ return x.taille === 'longue'; })); };
  const renderControls = function(){
    /* Jour affiché : « Aujourd'hui, jeudi 1er octobre », « Demain, … », sinon « Jeudi 8 octobre » */
    const diff = dayDiff(selDate), rel = {'-1':'Hier', '0':'Aujourd’hui', '1':'Demain'}[diff];
    $('date').textContent = rel ? rel + ', ' + dayLabel(selDate) : cap(dayLabel(selDate));
    $('title').textContent = (diff === 0 ? 'Qu’est-ce que tu fais aujourd’hui' : diff < 0 ? 'Qu’est-ce que tu as fait ' + dayRel(selDate) : 'Qu’est-ce que tu prévois ' + dayRel(selDate)) + NB + '?';
    $('sw-lib-t').textContent = diff === 0 ? 'Repas libre ce soir' : 'Repas libre le soir';
    $('today-btn').hidden = diff === 0;
    /* Bandeau de la semaine du jour affiché : un point sous les jours déjà planifiés */
    const wk = weekOf(selDate), short = function(d){ return d.toLocaleDateString('fr-FR', {month:'short'}); };
    $('cal-t').textContent = 'Du ' + wk[0].getDate() + (wk[0].getMonth() !== wk[6].getMonth() ? NB + short(wk[0]) : '') + ' au ' + wk[6].getDate() + NB + short(wk[6]);
    $('wk-prev').disabled = wk[0] <= addDays(today, -21);
    $('wk-next').disabled = wk[6] >= addDays(today, 365);
    $('week').innerHTML = wk.map(function(d){
      const iso = isoDate(d), isToday = dayDiff(d) === 0, planned = has(store.plans, iso);
      return '<button type="button" data-action="day" data-value="' + iso + '" aria-pressed="' + (iso === selIso()) + '"' +
        ' aria-label="' + cap(dayLabel(d)) + (isToday ? ', aujourd’hui' : '') + (planned ? ', planifié' : '') + '"' +
        ' class="' + (isToday ? 'is-today' : '') + (planned ? ' is-planned' : '') + '"' + (dayDiff(d) < -21 ? ' disabled' : '') + '>' +
        '<span class="wd">' + d.toLocaleDateString('fr-FR', {weekday:'short'}) + '</span><span class="dn">' + d.getDate() + '</span></button>';
    }).join('');
    $('sess').innerHTML = sessHTML();
    $('acts').querySelectorAll('button').forEach(function(b){ b.disabled = addDisabled(b.dataset.value); });
    $('sw-lib').setAttribute('aria-checked', String(plan.libre));
  };
  const r10 = function(n){ return fmtInt(Math.round(n / 10) * 10); };
  const incomplete = function(){
    if (cleanProfile(prof).mode === 'manuel') return !has(prof, 'repos') || !has(prof, 'poids');
    return !(has(prof, 'age') && has(prof, 'taille') && has(prof, 'poids'));
  };
  const renderSummary = function(res){
    const t = res.tot, en = res.energy;
    $('sum-text').innerHTML = 'Environ <strong>' + r10(t.kcal) + NB + 'kcal</strong> sur la journée' +
      (res.libre ? ', dont ' + fmtInt(res.libre) + NB + 'kcal de repas libre.' : '.');
    let note = 'Dépense estimée' + NB + ': ' + r10(en.need) + NB + 'kcal, ' + (en.deficit > 0 ? 'moins ' + r10(en.deficit) + NB + 'kcal de déficit.' : 'sans déficit.');
    if (!res.libre && res.ecart > en.target * 0.03){
      const pr = cleanProfile(prof), tips = [];
      if (pr.marge > 0) tips.push('baisse la marge cuisine');
      if (pr.shaker === 'oui') tips.push('passe-toi du shaker');
      if (dessertOf(ch.dej) !== 'aucun' || dessertOf(ch.diner) !== 'aucun') tips.push('retire un dessert');
      if (res.prot.factor > PF_MIN + 0.02) tips.push('baisse ton objectif de protéines');
      note += ' Tes minimums de protéines, lipides et féculents dépassent l’objectif de ' + r10(res.ecart) + NB + 'kcal' +
        (tips.length ? NB + ': pour t’en rapprocher, ' + (tips.length > 1 ? tips.slice(0, -1).join(', ') + ' ou ' + tips[tips.length - 1] : tips[0]) + '.' : '.');
    }
    /* Protéines sous la fourchette malgré les portions au maximum et le skyr du soir (thon deux fois, objectif haut, sans shaker) */
    if (!res.libre && t.p < res.prot.low - 0.5){
      const pr = cleanProfile(prof), tips = [];
      if (ch.dej.prot === 'thon' || ch.diner.prot === 'thon') tips.push('remplace le thon');
      if (ch.pdBase === 'sale' && !plan.seances.some(function(x){ return x.taille === 'longue'; })) tips.push('prends un petit-déjeuner sucré (avec du skyr)');
      if (pr.shaker === 'non') tips.push('reprends un shaker');
      tips.push('baisse ton objectif de protéines');
      note += ' Tes protéines restent sous ton objectif (' + Math.round(t.p) + NB + 'g, pour ' + Math.round(res.prot.low) + ' à ' + Math.round(res.prot.high) + NB + 'g)' + NB +
        ': ' + (tips.length > 1 ? tips.slice(0, -1).join(', ') + ' ou ' + tips[tips.length - 1] : tips[0]) + '.';
    }
    if (incomplete()) note += ' Complète ton profil pour un calcul juste.';
    $('sum-note').innerHTML = note + ' <button type="button" class="link" data-action="needs">Régler</button>';
    $('bar-p').style.flexGrow = String(t.p * 4);
    $('bar-c').style.flexGrow = String(t.c * 4);
    $('bar-f').style.flexGrow = String(t.f * 9);
    $('legend').innerHTML = '<li class="p">Protéines <b>' + Math.round(t.p) + NB + 'g</b></li>' +
      '<li class="c">Glucides <b>' + Math.round(t.c) + NB + 'g</b></li>' +
      '<li class="f">Lipides <b>' + Math.round(t.f) + NB + 'g</b></li>' +
      (res.libre ? '<li class="x">hors repas libre</li>' : '');
  };
  const renderNeeds = function(res){
    const pr = cleanProfile(prof), en = res.energy;
    document.querySelectorAll('#besoins [data-action="prof"]').forEach(function(b){ b.setAttribute('aria-pressed', String(pr[b.dataset.key] === b.dataset.value)); });
    $('besoins').querySelector('[data-key="repos"]').placeholder = String(Math.round(bmr(pr) * NEAT[pr.neat] / 10) * 10);
    document.querySelectorAll('#besoins [data-mode]').forEach(function(el){ el.hidden = el.dataset.mode !== pr.mode; });
    $('needs-sum').textContent = r10(en.rest) + NB + 'kcal un jour sans sport (' + (en.restSource === 'saisie' ? 'saisie' : 'automatique') + '), déficit de ' + pr.deficit + NB + '%';
    $('mode-hint').textContent = pr.mode === 'manuel'
      ? 'Tu indiques ta dépense d’un jour sans sport, l’appli ajoute le coût de chaque séance, calculé avec ton poids.'
      : 'Ta dépense est calculée à partir de ton profil.';
    let hint = '';
    if (pr.mode === 'auto' && incomplete()) hint = 'Indique ton âge, ta taille et ton poids' + NB + ': en attendant, le calcul utilise les valeurs grisées.';
    else if (pr.mode === 'manuel' && en.restSource !== 'saisie') hint = 'Indique ta dépense d’un jour sans sport' + NB + ': en attendant, le calcul automatique est utilisé (' + r10(en.rest) + NB + 'kcal).';
    else if (pr.mode === 'manuel' && incomplete()) hint = 'Indique ton poids' + NB + ': il sert à calculer tes séances.';
    $('needs-hint').textContent = hint;
    $('calc-rest').textContent = en.restSource === 'saisie'
      ? 'Dépense un jour de repos' + NB + ': ' + r10(en.rest) + NB + 'kcal, celle que tu as saisie. Chaque séance s’y ajoute.'
      : 'Métabolisme de base' + NB + ': ' + r10(en.bmr) + NB + 'kcal (formule de ' + (pr.gras !== null ? 'Cunningham, à partir de ta masse maigre' : 'Mifflin-St' + NB + 'Jeor') +
        '). Dépense un jour de repos' + NB + ': ' + r10(en.rest) + NB + 'kcal, calculée. Chaque séance s’y ajoute.';
    $('out-deficit').textContent = pr.deficit + NB + '%';
    $('calc-deficit').textContent = pr.deficit > 0
      ? pr.deficit + NB + '% de ta dépense d’un jour sans sport, soit ' + r10(en.deficit) + NB + 'kcal de moins chaque jour' + NB + ': environ −' +
        en.kgWeek.toLocaleString('fr-FR', {minimumFractionDigits:1, maximumFractionDigits:1}) + NB + 'kg par semaine. Tes séances restent couvertes.'
      : 'Pas de déficit' + NB + ': tu manges ce que tu dépenses.';
    const warn = [];
    if (pr.deficit > 20) warn.push('Au-delà de 20' + NB + '%, tu perds plus vite mais tu risques de perdre du muscle et de la forme à l’entraînement.');
    if (pr.mode === 'auto' && pr.gras !== null){
      const ea = (en.rest - en.deficit) / (pr.poids * (1 - pr.gras / 100));
      if (ea < 30) warn.push('Il te reste environ ' + Math.round(ea) + NB + 'kcal par kilo de masse maigre une fois tes séances payées, sous le seuil de 30' + NB + ': baisse le déficit.');
    }
    $('warn-deficit').textContent = warn.join(' ');
    const dec = function(n){ return n.toLocaleString('fr-FR', {minimumFractionDigits:1, maximumFractionDigits:1}); };
    $('out-prot').textContent = dec(pr.prot) + NB + 'g/kg';
    /* Poids de calcul borné comme les portions (47 à 101 kg environ) */
    const protKg = res.prot.target / pr.prot;
    $('calc-prot').textContent = 'Environ ' + Math.round(res.prot.target) + NB + 'g par jour (' + dec(pr.prot) + ' × ' + dec(protKg) + NB + 'kg), à 10' + NB + '% près' + NB + ': de ' +
      Math.round(res.prot.low) + ' à ' + Math.round(res.prot.high) + NB + 'g.' +
      (pr.poids > protKg + 0.05 ? ' Au-delà de ' + dec(protKg) + NB + 'kg, ton objectif et tes portions ne suivent plus ton poids.' : '') +
      (pr.poids < protKg - 0.05 ? ' Sous ' + dec(protKg) + NB + 'kg, ton objectif et tes portions ne suivent plus ton poids.' : '') +
      ' Viande, poisson, œufs et skyr restent au plus près du menu de base et ne s’ajustent que pour entrer dans cette fourchette. Aujourd’hui' + NB + ': ' + Math.round(res.tot.p) + NB + 'g' +
      (res.libre ? ' hors repas libre.' : '.') +
      (!res.libre && res.prot.factor <= PF_MIN + 0.02 && res.tot.p > res.prot.high ? ' Le reste de ta journée (shaker, œufs, féculents) en apporte déjà beaucoup' + NB + ': plus bas, les portions ne peuvent pas suivre.' : '') +
      ' Repère en sèche' + NB + ': 1,6 à 2,2' + NB + 'g/kg, 2,0 par défaut.';
    $('out-ravito').textContent = pr.ravito + NB + 'g/h';
    $('out-marge').textContent = pr.marge + NB + 'kcal';
    [['kcalPetite', {taille:'petite'}], ['kcalMoyenne', {taille:'moyenne'}], ['kcalLongueH', {taille:'longue', duree:1}]].forEach(function(x){
      $('besoins').querySelector('[data-key="' + x[0] + '"]').placeholder = String(Math.round(seanceCost(x[1], Object.assign({}, pr, {kcalPetite:null, kcalMoyenne:null, kcalLongueH:null})) / 10) * 10);
    });
    $('calc-seances').textContent = 'Calories en plus de ta journée pour chaque séance. Par défaut, d’après ton poids' + NB + ': petite ' +
      r10(SIZES.petite.net * pr.poids) + NB + 'kcal (1' + NB + 'h de muscu), moyenne ' + r10(SIZES.moyenne.net * pr.poids) + NB + 'kcal (≈ 7' + NB + 'km de course), longue ' +
      r10(SIZES.longue.net * pr.poids) + NB + 'kcal par heure. Tu peux mettre les tiennes, par exemple les calories actives de ta montre pour cette séance.';
    const sm = shakerMac(pr), withShaker = pr.shaker === 'oui';
    $('shaker-dose').hidden = !withShaker;
    $('calc-shaker').textContent = withShaker
      ? 'Tous les jours, juste après ta dernière séance (l’après-midi les jours de repos). Une dose à l’eau' + NB + ': ' +
        pr.shakerKcal + NB + 'kcal, ' + Math.round(sm.p) + NB + 'g de protéines, environ ' + Math.round(sm.c) + NB + 'g de glucides et ' + Math.round(sm.f) + NB + 'g de lipides.'
      : 'Pas de shaker' + NB + ': si tes protéines passent sous ' + Math.round(res.prot.floor) + NB + 'g, un skyr s’ajoute le soir.';
    $('warn-shaker').textContent = withShaker && pr.shakerProt > sm.p
      ? 'Avec ' + pr.shakerKcal + NB + 'kcal, une dose ne peut pas dépasser ' + Math.round(sm.p) + NB + 'g de protéines' + NB + ': le calcul en compte ' + Math.round(sm.p) + NB + 'g.'
      : '';
  };
  const render = function(){
    renderControls();
    const res = buildDay(plan, ch, prof);
    renderSummary(res);
    renderNeeds(res);
    renderWeek();
    const next = new Map();
    $('day').innerHTML = res.secs.map(function(s){ return s.band ? bandHTML(s, next) : mealHTML(s, next); }).join('');
    prevQty = next;
    if (planner && planner.i >= 0 && topScreen() === 'plan') renderPlan();
  };

  /* Écrans, un seul visible : accueil, page du jour, réglages (roue dentée) et aide (point d'interrogation).
     Réglages et aide s'empilent au-dessus de la page ; chacun ajoute une entrée d'historique (le bouton retour du
     téléphone revient d'un cran) et la position dans la page est rétablie au retour. */
  let stack = [], pageScroll = 0;
  const HEAD = {reglages:'regl-h', aide:'aide-h', repas:'repas-h', plan:'plan-h', courses:'courses-h'};
  const scroller = function(){ return document.scrollingElement || document.documentElement; };
  const setView = function(v){ ['accueil', 'page', 'reglages', 'aide', 'repas', 'plan', 'courses'].forEach(function(id){ $(id).hidden = id !== v; }); };
  const topScreen = function(){ return stack.length ? stack[stack.length - 1].name : null; };
  const showTop = function(){
    const top = stack.length ? stack[stack.length - 1] : null;
    if (top){ setView(top.name); scroller().scrollTop = 0; $(HEAD[top.name]).focus({preventScroll:true}); return; }
    setView('page');
    scroller().scrollTop = pageScroll;
  };
  const openScreen = function(name, opener){
    if (topScreen() === name) return;
    if (!stack.length) pageScroll = scroller().scrollTop;
    stack.push({name:name, opener:opener && opener.id ? opener.id : 'gear'});
    try { history.scrollRestoration = 'manual'; history.pushState({screen:name}, ''); } catch (e) {}
    showTop();
  };
  /* Retour d'un cran (flèche, « Voir ma journée ») ; fromHistory : l'entrée d'historique est déjà quittée */
  const closeScreen = function(fromHistory){
    if (!stack.length) return;
    const left = stack.pop();
    if (left.name === 'plan') leavePlan();
    showTop();
    if (!stack.length) $(document.getElementById(left.opener) ? left.opener : 'gear').focus({preventScroll:true});
    if (!fromHistory){ try { if (history.state && history.state.screen) history.back(); } catch (e) {} }
  };
  const closeAllScreens = function(){ while (stack.length) closeScreen(false); };
  /* Remplace l'écran du dessus sans nouvelle entrée d'historique (fin de l'assistant → courses) */
  const replaceScreen = function(name){
    const top = stack[stack.length - 1];
    if (!top) return;
    if (top.name === 'plan') leavePlan();
    top.name = name;
    try { history.replaceState({screen:name}, ''); } catch (e) {}
    showTop();
  };

  /* Formulaire des repas du jour : tous les choix visibles, sur un brouillon ; « Voir ma journée » l'enregistre,
     « Décide pour moi » tire tout au hasard ; la flèche ou le bouton retour ferment sans rien changer.
     S'ouvre tout seul à la première ouverture de chaque jour (date gardée dans RKEY ; sans stockage, jamais tout seul). */
  const RKEY = 'repas-du-jour:repas:v1';
  let draft = null, repasVu = null, canStore = true;
  try { repasVu = localStorage.getItem(RKEY); } catch (e) { canStore = false; }
  /* Les trois repas, une ligne par choix comme sur la page (formulaire des repas et assistant de planification) */
  const mealsFormHTML = function(src, ctx){
    const rows = function(kinds, slot){ return '<div class="picks">' + kinds.map(function(k){ return selRow(k, slot, src, ctx); }).join('') + '</div>'; };
    const meal = function(id, title, body, note){
      return '<section class="rf" aria-labelledby="' + ctx + '-h-' + id + '"><h2 id="' + ctx + '-h-' + id + '">' + title + '</h2>' + (note ? '<p class="calc">' + note + '</p>' : '') + body + '</section>';
    };
    const day = DAYS.find(function(x){ return x.js === sel; }).long;
    return meal('pd', 'Petit-déjeuner', rows(['pd'], null)) +
      meal('dej', 'Déjeuner', rows(['prot', 'starch', 'dessert'], 'dej')) +
      meal('diner', 'Dîner', rows(['prot', 'starch', 'dessert'], 'diner'),
        plan.libre ? (dayDiff(selDate) === 0 ? 'Ce soir' : 'Ce soir-là') + ', c’est ton repas libre' + NB + ': ce dîner est gardé pour les prochains ' + day + 's.' : null);
  };
  const renderRepas = function(){
    $('repas-h').textContent = dayDiff(selDate) === 0 ? 'Tes repas du jour' : 'Tes repas, ' + dayRel(selDate);
    $('repas-form').innerHTML = mealsFormHTML(draft, 'repas');
  };
  /* Brouillon : les choix actuels du jour */
  const startDraft = function(){
    const copy = function(c){ const o = {prot:c.prot, starch:c.starch, dessert:dessertOf(c)}; if (recipeOf(c)) o.recette = c.recette; return o; };
    draft = {pdBase:ch.pdBase, dej:copy(ch.dej), diner:copy(ch.diner)};
    renderRepas();
  };
  const openRepas = function(opener){ startDraft(); openScreen('repas', opener); };
  /* Enregistre les choix du formulaire (ou du hasard) pour ce jour de la semaine, puis revient sur la journée */
  const applyRepas = function(c){
    const next = cleanCh(c, sel);
    if (JSON.stringify(next) !== JSON.stringify(cleanCh(ch, sel))){ ch = next; saveCh(); }
    draft = null;
    closeScreen(false);
  };
  const maybeOpenRepas = function(){
    const iso = isoDate(today);
    if (!canStore || acc || pick || repasVu === iso || dayDiff(selDate) !== 0) return;
    repasVu = iso;
    try { localStorage.setItem(RKEY, iso); } catch (e) {}
    if (topScreen() === 'repas') startDraft(); else openRepas({id:'title'});
  };

  /* Périodes (assistant et courses) : dates AAAA-MM-JJ, 31 jours au plus */
  const MAX_DAYS = 31;
  const isoOk = function(v){ return typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && fromIso(v) !== null && isoDate(fromIso(v)) === v; };
  const rangeDays = function(from, to){
    const out = [];
    for (let d = fromIso(from); d <= fromIso(to) && out.length <= MAX_DAYS; d = addDays(d, 1)) out.push(isoDate(d));
    return out;
  };
  /* Message si la période ne va pas ; minDiff : premier jour possible, par rapport à aujourd'hui */
  const rangeError = function(from, to, minDiff){
    if (!isoOk(from) || !isoOk(to)) return 'Choisis une date de début et une date de fin.';
    if (dayDiff(fromIso(from)) < minDiff) return minDiff === 0 ? 'Commence aujourd’hui ou plus tard.' : 'Commence au plus tôt ' + dayLabel(addDays(today, minDiff)) + '.';
    if (fromIso(to) < fromIso(from)) return 'La fin doit venir après le début.';
    if (dayDiff(fromIso(to)) > 365) return 'Pas plus d’un an à l’avance.';
    if (rangeDays(from, to).length > MAX_DAYS) return MAX_DAYS + NB + 'jours au plus' + NB + ': raccourcis la période.';
    return '';
  };
  const spanText = function(from, to){
    const n = rangeDays(from, to).length;
    return n > 1 ? n + NB + 'jours, du ' + dayLabel(fromIso(from)) + ' au ' + dayLabel(fromIso(to)) + '.' : '1' + NB + 'jour, ' + dayLabel(fromIso(from)) + '.';
  };
  /* Remplit les champs Du / Au d'un écran, et affiche la période ou ce qui ne va pas */
  const fillRange = function(which, st, minDiff, keepInputs){
    const box = $(which);
    box.querySelectorAll('input[data-range]').forEach(function(el){
      el.min = isoDate(addDays(today, minDiff)); el.max = isoDate(addDays(today, 365));
      if (!keepInputs) el.value = st[el.dataset.end] || '';
    });
    const err = rangeError(st.from, st.to, minDiff);
    $(which + '-err').textContent = err;
    $(which + '-span').textContent = err ? '' : spanText(st.from, st.to);
    return err;
  };

  /* Planifier : les jours choisis, puis un jour par étape (séances, repas libre, plats), puis les courses.
     Chaque changement est enregistré tout de suite pour sa date ; en partant, la page revient sur le jour affiché avant. */
  let planner = null;
  const PRESETS = [['7', 'Les 7 prochains jours'], ['semaine', 'Cette semaine'], ['suivante', 'La semaine prochaine']];
  const presetRange = function(k){
    if (k === 'semaine') return [today, weekOf(today)[6]];
    if (k === 'suivante'){ const w = weekOf(addDays(today, 7)); return [w[0], w[6]]; }
    return [today, addDays(today, 6)];
  };
  const renderPlan = function(){
    if (!planner) return;
    if (planner.i < 0){
      $('plan-step').textContent = '';
      $('plan-h').textContent = 'Planifier';
      $('plan-body').innerHTML = '<p class="repas-p">Choisis les jours à préparer. Pour chacun, tes séances et tes plats, puis ta liste de courses.' +
        (Object.keys(semOf().jours).length ? ' Les jours pas encore remplis partent des séances de ta semaine type (réglages).' : '') + '</p>' +
        '<div class="opts-list plan-presets" role="group" aria-label="Raccourcis">' + PRESETS.map(function(p){
          const r = presetRange(p[0]), on = isoDate(r[0]) === planner.from && isoDate(r[1]) === planner.to;
          return '<button type="button" class="opt" data-action="pl-preset" data-value="' + p[0] + '" aria-pressed="' + on + '">' + p[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="fields plan-dates"><label class="field"><span>Du</span><span class="inp"><input type="date" data-range="plan" data-end="from"></span></label>' +
        '<label class="field"><span>Au</span><span class="inp"><input type="date" data-range="plan" data-end="to"></span></label></div>' +
        '<p class="calc" id="plan-span"></p><p class="warn" id="plan-err" role="alert"></p>' +
        '<button type="button" class="btn main wide" data-action="pl-start">Commencer</button>' +
        '<div class="plan-batch"><h2>Batch cooking</h2><p class="calc">Quelques recettes qui se gardent, répétées midi et soir sur toute la période' + NB + ': tu cuisines une fois, la veille, et ta liste de courses suit.</p>' +
        '<div class="opt-row"><span class="lbl" id="pl-n-l">Recettes</span><div class="seg" role="group" aria-labelledby="pl-n-l">' + BATCH_N.map(function(n){
          return '<button type="button" data-action="pl-nrec" data-value="' + n + '" aria-pressed="' + (planner.n === n) + '">' + n + '</button>';
        }).join('') + '</div></div>' +
        '<button type="button" class="btn wide" data-action="pl-batch">Décide pour moi, en batch cooking</button></div>';
      fillRange('plan', planner, 0, false);
      return;
    }
    const n = rangeDays(planner.from, planner.to).length, i = planner.i, res = buildDay(plan, ch, prof);
    const rel = {'-1':'Hier', '0':'Aujourd’hui', '1':'Demain'}[dayDiff(selDate)];
    $('plan-step').textContent = 'Jour ' + (i + 1) + ' sur ' + n;
    $('plan-h').textContent = rel ? rel + ', ' + dayLabel(selDate) : cap(dayLabel(selDate));
    const adds = [['petite', 'Petite'], ['moyenne', 'Moyenne'], ['longue', 'Longue']].map(function(a){
      return '<button type="button" data-action="add" data-value="' + a[0] + '"' + (addDisabled(a[0]) ? ' disabled' : '') + '><span class="a-t">+' + NB + a[1] + '</span></button>';
    }).join('');
    $('plan-body').innerHTML = '<div class="plan-bar" aria-hidden="true"><span style="width:' + Math.round((i + 1) / n * 100) + '%"></span></div>' +
      '<h2>Séances</h2><div class="sess">' + sessHTML() + '</div><div class="acts" role="group" aria-label="Ajouter une séance">' + adds + '</div>' +
      '<div class="switches"><button type="button" class="switch" role="switch" aria-checked="' + plan.libre + '" data-action="toggle" data-key="libre"><span>Repas libre le soir</span><span class="knob" aria-hidden="true"></span></button></div>' +
      '<p class="hint" id="plan-hint" role="status">' + planner.msg + '</p>' +
      mealsFormHTML(ch, 'plan') +
      '<p class="plan-kcal">Environ <strong>' + r10(res.tot.kcal) + NB + 'kcal</strong> ce jour-là' + (res.libre ? ', dont ' + fmtInt(res.libre) + NB + 'kcal de repas libre.' : '.') + '</p>' +
      '<p class="calc plan-wb" id="plan-wb">Ta semaine' + NB + ': ' + weekMsg(weekBal(selDate)).replace(/^./, function(c){ return c.toLowerCase(); }) + '</p>' +
      '<div class="regl-links"><button type="button" class="btn hasard" data-action="pl-hasard">Décide pour moi</button>' +
      (i < n - 1 ? '<button type="button" class="reset" data-action="pl-hasard-tous">Décide pour tous les jours restants</button>' : '') + '</div>' +
      '<div class="acc-nav"><button type="button" class="btn" data-action="pl-prev">Retour</button>' +
      '<button type="button" class="btn main" data-action="pl-next">' + (i < n - 1 ? 'Jour suivant' : 'Voir mes courses') + '</button></div>';
  };
  /* Étape i de l'assistant (-1 : choix des jours) : le jour de l'étape devient le jour affiché */
  const planGo = function(i){
    planner.i = i; planner.msg = '';
    if (i >= 0){ selDate = fromIso(rangeDays(planner.from, planner.to)[i]); loadSel(); prevQty = new Map(); render(); }
    renderPlan();
    scroller().scrollTop = 0;
    $('plan-h').focus({preventScroll:true});
  };
  const leavePlan = function(){
    if (!planner) return;
    const back = planner.back;
    planner = null;
    $('plan-body').innerHTML = '';
    selDate = back; loadSel(); prevQty = new Map(); render();
  };
  /* Fin de l'assistant : les courses de la période planifiée */
  const finishPlan = function(){
    shop.from = planner.from; shop.to = planner.to; saveShop();
    replaceScreen('courses');
    renderCourses(false);
  };

  /* Courses : période (gardée), liste additionnée par rayon, lignes cochées (gardées tant que leur quantité ne change pas) */
  const SKEY = 'repas-du-jour:courses:v1';
  let shop = {from:'', to:'', checked:[]};
  try {
    const o = JSON.parse(localStorage.getItem(SKEY) || 'null');
    if (o && typeof o === 'object' && !Array.isArray(o)){
      if (isoOk(o.from)) shop.from = o.from;
      if (isoOk(o.to)) shop.to = o.to;
      if (Array.isArray(o.checked)) shop.checked = o.checked.filter(function(x){ return typeof x === 'string'; }).slice(0, 500);
    }
  } catch (e) {}
  const saveShop = function(){ try { localStorage.setItem(SKEY, JSON.stringify(shop)); } catch (e) {} };
  const dayResult = function(iso){ return buildDay(planFor(iso), choicesFor(iso, fromIso(iso).getDay()), prof); };
  /* Repères de la semaine (lundi → dimanche) d'une date, sans le jour skip (celui qu'on tire au hasard) */
  const weekBal = function(d, skip){ return weekBalance(weekOf(d).map(isoDate).filter(function(iso){ return iso !== skip; }).map(dayResult)); };
  /* « Décide pour moi » d'une date : équilibré avec le reste de sa semaine */
  const drawFor = function(iso){ const pr = cleanProfile(prof); return randomChoices(null, pr.off, weekBal(fromIso(iso), iso), scaleOf(pr)); };
  const gr = function(x){ return '≈' + NB + Math.round(x / 10) * 10 + NB + 'g'; };
  /* Ce qui manque ou déborde, en une phrase */
  const weekMsg = function(b){
    const n = weekNeeds(b)[0], left = function(x, one, two){ return x === 1 ? one : two; };
    if (n === 'charcuterie') return 'Trop de charcuterie (' + gr(b.charcuterie) + ', 150' + NB + 'g au plus)' + NB + ': préfère le petit-déjeuner sucré et une autre protéine que les œufs-jambon.';
    if (n === 'rouge') return 'Beaucoup de viande rouge (' + gr(b.rouge) + ' cuits, 500' + NB + 'g au plus)' + NB + ': alterne avec la volaille, le poisson ou le tofu.';
    if (n === 'gras') return 'Il te manque un poisson gras (saumon, maquereau, sardines).';
    if (n === 'poisson') return left(WEEK_GOALS.poisson - b.poisson, 'Encore un poisson à prévoir.', 'Encore deux poissons à prévoir.');
    if (n === 'legumes') return left(WEEK_GOALS.legumes - b.legumes, 'Pense aux légumes secs, encore une fois (lentilles, haricots rouges, pois chiches).', 'Pense aux légumes secs, encore deux fois (lentilles, haricots rouges, pois chiches).');
    return 'Elle est équilibrée, bravo.';
  };
  const renderWeek = function(){
    const b = weekBal(selDate), needs = weekNeeds(b), over = needs[0] === 'charcuterie' || needs[0] === 'rouge';
    $('wb-msg').textContent = weekMsg(b);
    $('wk-bal').classList.toggle('is-over', over);
    $('wk-bal').classList.toggle('is-ok', !needs.length);
    const row = function(state, label, val, sr){ return '<li class="is-' + state + '"><span>' + label + '</span><b>' + val + '<span class="sr"> (' + sr + ')</span></b></li>'; };
    const goal = function(x, g){ return x >= g ? ['ok', 'atteint'] : ['todo', 'à prévoir']; };
    const lim = function(x, g){ return x > g + 0.5 ? ['over', 'dépassé'] : ['ok', 'respecté']; };
    const fish = goal(b.poisson, 2), fat = goal(b.gras, 1), leg = goal(b.legumes, 2), red = lim(b.rouge, 500), ham = lim(b.charcuterie, 150);
    $('wb-list').innerHTML = row(fish[0], 'Poisson', b.poisson + ' sur 2', fish[1]) + row(fat[0], 'dont poisson gras', b.gras + ' sur 1', fat[1]) +
      row(leg[0], 'Légumes secs', b.legumes + ' sur 2', leg[1]) + row(red[0], 'Viande rouge, cuite', gr(b.rouge) + ', 500' + NB + 'g au plus', red[1]) +
      row(ham[0], 'Charcuterie', gr(b.charcuterie) + ', 150' + NB + 'g au plus', ham[1]);
  };
  /* Un choix qui fait dépasser la viande rouge ou la charcuterie de la semaine : on le dit tout de suite */
  const crossMsg = function(before, after){
    if (after.charcuterie > WEEK_GOALS.charcuterie + 0.5 && before.charcuterie <= WEEK_GOALS.charcuterie + 0.5)
      return 'Ça fait ' + gr(after.charcuterie) + ' de charcuterie cette semaine, 150' + NB + 'g au plus' + NB + ': le petit-déjeuner sucré ou une autre protéine équilibreraient.';
    if (after.rouge > WEEK_GOALS.rouge + 0.5 && before.rouge <= WEEK_GOALS.rouge + 0.5)
      return 'Ça fait ' + gr(after.rouge) + ' de viande rouge cuite cette semaine, 500' + NB + 'g au plus' + NB + ': alterne avec la volaille, le poisson ou le tofu.';
    return '';
  };
  const renderCourses = function(keepInputs){
    if (!keepInputs && (!isoOk(shop.from) || !isoOk(shop.to) || dayDiff(fromIso(shop.to)) < 0)){ shop.from = isoDate(today); shop.to = isoDate(addDays(today, 6)); }
    const err = fillRange('courses', shop, -21, keepInputs);
    if (err){ $('courses-list').innerHTML = ''; $('courses-days').innerHTML = ''; $('courses-batch').innerHTML = ''; return; }
    const days = rangeDays(shop.from, shop.to), res = days.map(dayResult);
    $('courses-batch').innerHTML = batchHTML(days, res);
    $('courses-list').innerHTML = shoppingList(res).map(function(g, j){
      return '<h2 class="shop-t" id="shop-' + j + '">' + g.title + '</h2><ul class="shop" aria-labelledby="shop-' + j + '">' + g.lines.map(function(l){
        const key = l.id + '|' + l.qty;
        return '<li><button type="button" class="chk" role="checkbox" aria-checked="' + (shop.checked.indexOf(key) >= 0) + '" data-action="co-check" data-value="' + key + '">' +
          '<span class="box" aria-hidden="true"></span><span class="q">' + l.qty + '</span><span class="name">' + l.name + (l.note ? '<span class="note">' + l.note + '</span>' : '') + '</span></button></li>';
      }).join('') + '</ul>';
    }).join('');
    const low = function(t){ return t.charAt(0).toLowerCase() + t.slice(1); };
    const meal = function(c){ return low(PROT[c.prot].label) + ' et ' + low(STARCH[c.starch].label); };
    $('courses-days').innerHTML = days.map(function(iso, j){
      const d = fromIso(iso), p = planFor(iso), c = choicesFor(iso, d.getDay()), r = res[j];
      const what = [p.seances.length ? p.seances.length + NB + 'séance' + (p.seances.length > 1 ? 's' : '') : 'repos', meal(c.dej), r.libre ? 'repas libre le soir' : meal(c.diner)];
      return '<li><button type="button" class="shop-day" data-action="co-day" data-value="' + iso + '"><span class="d">' + cap(dayLabel(d)) + '</span>' +
        '<span class="k">' + r10(r.tot.kcal) + NB + 'kcal</span><span class="note">' + cap(what.join(', ')) + (has(store.plans, iso) ? '' : ' (pas encore planifié)') + '</span></button></li>';
    }).join('');
  };
  /* Batch cooking de la période (courses) : pour chaque bloc de 7 jours, le jour où cuisiner, puis une fiche repliée par
     recette servie au moins deux fois : ce qu'il faut cuire en tout, les boîtes (frigo ou congélateur), la préparation */
  const SLOT = {dej:'midi', diner:'soir'};
  const SHARE = {2:'la moitié', 3:'un tiers', 4:'un quart'};
  const batchHTML = function(days, res){
    const lead = dayDiff(fromIso(days[0])) <= 0 ? 0 : 1;
    const blocks = batchCook(res.map(function(r){ return {res:r}; }), lead);
    if (!blocks.length) return '';
    const li = function(q, name, note){ return '<li><span class="b-q">' + q + '</span><span class="name">' + name + (note ? '<span class="note">' + note + '</span>' : '') + '</span></li>'; };
    return '<h2 class="shop-t" id="batch-h">Ton batch cooking</h2>' + blocks.map(function(bl){
      const start = fromIso(days[bl.start]), cook = bl.start === 0 && lead === 0 ? start : addDays(start, -1);
      const nb = bl.recipes.reduce(function(a, r){ return a + r.boxes.length; }, 0);
      const ng = bl.recipes.reduce(function(a, r){ return a + r.boxes.filter(function(x){ return !x.fridge; }).length; }, 0);
      return '<p class="calc">À cuisiner <strong>' + dayRel(cook) + '</strong>' + NB + ': ' + bl.recipes.length + ' recettes, ' + nb + ' boîtes.' +
        (ng ? ' Un plat cuisiné se garde 3' + NB + 'jours au frigo' + NB + ': mets ' + (ng > 1 ? 'les ' + ng + ' boîtes marquées' : 'la boîte marquée') + ' «' + NB + 'congélateur' + NB + '» au congélateur et sors-' + (ng > 1 ? 'les' : 'la') + ' la veille au soir.' : '') + '</p>' +
        bl.recipes.map(function(r){
          const g = r.boxes.filter(function(x){ return !x.fridge; }).length, n = r.boxes.length, x = RECIPES[r.id];
          return '<details class="batch"><summary><span class="b-s"><span class="b-t">' + r.t + '</span><span class="b-n">' + n + NB + 'boîtes' +
            (g ? ', dont ' + g + ' au congélateur' : '') + '</span></span></summary><div class="b-body">' +
            '<h3 class="rec-h">À cuire en tout</h3><ul class="b-list">' + r.totals.map(function(t){ return li(t.qty, t.name, t.note); }).join('') + '</ul>' +
            '<h3 class="rec-h">Les boîtes</h3><ul class="b-list">' + r.boxes.map(function(bx){
              const d = fromIso(days[bx.day]);
              return li(cap(d.toLocaleDateString('fr-FR', {weekday:'short'})) + ' ' + d.getDate() + ', ' + SLOT[bx.slot],
                bx.parts.map(function(pt){ return pt.qty + ' ' + pt.name + (pt.cooked ? ' (' + pt.cooked + ')' : ''); }).join(', ') + ', ' + (SHARE[n] || '1 part sur ' + n) + ' des légumes et de la sauce',
                bx.fridge ? 'frigo' : 'congélateur' + (r.gel ? '' : ', mais elle se congèle mal' + NB + ': prépare-la plutôt la veille'));
            }).join('') + '</ul>' +
            '<h3 class="rec-h">Aromates, sans compter</h3><p class="rec-aro">' + cap(x.aro) + '.</p>' +
            '<h3 class="rec-h">Préparation</h3><ol class="rec-steps">' + x.steps.map(function(z){ return '<li>' + z + '</li>'; }).join('') + '</ol></div></details>';
        }).join('');
    }).join('');
  };
  /* Champs Du / Au de l'assistant et des courses */
  const rangeInput = function(e){
    const el = e.target;
    if (!el.dataset || !el.dataset.range) return;
    const st = el.dataset.range === 'plan' ? planner : shop;
    if (!st) return;
    st[el.dataset.end] = isoOk(el.value) ? el.value : '';
    if (el.dataset.range === 'plan'){
      fillRange('plan', planner, 0, true);
      $('plan').querySelectorAll('[data-action="pl-preset"]').forEach(function(b){ const r = presetRange(b.dataset.value); b.setAttribute('aria-pressed', String(isoDate(r[0]) === planner.from && isoDate(r[1]) === planner.to)); });
    } else { saveShop(); renderCourses(true); }
  };
  document.addEventListener('input', rangeInput);
  document.addEventListener('change', rangeInput);
  /* Panneau de choix d'un plat : fond grisé, page inerte ; se ferme par un choix, le fond, Échap ou le bouton retour */
  let pick = null;
  /* ctx « repas » : le choix va dans le brouillon du formulaire (action rf), sinon il est enregistré tout de suite */
  const VIEWS = ['accueil', 'page', 'reglages', 'aide', 'repas', 'plan', 'courses'];
  const openPick = function(kind, slot, ctx, trigger){
    const c = ctx === 'repas' ? draft : ch;
    if (!c) return;
    const P = pickDef(kind, slot, c);
    pick = {kind:kind, slot:slot, trigger:trigger && trigger.id ? trigger.id : null, view:VIEWS.find(function(v){ return !$(v).hidden; }) || 'page'};
    $('sheet-t').textContent = P.title;
    $('sheet-list').hidden = false;
    $('sheet-rec').hidden = true;
    $('sheet-list').innerHTML = P.opts.map(function(o){
      return '<button type="button" class="opt" data-action="' + (ctx === 'repas' ? 'rf' : P.action) + '" data-kind="' + kind + '"' + (slot ? ' data-slot="' + slot + '"' : '') +
        ' data-value="' + o[0] + '" aria-pressed="' + (o[0] === P.current) + '">' + o[1] + (o[2] ? '<span class="opt-s">' + o[2] + '</span>' : '') + '</button>';
    }).join('');
    try { history.pushState({pick:true}, ''); } catch (e) {}
    $('sheet').hidden = false;
    $(pick.view).setAttribute('inert', '');
    document.documentElement.style.overflow = 'hidden';
    const on = $('sheet-list').querySelector('[aria-pressed="true"]');
    if (on) on.focus({preventScroll:true});
  };
  /* Fiche d'une recette (même panneau) : tes quantités pour ce repas avec la recette, les aromates, les étapes, puis
     « Choisir cette recette » ou « Retirer la recette » */
  const openRecipe = function(slot, trigger){
    const cur = recipeOf(ch[slot]), id = cur || recipesFor(ch[slot].prot, ch[slot].starch)[0];
    if (!id) return;
    const x = RECIPES[id], on = cur === id, withRec = cleanCh(ch, sel);
    withRec[slot].recette = id;
    const sec = buildDay(Object.assign({}, plan, {libre:false}), withRec, prof).secs.find(function(z){ return z.id === slot; });
    const items = recipePart(sec), t = total(items), none = new Map();
    pick = {kind:'recette', slot:slot, trigger:trigger && trigger.id ? trigger.id : null, view:VIEWS.find(function(v){ return !$(v).hidden; }) || 'page'};
    $('sheet-t').textContent = x.t;
    $('sheet-list').hidden = true;
    $('sheet-rec').hidden = false;
    $('sheet-rec').innerHTML = '<p class="rec-meta">' + x.min + NB + 'min' + (x.box ? ', se garde (à emporter)' : '') + '.' + (on ? ' Choisie pour ce ' + (slot === 'dej' ? 'déjeuner' : 'dîner') + '.' : '') + '</p>' +
      '<h3 class="rec-h">Pour ce ' + (slot === 'dej' ? 'déjeuner' : 'dîner') + '</h3>' +
      '<ul class="items">' + items.map(function(i){ return itemHTML('rec', i, none); }).join('') + '</ul>' +
      '<p class="rec-tot">En tout' + NB + ':' + macHTML(t) + '</p>' +
      (on ? '' : '<p class="rec-tot">Le féculent s’ajuste à la recette' + NB + ': ta journée garde le même total.</p>') +
      '<h3 class="rec-h">Aromates, sans compter</h3><p class="rec-aro">' + cap(x.aro) + '.</p>' +
      '<h3 class="rec-h">Préparation</h3><ol class="rec-steps">' + x.steps.map(function(z){ return '<li>' + z + '</li>'; }).join('') + '</ol>' +
      (on ? '<button type="button" class="btn wide" data-action="rec-off" data-slot="' + slot + '">Retirer la recette</button>'
        : '<button type="button" class="btn main wide" data-action="rec-on" data-slot="' + slot + '">Choisir cette recette</button>');
    try { history.pushState({pick:true}, ''); } catch (e) {}
    $('sheet').hidden = false;
    $('sheet').querySelector('.panel').scrollTop = 0;
    $(pick.view).setAttribute('inert', '');
    document.documentElement.style.overflow = 'hidden';
    $('sheet-rec').querySelector('.btn').focus({preventScroll:true});
  };
  const closePick = function(fromHistory){
    if (!pick) return;
    const id = pick.trigger, view = pick.view;
    pick = null;
    $('sheet').hidden = true;
    $(view).removeAttribute('inert');
    document.documentElement.style.overflow = '';
    if (!fromHistory){ try { if (history.state && history.state.pick) history.back(); } catch (e) {} }
    const trigger = id ? $(id) : null;
    if (trigger) trigger.focus({preventScroll:true});
  };
  document.addEventListener('keydown', function(e){ if (pick && e.key === 'Escape') closePick(false); });
  /* Bouton retour : ferme la couche ouverte (panneau de choix ou réglages) dont on quitte l'entrée d'historique */
  window.addEventListener('popstate', function(e){
    const st = e.state || {};
    if (pick && !st.pick){ closePick(true); return; }
    if (acc) return;
    const want = st.screen || null;
    while (stack.length && topScreen() !== want) closeScreen(true);
  });

  /* Accueil : au premier lancement (aucun profil enregistré), ou depuis les réglages. Les réponses restent
     dans un brouillon, validé par profileFields, et ne sont enregistrées qu'à la fin (ou avec « Passer »). */
  let acc = null;
  const ACC_UNITS = {age:'ans', taille:'cm', poids:'kg', shakerKcal:'kcal', shakerProt:'g'};
  const ACC_NAMES = {age:'ton âge', taille:'ta taille', poids:'ton poids', shakerKcal:'les calories par dose', shakerProt:'les protéines par dose'};
  const listFr = function(a){ return a.length > 1 ? a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1] : a[0]; };
  const accInputs = function(step){ return $('accueil').querySelectorAll('[data-step="' + step + '"] input[data-acc]'); };
  const openAcc = function(draft){
    acc = {step:1, draft:draft};
    $('accueil').querySelectorAll('input[data-acc]').forEach(function(el){
      const k = el.dataset.acc;
      el.value = has(draft, k) ? String(draft[k]) : '';
      el.removeAttribute('aria-invalid');
    });
    $('acc-err').textContent = '';
    renderAcc();
  };
  const renderAcc = function(){
    if (acc) setView('accueil'); else showTop();
    if (!acc) return;
    const d = acc.draft, pr = cleanProfile(d);
    $('accueil').querySelectorAll('[data-step]').forEach(function(el){ el.hidden = +el.dataset.step !== acc.step; });
    $('acc-bar').querySelectorAll('span').forEach(function(s, i){ s.classList.toggle('on', i < acc.step); });
    $('acc-bar').setAttribute('aria-valuenow', String(acc.step));
    $('acc-bar').setAttribute('aria-label', 'Étape ' + acc.step + ' sur 3');
    $('accueil').querySelectorAll('[data-action="acc"]').forEach(function(b){
      const k = b.dataset.key, v = k === 'sexe' ? d.sexe : pr[k];
      b.setAttribute('aria-pressed', String(String(v) === b.dataset.value));
    });
    $('acc-back').hidden = acc.step === 1;
    $('acc-next').textContent = acc.step === 3 ? 'Voir mes repas' : 'Continuer';
    const en = energy(emptyPlan(todayJs), pr);
    $('acc-prev').innerHTML = 'Un jour sans sport, tu dépenses environ ' + r10(en.rest) + NB + 'kcal. ' + (pr.deficit > 0
      ? 'Tu viseras environ <strong>' + fmtInt(en.target) + NB + 'kcal</strong>, soit ≈' + NB + '−' +
        en.kgWeek.toLocaleString('fr-FR', {minimumFractionDigits:1, maximumFractionDigits:1}) + NB + 'kg par semaine.'
      : 'Tu viseras autant, <strong>' + r10(en.rest) + NB + 'kcal</strong>, pour garder ton poids.') +
      ' Les jours de séance, ce qu’elles coûtent s’ajoute.';
    $('acc-dose').hidden = pr.shaker !== 'oui';
    $('acc-shaker-t').textContent = pr.shaker === 'oui'
      ? 'Juste après ta dernière séance, ou l’après-midi les jours de repos. Sans réglage, une dose de 120' + NB + 'kcal et 24' + NB + 'g de protéines.'
      : 'Sans shaker, un skyr s’ajoute le soir quand il te manque des protéines.';
  };
  /* Étape valide ? Sinon, message et champs en erreur */
  const accCheck = function(){
    const d = acc.draft, parts = [], bad = [], missing = [];
    let first = null;
    accInputs(acc.step).forEach(function(el){
      const k = el.dataset.acc;
      if (has(d, k)) return;
      if (el.value.trim() !== ''){ bad.push(ACC_NAMES[k] + ' (' + PROFILE_RANGES[k][0] + ' à ' + PROFILE_RANGES[k][1] + NB + ACC_UNITS[k] + ')'); }
      else if (acc.step === 1) missing.push(ACC_NAMES[k]);
      else return;
      el.setAttribute('aria-invalid', 'true');
      first = first || el;
    });
    if (acc.step === 1 && !has(d, 'sexe')) parts.push('dis-nous si tu es un homme ou une femme');
    if (missing.length) parts.push('indique ' + listFr(missing));
    if (bad.length) parts.push('vérifie ' + listFr(bad));
    const msg = parts.length ? listFr(parts) + '.' : '';
    $('acc-err').textContent = msg ? msg.charAt(0).toUpperCase() + msg.slice(1) : '';
    if (first) first.focus();
    return !msg;
  };
  const finishAcc = function(){
    const d = profileFields(acc.draft);
    Object.keys(d).forEach(function(k){ prof[k] = d[k]; });
    if (!has(prof, 'mode')) prof.mode = cleanProfile(prof).mode;
    saveProf();
    acc = null;
    closeAllScreens();
    fillNeeds();
    $('intro').textContent = 'C’est prêt. Ajoute tes séances du jour, tes repas s’adaptent. Sans séance, c’est une journée de repos.';
    prevQty = new Map();
    renderAcc();
    render();
    $('title').focus();
    maybeOpenRepas();
  };
  const accStep = function(step){
    acc.step = step;
    $('acc-err').textContent = '';
    renderAcc();
    $('acc-h' + step).focus();
  };
  $('accueil').addEventListener('input', function(e){
    const el = e.target, k = el.dataset && el.dataset.acc;
    if (!k || !acc) return;
    const raw = el.value.trim().replace(',', '.'), o = {};
    o[k] = Number(raw);
    if (raw !== '' && has(profileFields(o), k)){ acc.draft[k] = o[k]; el.removeAttribute('aria-invalid'); }
    else delete acc.draft[k];
    $('acc-err').textContent = '';
    renderAcc();
  });
  $('accueil').addEventListener('change', function(e){
    const el = e.target, k = el.dataset && el.dataset.acc;
    if (k && acc && el.value.trim() !== '' && !has(acc.draft, k)) el.setAttribute('aria-invalid', 'true');
  });

  /* Recette choisie ou retirée depuis la page : le focus reste sur son bouton */
  let recFocus = null;
  document.addEventListener('click', function(e){
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const v = b.dataset.value;
    let msg = '';
    /* Choix de plats : repères de la semaine avant, pour dire tout de suite si un choix fait dépasser une limite */
    const wb0 = /^(pd|prot|starch|repas-ok)$/.test(b.dataset.action) && b.closest('#page, #plan, #repas, #sheet') ? weekBal(selDate) : null;
    /* Boutons de l'assistant : seulement pendant l'assistant, à la bonne étape (choix des jours ou un jour) */
    if (/^pl-/.test(b.dataset.action) && (!planner || (['pl-preset', 'pl-start', 'pl-nrec', 'pl-batch'].indexOf(b.dataset.action) >= 0) !== (planner.i < 0))) return;
    switch (b.dataset.action){
      case 'acc': {
        const k = b.dataset.key, o = {};
        o[k] = k === 'deficit' || k === 'marge' ? Number(v) : v;
        if (has(profileFields(o), k)) acc.draft[k] = o[k];
        $('acc-err').textContent = '';
        renderAcc();
        return;
      }
      case 'acc-back': accStep(acc.step - 1); return;
      case 'acc-next':
        if (!accCheck()) return;
        if (acc.step < 3) accStep(acc.step + 1); else finishAcc();
        return;
      case 'acc-skip': finishAcc(); return;
      case 'accueil': openAcc(profileFields(prof)); $('acc-h1').focus(); return;
      case 'add':
        $('intro').textContent = '';
        plan.seances.push({taille:v, moment:v === 'longue' ? 'matin' : 'soir', duree:2});
        plan.seances = cleanSeances(plan.seances); savePlan({seances:plan.seances});
        break;
      case 'smoment': if (!plan.seances[+b.dataset.index]) return; plan.seances[+b.dataset.index].moment = v; plan.seances = cleanSeances(plan.seances); savePlan({seances:plan.seances}); break;
      case 'sduree': if (!plan.seances[+b.dataset.index]) return; plan.seances[+b.dataset.index].duree = parseFloat(v); plan.seances = cleanSeances(plan.seances); savePlan({seances:plan.seances}); break;
      case 'rm': if (!plan.seances[+b.dataset.index]) return; plan.seances.splice(+b.dataset.index, 1); savePlan({seances:plan.seances}); break;
      case 'toggle':
        if (b.dataset.key !== 'libre') return;
        plan.libre = !plan.libre;
        if (plan.libre) msg = clearOtherLibre();
        savePlan({libre:plan.libre});
        break;
      case 'pd': if (has(PD, v)){ ch.pdBase = v; saveCh(); } break;
      case 'prof': {
        const o = {};
        o[b.dataset.key] = v;
        if (has(profileFields(o), b.dataset.key)){ prof[b.dataset.key] = v; saveProf(); }
        break;
      }
      /* Réglages, « Tes aliments » : proposer ou non un aliment (au moins un gardé par type, sauf les desserts) */
      case 'aliment': {
        const kind = b.dataset.kind, key = kind + ':' + v, off = cleanProfile(prof).off;
        if (!has(CHOICE_IDS, kind) || CHOICE_IDS[kind].indexOf(v) < 0) return;
        const i = off.indexOf(key);
        if (i >= 0) off.splice(i, 1);
        else if (kind !== 'dessert' && allowed(kind, off).length <= 1){
          $('alim-warn').textContent = 'Garde au moins ' + {pd:'une base pour le petit-déjeuner', prot:'une protéine', starch:'un féculent'}[kind] + '.';
          return;
        } else off.push(key);
        if (off.length) prof.off = off; else delete prof.off;
        saveProf();
        $('alim-warn').textContent = '';
        renderAliments();
        const again = $('alim-list').querySelector('[data-kind="' + kind + '"][data-value="' + v + '"]');
        if (again) again.focus({preventScroll:true});
        loadSel();
        break;
      }
      case 'sem-day': if (!/^[0-6]$/.test(v || '')) return; semSel = +v; renderSemaine(); semFocus(b); return;
      case 'sem-add': case 'sem-rm': case 'sem-smoment': case 'sem-sduree': case 'sem-lib': {
        const w = semOf(), list = (w.jours[semSel] || []).map(function(x){ return Object.assign({}, x); }), i = +b.dataset.index, act = b.dataset.action;
        if (act === 'sem-add'){ if (!has(SIZES, v) || addDisabled(v, list)) return; list.push({taille:v, moment:v === 'longue' ? 'matin' : 'soir', duree:2}); }
        else if (act === 'sem-rm'){ if (!list[i]) return; list.splice(i, 1); }
        else if (act === 'sem-smoment'){ if (!list[i] || !has(MOMENT_RANK, v)) return; list[i].moment = v; }
        else if (act === 'sem-sduree'){ if (!list[i]) return; list[i].duree = parseFloat(v); }
        else { if (!/^[0-6]$/.test(v || '')) return; w.libre = +v; }
        w.jours[semSel] = list;
        saveWeek(w);
        renderSemaine();
        semFocus(b);
        loadSel(); prevQty = new Map();
        break;
      }
      case 'open-pick': openPick(b.dataset.kind, b.dataset.slot || null, b.dataset.ctx || 'page', b); return;
      case 'repas': openRepas(b); return;
      /* Calendrier : un jour, la semaine d'avant ou d'après (même jour de la semaine, ou aujourd'hui), retour à aujourd'hui */
      case 'day': {
        const d = fromIso(v);
        if (!d || dayDiff(d) < -21 || dayDiff(d) > 365) return;
        selDate = d; loadSel(); prevQty = new Map();
        break;
      }
      case 'week': {
        let d = addDays(selDate, 7 * (parseInt(v, 10) < 0 ? -1 : 1));
        if (weekOf(d).some(function(x){ return dayDiff(x) === 0; })) d = today;
        if (dayDiff(d) < -21 || dayDiff(d) > 365) return;
        selDate = d; loadSel(); prevQty = new Map();
        break;
      }
      case 'today': selDate = today; loadSel(); prevQty = new Map(); $('title').focus(); break;
      /* Planifier : jours, étapes, hasard pour ce jour ou pour tous les jours restants */
      case 'plan':
        planner = {i:-1, from:isoDate(today), to:isoDate(addDays(today, 6)), back:selDate, msg:'', n:4};
        renderPlan();
        openScreen('plan', b);
        return;
      case 'pl-preset': {
        const r = presetRange(v);
        planner.from = isoDate(r[0]); planner.to = isoDate(r[1]);
        renderPlan();
        return;
      }
      case 'pl-start': if (!fillRange('plan', planner, 0, true)) planGo(0); return;
      /* Batch cooking : nombre de recettes, puis tous les plats de la période tirés d'un coup, et les courses */
      case 'pl-nrec':
        if (BATCH_N.indexOf(+v) < 0) return;
        planner.n = +v; renderPlan();
        $('plan-body').querySelector('[data-action="pl-nrec"][data-value="' + v + '"]').focus({preventScroll:true});
        return;
      case 'pl-batch': {
        if (fillRange('plan', planner, 0, true)) return;
        const isos = rangeDays(planner.from, planner.to), pr = cleanProfile(prof);
        const cs = batchChoices(isos.map(function(iso){ return {libre:planFor(iso).libre}; }), planner.n, pr.off, scaleOf(pr));
        isos.forEach(function(iso, j){
          const js = fromIso(iso).getDay(), c = cleanCh(cs[j], js);
          writeDay(iso, {ch:c});
          store.choices[js] = c;
        });
        persist();
        finishPlan();
        return;
      }
      case 'pl-prev': planGo(planner.i - 1); return;
      case 'pl-next':
        if (planner.i < rangeDays(planner.from, planner.to).length - 1) planGo(planner.i + 1); else finishPlan();
        return;
      case 'pl-hasard':
        ch = cleanCh(drawFor(selIso()), sel); saveCh();
        planner.msg = 'Plats tirés au hasard' + NB + ': touche un plat pour le changer.';
        break;
      case 'pl-hasard-tous':
        rangeDays(planner.from, planner.to).slice(planner.i).forEach(function(iso){
          const js = fromIso(iso).getDay(), c = cleanCh(drawFor(iso), js);
          writeDay(iso, {ch:c});
          store.choices[js] = c;
        });
        persist();
        finishPlan();
        return;
      /* Courses : cocher une ligne, tout décocher, ouvrir un jour */
      case 'courses': renderCourses(false); openScreen('courses', b); return;
      case 'co-check': {
        const k = shop.checked.indexOf(v);
        if (k >= 0) shop.checked.splice(k, 1); else shop.checked.push(v);
        saveShop();
        b.setAttribute('aria-checked', String(k < 0));
        return;
      }
      case 'co-uncheck': shop.checked = []; saveShop(); renderCourses(true); return;
      case 'co-day': {
        const d = fromIso(v);
        if (!d) return;
        closeAllScreens();
        selDate = d; loadSel(); prevQty = new Map();
        render();
        scroller().scrollTop = 0;
        $('title').focus({preventScroll:true});
        return;
      }
      case 'installer':
        if (installEvt){ installEvt.prompt(); installEvt = null; }
        $('install').hidden = true;
        return;
      case 'rf': {
        const slot = b.dataset.slot, kind = b.dataset.kind;
        if (!draft) return;
        if (kind === 'pd' && has(PD, v)) draft.pdBase = v;
        else if (kind === 'prot' && has(PROT, v)) draft[slot].prot = v;
        else if (kind === 'starch' && has(STARCH, v)) draft[slot].starch = v;
        else if (kind === 'dessert' && has(DESSERT, v)) draft[slot].dessert = v;
        else return;
        dropRecipes(draft);
        renderRepas();
        if (pick && b.closest('#sheet')) closePick(false);
        return;
      }
      case 'repas-ok': if (!draft) return; applyRepas(draft); break;
      case 'repas-hasard':
        if (!draft) return;
        applyRepas(drawFor(selIso()));
        msg = 'Repas tirés au hasard' + NB + ': touche un plat pour le changer.';
        break;
      case 'close-pick': closePick(false); return;
      case 'needs': effShow(false); openScreen('reglages', b); return;
      /* Réglages, « Effacer mes données » : demander, confirmer ou annuler */
      case 'eff-ask': effShow(true); $('eff-no').focus({preventScroll:true}); return;
      case 'eff-no': effShow(false); $('eff-btn').focus({preventScroll:true}); return;
      case 'eff-ok': resetAll(); return;
      case 'aide': openScreen('aide', b); return;
      case 'fermer': closeScreen(false); return;
      case 'prot': if (has(PROT, v)){ ch[b.dataset.slot].prot = v; dropRecipes(ch); saveCh(); } break;
      case 'starch': if (has(STARCH, v)){ ch[b.dataset.slot].starch = v; dropRecipes(ch); saveCh(); } break;
      /* Recette d'un repas : voir sa fiche, la choisir (celle proposée pour sa protéine et son féculent) ou la retirer */
      case 'rec-view': if (!has(REPAS, b.dataset.slot)) return; openRecipe(b.dataset.slot, b); return;
      case 'rec-on': {
        const slot = b.dataset.slot, id = has(REPAS, slot) ? recipesFor(ch[slot].prot, ch[slot].starch)[0] : null;
        if (!id) return;
        ch[slot].recette = id; saveCh();
        recFocus = slot;
        break;
      }
      case 'rec-off': if (!has(REPAS, b.dataset.slot)) return; delete ch[b.dataset.slot].recette; saveCh(); recFocus = b.dataset.slot; break;
      case 'dessert': if (has(DESSERT, v)){ ch[b.dataset.slot].dessert = v; saveCh(); } break;
      case 'reset':
        delete store.plans[selIso()];
        delete store.choices[sel];
        loadSel();
        if (plan.libre) msg = clearOtherLibre();
        persist(); prevQty = new Map();
        break;
      default: return;
    }
    if (wb0 && !msg) msg = crossMsg(wb0, weekBal(selDate));
    $('hint').textContent = msg;
    if (planner && (b.closest('#plan') || (b.closest('#sheet') && topScreen() === 'plan')) && b.dataset.action !== 'pl-hasard') planner.msg = msg;
    const inPlan = b.closest('#plan') ? b : null;
    render();
    /* Assistant redessiné : le focus revient sur le même bouton */
    if (inPlan && topScreen() === 'plan'){
      const same = [...$('plan-body').querySelectorAll('[data-action="' + inPlan.dataset.action + '"]')].find(function(x){
        return ['value', 'slot', 'index', 'key'].every(function(k){ return x.dataset[k] === inPlan.dataset[k]; });
      });
      if (same) same.focus({preventScroll:true});
    }
    /* Un choix dans le panneau le valide et le ferme */
    if (pick && b.closest('#sheet')) closePick(false);
    else if (recFocus && $('rec-c-' + recFocus)) $('rec-c-' + recFocus).focus({preventScroll:true});
    recFocus = null;
  });

  /* Réglages, « Tes aliments » : tous les choix, proposés (encre) ou non (barrés) */
  const renderAliments = function(){
    const off = cleanProfile(prof).off, T = {pd:'Base du petit-déjeuner', prot:'Protéines', starch:'Féculents', dessert:'Desserts'};
    $('alim-list').innerHTML = Object.keys(CHOICE_IDS).map(function(kind){
      return '<p class="rf-l" id="al-' + kind + '">' + T[kind] + '</p><div class="opts-list" role="group" aria-labelledby="al-' + kind + '">' +
        CHOICE_IDS[kind].map(function(id){
          const l = labelOf(kind, id);
          return '<button type="button" class="opt" data-action="aliment" data-kind="' + kind + '" data-value="' + id + '" aria-pressed="' + (off.indexOf(kind + ':' + id) < 0) + '">' +
            l.label + (l.sub ? '<span class="opt-s">' + l.sub + '</span>' : '') + '</button>';
        }).join('') + '</div>';
    }).join('');
  };
  renderAliments();

  /* Réglages, « Ta semaine type » : un jour à la fois, ses séances avec les mêmes boutons que la page */
  let semSel = todayJs;
  const SHORT = {0:'dim.', 1:'lun.', 2:'mar.', 3:'mer.', 4:'jeu.', 5:'ven.', 6:'sam.'};
  const renderSemaine = function(){
    const w = semOf(), list = w.jours[semSel] || [];
    $('sem-days').innerHTML = DAYS.map(function(d){
      const n = (w.jours[d.js] || []).length;
      return '<button type="button" data-action="sem-day" data-value="' + d.js + '" aria-pressed="' + (d.js === semSel) + '" aria-label="' + d.long + NB + ': ' +
        (n ? n + ' séance' + (n > 1 ? 's' : '') : 'repos') + '"><span class="wd">' + SHORT[d.js] + '</span><span class="dn">' + (n || '–') + '</span></button>';
    }).join('');
    $('sem-h').textContent = cap(DAYS.find(function(d){ return d.js === semSel; }).long);
    $('sem-sess').innerHTML = sessHTML(list, 'sem-');
    $('sem-acts').querySelectorAll('button').forEach(function(b){ b.disabled = addDisabled(b.dataset.value, list); });
    $('sem-lib').innerHTML = DAYS.map(function(d){
      return '<button type="button" class="opt" data-action="sem-lib" data-value="' + d.js + '" aria-pressed="' + (w.libre === d.js) + '" aria-label="' + d.long + '">' + SHORT[d.js] + '</button>';
    }).join('');
  };
  /* Enregistrée dans le profil, seulement si elle diffère de la semaine par défaut (aucune séance, repas libre le samedi) */
  const saveWeek = function(w){
    const c = cleanWeek(w);
    if (Object.keys(c.jours).length || c.libre !== 6) prof.semaine = c; else delete prof.semaine;
    saveProf();
  };
  /* Après un changement, le focus revient sur le même bouton (sinon sur « + Petite ») */
  const semFocus = function(b){
    const same = [...$('semaine').querySelectorAll('[data-action="' + b.dataset.action + '"]')].find(function(x){
      return x.dataset.value === b.dataset.value && x.dataset.index === b.dataset.index;
    });
    const el = same && !same.disabled ? same : $('sem-acts').querySelector('button:not(:disabled)') || $('sem-days').querySelector('[aria-pressed="true"]');
    if (el) el.focus({preventScroll:true});
  };
  renderSemaine();

  /* Champs du profil : enregistrés à chaque saisie valide, vidés = valeur par défaut */
  const fillNeeds = function(){
    document.querySelectorAll('#besoins input[data-key]').forEach(function(el){
      const k = el.dataset.key;
      if (el.type === 'range') el.value = String(cleanProfile(prof)[k]);
      else {
        el.value = has(prof, k) ? String(prof[k]) : '';
        el.removeAttribute('aria-invalid');
        if (PROFILE_DEFAULT[k] !== null) el.placeholder = String(PROFILE_DEFAULT[k]);
      }
    });
  };
  fillNeeds();
  /* Quitter un champ resté invalide : il reprend la valeur réellement utilisée */
  document.addEventListener('change', function(e){
    const el = e.target;
    if (!el.dataset || !el.dataset.key || !el.closest('#besoins') || el.type === 'range') return;
    const k = el.dataset.key, raw = el.value.trim().replace(',', '.');
    const shown = raw === '' ? null : Number(raw), stored = has(prof, k) ? prof[k] : null;
    if (shown === stored) return;
    el.value = stored === null ? '' : String(stored);
    el.removeAttribute('aria-invalid');
    if (k === 'repos') $('warn-repos').textContent = '';
    render();
  });
  document.addEventListener('input', function(e){
    const el = e.target;
    if (!el.dataset || !el.dataset.key || !el.closest('#besoins')) return;
    const k = el.dataset.key, raw = el.value.trim().replace(',', '.');
    if (raw === '') delete prof[k];
    else {
      const o = {};
      o[k] = Number(raw);
      if (!has(profileFields(o), k)){
        el.setAttribute('aria-invalid', 'true');
        if (k === 'repos') $('warn-repos').textContent = 'Entre ' + fmtInt(PROFILE_RANGES.repos[0]) + ' et ' + fmtInt(PROFILE_RANGES.repos[1]) + NB +
          'kcal' + NB + ': c’est le total de ta journée, même sans bouger, pas les calories actives de ta montre.';
        return;
      }
      prof[k] = o[k];
    }
    el.removeAttribute('aria-invalid');
    if (k === 'repos') $('warn-repos').textContent = '';
    saveProf();
    render();
  });

  /* Tout effacer (réglages) : toutes les clés de l'appli (repas-du-jour:…, l'ancienne v1 comprise, sinon elle serait reconvertie
     au prochain chargement), puis l'appli repart comme au premier lancement : accueil, puis formulaire des repas */
  const effShow = function(on){ $('eff-ask').hidden = on; $('eff-confirm').hidden = !on; };
  const resetAll = function(){
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && k.indexOf('repas-du-jour:') === 0) keys.push(k); }
      keys.forEach(function(k){ localStorage.removeItem(k); });
    } catch (e) {}
    store = {plans:{}, choices:{}}; prof = {}; prof.mode = cleanProfile(prof).mode;
    shop = {from:'', to:'', checked:[]}; repasVu = null; draft = null; planner = null; semSel = todayJs;
    effShow(false);
    closeAllScreens();
    selDate = today; loadSel(); prevQty = new Map();
    $('hint').textContent = ''; $('intro').textContent = ''; $('alim-warn').textContent = '';
    fillNeeds(); renderAliments(); renderSemaine();
    render();
    openAcc({});
    $('acc-h1').focus();
  };

  /* Si la page reste ouverte d'un jour à l'autre, revenir sur le nouveau jour */
  const refreshToday = function(){
    const n = noon();
    if (isoDate(n) === isoDate(today)) return;
    today = n; todayJs = n.getDay(); selDate = today;
    purge(); loadSel(); prevQty = new Map();
    $('hint').textContent = '';
    if (topScreen() === 'repas') startDraft();
    render();
    maybeOpenRepas();
  };
  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') refreshToday(); });
  window.addEventListener('focus', refreshToday);
  window.addEventListener('pageshow', refreshToday);

  /* Table des valeurs des aliments (écran d'aide), une fois pour toutes */
  const num = function(n, d){ return n.toLocaleString('fr-FR', {maximumFractionDigits:d}); };
  $('ref-tables').innerHTML = refTable().map(function(g){
    return '<table class="ref-t"><caption>' + g.title + '<span>' + g.per + '</span></caption>' +
      '<colgroup><col><col class="k"><col class="n"><col class="n"><col class="n"></colgroup>' +
      '<thead><tr><th scope="col">Aliment</th><th scope="col">kcal</th><th scope="col" class="p"><abbr title="protéines">P</abbr></th>' +
      '<th scope="col" class="c"><abbr title="glucides">G</abbr></th><th scope="col" class="f"><abbr title="lipides">L</abbr></th></tr></thead><tbody>' +
      g.rows.map(function(r){
        return '<tr data-key="' + r.key + '"><th scope="row">' + r.label + '</th><td>' + num(r.v[0], 0) + '</td><td>' + num(r.v[1], 1) + '</td><td>' + num(r.v[2], 1) + '</td><td>' + num(r.v[3], 1) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }).join('');
  $('app-version').textContent = APP_VERSION;
  loadSel();
  render();
  /* Premier lancement : aucun profil enregistré (sans stockage, on n'insiste pas) */
  let firstRun = false;
  try { firstRun = localStorage.getItem(PKEY) === null; } catch (e) {}
  if (firstRun) openAcc({});
  else maybeOpenRepas();

  /* Appli installable (PWA) : le service worker (sw.js) garde la page pour le hors connexion, enregistré seulement si
     la page est servie en http(s) ; sur Android, bouton « Installer l'appli » dans les réglages quand le navigateur le propose */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); installEvt = e; $('install').hidden = false; });
  window.addEventListener('appinstalled', function(){ installEvt = null; $('install').hidden = true; });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
    window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  }
}
