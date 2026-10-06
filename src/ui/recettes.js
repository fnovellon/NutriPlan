  /* Recettes (3.24.0) : la bibliothèque des 80 recettes, une par protéine × féculent, filtrables (protéine, féculent, celles
     qui se gardent, les rapides, seulement tes aliments). Le repas visé (ce midi, ce soir, demain midi, demain soir) donne
     les quantités de la fiche ; « Prendre pour … » met la recette dans ce repas (protéine, féculent, recette ; le dessert
     reste), enregistrée pour la date et en mémoire pour son jour de la semaine. Filtres gardés pendant la visite de l'appli,
     repas visé remis à l'heure à chaque ouverture. */
  const LIB_T = [['0|dej', 'Ce midi'], ['0|diner', 'Ce soir'], ['1|dej', 'Demain midi'], ['1|diner', 'Demain soir']];
  const LIB_QUICK = 20;
  const lib = {prot:'', starch:'', box:false, quick:false, favs:false, mine:true, target:'0|dej'};
  const LIB_ALL = PROT_ORDER.reduce(function(a, p){ return a.concat(STARCH_ORDER.map(function(s){ return p + '-' + s; }).filter(function(id){ return has(RECIPES, id); })); }, []);
  /* Le repas du moment : avant 14 h ce midi, avant 21 h ce soir, sinon demain midi */
  const resetLib = function(){
    const h = new Date().getHours();
    lib.target = h < 14 ? '0|dej' : h < 21 ? '0|diner' : '1|dej';
    $('lib-msg').textContent = '';
  };
  const libTarget = function(){
    const q = lib.target.split('|'), iso = isoDate(addDays(today, +q[0]));
    return {iso:iso, slot:q[1], day:+q[0], label:LIB_T.find(function(t){ return t[0] === lib.target; })[1].toLowerCase(), libre:q[1] === 'diner' && planFor(iso).libre};
  };
  const libChosen = function(tg){ return recipeOf(choicesFor(tg.iso, fromIso(tg.iso).getDay())[tg.slot]); };
  const libList = function(){
    const pr = cleanProfile(prof), off = pr.off, okP = allowed('prot', off), okS = allowed('starch', off);
    /* Les recettes à éviter en fin de liste (3.25.0) */
    return LIB_ALL.filter(function(id){
      const x = RECIPES[id];
      return (!lib.prot || x.p === lib.prot) && (!lib.starch || x.s === lib.starch) && (!lib.box || x.box) && (!lib.quick || x.min <= LIB_QUICK) &&
        (!lib.favs || pr.fav.indexOf(id) >= 0) && (!lib.mine || okP.indexOf(x.p) >= 0 && okS.indexOf(x.s) >= 0);
    }).sort(function(a, b){ return (pr.ban.indexOf(a) >= 0) - (pr.ban.indexOf(b) >= 0) || LIB_ALL.indexOf(a) - LIB_ALL.indexOf(b); });
  };
  /* Les filtres (listes de choix) une fois pour toutes ; le reste à chaque dessin. Favorites : 3.25.0 */
  $('lib-prot').innerHTML = '<option value="">Toutes</option>' + PROT_ORDER.map(function(p){ return '<option value="' + p + '">' + PROT[p].label + '</option>'; }).join('');
  $('lib-starch').innerHTML = '<option value="">Tous</option>' + STARCH_ORDER.map(function(s){ return '<option value="' + s + '">' + STARCH[s].label + '</option>'; }).join('');
  const renderLib = function(){
    const tg = libTarget(), cur = libChosen(tg), list = libList();
    $('lib-for').innerHTML = LIB_T.map(function(t){ return '<button type="button" class="opt" data-action="lib-for" data-value="' + t[0] + '" aria-pressed="' + (t[0] === lib.target) + '">' + t[1] + '</button>'; }).join('');
    $('lib-prot').value = lib.prot; $('lib-starch').value = lib.starch;
    [['lib-box', lib.box], ['lib-quick', lib.quick], ['lib-fav', lib.favs]].forEach(function(x){ $(x[0]).setAttribute('aria-pressed', String(x[1])); });
    $('lib-mine').setAttribute('aria-checked', String(lib.mine));
    $('lib-n').textContent = list.length ? list.length + NB + 'recette' + (list.length > 1 ? 's' : '') + (tg.libre ? ', mais ' + tg.label + ', c’est ton repas libre.' : '.') : 'Aucune recette avec ces filtres.';
    $('lib-list').innerHTML = list.map(function(id){
      const x = RECIPES[id], on = id === cur && !tg.libre, k = prefOf(id);
      return '<li><button type="button" class="lib-r' + (on ? ' is-on' : '') + (k === 'ban' ? ' is-ban' : '') + '" id="lib-' + id + '" data-action="lib-open" data-value="' + id + '" aria-haspopup="dialog">' +
        '<span class="lib-t">' + (k === 'fav' ? '<span class="lib-h" role="img" aria-label="Favorite">' + HEART + '</span>' : '') + x.t + '</span><span class="lib-m">' + x.min + NB + 'min' + (x.box ? ', se garde' : '') + (k === 'ban' ? ', à éviter' : '') +
        (on ? '<span class="lib-c">Choisie pour ' + tg.label + '</span>' : '') + '</span></button></li>';
    }).join('');
  };
  /* Listes de choix : la liste suit tout de suite */
  $('recettes').addEventListener('change', function(e){
    const k = e.target.dataset && e.target.dataset.lib;
    if (k !== 'prot' && k !== 'starch') return;
    const v = e.target.value;
    lib[k] = v === '' || has(k === 'prot' ? PROT : STARCH, v) ? v : '';
    renderLib();
  });
  /* La recette pour le repas visé : la journée de cette date avec la recette à ce repas (sans repas libre) */
  const libSec = function(id, tg){
    const js = fromIso(tg.iso).getDay(), c = cleanCh(choicesFor(tg.iso, js), js), x = RECIPES[id];
    c[tg.slot] = {prot:x.p, starch:x.s, dessert:dessertOf(c[tg.slot]), recette:id};
    return buildDay(Object.assign({}, planFor(tg.iso), {libre:false}), c, prof).secs.find(function(z){ return z.id === tg.slot; });
  };
  Object.assign(ACTIONS, {
    recettes: function(b){ if (topScreen() === 'recettes') return; resetLib(); renderLib(); navTo('recettes', b); },
    'lib-for': function(b, v){ if (!LIB_T.some(function(t){ return t[0] === v; })) return; lib.target = v; $('lib-msg').textContent = ''; renderLib(); $('lib-for').querySelector('[data-value="' + v + '"]').focus({preventScroll:true}); },
    'lib-f': function(b, v){ if (['box', 'quick', 'favs', 'mine'].indexOf(v) < 0) return; lib[v] = !lib[v]; renderLib(); },
    /* Fiche de la recette, avec tes quantités pour le repas visé */
    'lib-open': function(b, v){
      if (!has(RECIPES, v)) return;
      const tg = libTarget(), on = libChosen(tg) === v && !tg.libre;
      showRecipe(v, libSec(v, tg), on ? ' Choisie pour ' + tg.label + '.' : '', 'Pour ' + tg.label,
        tg.libre ? '<p class="warn">' + cap(tg.label) + ', c’est ton repas libre' + NB + ': choisis un autre repas pour la prendre.</p>'
          : on ? '' : '<p class="rec-tot">Le féculent s’ajuste à la recette' + NB + ': ta journée garde le même total.</p>',
        tg.libre || on ? '' : '<button type="button" class="btn main wide" data-action="lib-take" data-value="' + v + '">Prendre pour ' + tg.label + '</button>',
        {kind:'lib', slot:tg.slot, trigger:b && b.id ? b.id : null, view:'recettes'});
    },
    /* « Prendre pour … » : la recette dans ce repas, le message, le panneau fermé (focus sur la recette dans la liste) */
    'lib-take': function(b, v){
      const tg = libTarget();
      if (!has(RECIPES, v) || tg.libre) return;
      const x = RECIPES[v], d = fromIso(tg.iso), js = d.getDay(), before = weekBal(d), c = cleanCh(choicesFor(tg.iso, js), js);
      c[tg.slot] = {prot:x.p, starch:x.s, dessert:dessertOf(c[tg.slot]), recette:v};
      const cc = cleanCh(c, js);
      writeDay(tg.iso, {ch:cc}); store.choices[js] = cc; persist();
      loadSel(); prevQty = new Map(); render();
      const cross = crossMsg(before, weekBal(d));
      renderLib();
      closePick(false);
      $('lib-msg').innerHTML = '«' + NB + x.t + NB + '» prise pour ' + tg.label + '.' + (cross ? ' ' + cross : '') +
        ' <button type="button" class="link" data-action="lib-day" data-value="' + tg.iso + '|' + tg.slot + '">Voir ' + (tg.day ? 'demain' : 'ma journée') + '</button>';
    },
    /* « Voir ma journée » (ou demain) : la page sur cette date, la carte du repas */
    'lib-day': function(b, v){
      const q = String(v).split('|'), d = fromIso(q[0]);
      if (!d || !has(REPAS, q[1])) return;
      closeAllScreens();
      selDate = d; loadSel(); prevQty = new Map(); fsel = q[1];
      render();
      scroller().scrollTop = 0;
      ($('ft-' + q[1]) || $('title')).focus({preventScroll:true});
    }
  });
