/* Liste de courses : les achats (buy) de plusieurs journées construites par buildDay, additionnés et rangés par rayon.
   Poids crus, pièces entières, budgets en kcal.
   Renvoie [{title, lines:[{id, qty, name, note}]}], rayons et lignes vides omis. */
const SHOP_AISLES = [
  {title:'Viandes et poissons', ids:['poulet', 'boeuf', 'poisson', 'saumon', 'crevettes', 'jambon']},
  {title:'Crèmerie, œufs et tofu', ids:['skyr', 'oeufs', 'halloumi', 'parmesan', 'creme', 'lait', 'tofu']},
  {title:'Pain et féculents, poids crus', ids:['pain', 'tortilla'].concat(STARCH_ORDER, ['rizrond'])},
  {title:'Fruits et légumes', ids:['legumes'].concat(VEG_IDS.filter(function(v){ return v !== 'pulpe'; }), ['fruitsRouges', 'banane', 'pomme', 'fruit'])},
  {title:'Épicerie', ids:['avoine', 'amandes', 'miel', 'fruitsSecs', 'chocolat', 'cacao', 'galette', 'thon', 'pulpe', 'compote', 'huile', 'coco', 'olives', 'sesame', 'tahini']},
  {title:'Le reste', ids:['shaker', 'ravito', 'encas', 'marge', 'libre']}
];
function shopQty(g){
  if (g < 1000) return grams(Math.round(g));
  return (Math.round(g / 10) / 100).toLocaleString('fr-FR') + NB + 'kg';
}
/** @param {Day[]} days  @returns {{title:string, lines:{id:string, qty:string, name:string, note:?string}[]}[]} */
function shoppingList(days){
  const sum = {};
  days.forEach(function(d){ d.secs.forEach(function(s){ s.items.forEach(function(i){
    if (!i.buy) return;
    const a = sum[i.buy.id] || (sum[i.buy.id] = {g:0, n:0, kcal:0});
    a.g += i.buy.g || 0; a.n += i.buy.n || 0; a.kcal += i.buy.kcal || 0;
  }); }); });
  const get = function(id){ return sum[id] || {g:0, n:0, kcal:0}; };
  const pl = function(n, one, many){ return n > 1 ? many : one; };
  const kc = function(k){ return '≈' + NB + fmtInt(Math.round(k / 10) * 10) + NB + 'kcal'; };
  const line = function(id){
    const a = get(id);
    if (id === 'oeufs'){
      const n = get('oeuf').n;
      return n ? {qty:String(n), name:pl(n, 'œuf', 'œufs'), note:null} : null;
    }
    const PIECES = {banane:['banane', 'bananes', null], pomme:['pomme', 'pommes', null], fruit:['fruit au choix', 'fruits au choix', 'pomme, poire, orange, 2 kiwis…'],
      thon:['boîte de thon au naturel', 'boîtes de thon au naturel', null], compote:['compote', 'compotes', 'pots sans sucre ajouté'],
      shaker:['dose de shaker', 'doses de shaker', null], tortilla:['tortilla complète', 'tortillas complètes', null],
      galette:['galette de riz soufflé', 'galettes de riz soufflé', null]};
    /* Pièces entières (une demi-boîte de thon à la collation, 3.29.0 : on en achète une) */
    const n = Math.ceil(a.n - 1e-9);
    if (has(PIECES, id)) return n ? {qty:String(n), name:pl(n, PIECES[id][0], PIECES[id][1]), note:PIECES[id][2]} : null;
    if (id === 'libre') return a.n ? {qty:String(a.n), name:pl(a.n, 'repas libre', 'repas libres'), note:kc(a.kcal) + ' au total'} : null;
    if (id === 'encas') return a.kcal ? {qty:kc(a.kcal), name:'d’encas', note:'pain complet et miel, fruits secs, riz au lait, barre de céréales'} : null;
    if (id === 'marge') return a.kcal ? {qty:kc(a.kcal), name:'pour la cuisine', note:'environ ' + grams(Math.round(a.kcal / 9 / 5) * 5) + ' d’huile'} : null;
    if (!a.g) return null;
    /* Oignons (3.27.0) : à acheter entiers, au-dessus de ce que demandent les plats */
    if (id === 'oignon'){ const n = Math.max(1, Math.ceil(a.g / ONION_G - 0.001)); return {qty:String(n), name:pl(n, 'oignon', 'oignons'), note:'pour ≈' + NB + shopQty(a.g) + ', ou des échalotes'}; }
    if (id === 'ravito') return {qty:shopQty(a.g), name:'de glucides pour l’effort', note:'boisson d’effort, gels ou pâtes de fruits'};
    const NAMES = {poulet:'viande blanche maigre', boeuf:'bœuf haché 5' + NB + '%', poisson:'poisson blanc', saumon:'poisson gras', crevettes:'crevettes cuites',
      jambon:'jambon blanc', skyr:'skyr nature', halloumi:'halloumi', parmesan:'parmesan', tofu:'tofu ferme', pain:'pain complet', legumes:'légumes verts',
      fruitsRouges:'fruits rouges', avoine:'flocons d’avoine ou muesli', amandes:'amandes', miel:'miel', fruitsSecs:'fruits secs', chocolat:'chocolat noir', huile:'huile d’olive',
      cacao:'cacao non sucré', rizrond:'riz rond'};
    const NOTES = {poulet:'poulet, dinde ou filet mignon de porc', poisson:'cabillaud, colin…', saumon:'saumon, maquereau ou sardines à l’huile', tofu:'nature', avoine:'muesli sans sucre ajouté',
      jambon:slices(a.g, 45), pain:slices(a.g, 40), legumes:'au choix', fruitsRouges:'surgelés, c’est parfait', fruitsSecs:'abricots, pruneaux ou figues',
      chocolat:'70' + NB + '% ou plus', cacao:'en poudre', rizrond:'pour le riz au lait'};
    return {qty:shopQty(a.g), name:has(STARCH, id) ? STARCH[id].name : has(NAMES, id) ? NAMES[id] : RFOOD[id][0],
      note:has(NOTES, id) ? NOTES[id] : has(RFOOD, id) ? RFOOD[id][1] : null};
  };
  return SHOP_AISLES.map(function(g){
    return {title:g.title, lines:g.ids.map(function(id){ const l = line(id); return l ? Object.assign({id:id}, l) : null; }).filter(Boolean)};
  }).filter(function(g){ return g.lines.length; });
}
