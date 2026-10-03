  /* Recette choisie ou retirée depuis la page : le focus reste sur son bouton */
  let recFocus = null;
  /* Un bouton touché : son action (ACTIONS, ajoutées par chaque écran) ; si elle renvoie un message, la page est redessinée */
  document.addEventListener('click', function(e){
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const v = b.dataset.value;
    /* Choix de plats : repères de la semaine avant, pour dire tout de suite si un choix fait dépasser une limite */
    const wb0 = /^(pd|prot|starch|repas-ok)$/.test(b.dataset.action) && b.closest('#page, #plan, #repas, #sheet') ? weekBal(selDate) : null;
    /* Boutons de l'assistant : seulement pendant l'assistant, à la bonne étape (choix des jours ou un jour) */
    if (/^pl-/.test(b.dataset.action) && (!planner || (['pl-preset', 'pl-start', 'pl-nrec', 'pl-batch'].indexOf(b.dataset.action) >= 0) !== (planner.i < 0))) return;
    if (!has(ACTIONS, b.dataset.action)) return;
    let msg = ACTIONS[b.dataset.action](b, v);
    if (msg === undefined) return;
    if (wb0 && !msg) msg = crossMsg(wb0, weekBal(selDate));
    $('hint').textContent = msg;
    if (planner && (b.closest('#plan') || (b.closest('#sheet') && topScreen() === 'plan')) && b.dataset.action !== 'pl-hasard') planner.msg = msg;
    const inPlan = b.closest('#plan') ? b : null;
    render();
    /* Assistant redessiné : le focus revient sur le même bouton */
    if (inPlan && topScreen() === 'plan'){
      const same = [...$('plan-body').querySelectorAll('[data-action="' + inPlan.dataset.action + '"]')].find(function(x){
        return ['value', 'slot', 'index', 'key'].every(function(k){ return x.dataset[k] === inPlan.dataset[k]; });
      });
      if (same) same.focus({preventScroll:true});
    }
    /* Un choix dans le panneau le valide et le ferme */
    if (pick && b.closest('#sheet')) closePick(false);
    else if (recFocus && $('rec-c-' + recFocus)) $('rec-c-' + recFocus).focus({preventScroll:true});
    recFocus = null;
  });
