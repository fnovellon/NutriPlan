  /* Éditeur de semaine type (3.18.0), le même dans les réglages (préfixe sem, onglet « Sport ») et à l'accueil (préfixe acs,
     dernière étape) : un jour à la fois, ses séances avec les mêmes boutons que la page, le soir du repas libre. Identifiants
     et actions préfixés (sem-days, sem-add… ; acs-days, acs-add…). get / set : la semaine du profil, enregistrée tout de
     suite, ou celle du brouillon de l'accueil, enregistrée à la fin ; sel : le jour affiché. */
  const SHORT = {0:'dim.', 1:'lun.', 2:'mar.', 3:'mer.', 4:'jeu.', 5:'ven.', 6:'sam.'};
  /* Enregistrée dans le profil, seulement si elle diffère de la semaine par défaut (aucune séance, repas libre le samedi) */
  const saveWeek = function(w){
    const c = cleanWeek(w);
    if (Object.keys(c.jours).length || c.libre !== 6) prof.semaine = c; else delete prof.semaine;
    saveProf();
  };
  const WEEK_ED = {
    sem:{sel:todayJs, get:function(){ return semOf(); }, set:function(w){ saveWeek(w); loadSel(); prevQty = new Map(); }},
    acs:{sel:todayJs, get:function(){ return cleanWeek(acc ? acc.draft.semaine : null); }, set:function(w){ acc.draft.semaine = cleanWeek(w); }}
  };
  const renderWeekEd = function(pre){
    const E = WEEK_ED[pre], w = E.get(), list = w.jours[E.sel] || [];
    $(pre + '-days').innerHTML = DAYS.map(function(d){
      const n = (w.jours[d.js] || []).length;
      return '<button type="button" data-action="' + pre + '-day" data-value="' + d.js + '" aria-pressed="' + (d.js === E.sel) + '" aria-label="' + d.long + NB + ': ' +
        (n ? n + ' séance' + (n > 1 ? 's' : '') : 'repos') + '"><span class="wd">' + SHORT[d.js] + '</span><span class="dn">' + (n || '–') + '</span></button>';
    }).join('');
    $(pre + '-h').textContent = cap(DAYS.find(function(d){ return d.js === E.sel; }).long);
    $(pre + '-sess').innerHTML = sessHTML(list, pre + '-');
    $(pre + '-acts').querySelectorAll('button').forEach(function(b){ b.disabled = addDisabled(b.dataset.value, list); });
    $(pre + '-lib').innerHTML = DAYS.map(function(d){
      return '<button type="button" class="opt" data-action="' + pre + '-lib" data-value="' + d.js + '" aria-pressed="' + (w.libre === d.js) + '" aria-label="' + d.long + '">' + SHORT[d.js] + '</button>';
    }).join('');
  };
  const renderSemaine = function(){ renderWeekEd('sem'); };
  /* Après un changement, le focus revient sur le même bouton (sinon sur « + Petite », sinon sur le jour) */
  const weekFocus = function(pre, b){
    const box = $(pre + '-days').closest('section');
    const same = [...box.querySelectorAll('[data-action="' + b.dataset.action + '"]')].find(function(x){
      return x.dataset.value === b.dataset.value && x.dataset.index === b.dataset.index;
    });
    const el = same && !same.disabled ? same : $(pre + '-acts').querySelector('button:not(:disabled)') || $(pre + '-days').querySelector('[aria-pressed="true"]');
    if (el) el.focus({preventScroll:true});
  };
  /* Une séance ajoutée, déplacée ou retirée, le soir du repas libre ; dans les réglages, la page suit (message vide) */
  const weekAction = function(b, v){
    const pre = b.dataset.action.slice(0, 3), act = b.dataset.action.slice(4), E = WEEK_ED[pre];
    if (pre === 'acs' && !acc) return;
    const w = E.get(), list = (w.jours[E.sel] || []).map(function(x){ return Object.assign({}, x); }), i = +b.dataset.index;
    if (act === 'add'){ if (!has(SIZES, v) || addDisabled(v, list)) return; list.push({taille:v, moment:v === 'longue' ? 'matin' : 'soir', duree:2}); }
    else if (act === 'rm'){ if (!list[i]) return; list.splice(i, 1); }
    else if (act === 'smoment'){ if (!list[i] || !has(MOMENT_RANK, v)) return; list[i].moment = v; }
    else if (act === 'sduree'){ if (!list[i]) return; list[i].duree = parseFloat(v); }
    else { if (!/^[0-6]$/.test(v || '')) return; w.libre = +v; }
    w.jours[E.sel] = list;
    E.set(w);
    renderWeekEd(pre);
    weekFocus(pre, b);
    return pre === 'sem' ? '' : undefined;
  };
  const weekDay = function(b, v){
    const pre = b.dataset.action.slice(0, 3);
    if (!/^[0-6]$/.test(v || '') || (pre === 'acs' && !acc)) return;
    WEEK_ED[pre].sel = +v;
    renderWeekEd(pre);
    weekFocus(pre, b);
  };
  ['sem', 'acs'].forEach(function(pre){
    ACTIONS[pre + '-day'] = weekDay;
    ['add', 'rm', 'smoment', 'sduree', 'lib'].forEach(function(a){ ACTIONS[pre + '-' + a] = weekAction; });
  });
