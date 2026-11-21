/* Saisons des recettes (4.3.0). Une recette est de saison quand au moins 60 % du poids de ses légumes (et de ses
   châtaignes) l'est ; les légumes de toute l'année (oignon, carotte, pulpe de tomate, champignons de Paris, petits pois
   surgelés) le sont toujours. Une recette de tomates, courgettes ou poivrons est donc d'été, une sauce tomate avec un peu de
   courgette de toute l'année. Calendrier des légumes frais en France métropolitaine (VEG_SEASONS). */
const SEASONS = ['printemps', 'ete', 'automne', 'hiver'];
const SEASON_LABEL = {printemps:'printemps', ete:'été', automne:'automne', hiver:'hiver'};
const VEG_SEASONS = {
  tomate:['ete'], poivron:['ete'], courgette:['ete'], aubergine:['ete'], concombre:['ete'], haricotsverts:['ete'],
  salade:['printemps', 'ete', 'automne'], epinards:['printemps', 'automne', 'hiver'], brocoli:['printemps', 'automne'],
  choufleur:['printemps', 'automne', 'hiver'], chou:['automne', 'hiver'], poireau:['printemps', 'automne', 'hiver'],
  courge:['automne', 'hiver'], panais:['automne', 'hiver'], celeri:['automne', 'hiver'], bruxelles:['automne', 'hiver'],
  fenouil:['ete', 'automne'], chataigne:['automne', 'hiver']
};
/* Saisons d'une recette, dans l'ordre de SEASONS (SEASON_SHARE : part de légumes de saison qu'il faut) */
const SEASON_SHARE = 0.6;
function recipeSeasons(id){
  const x = RECIPES[id], w = {};
  Object.keys(x.leg).forEach(function(v){ w[v] = x.leg[v]; });
  Object.keys(x.plus).forEach(function(v){ if (has(VEG_SEASONS, v)) w[v] = (w[v] || 0) + x.plus[v]; });
  const tot = Object.keys(w).reduce(function(a, v){ return a + w[v]; }, 0);
  const share = function(s){ return Object.keys(w).reduce(function(a, v){ return a + (!has(VEG_SEASONS, v) || VEG_SEASONS[v].indexOf(s) >= 0 ? w[v] : 0); }, 0) / tot; };
  const out = SEASONS.filter(function(s){ return share(s) >= SEASON_SHARE - 1e-9; });
  if (out.length) return out;
  /* Aucune saison n'atteint 60 % : celle ou celles qui en ont le plus */
  const best = Math.max.apply(null, SEASONS.map(share));
  return SEASONS.filter(function(s){ return share(s) === best; });
}
/* Choisies à la main : les champignons des bois de l'automne, même si ceux de Paris sont de toute l'année */
const SEASON_SET = {'poulet-riz-risotto':['automne', 'hiver'], 'poulet-gnocchis-champignons':['automne', 'hiver']};
Object.keys(RECIPES).forEach(function(id){ RECIPES[id].saisons = has(SEASON_SET, id) ? SEASON_SET[id].slice() : recipeSeasons(id); });
/* Saison d'une date : printemps de mars à mai, été de juin à août, automne de septembre à novembre, hiver de décembre à février */
function seasonOf(d){ return ['hiver', 'hiver', 'printemps', 'printemps', 'printemps', 'ete', 'ete', 'ete', 'automne', 'automne', 'automne', 'hiver'][d.getMonth()]; }
/* De saison à cette saison (une recette de toutes les saisons l'est toujours ; un plat simple aussi) */
function inSeason(id, season){ return !id || !has(RECIPES, id) || RECIPES[id].saisons.indexOf(season) >= 0; }
/* Seulement certaines saisons (pas toute l'année) : celles qui ont l'icône */
function seasonal(id){ return has(RECIPES, id) && RECIPES[id].saisons.length < SEASONS.length; }
/* « Automne et hiver », « Toute l'année » */
function seasonsText(id){
  const l = RECIPES[id].saisons;
  if (l.length === SEASONS.length) return 'Toute l’année';
  const n = l.map(function(s){ return SEASON_LABEL[s]; });
  return cap1(n.length > 1 ? n.slice(0, -1).join(', ') + ' et ' + n[n.length - 1] : n[0]);
}
function cap1(t){ return t.charAt(0).toUpperCase() + t.slice(1); }
