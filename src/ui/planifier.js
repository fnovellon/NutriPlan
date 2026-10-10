  /* Planifier (3.21.0) : la planification en cours en évidence, les autres (à venir, puis passées), puis « Nouvelle
     planification » : la période, les plats (simples ou en recettes, avec l'option batch cooking et son nombre de recettes).
     Créer tire les plats de toute la période d'un coup (enregistrés pour chaque date), garde la planification et ouvre son
     détail (ui/courses.js). Plus d'assistant jour par jour : chaque jour se change depuis la journée. */
  const planner = {from:'', to:'', type:'recettes', batch:false, n:4, env:{plus:[], moins:[]}, envOpen:false};
  const resetPlanner = function(){
    planner.from = isoDate(today); planner.to = isoDate(addDays(today, 6)); planner.type = 'recettes'; planner.batch = false; planner.n = 4;
    planner.env = {plus:[], moins:[]}; planner.envOpen = false;
  };
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
      envHTML() +
      '<p class="calc">' + PL_TEXT[recettes ? (planner.batch ? 'batch' : 'recettes') : 'simple'] + ' Les plats suivent tes aliments proposés, tes envies et l’équilibre de la semaine.' +
        (Object.keys(semOf().jours).length ? ' Les jours gardent leurs séances, celles de ta semaine type s’ils ne sont pas encore remplis.' : '') + '</p>' +
      '<p class="warn" id="plan-over"></p>' +
      '<button type="button" class="btn main wide" data-action="pl-create">Créer la planification</button>';
    fillRange('plan', planner, 0, false);
    $('plan-over').textContent = planOver();
  };
  /* Tes envies pour cette période (3.30.0) : une bulle par protéine et par féculent proposés, à trois états (neutre, « Je
     veux », « Pas cette fois »), et une phrase qui les résume */
  const ENV_STATE = {plus:'Je veux', moins:'Pas cette fois'};
  const envState = function(x){ return planner.env.plus.indexOf(x) >= 0 ? 'plus' : planner.env.moins.indexOf(x) >= 0 ? 'moins' : ''; };
  const envLabel = function(x){ const k = x.slice(0, x.indexOf(':')), id = x.slice(k.length + 1); return (k === 'prot' ? PROT : STARCH)[id].label; };
  const envSummary = function(env){
    const low = function(a){ return a.map(function(x){ return envLabel(x).toLowerCase(); }).join(', '); };
    return (env.plus.length ? 'Au moins 2' + NB + 'fois par semaine' + NB + ': ' + low(env.plus) + '.' : '') + (env.plus.length && env.moins.length ? ' ' : '') +
      (env.moins.length ? 'Pas cette fois' + NB + ': ' + low(env.moins) + '.' : '');
  };
  const envHTML = function(){
    const off = cleanProfile(prof).off;
    const group = function(kind, title, order){
      return '<p class="rf-l">' + title + '</p><div class="opts-list" role="group" aria-label="' + title + '">' + allowed(kind, off).map(function(id){
        const x = kind + ':' + id, st = envState(x), lab = (kind === 'prot' ? PROT : STARCH)[id].label;
        return '<button type="button" class="opt env' + (st ? ' env-' + st : '') + '" data-action="pl-env" data-value="' + x + '" aria-label="' + lab + (st ? NB + ': ' + ENV_STATE[st].toLowerCase() : '') + '">' +
          lab + (st ? '<span class="opt-s">' + ENV_STATE[st] + '</span>' : '') + '</button>';
      }).join('') + '</div>';
    };
    const sum = envSummary(planner.env);
    return '<details class="pl-env" id="pl-env"' + (planner.envOpen || sum ? ' open' : '') + '><summary>Tes envies pour cette période</summary>' +
      '<p class="calc">Touche un aliment une fois pour «' + NB + 'Je veux' + NB + '» (au moins 2' + NB + 'fois par semaine), deux fois pour «' + NB + 'Pas cette fois' + NB + '».</p>' +
      group('prot', 'Protéines') + group('starch', 'Féculents') +
      '<p class="calc" id="pl-env-sum" role="status">' + (sum || 'Pas d’envie particulière' + NB + ': tout est possible.') + '</p><p class="warn" id="pl-env-warn" role="alert"></p></details>';
  };
  /* Le bloc des envies ouvert ou fermé reste comme tu l'as laissé tant que le formulaire est redessiné */
  document.addEventListener('toggle', function(e){ if (e.target && e.target.id === 'pl-env') planner.envOpen = e.target.open; }, true);
  /* Après un réglage du formulaire : redessiné, le focus reste sur le bouton touché */
  const planKeep = function(b){
    renderPlan();
    const same = [...$('plan-body').querySelectorAll('[data-action="' + b.dataset.action + '"]')].find(function(x){ return x.dataset.value === b.dataset.value; });
    if (same) same.focus({preventScroll:true});
  };
  /* Tire les plats de chaque date de la période : un jour après l'autre (équilibrés avec le reste de leur semaine), sans
     recette pour les plats simples ; en batch cooking (n recettes), tout d'un coup puis arrondi aux 100 g sur les boîtes.
     Envies (3.30.0) : refus retirés des aliments proposés, envies imposées (envPlan) ou servies par une recette du batch.
     Renvoie les envies qui n'ont pas pu revenir assez souvent (envShort). */
  const drawPeriod = function(isos, type, n, env){
    const pr = cleanProfile(prof), save = function(iso, c){ const js = fromIso(iso).getDay(), x = cleanCh(c, js); writeDay(iso, {ch:x}); store.choices[js] = x; };
    const e = env ? cleanEnv(env) : null, off = envOff(pr.off, e), wants = envWants(e, off);
    const days = isos.map(function(iso){ const p = planFor(iso); return {libre:p.libre, long:p.seances.some(function(x){ return x.taille === 'longue'; })}; });
    if (type === 'recettes' && n){
      const cs = batchChoices(days, n, off, scaleOf(pr), null, pr, wants);
      /* La collation n'est pas tirée : elle reste celle de chaque date (3.29.0) */
      batchRound(isos.map(function(iso, j){ const js = fromIso(iso).getDay(); return {plan:planFor(iso), ch:cleanCh(keepSnack(cs[j], choicesFor(iso, js)), js)}; }), prof).forEach(function(c, j){ save(isos[j], c); });
    } else {
      const force = envPlan(days, wants);
      isos.forEach(function(iso, j){
        const c = drawFor(iso, type === 'recettes', e, force[j]);
        if (type === 'simple') ['dej', 'diner'].forEach(function(sl){ ['recette', 'g', 'g2'].forEach(function(f){ delete c[sl][f]; }); });
        save(iso, c);
      });
    }
    persist();
    return envShort(isos.map(function(iso){ return choicesFor(iso, fromIso(iso).getDay()); }), days, wants);
  };
  /* Les envies qui n'ont pas pu revenir assez souvent, en une phrase (vide sinon) */
  const shortMsg = function(short){
    if (!short.length) return '';
    return 'Je n’ai pas pu mettre assez souvent ' + short.map(function(w){ return (w.kind === 'prot' ? PROT : STARCH)[w.id].label.toLowerCase(); }).join(', ') +
      ' (tes aliments, la semaine ou le batch cooking ne le permettent pas)' + NB + ': change un repas dans le récap si tu veux.';
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
    /* Une envie : neutre → je veux → pas cette fois → neutre ; un refus qui retirerait tout un type est refusé */
    'pl-env': function(b, v){
      const e = cleanEnv({plus:[v]});
      if (!e.plus.length) return;
      const st = envState(v), env = {plus:planner.env.plus.filter(function(x){ return x !== v; }), moins:planner.env.moins.filter(function(x){ return x !== v; })};
      let warn = '';
      if (st === '') env.plus.push(v);
      else if (st === 'plus'){
        const k = v.slice(0, v.indexOf(':'));
        if (envOff(cleanProfile(prof).off, {plus:[], moins:env.moins.concat([v])}).indexOf(v) >= 0) env.moins.push(v);
        else warn = k === 'prot' ? 'Garde au moins une protéine.' : 'Garde au moins un féculent.';
      }
      planner.env = env; planner.envOpen = true;
      planKeep(b);
      $('pl-env-warn').textContent = warn;
    },
    'pl-create': function(b){
      if (fillRange('plan', planner, 0, true)) return;
      const p = {from:planner.from, to:planner.to, type:planner.type, n:planner.type === 'recettes' && planner.batch ? planner.n : 0, checked:[]};
      if (!envEmpty(planner.env)) p.env = cleanEnv(planner.env);
      const short = drawPeriod(rangeDays(p.from, p.to), p.type, p.n, p.env);
      addPlanif(p);
      loadSel(); prevQty = new Map(); render();
      renderPlan();
      openPlanif(p, b);
      $('courses-msg').textContent = shortMsg(short);
    }
  });
