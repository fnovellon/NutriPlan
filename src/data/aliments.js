/* Données : aliments. Valeurs pour 100 g (FOOD) ou par pièce (UNIT), féculents (STARCH), rendements de cuisson (YIELD),
   table de référence de l'écran d'aide (REF_GROUPS, refTable). */
/* Valeurs pour 100 g : kcal, protéines, glucides, lipides. Table Ciqual de l'Anses (vérifiée en 3.3.1), arrondie ;
   glucides disponibles (sans les fibres). Skyr, halloumi : moyenne des étiquettes. Légumes : moyenne de légumes verts
   (haricots verts, brocoli, courgette, poivron, carotte). */
const FOOD = {
  avoine:[370,13.5,60,7], pain:[240,8.5,45,1.5], skyr:[62,10.5,4,0.2],
  fruitsRouges:[38,1,6.5,0.3], amandes:[590,23,9.5,51], miel:[320,0.3,80,0],
  legumes:[30,2,4,0.3], huile:[900,0,0,100], parmesan:[406,30.5,0,31],
  poulet:[110,23,0,1.4], boeuf:[130,22,0,4.6], poisson:[82,18,0,0.7], saumon:[206,22,0,12.4],
  crevettes:[99,21,0,1.1], halloumi:[320,22,2,25], jambon:[119,21.5,0.6,3.5], thon:[112,25,0,1],
  chocolat:[572,9.3,33,42], tofu:[148,14.4,1.1,9.3], fruitsSecs:[245,2.7,56,0.7],
  /* Recettes (3.12.0) : légumes crus (petits pois cuits) et matières grasses, Ciqual arrondi ; tahini d'après l'étiquette */
  oignon:[39,1.1,6.3,0.6], tomate:[19,0.9,2.5,0.3], pulpe:[33,1.6,4.7,0.3], poivron:[37,1,6,0.3], courgette:[16,1.2,1.8,0.3],
  champignon:[22,2.4,1.9,0.2], epinards:[35,2.7,3.2,0.4], brocoli:[35,2.4,4,0.4], carotte:[40,0.6,7.6,0.5], petitspois:[71,5,8.3,0.4],
  haricotsverts:[31,1.8,3.6,0.1], concombre:[12,0.6,1.8,0.2], aubergine:[21,1,2.8,0.2], choufleur:[26,1.8,2.1,0.7], chou:[30,1.1,4.3,0.5],
  poireau:[29,2.1,3.4,0.3], salade:[14,1.3,1.4,0.2],
  coco:[190,2,6.3,17.6], creme:[190,2.9,4.3,18], lait:[46,3.3,4.8,1.5], sesame:[640,17.7,9.3,56.4], tahini:[645,25,3.8,57], olives:[162,0.9,1.7,14],
  /* Petits-déjeuners et collations (3.29.0) : cacao en poudre non sucré (moyenne des étiquettes, glucides sans les fibres),
     riz rond (Ciqual, riz blanc cru) */
  cacao:[380,21,11,21], rizrond:[352,7,79,0.6]
};
/* Groupes d'aliments aux valeurs proches (pour 100 g crus : ≈ 10 % près en calories, ≈ 3 g près en protéines et lipides),
   proposés dans un seul choix avec les valeurs du premier : viande blanche maigre (poulet 110 kcal, dinde, filet mignon de porc
   ≈ 125 kcal, 23 g, 4 g), poisson gras (saumon 206 kcal, maquereau, sardines à l'huile égouttées ≈ 222 kcal, 26 g, 13 g),
   lentilles ou haricots rouges (327 et 314 kcal), fruits secs (abricots 230, pruneaux 253, figues 252 kcal : moyenne).
   Tofu nature (148 kcal, 14,4 g, 9,3 g) et pois chiches secs (351 kcal, 20,5 g, 5,9 g) n'ont pas de voisin assez proche. */
/* Valeurs par pièce : banane ≈ 120 g de pulpe, pomme ≈ 150 g, pot de compote 100 g, œuf calibre moyen ≈ 50 g sans
   coquille */
const UNIT = {
  banane:[105,1.3,24,0.3], pomme:[80,0.4,17.5,0.3], compote:[60,0.3,13,0.2],
  oeuf:[72,6.3,0.4,4.8],
  /* 3.29.0 : tortilla de blé complet ≈ 60 g (300 kcal, 9 g, 47 g, 7 g pour 100 g, moyenne des étiquettes), galette de riz
     soufflé ≈ 9 g (Ciqual : 385 kcal, 8 g, 80 g, 3 g pour 100 g) */
  tortilla:[180,5.4,28.2,4.2], galette:[35,0.7,7.2,0.3]
};
const STARCH = {
  riz:{cap:120, label:'Riz', f:[352,8.4,77,1], step:5, raw:'cru', cook:[[3, 'cuit']], name:'riz basmati'},
  pates:{cap:120, label:'Pâtes', f:[355,12.5,71,1.5], step:5, raw:'crues', cook:[[2.3, 'cuites']], name:'pâtes'},
  pdt:{cap:400, label:'Pommes de terre', f:[80,2,16,0.1], step:10, raw:'crues', cook:[[1, 'à l’eau'], [0.75, 'au four']], name:'pommes de terre'},
  patate:{cap:400, label:'Patate douce', f:[86,1.6,20,0.1], step:10, raw:'crue', cook:[[1, 'à l’eau'], [0.75, 'au four']], name:'patate douce'},
  quinoa:{cap:120, label:'Quinoa', f:[358,14,58,6], step:5, raw:'cru', cook:[[2.7, 'cuit']], name:'quinoa'},
  semoule:{cap:120, label:'Semoule', f:[352,12.7,73,1], step:5, raw:'crue', cook:[[2.3, 'cuite']], name:'semoule'},
  boulgour:{cap:120, label:'Boulgour', f:[331,11,68,1.7], step:5, raw:'cru', cook:[[2.5, 'cuit']], name:'boulgour'},
  lentilles:{cap:100, label:'Lentilles, haricots rouges', f:[327,25.8,45,1.3], step:5, raw:'secs', cook:[[2.5, 'cuits']], name:'lentilles ou haricots rouges'},
  poischiches:{cap:100, label:'Pois chiches', f:[351,20.5,47.5,5.9], step:5, raw:'secs', cook:[[2.2, 'cuits ou égouttés']], name:'pois chiches'},
  gnocchis:{cap:300, label:'Gnocchis', f:[171,4.7,35,1.4], step:10, name:'gnocchis frais'}
};
const STARCH_ORDER = ['riz','pates','pdt','patate','quinoa','semoule','boulgour','lentilles','poischiches','gnocchis'];

/* Table de référence des aliments (écran « Comment ça marche ») : chaque valeur de FOOD, UNIT et STARCH y figure une fois */
const REF_GROUPS = [
  {title:'Viandes, poissons, laitages', per:'pour 100' + NB + 'g', src:'food', rows:[['poulet','Viande blanche maigre (poulet, dinde, filet mignon de porc)'],['boeuf','Bœuf haché 5' + NB + '%'],['poisson','Poisson blanc'],['saumon','Poisson gras (saumon, maquereau, sardines à l’huile)'],['crevettes','Crevettes cuites'],['thon','Thon au naturel, égoutté'],['jambon','Jambon blanc'],['halloumi','Halloumi'],['tofu','Tofu ferme, nature'],['parmesan','Parmesan'],['skyr','Skyr nature']]},
  {title:'Féculents', per:'pour 100' + NB + 'g crus', src:'starch', rows:STARCH_ORDER.map(function(id){ return [id, STARCH[id].name.charAt(0).toUpperCase() + STARCH[id].name.slice(1)]; })},
  {title:'Petit-déjeuner et douceurs', per:'pour 100' + NB + 'g', src:'food', rows:[['avoine','Flocons d’avoine (ou muesli sans sucre ajouté)'],['pain','Pain complet'],['fruitsRouges','Fruits rouges'],['amandes','Amandes'],['miel','Miel'],['fruitsSecs','Fruits secs (abricots, pruneaux, figues)'],['cacao','Cacao en poudre non sucré'],['rizrond','Riz rond (riz au lait)'],['chocolat','Chocolat noir 70' + NB + '%']]},
  {title:'Légumes, crus', per:'pour 100' + NB + 'g', src:'food', rows:[['legumes','Légumes verts (moyenne)'],['oignon','Oignon (ou échalote)'],['tomate','Tomate'],['pulpe','Pulpe de tomate, en conserve'],
    ['poivron','Poivron'],['courgette','Courgette'],['champignon','Champignon de Paris'],['epinards','Épinards'],['brocoli','Brocoli'],['carotte','Carotte'],['petitspois','Petits pois, cuits'],
    ['haricotsverts','Haricots verts'],['concombre','Concombre'],['aubergine','Aubergine'],['choufleur','Chou-fleur'],['chou','Chou rouge ou chinois'],['poireau','Poireau'],['salade','Salade verte']]},
  {title:'Matières grasses et sauces', per:'pour 100' + NB + 'g', src:'food', rows:[['huile','Huile d’olive'],['coco','Lait de coco'],['creme','Crème légère'],['lait','Lait demi-écrémé'],
    ['sesame','Graines de sésame'],['tahini','Tahini (purée de sésame)'],['olives','Olives noires']]},
  {title:'À la pièce', per:'par pièce', src:'unit', rows:[['oeuf','Œuf moyen'],['banane','Banane moyenne'],['pomme','Pomme (ou autre fruit)'],['compote','Compote sans sucre ajouté, 100' + NB + 'g'],['tortilla','Tortilla de blé complet, ≈' + NB + '60' + NB + 'g'],['galette','Galette de riz soufflé, ≈' + NB + '9' + NB + 'g']]}
];
function refTable(){
  return REF_GROUPS.map(function(g){
    return {title:g.title, per:g.per, rows:g.rows.map(function(r){
      const v = g.src === 'starch' ? STARCH[r[0]].f : g.src === 'unit' ? UNIT[r[0]] : FOOD[r[0]];
      return {src:g.src, key:r[0], label:r[1], v:v};
    })};
  });
}

/* Rendement de cuisson de la viande et du poisson (poids cuit / poids cru, ≈ table USDA des rendements de cuisson, 2012) */
const YIELD = {poulet:0.75, boeuf:0.75, poisson:0.8, saumon:0.8};
