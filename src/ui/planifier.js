  /* Planifier (3.21.0) : la planification en cours en évidence, les autres (à venir, puis passées), puis « Nouvelle
     planification » : la période, les plats (simples ou en recettes, avec l'option batch cooking et son nombre de recettes).
     Créer tire les plats de toute la période d'un coup (enregistrés pour chaque date), garde la planification et ouvre son
     détail (ui/courses.js). Plus d'assistant jour par jour : chaque jour se change depuis la journée. */
  const planner = {from:'', to:'', type:'recettes', batch:false, n:4};
  const resetPlanner = function(){ planner.from = isoDate(today); planner.to = isoDate(addDays(today, 6)); planner.type = 'recettes'; planner.batch = false; planner.n = 4; };
  resetPlanner();
  const PRESETS = [['7', 'Les 7 prochains jours'], ['semaine', 'Cette semaine'], ['suivante', 'La semaine prochaine']];
  const presetRange = function(k){
    if (k === 'semaine') return [today, weekOf(today)[6]];
    if (k === 'suivante'){ const w = weekOf(addDays(today, 7)); return [w[0], w[6]]; }
    return [today, addDays(today, 6)];
  };
  const PL_TEXT = {
    simple:'Une protéine et un féculent à chaque repas, sans recette' + NB + ': la ligne «' + NB + 'légumes' + NB + '» et ta marge cuisine pour le reste.',
    recettes:'Une recette à chaque repas, tirée au hasard parmi celles qui vont avec tes aliments.',
    batch:'Quelques recettes qui se gardent, répétées midi et soir sur la période' + NB + ': tu cuisines une fois, la veille, et tes courses suivent.'
  };
  /* Une planification dans la liste ; main : celle en cours, en évidence */
  const planRow = function(p, main){
    const t = isoDate(today), when = p.from <= t && p.to >= t ? 'En cours' : p.from > t ? 'À venir' : 'Passée';
    return '<li><button type="button" class="shop-day' + (main ? ' is-cur' : '') + '" data-action="pl-open" data-value="' + p.from + '|' + p.to + '">' +
      '<span class="d">' + periodTitle(p.from, p.to) + '</span><span class="k">' + when + '</span><span class="note">' + cap(planifLine(p)) + '.' +
      (main ? ' Le récap et tes courses.' : '') + '</span></button></li>';
  };
  /* Les jours de la période dont les plats sont déjà choisis : ils seront remplacés */
  const planOver = function(){
    if (rangeError(planner.from, planner.to, 0)) return '';
    const n = rangeDays(planner.from, planner.to).filter(function(iso){ const r = store.plans[iso]; return r && typeof r === 'object' && has(r, 'ch'); }).length;
    return n ? (n > 1 ? n + NB + 'jours ont' : '1' + NB + 'jour a') + ' déjà ses plats' + NB + ': ils seront remplacés. Tes séances restent.' : '';
  };
  /* Période et raccourcis, sans redessiner les champs (frappe en cours) */
  const planFormUpdate = function(){
    fillRange('plan', planner, 0, true);
    $('plan').querySelectorAll('[data-action="pl-preset"]').forEach(function(b){ const r = presetRange(b.dataset.value); b.setAttribute('aria-pressed', String(isoDate(r[0]) === planner.from && isoDate(r[1]) === planner.to)); });
    $('plan-over').textContent = planOver();
  };
  const renderPlan = function(){
    const t = isoDate(today), now = planifOf(t), others = planifs.filter(function(p){ return p !== now; });
    const next = others.filter(function(p){ return p.from > t; }), past = others.filter(function(p){ return p.to < t; }).reverse();
    const seg = function(action, value, label, on){ return '<button type="button" data-action="' + action + '" data-value="' + value + '" aria-pressed="' + on + '">' + label + '</button>'; };
    const recettes = planner.type === 'recettes';
    $('plan-body').innerHTML = (now ? '<ul class="shop-days pl-now" aria-label="Planification en cours">' + planRow(now, true) + '</ul>' : '') +
      (next.length || past.length ? '<h2 id="pl-list-t">' + (now ? 'Tes autres planifications' : 'Tes planifications') + '</h2><ul class="shop-days" aria-labelledby="pl-list-t">' +
        next.concat(past).map(function(p){ return planRow(p, false); }).join('') + '</ul>'
        : now ? '' : '<p class="repas-p">Aucune planification pour l’instant. Choisis des jours et tes plats' + NB + ': l’appli les tire d’un coup, équilibrés sur la semaine, et fait ta liste de courses.</p>') +
      '<h2 id="pl-new-t">Nouvelle planification</h2>' +
      '<div class="opts-list plan-presets" role="group" aria-label="Raccourcis">' + PRESETS.map(function(p){
        const r = presetRange(p[0]), on = isoDate(r[0]) === planner.from && isoDate(r[1]) === planner.to;
        return '<button type="button" class="opt" data-action="pl-preset" data-value="' + p[0] + '" aria-pressed="' + on + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="fields plan-dates"><label class="field"><span>Du</span><span class="inp"><input type="date" data-range="plan" data-end="from"></span></label>' +
      '<label class="field"><span>Au</span><span class="inp"><input type="date" data-range="plan" data-end="to"></span></label></div>' +
      '<p class="calc" id="plan-span"></p><p class="warn" id="plan-err" role="alert"></p>' +
      '<div class="opt-row"><span class="lbl" id="pl-t-l">Plats</span><div class="seg" role="group" aria-labelledby="pl-t-l">' +
        seg('pl-type', 'simple', 'Plats simples', !recettes) + seg('pl-type', 'recettes', 'Recettes', recettes) + '</div></div>' +
      (recettes ? '<div class="switches"><button type="button" class="switch" role="switch" id="pl-batch" aria-checked="' + planner.batch + '" data-action="pl-batch">' +
        '<span>Batch cooking</span><span class="knob" aria-hidden="true"></span></button></div>' +
        (planner.batch ? '<div class="opt-row pl-n"><span class="lbl" id="pl-n-l">Recettes différentes</span><div class="seg" role="group" aria-labelledby="pl-n-l">' +
          BATCH_N.map(function(n){ return seg('pl-nrec', n, n, planner.n === n); }).join('') + '</div></div>' : '') : '') +
      '<p class="calc">' + PL_TEXT[recettes ? (planner.batch ? 'batch' : 'recettes') : 'simple'] + ' Les plats suivent tes aliments proposés et l’équilibre de la semaine.' +
        (Object.keys(semOf().jours).length ? ' Les jours gardent leurs séances, celles de ta semaine type s’ils ne sont pas encore remplis.' : '') + '</p>' +
      '<p class="warn" id="plan-over"></p>' +
      '<button type="button" class="btn main wide" data-action="pl-create">Créer la planification</button>';
    fillRange('plan', planner, 0, false);
    $('plan-over').textContent = planOver();
  };
  /* Après un réglage du formulaire : redessiné, le focus reste sur le bouton touché */
  const planKeep = function(b){
    renderPlan();
    const same = [...$('plan-body').querySelectorAll('[data-action="' + b.dataset.action + '"]')].find(function(x){ return x.dataset.value === b.dataset.value; });
    if (same) same.focus({preventScroll:true});
  };
  /* Tire les plats de chaque date de la période : un jour après l'autre (équilibrés avec le reste de leur semaine), sans
     recette pour les plats simples ; en batch cooking (n recettes), tout d'un coup puis arrondi aux 100 g sur les boîtes */
  const drawPeriod = function(isos, type, n){
    const pr = cleanProfile(prof), save = function(iso, c){ const js = fromIso(iso).getDay(), x = cleanCh(c, js); writeDay(iso, {ch:x}); store.choices[js] = x; };
    if (type === 'recettes' && n){
      const cs = batchChoices(isos.map(function(iso){ const p = planFor(iso); return {libre:p.libre, long:p.seances.some(function(x){ return x.taille === 'longue'; })}; }), n, pr.off, scaleOf(pr), null, pr);
      /* La collation n'est pas tirée : elle reste celle de chaque date (3.29.0) */
      batchRound(isos.map(function(iso, j){ const js = fromIso(iso).getDay(); return {plan:planFor(iso), ch:cleanCh(keepSnack(cs[j], choicesFor(iso, js)), js)}; }), prof).forEach(function(c, j){ save(isos[j], c); });
    } else isos.forEach(function(iso){
      const c = drawFor(iso, type === 'recettes');
      if (type === 'simple') ['dej', 'diner'].forEach(function(sl){ ['recette', 'g', 'g2'].forEach(function(f){ delete c[sl][f]; }); });
      save(iso, c);
    });
    persist();
  };
  /* Actions de Planifier : l'ouvrir (menu), une planification, le formulaire, créer */
  Object.assign(ACTIONS, {
    plan: function(b){ if (topScreen() === 'plan') return; $('plan-msg').textContent = ''; renderPlan(); navTo('plan', b); },
    'pl-open': function(b, v){
      const q = String(v).split('|'), p = planifs.find(function(x){ return x.from === q[0] && x.to === q[1]; });
      if (p) openPlanif(p, b);
    },
    'pl-preset': function(b, v){
      const r = presetRange(v);
      planner.from = isoDate(r[0]); planner.to = isoDate(r[1]);
      planKeep(b);
    },
    'pl-type': function(b, v){ if (PL_TYPES.indexOf(v) >= 0){ planner.type = v; planKeep(b); } },
    'pl-batch': function(){ planner.batch = !planner.batch; renderPlan(); $('pl-batch').focus({preventScroll:true}); },
    'pl-nrec': function(b, v){ if (BATCH_N.indexOf(+v) >= 0){ planner.n = +v; planKeep(b); } },
    'pl-create': function(b){
      if (fillRange('plan', planner, 0, true)) return;
      const p = {from:planner.from, to:planner.to, type:planner.type, n:planner.type === 'recettes' && planner.batch ? planner.n : 0, checked:[]};
      drawPeriod(rangeDays(p.from, p.to), p.type, p.n);
      addPlanif(p);
      loadSel(); prevQty = new Map(); render();
      renderPlan();
      openPlanif(p, b);
    }
  });
