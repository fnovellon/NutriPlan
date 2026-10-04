  /* Périodes (planifications) : dates AAAA-MM-JJ, 31 jours au plus */
  const MAX_DAYS = 31;
  const isoOk = function(v){ return typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && fromIso(v) !== null && isoDate(fromIso(v)) === v; };
  const rangeDays = function(from, to){
    const out = [];
    for (let d = fromIso(from); d <= fromIso(to) && out.length <= MAX_DAYS; d = addDays(d, 1)) out.push(isoDate(d));
    return out;
  };
  /* Message si la période ne va pas ; minDiff : premier jour possible, par rapport à aujourd'hui */
  const rangeError = function(from, to, minDiff){
    if (!isoOk(from) || !isoOk(to)) return 'Choisis une date de début et une date de fin.';
    if (dayDiff(fromIso(from)) < minDiff) return minDiff === 0 ? 'Commence aujourd’hui ou plus tard.' : 'Commence au plus tôt ' + dayLabel(addDays(today, minDiff)) + '.';
    if (fromIso(to) < fromIso(from)) return 'La fin doit venir après le début.';
    if (dayDiff(fromIso(to)) > 365) return 'Pas plus d’un an à l’avance.';
    if (rangeDays(from, to).length > MAX_DAYS) return MAX_DAYS + NB + 'jours au plus' + NB + ': raccourcis la période.';
    return '';
  };
  const spanText = function(from, to){
    const n = rangeDays(from, to).length;
    return n > 1 ? n + NB + 'jours, du ' + dayLabel(fromIso(from)) + ' au ' + dayLabel(fromIso(to)) + '.' : '1' + NB + 'jour, ' + dayLabel(fromIso(from)) + '.';
  };
  /* Remplit les champs Du / Au d'un écran, et affiche la période ou ce qui ne va pas */
  const fillRange = function(which, st, minDiff, keepInputs){
    const box = $(which);
    box.querySelectorAll('input[data-range]').forEach(function(el){
      el.min = isoDate(addDays(today, minDiff)); el.max = isoDate(addDays(today, 365));
      if (!keepInputs) el.value = st[el.dataset.end] || '';
    });
    const err = rangeError(st.from, st.to, minDiff);
    $(which + '-err').textContent = err;
    $(which + '-span').textContent = err ? '' : spanText(st.from, st.to);
    return err;
  };
  /* Champs Du / Au d'une nouvelle planification */
  const rangeInput = function(e){
    const el = e.target;
    if (!el.dataset || el.dataset.range !== 'plan') return;
    planner[el.dataset.end === 'to' ? 'to' : 'from'] = isoOk(el.value) ? el.value : '';
    planFormUpdate();
  };
  document.addEventListener('input', rangeInput);
  document.addEventListener('change', rangeInput);
