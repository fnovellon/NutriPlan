/* Séances et plan d'un jour : tailles de séance (SIZES), moments, durées de la sortie longue, jours de la semaine ;
   séances, plan d'un jour et semaine type relus et validés (cleanSeances, cleanWeek, emptyPlan, cleanPlan, migratePlan). */
/* Séances par taille. Coût net par défaut = net × poids (MET·h nets ; pour la longue, par heure), réglable dans le profil. */
const SIZES = {
  petite:{band:'Petite séance', net:4},
  moyenne:{band:'Séance moyenne', net:6.3},
  longue:{band:'Sortie longue', net:7}
};
const MOMENTS = [['matin', 'Matin'], ['midi', 'Midi'], ['soir', 'Soir']];
const MOMENT_RANK = {matin:0, midi:1, soir:2};
const MAX_SEANCES = 4;
const DUREES = [[1.5,'1h30'],[2,'2' + NB + 'h'],[2.5,'2h30'],[3,'3' + NB + 'h et +']];
const DAYS = [
  {js:1, long:'lundi'}, {js:2, long:'mardi'}, {js:3, long:'mercredi'},
  {js:4, long:'jeudi'}, {js:5, long:'vendredi'}, {js:6, long:'samedi'},
  {js:0, long:'dimanche'}
];
/* Séances valides : au plus 4, une seule longue, toujours le matin. @returns {Seance[]} */
function cleanSeances(list){
  const out = [];
  let long = false;
  (Array.isArray(list) ? list : []).forEach(function(x){
    if (!x || typeof x !== 'object' || !has(SIZES, x.taille) || out.length >= MAX_SEANCES) return;
    if (x.taille === 'longue'){
      if (long) return;
      long = true;
      out.push({taille:'longue', moment:'matin', duree:DUREES.some(function(d){ return d[0] === x.duree; }) ? x.duree : 2});
    } else {
      out.push({taille:x.taille, moment:has(MOMENT_RANK, x.moment) ? x.moment : 'soir'});
    }
  });
  return out;
}
/* Semaine type (réglages, 3.11.0) : séances habituelles par jour (clés getDay, 0 = dimanche) et jour du repas libre
   (samedi par défaut). Seuls les jours avec des séances sont gardés. */
function cleanWeek(o){
  const out = {jours:{}, libre:6};
  if (!o || typeof o !== 'object') return out;
  if (o.jours && typeof o.jours === 'object')
    for (let js = 0; js < 7; js++){ if (has(o.jours, String(js))){ const l = cleanSeances(o.jours[js]); if (l.length) out.jours[js] = l; } }
  if (Number.isInteger(o.libre) && o.libre >= 0 && o.libre <= 6) out.libre = o.libre;
  return out;
}
/* Jour pas encore rempli : les séances de la semaine type (aucune sans elle), repas libre son jour (samedi sans elle) */
function emptyPlan(js, sem){
  const w = sem || null, l = w && has(w.jours, String(js)) ? w.jours[js] : [];
  return {seances:l.map(function(x){ return Object.assign({}, x); }), libre:js === (w ? w.libre : 6)};
}
/* Plan d'un jour relu du stockage : ce qui n'est pas enregistré (séances, repas libre) vient de la semaine type.
   @param {*} p  @param {number} js jour de la semaine (getDay)  @param {Week} [sem]  @returns {Plan} */
function cleanPlan(p, js, sem){
  const out = emptyPlan(js, sem);
  if (!p || typeof p !== 'object') return out;
  if (has(p, 'libre')) out.libre = !!p.libre;
  if (has(p, 'seances')) out.seances = cleanSeances(p.seances);
  return out;
}
/* Plan enregistré avant la 2.0.0 (activité par sport) converti en séances */
function migratePlan(p){
  if (!p || typeof p !== 'object') return null;
  const m = p.moment === 'matin' ? 'matin' : 'soir', a = p.activity, list = [];
  if (a === 'muscu' || a === 'double') list.push({taille:'petite', moment:m});
  if (a === 'course' || a === 'double') list.push({taille:'moyenne', moment:m});
  if (a === 'longue') list.push({taille:'longue', moment:'matin', duree:p.duree});
  if (p.natation && a !== 'longue') list.push({taille:'petite', moment:'midi'});
  return {seances:list, libre:!!p.libre};
}
function dureeLabel(d){ const x = DUREES.find(function(a){ return a[0] === d; }); return x ? x[1] : DUREES[1][1]; }
