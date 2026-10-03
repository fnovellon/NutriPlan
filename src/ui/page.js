  /* Page du jour : choix des plats en bulles, lignes des repas, recettes, séances, total et note, dessin de la page (render). */
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
  /* Actions de la page du jour : séances, repas libre, plats, recettes, calendrier, plan de base */
  Object.assign(ACTIONS, {
    add: function(b, v){
      $('intro').textContent = '';
      plan.seances.push({taille:v, moment:v === 'longue' ? 'matin' : 'soir', duree:2});
      plan.seances = cleanSeances(plan.seances); savePlan({seances:plan.seances});
      return '';
    },
    smoment: function(b, v){ if (!plan.seances[+b.dataset.index]) return; plan.seances[+b.dataset.index].moment = v; plan.seances = cleanSeances(plan.seances); savePlan({seances:plan.seances}); return ''; },
    sduree: function(b, v){ if (!plan.seances[+b.dataset.index]) return; plan.seances[+b.dataset.index].duree = parseFloat(v); plan.seances = cleanSeances(plan.seances); savePlan({seances:plan.seances}); return ''; },
    rm: function(b){ if (!plan.seances[+b.dataset.index]) return; plan.seances.splice(+b.dataset.index, 1); savePlan({seances:plan.seances}); return ''; },
    toggle: function(b){
      if (b.dataset.key !== 'libre') return;
      let msg = '';
      plan.libre = !plan.libre;
      if (plan.libre) msg = clearOtherLibre();
      savePlan({libre:plan.libre});
      return msg;
    },
    pd: function(b, v){ if (has(PD, v)){ ch.pdBase = v; saveCh(); } return ''; },
    prot: function(b, v){ if (has(PROT, v)){ ch[b.dataset.slot].prot = v; dropRecipes(ch); saveCh(); } return ''; },
    starch: function(b, v){ if (has(STARCH, v)){ ch[b.dataset.slot].starch = v; dropRecipes(ch); saveCh(); } return ''; },
    dessert: function(b, v){ if (has(DESSERT, v)){ ch[b.dataset.slot].dessert = v; saveCh(); } return ''; },
    /* Recette d'un repas : voir sa fiche, la choisir (celle proposée pour sa protéine et son féculent) ou la retirer */
    'rec-view': function(b){ if (!has(REPAS, b.dataset.slot)) return; openRecipe(b.dataset.slot, b); },
    'rec-on': function(b){
      const slot = b.dataset.slot, id = has(REPAS, slot) ? recipesFor(ch[slot].prot, ch[slot].starch)[0] : null;
      if (!id) return;
      ch[slot].recette = id; saveCh();
      recFocus = slot;
      return '';
    },
    'rec-off': function(b){ if (!has(REPAS, b.dataset.slot)) return; ['recette', 'g', 'g2'].forEach(function(f){ delete ch[b.dataset.slot][f]; }); saveCh(); recFocus = b.dataset.slot; return ''; },
    /* Calendrier : un jour, la semaine d'avant ou d'après (même jour de la semaine, ou aujourd'hui), retour à aujourd'hui */
    day: function(b, v){
      const d = fromIso(v);
      if (!d || dayDiff(d) < -21 || dayDiff(d) > 365) return;
      selDate = d; loadSel(); prevQty = new Map();
      return '';
    },
    week: function(b, v){
      let d = addDays(selDate, 7 * (parseInt(v, 10) < 0 ? -1 : 1));
      if (weekOf(d).some(function(x){ return dayDiff(x) === 0; })) d = today;
      if (dayDiff(d) < -21 || dayDiff(d) > 365) return;
      selDate = d; loadSel(); prevQty = new Map();
      return '';
    },
    today: function(){ selDate = today; loadSel(); prevQty = new Map(); $('title').focus(); return ''; },
    /* « Revenir au plan de base » : la date et la mémoire de ce jour de la semaine effacées */
    reset: function(){
      let msg = '';
      delete store.plans[selIso()];
      delete store.choices[sel];
      loadSel();
      if (plan.libre) msg = clearOtherLibre();
      persist(); prevQty = new Map();
      return msg;
    }
  });
