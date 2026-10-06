  /* Réglages : carte « Tes besoins » (renderNeeds, dessinée avec la page), « Tes aliments », « Ta semaine type », champs du
     profil, « Effacer mes données ». */
  const renderNeeds = function(res){
    const pr = cleanProfile(prof), en = res.energy;
    document.querySelectorAll('#besoins [data-action="prof"]').forEach(function(b){ b.setAttribute('aria-pressed', String(pr[b.dataset.key] === b.dataset.value)); });
    $('besoins').querySelector('[data-key="repos"]').placeholder = String(Math.round(bmr(pr) * NEAT[pr.neat] / 10) * 10);
    document.querySelectorAll('#besoins [data-mode]').forEach(function(el){ el.hidden = el.dataset.mode !== pr.mode; });
    $('needs-sum').textContent = r10(en.rest) + NB + 'kcal un jour sans sport (' + (en.restSource === 'saisie' ? 'saisie' : 'automatique') + '), déficit de ' + pr.deficit + NB + '%';
    $('mode-hint').textContent = pr.mode === 'manuel'
      ? 'Tu indiques ta dépense d’un jour sans sport, l’appli ajoute le coût de chaque séance, calculé avec ton poids.'
      : 'Ta dépense est calculée à partir de ton profil.';
    let hint = '';
    if (pr.mode === 'auto' && incomplete()) hint = 'Indique ton âge, ta taille et ton poids' + NB + ': en attendant, le calcul utilise les valeurs grisées.';
    else if (pr.mode === 'manuel' && en.restSource !== 'saisie') hint = 'Indique ta dépense d’un jour sans sport' + NB + ': en attendant, le calcul automatique est utilisé (' + r10(en.rest) + NB + 'kcal).';
    else if (pr.mode === 'manuel' && incomplete()) hint = 'Indique ton poids' + NB + ': il sert à calculer tes séances.';
    $('needs-hint').textContent = hint;
    $('calc-rest').textContent = en.restSource === 'saisie'
      ? 'Dépense un jour de repos' + NB + ': ' + r10(en.rest) + NB + 'kcal, celle que tu as saisie. Chaque séance s’y ajoute.'
      : 'Métabolisme de base' + NB + ': ' + r10(en.bmr) + NB + 'kcal (formule de ' + (pr.gras !== null ? 'Cunningham, à partir de ta masse maigre' : 'Mifflin-St' + NB + 'Jeor') +
        '). Dépense un jour de repos' + NB + ': ' + r10(en.rest) + NB + 'kcal, calculée. Chaque séance s’y ajoute.';
    $('out-deficit').textContent = pr.deficit + NB + '%';
    $('calc-deficit').textContent = pr.deficit > 0
      ? pr.deficit + NB + '% de ta dépense d’un jour sans sport, soit ' + r10(en.deficit) + NB + 'kcal de moins chaque jour' + NB + ': environ −' +
        en.kgWeek.toLocaleString('fr-FR', {minimumFractionDigits:1, maximumFractionDigits:1}) + NB + 'kg par semaine. Tes séances restent couvertes.'
      : 'Pas de déficit' + NB + ': tu manges ce que tu dépenses.';
    const warn = [];
    if (pr.deficit > 20) warn.push('Au-delà de 20' + NB + '%, tu perds plus vite mais tu risques de perdre du muscle et de la forme à l’entraînement.');
    if (pr.mode === 'auto' && pr.gras !== null){
      const ea = (en.rest - en.deficit) / (pr.poids * (1 - pr.gras / 100));
      if (ea < 30) warn.push('Il te reste environ ' + Math.round(ea) + NB + 'kcal par kilo de masse maigre une fois tes séances payées, sous le seuil de 30' + NB + ': baisse le déficit.');
    }
    $('warn-deficit').textContent = warn.join(' ');
    const dec = function(n){ return n.toLocaleString('fr-FR', {minimumFractionDigits:1, maximumFractionDigits:1}); };
    $('out-prot').textContent = dec(pr.prot) + NB + 'g/kg';
    /* Poids de calcul borné comme les portions (47 à 101 kg environ) */
    const protKg = res.prot.target / pr.prot;
    $('calc-prot').textContent = 'Environ ' + Math.round(res.prot.target) + NB + 'g par jour (' + dec(pr.prot) + ' × ' + dec(protKg) + NB + 'kg), à 10' + NB + '% près' + NB + ': de ' +
      Math.round(res.prot.low) + ' à ' + Math.round(res.prot.high) + NB + 'g.' +
      (pr.poids > protKg + 0.05 ? ' Au-delà de ' + dec(protKg) + NB + 'kg, ton objectif et tes portions ne suivent plus ton poids.' : '') +
      (pr.poids < protKg - 0.05 ? ' Sous ' + dec(protKg) + NB + 'kg, ton objectif et tes portions ne suivent plus ton poids.' : '') +
      ' Viande, poisson, œufs et skyr restent au plus près du menu de base et ne s’ajustent que pour entrer dans cette fourchette. Aujourd’hui' + NB + ': ' + Math.round(res.tot.p) + NB + 'g' +
      (res.libre ? ' hors repas libre.' : '.') +
      (!res.libre && res.prot.factor <= PF_MIN + 0.02 && res.tot.p > res.prot.high ? ' Le reste de ta journée (shaker, œufs, féculents) en apporte déjà beaucoup' + NB + ': plus bas, les portions ne peuvent pas suivre.' : '') +
      ' Repère en sèche' + NB + ': 1,6 à 2,2' + NB + 'g/kg, 2,0 par défaut.';
    $('out-ravito').textContent = pr.ravito + NB + 'g/h';
    $('out-marge').textContent = pr.marge + NB + 'kcal';
    [['kcalPetite', {taille:'petite'}], ['kcalMoyenne', {taille:'moyenne'}], ['kcalLongueH', {taille:'longue', duree:1}]].forEach(function(x){
      $('besoins').querySelector('[data-key="' + x[0] + '"]').placeholder = String(Math.round(seanceCost(x[1], Object.assign({}, pr, {kcalPetite:null, kcalMoyenne:null, kcalLongueH:null})) / 10) * 10);
    });
    $('calc-seances').textContent = 'Calories en plus de ta journée pour chaque séance. Par défaut, d’après ton poids' + NB + ': petite ' +
      r10(SIZES.petite.net * pr.poids) + NB + 'kcal (1' + NB + 'h de muscu), moyenne ' + r10(SIZES.moyenne.net * pr.poids) + NB + 'kcal (≈ 7' + NB + 'km de course), longue ' +
      r10(SIZES.longue.net * pr.poids) + NB + 'kcal par heure. Tu peux mettre les tiennes, par exemple les calories actives de ta montre pour cette séance.';
    const sm = shakerMac(pr), withShaker = pr.shaker === 'oui';
    $('shaker-dose').hidden = !withShaker;
    $('calc-shaker').textContent = withShaker
      ? 'Tous les jours, juste après ta dernière séance (l’après-midi les jours de repos). Une dose à l’eau' + NB + ': ' +
        pr.shakerKcal + NB + 'kcal, ' + Math.round(sm.p) + NB + 'g de protéines, environ ' + Math.round(sm.c) + NB + 'g de glucides et ' + Math.round(sm.f) + NB + 'g de lipides.'
      : 'Pas de shaker' + NB + ': si tes protéines passent sous ' + Math.round(res.prot.floor) + NB + 'g, un skyr s’ajoute le soir.';
    $('warn-shaker').textContent = withShaker && pr.shakerProt > sm.p
      ? 'Avec ' + pr.shakerKcal + NB + 'kcal, une dose ne peut pas dépasser ' + Math.round(sm.p) + NB + 'g de protéines' + NB + ': le calcul en compte ' + Math.round(sm.p) + NB + 'g.'
      : '';
  };

  /* Réglages, « Tes aliments » : tous les choix, proposés (encre) ou non (barrés) */
  const renderAliments = function(){
    const off = cleanProfile(prof).off, T = {pd:'Base du petit-déjeuner', prot:'Protéines', starch:'Féculents', dessert:'Desserts'};
    $('alim-list').innerHTML = Object.keys(CHOICE_IDS).map(function(kind){
      return '<p class="rf-l" id="al-' + kind + '">' + T[kind] + '</p><div class="opts-list" role="group" aria-labelledby="al-' + kind + '">' +
        CHOICE_IDS[kind].map(function(id){
          const l = labelOf(kind, id);
          return '<button type="button" class="opt" data-action="aliment" data-kind="' + kind + '" data-value="' + id + '" aria-pressed="' + (off.indexOf(kind + ':' + id) < 0) + '">' +
            l.label + (l.sub ? '<span class="opt-s">' + l.sub + '</span>' : '') + '</button>';
        }).join('') + '</div>';
    }).join('');
  };
  renderAliments();
  /* Réglages, « Tes recettes » (3.25.0) : les favorites et celles à éviter, à retirer une par une */
  const PREF_G = [['fav', 'Favorites', 'des favorites'], ['ban', 'À éviter', 'de la liste à éviter']];
  const renderPrefs = function(){
    const pr = cleanProfile(prof);
    $('rp-list').innerHTML = PREF_G.map(function(g){
      return '<p class="rf-l" id="rp-' + g[0] + '-l">' + g[1] + '</p>' + (pr[g[0]].length ? '<ul class="rp-ul" aria-labelledby="rp-' + g[0] + '-l">' + pr[g[0]].map(function(id){
        return '<li><span class="rp-n">' + RECIPES[id].t + '</span><button type="button" class="rm" data-action="rp-rm" data-pref="' + g[0] + '" data-value="' + id + '"' +
          ' aria-label="Retirer «' + NB + RECIPES[id].t + NB + '» ' + g[2] + '">×</button></li>';
      }).join('') + '</ul>' : '<p class="calc rp-none">Aucune pour l’instant.</p>');
    }).join('');
  };
  renderPrefs();

  /* Réglages, « Ta semaine type » : l'éditeur partagé avec l'accueil (ui/semtype.js) */
  renderSemaine();

  /* Champs du profil : enregistrés à chaque saisie valide, vidés = valeur par défaut */
  const fillNeeds = function(){
    document.querySelectorAll('#besoins input[data-key]').forEach(function(el){
      const k = el.dataset.key;
      if (el.type === 'range') el.value = String(cleanProfile(prof)[k]);
      else {
        el.value = has(prof, k) ? String(prof[k]) : '';
        el.removeAttribute('aria-invalid');
        if (PROFILE_DEFAULT[k] !== null) el.placeholder = String(PROFILE_DEFAULT[k]);
      }
    });
  };
  fillNeeds();
  /* Quitter un champ resté invalide : il reprend la valeur réellement utilisée */
  document.addEventListener('change', function(e){
    const el = e.target;
    if (!el.dataset || !el.dataset.key || !el.closest('#besoins') || el.type === 'range') return;
    const k = el.dataset.key, raw = el.value.trim().replace(',', '.');
    const shown = raw === '' ? null : Number(raw), stored = has(prof, k) ? prof[k] : null;
    if (shown === stored) return;
    el.value = stored === null ? '' : String(stored);
    el.removeAttribute('aria-invalid');
    if (k === 'repos') $('warn-repos').textContent = '';
    render();
  });
  document.addEventListener('input', function(e){
    const el = e.target;
    if (!el.dataset || !el.dataset.key || !el.closest('#besoins')) return;
    const k = el.dataset.key, raw = el.value.trim().replace(',', '.');
    if (raw === '') delete prof[k];
    else {
      const o = {};
      o[k] = Number(raw);
      if (!has(profileFields(o), k)){
        el.setAttribute('aria-invalid', 'true');
        if (k === 'repos') $('warn-repos').textContent = 'Entre ' + fmtInt(PROFILE_RANGES.repos[0]) + ' et ' + fmtInt(PROFILE_RANGES.repos[1]) + NB +
          'kcal' + NB + ': c’est le total de ta journée, même sans bouger, pas les calories actives de ta montre.';
        return;
      }
      prof[k] = o[k];
    }
    el.removeAttribute('aria-invalid');
    if (k === 'repos') $('warn-repos').textContent = '';
    saveProf();
    render();
  });

  /* Tout effacer (réglages) : toutes les clés de l'appli (repas-du-jour:…, l'ancienne v1 comprise, sinon elle serait reconvertie
     au prochain chargement), puis l'appli repart comme au premier lancement : accueil, puis formulaire des repas */
  const effShow = function(on){ $('eff-ask').hidden = on; $('eff-confirm').hidden = !on; };
  const resetAll = function(){
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && k.indexOf('repas-du-jour:') === 0) keys.push(k); }
      keys.forEach(function(k){ localStorage.removeItem(k); });
    } catch (e) {}
    store = {plans:{}, choices:{}}; prof = {}; prof.mode = cleanProfile(prof).mode;
    planifs = []; cur = null; resetPlanner(); eaten = {}; Object.assign(lib, {prot:'', starch:'', box:false, quick:false, favs:false, mine:true}); repasVu = null; draft = null; WEEK_ED.sem.sel = todayJs;
    effShow(false);
    closeAllScreens();
    selDate = today; loadSel(); prevQty = new Map();
    $('hint').textContent = ''; $('intro').textContent = ''; $('alim-warn').textContent = '';
    fillNeeds(); renderAliments(); renderPrefs(); renderSemaine(); showTab('profil');
    render();
    openAcc({});
    $('acc-h1').focus();
  };
  /* Onglets (3.18.0) : Profil, Sport, Repas, Appli ; un seul panneau visible, le dernier ouvert gardé tant que l'appli reste
     ouverte. Flèches gauche et droite, début et fin : onglet voisin, premier, dernier (le focus suit). Changer d'onglet
     remonte la page jusqu'aux onglets si elle était plus bas. */
  const TABS = ['profil', 'sport', 'repas', 'appli'];
  let reglTab = 'profil';
  const showTab = function(t, focus){
    reglTab = TABS.indexOf(t) >= 0 ? t : 'profil';
    TABS.forEach(function(x){
      const on = x === reglTab, b = $('tab-' + x);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      $('pan-' + x).hidden = !on;
    });
    const list = $('besoins').querySelector('[role="tablist"]');
    if (scroller().scrollTop > list.offsetTop) scroller().scrollTop = list.offsetTop;
    if (focus) $('tab-' + reglTab).focus({preventScroll:true});
  };
  $('besoins').querySelector('[role="tablist"]').addEventListener('keydown', function(e){
    const i = TABS.indexOf(reglTab), n = {ArrowRight:i + 1, ArrowLeft:i - 1, Home:0, End:TABS.length - 1}[e.key];
    if (n === undefined) return;
    e.preventDefault();
    showTab(TABS[(n + TABS.length) % TABS.length], true);
  });
  /* Actions des réglages : onglets, profil, aliments proposés, effacer mes données (semaine type : ui/semtype.js).
     needs : la roue dentée (le dernier onglet) ou « Régler » de la note du total (l'onglet de ce qu'elle propose) */
  Object.assign(ACTIONS, {
    needs: function(b, v){ effShow(false); showTab(TABS.indexOf(v) >= 0 ? v : reglTab); navTo('reglages', b); },
    tab: function(b, v){ showTab(v); },
    prof: function(b, v){
      const o = {};
      o[b.dataset.key] = v;
      if (has(profileFields(o), b.dataset.key)){ prof[b.dataset.key] = v; saveProf(); }
      return '';
    },
    /* « Tes aliments » : proposer ou non un aliment (au moins un gardé par type, sauf les desserts) */
    /* Une recette retirée de sa liste : le focus va sur la suivante (sinon la précédente, sinon le titre) */
    'rp-rm': function(b, v){
      const k = b.dataset.pref;
      if (!has(RECIPES, v) || (k !== 'fav' && k !== 'ban')) return;
      const all = [...$('rp-list').querySelectorAll('[data-action="rp-rm"][data-pref="' + k + '"]')].map(function(x){ return x.dataset.value; }), i = all.indexOf(v);
      setPref(v, k, false);
      const to = all[i + 1] || all[i - 1], nx = to ? $('rp-list').querySelector('[data-pref="' + k + '"][data-value="' + to + '"]') : null;
      (nx || $('rp-t')).focus({preventScroll:true});
    },
    aliment: function(b, v){
      const kind = b.dataset.kind, key = kind + ':' + v, off = cleanProfile(prof).off;
      if (!has(CHOICE_IDS, kind) || CHOICE_IDS[kind].indexOf(v) < 0) return;
      const i = off.indexOf(key);
      if (i >= 0) off.splice(i, 1);
      else if (kind !== 'dessert' && allowed(kind, off).length <= 1){
        $('alim-warn').textContent = 'Garde au moins ' + {pd:'une base pour le petit-déjeuner', prot:'une protéine', starch:'un féculent'}[kind] + '.';
        return;
      } else off.push(key);
      if (off.length) prof.off = off; else delete prof.off;
      saveProf();
      $('alim-warn').textContent = '';
      renderAliments();
      const again = $('alim-list').querySelector('[data-kind="' + kind + '"][data-value="' + v + '"]');
      if (again) again.focus({preventScroll:true});
      loadSel();
      return '';
    },
    /* « Effacer mes données » : demander, confirmer ou annuler */
    'eff-ask': function(){ effShow(true); $('eff-no').focus({preventScroll:true}); },
    'eff-no': function(){ effShow(false); $('eff-btn').focus({preventScroll:true}); },
    'eff-ok': function(){ resetAll(); }
  });
