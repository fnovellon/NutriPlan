  /* Équivalences (4.2.0, écran #equiv, « Convertir » dans le menu) : trois familles (féculents et matières grasses à calories
     égales, protéines à protéines égales), un aliment, une quantité et son unité (g crus, g cuits, pièces) ; la liste des
     autres aliments de la famille, en grammes, avec leur poids cuit, leurs pièces et leurs macros. Ouvert aussi depuis une
     ligne du déjeuner ou du dîner (bouton ⇄), rempli avec sa quantité. Rien n'est enregistré. */
  const EQ_DEFAULT = {starch:['riz', 80, 'g'], prot:['poulet', 150, 'g'], fat:['huile', 1, 'unit']};
  const eq = {group:'starch', id:'riz', qty:80, unit:'g', text:'80'};
  const eqSet = function(group, id, qty, unit){
    const x = eqItem(group, id);
    if (!x) return false;
    eq.group = group; eq.id = id; eq.qty = qty; eq.unit = eqUnits(x).some(function(u){ return u.v === unit; }) ? unit : 'g';
    eq.text = isFinite(qty) ? String(Math.round(qty * 100) / 100).replace('.', ',') : '';
    return true;
  };
  /* « 1 », « 1 ½ », « ¾ » */
  const quarter = function(n){
    const w = Math.floor(n), r = Math.round((n - w) * 4) / 4, fr = {0.25:'¼', 0.5:'½', 0.75:'¾'}[r] || '';
    return (w ? String(w) : '') + (w && fr ? NB : '') + fr || '0';
  };
  /* Pluriel à partir de 2, comme en français (« 1 ½ tranche ») */
  const pieceText = function(l){ return quarter(l.n) + NB + (l.n >= 2 ? l.unit.many : l.unit.one); };
  const EQ_BASIS = {
    starch:function(v){ return 'À calories égales' + NB + ': ' + fmtInt(v) + NB + 'kcal. Comme dans ta journée, où changer de féculent ne change pas le total.'; },
    prot:function(v){ return 'À protéines égales' + NB + ': ' + fmtInt(v) + NB + 'g de protéines. Les calories changent d’un aliment à l’autre' + NB + ': regarde-les sous chacun.'; },
    fat:function(v){ return 'À calories égales' + NB + ': ' + fmtInt(v) + NB + 'kcal.'; }
  };
  /* Une ligne : la quantité (en pièces pour les œufs et les galettes), le nom, le poids cuit ou les pièces, les macros */
  const eqLineHTML = function(l){
    const byPiece = !!(l.unit && l.unit.piece);
    const q = byPiece ? quarter(l.n) : grams(Math.round(l.g * 10) / 10), name = byPiece ? (l.n >= 2 ? l.unit.many : l.unit.one) : l.name;
    const more = (l.raw ? [l.raw] : []).concat(l.cooked.map(function(c){ return '≈' + NB + grams(c.g) + ' ' + c.adj; }), l.unit && !byPiece ? ['≈' + NB + pieceText(l)] : [], byPiece ? ['≈' + NB + grams(Math.round(l.g))] : []);
    return '<li><span class="b-q">' + q + '</span><span class="name">' + name + (l.note ? ' <span class="eq-n">(' + l.note + ')</span>' : '') +
      (more.length ? '<span class="note">' + more.join(', ') + '</span>' : '') + macHTML(l.m) + '</span></li>';
  };
  const renderEqList = function(){
    const x = eqItem(eq.group, eq.id), r = equivalents(eq.group, eq.id, eq.qty, eq.unit);
    $('eq-err').textContent = r ? '' : 'Entre une quantité, par exemple 80.';
    $('eq-qty').setAttribute('aria-invalid', String(!r));
    if (!r){ $('eq-basis').textContent = ''; $('eq-ref').innerHTML = ''; $('eq-list').innerHTML = ''; return; }
    $('eq-basis').textContent = EQ_BASIS[eq.group](r.value);
    $('eq-ref').innerHTML = eqLineHTML(r.ref);
    $('eq-list').innerHTML = r.lines.map(eqLineHTML).join('');
    $('eq-ref-t').textContent = 'Ta portion de ' + x.name;
  };
  const renderEq = function(){
    $('eq-tabs').innerHTML = EQ_ORDER.map(function(g){ return '<button type="button" id="eq-tab-' + g + '" data-action="eq-tab" data-value="' + g + '" aria-pressed="' + (g === eq.group) + '">' + EQ_GROUPS[g].label + '</button>'; }).join('');
    $('eq-food').innerHTML = EQ_GROUPS[eq.group].items.map(function(x){ return '<option value="' + x.id + '"' + (x.id === eq.id ? ' selected' : '') + '>' + cap(x.name) + '</option>'; }).join('');
    $('eq-unit').innerHTML = eqUnits(eqItem(eq.group, eq.id)).map(function(u){ return '<option value="' + u.v + '"' + (u.v === eq.unit ? ' selected' : '') + '>' + u.label + '</option>'; }).join('');
    $('eq-qty').value = eq.text;
    renderEqList();
  };
  /* Saisie : la liste suit à chaque frappe (virgule ou point) ; aliment et unité changés : tout est redessiné */
  const eqParse = function(t){ const v = parseFloat(String(t).replace(',', '.').replace(/\s/g, '')); return /^\s*\d+([.,]\d*)?\s*$/.test(t) ? v : NaN; };
  document.addEventListener('input', function(e){
    if (!e.target || e.target.id !== 'eq-qty') return;
    eq.text = e.target.value.slice(0, 8); eq.qty = eqParse(eq.text);
    renderEqList();
  });
  document.addEventListener('change', function(e){
    const t = e.target;
    if (!t || (t.id !== 'eq-food' && t.id !== 'eq-unit')) return;
    if (t.id === 'eq-food'){
      const x = eqItem(eq.group, t.value);
      if (!x) return;
      /* Même valeur (calories ou protéines) pour le nouvel aliment : la portion reste comparable */
      const r = equivalents(eq.group, eq.id, eq.qty, eq.unit), l = r && r.lines.find(function(y){ return y.id === x.id; });
      const piece = !!(x.unit && x.unit.piece);
      eqSet(eq.group, x.id, l ? (piece ? l.n : l.g) : EQ_DEFAULT[eq.group][1], l && piece ? 'unit' : 'g');
    } else {
      const x = eqItem(eq.group, eq.id), raw = eqRaw(x, eq.qty, eq.unit);
      if (!eqUnits(x).some(function(u){ return u.v === t.value; })) return;
      /* La même portion dans la nouvelle unité */
      const m = /^cuit:(\d)$/.exec(t.value), v = raw === null ? null : t.value === 'unit' ? Math.round(raw / x.unit.g * 4) / 4 : m ? Math.round(raw * x.cook[+m[1]][0]) : Math.round(raw);
      eqSet(eq.group, eq.id, v === null ? eq.qty : v, t.value);
    }
    renderEq();
    $(t.id).focus({preventScroll:true});
  });
  Object.assign(ACTIONS, {
    equiv: function(b){ if (topScreen() === 'equiv') return; renderEq(); navTo('equiv', b); },
    'eq-tab': function(b, v){
      if (!has(EQ_GROUPS, v) || v === eq.group) return;
      const d = EQ_DEFAULT[v];
      eqSet(v, d[0], d[1], d[2]);
      renderEq();
      $('eq-tab-' + v).focus({preventScroll:true});
    },
    /* Depuis une ligne de la journée : l'outil rempli avec cet aliment et sa quantité */
    'eq-open': function(b, v){
      const q = String(v).split('|');
      if (!eqSet(q[0], q[1], parseFloat(q[2]), q[3])) return;
      renderEq();
      openScreen('equiv', b);
    }
  });
