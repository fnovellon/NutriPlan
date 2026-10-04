  /* Recette choisie ou retirée depuis la page : le focus reste sur son bouton */
  let recFocus = null;
  /* Un bouton touché : son action (ACTIONS, ajoutées par chaque écran) ; si elle renvoie un message, la page est redessinée */
  document.addEventListener('click', function(e){
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const v = b.dataset.value;
    /* Choix de plats : repères de la semaine avant, pour dire tout de suite si un choix fait dépasser une limite */
    const wb0 = /^(pd|prot|starch|repas-ok)$/.test(b.dataset.action) && b.closest('#page, #repas, #sheet') ? weekBal(selDate) : null;
    if (!has(ACTIONS, b.dataset.action)) return;
    let msg = ACTIONS[b.dataset.action](b, v);
    if (msg === undefined) return;
    if (wb0 && !msg) msg = crossMsg(wb0, weekBal(selDate));
    $('hint').textContent = msg;
    const keep = b.id && b.closest('#day') ? b.id : null;
    render();
    /* Un choix dans le panneau le valide et le ferme */
    if (pick && b.closest('#sheet')) closePick(false);
    else if (recFocus && $('rec-c-' + recFocus)) $('rec-c-' + recFocus).focus({preventScroll:true});
    /* Bouton d'une carte redessinée (repas libre) : le focus reste dessus */
    else if (keep && $(keep)) $(keep).focus({preventScroll:true});
    recFocus = null;
  });
