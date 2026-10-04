  /* Planifications (3.21.0) : clé repas-du-jour:planifs:v1, { list: [{ from, to, type, n, checked }] } : la période, le type
     de plats (simple : protéine et féculent ; recettes : une recette par repas, ou n recettes en batch cooking si n vaut 3, 4
     ou 5), les lignes de courses cochées (clé id|quantité, gardées tant que la quantité ne change pas). Au premier chargement,
     l'ancienne période des courses (repas-du-jour:courses:v1, laissée intacte) devient une planification, avec ses coches.
     Celles finies depuis plus de 21 jours sont effacées, comme les jours. */
  const QKEY = 'repas-du-jour:planifs:v1', SKEY = 'repas-du-jour:courses:v1', PL_TYPES = ['simple', 'recettes'];
  const cleanPlanif = function(o){
    if (!o || typeof o !== 'object' || !isoOk(o.from) || !isoOk(o.to) || o.to < o.from || rangeDays(o.from, o.to).length > MAX_DAYS) return null;
    const type = PL_TYPES.indexOf(o.type) >= 0 ? o.type : 'recettes';
    return {from:o.from, to:o.to, type:type, n:type === 'recettes' && BATCH_N.indexOf(o.n) >= 0 ? o.n : 0,
      checked:Array.isArray(o.checked) ? o.checked.filter(function(x){ return typeof x === 'string'; }).slice(0, 500) : []};
  };
  const byFrom = function(a, b){ return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; };
  /* Ancienne période des courses : recettes s'il y en a, batch cooking si des recettes qui se gardent reviennent */
  const guessKind = function(from, to){
    if (!isoOk(from) || !isoOk(to) || to < from) return {};
    const seen = {};
    let any = false;
    rangeDays(from, to).slice(0, BATCH_BLOCK).forEach(function(iso){
      const c = choicesFor(iso, fromIso(iso).getDay());
      ['dej', 'diner'].forEach(function(sl){ const r = recipeOf(c[sl]); if (r){ any = true; seen[r] = (seen[r] || 0) + 1; } });
    });
    const rep = Object.keys(seen).filter(function(r){ return seen[r] >= 2 && RECIPES[r].box; }).length;
    return {type:any ? 'recettes' : 'simple', n:rep};
  };
  let planifs = [];
  const saveQ = function(){ try { localStorage.setItem(QKEY, JSON.stringify({list:planifs})); } catch (e) {} };
  const purgePlanifs = function(){
    const n = planifs.length;
    planifs = planifs.filter(function(p){ return dayDiff(fromIso(p.to)) >= -21; });
    return planifs.length !== n;
  };
  try {
    const raw = localStorage.getItem(QKEY);
    if (raw !== null){
      const o = JSON.parse(raw);
      if (o && typeof o === 'object' && Array.isArray(o.list)) planifs = o.list.map(cleanPlanif).filter(Boolean).sort(byFrom);
      if (purgePlanifs()) saveQ();
    } else {
      const old = JSON.parse(localStorage.getItem(SKEY) || 'null');
      if (old && typeof old === 'object' && !Array.isArray(old)){
        const p = cleanPlanif(Object.assign({}, old, guessKind(old.from, old.to)));
        if (p) planifs.push(p);
        purgePlanifs();
        saveQ();
      }
    }
  } catch (e) {}
  const todayIso = function(){ return isoDate(today); };
  const planifOf = function(iso){ return planifs.find(function(p){ return p.from <= iso && p.to >= iso; }) || null; };
  /* Une nouvelle planification remplace les jours qu'elle couvre : une autre qui la chevauche garde ses jours d'avant et
     d'après (deux morceaux au plus) */
  const addPlanif = function(p){
    const out = [];
    planifs.forEach(function(q){
      if (q.to < p.from || q.from > p.to){ out.push(q); return; }
      if (q.from < p.from) out.push(Object.assign({}, q, {to:isoDate(addDays(fromIso(p.from), -1)), checked:q.checked.slice()}));
      if (q.to > p.to) out.push(Object.assign({}, q, {from:isoDate(addDays(fromIso(p.to), 1)), checked:q.checked.slice()}));
    });
    out.push(p);
    planifs = out.sort(byFrom);
    saveQ();
  };
  /* « Du 7 au 13 octobre », « Du 28 septembre au 4 octobre », « Mercredi 7 octobre » */
  const periodTitle = function(from, to){
    const a = fromIso(from), b = fromIso(to), month = function(d){ return d.toLocaleDateString('fr-FR', {month:'long'}); };
    if (from === to) return cap(dayLabel(a));
    const one = function(d){ return d.getDate() === 1 ? '1er' : String(d.getDate()); };
    return 'Du ' + one(a) + (a.getMonth() !== b.getMonth() ? NB + month(a) : '') + ' au ' + one(b) + NB + month(b);
  };
  /* « 7 jours, plats simples », « … une recette par repas », « … batch cooking de 4 recettes » */
  const planifLine = function(p){
    const n = rangeDays(p.from, p.to).length;
    return n + NB + 'jour' + (n > 1 ? 's' : '') + ', ' + (p.type === 'simple' ? 'plats simples' : p.n ? 'batch cooking de ' + p.n + NB + 'recettes' : 'une recette par repas');
  };

  /* Détail d'une planification (écran #courses) : le récap jour par jour, son batch cooking, ses courses par rayon */
  let cur = null;
  const renderCourses = function(){
    if (!cur) return;
    const days = rangeDays(cur.from, cur.to), res = days.map(dayResult), t = todayIso();
    $('courses-h').textContent = periodTitle(cur.from, cur.to);
    $('courses-span').textContent = cap(planifLine(cur)) + (cur.from <= t && cur.to >= t ? ', en cours.' : cur.from > t ? ', à venir.' : ', passée.');
    $('courses-msg').textContent = '';
    $('courses-batch').innerHTML = batchHTML(days, res);
    $('courses-list').innerHTML = shoppingList(res).map(function(g, j){
      return '<h3 class="shop-a" id="shop-' + j + '">' + g.title + '</h3><ul class="shop" aria-labelledby="shop-' + j + '">' + g.lines.map(function(l){
        const key = l.id + '|' + l.qty;
        return '<li><button type="button" class="chk" role="checkbox" aria-checked="' + (cur.checked.indexOf(key) >= 0) + '" data-action="co-check" data-value="' + key + '">' +
          '<span class="box" aria-hidden="true"></span><span class="q">' + l.qty + '</span><span class="name">' + l.name + (l.note ? '<span class="note">' + l.note + '</span>' : '') + '</span></button></li>';
      }).join('') + '</ul>';
    }).join('');
    const low = function(x){ return x.charAt(0).toLowerCase() + x.slice(1); };
    /* Un repas : sa recette, sinon sa protéine et son féculent */
    const meal = function(c){ const r = recipeOf(c); return r ? RECIPES[r].t : low(PROT[c.prot].label) + ' et ' + low(STARCH[c.starch].label); };
    $('courses-days').innerHTML = days.map(function(iso, j){
      const d = fromIso(iso), p = planFor(iso), c = choicesFor(iso, d.getDay()), r = res[j];
      const what = [p.seances.length ? p.seances.length + NB + 'séance' + (p.seances.length > 1 ? 's' : '') : 'repos', 'midi' + NB + ': ' + low(meal(c.dej)), r.libre ? 'repas libre le soir' : 'soir' + NB + ': ' + low(meal(c.diner))];
      return '<li><button type="button" class="shop-day" data-action="co-day" data-value="' + iso + '"><span class="d">' + cap(dayLabel(d)) + '</span>' +
        '<span class="k">' + r10(r.tot.kcal) + NB + 'kcal</span><span class="note">' + cap(what.join(', ')) + '.</span></button></li>';
    }).join('');
  };
  const openPlanif = function(p, opener){ cur = p; renderCourses(); openScreen('courses', opener); };
  /* Batch cooking d'une planification : pour chaque bloc de 7 jours, le jour où cuisiner, puis une fiche repliée par recette
     servie au moins deux fois (« Changer de recette », puis batchBody) */
  const SLOT = {dej:'midi', diner:'soir'};
  const SHARE = {2:'la moitié', 3:'un tiers', 4:'un quart'};
  const cookText = function(cook, nb, ng, what){
    return 'À cuisiner <strong>' + dayRel(cook) + '</strong>' + NB + ': ' + what + nb + NB + 'boîte' + (nb > 1 ? 's' : '') + '.' +
      (ng ? ' Un plat cuisiné se garde 3' + NB + 'jours au frigo' + NB + ': mets ' + (ng > 1 ? 'les ' + ng + ' boîtes marquées' : 'la boîte marquée') + ' «' + NB + 'congélateur' + NB + '» au congélateur et sors-' + (ng > 1 ? 'les' : 'la') + ' la veille au soir.' : '');
  };
  /* Fiche d'une recette du batch (planification et page du batch, 3.21.0) : ce qu'il faut cuire en tout, les boîtes (isos :
     les dates des jours, que bx.day désigne), les aromates, la préparation */
  const batchBody = function(r, isos){
    const x = RECIPES[r.id], n = r.boxes.length;
    const li = function(q, name, note){ return '<li><span class="b-q">' + q + '</span><span class="name">' + name + (note ? '<span class="note">' + note + '</span>' : '') + '</span></li>'; };
    return '<h3 class="rec-h">À cuire en tout</h3><ul class="b-list">' + r.totals.map(function(t){ return li(t.qty, t.name, t.note); }).join('') + '</ul>' +
      '<h3 class="rec-h">Les boîtes</h3><ul class="b-list">' + r.boxes.map(function(bx){
        const d = fromIso(isos[bx.day]);
        return li(cap(d.toLocaleDateString('fr-FR', {weekday:'short'})) + ' ' + d.getDate() + ', ' + SLOT[bx.slot],
          bx.parts.map(function(pt){ return pt.qty + ' ' + pt.name + (pt.cooked ? ' (' + pt.cooked + ')' : ''); }).join(', ') + ', ' + (SHARE[n] || '1 part sur ' + n) + ' des légumes et de la sauce',
          bx.fridge ? 'frigo' : 'congélateur' + (r.gel ? '' : ', mais elle se congèle mal' + NB + ': prépare-la plutôt la veille'));
      }).join('') + '</ul>' +
      '<h3 class="rec-h">Aromates, sans compter</h3><p class="rec-aro">' + cap(x.aro) + '.</p>' +
      '<h3 class="rec-h">Préparation</h3><ol class="rec-steps">' + x.steps.map(function(z){ return '<li>' + z + '</li>'; }).join('') + '</ol>';
  };
  const batchHTML = function(days, res){
    const lead = dayDiff(fromIso(days[0])) <= 0 ? 0 : 1;
    const blocks = batchCook(res.map(function(r){ return {res:r}; }), lead);
    if (!blocks.length) return '';
    const pr = cleanProfile(prof);
    return '<h2 class="shop-t" id="batch-h">Ton batch cooking</h2>' + blocks.map(function(bl){
      const start = fromIso(days[bl.start]), cook = bl.start === 0 && lead === 0 ? start : addDays(start, -1);
      const nb = bl.recipes.reduce(function(a, r){ return a + r.boxes.length; }, 0);
      const ng = bl.recipes.reduce(function(a, r){ return a + r.boxes.filter(function(x){ return !x.fridge; }).length; }, 0);
      return '<p class="calc">' + cookText(cook, nb, ng, bl.recipes.length + ' recettes, ') + '</p>' +
        bl.recipes.map(function(r){
          const g = r.boxes.filter(function(x){ return !x.fridge; }).length, n = r.boxes.length;
          const swap = batchSwapOptions(swapBlock(bl.start, days).days, r.id, pr.off, scaleOf(pr)).length;
          return '<details class="batch"><summary><span class="b-s"><span class="b-t">' + r.t + '</span><span class="b-n">' + n + NB + 'boîtes' +
            (g ? ', dont ' + g + ' au congélateur' : '') + '</span></span></summary><div class="b-body">' +
            (swap ? '<button type="button" class="btn b-swap" id="swap-' + bl.start + '-' + r.id + '" data-action="co-swap" data-value="' + bl.start + '|' + r.id + '">Changer de recette</button>'
              : '<p class="calc">Aucune autre recette ne va avec ta semaine.</p>') + batchBody(r, days) + '</div></details>';
        }).join('');
    }).join('');
  };
  /* Page du batch (3.21.0, écran #batch, bouton « Batch cooking » d'une recette de la journée) : seulement cette recette, le
     jour où la cuisiner, puis sa fiche ; x vient de batchFor (ui/page.js) */
  const renderBatchPage = function(x){
    const r = x.r, ng = r.boxes.filter(function(b){ return !b.fridge; }).length, start = fromIso(x.isos[0]);
    $('batchp-h').textContent = r.t;
    $('batch-body').innerHTML = '<p class="calc">' + cookText(x.lead === 0 ? start : addDays(start, -1), r.boxes.length, ng, '') + '</p>' + batchBody(r, x.isos);
  };
  /* Changer une recette du batch cooking (3.16.0) : les jours de son bloc (7 jours à partir de start dans la planification),
     avec leurs plats et leur repas libre */
  const swapBlock = function(start, days){
    const isos = (days || rangeDays(cur.from, cur.to)).slice(start, start + BATCH_BLOCK);
    return {isos:isos, days:isos.map(function(iso){ return {ch:choicesFor(iso, fromIso(iso).getDay()), libre:planFor(iso).libre}; })};
  };
  /* Panneau du bas : « Une autre au hasard », puis les recettes qui vont (même protéine d'abord) */
  const openSwap = function(start, id, trigger){
    const pr = cleanProfile(prof), opts = has(RECIPES, id) ? batchSwapOptions(swapBlock(start).days, id, pr.off, scaleOf(pr)) : [];
    if (!opts.length) return;
    const same = opts.filter(function(x){ return RECIPES[x].p === RECIPES[id].p; }), other = opts.filter(function(x){ return RECIPES[x].p !== RECIPES[id].p; });
    const opt = function(v, t, s){ return '<button type="button" class="opt" data-action="co-swap-to" data-value="' + v + '">' + t + '<span class="opt-s">' + s + '</span></button>'; };
    const list = function(a){ return a.map(function(x){ return opt(x, RECIPES[x].t, RECIPES[x].min + NB + 'min'); }).join(''); };
    pick = {kind:'swap', start:start, id:id, trigger:trigger && trigger.id ? trigger.id : null, view:VIEWS.find(function(v){ return !$(v).hidden; }) || 'courses'};
    $('sheet-t').textContent = 'Remplacer «' + NB + RECIPES[id].t + NB + '»';
    $('sheet-rec').hidden = true;
    $('sheet-list').hidden = false;
    $('sheet-list').className = 'opts-list swap';
    $('sheet-list').innerHTML = opt('*', 'Une autre au hasard', 'parmi celles qui vont avec ta semaine') +
      (same.length ? '<p class="rf-l">Avec la même protéine</p>' + list(same) : '') +
      (other.length ? '<p class="rf-l">' + (same.length ? 'Avec une autre protéine' : 'Recettes possibles') + '</p>' + list(other) : '');
    try { history.pushState({pick:true}, ''); } catch (e) {}
    $('sheet').hidden = false;
    $('sheet').querySelector('.panel').scrollTop = 0;
    setInert(pick.view, true);
    document.documentElement.style.overflow = 'hidden';
    $('sheet-list').querySelector('.opt').focus({preventScroll:true});
  };
  /* Actions du détail d'une planification : cocher une ligne, tout décocher, ouvrir un jour, changer une recette du batch */
  Object.assign(ACTIONS, {
    'co-check': function(b, v){
      if (!cur) return;
      const k = cur.checked.indexOf(v);
      if (k >= 0) cur.checked.splice(k, 1); else if (cur.checked.length < 500) cur.checked.push(v);
      saveQ();
      b.setAttribute('aria-checked', String(k < 0));
    },
    'co-uncheck': function(){ if (!cur) return; cur.checked = []; saveQ(); renderCourses(); },
    'co-day': function(b, v){
      const d = fromIso(v);
      if (!d) return;
      closeAllScreens();
      selDate = d; loadSel(); prevQty = new Map();
      render();
      scroller().scrollTop = 0;
      $('title').focus({preventScroll:true});
    },
    'co-swap': function(b, v){
      const p = String(v).split('|');
      if (!/^\d+$/.test(p[0])) return;
      openSwap(+p[0], p[1], b);
    },
    /* La recette choisie (ou tirée) remplace l'ancienne dans tous ses repas du bloc ; la fiche s'ouvre sur elle */
    'co-swap-to': function(b, v){
      if (!pick || pick.kind !== 'swap') return;
      const s = pick, pr = cleanProfile(prof), k = scaleOf(pr), blk = swapBlock(s.start);
      const opts = batchSwapOptions(blk.days, s.id, pr.off, k), nid = v === '*' ? batchSwapPick(blk.days, s.id, pr.off, k) : v;
      closePick(false);
      if (!nid || opts.indexOf(nid) < 0) return;
      /* La nouvelle recette, arrondie aux 100 g sur ses boîtes (les autres gardent leurs poids) */
      const next = batchRound(batchSwap(blk.days, s.id, nid, pr.off).map(function(c, j){ return {plan:planFor(blk.isos[j]), ch:c}; }), prof);
      let n = 0;
      blk.isos.forEach(function(iso, j){
        const d = blk.days[j];
        n += ['dej', 'diner'].filter(function(sl){ return d.ch[sl].recette === s.id && !(sl === 'diner' && d.libre); }).length;
        if (JSON.stringify(next[j]) === JSON.stringify(d.ch)) return;
        const js = fromIso(iso).getDay(), c = cleanCh(next[j], js);
        writeDay(iso, {ch:c});
        store.choices[js] = c;
      });
      persist();
      loadSel(); prevQty = new Map(); render();
      renderCourses();
      $('courses-msg').textContent = '«' + NB + RECIPES[nid].t + NB + '» remplace «' + NB + RECIPES[s.id].t + NB + '» dans tes ' + n + NB + 'boîtes.';
      const again = $('swap-' + s.start + '-' + nid);
      if (again){ again.closest('details').open = true; again.focus({preventScroll:true}); }
    }
  });
