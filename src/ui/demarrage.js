  /* Si la page reste ouverte d'un jour à l'autre, revenir sur le nouveau jour */
  const refreshToday = function(){
    const n = noon();
    if (isoDate(n) === isoDate(today)) return;
    today = n; todayJs = n.getDay(); selDate = today;
    purge(); loadSel(); prevQty = new Map();
    $('hint').textContent = '';
    if (topScreen() === 'repas') startDraft();
    render();
    maybeOpenRepas();
  };
  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') refreshToday(); });
  window.addEventListener('focus', refreshToday);
  window.addEventListener('pageshow', refreshToday);

  /* Table des valeurs des aliments (écran d'aide), une fois pour toutes */
  const num = function(n, d){ return n.toLocaleString('fr-FR', {maximumFractionDigits:d}); };
  $('ref-tables').innerHTML = refTable().map(function(g){
    return '<table class="ref-t"><caption>' + g.title + '<span>' + g.per + '</span></caption>' +
      '<colgroup><col><col class="k"><col class="n"><col class="n"><col class="n"></colgroup>' +
      '<thead><tr><th scope="col">Aliment</th><th scope="col">kcal</th><th scope="col" class="p"><abbr title="protéines">P</abbr></th>' +
      '<th scope="col" class="c"><abbr title="glucides">G</abbr></th><th scope="col" class="f"><abbr title="lipides">L</abbr></th></tr></thead><tbody>' +
      g.rows.map(function(r){
        return '<tr data-key="' + r.key + '"><th scope="row">' + r.label + '</th><td>' + num(r.v[0], 0) + '</td><td>' + num(r.v[1], 1) + '</td><td>' + num(r.v[2], 1) + '</td><td>' + num(r.v[3], 1) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }).join('');
  $('app-version').textContent = APP_VERSION;
  loadSel();
  render();
  /* Premier lancement : aucun profil enregistré (sans stockage, on n'insiste pas) */
  let firstRun = false;
  try { firstRun = localStorage.getItem(PKEY) === null; } catch (e) {}
  if (firstRun) openAcc({});
  else maybeOpenRepas();

  /* Appli installable (PWA) : le service worker (sw.js) garde la page pour le hors connexion, enregistré seulement si
     la page est servie en http(s) ; sur Android, bouton « Installer l'appli » dans les réglages quand le navigateur le propose */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); installEvt = e; $('install').hidden = false; });
  window.addEventListener('appinstalled', function(){ installEvt = null; $('install').hidden = true; });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
    window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  }
  Object.assign(ACTIONS, {
    installer: function(){
      if (installEvt){ installEvt.prompt(); installEvt = null; }
      $('install').hidden = true;
    }
  });
