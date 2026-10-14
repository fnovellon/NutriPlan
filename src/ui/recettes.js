  /* Recettes (3.24.0) : la bibliothèque, en trois onglets depuis la 4.1.0 : « Midi et soir » (les 160 recettes, deux par
     protéine × féculent, filtrables : protéine, féculent, celles qui se gardent), « Petits-déjeuners » (les dix bases, pd:base)
     et « Collations » (les cinq, co:collation, et les boules d'énergie des jours de séance, cs:boules). Filtres communs : les
     rapides, les favorites, seulement tes aliments. Le repas visé de l'onglet (ce midi, ce soir, demain midi, demain soir ;
     ce matin, demain matin ; aujourd'hui, demain) donne les quantités de la fiche ; « Prendre pour … » la met dans ce repas
     (le dessert reste), enregistrée pour la date et en mémoire pour son jour de la semaine. Filtres et onglet gardés pendant
     la visite de l'appli, repas visés remis à l'heure à chaque ouverture. */
  const LIB_TT = {
    meal:[['0|dej', 'Ce midi'], ['0|diner', 'Ce soir'], ['1|dej', 'Demain midi'], ['1|diner', 'Demain soir']],
    pd:[['0|pd', 'Ce matin'], ['1|pd', 'Demain matin']],
    co:[['0|co', 'Aujourd’hui'], ['1|co', 'Demain']]
  };
  const LIB_TABS = [['meal', 'Midi et soir'], ['pd', 'Petits-déjeuners'], ['co', 'Collations']];
  const LIB_P = {
    meal:'Les 160 recettes de l’appli, deux par protéine et féculent. Touche-en une pour voir tes quantités et la prendre pour un repas.',
    pd:'Les dix petits-déjeuners, avec leur préparation. Touche-en un pour voir tes quantités et le prendre pour un matin.',
    co:'Les cinq collations et les boules d’énergie des jours de séance. Touche-en une pour voir tes quantités et la prendre pour un jour.'
  };
  const LIB_QUICK = 20;
  const lib = {tab:'meal', prot:'', starch:'', box:false, quick:false, favs:false, mine:true, target:'0|dej', tpd:'0|pd', tco:'0|co'};
  const LIB_ALL = PROT_ORDER.reduce(function(a, p){ return STARCH_ORDER.reduce(function(b, s){ return b.concat(recipesFor(p, s)); }, a); }, []);
  const LIB_PD = PD_ORDER.map(function(x){ return 'pd:' + x; }), LIB_CO = SNACK_ORDER.map(function(x){ return 'co:' + x; }).concat(['cs:boules']);
  /* Le repas du moment : avant 14 h ce midi, avant 21 h ce soir, sinon demain midi ; avant 10 h ce matin, sinon demain matin ;
     avant 18 h la collation d'aujourd'hui, sinon celle de demain */
  const resetLib = function(){
    const h = new Date().getHours();
    lib.target = h < 14 ? '0|dej' : h < 21 ? '0|diner' : '1|dej';
    lib.tpd = h < 10 ? '0|pd' : '1|pd';
    lib.tco = h < 18 ? '0|co' : '1|co';
    $('lib-msg').textContent = '';
  };
  const libKey = function(){ return lib.tab === 'pd' ? 'tpd' : lib.tab === 'co' ? 'tco' : 'target'; };
  const libTarget = function(){
    const v = lib[libKey()], q = v.split('|'), iso = isoDate(addDays(today, +q[0]));
    return {iso:iso, slot:q[1], day:+q[0], label:LIB_TT[lib.tab].find(function(t){ return t[0] === v; })[1].toLowerCase(), libre:q[1] === 'diner' && planFor(iso).libre};
  };
  /* Ce qui est déjà choisi pour le repas visé : la recette, la base du petit-déjeuner, la collation (et ses boules) */
  const libChosen = function(tg){
    const c = choicesFor(tg.iso, fromIso(tg.iso).getDay());
    if (tg.slot === 'pd') return 'pd:' + c.pdBase;
    if (tg.slot === 'co') return c.cs === 'boules' && c.co !== 'rizaulait' ? ['co:' + (c.co || 'oeufs'), 'cs:boules'] : 'co:' + (c.co || 'oeufs');
    return recipeOf(c[tg.slot]);
  };
  const libIsOn = function(id, tg){ const x = libChosen(tg); return !tg.libre && (Array.isArray(x) ? x.indexOf(id) >= 0 : x === id); };
  const libMin = function(id){ return has(RECIPES, id) ? RECIPES[id].min : FICHE[id].min; };
  const libList = function(){
    const pr = cleanProfile(prof), off = pr.off, okP = allowed('prot', off), okS = allowed('starch', off), okPd = allowed('pd', off);
    const all = lib.tab === 'pd' ? LIB_PD : lib.tab === 'co' ? LIB_CO : LIB_ALL;
    /* Les recettes à éviter en fin de liste (3.25.0) */
    return all.filter(function(id){
      if ((lib.quick && libMin(id) > LIB_QUICK) || (lib.favs && pr.fav.indexOf(id) < 0)) return false;
      if (lib.tab === 'pd') return !lib.mine || okPd.indexOf(id.slice(3)) >= 0;
      if (lib.tab === 'co') return true;
      const x = RECIPES[id];
      return (!lib.prot || x.p === lib.prot) && (!lib.starch || x.s === lib.starch) && (!lib.box || x.box) &&
        (!lib.mine || okP.indexOf(x.p) >= 0 && okS.indexOf(x.s) >= 0);
    }).sort(function(a, b){ return (pr.ban.indexOf(a) >= 0) - (pr.ban.indexOf(b) >= 0) || all.indexOf(a) - all.indexOf(b); });
  };
  /* Les filtres (listes de choix) une fois pour toutes ; le reste à chaque dessin. Favorites : 3.25.0 */
  $('lib-prot').innerHTML = '<option value="">Toutes</option>' + PROT_ORDER.map(function(p){ return '<option value="' + p + '">' + PROT[p].label + '</option>'; }).join('');
  $('lib-starch').innerHTML = '<option value="">Tous</option>' + STARCH_ORDER.map(function(s){ return '<option value="' + s + '">' + STARCH[s].label + '</option>'; }).join('');
  const renderLib = function(){
    const tg = libTarget(), list = libList(), meal = lib.tab === 'meal', tv = lib[libKey()];
    $('lib-tabs').innerHTML = LIB_TABS.map(function(t){ return '<button type="button" id="lib-tab-' + t[0] + '" data-action="lib-tab" data-value="' + t[0] + '" aria-pressed="' + (t[0] === lib.tab) + '">' + t[1] + '</button>'; }).join('');
    $('lib-p').textContent = LIB_P[lib.tab];
    $('lib-for-l').textContent = meal ? 'Pour quel repas' + NB + '?' : lib.tab === 'pd' ? 'Pour quel matin' + NB + '?' : 'Pour quel jour' + NB + '?';
    $('lib-for').innerHTML = LIB_TT[lib.tab].map(function(t){ return '<button type="button" class="opt" data-action="lib-for" data-value="' + t[0] + '" aria-pressed="' + (t[0] === tv) + '">' + t[1] + '</button>'; }).join('');
    $('lib-sel').hidden = !meal; $('lib-box').hidden = !meal;
    $('lib-mine').hidden = lib.tab === 'co';
    $('lib-prot').value = lib.prot; $('lib-starch').value = lib.starch;
    [['lib-box', lib.box], ['lib-quick', lib.quick], ['lib-fav', lib.favs]].forEach(function(x){ $(x[0]).setAttribute('aria-pressed', String(x[1])); });
    $('lib-mine').setAttribute('aria-checked', String(lib.mine));
    const word = meal ? ['recette', 'recettes'] : lib.tab === 'pd' ? ['petit-déjeuner', 'petits-déjeuners'] : ['collation', 'collations'];
    $('lib-n').textContent = list.length ? list.length + NB + word[list.length > 1 ? 1 : 0] + (tg.libre ? ', mais ' + tg.label + ', c’est ton repas libre.' : '.') : (meal ? 'Aucune recette' : 'Rien') + ' avec ces filtres.';
    $('lib-list').innerHTML = list.map(function(id){
      const x = has(RECIPES, id) ? RECIPES[id] : FICHE[id], on = libIsOn(id, tg), k = prefOf(id);
      return '<li><button type="button" class="lib-r' + (on ? ' is-on' : '') + (k === 'ban' ? ' is-ban' : '') + '" id="lib-' + id + '" data-action="lib-open" data-value="' + id + '" aria-haspopup="dialog">' +
        '<span class="lib-t">' + (k === 'fav' ? '<span class="lib-h" role="img" aria-label="Favorite">' + HEART + '</span>' : '') + prefName(id) + '</span><span class="lib-m">' + x.min + NB + 'min' + (x.box ? ', se garde' : x.veille ? ', se prépare à l’avance' : '') + (k === 'ban' ? ', à éviter' : '') +
        (on ? '<span class="lib-c">' + (meal ? 'Choisie pour ' : 'Au menu ') + tg.label + '</span>' : '') + '</span></button></li>';
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
    return buildDay(planForMeal(planFor(tg.iso), tg.slot), c, prof).secs.find(function(z){ return z.id === tg.slot; });
  };
  /* Un petit-déjeuner, une collation ou les boules d'énergie pour le jour visé (4.1.0) : leurs lignes, telles que la journée de
     cette date les donne avec eux, et une note quand ce jour-là les change (sortie longue, pas de séance) ; ch : les plats */
  const SNACK_KEYS = ['rzr', 'rzl', 'rzs', 'csk', 'cam', 'mfo', 'mfe', 'mfp', 'mko', 'mks', 'mka', 'mkc', 'tht', 'thc', 'ths', 'thg', 'oe'];
  const libPart = function(id, tg){
    const js = fromIso(tg.iso).getDay(), c = cleanCh(choicesFor(tg.iso, js), js), p0 = planForMeal(planFor(tg.iso), tg.slot);
    const long = p0.seances.some(function(x){ return x.taille === 'longue'; }), noLong = Object.assign({}, p0, {seances:p0.seances.filter(function(x){ return x.taille !== 'longue'; })});
    const k = id.slice(3);
    let plan = p0, note = '', keys = null;
    if (id.indexOf('pd:') === 0){
      c.pdBase = k;
      if (long) note = PD[k].sale ? 'Ce jour-là, sortie longue' + NB + ': la version sucrée au pain, plus digeste avant de partir.' : 'Ce jour-là, sortie longue' + NB + ': un peu plus de flocons ou de pain, et du miel.';
    } else if (id === 'cs:boules'){
      /* Avec le riz au lait (il fait aussi les glucides), les quantités d'une autre collation ; elle reste à prendre */
      if (c.co === 'rizaulait'){ c.co = 'oeufs'; note = 'Avec le riz au lait, pas de boules d’énergie' + NB + ': il fait déjà les glucides. Elles reviennent avec une autre collation.'; }
      c.cs = 'boules'; keys = ['bof', 'bos', 'boa'];
      if (!noLong.seances.length){ plan = Object.assign({}, noLong, {seances:[{taille:'petite', moment:'soir'}]}); note = (note ? note + ' ' : '') + 'Les boules d’énergie sont pour les jours de séance' + NB + ': voici les quantités avec une petite séance.'; }
      else if (long) plan = noLong;
    } else {
      c.co = k; keys = SNACK_KEYS;
      if (long){ plan = noLong; note = 'Ce jour-là, sortie longue' + NB + ': le goûter remplace la collation. Voici les quantités d’un jour sans elle.'; }
    }
    const sec = buildDay(plan, c, prof).secs.find(function(z){ return z.id === tg.slot; });
    return {items:sec ? sec.items.filter(function(i){ return !keys || keys.indexOf(i.key) >= 0; }) : [], note:note, ch:c};
  };
  Object.assign(ACTIONS, {
    recettes: function(b){ if (topScreen() === 'recettes') return; resetLib(); renderLib(); navTo('recettes', b); },
    'lib-tab': function(b, v){ if (!has(LIB_TT, v)) return; lib.tab = v; $('lib-msg').textContent = ''; renderLib(); $('lib-tab-' + v).focus({preventScroll:true}); },
    'lib-for': function(b, v){ if (!LIB_TT[lib.tab].some(function(t){ return t[0] === v; })) return; lib[libKey()] = v; $('lib-msg').textContent = ''; renderLib(); $('lib-for').querySelector('[data-value="' + v + '"]').focus({preventScroll:true}); },
    'lib-f': function(b, v){ if (['box', 'quick', 'favs', 'mine'].indexOf(v) < 0) return; lib[v] = !lib[v]; renderLib(); },
    /* Fiche de la recette, avec tes quantités pour le repas visé */
    'lib-open': function(b, v){
      if (!has(RECIPES, v) && !has(FICHE, v)) return;
      const tg = libTarget(), on = libIsOn(v, tg);
      if (!has(RECIPES, v)){
        const x = libPart(v, tg);
        showRecipe(v, x.items, on ? ' Au menu ' + tg.label + '.' : '', 'Pour ' + tg.label,
          (x.note ? '<p class="rec-tot">' + x.note + '</p>' : '') + (on ? '' : '<p class="rec-tot">Les féculents s’ajustent' + NB + ': ta journée garde le même total.</p>'),
          on ? '' : '<button type="button" class="btn main wide" data-action="lib-take" data-value="' + v + '">Prendre pour ' + tg.label + '</button>',
          {kind:'lib', slot:tg.slot, trigger:b && b.id ? b.id : null, view:'recettes'});
        return;
      }
      showRecipe(v, libSec(v, tg), on ? ' Choisie pour ' + tg.label + '.' : '', 'Pour ' + tg.label,
        tg.libre ? '<p class="warn">' + cap(tg.label) + ', c’est ton repas libre' + NB + ': choisis un autre repas pour la prendre.</p>'
          : on ? '' : '<p class="rec-tot">Le féculent s’ajuste à la recette' + NB + ': ta journée garde le même total.</p>',
        tg.libre || on ? '' : '<button type="button" class="btn main wide" data-action="lib-take" data-value="' + v + '">Prendre pour ' + tg.label + '</button>',
        {kind:'lib', slot:tg.slot, trigger:b && b.id ? b.id : null, view:'recettes'});
    },
    /* « Prendre pour … » : la recette dans ce repas, le message, le panneau fermé (focus sur la recette dans la liste) */
    'lib-take': function(b, v){
      const tg = libTarget();
      if ((!has(RECIPES, v) && !has(FICHE, v)) || tg.libre) return;
      const d = fromIso(tg.iso), js = d.getDay(), before = weekBal(d);
      let c = cleanCh(choicesFor(tg.iso, js), js);
      if (has(RECIPES, v)){ const x = RECIPES[v]; c[tg.slot] = {prot:x.p, starch:x.s, dessert:dessertOf(c[tg.slot]), recette:v}; }
      else if (v === 'cs:boules') c.cs = 'boules';
      else c = libPart(v, tg).ch;
      const cc = cleanCh(c, js);
      writeDay(tg.iso, {ch:cc}); store.choices[js] = cc; persist();
      loadSel(); prevQty = new Map(); render();
      const cross = crossMsg(before, weekBal(d));
      renderLib();
      closePick(false);
      $('lib-msg').innerHTML = '«' + NB + prefName(v) + NB + '» ' + (has(RECIPES, v) ? 'prise pour ' : 'au menu ') + tg.label + '.' + (cross ? ' ' + cross : '') +
        ' <button type="button" class="link" data-action="lib-day" data-value="' + tg.iso + '|' + tg.slot + '">Voir ' + (tg.day ? 'demain' : 'ma journée') + '</button>';
    },
    /* « Voir ma journée » (ou demain) : la page sur cette date, la carte du repas */
    'lib-day': function(b, v){
      const q = String(v).split('|'), d = fromIso(q[0]);
      if (!d || ['dej', 'diner', 'pd', 'co'].indexOf(q[1]) < 0) return;
      closeAllScreens();
      selDate = d; loadSel(); prevQty = new Map(); fsel = q[1];
      render();
      scroller().scrollTop = 0;
      ($('ft-' + q[1]) || $('title')).focus({preventScroll:true});
    }
  });
