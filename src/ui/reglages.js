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

  /* Réglages, « Ta semaine type » : un jour à la fois, ses séances avec les mêmes boutons que la page */
  let semSel = todayJs;
  const SHORT = {0:'dim.', 1:'lun.', 2:'mar.', 3:'mer.', 4:'jeu.', 5:'ven.', 6:'sam.'};
  const renderSemaine = function(){
    const w = semOf(), list = w.jours[semSel] || [];
    $('sem-days').innerHTML = DAYS.map(function(d){
      const n = (w.jours[d.js] || []).length;
      return '<button type="button" data-action="sem-day" data-value="' + d.js + '" aria-pressed="' + (d.js === semSel) + '" aria-label="' + d.long + NB + ': ' +
        (n ? n + ' séance' + (n > 1 ? 's' : '') : 'repos') + '"><span class="wd">' + SHORT[d.js] + '</span><span class="dn">' + (n || '–') + '</span></button>';
    }).join('');
    $('sem-h').textContent = cap(DAYS.find(function(d){ return d.js === semSel; }).long);
    $('sem-sess').innerHTML = sessHTML(list, 'sem-');
    $('sem-acts').querySelectorAll('button').forEach(function(b){ b.disabled = addDisabled(b.dataset.value, list); });
    $('sem-lib').innerHTML = DAYS.map(function(d){
      return '<button type="button" class="opt" data-action="sem-lib" data-value="' + d.js + '" aria-pressed="' + (w.libre === d.js) + '" aria-label="' + d.long + '">' + SHORT[d.js] + '</button>';
    }).join('');
  };
  /* Enregistrée dans le profil, seulement si elle diffère de la semaine par défaut (aucune séance, repas libre le samedi) */
  const saveWeek = function(w){
    const c = cleanWeek(w);
    if (Object.keys(c.jours).length || c.libre !== 6) prof.semaine = c; else delete prof.semaine;
    saveProf();
  };
  /* Après un changement, le focus revient sur le même bouton (sinon sur « + Petite ») */
  const semFocus = function(b){
    const same = [...$('semaine').querySelectorAll('[data-action="' + b.dataset.action + '"]')].find(function(x){
      return x.dataset.value === b.dataset.value && x.dataset.index === b.dataset.index;
    });
    const el = same && !same.disabled ? same : $('sem-acts').querySelector('button:not(:disabled)') || $('sem-days').querySelector('[aria-pressed="true"]');
    if (el) el.focus({preventScroll:true});
  };
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
    shop = {from:'', to:'', checked:[]}; repasVu = null; draft = null; planner = null; semSel = todayJs;
    effShow(false);
    closeAllScreens();
    selDate = today; loadSel(); prevQty = new Map();
    $('hint').textContent = ''; $('intro').textContent = ''; $('alim-warn').textContent = '';
    fillNeeds(); renderAliments(); renderSemaine();
    render();
    openAcc({});
    $('acc-h1').focus();
  };
  const semAction = function(b, v){
    const w = semOf(), list = (w.jours[semSel] || []).map(function(x){ return Object.assign({}, x); }), i = +b.dataset.index, act = b.dataset.action;
    if (act === 'sem-add'){ if (!has(SIZES, v) || addDisabled(v, list)) return; list.push({taille:v, moment:v === 'longue' ? 'matin' : 'soir', duree:2}); }
    else if (act === 'sem-rm'){ if (!list[i]) return; list.splice(i, 1); }
    else if (act === 'sem-smoment'){ if (!list[i] || !has(MOMENT_RANK, v)) return; list[i].moment = v; }
    else if (act === 'sem-sduree'){ if (!list[i]) return; list[i].duree = parseFloat(v); }
    else { if (!/^[0-6]$/.test(v || '')) return; w.libre = +v; }
    w.jours[semSel] = list;
    saveWeek(w);
    renderSemaine();
    semFocus(b);
    loadSel(); prevQty = new Map();
    return '';
  };
  /* Actions des réglages : profil, aliments proposés, semaine type, effacer mes données */
  Object.assign(ACTIONS, {
    needs: function(b){ effShow(false); openScreen('reglages', b); },
    prof: function(b, v){
      const o = {};
      o[b.dataset.key] = v;
      if (has(profileFields(o), b.dataset.key)){ prof[b.dataset.key] = v; saveProf(); }
      return '';
    },
    /* « Tes aliments » : proposer ou non un aliment (au moins un gardé par type, sauf les desserts) */
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
    /* « Ta semaine type » : un jour, ses séances, le soir du repas libre */
    'sem-day': function(b, v){ if (!/^[0-6]$/.test(v || '')) return; semSel = +v; renderSemaine(); semFocus(b); },
    'sem-add': semAction, 'sem-rm': semAction, 'sem-smoment': semAction, 'sem-sduree': semAction, 'sem-lib': semAction,
    /* « Effacer mes données » : demander, confirmer ou annuler */
    'eff-ask': function(){ effShow(true); $('eff-no').focus({preventScroll:true}); },
    'eff-no': function(){ effShow(false); $('eff-btn').focus({preventScroll:true}); },
    'eff-ok': function(){ resetAll(); }
  });
