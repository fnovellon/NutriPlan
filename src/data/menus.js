/* Données : ce qu'on choisit aux repas. Desserts (DESSERT), bases du petit-déjeuner (PD), protéines du déjeuner et du dîner
   avec leurs portions de référence à 72 kg (PROT), plats par défaut de chaque jour de la semaine (DEFAULT_CHOICES). */
/* Desserts du déjeuner et du dîner : quantités fixes (pas mises à l'échelle du poids), calories prises sur le féculent du même repas */
const DESSERT = {
  aucun:{label:'Aucun'},
  fruit:{label:'Fruit', item:function(){ return it('des', '1', 'fruit', 'pomme, poire, orange, 2 kiwis…', unitMac('pomme', 1), null, {id:'fruit', n:1}); }},
  compote:{label:'Compote', item:function(){ return it('des', '1', 'compote', 'sans sucre ajouté', unitMac('compote', 1)); }},
  fruitsSecs:{label:'Fruits secs', sub:'abricots, pruneaux, figues', item:function(){ return it('des', grams(30), 'fruits secs', 'abricots, pruneaux ou figues', mac('fruitsSecs', 30)); }},
  chocolat:{label:'Chocolat noir', item:function(){ return it('des', grams(20), 'chocolat noir', '70' + NB + '% ou plus, 2 à 4 carrés selon la tablette', mac('chocolat', 20)); }}
};
const DESSERT_ORDER = ['aucun','fruit','compote','fruitsSecs','chocolat'];
/* Base du petit-déjeuner : avoine (ou muesli sans sucre ajouté, valeurs proches), pain complet, ou salé (pain, œufs, jambon) */
const PD = {
  avoine:{label:'Flocons d’avoine', sub:'ou muesli sans sucre ajouté'},
  pain:{label:'Pain complet'},
  sale:{label:'Salé', sub:'pain complet, œufs, jambon'}
};
const PD_ORDER = ['avoine','pain','sale'];

/* Protéines du déjeuner et du dîner, avec leur matière grasse : portions de référence (72 kg) mises à l'échelle k ;
   base(k, g) : g = [p1, p2] en grammes, poids fixés d'une boîte de batch cooking (voir fixedGrams), sinon null.
   Restent fixes : les amandes du dîner (comme l'était le demi-avocat) et la boîte de thon (on ne coupe pas une boîte). */
/* Remplacement proposé en note : même énergie, arrondie à 5 g (quantité fixe, comme ce qu'il remplace) */
function swapGrams(kcal, food){ return Math.max(5, Math.round(kcal / FOOD[food][0] * 100 / 5) * 5); }
/* Lipides du dîner avec une protéine très maigre (viande blanche, poisson blanc) : 25 g d'amandes, fixes (3.10.0 : à la place
   du ½ avocat, même énergie) */
function amandesDiner(){ return it('dam', grams(25), 'amandes', 'sur les légumes ou en fin de repas', mac('amandes', 25)); }
const PROT = {
  poulet:{label:'Viande blanche', sub:'poulet, dinde, filet mignon de porc',
    base:function(k, g){ return [meat(g && g[0] ? g[0] : sc(180, 10, k), 'viande blanche maigre', 'poulet, dinde ou filet mignon de porc', 'poulet')]; },
    dej:function(){ return []; },
    diner:function(){ return [amandesDiner()]; }},
  boeuf:{label:'Bœuf 5' + NB + '%',
    base:function(k, g){ return [meat(g && g[0] ? g[0] : sc(150, 10, k), 'bœuf haché 5' + NB + '%', null, 'boeuf')]; },
    dej:function(){ return []; },
    diner:function(k){ const g = sc(15, 5, k); return [it('pm', grams(g), 'parmesan', null, mac('parmesan', g))]; }},
  poisson:{label:'Poisson blanc',
    base:function(k, g){ return [meat(g && g[0] ? g[0] : sc(200, 10, k), 'poisson blanc', 'cabillaud, colin…', 'poisson')]; },
    dej:function(){ return []; },
    diner:function(){ return [amandesDiner()]; }},
  saumon:{label:'Poisson gras', sub:'saumon, maquereau, sardines à l’huile',
    base:function(k, g){ return [meat(g && g[0] ? g[0] : sc(160, 10, k), 'poisson gras', 'saumon, maquereau ou sardines à l’huile égouttées, sans matière grasse', 'saumon')]; },
    dej:function(){ return []; },
    diner:function(){ return []; }},
  crevettes:{label:'Crevettes + halloumi',
    base:function(k, g){
      const c = g && g[0] ? g[0] : sc(120, 10, k), h = g && g[1] ? g[1] : sc(60, 5, k);
      return [it('p1', grams(c), 'crevettes cuites', null, mac('crevettes', c)), it('p2', grams(h), 'halloumi', 'grillé à sec', mac('halloumi', h))];
    },
    dej:function(){ return []; },
    diner:function(){ return []; }},
  oeufs:{label:'Œufs + jambon',
    base:function(k, g){
      const n = pieces(3, k), j = g && g[1] ? g[1] : sc(90, 5, k);
      return [it('p1', String(n), n > 1 ? 'œufs' : 'œuf', null, unitMac('oeuf', n)), it('p2', grams(j), 'jambon blanc', slices(j, 45), mac('jambon', j))];
    },
    dej:function(){ return []; },
    diner:function(){ return []; }},
  thon:{label:'Thon', fixe:true,
    base:function(){ return [it('p1', '1', 'boîte de thon au naturel', 'environ 110' + NB + 'g égoutté', mac('thon', 110), null, {id:'thon', n:1}), it('p2', '1', 'œuf dur', 'ou ' + swapGrams(UNIT.oeuf[0], 'parmesan') + NB + 'g de parmesan', unitMac('oeuf', 1))]; },
    dej:function(){ return []; },
    diner:function(){ return []; }},
  /* Tofu : moins riche en protéines (14 g pour 100 g) mais déjà gras, sans matière grasse en plus */
  tofu:{label:'Tofu ferme',
    base:function(k, f){ const g = f && f[0] ? f[0] : sc(200, 10, k); return [it('p1', grams(g), 'tofu ferme', 'nature, pressé puis poêlé', mac('tofu', g))]; },
    dej:function(){ return []; },
    diner:function(){ return []; }}
};
const PROT_ORDER = ['poulet','boeuf','poisson','saumon','crevettes','oeufs','thon','tofu'];

const DEFAULT_CHOICES = {
  0:{pdBase:'pain', dej:{prot:'poulet', starch:'pdt'}, diner:{prot:'oeufs', starch:'riz'}},
  1:{pdBase:'avoine', dej:{prot:'poulet', starch:'riz'}, diner:{prot:'crevettes', starch:'quinoa'}},
  2:{pdBase:'avoine', dej:{prot:'poulet', starch:'riz'}, diner:{prot:'boeuf', starch:'pates'}},
  3:{pdBase:'avoine', dej:{prot:'poulet', starch:'riz'}, diner:{prot:'poisson', starch:'lentilles'}},
  4:{pdBase:'avoine', dej:{prot:'boeuf', starch:'riz'}, diner:{prot:'saumon', starch:'riz'}},
  5:{pdBase:'avoine', dej:{prot:'boeuf', starch:'riz'}, diner:{prot:'poulet', starch:'patate'}},
  6:{pdBase:'avoine', dej:{prot:'thon', starch:'pates'}, diner:{prot:'saumon', starch:'pdt'}}
};
