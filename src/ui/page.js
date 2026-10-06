  /* Page du jour : choix des plats en bulles, lignes des repas, recettes, séances en pastilles, frise et carte du repas
     affiché, total et note, dessin de la page (render). */
  /* Choix des plats : seule la sélection est affichée, dans une bulle ; la toucher ouvre le panneau des choix */
  const REPAS = {dej:'du déjeuner', diner:'du dîner'};
  /* Choix possibles d'une rangée ; src : les choix affichés (ceux du jour, ou le brouillon du formulaire des repas) */
  /* Libellé d'un aliment au choix (et ce qu'il regroupe) */
  const labelOf = function(kind, id){
    const x = kind === 'pd' ? PD[id] : kind === 'prot' ? PROT[id] : kind === 'starch' ? STARCH[id] : DESSERT[id];
    return {label:x.label, sub:x.sub || null};
  };
  /* Les aliments proposés (réglages) ; le choix actuel reste affiché même s'il n'est plus proposé */
  const pickDef = function(kind, slot, src){
    const c = src || ch, off = cleanProfile(prof).off;
    const cur = kind === 'pd' ? c.pdBase : kind === 'dessert' ? dessertOf(c[slot]) : c[slot][kind];
    const all = kind === 'pd' ? PD_ORDER : kind === 'prot' ? PROT_ORDER : kind === 'starch' ? STARCH_ORDER : DESSERT_ORDER, ok = allowed(kind, off);
    const opts = all.filter(function(id){ return id === cur || ok.indexOf(id) >= 0; }).map(function(id){ const l = labelOf(kind, id); return [id, l.label, l.sub]; });
    const LABEL = {pd:'Base', prot:'Protéine', starch:'Féculent', dessert:'Dessert'};
    return {label:LABEL[kind], title:kind === 'pd' ? 'Base du petit-déjeuner' : LABEL[kind] + ' ' + REPAS[slot], action:kind, current:cur, opts:opts};
  };
  const REDO = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
  const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  /* Un choix : la sélection dans une bulle (les bulles d'un repas côte à côte, 3.20.0 ; le libellé n'est lu que par le
     lecteur d'écran) ; la toucher ouvre le panneau des choix.
     ctx : page (choix du jour affiché) ou repas (brouillon du formulaire) */
  const PFX = {page:'', repas:'r'};
  const selRow = function(kind, slot, src, ctx){
    const P = pickDef(kind, slot, src), id = PFX[ctx] + kind + (slot ? '-' + slot : '');
    const cur = P.opts.find(function(o){ return o[0] === P.current; });
    /* Sans dessert : une bulle en contour, « + Dessert » */
    const none = kind === 'dessert' && P.current === 'aucun';
    return '<div class="pick"><span class="pick-l sr" id="l-' + id + '">' + P.label + '</span>' +
      '<button type="button" class="sel' + (none ? ' empty' : '') + '" id="sel-' + id + '" data-action="open-pick" data-ctx="' + ctx + '" data-kind="' + kind + '"' + (slot ? ' data-slot="' + slot + '"' : '') +
      ' data-value="' + P.current + '" aria-haspopup="dialog"' + (none ? ' aria-label="Dessert' + NB + ': aucun"><span>+' + NB + 'Dessert</span>' : ' aria-labelledby="l-' + id + ' sel-' + id + '"><span>' + cur[1] + '</span>' + CHEVRON) + '</button></div>';
  };
  const pickRow = function(kind, slot){ return selRow(kind, slot, ch, 'page'); };
  /* Calories et macros d'un aliment, en petit sous son nom */
  const macHTML = function(m){
    const g = function(cls, letter, title, v){ return '<span class="' + cls + '"><abbr title="' + title + '">' + letter + '</abbr>' + NB + Math.round(v) + NB + 'g</span>'; };
    return '<span class="mac"><span>' + fmtInt(m.kcal) + NB + 'kcal</span>' + g('p', 'P', 'protéines', m.p) + g('c', 'G', 'glucides', m.c) + g('f', 'L', 'lipides', m.f) + '</span>';
  };
  const itemHTML = function(secId, i, next){
    const key = secId + ':' + i.key, val = i.qty + '|' + i.name;
    const changed = prevQty.has(key) && prevQty.get(key) !== val;
    next.set(key, val);
    const q = '<span class="q"><span class="qty' + (changed ? ' bump' : '') + '">' + i.qty + '</span>' +
      (i.cook ? '<span class="ck">' + i.cook.raw + '</span>' +
        i.cook.ways.map(function(w){ return '<span class="ck">≈' + NB + grams(w.g) + ' ' + w.adj + '</span>'; }).join('') : '') + '</span>';
    return '<li>' + q + '<span class="name">' + i.name + (i.key === 'leg' ? ' <span class="vol">à volonté</span>' : '') + (i.note ? '<span class="note">' + i.note + '</span>' : '') +
      (i.m && i.key !== 'lib' && i.key !== 'marge' && i.key !== 'encas' ? macHTML(i.m) : '') + '</span></li>';
  };
  /* Recette d'un repas (pas au repas libre). Proposée : sous les lignes du repas, « Suggestion : … », « Voir la recette » et
     « Choisir ». Choisie (3.14.0) : en tête du repas, à la place de ses ingrédients (détaillés dans sa fiche) : titre, temps,
     calories et macros de la recette (tout le repas sauf dessert et compote), « Voir la recette » et « Retirer ». */
  const RECIPE_OUT = ['des', 'comp'];
  const recipePart = function(s){ return s.items.filter(function(i){ return RECIPE_OUT.indexOf(i.key) < 0; }); };
  const recBtns = function(s, on){
    const of = REPAS[s.id];
    return '<div class="rec-b"><button type="button" class="reset' + (on ? ' is-main' : '') + '" id="rec-v-' + s.id + '" data-action="rec-view" data-slot="' + s.id + '" aria-haspopup="dialog" aria-label="Voir la recette ' + of + '">Voir la recette</button>' +
      '<button type="button" class="reset' + (on ? '' : ' is-main') + '" id="rec-c-' + s.id + '" data-action="' + (on ? 'rec-off' : 'rec-on') + '" data-slot="' + s.id + '"' +
      ' aria-label="' + (on ? 'Retirer la recette ' : 'Choisir la recette ') + of + '">' + (on ? 'Retirer' : 'Choisir') + '</button></div>';
  };
  const recMeta = function(x){ return '<p class="rec-m">' + x.min + NB + 'min' + (x.box ? ', se garde (à emporter)' : '') + '</p>'; };
  const recHTML = function(s){
    if (s.libre || s.recipe || !s.suggest) return '';
    const x = RECIPES[s.suggest];
    return '<div class="rec"><p class="rec-t">Suggestion' + NB + ': <span class="rec-n">' + x.t + '</span></p>' + recMeta(x) + recBtns(s, false) + '</div>';
  };
  /* Recette choisie qui fait partie d'un batch cooking (3.21.0) : « Batch cooking » ouvre sa fiche (ui/courses.js) */
  const recCardHTML = function(s){
    const x = RECIPES[s.recipe], bt = dayBatch[s.id];
    return '<div class="rec is-on"><h3 class="rec-h3">' + x.t + '</h3>' + recMeta(x) + '<p class="rec-k">' + macHTML(total(recipePart(s))) + '</p>' +
      '<p class="rec-vol"><span class="vol">à volonté</span> des légumes en plus si tu as faim (≈' + NB + '30' + NB + 'kcal les 100' + NB + 'g)</p>' + recBtns(s, true) +
      (bt && bt.r.id === s.recipe ? '<button type="button" class="reset rec-batch" id="rec-b-' + s.id + '" data-action="rec-batch" data-slot="' + s.id + '"' +
        ' aria-label="Batch cooking de la recette ' + REPAS[s.id] + '">Batch cooking</button>' : '') + '</div>';
  };
  /* Batch cooking du jour affiché : une recette choisie en fait partie si elle revient au moins deux fois dans son bloc de
     7 jours, ceux de la planification qui contient la date (sinon sa semaine, lundi → dimanche). Pour chaque repas
     concerné : la recette (batchCook), les dates du bloc, lead (0 : cuisinée le premier jour, sinon la veille). Calculé
     une fois par dessin, seulement si un repas a une recette choisie. */
  let dayBatch = {};
  const batchFor = function(iso){
    const p = planifOf(iso), wk = weekOf(fromIso(iso)), from = p ? p.from : isoDate(wk[0]), to = p ? p.to : isoDate(wk[6]);
    const all = rangeDays(from, to), i = all.indexOf(iso), b0 = i - i % BATCH_BLOCK, isos = all.slice(b0, b0 + BATCH_BLOCK);
    const lead = b0 === 0 && dayDiff(fromIso(from)) <= 0 ? 0 : 1, out = {};
    if (i < 0) return out;
    batchCook(isos.map(function(x){ return {res:dayResult(x)}; }), lead).forEach(function(bl){
      bl.recipes.forEach(function(r){ r.boxes.forEach(function(bx){ if (isos[bx.day] === iso) out[bx.slot] = {r:r, isos:isos, lead:lead}; }); });
    });
    return out;
  };
  /* Repas mangés (3.23.0) : clé repas-du-jour:manges:v1, { 'AAAA-MM-JJ': ['pd', 'dej', …] } (identifiants de repas validés,
     jours de plus de 21 jours effacés). Le bouton « Mangé » de la carte coche ou décoche ; cocher passe au repas suivant. */
  const MKEY = 'repas-du-jour:manges:v1', MEALS = ['pd', 'sw', 'dej', 'co', 'shk', 'diner', 'soir'];
  let eaten = {};
  const saveEaten = function(){ try { localStorage.setItem(MKEY, JSON.stringify(eaten)); } catch (e) {} };
  const purgeEaten = function(){
    Object.keys(eaten).forEach(function(k){ if (today - fromIso(k) > 21 * 864e5) delete eaten[k]; });
  };
  try {
    const o = JSON.parse(localStorage.getItem(MKEY) || 'null');
    if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(function(k){
      if (!/^\d{4}-\d\d-\d\d$/.test(k) || !fromIso(k) || !Array.isArray(o[k])) return;
      const l = o[k].filter(function(x, j, a){ return MEALS.indexOf(x) >= 0 && a.indexOf(x) === j; });
      if (l.length) eaten[k] = l;
    });
    purgeEaten();
  } catch (e) {}
  const isEaten = function(id){ return dayDiff(selDate) <= 0 && has(eaten, selIso()) && eaten[selIso()].indexOf(id) >= 0; };
  /* Ce qui reste à manger, sous la frise, dès qu'un repas est coché : les repas pas encore mangés, et le ravito d'une
     séance sans repas mangé après elle ; le repas libre à part (ses calories ne sont qu'un budget) */
  const eatenText = function(secs){
    const meals = secs.filter(function(s){ return !s.band; }), n = meals.filter(function(s){ return isEaten(s.id); }).length;
    if (!n) return '';
    if (n === meals.length) return 'Tout est mangé' + (dayDiff(selDate) === 0 ? ' pour aujourd’hui' : '') + '.';
    let last = -1, lib = false;
    secs.forEach(function(s, i){ if (!s.band && isEaten(s.id)) last = i; });
    const left = [];
    secs.forEach(function(s, i){
      if (s.band ? i < last : isEaten(s.id)) return;
      s.items.forEach(function(x){ if (x.key === 'lib') lib = true; else left.push(x); });
    });
    const m = total(left);
    return 'Reste à manger' + NB + ': ≈' + NB + r10(m.kcal) + NB + 'kcal et ' + Math.round(m.p) + NB + 'g de protéines' + (lib ? ', plus ton repas libre' : '') + '.';
  };
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  /* Une carte par repas et par séance, toutes dessinées, une seule visible (celle choisie dans la frise, 3.20.0) */
  const WHEN = {matin:'le matin', midi:'à midi', soir:'le soir'};
  const panelAttrs = function(s){ return ' id="sec-' + s.id + '" role="tabpanel" aria-labelledby="h-' + s.id + '"' + (s.id === fsel ? '' : ' hidden'); };
  const mealHTML = function(s, next){
    let picks = '';
    if (s.pick === 'pd') picks = '<div class="picks">' + pickRow('pd', null) + '</div>';
    else if (s.pick === 'dej' || s.pick === 'diner') picks = '<div class="picks">' + pickRow('prot', s.pick) + pickRow('starch', s.pick) + pickRow('dessert', s.pick) +
      '<button type="button" class="redo" id="redo-' + s.pick + '" data-action="redo" data-slot="' + s.pick + '" aria-label="Un autre plat ' + REPAS[s.pick] + '" title="Un autre plat">' + REDO + '</button></div>';
    const kc = s.libre ? '' : '<span class="kcal">' + fmtInt(Math.round(total(s.items).kcal / 5) * 5) + NB + 'kcal</span>';
    const card = s.recipe && !s.libre, shown = card ? s.items.filter(function(i){ return RECIPE_OUT.indexOf(i.key) >= 0; }) : s.items;
    /* Repas libre : un interrupteur dans la carte du dîner (et dans celle du repas libre, qui le remplace) */
    const lib = s.id === 'diner' ? '<button type="button" class="switch" role="switch" id="sw-lib" aria-checked="' + !!s.libre + '" data-action="toggle" data-key="libre">' +
      '<span>Repas libre ' + (dayDiff(selDate) === 0 ? 'ce soir' : 'le soir') + '</span><span class="knob" aria-hidden="true"></span></button>' : '';
    /* « Mangé » : aujourd'hui et les jours passés */
    const done = isEaten(s.id);
    const eat = dayDiff(selDate) > 0 ? '' : '<button type="button" class="eat" id="eat-' + s.id + '" data-action="eat" data-value="' + s.id + '" aria-pressed="' + done + '" aria-label="' + s.title + ' mangé">' + CHECK + '<span>Mangé</span></button>';
    return '<section class="meal' + (done ? ' is-eaten' : '') + '"' + panelAttrs(s) + '><div class="meal-head"><h2 id="h-' + s.id + '">' + s.title +
      (s.when ? '<span class="when">' + s.when + '</span>' : '') + '</h2><div class="mh-r">' + kc + eat + '</div></div>' + lib + picks + (card ? recCardHTML(s) : '') +
      (shown.length ? '<ul class="items">' + shown.map(function(i){ return itemHTML(s.id, i, next); }).join('') + '</ul>' : '') + recHTML(s) + '</section>';
  };
  const bandHTML = function(s, next){
    return '<section class="band"' + panelAttrs(s) + '><h2 class="band-t" id="h-' + s.id + '">' + s.title + '<span class="when">' + WHEN[s.moment] + '</span></h2>' +
      (s.sub ? '<p class="band-s">' + s.sub + '</p>' : '') +
      '<p class="band-s">Environ ' + r10(s.kcal) + NB + 'kcal dépensées, comptées dans ta journée.</p>' +
      (s.items.length ? '<ul class="items">' + s.items.map(function(i){ return itemHTML(s.id, i, next); }).join('') + '</ul>' : '') + '</section>';
  };
  /* Frise (3.20.0) : un point et un nom court par repas, un repère betterave par séance (son nom au survol ou au focus) ;
     la toucher affiche la carte. Repas affiché à l'ouverture : celui du moment aujourd'hui (selon l'heure), le
     petit-déjeuner un autre jour ; il reste en changeant de jour tant qu'il existe. */
  let fsel = null;
  const SEC_SHORT = {pd:'Petit-déj', sw:'Avant', dej:'Déjeuner', shk:'Shaker', diner:'Dîner', soir:'Soir'};
  const SEC_TINY = {pd:'P.-déj', sw:'Avant', dej:'Déj.', co:'Coll.', shk:'Shaker', diner:'Dîner', soir:'Soir'};
  const autoSec = function(){
    if (dayDiff(selDate) !== 0) return 'pd';
    const h = new Date().getHours();
    return h < 10 ? 'pd' : h < 14 ? 'dej' : h < 18 ? 'co' : 'diner';
  };
  const friseHTML = function(secs){
    return secs.map(function(s, i){
      const on = s.id === fsel, a = ' role="tab" id="ft-' + s.id + '" data-action="frise" data-value="' + s.id + '" aria-controls="sec-' + s.id + '"' +
        ' aria-selected="' + on + '" tabindex="' + (on ? '0' : '-1') + '"';
      if (s.band){
        const tip = s.title + ', ' + WHEN[s.moment];
        return '<button type="button" class="f-s' + (i < secs.length / 2 ? '' : ' tip-r') + '"' + a + ' aria-label="' + tip + '"><span class="tip" aria-hidden="true">' + tip + '</span></button>';
      }
      const tiny = s.libre ? 'Libre' : s.title === 'Goûter' ? 'Goûter' : SEC_TINY[s.id];
      const ok = isEaten(s.id);
      return '<button type="button" class="f-m' + (ok ? ' is-eaten' : '') + '"' + a + ' aria-label="' + s.title + (ok ? ', mangé' : '') + '"><span class="f-d" aria-hidden="true">' + (ok ? CHECK : '') + '</span><span class="f-l" aria-hidden="true">' + (s.libre ? 'Repas libre' : SEC_SHORT[s.id] || s.title) + '</span>' +
        '<span class="f-l f-t" aria-hidden="true">' + tiny + '</span></button>';
    }).join('');
  };
  /* Les noms complets ne tiennent pas (beaucoup de repas et de séances, petit écran) : les noms courts (« Déj. », « Coll. ») */
  const fitFrise = function(){
    const f = $('frise');
    f.classList.remove('tiny');
    if (f.scrollWidth > f.clientWidth + 1) f.classList.add('tiny');
  };
  window.addEventListener('resize', fitFrise);
  try { document.fonts.ready.then(fitFrise); } catch (e) {}
  /* dir (glisser) : la carte arrive de la droite (l, repère suivant) ou de la gauche (r) */
  const showSec = function(id, focus, dir){
    fsel = id;
    $('frise').querySelectorAll('[role="tab"]').forEach(function(t){
      const on = t.dataset.value === id;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $('day').querySelectorAll('[role="tabpanel"]').forEach(function(x){
      x.hidden = x.id !== 'sec-' + id;
      x.classList.remove('in-l', 'in-r');
      if (dir && !x.hidden){ void x.offsetWidth; x.classList.add('in-' + dir); }
    });
  };
  /* Glisser sur la carte (3.23.0) : vers la gauche, le repère suivant de la frise ; vers la droite, le précédent (sans
     boucle). Un geste surtout horizontal d'au moins 60 px. */
  let touch = null;
  $('day').addEventListener('touchstart', function(e){ touch = e.touches.length === 1 ? {x:e.touches[0].clientX, y:e.touches[0].clientY} : null; }, {passive:true});
  $('day').addEventListener('touchcancel', function(){ touch = null; }, {passive:true});
  $('day').addEventListener('touchend', function(e){
    const t0 = touch, t = e.changedTouches[0];
    touch = null;
    if (!t0 || !t) return;
    const dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
    const tabs = [...$('frise').querySelectorAll('[role="tab"]')].map(function(x){ return x.dataset.value; }), j = tabs.indexOf(fsel) + (dx < 0 ? 1 : -1);
    if (tabs.indexOf(fsel) >= 0 && j >= 0 && j < tabs.length) showSec(tabs[j], false, dx < 0 ? 'l' : 'r');
  }, {passive:true});
  /* Flèches gauche et droite (en boucle), début et fin : repère voisin, premier, dernier */
  $('frise').addEventListener('keydown', function(e){
    const tabs = [...$('frise').querySelectorAll('[role="tab"]')], i = tabs.findIndex(function(t){ return t.dataset.value === fsel; });
    const j = {ArrowRight:i + 1, ArrowLeft:i - 1, Home:0, End:tabs.length - 1}[e.key];
    if (j === undefined || i < 0) return;
    e.preventDefault();
    showSec(tabs[(j + tabs.length) % tabs.length].dataset.value, true);
  });

  /* Séances du jour affiché : une ligne par séance (moment ou durée, bouton pour la retirer), boutons d'ajout */
  const sessHTML = function(list, pre){
    const l = list || plan.seances, a = pre || '';
    const segBtn = function(action, i, value, label, on){
      return '<button type="button" data-action="' + a + action + '" data-index="' + i + '" data-value="' + value + '" aria-pressed="' + on + '">' + label + '</button>';
    };
    return l.length ? l.map(function(x, i){
      const name = SIZES[x.taille].band;
      const opts = x.taille === 'longue'
        ? DUREES.map(function(d){ return segBtn('sduree', i, d[0], d[1], d[0] === x.duree); }).join('')
        : MOMENTS.map(function(m){ return segBtn('smoment', i, m[0], m[1], m[0] === x.moment); }).join('');
      return '<div class="srow"><span class="s-t">' + name + (x.taille === 'longue' ? '<span class="a-s"> le matin</span>' : '') + '</span>' +
        '<button type="button" class="rm" data-action="' + a + 'rm" data-index="' + i + '" aria-label="Retirer' + NB + ': ' + name.toLowerCase() + '">×</button>' +
        '<div class="seg" role="group" aria-label="' + (x.taille === 'longue' ? 'Durée' : 'Moment') + ' de la séance">' + opts + '</div></div>';
    }).join('') : '<p class="rest-t">Repos, pas de séance.</p>';
  };
  const addDisabled = function(taille, list){ const l = list || plan.seances; return l.length >= MAX_SEANCES || (taille === 'longue' && l.some(function(x){ return x.taille === 'longue'; })); };
  /* Séances de la page (3.20.0) : une pastille par séance, dans l'ordre de la journée (« Petite, midi », « Longue, 2h30 ») ;
     la toucher ouvre le panneau pour changer son moment (ou sa durée) ou la retirer ; « + Séance » ouvre le panneau d'ajout */
  const sessChips = function(){
    const l = plan.seances, order = l.map(function(x, i){ return i; }).sort(function(a, b){ return MOMENT_RANK[l[a].moment] - MOMENT_RANK[l[b].moment] || a - b; });
    return (l.length ? order.map(function(i){
      const x = l[i], long = x.taille === 'longue';
      return '<button type="button" class="chip" id="sess-' + i + '" data-action="sess" data-index="' + i + '" aria-haspopup="dialog"' +
        ' aria-label="' + SIZES[x.taille].band + ', ' + (long ? dureeLabel(x.duree) + ', le matin' : WHEN[x.moment]) + '">' + cap(x.taille) + ', ' + (long ? dureeLabel(x.duree) : x.moment) + '</button>';
    }).join('') : '<span class="rest-t">Repos, pas de séance</span>') +
      '<button type="button" class="chip add" id="sess-add" data-action="sess-add" aria-haspopup="dialog"' + (addDisabled('petite') ? ' disabled' : '') + '>+' + NB + 'Séance</button>';
  };
  /* Panneau des séances (même panneau que les choix de plats) : ajouter en un toucher (taille et moment, ou durée de la
     sortie longue), ou changer une séance (moment ou durée) et la retirer ; le panneau se ferme après le choix */
  const SESS_ADD = [['petite', 'muscu, footing court'], ['moyenne', 'sortie ≈' + NB + '7' + NB + 'km'], ['longue', '1h30 et plus, le matin']];
  const openSess = function(i, trigger){
    const x = i === null ? null : plan.seances[i];
    if (i !== null && !x) return;
    const opt = function(attrs, label, aria, pressed, dis){
      return '<button type="button" class="opt"' + attrs + ' aria-label="' + aria + '"' + (pressed === null ? '' : ' aria-pressed="' + pressed + '"') + (dis ? ' disabled' : '') + '>' + label + '</button>';
    };
    const row = function(id, title, sub, opts){ return '<div class="ss-row"><p class="ss-t" id="ss-' + id + '">' + title + (sub ? '<span class="ss-s">' + sub + '</span>' : '') + '</p><div class="opts-list" role="group" aria-labelledby="ss-' + id + '">' + opts + '</div></div>'; };
    let html;
    if (!x){
      html = SESS_ADD.map(function(t){
        const dis = addDisabled(t[0]), name = SIZES[t[0]].band;
        return row(t[0], name, t[1], t[0] === 'longue'
          ? DUREES.map(function(d){ return opt(' data-action="add" data-value="longue" data-duree="' + d[0] + '"', d[1], name + ', ' + d[1], null, dis); }).join('')
          : MOMENTS.map(function(m){ return opt(' data-action="add" data-value="' + t[0] + '" data-moment="' + m[0] + '"', m[1], name + ', ' + WHEN[m[0]], null, dis); }).join(''));
      }).join('');
    } else {
      const long = x.taille === 'longue';
      html = row('m', long ? 'Durée' : 'Moment', long ? 'toujours le matin' : null, long
        ? DUREES.map(function(d){ return opt(' data-action="sduree" data-index="' + i + '" data-value="' + d[0] + '"', d[1], d[1], d[0] === x.duree, false); }).join('')
        : MOMENTS.map(function(m){ return opt(' data-action="smoment" data-index="' + i + '" data-value="' + m[0] + '"', m[1], m[1], m[0] === x.moment, false); }).join('')) +
        '<button type="button" class="reset danger ss-rm" data-action="rm" data-index="' + i + '">Retirer cette séance</button>';
    }
    /* Après l'ajout d'une 4e séance, « + Séance » est désactivé : le focus va sur la nouvelle */
    pick = {kind:'seance', slot:null, trigger:trigger && trigger.id ? trigger.id : null, back:x ? 'sess-add' : 'sess-' + plan.seances.length, view:'page'};
    $('sheet-t').textContent = x ? SIZES[x.taille].band + ', ' + (x.taille === 'longue' ? 'le matin' : WHEN[x.moment]) : 'Ajouter une séance';
    $('sheet-list').className = 'opts-list sess-sheet';
    $('sheet-list').hidden = false;
    $('sheet-rec').hidden = true;
    $('sheet-list').innerHTML = html;
    try { history.pushState({pick:true}, ''); } catch (e) {}
    $('sheet').hidden = false;
    $('sheet').querySelector('.panel').scrollTop = 0;
    setInert('page', true);
    document.documentElement.style.overflow = 'hidden';
    const first = $('sheet-list').querySelector('[aria-pressed="true"]') || $('sheet-list').querySelector('button:not([disabled])');
    if (first) first.focus({preventScroll:true});
  };
  const renderControls = function(){
    /* Jour affiché : « Aujourd'hui, jeudi 1er octobre », « Demain, … », sinon « Jeudi 8 octobre » */
    const diff = dayDiff(selDate), rel = {'-1':'Hier', '0':'Aujourd’hui', '1':'Demain'}[diff];
    $('date').textContent = rel ? rel + ', ' + dayLabel(selDate) : cap(dayLabel(selDate));
    $('title').textContent = (diff === 0 ? 'Qu’est-ce que tu fais aujourd’hui' : diff < 0 ? 'Qu’est-ce que tu as fait ' + dayRel(selDate) : 'Qu’est-ce que tu prévois ' + dayRel(selDate)) + NB + '?';
    $('today-btn').hidden = diff === 0;
    /* Bandeau de la semaine du jour affiché : un point sous les jours déjà planifiés */
    const wk = weekOf(selDate), short = function(d){ return d.toLocaleDateString('fr-FR', {month:'short'}); };
    $('cal-t').textContent = 'Du ' + wk[0].getDate() + (wk[0].getMonth() !== wk[6].getMonth() ? NB + short(wk[0]) : '') + ' au ' + wk[6].getDate() + NB + short(wk[6]);
    $('wk-prev').disabled = wk[0] <= addDays(today, -21);
    $('wk-next').disabled = wk[6] >= addDays(today, 365);
    /* Sous les jours, un trait par planification (3.22.0), arrondi à son premier et à son dernier jour */
    const pls = wk.map(function(d){ return planifOf(isoDate(d)); });
    $('week').innerHTML = wk.map(function(d, i){
      const iso = isoDate(d), isToday = dayDiff(d) === 0, planned = has(store.plans, iso);
      return '<button type="button" data-action="day" data-value="' + iso + '" aria-pressed="' + (iso === selIso()) + '"' +
        ' aria-label="' + cap(dayLabel(d)) + (isToday ? ', aujourd’hui' : '') + (planned ? ', planifié' : '') + (pls[i] ? ', dans une planification' : '') + '"' +
        ' class="' + (isToday ? 'is-today' : '') + (planned ? ' is-planned' : '') + '"' + (dayDiff(d) < -21 ? ' disabled' : '') + '>' +
        '<span class="wd">' + d.toLocaleDateString('fr-FR', {weekday:'short'}) + '</span><span class="dn">' + d.getDate() + '</span></button>';
    }).join('') + wk.map(function(d, i){
      const p = pls[i];
      return '<span class="wk-pl' + (p ? ' on' + (p.from === isoDate(d) || i === 0 ? ' s' : '') + (p.to === isoDate(d) || i === 6 ? ' e' : '') : '') + '" aria-hidden="true"></span>';
    }).join('');
    $('sess').innerHTML = sessChips();
  };
  const r10 = function(n){ return fmtInt(Math.round(n / 10) * 10); };
  const incomplete = function(){
    if (cleanProfile(prof).mode === 'manuel') return !has(prof, 'repos') || !has(prof, 'poids');
    return !(has(prof, 'age') && has(prof, 'taille') && has(prof, 'poids'));
  };
  const renderSummary = function(res){
    const t = res.tot, en = res.energy;
    $('sum-text').innerHTML = 'Environ <strong>' + r10(t.kcal) + NB + 'kcal</strong> sur la journée' +
      (res.libre ? ', dont ' + fmtInt(res.libre) + NB + 'kcal de repas libre.' : '.');
    let tab = 'profil', note = 'Dépense estimée' + NB + ': ' + r10(en.need) + NB + 'kcal, ' + (en.deficit > 0 ? 'moins ' + r10(en.deficit) + NB + 'kcal de déficit.' : 'sans déficit.');
    const over = !res.libre && res.ecart > en.target * 0.03;
    if (over){
      const pr = cleanProfile(prof), tips = [];
      if (pr.marge > 0) tips.push('baisse la marge cuisine');
      if (pr.shaker === 'oui') tips.push('passe-toi du shaker');
      if (dessertOf(ch.dej) !== 'aucun' || dessertOf(ch.diner) !== 'aucun') tips.push('retire un dessert');
      if (res.prot.factor > PF_MIN + 0.02) tips.push('baisse ton objectif de protéines');
      if (pr.marge > 0 || pr.shaker === 'oui') tab = 'repas';
      note += ' Tes minimums de protéines, lipides et féculents dépassent l’objectif de ' + r10(res.ecart) + NB + 'kcal' +
        (tips.length ? NB + ': pour t’en rapprocher, ' + (tips.length > 1 ? tips.slice(0, -1).join(', ') + ' ou ' + tips[tips.length - 1] : tips[0]) + '.' : '.');
    }
    /* Protéines sous la fourchette malgré les portions au maximum et le skyr du soir (thon deux fois, objectif haut, sans shaker) */
    if (!res.libre && t.p < res.prot.low - 0.5){
      const pr = cleanProfile(prof), tips = [];
      if (ch.dej.prot === 'thon' || ch.diner.prot === 'thon') tips.push('remplace le thon');
      if (ch.pdBase === 'sale' && !plan.seances.some(function(x){ return x.taille === 'longue'; })) tips.push('prends un petit-déjeuner sucré (avec du skyr)');
      if (pr.shaker === 'non'){ tips.push('reprends un shaker'); tab = 'repas'; }
      tips.push('baisse ton objectif de protéines');
      note += ' Tes protéines restent sous ton objectif (' + Math.round(t.p) + NB + 'g, pour ' + Math.round(res.prot.low) + ' à ' + Math.round(res.prot.high) + NB + 'g)' + NB +
        ': ' + (tips.length > 1 ? tips.slice(0, -1).join(', ') + ' ou ' + tips[tips.length - 1] : tips[0]) + '.';
    }
    /* Protéines au-dessus de la fourchette alors que les portions sont déjà au minimum (3.23.0) : le thon (boîte entière),
       les légumes secs, le shaker ou un objectif bas en apportent beaucoup. Sans risque, mais dit. */
    if (!res.libre && t.p > res.prot.high + 0.5 && res.prot.factor <= PF_MIN + 0.02){
      const pr = cleanProfile(prof), tips = [], sl = [ch.dej, ch.diner];
      if (sl.some(function(c){ return c.prot === 'thon'; })) tips.push('remplace le thon');
      if (sl.some(function(c){ return LEGUMES.indexOf(c.starch) >= 0; })) tips.push('prends un autre féculent que les lentilles ou les pois chiches');
      /* Déjà proposé par la note des calories */
      if (pr.shaker === 'oui' && !over){ tips.push('passe-toi du shaker'); tab = 'repas'; }
      note += ' Tes protéines dépassent ton objectif (' + Math.round(t.p) + NB + 'g, pour ' + Math.round(res.prot.low) + ' à ' + Math.round(res.prot.high) + NB + 'g), sans risque pour ta sèche' +
        (tips.length ? NB + ': pour t’en rapprocher, ' + (tips.length > 1 ? tips.slice(0, -1).join(', ') + ' ou ' + tips[tips.length - 1] : tips[0]) + '.' : '.');
    }
    if (incomplete()){ note += ' Complète ton profil pour un calcul juste.'; tab = 'profil'; }
    /* « Régler » ouvre l'onglet des réglages de ce que propose la note (shaker, marge cuisine : Repas ; sinon Profil) */
    $('sum-note').innerHTML = note + ' <button type="button" class="link" data-action="needs" data-value="' + tab + '">Régler</button>';
    $('bar-p').style.flexGrow = String(t.p * 4);
    $('bar-c').style.flexGrow = String(t.c * 4);
    $('bar-f').style.flexGrow = String(t.f * 9);
    $('legend').innerHTML = '<li class="p">Protéines <b>' + Math.round(t.p) + NB + 'g</b></li>' +
      '<li class="c">Glucides <b>' + Math.round(t.c) + NB + 'g</b></li>' +
      '<li class="f">Lipides <b>' + Math.round(t.f) + NB + 'g</b></li>' +
      (res.libre ? '<li class="x">hors repas libre</li>' : '');
  };
  const render = function(){
    renderControls();
    const res = buildDay(plan, ch, prof);
    renderSummary(res);
    renderNeeds(res);
    renderWeek();
    const next = new Map();
    if (!res.secs.some(function(s){ return s.id === fsel; })) fsel = autoSec();
    dayBatch = res.secs.some(function(s){ return s.recipe && !s.libre; }) ? batchFor(selIso()) : {};
    $('frise').innerHTML = friseHTML(res.secs);
    fitFrise();
    $('eat-msg').textContent = eatenText(res.secs);
    $('day').innerHTML = res.secs.map(function(s){ return s.band ? bandHTML(s, next) : mealHTML(s, next); }).join('');
    prevQty = next;
  };
  /* Actions de la page du jour : séances, repas libre, plats, recettes, calendrier, plan de base */
  Object.assign(ACTIONS, {
    /* Une séance ajoutée : moment (data-moment) ou durée (data-duree) du panneau d'ajout, sinon le soir (longue : 2 h) */
    add: function(b, v){
      if (!has(SIZES, v) || addDisabled(v)) return;
      $('intro').textContent = '';
      const d = parseFloat(b.dataset.duree);
      plan.seances.push({taille:v, moment:v === 'longue' ? 'matin' : has(MOMENT_RANK, b.dataset.moment) ? b.dataset.moment : 'soir', duree:DUREES.some(function(x){ return x[0] === d; }) ? d : 2});
      plan.seances = cleanSeances(plan.seances); savePlan({seances:plan.seances});
      return '';
    },
    smoment: function(b, v){ if (!plan.seances[+b.dataset.index]) return; plan.seances[+b.dataset.index].moment = v; plan.seances = cleanSeances(plan.seances); savePlan({seances:plan.seances}); return ''; },
    sduree: function(b, v){ if (!plan.seances[+b.dataset.index]) return; plan.seances[+b.dataset.index].duree = parseFloat(v); plan.seances = cleanSeances(plan.seances); savePlan({seances:plan.seances}); return ''; },
    rm: function(b){ if (!plan.seances[+b.dataset.index]) return; plan.seances.splice(+b.dataset.index, 1); savePlan({seances:plan.seances}); return ''; },
    sess: function(b){ openSess(+b.dataset.index, b); },
    'sess-add': function(b){ if (!addDisabled('petite')) openSess(null, b); },
    /* « Un autre plat » (3.22.0) : protéine et féculent tirés à nouveau pour ce repas (équilibrés avec la semaine, différents
       du plat actuel et de la protéine de l'autre repas), avec la recette du couple si le repas en avait une ou si la
       planification du jour est en recettes ; le dessert reste */
    redo: function(b){
      const slot = b.dataset.slot, other = slot === 'dej' ? 'diner' : 'dej';
      if (!has(REPAS, slot) || plan.libre && slot === 'diner') return;
      const pr = cleanProfile(prof), bal = weekBal(selDate, selIso()), old = ch[slot], p = planifOf(selIso()), rec = p ? p.type === 'recettes' : !!recipeOf(old);
      for (let i = 0; i < 20; i++){
        const c = randomChoices(null, pr.off, bal, scaleOf(pr), rec ? pr : null)[slot];
        if (c.prot === old.prot && c.starch === old.starch) continue;
        if (c.prot === ch[other].prot && i < 19) continue;
        ch[slot] = {prot:c.prot, starch:c.starch, dessert:dessertOf(old)};
        if (rec && c.recette) ch[slot].recette = c.recette;
        saveCh();
        return '';
      }
      return 'Aucun autre plat ne va avec tes aliments proposés.';
    },
    /* Frise : la carte d'un repas ou d'une séance */
    frise: function(b, v){ if ($('sec-' + v)) showSec(v, false); },
    /* « Mangé » (3.23.0) : coche ou décoche le repas ; coché, la carte passe au repas suivant pas encore mangé (le focus
       sur son repère de la frise), sinon le focus reste sur le bouton */
    eat: function(b, v){
      if (MEALS.indexOf(v) < 0 || !$('sec-' + v) || dayDiff(selDate) > 0) return;
      const iso = selIso(), l = has(eaten, iso) ? eaten[iso] : [], on = l.indexOf(v) < 0;
      if (on) l.push(v); else l.splice(l.indexOf(v), 1);
      if (l.length) eaten[iso] = l; else delete eaten[iso];
      saveEaten();
      const tabs = [...$('frise').querySelectorAll('.f-m')].map(function(x){ return x.dataset.value; });
      const to = on ? tabs.slice(tabs.indexOf(v) + 1).find(function(id){ return !isEaten(id); }) : null;
      if (to) fsel = to;
      $('hint').textContent = '';
      render();
      $(to ? 'ft-' + to : 'eat-' + v).focus({preventScroll:true});
    },
    toggle: function(b){
      if (b.dataset.key !== 'libre') return;
      let msg = '';
      plan.libre = !plan.libre;
      if (plan.libre) msg = clearOtherLibre();
      savePlan({libre:plan.libre});
      return msg;
    },
    pd: function(b, v){ if (has(PD, v)){ ch.pdBase = v; saveCh(); } return ''; },
    prot: function(b, v){ if (has(PROT, v)){ ch[b.dataset.slot].prot = v; dropRecipes(ch); saveCh(); } return ''; },
    starch: function(b, v){ if (has(STARCH, v)){ ch[b.dataset.slot].starch = v; dropRecipes(ch); saveCh(); } return ''; },
    dessert: function(b, v){ if (has(DESSERT, v)){ ch[b.dataset.slot].dessert = v; saveCh(); } return ''; },
    /* Recette d'un repas : voir sa fiche, la choisir (celle proposée pour sa protéine et son féculent) ou la retirer */
    'rec-view': function(b){ if (!has(REPAS, b.dataset.slot)) return; openRecipe(b.dataset.slot, b); },
    /* La page du batch de cette recette (3.21.0) */
    'rec-batch': function(b){ const x = has(REPAS, b.dataset.slot) ? dayBatch[b.dataset.slot] : null; if (!x) return; renderBatchPage(x); openScreen('batch', b); },
    'rec-on': function(b){
      const slot = b.dataset.slot, id = has(REPAS, slot) ? recipesFor(ch[slot].prot, ch[slot].starch)[0] : null;
      if (!id) return;
      ch[slot].recette = id; saveCh();
      recFocus = slot;
      return '';
    },
    'rec-off': function(b){ if (!has(REPAS, b.dataset.slot)) return; ['recette', 'g', 'g2'].forEach(function(f){ delete ch[b.dataset.slot][f]; }); saveCh(); recFocus = b.dataset.slot; return ''; },
    /* Calendrier : un jour, la semaine d'avant ou d'après (même jour de la semaine, ou aujourd'hui), retour à aujourd'hui */
    day: function(b, v){
      const d = fromIso(v);
      if (!d || dayDiff(d) < -21 || dayDiff(d) > 365) return;
      selDate = d; loadSel(); prevQty = new Map();
      return '';
    },
    week: function(b, v){
      let d = addDays(selDate, 7 * (parseInt(v, 10) < 0 ? -1 : 1));
      if (weekOf(d).some(function(x){ return dayDiff(x) === 0; })) d = today;
      if (dayDiff(d) < -21 || dayDiff(d) > 365) return;
      selDate = d; loadSel(); prevQty = new Map();
      return '';
    },
    today: function(){ selDate = today; loadSel(); prevQty = new Map(); $('title').focus(); return ''; },
    /* « Revenir au plan de base » : la date et la mémoire de ce jour de la semaine effacées */
    reset: function(){
      let msg = '';
      delete store.plans[selIso()];
      delete store.choices[sel];
      loadSel();
      if (plan.libre) msg = clearOtherLibre();
      persist(); prevQty = new Map();
      return msg;
    }
  });
