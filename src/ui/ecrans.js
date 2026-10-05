  /* Écrans, un seul visible : accueil, page du jour, réglages, aide, formulaire des repas, Planifier, une planification
     (récap et courses), la page du batch d'une recette et la bibliothèque des recettes (3.24.0).
     Les écrans s'empilent au-dessus de la page ; chacun ajoute une entrée d'historique (le bouton retour du téléphone
     revient d'un cran) et la position dans la page est rétablie au retour. Le menu en haut (3.20.0, #nav, caché pendant
     l'accueil) surligne l'écran affiché ; un écran du menu remplace celui du dessus, « Journée » ferme tout. */
  let stack = [], pageScroll = 0;
  const VIEWS = ['accueil', 'page', 'reglages', 'aide', 'repas', 'plan', 'courses', 'batch', 'recettes'];
  const HEAD = {reglages:'regl-h', aide:'aide-h', repas:'repas-h', plan:'plan-h', courses:'courses-h', batch:'batchp-h', recettes:'lib-h'};
  const scroller = function(){ return document.scrollingElement || document.documentElement; };
  const NAV = {page:'nav-jour', repas:'nav-jour', batch:'nav-jour', plan:'plan-btn', courses:'plan-btn', recettes:'nav-rec', aide:'help', reglages:'gear'};
  const setView = function(v){
    VIEWS.forEach(function(id){ $(id).hidden = id !== v; });
    $('nav').hidden = v === 'accueil';
    if (v === 'page') fitFrise();
    $('nav').querySelectorAll('button').forEach(function(b){ if (b.id === NAV[v]) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  };
  /* Panneau du bas ouvert : l'écran dessous et le menu deviennent inertes */
  const setInert = function(view, on){ [view, 'nav'].forEach(function(id){ if (on) $(id).setAttribute('inert', ''); else $(id).removeAttribute('inert'); }); };
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
    showTop();
    if (!stack.length) $(document.getElementById(left.opener) ? left.opener : 'gear').focus({preventScroll:true});
    if (!fromHistory){ try { if (history.state && history.state.screen) history.back(); } catch (e) {} }
  };
  const closeAllScreens = function(){ while (stack.length) closeScreen(false); };
  /* Remplace l'écran du dessus sans nouvelle entrée d'historique (menu) */
  const replaceScreen = function(name){
    const top = stack[stack.length - 1];
    if (!top) return;
    top.name = name;
    try { history.replaceState({screen:name}, ''); } catch (e) {}
    showTop();
  };
  /* Menu : l'écran demandé s'ouvre à la place de celui du dessus (sans nouvelle entrée d'historique : le retour du téléphone
     ramène à la journée) ; s'il est déjà ouvert plus bas (réglages sous l'aide), on y redescend */
  const fromNav = function(b){ return !!(b && b.closest && b.closest('#nav')); };
  const navTo = function(name, opener){
    if (topScreen() === name) return;
    if (stack.some(function(x){ return x.name === name; })){ while (topScreen() !== name) closeScreen(false); return; }
    if (stack.length) replaceScreen(name); else openScreen(name, opener);
  };
  Object.assign(ACTIONS, {
    /* « Journée » : tous les écrans fermés ; déjà sur la page, retour en haut */
    jour: function(){ if (stack.length) closeAllScreens(); else { scroller().scrollTop = 0; $('title').focus({preventScroll:true}); } },
    /* Aide : depuis le menu, à la place de l'écran du dessus ; depuis les réglages, par-dessus (retour aux réglages) */
    aide: function(b){ if (fromNav(b)) navTo('aide', b); else openScreen('aide', b); },
    fermer: function(){ closeScreen(false); }
  });
