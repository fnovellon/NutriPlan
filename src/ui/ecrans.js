  /* Écrans, un seul visible : accueil, page du jour, réglages (roue dentée) et aide (point d'interrogation).
     Réglages et aide s'empilent au-dessus de la page ; chacun ajoute une entrée d'historique (le bouton retour du
     téléphone revient d'un cran) et la position dans la page est rétablie au retour. */
  let stack = [], pageScroll = 0;
  const HEAD = {reglages:'regl-h', aide:'aide-h', repas:'repas-h', plan:'plan-h', courses:'courses-h'};
  const scroller = function(){ return document.scrollingElement || document.documentElement; };
  const setView = function(v){ ['accueil', 'page', 'reglages', 'aide', 'repas', 'plan', 'courses'].forEach(function(id){ $(id).hidden = id !== v; }); };
  const topScreen = function(){ return stack.length ? stack[stack.length - 1].name : null; };
  const showTop = function(){
    const top = stack.length ? stack[stack.length - 1] : null;
    if (top){ setView(top.name); scroller().scrollTop = 0; $(HEAD[top.name]).focus({preventScroll:true}); return; }
    setView('page');
    scroller().scrollTop = pageScroll;
  };
  const openScreen = function(name, opener){
    if (topScreen() === name) return;
    if (!stack.length) pageScroll = scroller().scrollTop;
    stack.push({name:name, opener:opener && opener.id ? opener.id : 'gear'});
    try { history.scrollRestoration = 'manual'; history.pushState({screen:name}, ''); } catch (e) {}
    showTop();
  };
  /* Retour d'un cran (flèche, « Voir ma journée ») ; fromHistory : l'entrée d'historique est déjà quittée */
  const closeScreen = function(fromHistory){
    if (!stack.length) return;
    const left = stack.pop();
    if (left.name === 'plan') leavePlan();
    showTop();
    if (!stack.length) $(document.getElementById(left.opener) ? left.opener : 'gear').focus({preventScroll:true});
    if (!fromHistory){ try { if (history.state && history.state.screen) history.back(); } catch (e) {} }
  };
  const closeAllScreens = function(){ while (stack.length) closeScreen(false); };
  /* Remplace l'écran du dessus sans nouvelle entrée d'historique (fin de l'assistant → courses) */
  const replaceScreen = function(name){
    const top = stack[stack.length - 1];
    if (!top) return;
    if (top.name === 'plan') leavePlan();
    top.name = name;
    try { history.replaceState({screen:name}, ''); } catch (e) {}
    showTop();
  };
  Object.assign(ACTIONS, {
    aide: function(b){ openScreen('aide', b); },
    fermer: function(){ closeScreen(false); }
  });
