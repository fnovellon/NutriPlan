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
  const showRecipe = function(x, sec, meta, head, note, foot, p){
    const items = recipePart(sec), none = new Map();
    pick = p;
    $('sheet-t').textContent = x.t;
    $('sheet-list').hidden = true;
    $('sheet-rec').hidden = false;
    $('sheet-rec').innerHTML = '<p class="rec-meta">' + x.min + NB + 'min' + (x.box ? ', se garde (à emporter)' : '') + '.' + meta + '</p>' +
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
    const sec = buildDay(Object.assign({}, plan, {libre:false}), withRec, prof).secs.find(function(z){ return z.id === slot; });
    showRecipe(x, sec, on ? ' Choisie pour ce ' + meal + '.' : '', 'Pour ce ' + meal,
      on ? '' : '<p class="rec-tot">Le féculent s’ajuste à la recette' + NB + ': ta journée garde le même total.</p>',
      on ? '<button type="button" class="btn wide" data-action="rec-off" data-slot="' + slot + '">Retirer la recette</button>'
        : '<button type="button" class="btn main wide" data-action="rec-on" data-slot="' + slot + '">Choisir cette recette</button>',
      {kind:'recette', slot:slot, trigger:trigger && trigger.id ? trigger.id : null, view:VIEWS.find(function(v){ return !$(v).hidden; }) || 'page'});
  };
  const closePick = function(fromHistory){
    if (!pick) return;
    const id = pick.trigger, view = pick.view, back = pick.back;
    pick = null;
    $('sheet').hidden = true;
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
