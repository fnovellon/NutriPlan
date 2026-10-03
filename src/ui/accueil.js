  /* Accueil : au premier lancement (aucun profil enregistré), ou depuis les réglages. Les réponses restent
     dans un brouillon, validé par profileFields, et ne sont enregistrées qu'à la fin (ou avec « Passer »). */
  let acc = null;
  const ACC_UNITS = {age:'ans', taille:'cm', poids:'kg', shakerKcal:'kcal', shakerProt:'g'};
  const ACC_NAMES = {age:'ton âge', taille:'ta taille', poids:'ton poids', shakerKcal:'les calories par dose', shakerProt:'les protéines par dose'};
  const listFr = function(a){ return a.length > 1 ? a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1] : a[0]; };
  const accInputs = function(step){ return $('accueil').querySelectorAll('[data-step="' + step + '"] input[data-acc]'); };
  const openAcc = function(draft){
    acc = {step:1, draft:draft};
    $('accueil').querySelectorAll('input[data-acc]').forEach(function(el){
      const k = el.dataset.acc;
      el.value = has(draft, k) ? String(draft[k]) : '';
      el.removeAttribute('aria-invalid');
    });
    $('acc-err').textContent = '';
    renderAcc();
  };
  const renderAcc = function(){
    if (acc) setView('accueil'); else showTop();
    if (!acc) return;
    const d = acc.draft, pr = cleanProfile(d);
    $('accueil').querySelectorAll('[data-step]').forEach(function(el){ el.hidden = +el.dataset.step !== acc.step; });
    $('acc-bar').querySelectorAll('span').forEach(function(s, i){ s.classList.toggle('on', i < acc.step); });
    $('acc-bar').setAttribute('aria-valuenow', String(acc.step));
    $('acc-bar').setAttribute('aria-label', 'Étape ' + acc.step + ' sur 3');
    $('accueil').querySelectorAll('[data-action="acc"]').forEach(function(b){
      const k = b.dataset.key, v = k === 'sexe' ? d.sexe : pr[k];
      b.setAttribute('aria-pressed', String(String(v) === b.dataset.value));
    });
    $('acc-back').hidden = acc.step === 1;
    $('acc-next').textContent = acc.step === 3 ? 'Voir mes repas' : 'Continuer';
    const en = energy(emptyPlan(todayJs), pr);
    $('acc-prev').innerHTML = 'Un jour sans sport, tu dépenses environ ' + r10(en.rest) + NB + 'kcal. ' + (pr.deficit > 0
      ? 'Tu viseras environ <strong>' + fmtInt(en.target) + NB + 'kcal</strong>, soit ≈' + NB + '−' +
        en.kgWeek.toLocaleString('fr-FR', {minimumFractionDigits:1, maximumFractionDigits:1}) + NB + 'kg par semaine.'
      : 'Tu viseras autant, <strong>' + r10(en.rest) + NB + 'kcal</strong>, pour garder ton poids.') +
      ' Les jours de séance, ce qu’elles coûtent s’ajoute.';
    $('acc-dose').hidden = pr.shaker !== 'oui';
    $('acc-shaker-t').textContent = pr.shaker === 'oui'
      ? 'Juste après ta dernière séance, ou l’après-midi les jours de repos. Sans réglage, une dose de 120' + NB + 'kcal et 24' + NB + 'g de protéines.'
      : 'Sans shaker, un skyr s’ajoute le soir quand il te manque des protéines.';
  };
  /* Étape valide ? Sinon, message et champs en erreur */
  const accCheck = function(){
    const d = acc.draft, parts = [], bad = [], missing = [];
    let first = null;
    accInputs(acc.step).forEach(function(el){
      const k = el.dataset.acc;
      if (has(d, k)) return;
      if (el.value.trim() !== ''){ bad.push(ACC_NAMES[k] + ' (' + PROFILE_RANGES[k][0] + ' à ' + PROFILE_RANGES[k][1] + NB + ACC_UNITS[k] + ')'); }
      else if (acc.step === 1) missing.push(ACC_NAMES[k]);
      else return;
      el.setAttribute('aria-invalid', 'true');
      first = first || el;
    });
    if (acc.step === 1 && !has(d, 'sexe')) parts.push('dis-nous si tu es un homme ou une femme');
    if (missing.length) parts.push('indique ' + listFr(missing));
    if (bad.length) parts.push('vérifie ' + listFr(bad));
    const msg = parts.length ? listFr(parts) + '.' : '';
    $('acc-err').textContent = msg ? msg.charAt(0).toUpperCase() + msg.slice(1) : '';
    if (first) first.focus();
    return !msg;
  };
  const finishAcc = function(){
    const d = profileFields(acc.draft);
    Object.keys(d).forEach(function(k){ prof[k] = d[k]; });
    if (!has(prof, 'mode')) prof.mode = cleanProfile(prof).mode;
    saveProf();
    acc = null;
    closeAllScreens();
    fillNeeds();
    $('intro').textContent = 'C’est prêt. Ajoute tes séances du jour, tes repas s’adaptent. Sans séance, c’est une journée de repos.';
    prevQty = new Map();
    renderAcc();
    render();
    $('title').focus();
    maybeOpenRepas();
  };
  const accStep = function(step){
    acc.step = step;
    $('acc-err').textContent = '';
    renderAcc();
    $('acc-h' + step).focus();
  };
  $('accueil').addEventListener('input', function(e){
    const el = e.target, k = el.dataset && el.dataset.acc;
    if (!k || !acc) return;
    const raw = el.value.trim().replace(',', '.'), o = {};
    o[k] = Number(raw);
    if (raw !== '' && has(profileFields(o), k)){ acc.draft[k] = o[k]; el.removeAttribute('aria-invalid'); }
    else delete acc.draft[k];
    $('acc-err').textContent = '';
    renderAcc();
  });
  $('accueil').addEventListener('change', function(e){
    const el = e.target, k = el.dataset && el.dataset.acc;
    if (k && acc && el.value.trim() !== '' && !has(acc.draft, k)) el.setAttribute('aria-invalid', 'true');
  });
  /* Actions de l'accueil : une réponse, étape précédente ou suivante, passer ; « Refaire l'accueil » des réglages */
  Object.assign(ACTIONS, {
    acc: function(b, v){
      const k = b.dataset.key, o = {};
      o[k] = k === 'deficit' || k === 'marge' ? Number(v) : v;
      if (has(profileFields(o), k)) acc.draft[k] = o[k];
      $('acc-err').textContent = '';
      renderAcc();
    },
    'acc-back': function(){ accStep(acc.step - 1); },
    'acc-next': function(){
      if (!accCheck()) return;
      if (acc.step < 3) accStep(acc.step + 1); else finishAcc();
    },
    'acc-skip': function(){ finishAcc(); },
    accueil: function(){ openAcc(profileFields(prof)); $('acc-h1').focus(); }
  });
