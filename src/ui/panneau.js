  /* Panneau de choix d'un plat (aussi pour les séances de la page, voir openSess) : fond grisé, page et menu inertes ; se
     ferme par un choix, le fond, Échap ou le bouton retour */
  let pick = null;
  /* ctx « repas » : le choix va dans le brouillon du formulaire (action rf), sinon il est enregistré tout de suite */
  const openPick = function(kind, slot, ctx, trigger){
    const c = ctx === 'repas' ? draft : ch;
    if (!c) return;
    const P = pickDef(kind, slot, c);
    pick = {kind:kind, slot:slot, trigger:trigger && trigger.id ? trigger.id : null, view:VIEWS.find(function(v){ return !$(v).hidden; }) || 'page'};
    $('sheet-t').textContent = P.title;
    $('sheet-list').hidden = false;
    $('sheet-list').className = 'opts-list';
    $('sheet-rec').hidden = true;
    $('sheet-list').innerHTML = P.opts.map(function(o){
      return '<button type="button" class="opt" data-action="' + (ctx === 'repas' ? 'rf' : P.action) + '" data-kind="' + kind + '"' + (slot ? ' data-slot="' + slot + '"' : '') +
        ' data-value="' + o[0] + '" aria-pressed="' + (o[0] === P.current) + '">' + o[1] + (o[2] ? '<span class="opt-s">' + o[2] + '</span>' : '') + '</button>';
    }).join('');
    try { history.pushState({pick:true}, ''); } catch (e) {}
    $('sheet').hidden = false;
    setInert(pick.view, true);
    document.documentElement.style.overflow = 'hidden';
    const on = $('sheet-list').querySelector('[aria-pressed="true"]');
    if (on) on.focus({preventScroll:true});
  };
  /* Fiche d'une recette (même panneau) : tes quantités pour ce repas avec la recette (sec : la section de buildDay), le
     total, les aromates, les étapes ; meta, titre des quantités, note et bas (boutons) selon d'où elle s'ouvre (la page, la
     bibliothèque des recettes) ; p : le panneau ouvert (pick) */
  const showRecipe = function(id, sec, meta, head, note, foot, p){
    const x = RECIPES[id], items = recipePart(sec), none = new Map();
    pick = p;
    $('sheet-t').textContent = x.t;
    $('sheet-list').hidden = true;
    $('sheet-rec').hidden = false;
    $('sheet-rec').innerHTML = '<p class="rec-meta">' + x.min + NB + 'min' + (x.box ? ', se garde (à emporter)' : '') + '.' + meta + '</p>' + prefBtns(id) +
      '<h3 class="rec-h">' + head + '</h3>' +
      '<ul class="items">' + items.map(function(i){ return itemHTML('rec', i, none); }).join('') + '</ul>' +
      '<p class="rec-tot">En tout' + NB + ':' + macHTML(total(items)) + '</p>' + note +
      '<h3 class="rec-h">Aromates, sans compter</h3><p class="rec-aro">' + cap(x.aro) + '.</p>' +
      '<h3 class="rec-h">Préparation</h3><ol class="rec-steps">' + x.steps.map(function(z){ return '<li>' + z + '</li>'; }).join('') + '</ol>' + foot;
    try { history.pushState({pick:true}, ''); } catch (e) {}
    $('sheet').hidden = false;
    $('sheet').querySelector('.panel').scrollTop = 0;
    setInert(pick.view, true);
    document.documentElement.style.overflow = 'hidden';
    ($('sheet-rec').querySelector('.btn') || $('sheet').querySelector('.sheet-x')).focus({preventScroll:true});
  };
  /* Depuis la page : « Choisir cette recette » ou « Retirer la recette » */
  const openRecipe = function(slot, trigger){
    const cur = recipeOf(ch[slot]), id = cur || recipesFor(ch[slot].prot, ch[slot].starch)[0];
    if (!id) return;
    const x = RECIPES[id], on = cur === id, withRec = cleanCh(ch, sel), meal = slot === 'dej' ? 'déjeuner' : 'dîner';
    withRec[slot].recette = id;
    const sec = buildDay(planForMeal(plan, slot), withRec, prof).secs.find(function(z){ return z.id === slot; });
    showRecipe(id, sec, on ? ' Choisie pour ce ' + meal + '.' : '', 'Pour ce ' + meal,
      on ? '' : '<p class="rec-tot">Le féculent s’ajuste à la recette' + NB + ': ta journée garde le même total.</p>',
      on ? '<button type="button" class="btn wide" data-action="rec-off" data-slot="' + slot + '">Retirer la recette</button>'
        : '<button type="button" class="btn main wide" data-action="rec-on" data-slot="' + slot + '">Choisir cette recette</button>',
      {kind:'recette', slot:slot, trigger:trigger && trigger.id ? trigger.id : null, back:'ft-' + slot, view:VIEWS.find(function(v){ return !$(v).hidden; }) || 'page'});
  };
  /* Recette favorite ou à éviter (3.25.0), dans sa fiche : l'une ou l'autre, enregistrée dans le profil (fav, ban) ; la page
     (suggestions), la bibliothèque et les réglages suivent, le panneau reste ouvert */
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 20.5s-7.4-4.4-9.3-8.9C1.3 8.2 3.3 4.5 6.9 4.5c2.1 0 3.4 1.1 5.1 3 1.7-1.9 3-3 5.1-3 3.6 0 5.6 3.7 4.2 7.1-1.9 4.5-9.3 8.9-9.3 8.9z"/></svg>';
  const PREF_TEXT = {fav:'Elle revient deux fois plus souvent quand l’appli tire tes plats.', ban:'L’appli ne la tire plus et ne la propose plus sous tes repas. Tu peux toujours la choisir.'};
  const prefOf = function(id){ const pr = cleanProfile(prof); return pr.fav.indexOf(id) >= 0 ? 'fav' : pr.ban.indexOf(id) >= 0 ? 'ban' : ''; };
  const prefBtns = function(id){
    const k = prefOf(id);
    return '<div class="opts-list rec-pref" role="group" aria-label="Cette recette dans les tirages">' +
      '<button type="button" class="opt" id="rp-fav" data-action="rec-pref" data-pref="fav" data-value="' + id + '" aria-pressed="' + (k === 'fav') + '">' + HEART + 'Favorite</button>' +
      '<button type="button" class="opt" id="rp-ban" data-action="rec-pref" data-pref="ban" data-value="' + id + '" aria-pressed="' + (k === 'ban') + '">À éviter</button></div>' +
      '<p class="rec-pref-s" id="rp-s" role="status">' + (k ? PREF_TEXT[k] : '') + '</p>';
  };
  /* k : fav ou ban ; on : la mettre (sinon l'enlever) ; elle quitte toujours l'autre liste */
  const setPref = function(id, k, on){
    const pr = cleanProfile(prof);
    ['fav', 'ban'].forEach(function(f){
      const l = pr[f].filter(function(x){ return x !== id; });
      if (f === k && on) l.push(id);
      if (l.length) prof[f] = l; else delete prof[f];
    });
    saveProf();
    render(); renderLib(); renderPrefs();
  };
  Object.assign(ACTIONS, {
    'rec-pref': function(b, v){
      const k = b.dataset.pref;
      if (!has(RECIPES, v) || (k !== 'fav' && k !== 'ban')) return;
      setPref(v, k, prefOf(v) !== k);
      const now = prefOf(v);
      $('rp-fav').setAttribute('aria-pressed', String(now === 'fav'));
      $('rp-ban').setAttribute('aria-pressed', String(now === 'ban'));
      $('rp-s').textContent = now ? PREF_TEXT[now] : '';
      b.focus({preventScroll:true});
    }
  });
  const closePick = function(fromHistory){
    if (!pick) return;
    const id = pick.trigger, view = pick.view, back = pick.back;
    pick = null;
    $('sheet').hidden = true;
    /* La fiche fermée est vidée : ses boutons ne traînent pas, cachés, sous le panneau suivant */
    $('sheet-rec').innerHTML = '';
    setInert(view, false);
    document.documentElement.style.overflow = '';
    if (!fromHistory){ try { if (history.state && history.state.pick) history.back(); } catch (e) {} }
    /* Focus rendu au bouton qui a ouvert le panneau ; s'il n'est plus là (séance retirée), à back */
    const trigger = [id, back].map(function(x){ return x ? $(x) : null; }).find(function(x){ return x && !x.disabled; });
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
  Object.assign(ACTIONS, {
    'open-pick': function(b){ openPick(b.dataset.kind, b.dataset.slot || null, b.dataset.ctx || 'page', b); },
    'close-pick': function(){ closePick(false); }
  });
