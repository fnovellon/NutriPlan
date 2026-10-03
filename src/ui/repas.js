  /* Formulaire des repas du jour : tous les choix visibles, sur un brouillon ; « Voir ma journée » l'enregistre,
     « Décide pour moi » tire tout au hasard ; la flèche ou le bouton retour ferment sans rien changer.
     S'ouvre tout seul à la première ouverture de chaque jour (date gardée dans RKEY ; sans stockage, jamais tout seul). */
  const RKEY = 'repas-du-jour:repas:v1';
  let draft = null, repasVu = null, canStore = true;
  try { repasVu = localStorage.getItem(RKEY); } catch (e) { canStore = false; }
  /* Les trois repas, une ligne par choix comme sur la page (formulaire des repas et assistant de planification) */
  const mealsFormHTML = function(src, ctx){
    const rows = function(kinds, slot){ return '<div class="picks">' + kinds.map(function(k){ return selRow(k, slot, src, ctx); }).join('') + '</div>'; };
    const meal = function(id, title, body, note){
      return '<section class="rf" aria-labelledby="' + ctx + '-h-' + id + '"><h2 id="' + ctx + '-h-' + id + '">' + title + '</h2>' + (note ? '<p class="calc">' + note + '</p>' : '') + body + '</section>';
    };
    const day = DAYS.find(function(x){ return x.js === sel; }).long;
    return meal('pd', 'Petit-déjeuner', rows(['pd'], null)) +
      meal('dej', 'Déjeuner', rows(['prot', 'starch', 'dessert'], 'dej')) +
      meal('diner', 'Dîner', rows(['prot', 'starch', 'dessert'], 'diner'),
        plan.libre ? (dayDiff(selDate) === 0 ? 'Ce soir' : 'Ce soir-là') + ', c’est ton repas libre' + NB + ': ce dîner est gardé pour les prochains ' + day + 's.' : null);
  };
  const renderRepas = function(){
    $('repas-h').textContent = dayDiff(selDate) === 0 ? 'Tes repas du jour' : 'Tes repas, ' + dayRel(selDate);
    $('repas-form').innerHTML = mealsFormHTML(draft, 'repas');
  };
  /* Brouillon : les choix actuels du jour */
  const startDraft = function(){
    const copy = function(c){
      const o = {prot:c.prot, starch:c.starch, dessert:dessertOf(c)};
      if (recipeOf(c)){ o.recette = c.recette; ['g', 'g2'].forEach(function(f){ if (has(c, f)) o[f] = c[f]; }); }
      return o;
    };
    draft = {pdBase:ch.pdBase, dej:copy(ch.dej), diner:copy(ch.diner)};
    renderRepas();
  };
  const openRepas = function(opener){ startDraft(); openScreen('repas', opener); };
  /* Enregistre les choix du formulaire (ou du hasard) pour ce jour de la semaine, puis revient sur la journée */
  const applyRepas = function(c){
    const next = cleanCh(c, sel);
    if (JSON.stringify(next) !== JSON.stringify(cleanCh(ch, sel))){ ch = next; saveCh(); }
    draft = null;
    closeScreen(false);
  };
  const maybeOpenRepas = function(){
    const iso = isoDate(today);
    if (!canStore || acc || pick || repasVu === iso || dayDiff(selDate) !== 0) return;
    repasVu = iso;
    try { localStorage.setItem(RKEY, iso); } catch (e) {}
    if (topScreen() === 'repas') startDraft(); else openRepas({id:'title'});
  };
  /* Actions du formulaire des repas : l'ouvrir, un choix dans le brouillon, valider ou tirer au hasard */
  Object.assign(ACTIONS, {
    repas: function(b){ openRepas(b); },
    rf: function(b, v){
      const slot = b.dataset.slot, kind = b.dataset.kind;
      if (!draft) return;
      if (kind === 'pd' && has(PD, v)) draft.pdBase = v;
      else if (kind === 'prot' && has(PROT, v)) draft[slot].prot = v;
      else if (kind === 'starch' && has(STARCH, v)) draft[slot].starch = v;
      else if (kind === 'dessert' && has(DESSERT, v)) draft[slot].dessert = v;
      else return;
      dropRecipes(draft);
      renderRepas();
      if (pick && b.closest('#sheet')) closePick(false);
    },
    'repas-ok': function(){ if (!draft) return; applyRepas(draft); return ''; },
    'repas-hasard': function(){
      if (!draft) return;
      applyRepas(drawFor(selIso()));
      return 'Repas tirés au hasard' + NB + ': touche un plat pour le changer.';
    }
  });
