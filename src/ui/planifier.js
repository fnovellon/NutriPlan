  /* Planifier (4.0.0) : en haut la planification en cours et la suivante, bien en vue ; « Nouvelle planification » ; puis les
     autres, compactes (à venir, passées). Une planification se crée (ou se modifie) en étapes, écran #wiz : les jours, les
     petits-déjeuners (1 à 3), les collations (1 à 3), les plats (1 à 5, midi et soir) choisis par cartes (recherche dans les
     recettes et les plats simples, « Surprends-moi » complet ou partiel), puis le récap jour par jour avec le repas libre.
     Valider écrit les plats de chaque date (planDays), garde la planification et ouvre ses courses (ui/courses.js). */
  const WIZ_STEPS = ['dates', 'pd', 'co', 'meal', 'recap'];
  const WIZ_T = {dates:'Quels jours' + NB + '?', pd:'Tes petits-déjeuners', co:'Tes collations', meal:'Tes plats', recap:'Ton récap'};
  const wiz = {from:'', to:'', step:0, cards:{pd:[], co:[], meal:[]}, q:'', edit:null, part:null, libre:{}, editing:false};
  /* Premier jour proposé : aujourd'hui, sinon le lendemain des planifications qui couvrent déjà aujourd'hui et la suite */
  const nextFree = function(){
    let d = isoDate(today), p;
    while ((p = planifOf(d)) && dayDiff(fromIso(p.to)) < 365) d = isoDate(addDays(fromIso(p.to), 1));
    return d;
  };
  const resetPlanner = function(){
    const from = nextFree();
    Object.assign(wiz, {from:from, to:isoDate(addDays(fromIso(from), 6)), step:0, cards:{pd:[], co:[], meal:[]}, q:'', edit:null, part:null, libre:{}, editing:false});
  };
  const PRESETS = [['7', 'Les 7 prochains jours'], ['semaine', 'Cette semaine'], ['suivante', 'La semaine prochaine']];
  const presetRange = function(k){
    if (k === 'semaine') return [today, weekOf(today)[6]];
    if (k === 'suivante'){ const w = weekOf(addDays(today, 7)); return [w[0], w[6]]; }
    return [today, addDays(today, 6)];
  };
  /* Un plat : sa recette, sinon son ingrédient principal (« Viande blanche et riz basmati ») */
  const mealMain = function(c){ return PROT[c.prot].label + ' et ' + STARCH[c.starch].name; };
  const mealTitle = function(c){ return c.recette && has(RECIPES, c.recette) ? RECIPES[c.recette].t : mealMain(c); };
  /* Les cartes d'une planification : les siennes, sinon (avant la 4.0.0) celles tirées de ses jours, les plus fréquentes */
  const planifCards = function(p){
    if (p.cards) return p.cards;
    const cnt = {pd:[], co:[], meal:[]}, add = function(k, key, o){ const x = cnt[k].find(function(y){ return y.key === key; }); if (x) x.n++; else cnt[k].push({key:key, n:1, o:o}); };
    rangeDays(p.from, p.to).forEach(function(iso){
      const c = choicesFor(iso, fromIso(iso).getDay()), lib = planFor(iso).libre;
      add('pd', c.pdBase, {id:c.pdBase});
      add('co', (c.co || 'oeufs') + '|' + (c.cs || 'banane'), {id:c.co || 'oeufs', cs:c.cs || 'banane'});
      ['dej', 'diner'].forEach(function(sl){ if (sl === 'diner' && lib) return; const m = c[sl], r = recipeOf(m); add('meal', m.prot + '|' + m.starch + '|' + (r || ''), {prot:m.prot, starch:m.starch, recette:r || null}); });
    });
    const top = function(k){ return cnt[k].slice().sort(function(a, b){ return b.n - a.n; }).map(function(x){ return x.o; }); };
    return cleanCards({pd:top('pd'), co:top('co'), meal:top('meal')});
  };
  /* Une planification en grand (en cours ou la suivante) : quand, ses petits-déjeuners, collations et plats */
  const planCard = function(p, now){
    const n = rangeDays(p.from, p.to).length, c = planifCards(p), d = dayDiff(fromIso(p.from));
    const when = now ? 'En cours, jour ' + (1 - d) + ' sur ' + n : 'À venir, ' + (d === 1 ? 'demain' : 'dans ' + d + NB + 'jours') + ', ' + n + NB + 'jour' + (n > 1 ? 's' : '');
    const row = function(l, a){ return a.length ? '<li><span class="pl-l">' + l + '</span>' + a.join(', ') + '</li>' : ''; };
    return '<article class="pl-card' + (now ? ' is-now' : '') + '" aria-labelledby="plc-' + p.from + '"><p class="pl-when">' + when + '</p>' +
      '<h2 id="plc-' + p.from + '">' + periodTitle(p.from, p.to) + '</h2><ul class="pl-sum">' +
      row('Petits-déjeuners', c.pd.map(function(x){ return PD[x.id].label; })) + row('Collations', c.co.map(function(x){ return SNACK[x.id].label; })) +
      row('Plats', c.meal.map(mealTitle)) + '</ul>' +
      '<button type="button" class="btn' + (now ? ' main' : '') + ' wide" data-action="pl-open" data-value="' + p.from + '|' + p.to + '">Le récap et tes courses</button></article>';
  };
  /* Une planification en compact : ses dates et son nombre de jours */
  const planRow = function(p){
    const n = rangeDays(p.from, p.to).length;
    return '<li><button type="button" class="pl-row" data-action="pl-open" data-value="' + p.from + '|' + p.to + '"><span class="d">' + periodTitle(p.from, p.to) + '</span>' +
      '<span class="k">' + n + NB + 'jour' + (n > 1 ? 's' : '') + '</span></button></li>';
  };
  const renderPlan = function(){
    const t = isoDate(today), now = planifOf(t), future = planifs.filter(function(p){ return p.from > t; });
    const next = future[0] || null, later = future.slice(1), past = planifs.filter(function(p){ return p.to < t; }).reverse();
    const list = function(id, title, a){ return a.length ? '<h2 class="pl-lh" id="' + id + '">' + title + '</h2><ul class="pl-rows" aria-labelledby="' + id + '">' + a.map(planRow).join('') + '</ul>' : ''; };
    $('plan-body').innerHTML = (now ? planCard(now, true) : '') + (next ? planCard(next, false) : '') +
      (now || next ? '' : '<p class="repas-p">Aucune planification en cours. Choisis tes jours, puis quelques petits-déjeuners, collations et plats' + NB + ': l’appli les répartit sur les jours et fait ta liste de courses.</p>') +
      '<button type="button" class="btn main wide pl-new" id="pl-new" data-action="pl-new">Nouvelle planification</button>' +
      list('pl-later', 'À venir', later) + list('pl-past', 'Passées', past);
  };

  /* Assistant (écran #wiz) */
  const isos = function(){ return rangeDays(wiz.from, wiz.to); };
  /* Les jours de la période dont les plats sont déjà choisis : ils seront remplacés */
  const planOver = function(){
    if (rangeError(wiz.from, wiz.to, 0)) return '';
    const n = isos().filter(function(iso){ const r = store.plans[iso]; return r && typeof r === 'object' && has(r, 'ch'); }).length;
    return n ? (n > 1 ? n + NB + 'jours ont' : '1' + NB + 'jour a') + ' déjà ses plats' + NB + ': ils seront remplacés. Tes séances restent.' : '';
  };
  /* Période et raccourcis, sans redessiner les champs (frappe en cours) */
  const planFormUpdate = function(){
    fillRange('wiz', wiz, 0, true);
    $('wiz').querySelectorAll('[data-action="wiz-preset"]').forEach(function(b){ const r = presetRange(b.dataset.value); b.setAttribute('aria-pressed', String(isoDate(r[0]) === wiz.from && isoDate(r[1]) === wiz.to)); });
    $('wiz-over').textContent = planOver();
  };
  /* Recherche sans accents ni majuscules ; tous les mots doivent y être */
  const fold = function(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’']/g, ' '); };
  const matches = function(text, q){ const t = fold(text); return fold(q).split(/\s+/).filter(Boolean).every(function(w){ return t.indexOf(w) >= 0; }); };
  /* Ce qu'on peut choisir à une étape : { key, card, title, sub, text (pour la recherche) } */
  const pdItems = function(){
    return allowed('pd', cleanProfile(prof).off).map(function(id){ return {key:id, card:{id:id}, title:PD[id].label, sub:PD[id].sub || '', text:PD[id].label + ' ' + (PD[id].sub || '')}; });
  };
  const coItems = function(){
    return SNACK_ORDER.map(function(id){ return {key:id, card:{id:id, cs:'banane'}, title:SNACK[id].label, sub:SNACK[id].sub || '', text:SNACK[id].label + ' ' + (SNACK[id].sub || '')}; });
  };
  const mealKey = function(c){ return c.prot + '|' + c.starch + '|' + (c.recette || ''); };
  const mealItems = function(){
    const pr = cleanProfile(prof), out = [];
    allowed('prot', pr.off).forEach(function(p){
      allowed('starch', pr.off).forEach(function(s){
        const more = ' ' + (PROT[p].sub || '') + ' ' + STARCH[s].label;
        recipesFor(p, s).forEach(function(id){
          if (recipePref(id, pr) === 0) return;
          const c = {prot:p, starch:s, recette:id};
          out.push({key:mealKey(c), card:c, title:RECIPES[id].t, sub:mealMain(c) + ', ' + RECIPES[id].min + NB + 'min', text:RECIPES[id].t + ' ' + mealMain(c) + more + ' recette'});
        });
        const c = {prot:p, starch:s, recette:null};
        out.push({key:mealKey(c), card:c, title:mealTitle(c), sub:'Plat simple' + NB + ': des légumes et ta marge cuisine', text:mealTitle(c) + more + ' plat simple'});
      });
    });
    return out;
  };
  const cardKey = function(kind, c){ return kind === 'meal' ? mealKey(c) : c.id; };
  const stepKind = function(){ return WIZ_STEPS[wiz.step]; };
  /* Une carte : l'ingrédient principal, le nom de la recette s'il y en a une, « Surprise », et ses boutons */
  const cardHTML = function(kind, c, i){
    const btn = function(action, label, aria){ return '<button type="button" class="reset" id="wc-' + action + '-' + i + '" data-action="wiz-' + action + '" data-value="' + i + '"' + (aria ? ' aria-label="' + aria + '"' : '') + '>' + label + '</button>'; };
    let main, t = '', extra = '';
    if (kind === 'pd'){ main = PD[c.id].label; t = PD[c.id].sub || ''; }
    else if (kind === 'co'){
      main = SNACK[c.id].label;
      if (c.id === 'rizaulait') t = SNACK[c.id].sub;
      else extra = '<div class="opt-row wc-cs"><span class="lbl" id="wcs-' + i + '">Jours de séance</span><div class="seg" role="group" aria-labelledby="wcs-' + i + '">' +
        SNACK_CS_ORDER.map(function(x){ return '<button type="button" data-action="wiz-cs" data-value="' + i + '|' + x + '" aria-pressed="' + (c.cs === x) + '">' + SNACK_CS[x].label + '</button>'; }).join('') + '</div></div>';
    } else { main = mealMain(c); t = c.recette ? RECIPES[c.recette].t : 'Plat simple'; }
    const pr = cleanProfile(prof), name = kind === 'meal' ? mealTitle(c) : main;
    const recs = kind === 'meal' && !c.recette ? recipesFor(c.prot, c.starch).filter(function(id){ return recipePref(id, pr) > 0; }) : [];
    const sw = kind === 'meal' ? (c.recette ? btn('simple', 'En plat simple') : recs.length ? btn('recette', 'En recette') : '') : '';
    return '<li class="wcard' + (wiz.edit === i ? ' is-edit' : '') + '"><span class="wc-m">' + main + (c.s ? '<span class="wc-s">Surprise</span>' : '') + '</span>' +
      (t ? '<span class="wc-t">' + t + '</span>' : '') + extra + '<div class="wc-a">' +
      (wiz.edit === i ? btn('edit-no', 'Garder', 'Garder ' + name) : btn('edit', 'Changer', 'Changer ' + name)) + sw +
      (c.s ? btn('again', 'Une autre', 'Une autre surprise à la place de ' + name) : '') + btn('rm', 'Retirer', 'Retirer ' + name) + '</div></li>';
  };
  const resultsHTML = function(){
    const kind = stepKind(), cards = wiz.cards[kind], items = kind === 'pd' ? pdItems() : kind === 'co' ? coItems() : mealItems();
    if (kind === 'meal' && !wiz.q.trim()){
      /* Sans recherche : les protéines en raccourcis */
      return '<p class="calc">Cherche une recette, une protéine ou un féculent, ou commence par une protéine' + NB + ':</p><div class="opts-list">' +
        allowed('prot', cleanProfile(prof).off).map(function(p){ return '<button type="button" class="opt" data-action="wiz-qp" data-value="' + p + '">' + PROT[p].label + '</button>'; }).join('') + '</div>';
    }
    const found = items.filter(function(x){ return matches(x.text, wiz.q); }), max = 40;
    if (!found.length) return '<p class="calc">Rien ne correspond à «' + NB + wiz.q.trim() + NB + '».</p>';
    return '<ul class="wres">' + found.slice(0, max).map(function(x){
      const on = cards.some(function(c){ return cardKey(kind, c) === x.key; });
      return '<li><button type="button" class="wr" data-action="wiz-pick" data-value="' + x.key + '" aria-pressed="' + on + '"><span class="wr-t">' + x.title + '</span>' +
        (x.sub ? '<span class="wr-s">' + x.sub + '</span>' : '') + '</button></li>';
    }).join('') + '</ul>' + (found.length > max ? '<p class="calc">Et ' + (found.length - max) + ' autres' + NB + ': affine ta recherche.</p>' : '');
  };
  /* Le récap : un jour par ligne, ses repas, et le repas libre à cocher */
  const recapPlan = function(){ return planDays(isos().map(function(iso){ return {libre:!!wiz.libre[iso]}; }), wiz.cards); };
  const recapHTML = function(){
    const all = isos(), pl = recapPlan();
    return '<p class="calc">Les plats tournent sur les jours, jamais la même protéine midi et soir si c’est possible. Touche «' + NB + 'Libre' + NB + '» pour le repas libre d’un soir (un par semaine).</p>' +
      '<table class="wiz-t"><thead><tr><th scope="col">Jour</th><th scope="col">Repas</th><th scope="col">Libre</th></tr></thead><tbody>' + all.map(function(iso, j){
        const d = fromIso(iso), x = pl[j], lib = !!wiz.libre[iso];
        const li = function(l, v){ return '<span class="wt-r"><span class="wt-l">' + l + '</span> ' + v + '</span>'; };
        return '<tr' + (lib ? ' class="is-lib"' : '') + '><th scope="row"><span class="wt-d">' + cap(d.toLocaleDateString('fr-FR', {weekday:'short'})) + '</span> ' + d.getDate() + '</th><td>' +
          li('Matin', PD[x.pdBase].label) + li('Midi', mealTitle(x.dej)) + li('Collation', SNACK[x.co].label) + li('Soir', lib ? 'Repas libre' : mealTitle(x.diner)) + '</td>' +
          '<td><button type="button" class="wt-sw" role="switch" id="wl-' + iso + '" aria-checked="' + lib + '" data-action="wiz-libre" data-value="' + iso + '" aria-label="Repas libre ' + dayLabel(d) + ' soir"><span class="knob" aria-hidden="true"></span></button></td></tr>';
      }).join('') + '</tbody></table>';
  };
  const STEP_TEXT = {
    pd:'De 1 à 3' + NB + ': ils tournent d’un jour à l’autre. Les jours de sortie longue, un petit-déjeuner salé laisse la place à la version sucrée.',
    co:'De 1 à 3, elles aussi en alternance. Les jours de séance, la collation a aussi ses glucides' + NB + ': choisis-les sur chaque carte.',
    meal:'De 1 à 5 plats, pour les midis et les soirs' + NB + ': chacun revient autant de fois, répartis sur les jours.'
  };
  const renderWiz = function(){
    const k = stepKind(), last = wiz.step === WIZ_STEPS.length - 1;
    $('wiz-step').textContent = 'Étape ' + (wiz.step + 1) + ' sur ' + WIZ_STEPS.length + (wiz.editing ? ', modification' : '');
    $('wiz-h').textContent = WIZ_T[k];
    $('wiz-back').textContent = wiz.step === 0 || (wiz.editing && wiz.step === 1) ? 'Annuler' : 'Retour';
    $('wiz-next').textContent = last ? 'Valider' : 'Suivant';
    let html = '';
    if (k === 'dates'){
      html = '<div class="opts-list plan-presets" role="group" aria-label="Raccourcis">' + PRESETS.map(function(p){
        const r = presetRange(p[0]), on = isoDate(r[0]) === wiz.from && isoDate(r[1]) === wiz.to;
        return '<button type="button" class="opt" data-action="wiz-preset" data-value="' + p[0] + '" aria-pressed="' + on + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
        '<div class="fields plan-dates"><label class="field"><span>Du</span><span class="inp"><input type="date" data-range="wiz" data-end="from"></span></label>' +
        '<label class="field"><span>Au</span><span class="inp"><input type="date" data-range="wiz" data-end="to"></span></label></div>' +
        '<p class="calc" id="wiz-span"></p><p class="warn" id="wiz-err" role="alert"></p><p class="warn" id="wiz-over"></p>' +
        (Object.keys(semOf().jours).length ? '<p class="calc">Les jours gardent leurs séances, celles de ta semaine type s’ils ne sont pas encore remplis.</p>' : '');
    } else if (k === 'recap') html = recapHTML();
    else {
      const cards = wiz.cards[k], max = PLAN_MAX[k], ed = wiz.edit !== null && cards[wiz.edit];
      html = '<p class="calc">' + STEP_TEXT[k] + '</p>' +
        (cards.length ? '<ul class="wcards" aria-label="Tes choix">' + cards.map(function(c, i){ return cardHTML(k, c, i); }).join('') + '</ul>' : '<p class="wc-none">Rien de choisi pour l’instant.</p>') +
        '<p class="calc wc-n">' + cards.length + ' sur ' + max + (ed ? '. Choisis ce qui remplace «' + NB + (k === 'meal' ? mealTitle(ed) : (k === 'pd' ? PD : SNACK)[ed.id].label) + NB + '».' : '') + '</p>' +
        '<div class="wsur"><button type="button" class="btn" id="wiz-sur" data-action="wiz-sur" data-value="full">Surprends-moi</button>' +
        (k === 'meal' ? '<button type="button" class="reset" data-action="wiz-part" data-value="prot" aria-pressed="' + (wiz.part === 'prot') + '">Je choisis la protéine</button>' +
          '<button type="button" class="reset" data-action="wiz-part" data-value="starch" aria-pressed="' + (wiz.part === 'starch') + '">Je choisis le féculent</button>' : '') + '</div>' +
        (k === 'meal' && wiz.part ? '<div class="wpart"><p class="calc">' + (wiz.part === 'prot' ? 'Quelle protéine' + NB + '? Le féculent et la recette seront tirés au hasard.' : 'Quel féculent' + NB + '? La protéine et la recette seront tirées au hasard.') + '</p>' +
          '<div class="opts-list">' + allowed(wiz.part, cleanProfile(prof).off).map(function(x){ return '<button type="button" class="opt" data-action="wiz-sur" data-value="' + wiz.part + '|' + x + '">' + (wiz.part === 'prot' ? PROT : STARCH)[x].label + '</button>'; }).join('') + '</div></div>' : '') +
        (k === 'co' ? '' : '<label class="field wiz-q"><span>Chercher</span><span class="inp"><input type="search" id="wiz-q" autocomplete="off" enterkeyhint="search" placeholder="' + (k === 'meal' ? 'poulet, riz, curry…' : 'avoine, œufs…') + '"></span></label>') +
        '<div id="wiz-res" aria-live="polite">' + resultsHTML() + '</div>';
    }
    $('wiz-body').innerHTML = html;
    if (k === 'dates'){ fillRange('wiz', wiz, 0, false); $('wiz-over').textContent = planOver(); }
    if ($('wiz-q')) $('wiz-q').value = wiz.q;
  };
  /* Redessiné, le focus revient sur le bouton qui a la même action et la même valeur (sinon sur fallback, sinon le titre) */
  const wizKeep = function(b, fallback){
    renderWiz();
    const same = b && [...$('wiz-body').querySelectorAll('[data-action="' + b.dataset.action + '"]')].find(function(x){ return x.dataset.value === b.dataset.value; });
    (same || (fallback && $(fallback)) || $('wiz-h')).focus({preventScroll:true});
  };
  const wizGo = function(step){
    wiz.step = step; wiz.q = ''; wiz.edit = null; wiz.part = null; $('wiz-msg').textContent = '';
    renderWiz();
    scroller().scrollTop = 0;
    $('wiz-h').focus({preventScroll:true});
  };
  /* Les jours de la période gardent leur repas libre (enregistré ou de la semaine type), un par semaine */
  const wizLibre = function(){
    const keep = {};
    isos().forEach(function(iso){ keep[iso] = has(wiz.libre, iso) ? wiz.libre[iso] : planFor(iso).libre; });
    wiz.libre = keep;
  };
  /* Ajoute une carte (ou remplace celle en cours de changement) : '' si c'est fait, sinon pourquoi pas */
  const wizAdd = function(kind, c){
    const cards = wiz.cards[kind], i = cards.findIndex(function(x){ return cardKey(kind, x) === cardKey(kind, c); });
    if (wiz.edit !== null && cards[wiz.edit]){
      if (i >= 0 && i !== wiz.edit) return 'Déjà dans tes choix.';
      if (kind === 'co') c.cs = cards[wiz.edit].cs;
      cards[wiz.edit] = c; wiz.edit = null;
      return '';
    }
    if (i >= 0) return 'Déjà dans tes choix.';
    if (cards.length >= PLAN_MAX[kind]) return PLAN_MAX[kind] + ' au plus' + NB + ': retire une carte ou touche «' + NB + 'Changer' + NB + '».';
    cards.push(c);
    return '';
  };
  const surprise = function(kind, fix, others){
    const pr = cleanProfile(prof);
    if (kind === 'pd') return surprisePd(others, pr.off);
    if (kind === 'co') return surpriseCo(others);
    return surpriseMeal(others, fix, pr.off, pr);
  };
  /* Valider : le repas libre de chaque jour, enregistré tel que le récap le montre (un par semaine, aussi hors de la
     période), puis les plats de chaque date (le dessert reste), arrondis aux 100 g sur les boîtes des recettes qui reviennent
     (batchRound) ; la planification est gardée et ses courses s'ouvrent */
  const wizSave = function(){
    const all = isos(), pl = recapPlan(), msgs = [];
    all.forEach(function(iso){
      const on = !!wiz.libre[iso];
      writeDay(iso, {libre:on});
      if (!on) return;
      weekOf(fromIso(iso)).forEach(function(d){ const x = isoDate(d); if (all.indexOf(x) < 0 && planFor(x).libre){ writeDay(x, {libre:false}); msgs.push(dayLabel(d)); } });
    });
    const chs = all.map(function(iso, j){
      const js = fromIso(iso).getDay(), old = choicesFor(iso, js), x = pl[j], c = {pdBase:x.pdBase, co:x.co, cs:x.cs};
      ['dej', 'diner'].forEach(function(sl){ c[sl] = Object.assign({dessert:dessertOf(old[sl])}, x[sl]); });
      return {plan:planFor(iso), ch:cleanCh(c, js)};
    });
    batchRound(chs, prof).forEach(function(c, j){ const js = fromIso(all[j]).getDay(), cc = cleanCh(c, js); writeDay(all[j], {ch:cc}); store.choices[js] = cc; });
    persist();
    const p = {from:wiz.from, to:wiz.to, cards:cleanCards(wiz.cards), checked:[]};
    addPlanif(p);
    return {p:p, moved:msgs};
  };
  /* Ouvre l'assistant : nouvelle planification, ou modification de p (à partir d'aujourd'hui, ses cartes) */
  const openWiz = function(p, opener){
    resetPlanner();
    if (p){
      const t = isoDate(today);
      Object.assign(wiz, {from:p.from < t ? t : p.from, to:p.to, cards:JSON.parse(JSON.stringify(planifCards(p))), editing:true, step:1});
    }
    $('wiz-msg').textContent = '';
    renderWiz();
    openScreen('wiz', opener);
  };
  /* Actions de Planifier et de l'assistant */
  Object.assign(ACTIONS, {
    plan: function(b){ if (topScreen() === 'plan') return; $('plan-msg').textContent = ''; renderPlan(); navTo('plan', b); },
    'pl-open': function(b, v){
      const q = String(v).split('|'), p = planifs.find(function(x){ return x.from === q[0] && x.to === q[1]; });
      if (p) openPlanif(p, b);
    },
    'pl-new': function(b){ openWiz(null, b); },
    'wiz-preset': function(b, v){
      const r = presetRange(v);
      wiz.from = isoDate(r[0]); wiz.to = isoDate(r[1]);
      wizKeep(b);
    },
    'wiz-back': function(){ if (wiz.step === 0 || (wiz.editing && wiz.step === 1)) closeScreen(false); else wizGo(wiz.step - 1); },
    'wiz-next': function(){
      const k = stepKind();
      if (k === 'dates'){ if (fillRange('wiz', wiz, 0, true)){ $('wiz').querySelector('input[data-range]').focus(); return; } }
      else if (k !== 'recap' && !wiz.cards[k].length){
        $('wiz-msg').textContent = k === 'pd' ? 'Choisis au moins un petit-déjeuner, ou laisse-moi te surprendre.' : k === 'co' ? 'Choisis au moins une collation, ou laisse-moi te surprendre.' : 'Choisis au moins un plat, ou laisse-moi te surprendre.';
        $('wiz-sur').focus({preventScroll:true});
        return;
      }
      if (k !== 'recap'){ if (k === 'meal') wizLibre(); wizGo(wiz.step + 1); return; }
      if (rangeError(wiz.from, wiz.to, 0)){ wizGo(0); return; }
      const r = wizSave();
      loadSel(); prevQty = new Map(); render();
      renderPlan();
      cur = r.p; renderCourses();
      /* Modifiée : retour à son détail ; créée : son détail à la place de l'assistant */
      if (wiz.editing) closeScreen(false); else replaceScreen('courses');
      $('courses-msg').textContent = (wiz.editing ? 'Planification modifiée.' : 'Planification créée.') +
        (r.moved.length ? ' Un seul repas libre par semaine' + NB + ': ' + (r.moved.length > 1 ? 'ceux de ' : 'celui de ') + r.moved.join(' et de ') + (r.moved.length > 1 ? ' sont retirés.' : ' est retiré.') : '') + ' Voici tes courses.';
      resetPlanner();
      const h = $('courses-list-t');
      if (h.scrollIntoView) h.scrollIntoView({block:'start'});
      h.focus({preventScroll:true});
    },
    'wiz-pick': function(b, v){
      const k = stepKind();
      if (k !== 'pd' && k !== 'meal' && k !== 'co') return;
      const items = k === 'pd' ? pdItems() : k === 'co' ? coItems() : mealItems(), x = items.find(function(y){ return y.key === v; });
      if (!x) return;
      const cards = wiz.cards[k], i = cards.findIndex(function(c){ return cardKey(k, c) === v; });
      /* Déjà choisi (et pas en train d'en changer un) : le toucher le retire */
      if (i >= 0 && wiz.edit === null){ cards.splice(i, 1); $('wiz-msg').textContent = x.title + NB + ': retiré.'; renderWiz(); $('wiz-res').querySelector('[data-value="' + v + '"]').focus({preventScroll:true}); return; }
      const was = wiz.edit, msg = wizAdd(k, JSON.parse(JSON.stringify(x.card)));
      $('wiz-msg').textContent = msg || x.title + NB + (was !== null ? ': à la place.' : ': ajouté.');
      renderWiz();
      const again = $('wiz-res') && $('wiz-res').querySelector('[data-value="' + v + '"]');
      (again || $('wiz-h')).focus({preventScroll:true});
    },
    'wiz-qp': function(b, v){ if (!has(PROT, v)) return; wiz.q = PROT[v].label; renderWiz(); $('wiz-q').focus({preventScroll:true}); },
    /* Surprends-moi : complet (full), ou partiel (prot|id, starch|id) pour les plats ; tiré une fois, puis comme les autres */
    'wiz-sur': function(b, v){
      const k = stepKind();
      if (k !== 'pd' && k !== 'meal' && k !== 'co') return;
      const q = String(v).split('|'), fix = {};
      if (q[0] === 'prot' || q[0] === 'starch'){ if (k !== 'meal' || !has(q[0] === 'prot' ? PROT : STARCH, q[1])) return; fix[q[0]] = q[1]; }
      else if (q[0] !== 'full') return;
      const others = wiz.cards[k].filter(function(c, i){ return i !== wiz.edit; });
      const c = surprise(k, fix, others), msg = wizAdd(k, c);
      if (!msg) wiz.part = null;
      $('wiz-msg').textContent = msg === 'Déjà dans tes choix.' ? 'La surprise est déjà dans tes choix' + NB + ': réessaie.' : msg ||
        'Surprise' + NB + ': ' + (k === 'meal' ? mealTitle(c) : (k === 'pd' ? PD : SNACK)[c.id].label) + '.';
      wizKeep(b, 'wiz-sur');
    },
    'wiz-part': function(b, v){ if (v !== 'prot' && v !== 'starch') return; wiz.part = wiz.part === v ? null : v; wizKeep(b); },
    'wiz-edit': function(b, v){ const k = stepKind(); if (!wiz.cards[k] || !wiz.cards[k][+v]) return; wiz.edit = +v; $('wiz-msg').textContent = ''; renderWiz(); ($('wiz-q') || $('wiz-sur')).focus({preventScroll:true}); },
    'wiz-edit-no': function(b, v){ wiz.edit = null; renderWiz(); ($('wc-edit-' + v) || $('wiz-h')).focus({preventScroll:true}); },
    'wiz-rm': function(b, v){
      const k = stepKind(), cards = wiz.cards[k];
      if (!cards || !cards[+v]) return;
      cards.splice(+v, 1); wiz.edit = null;
      $('wiz-msg').textContent = 'Carte retirée.';
      renderWiz();
      ($('wc-rm-' + Math.min(+v, cards.length - 1)) || $('wiz-sur')).focus({preventScroll:true});
    },
    /* Une autre surprise à la place de celle-ci, avec la même partie choisie */
    'wiz-again': function(b, v){
      const k = stepKind(), cards = wiz.cards[k], c = cards && cards[+v];
      if (!c || !c.s) return;
      const fix = c.s === 'prot' ? {prot:c.prot} : c.s === 'starch' ? {starch:c.starch} : {};
      const others = cards.filter(function(x, i){ return i !== +v; });
      let n = null;
      for (let t = 0; t < 20 && (!n || cardKey(k, n) === cardKey(k, c)); t++) n = surprise(k, fix, others.concat([c]));
      if (cardKey(k, n) === cardKey(k, c) || others.some(function(x){ return cardKey(k, x) === cardKey(k, n); })){ $('wiz-msg').textContent = 'Pas d’autre surprise possible.'; return; }
      if (k === 'co') n.cs = c.cs;
      cards[+v] = n;
      $('wiz-msg').textContent = 'Surprise' + NB + ': ' + (k === 'meal' ? mealTitle(n) : (k === 'pd' ? PD : SNACK)[n.id].label) + '.';
      wizKeep(b);
    },
    /* Plat simple ↔ recette (la recette du couple tirée selon tes préférences) */
    'wiz-simple': function(b, v){
      const c = wiz.cards.meal[+v];
      if (stepKind() !== 'meal' || !c || !c.recette) return;
      const n = Object.assign({}, c, {recette:null});
      if (wiz.cards.meal.some(function(x, i){ return i !== +v && mealKey(x) === mealKey(n); })){ $('wiz-msg').textContent = 'Ce plat simple est déjà dans tes choix.'; return; }
      wiz.cards.meal[+v] = n;
      $('wiz-msg').textContent = mealTitle(n) + NB + ': en plat simple.';
      wizKeep(b, 'wc-recette-' + v);
    },
    'wiz-recette': function(b, v){
      const c = wiz.cards.meal[+v], pr = cleanProfile(prof);
      if (stepKind() !== 'meal' || !c || c.recette) return;
      const recs = recipesFor(c.prot, c.starch).filter(function(id){ return recipePref(id, pr) > 0 && !wiz.cards.meal.some(function(x){ return x.recette === id; }); });
      if (!recs.length){ $('wiz-msg').textContent = 'Les recettes de ce plat sont déjà dans tes choix.'; return; }
      const n = Object.assign({}, c, {recette:tieredPick(Math.random, recs, function(id){ return recipePref(id, pr); })});
      wiz.cards.meal[+v] = n;
      $('wiz-msg').textContent = 'En recette' + NB + ': ' + RECIPES[n.recette].t + '.';
      wizKeep(b, 'wc-simple-' + v);
    },
    'wiz-cs': function(b, v){
      const q = String(v).split('|'), c = wiz.cards.co[+q[0]];
      if (stepKind() !== 'co' || !c || !has(SNACK_CS, q[1])) return;
      c.cs = q[1];
      wizKeep(b);
    },
    /* Repas libre d'un soir : un par semaine (lundi → dimanche) dans la période */
    'wiz-libre': function(b, v){
      if (stepKind() !== 'recap' || !has(wiz.libre, v)) return;
      const on = !wiz.libre[v], moved = [];
      if (on) weekOf(fromIso(v)).forEach(function(d){
        const x = isoDate(d);
        if (x === v) return;
        if (wiz.libre[x]){ wiz.libre[x] = false; moved.push(dayLabel(d)); }
        else if (!has(wiz.libre, x) && planFor(x).libre) moved.push(dayLabel(d));
      });
      wiz.libre[v] = on;
      $('wiz-msg').textContent = (on ? 'Repas libre ' + dayLabel(fromIso(v)) + ' soir.' : 'Plus de repas libre ' + dayLabel(fromIso(v)) + '.') +
        (moved.length ? ' Un seul par semaine' + NB + ': ' + (moved.length > 1 ? 'ceux de ' : 'celui de ') + moved.join(' et de ') + (moved.length > 1 ? ' seront retirés.' : ' sera retiré.') : '');
      wizKeep(b);
    }
  });
  /* Recherche : seuls les résultats sont redessinés (la frappe continue) */
  document.addEventListener('input', function(e){
    if (!e.target || e.target.id !== 'wiz-q') return;
    wiz.q = e.target.value.slice(0, 60);
    $('wiz-res').innerHTML = resultsHTML();
  });
