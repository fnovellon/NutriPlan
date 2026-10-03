/* Équilibre de la semaine (3.9.0) : repères (WEEK_GOALS), compte d'une semaine (weekBalance), ce qui manque (weekNeeds). */
/* Repères de la semaine (Santé publique France, 2019) : poisson 2 fois dont 1 poisson gras, légumes secs au moins 2 fois,
   viande rouge 500 g cuits au plus, charcuterie 150 g au plus (le jambon blanc en est). Comptés sur des journées construites
   par buildDay (portions réelles), repas libre exclu ; viande rouge = bœuf cru × rendement de cuisson. */
const WEEK_GOALS = {poisson:2, gras:1, legumes:2, rouge:500, charcuterie:150};
const FISH = ['poisson', 'saumon', 'thon'], LEGUMES = ['lentilles', 'poischiches'];
/** @param {Day[]} days  @returns {{poisson:number, gras:number, legumes:number, rouge:number, charcuterie:number}} */
function weekBalance(days){
  const b = {poisson:0, gras:0, legumes:0, rouge:0, charcuterie:0};
  days.forEach(function(r){ r.secs.forEach(function(s){
    if (s.libre) return;
    s.items.forEach(function(i){
      if (!i.buy) return;
      if ((s.id === 'dej' || s.id === 'diner') && i.key === 'p1' && FISH.indexOf(i.buy.id) >= 0){ b.poisson++; if (i.buy.id === 'saumon') b.gras++; }
      if (i.key === 'st' && LEGUMES.indexOf(i.buy.id) >= 0) b.legumes++;
      if (i.buy.id === 'boeuf') b.rouge += i.buy.g * YIELD.boeuf;
      if (i.buy.id === 'jambon') b.charcuterie += i.buy.g;
    });
  }); });
  return b;
}
/* Ce que la semaine demande encore, dans l'ordre d'importance : trop de charcuterie, trop de viande rouge, poisson gras,
   poisson, légumes secs. [] : semaine équilibrée. */
function weekNeeds(b){
  const out = [];
  if (b.charcuterie > WEEK_GOALS.charcuterie + 0.5) out.push('charcuterie');
  if (b.rouge > WEEK_GOALS.rouge + 0.5) out.push('rouge');
  if (b.gras < WEEK_GOALS.gras) out.push('gras');
  if (b.poisson < WEEK_GOALS.poisson) out.push('poisson');
  if (b.legumes < WEEK_GOALS.legumes) out.push('legumes');
  return out;
}
