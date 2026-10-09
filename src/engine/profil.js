/* Profil et dépense : profil validé (profileFields, cleanProfile), métabolisme de base, dépense de repos, coût des séances,
   objectif du jour (energy). Règles : CLAUDE.md, « Dépense et objectif ». */
/* Profil et dépense énergétique */
const PROFILE_DEFAULT = {mode:'auto', sexe:'h', age:35, taille:178, poids:72, neat:'assis', gras:null, repos:null, deficit:15, ravito:60, shaker:'oui', shakerKcal:120, shakerProt:24, kcalPetite:null, kcalMoyenne:null, kcalLongueH:null, marge:150, prot:2, off:[], fav:[], ban:[], semaine:{jours:{}, libre:6}};
const PROFILE_RANGES = {age:[14,99], taille:[120,230], poids:[35,250], gras:[3,60], repos:[1200,6000], deficit:[0,25], ravito:[30,90], shakerKcal:[100,160], shakerProt:[10,40], kcalPetite:[100,1000], kcalMoyenne:[150,1500], kcalLongueH:[200,1200], marge:[0,300], prot:[1.6,2.2]};
/* Activité hors sport, en multiple du métabolisme de base (effet thermique des repas compris) */
const NEAT = {assis:1.4, mixte:1.55, debout:1.7};
const KCAL_PER_KG = 7700;
function profileFields(o){
  const out = {};
  if (!o || typeof o !== 'object') return out;
  if (o.mode === 'auto' || o.mode === 'manuel') out.mode = o.mode;
  if (o.shaker === 'oui' || o.shaker === 'non') out.shaker = o.shaker;
  if (o.sexe === 'h' || o.sexe === 'f') out.sexe = o.sexe;
  if (has(NEAT, o.neat)) out.neat = o.neat;
  Object.keys(PROFILE_RANGES).forEach(function(k){
    const v = o[k], r = PROFILE_RANGES[k];
    if (typeof v === 'number' && v >= r[0] && v <= r[1]) out[k] = v;
  });
  /* Objectif de protéines borné à 2,2 g/kg depuis la 3.11.1 : un objectif enregistré plus haut (jusqu'à 3,0, permis avant)
     devient 2,2 plutôt que la valeur par défaut */
  if (typeof o.prot === 'number' && o.prot > PROFILE_RANGES.prot[1] && o.prot <= 3) out.prot = PROFILE_RANGES.prot[1];
  if (Array.isArray(o.off)){ const off = cleanOff(o.off); if (off.length) out.off = off; }
  /* Recettes favorites et à éviter (3.25.0) : l'une ou l'autre, la favorite l'emporte */
  const fav = cleanRecipeIds(o.fav), ban = cleanRecipeIds(o.ban).filter(function(id){ return fav.indexOf(id) < 0; });
  if (fav.length) out.fav = fav;
  if (ban.length) out.ban = ban;
  if (o.semaine && typeof o.semaine === 'object'){ const w = cleanWeek(o.semaine); if (Object.keys(w.jours).length || w.libre !== 6) out.semaine = w; }
  return out;
}
/* Profil complet. Enregistré avant la 1.3.0 (sans mode) : manuel s'il contient une dépense valide, sinon automatique.
   @param {*} o champs enregistrés  @returns {Profile} */
function cleanProfile(o){
  const f = profileFields(o);
  if (!f.mode) f.mode = has(f, 'repos') ? 'manuel' : 'auto';
  const out = Object.assign({}, PROFILE_DEFAULT, f);
  out.off = (f.off || []).slice();
  out.fav = (f.fav || []).slice();
  out.ban = (f.ban || []).slice();
  out.semaine = cleanWeek(f.semaine);
  return out;
}
/* Métabolisme de base : Cunningham si la masse grasse est connue (plus juste chez les sportifs), sinon Mifflin-St Jeor */
function bmr(p){
  if (p.gras !== null) return 500 + 22 * p.poids * (1 - p.gras / 100);
  return 10 * p.poids + 6.25 * p.taille - 5 * p.age + (p.sexe === 'f' ? -161 : 5);
}
/* Dépense d'un jour sans sport : saisie en mode manuel (bornes de PROFILE_RANGES), sinon calculée.
   En manuel sans dépense valide, le calcul prend le relais. */
function restSource(p){ return p.mode === 'manuel' && p.repos !== null ? 'saisie' : 'calcul'; }
function restNeed(p){ return restSource(p) === 'saisie' ? p.repos : bmr(p) * NEAT[p.neat]; }
/* Coût net d'une séance (le repos est déjà compté) : valeur du profil, sinon net × poids.
   Petite ≈ 1 h de muscu (5 MET), moyenne ≈ 7 km de course (≈ 0,9 kcal/kg/km), longue ≈ vélo d'endurance (8 MET) par heure. */
function seanceCost(x, p){
  if (x.taille === 'petite') return p.kcalPetite !== null ? p.kcalPetite : SIZES.petite.net * p.poids;
  if (x.taille === 'moyenne') return p.kcalMoyenne !== null ? p.kcalMoyenne : SIZES.moyenne.net * p.poids;
  return (p.kcalLongueH !== null ? p.kcalLongueH : SIZES.longue.net * p.poids) * x.duree;
}
function dayCost(plan, p){ return plan.seances.reduce(function(a, x){ return a + seanceCost(x, p); }, 0); }
/* Le déficit est un % de la dépense d'un jour sans sport, retiré chaque jour : les séances restent couvertes.
   @param {Plan} plan  @param {Profile} p  @returns {Energy} */
/* Recharge la veille d'une sortie longue (3.28.0) : 0,5 g de glucides par kg et par heure de la sortie du lendemain
   (plan.veille, sa durée en heures ; ajoutée par l'interface, jamais enregistrée), soit 36 g par heure à 72 kg, × k.
   Ajoutée à l'objectif du jour en féculents, au dîner d'abord (jusqu'à son plafond, puis le déjeuner, puis un encas) : le
   déficit de ce jour-là est plus petit d'autant. */
const RECHARGE_G = 36;
function rechargeG(plan, p){
  const h = plan && typeof plan.veille === 'number' && plan.veille > 0 && plan.veille <= 8 ? plan.veille : 0;
  return h ? RECHARGE_G * scaleOf(p) * h : 0;
}
function energy(plan, p){
  const rest = restNeed(p), cost = dayCost(plan, p), deficit = rest * p.deficit / 100, recharge = rechargeG(plan, p);
  return {bmr:bmr(p), rest:rest, mode:p.mode, restSource:restSource(p), cost:cost, need:rest + cost, deficit:deficit, recharge:recharge,
    target:Math.round((rest + cost - deficit + 4 * recharge) / 10) * 10, kgWeek:deficit * 7 / KCAL_PER_KG};
}
