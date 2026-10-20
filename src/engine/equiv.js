/* Équivalences (4.2.0) : pour un aliment et une quantité, la quantité de chaque aliment de la même famille qui apporte
   autant de calories (féculents, matières grasses) ou de protéines (protéines). Valeurs de la table (FOOD, UNIT, STARCH),
   aucune nouvelle valeur. Un aliment : id, name, f (pour 100 g crus : kcal, protéines, glucides, lipides), step (arrondi en
   grammes), cook (poids cuits : [[facteur, mot]], depuis le poids cru, « cru » sinon raw), unit ({ g, one, many } : une pièce,
   une tranche, une boîte, une cuillère ; piece : compté d'abord en pièces, œufs et galettes). */
function perPiece(u, g){ const v = UNIT[u]; return v.map(function(x){ return x * 100 / g; }); }
const EQ_GROUPS = {
  starch:{label:'Féculents', basis:0, items:STARCH_ORDER.map(function(id){
    const S = STARCH[id];
    return {id:id, name:S.name, f:S.f, step:S.step, raw:S.raw || null, cook:S.cook || null};
  }).concat([
    {id:'pain', name:'pain complet', f:FOOD.pain, step:5, unit:{g:40, one:'tranche', many:'tranches'}},
    {id:'avoine', name:'flocons d’avoine', f:FOOD.avoine, step:5},
    {id:'galette', name:'galettes de riz soufflé', f:perPiece('galette', 9), step:1, unit:{g:9, one:'galette de riz soufflé', many:'galettes de riz soufflé', piece:true}}
  ])},
  prot:{label:'Protéines', basis:1, items:[
    {id:'poulet', name:'viande blanche maigre', note:'poulet, dinde, filet mignon de porc', f:FOOD.poulet, step:5, raw:'cru', cook:[[YIELD.poulet, 'cuit']]},
    {id:'boeuf', name:'bœuf haché 5' + NB + '%', f:FOOD.boeuf, step:5, raw:'cru', cook:[[YIELD.boeuf, 'cuit']]},
    {id:'poisson', name:'poisson blanc', note:'cabillaud, colin…', f:FOOD.poisson, step:5, raw:'cru', cook:[[YIELD.poisson, 'cuit']]},
    {id:'saumon', name:'poisson gras', note:'saumon, maquereau, sardines à l’huile', f:FOOD.saumon, step:5, raw:'cru', cook:[[YIELD.saumon, 'cuit']]},
    {id:'crevettes', name:'crevettes cuites', f:FOOD.crevettes, step:5},
    {id:'thon', name:'thon au naturel, égoutté', f:FOOD.thon, step:5, unit:{g:110, one:'boîte', many:'boîtes'}},
    {id:'oeuf', name:'œufs', f:perPiece('oeuf', 50), step:1, unit:{g:50, one:'œuf', many:'œufs', piece:true}},
    {id:'jambon', name:'jambon blanc', f:FOOD.jambon, step:5, unit:{g:45, one:'tranche', many:'tranches'}},
    {id:'tofu', name:'tofu ferme', f:FOOD.tofu, step:5},
    {id:'skyr', name:'skyr nature', f:FOOD.skyr, step:10},
    {id:'halloumi', name:'halloumi', f:FOOD.halloumi, step:5}
  ]},
  fat:{label:'Matières grasses', basis:0, items:[
    {id:'huile', name:'huile d’olive', f:FOOD.huile, step:1, unit:{g:10, one:'cuillère à soupe', many:'cuillères à soupe'}},
    {id:'amandes', name:'amandes', f:FOOD.amandes, step:5},
    {id:'parmesan', name:'parmesan', f:FOOD.parmesan, step:5},
    {id:'olives', name:'olives noires', f:FOOD.olives, step:5},
    {id:'tahini', name:'tahini', note:'purée de sésame', f:FOOD.tahini, step:5},
    {id:'sesame', name:'graines de sésame', f:FOOD.sesame, step:5},
    {id:'creme', name:'crème légère', f:FOOD.creme, step:5},
    {id:'coco', name:'lait de coco', f:FOOD.coco, step:5},
    {id:'chocolat', name:'chocolat noir 70' + NB + '%', f:FOOD.chocolat, step:5}
  ]}
};
const EQ_ORDER = ['starch', 'prot', 'fat'];
function eqItem(group, id){
  if (!has(EQ_GROUPS, group)) return null;
  return EQ_GROUPS[group].items.find(function(x){ return x.id === id; }) || null;
}
/* Unités possibles d'un aliment : 'g' (cru, ou tel quel), 'cuit:i' (le i-e poids cuit), 'unit' (pièces) */
function eqUnits(x){
  const out = [{v:'g', label:'g' + (x.raw ? ' ' + x.raw : '')}];
  (x.cook || []).forEach(function(c, i){ out.push({v:'cuit:' + i, label:'g ' + c[1]}); });
  if (x.unit) out.push({v:'unit', label:x.unit.many});
  return out;
}
/* Quantité saisie → grammes crus (null si elle ne va pas) */
function eqRaw(x, qty, unit){
  if (typeof qty !== 'number' || !isFinite(qty) || qty <= 0 || qty > 5000) return null;
  if (unit === 'unit' && x.unit) return qty * x.unit.g;
  const m = /^cuit:(\d)$/.exec(unit || '');
  if (m && x.cook && x.cook[+m[1]]) return qty / x.cook[+m[1]][0];
  return unit === 'g' || unit === undefined ? qty : null;
}
function eqMac(x, g){ const k = g / 100; return {kcal:x.f[0] * k, p:x.f[1] * k, c:x.f[2] * k, f:x.f[3] * k}; }
/* Une ligne : grammes arrondis au pas, poids cuits (à 5 g), pièces (au quart), macros des grammes affichés */
function eqLine(x, raw){
  const g = Math.max(x.step, Math.round(raw / x.step) * x.step);
  return {id:x.id, name:x.name, note:x.note || null, g:g, raw:x.raw || null, m:eqMac(x, g),
    cooked:(x.cook || []).map(function(c){ return {g:Math.round(g * c[0] / 5) * 5, adj:c[1]}; }),
    n:x.unit ? Math.round(g / x.unit.g * 4) / 4 : null, unit:x.unit || null};
}
/* Les équivalents : { ref, value, basis, lines } (ref : la portion saisie, lines : les autres aliments de la famille, à
   calories ou à protéines égales) ; null si la saisie ne va pas */
function equivalents(group, id, qty, unit){
  const x = eqItem(group, id), raw = x ? eqRaw(x, qty, unit) : null;
  if (raw === null) return null;
  const G = EQ_GROUPS[group], b = G.basis, value = x.f[b] * raw / 100;
  return {ref:Object.assign(eqLine(x, raw), {g:Math.round(raw * 10) / 10, m:eqMac(x, raw)}), value:value, basis:b === 1 ? 'p' : 'kcal',
    lines:G.items.filter(function(y){ return y.id !== id && y.f[b] > 0; }).map(function(y){ return eqLine(y, value / y.f[b] * 100); })};
}
/* L'aliment d'une ligne de la journée (son achat, buy : { id, g } ou { id, n }) dans sa famille (amandes, parmesan, huile :
   matières grasses) ; null s'il n'y en a pas */
function eqOfBuy(buy){
  if (!buy || !buy.id) return null;
  const map = {oeuf:['prot', 'oeuf'], galette:['starch', 'galette']};
  const at = has(map, buy.id) ? map[buy.id] : has(STARCH, buy.id) ? ['starch', buy.id] : ['huile', 'amandes', 'parmesan', 'olives', 'tahini', 'sesame', 'creme', 'coco', 'chocolat'].indexOf(buy.id) >= 0 ? ['fat', buy.id]
    : eqItem('prot', buy.id) ? ['prot', buy.id] : eqItem('starch', buy.id) ? ['starch', buy.id] : null;
  if (!at) return null;
  const x = eqItem(at[0], at[1]);
  if (typeof buy.n === 'number' && x.unit) return {group:at[0], id:at[1], qty:buy.n, unit:'unit'};
  if (typeof buy.g === 'number') return {group:at[0], id:at[1], qty:buy.g, unit:'g'};
  return null;
}
