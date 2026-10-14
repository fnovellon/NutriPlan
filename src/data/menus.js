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
/* Base du petit-déjeuner : avoine (ou muesli sans sucre ajouté, valeurs proches), pain complet, ou salé (pain, œufs, jambon) ;
   depuis la 3.29.0, sept recettes (voir breakfast). sale : salée, version sucrée au pain les jours de sortie longue ;
   oeufs : des œufs au menu (la collation n'en reprend pas) ; ham : une tranche de jambon (jambon par paquet du batch). */
const PD = {
  avoine:{label:'Flocons d’avoine', sub:'ou muesli sans sucre ajouté'},
  pain:{label:'Pain complet'},
  sale:{label:'Salé', sub:'pain complet, œufs, jambon', sale:true, oeufs:true, ham:true},
  pancakes:{label:'Pancakes avoine-banane', oeufs:true},
  painperdu:{label:'Pain perdu', sub:'sans beurre', oeufs:true},
  bircher:{label:'Bircher', sub:'pomme-cannelle, préparé la veille'},
  porridge:{label:'Porridge choco-banane'},
  brouillade:{label:'Brouillade', sub:'épinards, champignons, pain complet', sale:true, oeufs:true},
  smoothie:{label:'Smoothie à emporter'},
  wrap:{label:'Wrap œufs-jambon', sale:true, oeufs:true, ham:true}
};
const PD_ORDER = ['avoine','pain','sale','pancakes','painperdu','bircher','porridge','brouillade','smoothie','wrap'];
/* Collation (3.29.0) : la partie protéines (ch.co, œufs durs par défaut) et, les jours de séance, celle des glucides (ch.cs,
   banane et compote par défaut) ; le riz au lait fait les deux */
const SNACK = {
  oeufs:{label:'Œufs durs'},
  muffins:{label:'Muffins œuf-épinards'},
  mugcake:{label:'Mug cake skyr-cacao'},
  thon:{label:'Bouchées concombre-thon'},
  rizaulait:{label:'Riz au lait protéiné', sub:'fait aussi la banane et la compote'}
};
const SNACK_ORDER = ['oeufs','muffins','mugcake','thon','rizaulait'];
const SNACK_CS = {banane:{label:'Banane, compote', sub:'la compote avec une séance moyenne ou longue'}, boules:{label:'Boules d’énergie', sub:'flocons, fruits secs, amandes'}};
const SNACK_CS_ORDER = ['banane','boules'];
/* Fiches des petits-déjeuners et des collations (4.1.0, bibliothèque des recettes) : temps de préparation, préparée à
   l'avance (veille) et étapes. Clés : pd:base, co:collation, cs:boules (les boules d'énergie des jours de séance). */
const FICHE = {
  'pd:avoine':{min:5, veille:false, steps:["En porridge\u00a0: fais cuire les flocons 3 à 4\u00a0min dans un peu d’eau ou de lait, en remuant.", "Ou la veille\u00a0: mélange les flocons au skyr et laisse toute la nuit au frigo.", "Ajoute le skyr, le fruit et les amandes concassées."]},
  'pd:pain':{min:5, veille:false, steps:["Toaste le pain complet si tu veux.", "Sers avec le skyr, le fruit et les amandes."]},
  'pd:sale':{min:10, veille:false, steps:["Fais cuire les œufs\u00a0: 6\u00a0min dans l’eau bouillante pour des œufs à la coque, pochés, ou brouillés à la poêle antiadhésive sans matière grasse.", "Toaste le pain et ajoute le jambon.", "Le fruit à côté."]},
  'pd:pancakes':{min:15, veille:false, steps:["Écrase la banane à la fourchette, ajoute les œufs et les flocons (mixe le tout si tu préfères une pâte lisse).", "Fais cuire de petits pancakes 2\u00a0min de chaque côté dans une poêle antiadhésive bien chaude, sans matière grasse.", "Sers avec le skyr et les fruits rouges."]},
  'pd:painperdu':{min:15, veille:false, steps:["Bats l’œuf avec le lait et une pincée de cannelle.", "Trempe les tranches de pain des deux côtés.", "Dore-les 2 à 3\u00a0min de chaque côté à la poêle antiadhésive, sans beurre.", "Sers avec le skyr et le fruit."]},
  'pd:bircher':{min:10, veille:true, steps:["La veille\u00a0: mélange les flocons, le lait, la moitié du skyr et la pomme râpée, avec une pincée de cannelle.", "Laisse toute la nuit au frigo, couvert.", "Le matin\u00a0: ajoute le reste du skyr et les amandes concassées."]},
  'pd:porridge':{min:10, veille:false, steps:["Fais cuire les flocons dans le lait 4 à 5\u00a0min à feu doux, en remuant.", "Hors du feu, ajoute le cacao et la moitié de la banane écrasée.", "Sers avec le skyr et le reste de la banane en rondelles."]},
  'pd:brouillade':{min:15, veille:false, steps:["Fais revenir les champignons émincés 3\u00a0min à la poêle antiadhésive, puis les épinards jusqu’à ce qu’ils tombent.", "Ajoute les œufs battus et remue doucement à feu doux jusqu’à ce qu’ils soient crémeux\u00a0; poivre.", "Sers avec le pain grillé, le skyr et le fruit à côté."]},
  'pd:smoothie':{min:5, veille:false, steps:["Mixe le skyr, la banane, les fruits rouges, le lait et les flocons jusqu’à ce que ce soit bien lisse.", "Verse dans une gourde ou un bocal\u00a0: il se garde quelques heures au frais."]},
  'pd:wrap':{min:10, veille:false, steps:["Fais cuire les œufs brouillés à la poêle antiadhésive, sans matière grasse.", "Garnis la tortilla\u00a0: jambon, œufs, tomate en dés.", "Roule bien serré\u00a0; le fruit à côté."]},
  'co:oeufs':{min:12, veille:true, steps:["Plonge les œufs dans l’eau bouillante\u00a0: 6\u00a0min pour des œufs mollets, 10\u00a0min pour des œufs durs.", "Refroidis-les dans l’eau froide.", "Durs, ils se gardent une semaine au frigo dans leur coquille\u00a0; mollets, mange-les dans les 2\u00a0jours."]},
  'co:muffins':{min:25, veille:true, steps:["Préchauffe le four à 180\u00a0°C.", "Bats les œufs avec les épinards hachés, le parmesan et du poivre.", "Verse dans des moules à muffins en silicone et fais cuire 20\u00a0min.", "Une fournée se garde 3\u00a0jours au frigo\u00a0: froids ou réchauffés."]},
  'co:mugcake':{min:5, veille:false, steps:["Dans un grand mug, mélange l’œuf, le skyr, les flocons et le cacao.", "Fais cuire 1\u00a0min\u00a030 au micro-ondes, à pleine puissance.", "Laisse tiédir une minute avant de le démouler."]},
  'co:thon':{min:5, veille:false, steps:["Égoutte le thon et mélange-le au skyr, avec un filet de citron et du poivre.", "Coupe le concombre en rondelles épaisses.", "Garnis les rondelles\u00a0; les galettes de riz à côté."]},
  'co:rizaulait':{min:30, veille:true, steps:["Porte le lait à frémissement avec un peu de vanille (ou de cannelle).", "Ajoute le riz rond et fais cuire 25\u00a0min à feu doux, en remuant souvent.", "Laisse tiédir, puis mélange le skyr. Il se garde 3\u00a0jours au frigo\u00a0: fais-en pour plusieurs collations."]},
  'cs:boules':{min:15, veille:true, steps:["Mixe les flocons, les fruits secs et les amandes jusqu’à obtenir une pâte qui se tient (une cuillère d’eau si besoin).", "Roule-la en boules de la taille d’une noix.", "Une fournée se garde une semaine au frais, dans une boîte fermée."]}
};

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
