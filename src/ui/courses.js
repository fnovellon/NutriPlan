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
  const renderCourses = function(keepInputs){
    if (!keepInputs && (!isoOk(shop.from) || !isoOk(shop.to) || dayDiff(fromIso(shop.to)) < 0)){ shop.from = isoDate(today); shop.to = isoDate(addDays(today, 6)); }
    const err = fillRange('courses', shop, -21, keepInputs);
    $('courses-msg').textContent = '';
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
    const pr = cleanProfile(prof);
    const li = function(q, name, note){ return '<li><span class="b-q">' + q + '</span><span class="name">' + name + (note ? '<span class="note">' + note + '</span>' : '') + '</span></li>'; };
    return '<h2 class="shop-t" id="batch-h">Ton batch cooking</h2>' + blocks.map(function(bl){
      const start = fromIso(days[bl.start]), cook = bl.start === 0 && lead === 0 ? start : addDays(start, -1);
      const nb = bl.recipes.reduce(function(a, r){ return a + r.boxes.length; }, 0);
      const ng = bl.recipes.reduce(function(a, r){ return a + r.boxes.filter(function(x){ return !x.fridge; }).length; }, 0);
      return '<p class="calc">À cuisiner <strong>' + dayRel(cook) + '</strong>' + NB + ': ' + bl.recipes.length + ' recettes, ' + nb + ' boîtes.' +
        (ng ? ' Un plat cuisiné se garde 3' + NB + 'jours au frigo' + NB + ': mets ' + (ng > 1 ? 'les ' + ng + ' boîtes marquées' : 'la boîte marquée') + ' «' + NB + 'congélateur' + NB + '» au congélateur et sors-' + (ng > 1 ? 'les' : 'la') + ' la veille au soir.' : '') + '</p>' +
        bl.recipes.map(function(r){
          const g = r.boxes.filter(function(x){ return !x.fridge; }).length, n = r.boxes.length, x = RECIPES[r.id];
          const swap = batchSwapOptions(swapBlock(bl.start, days).days, r.id, pr.off, scaleOf(pr)).length;
          return '<details class="batch"><summary><span class="b-s"><span class="b-t">' + r.t + '</span><span class="b-n">' + n + NB + 'boîtes' +
            (g ? ', dont ' + g + ' au congélateur' : '') + '</span></span></summary><div class="b-body">' +
            (swap ? '<button type="button" class="btn b-swap" id="swap-' + bl.start + '-' + r.id + '" data-action="co-swap" data-value="' + bl.start + '|' + r.id + '">Changer de recette</button>'
              : '<p class="calc">Aucune autre recette ne va avec ta semaine.</p>') +
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
  /* Actions des courses : ouvrir, cocher une ligne, tout décocher, ouvrir un jour */
  /* Changer une recette du batch cooking (3.16.0) : les jours de son bloc (7 jours à partir de start dans la période des
     courses), avec leurs plats et leur repas libre */
  const swapBlock = function(start, days){
    const isos = (days || rangeDays(shop.from, shop.to)).slice(start, start + BATCH_BLOCK);
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
    $('sheet-list').classList.add('swap');
    $('sheet-list').innerHTML = opt('*', 'Une autre au hasard', 'parmi celles qui vont avec ta semaine') +
      (same.length ? '<p class="rf-l">Avec la même protéine</p>' + list(same) : '') +
      (other.length ? '<p class="rf-l">' + (same.length ? 'Avec une autre protéine' : 'Recettes possibles') + '</p>' + list(other) : '');
    try { history.pushState({pick:true}, ''); } catch (e) {}
    $('sheet').hidden = false;
    $('sheet').querySelector('.panel').scrollTop = 0;
    $(pick.view).setAttribute('inert', '');
    document.documentElement.style.overflow = 'hidden';
    $('sheet-list').querySelector('.opt').focus({preventScroll:true});
  };
  Object.assign(ACTIONS, {
    courses: function(b){ renderCourses(false); openScreen('courses', b); },
    'co-check': function(b, v){
      const k = shop.checked.indexOf(v);
      if (k >= 0) shop.checked.splice(k, 1); else shop.checked.push(v);
      saveShop();
      b.setAttribute('aria-checked', String(k < 0));
    },
    'co-uncheck': function(){ shop.checked = []; saveShop(); renderCourses(true); },
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
      const next = batchSwap(blk.days, s.id, nid, pr.off);
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
      renderCourses(true);
      $('courses-msg').textContent = '«' + NB + RECIPES[nid].t + NB + '» remplace «' + NB + RECIPES[s.id].t + NB + '» dans tes ' + n + NB + 'boîtes.';
      const again = $('swap-' + s.start + '-' + nid);
      if (again){ again.closest('details').open = true; again.focus({preventScroll:true}); }
    }
  });
