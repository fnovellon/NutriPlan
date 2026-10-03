  /* « Ta semaine » (page) et tirages équilibrés : repères du reste de la semaine d'une date, phrase, alerte d'un choix. */
  const dayResult = function(iso){ return buildDay(planFor(iso), choicesFor(iso, fromIso(iso).getDay()), prof); };
  /* Repères de la semaine (lundi → dimanche) d'une date, sans le jour skip (celui qu'on tire au hasard) */
  const weekBal = function(d, skip){ return weekBalance(weekOf(d).map(isoDate).filter(function(iso){ return iso !== skip; }).map(dayResult)); };
  /* « Décide pour moi » d'une date : équilibré avec le reste de sa semaine */
  const drawFor = function(iso){ const pr = cleanProfile(prof); return randomChoices(null, pr.off, weekBal(fromIso(iso), iso), scaleOf(pr)); };
  const gr = function(x){ return '≈' + NB + Math.round(x / 10) * 10 + NB + 'g'; };
  /* Ce qui manque ou déborde, en une phrase */
  const weekMsg = function(b){
    const n = weekNeeds(b)[0], left = function(x, one, two){ return x === 1 ? one : two; };
    if (n === 'charcuterie') return 'Trop de charcuterie (' + gr(b.charcuterie) + ', 150' + NB + 'g au plus)' + NB + ': préfère le petit-déjeuner sucré et une autre protéine que les œufs-jambon.';
    if (n === 'rouge') return 'Beaucoup de viande rouge (' + gr(b.rouge) + ' cuits, 500' + NB + 'g au plus)' + NB + ': alterne avec la volaille, le poisson ou le tofu.';
    if (n === 'gras') return 'Il te manque un poisson gras (saumon, maquereau, sardines).';
    if (n === 'poisson') return left(WEEK_GOALS.poisson - b.poisson, 'Encore un poisson à prévoir.', 'Encore deux poissons à prévoir.');
    if (n === 'legumes') return left(WEEK_GOALS.legumes - b.legumes, 'Pense aux légumes secs, encore une fois (lentilles, haricots rouges, pois chiches).', 'Pense aux légumes secs, encore deux fois (lentilles, haricots rouges, pois chiches).');
    return 'Elle est équilibrée, bravo.';
  };
  const renderWeek = function(){
    const b = weekBal(selDate), needs = weekNeeds(b), over = needs[0] === 'charcuterie' || needs[0] === 'rouge';
    $('wb-msg').textContent = weekMsg(b);
    $('wk-bal').classList.toggle('is-over', over);
    $('wk-bal').classList.toggle('is-ok', !needs.length);
    const row = function(state, label, val, sr){ return '<li class="is-' + state + '"><span>' + label + '</span><b>' + val + '<span class="sr"> (' + sr + ')</span></b></li>'; };
    const goal = function(x, g){ return x >= g ? ['ok', 'atteint'] : ['todo', 'à prévoir']; };
    const lim = function(x, g){ return x > g + 0.5 ? ['over', 'dépassé'] : ['ok', 'respecté']; };
    const fish = goal(b.poisson, 2), fat = goal(b.gras, 1), leg = goal(b.legumes, 2), red = lim(b.rouge, 500), ham = lim(b.charcuterie, 150);
    $('wb-list').innerHTML = row(fish[0], 'Poisson', b.poisson + ' sur 2', fish[1]) + row(fat[0], 'dont poisson gras', b.gras + ' sur 1', fat[1]) +
      row(leg[0], 'Légumes secs', b.legumes + ' sur 2', leg[1]) + row(red[0], 'Viande rouge, cuite', gr(b.rouge) + ', 500' + NB + 'g au plus', red[1]) +
      row(ham[0], 'Charcuterie', gr(b.charcuterie) + ', 150' + NB + 'g au plus', ham[1]);
  };
  /* Un choix qui fait dépasser la viande rouge ou la charcuterie de la semaine : on le dit tout de suite */
  const crossMsg = function(before, after){
    if (after.charcuterie > WEEK_GOALS.charcuterie + 0.5 && before.charcuterie <= WEEK_GOALS.charcuterie + 0.5)
      return 'Ça fait ' + gr(after.charcuterie) + ' de charcuterie cette semaine, 150' + NB + 'g au plus' + NB + ': le petit-déjeuner sucré ou une autre protéine équilibreraient.';
    if (after.rouge > WEEK_GOALS.rouge + 0.5 && before.rouge <= WEEK_GOALS.rouge + 0.5)
      return 'Ça fait ' + gr(after.rouge) + ' de viande rouge cuite cette semaine, 500' + NB + 'g au plus' + NB + ': alterne avec la volaille, le poisson ou le tofu.';
    return '';
  };
