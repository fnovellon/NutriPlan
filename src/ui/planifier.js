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
  /* Actions de l'assistant : jours, étapes, hasard pour ce jour ou pour tous les jours restants, batch cooking. Seulement
     pendant l'assistant, à la bonne étape (voir ui/actions.js) */
  Object.assign(ACTIONS, {
    plan: function(b){
      if (topScreen() === 'plan') return;
      planner = {i:-1, from:isoDate(today), to:isoDate(addDays(today, 6)), back:selDate, msg:'', n:4};
      renderPlan();
      navTo('plan', b);
    },
    'pl-preset': function(b, v){
      const r = presetRange(v);
      planner.from = isoDate(r[0]); planner.to = isoDate(r[1]);
      renderPlan();
    },
    'pl-start': function(){ if (!fillRange('plan', planner, 0, true)) planGo(0); },
    /* Batch cooking : nombre de recettes, puis tous les plats de la période tirés d'un coup, et les courses */
    'pl-nrec': function(b, v){
      if (BATCH_N.indexOf(+v) < 0) return;
      planner.n = +v; renderPlan();
      $('plan-body').querySelector('[data-action="pl-nrec"][data-value="' + v + '"]').focus({preventScroll:true});
    },
    'pl-batch': function(){
      if (fillRange('plan', planner, 0, true)) return;
      const isos = rangeDays(planner.from, planner.to), pr = cleanProfile(prof);
      const cs = batchChoices(isos.map(function(iso){ const p = planFor(iso); return {libre:p.libre, long:p.seances.some(function(x){ return x.taille === 'longue'; })}; }), planner.n, pr.off, scaleOf(pr));
      /* Chiffres ronds : protéine de chaque recette arrondie aux 100 g sur ses boîtes */
      const rounded = batchRound(isos.map(function(iso, j){ return {plan:planFor(iso), ch:cleanCh(cs[j], fromIso(iso).getDay())}; }), prof);
      isos.forEach(function(iso, j){
        const js = fromIso(iso).getDay(), c = cleanCh(rounded[j], js);
        writeDay(iso, {ch:c});
        store.choices[js] = c;
      });
      persist();
      finishPlan();
    },
    'pl-prev': function(){ planGo(planner.i - 1); },
    'pl-next': function(){
      if (planner.i < rangeDays(planner.from, planner.to).length - 1) planGo(planner.i + 1); else finishPlan();
    },
    'pl-hasard': function(){
      ch = cleanCh(drawFor(selIso()), sel); saveCh();
      planner.msg = 'Plats tirés au hasard' + NB + ': touche un plat pour le changer.';
      return '';
    },
    'pl-hasard-tous': function(){
      rangeDays(planner.from, planner.to).slice(planner.i).forEach(function(iso){
        const js = fromIso(iso).getDay(), c = cleanCh(drawFor(iso), js);
        writeDay(iso, {ch:c});
        store.choices[js] = c;
      });
      persist();
      finishPlan();
    }
  });
