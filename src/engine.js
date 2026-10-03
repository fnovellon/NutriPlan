'use strict';
const NB = '\u00A0';
/* Version de l'appli : la même que package.json, notée dans CHANGELOG.md */
const APP_VERSION = '3.15.0';

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
  coco:[190,2,6.3,17.6], creme:[190,2.9,4.3,18], lait:[46,3.3,4.8,1.5], sesame:[640,17.7,9.3,56.4], tahini:[645,25,3.8,57], olives:[162,0.9,1.7,14]
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
  oeuf:[72,6.3,0.4,4.8]
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
/* Table de référence des aliments (écran « Comment ça marche ») : chaque valeur de FOOD, UNIT et STARCH y figure une fois */
const REF_GROUPS = [
  {title:'Viandes, poissons, laitages', per:'pour 100' + NB + 'g', src:'food', rows:[['poulet','Viande blanche maigre (poulet, dinde, filet mignon de porc)'],['boeuf','Bœuf haché 5' + NB + '%'],['poisson','Poisson blanc'],['saumon','Poisson gras (saumon, maquereau, sardines à l’huile)'],['crevettes','Crevettes cuites'],['thon','Thon au naturel, égoutté'],['jambon','Jambon blanc'],['halloumi','Halloumi'],['tofu','Tofu ferme, nature'],['parmesan','Parmesan'],['skyr','Skyr nature']]},
  {title:'Féculents', per:'pour 100' + NB + 'g crus', src:'starch', rows:STARCH_ORDER.map(function(id){ return [id, STARCH[id].name.charAt(0).toUpperCase() + STARCH[id].name.slice(1)]; })},
  {title:'Petit-déjeuner et douceurs', per:'pour 100' + NB + 'g', src:'food', rows:[['avoine','Flocons d’avoine (ou muesli sans sucre ajouté)'],['pain','Pain complet'],['fruitsRouges','Fruits rouges'],['amandes','Amandes'],['miel','Miel'],['fruitsSecs','Fruits secs (abricots, pruneaux, figues)'],['chocolat','Chocolat noir 70' + NB + '%']]},
  {title:'Légumes, crus', per:'pour 100' + NB + 'g', src:'food', rows:[['legumes','Légumes verts (moyenne)'],['oignon','Oignon (ou échalote)'],['tomate','Tomate'],['pulpe','Pulpe de tomate, en conserve'],
    ['poivron','Poivron'],['courgette','Courgette'],['champignon','Champignon de Paris'],['epinards','Épinards'],['brocoli','Brocoli'],['carotte','Carotte'],['petitspois','Petits pois, cuits'],
    ['haricotsverts','Haricots verts'],['concombre','Concombre'],['aubergine','Aubergine'],['choufleur','Chou-fleur'],['chou','Chou rouge ou chinois'],['poireau','Poireau'],['salade','Salade verte']]},
  {title:'Matières grasses et sauces', per:'pour 100' + NB + 'g', src:'food', rows:[['huile','Huile d’olive'],['coco','Lait de coco'],['creme','Crème légère'],['lait','Lait demi-écrémé'],
    ['sesame','Graines de sésame'],['tahini','Tahini (purée de sésame)'],['olives','Olives noires']]},
  {title:'À la pièce', per:'par pièce', src:'unit', rows:[['oeuf','Œuf moyen'],['banane','Banane moyenne'],['pomme','Pomme (ou autre fruit)'],['compote','Compote sans sucre ajouté, 100' + NB + 'g']]}
];
function refTable(){
  return REF_GROUPS.map(function(g){
    return {title:g.title, per:g.per, rows:g.rows.map(function(r){
      const v = g.src === 'starch' ? STARCH[r[0]].f : g.src === 'unit' ? UNIT[r[0]] : FOOD[r[0]];
      return {src:g.src, key:r[0], label:r[1], v:v};
    })};
  });
}

function has(o, k){ return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
function grams(n){ return n + NB + 'g'; }
/* Valeurs d'une quantité ; buy : ce qu'il faut acheter (voir it) */
function mac(food, g){ const f = FOOD[food], k = g / 100; return {kcal:f[0]*k, p:f[1]*k, c:f[2]*k, f:f[3]*k, buy:{id:food, g:g}}; }
function unitMac(u, n){ const f = UNIT[u]; return {kcal:f[0]*n, p:f[1]*n, c:f[2]*n, f:f[3]*n, buy:{id:u, n:n}}; }
/* cook : poids cuit estimé par mode de cuisson, affiché sous la quantité crue,
   ex. {raw:'cru', ways:[{g:135, adj:'cuit'}]} ou {raw:'crues', ways:[{g:340, adj:'à l’eau'}, {g:260, adj:'au four'}]} */
/* Ligne d'un repas. m : kcal et macros ; buy : l'achat pour la liste de courses, {id, g} en grammes, {id, n} en pièces ou
   {id, kcal} pour un budget (pris dans m.buy si absent) */
function it(key, qty, name, note, m, cook, buy){
  return {key:key, qty:qty, name:name, note:note || null, m:m ? {kcal:m.kcal, p:m.p, c:m.c, f:m.f} : null, cook:cook || null, buy:buy || (m && m.buy) || null};
}
/* Rendement de cuisson de la viande et du poisson (poids cuit / poids cru, ≈ table USDA des rendements de cuisson, 2012) */
const YIELD = {poulet:0.75, boeuf:0.75, poisson:0.8, saumon:0.8};
/* Portions : menu de référence pour 72 kg, mis à l'échelle du poids (k = poids / 72, borné à 0,65-1,4 ≈ 47 à 101 kg) */
const REF_KG = 72, SCALE_MIN = 0.65, SCALE_MAX = 1.4;
function scaleOf(p){ return Math.min(SCALE_MAX, Math.max(SCALE_MIN, p.poids / REF_KG)); }
/* Quantité de référence g mise à l'échelle k, arrondie au pas (jamais moins d'un pas) ; pièces arrondies à l'unité, au moins 1 */
function sc(g, step, k){ return Math.max(step, Math.round(g * k / step) * step); }
function pieces(n, k){ return Math.max(1, Math.round(n * k)); }
/* Nombre de tranches (pain 40 g, jambon 45 g la tranche), à la demi-tranche près */
function slices(g, per){
  const t = Math.round(g / per * 2) / 2;
  return (t === g / per ? '' : 'environ ') + (t === 0.5 ? 'une demi-tranche' : t.toLocaleString('fr-FR') + ' tranche' + (t >= 2 ? 's' : ''));
}
function meat(g, name, note, food){
  return it('p1', grams(g), name, note, mac(food, g), {raw:'cru', ways:[{g:Math.round(g * YIELD[food] / 5) * 5, adj:'cuit'}]});
}
function total(items){
  const t = {kcal:0, p:0, c:0, f:0};
  items.forEach(function(i){ if (i.m){ t.kcal += i.m.kcal; t.p += i.m.p; t.c += i.m.c; t.f += i.m.f; } });
  return t;
}
function fmtInt(n){ return Math.round(n).toLocaleString('fr-FR'); }

/* Protéines du déjeuner et du dîner, avec leur matière grasse : portions de référence (72 kg) mises à l'échelle k.
   Restent fixes : les amandes du dîner (comme l'était le demi-avocat) et la boîte de thon (on ne coupe pas une boîte). */
/* Remplacement proposé en note : même énergie, arrondie à 5 g (quantité fixe, comme ce qu'il remplace) */
function swapGrams(kcal, food){ return Math.max(5, Math.round(kcal / FOOD[food][0] * 100 / 5) * 5); }
/* Lipides du dîner avec une protéine très maigre (viande blanche, poisson blanc) : 25 g d'amandes, fixes (3.10.0 : à la place
   du ½ avocat, même énergie) */
function amandesDiner(){ return it('dam', grams(25), 'amandes', 'sur les légumes ou en fin de repas', mac('amandes', 25)); }
const PROT = {
  poulet:{label:'Viande blanche', sub:'poulet, dinde, filet mignon de porc',
    base:function(k){ return [meat(sc(180, 10, k), 'viande blanche maigre', 'poulet, dinde ou filet mignon de porc', 'poulet')]; },
    dej:function(){ return []; },
    diner:function(){ return [amandesDiner()]; }},
  boeuf:{label:'Bœuf 5' + NB + '%',
    base:function(k){ return [meat(sc(150, 10, k), 'bœuf haché 5' + NB + '%', null, 'boeuf')]; },
    dej:function(){ return []; },
    diner:function(k){ const g = sc(15, 5, k); return [it('pm', grams(g), 'parmesan', null, mac('parmesan', g))]; }},
  poisson:{label:'Poisson blanc',
    base:function(k){ return [meat(sc(200, 10, k), 'poisson blanc', 'cabillaud, colin…', 'poisson')]; },
    dej:function(){ return []; },
    diner:function(){ return [amandesDiner()]; }},
  saumon:{label:'Poisson gras', sub:'saumon, maquereau, sardines à l’huile',
    base:function(k){ return [meat(sc(160, 10, k), 'poisson gras', 'saumon, maquereau ou sardines à l’huile égouttées, sans matière grasse', 'saumon')]; },
    dej:function(){ return []; },
    diner:function(){ return []; }},
  crevettes:{label:'Crevettes + halloumi',
    base:function(k){
      const c = sc(120, 10, k), h = sc(60, 5, k);
      return [it('p1', grams(c), 'crevettes cuites', null, mac('crevettes', c)), it('p2', grams(h), 'halloumi', 'grillé à sec', mac('halloumi', h))];
    },
    dej:function(){ return []; },
    diner:function(){ return []; }},
  oeufs:{label:'Œufs + jambon',
    base:function(k){
      const n = pieces(3, k), j = sc(90, 5, k);
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
    base:function(k){ const g = sc(200, 10, k); return [it('p1', grams(g), 'tofu ferme', 'nature, pressé puis poêlé', mac('tofu', g))]; },
    dej:function(){ return []; },
    diner:function(){ return []; }}
};
const PROT_ORDER = ['poulet','boeuf','poisson','saumon','crevettes','oeufs','thon','tofu'];

/* Typographie française des textes écrits avec des espaces simples : espace insécable avant « : ; ? ! % » et entre un
   nombre et son unité (« 8 min », « 200 °C », « 1 c. à café ») */
function typo(t){
  return t.replace(/ ([:;?!%])/g, NB + '$1').replace(/(\d) (g|kg|kcal|min|ml|cl|°C)(?![A-Za-zÀ-ÿ])/g, '$1' + NB + '$2')
    .replace(/(\d) c\./g, '$1' + NB + 'c.').replace(/c\. à/g, 'c.' + NB + 'à');
}
/* Légumes et matières grasses des recettes : nom sur la ligne du repas et dans les courses, précision */
const RFOOD = {
  oignon:['oignon', 'ou échalote'], tomate:['tomates', 'ou tomates cerises'], pulpe:['pulpe de tomate', 'en conserve'], poivron:['poivron', null],
  courgette:['courgette', null], champignon:['champignons de Paris', null], epinards:['épinards', 'frais ou surgelés'], brocoli:['brocoli', 'frais ou surgelé'],
  carotte:['carottes', null], petitspois:['petits pois', 'surgelés'], haricotsverts:['haricots verts', 'frais ou surgelés'], concombre:['concombre', null],
  aubergine:['aubergine', null], choufleur:['chou-fleur', 'frais ou surgelé'], chou:['chou', 'rouge ou chinois'], poireau:['poireaux', null],
  salade:['salade verte', 'roquette, mâche…'],
  coco:['lait de coco', null], creme:['crème légère', null], lait:['lait demi-écrémé', null], sesame:['graines de sésame', null],
  tahini:['tahini', 'purée de sésame'], olives:['olives noires', 'dénoyautées']
};
const VEG_IDS = ['oignon', 'tomate', 'pulpe', 'poivron', 'courgette', 'champignon', 'epinards', 'brocoli', 'carotte', 'petitspois', 'haricotsverts',
  'concombre', 'aubergine', 'choufleur', 'chou', 'poireau', 'salade'];
/* Recettes (3.12.0) : une par couple protéine × féculent, proposée sous le déjeuner et le dîner, choisie ou non.
   Choisie : ses légumes (250 g en tout, comme la ligne « légumes ») et sa matière grasse remplacent la ligne « légumes » et la
   marge cuisine du repas, ses ajouts (skyr, miel) sont comptés ; les féculents s'ajustent, le total du jour ne bouge pas.
   r(protéine, féculent, titre, minutes, se garde, légumes {id: g}, matière grasse [[aliment, g, nom, mesure]], aromates (ne
   comptent pas), ajouts {skyr|miel: g}, trois étapes, note des amandes ou du parmesan du soir).
   gel : se congèle bien (3.13.0, batch cooking) ; pas les salades, taboulés et bowls aux crudités (salade, concombre). */
const RECIPES = (function(){
  const out = {};
  const H1 = ['huile', 5, 'huile d’olive', '1 c. à café'], H2 = ['huile', 10, 'huile d’olive', '2 c. à café'],
    HSES = ['huile', 5, 'huile de sésame', '1 c. à café, ou d’olive'], COCO = ['coco', 15, 'lait de coco', '1 c. à soupe'],
    PARM = ['parmesan', 5, 'parmesan râpé', '1 c. à soupe'], CREME = ['creme', 15, 'crème légère', '1 c. à soupe'],
    SES = ['sesame', 3, 'graines de sésame', '1 c. à café'], OLIVE = ['olives', 15, 'olives noires', '4 ou 5, dénoyautées'],
    TAHINI = ['tahini', 5, 'tahini', 'purée de sésame, 1 c. à café'], LAIT = ['lait', 50, 'lait demi-écrémé', '50 ml, dans la purée'];
  const r = function(p, s, t, min, box, leg, cuis, aro, plus, steps, soir){
    out[p + '-' + s] = {p:p, s:s, t:typo(t), min:min, box:!!box, gel:!leg.salade && !leg.concombre && !/^(Salade|Taboulé|Bowl|Poke)/.test(t), leg:leg, aro:typo(aro), plus:plus || {}, steps:steps.map(typo), soir:soir ? typo(soir) : null,
      cuis:cuis.map(function(c){ return [c[0], c[1], c[2], typo(c[3])]; })};
  };
  /* Viande blanche (le soir : les amandes) */
  r('poulet', 'riz', 'Poulet au curry doux, riz basmati', 25, 1, {oignon:70, poivron:100, epinards:80}, [H1, COCO], 'ail, gingembre, curry, coriandre', {skyr:40}, [
    'Fais revenir l’oignon émincé, l’ail et le gingembre dans l’huile, puis le poulet en dés avec le curry.',
    'Ajoute le poivron en lanières, puis les épinards et le lait de coco ; laisse mijoter 8 min.',
    'Hors du feu, lie la sauce avec le skyr et sers sur le riz, avec la coriandre.'], 'effilées et grillées à sec, sur le curry');
  r('poulet', 'pates', 'Pâtes au poulet, tomates et basilic', 20, 1, {oignon:50, pulpe:150, courgette:50}, [H1, PARM], 'ail, basilic, origan, piment', null, [
    'Dore le poulet en lanières dans l’huile, puis réserve.',
    'Dans la même poêle, fais fondre l’oignon et l’ail, ajoute la courgette en dés, la pulpe et l’origan ; 10 min.',
    'Remets le poulet, mélange aux pâtes, parsème de parmesan et de basilic.'], 'concassées sur les pâtes, avec le parmesan');
  r('poulet', 'pdt', 'Poulet rôti, pommes de terre et oignons rouges', 45, 0, {oignon:80, haricotsverts:170}, [H2], 'thym, romarin, ail en chemise, paprika', null, [
    'Coupe les pommes de terre en quartiers et l’oignon rouge en pétales ; mélange avec l’huile, le thym et le paprika.',
    'Four à 200 °C : 20 min, puis ajoute le poulet assaisonné et l’ail en chemise, 20 min de plus.',
    'Cuis les haricots verts 8 min à la vapeur et sers tout ensemble.']);
  r('poulet', 'patate', 'Poulet au paprika, patate douce rôtie et brocolis', 35, 1, {brocoli:170, oignon:80}, [H2], 'paprika fumé, cumin, citron vert', null, [
    'Patate douce en cubes et oignon rouge en quartiers, avec l’huile et le paprika : four à 200 °C, 25 min.',
    'Ajoute les brocolis en fleurettes 10 min avant la fin.',
    'Poêle le poulet au cumin et finis d’un filet de citron vert.']);
  r('poulet', 'quinoa', 'Bowl poulet-quinoa aux légumes croquants', 25, 1, {concombre:80, carotte:70, poivron:60, oignon:40}, [H1, SES], 'sauce soja, gingembre, citron vert, coriandre', {miel:5}, [
    'Rince le quinoa et cuis-le 12 min, puis laisse tiédir.',
    'Fais mariner le poulet 10 min dans la sauce soja et le gingembre, puis saisis-le à la poêle.',
    'Monte le bowl : quinoa, légumes crus en bâtonnets, oignon nouveau, poulet ; sauce soja, citron vert et miel, sésame.']);
  r('poulet', 'semoule', 'Couscous au poulet et aux légumes', 40, 1, {carotte:70, courgette:100, oignon:50, pulpe:30}, [H2], 'ras-el-hanout, cumin, coriandre, harissa (au goût)', null, [
    'Fais revenir le poulet et l’oignon avec les épices dans l’huile.',
    'Ajoute carottes et courgettes en tronçons, la pulpe et un verre d’eau ; mijote 20 min.',
    'Verse la semoule dans le même volume d’eau bouillante salée, 5 min à couvert, égrène ; nappe de bouillon.']);
  r('poulet', 'boulgour', 'Taboulé de boulgour au poulet grillé', 25, 1, {tomate:120, concombre:80, oignon:30, poivron:20}, [H2], 'persil, menthe, citron, cumin', null, [
    'Cuis le boulgour 10 min, égoutte-le et laisse-le refroidir.',
    'Coupe tomates, concombre, oignon rouge et poivron en petits dés ; cisèle persil et menthe.',
    'Assaisonne huile et citron, et pose le poulet grillé en tranches sur le dessus.']);
  r('poulet', 'lentilles', 'Salade tiède de lentilles au poulet', 30, 1, {carotte:70, oignon:40, salade:140}, [H2], 'moutarde, vinaigre de cidre, thym, laurier', null, [
    'Cuis les lentilles 20 min avec la carotte en dés, le thym et le laurier.',
    'Prépare une vinaigrette moutarde-vinaigre-huile avec l’échalote ciselée.',
    'Mélange les lentilles tièdes à la vinaigrette, sers sur la salade avec le poulet poêlé en tranches.']);
  r('poulet', 'poischiches', 'Poulet et pois chiches façon tajine', 40, 1, {oignon:80, carotte:70, pulpe:100}, [H2], 'cumin, cannelle, curcuma, gingembre, coriandre', null, [
    'Dore le poulet et l’oignon dans l’huile avec les épices.',
    'Ajoute les carottes en rondelles, la pulpe, les pois chiches cuits et 15 cl d’eau ; 25 min à couvert.',
    'Parsème de coriandre et sers avec un quartier de citron.']);
  r('poulet', 'gnocchis', 'Gnocchis poêlés au poulet, épinards et champignons', 20, 0, {epinards:150, champignon:70, oignon:30}, [H1, CREME], 'ail, muscade, poivre', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais sauter le poulet, l’échalote et les champignons dans l’huile, puis les épinards jusqu’à ce qu’ils tombent.',
    'Ajoute la crème et la muscade, remets les gnocchis et mélange.']);
  /* Bœuf (le soir : le parmesan) */
  r('boeuf', 'riz', 'Chili de bœuf aux poivrons, riz', 30, 1, {oignon:70, poivron:100, pulpe:80}, [H2], 'ail, cumin, paprika, piment, origan', {skyr:40}, [
    'Fais revenir l’oignon et l’ail dans l’huile, ajoute le bœuf et laisse colorer.',
    'Ajoute les poivrons en dés, les épices et la pulpe ; mijote 15 min.',
    'Sers sur le riz avec une cuillère de skyr et de la coriandre.'], 'râpé sur le chili, comme un cheddar');
  r('boeuf', 'pates', 'Pâtes à la bolognaise', 35, 1, {oignon:60, carotte:50, pulpe:140}, [H2], 'ail, laurier, thym, basilic', null, [
    'Fais fondre l’oignon et la carotte hachés dans l’huile, 5 min.',
    'Ajoute le bœuf, colore-le, puis la pulpe, l’ail et les herbes ; 20 min à feu doux.',
    'Mélange la sauce aux pâtes.'], 'râpé sur les pâtes');
  r('boeuf', 'pdt', 'Hachis parmentier léger, salade', 45, 1, {oignon:70, carotte:60, salade:120}, [H1, LAIT], 'thym, muscade, persil', null, [
    'Cuis les pommes de terre 20 min à l’eau et écrase-les avec le lait et la muscade.',
    'Fais revenir le bœuf avec l’oignon et la carotte hachés dans l’huile, et le thym.',
    'Viande puis purée dans un plat, four à 200 °C 15 min ; salade à côté.'], 'râpé sur la purée avant d’enfourner');
  r('boeuf', 'patate', 'Hachis parmentier à la patate douce', 45, 1, {oignon:70, poivron:80, epinards:100}, [H1, LAIT], 'cumin, paprika fumé, ail', null, [
    'Cuis la patate douce à l’eau 15 min et écrase-la avec le lait.',
    'Fais revenir le bœuf, l’oignon et le poivron avec les épices dans l’huile, puis les épinards.',
    'Viande puis purée dans un plat, four à 200 °C 15 min.'], 'râpé sur la purée avant d’enfourner');
  r('boeuf', 'quinoa', 'Bowl bœuf épicé et quinoa, sauce citron-herbes', 25, 1, {tomate:100, concombre:60, oignon:40, salade:50}, [H2], 'paprika, cumin, ail, citron, coriandre', {skyr:40}, [
    'Cuis le quinoa 12 min.',
    'Saisis le bœuf avec l’ail, le paprika et le cumin dans la moitié de l’huile.',
    'Bowl : quinoa, salade, tomates, concombre, oignon rouge, bœuf ; sauce skyr-citron-coriandre et le reste d’huile.'], 'en copeaux sur le bowl');
  r('boeuf', 'semoule', 'Boulettes de bœuf à la tomate, semoule', 35, 1, {oignon:60, pulpe:120, courgette:70}, [H2], 'cumin, coriandre, menthe, ail', null, [
    'Mélange le bœuf avec la moitié de l’oignon râpé, l’ail et le cumin ; forme 8 boulettes.',
    'Saisis-les dans l’huile, ajoute le reste de l’oignon, la courgette en dés et la pulpe ; 15 min.',
    'Prépare la semoule à l’eau bouillante, 5 min à couvert, et sers avec la sauce.'], 'en copeaux sur les boulettes');
  r('boeuf', 'boulgour', 'Boulgour et boulettes façon kefta, sauce menthe', 35, 1, {oignon:50, tomate:100, concombre:100}, [H2], 'persil, menthe, cumin, cannelle', {skyr:50}, [
    'Mélange le bœuf, l’oignon râpé, le persil, le cumin et la cannelle ; forme des boulettes allongées.',
    'Fais-les dorer dans la moitié de l’huile ; cuis le boulgour 10 min.',
    'Sers avec une salade tomate-concombre au reste d’huile et une sauce skyr-menthe.'], 'râpé sur le boulgour chaud');
  r('boeuf', 'lentilles', 'Chili aux haricots rouges (ou aux lentilles)', 35, 1, {oignon:70, poivron:80, pulpe:100}, [H2], 'ail, cumin, paprika, piment, origan', null, [
    'Fais revenir l’oignon et l’ail dans l’huile, puis le bœuf.',
    'Ajoute le poivron, les épices, la pulpe et les haricots rouges cuits ; mijote 20 min.',
    'Sers chaud, avec de la coriandre si tu en as.'], 'râpé sur le chili, comme un cheddar');
  r('boeuf', 'poischiches', 'Bœuf épicé aux pois chiches et tomates', 30, 1, {oignon:60, pulpe:120, epinards:70}, [H2], 'ras-el-hanout, ail, cumin, coriandre', null, [
    'Fais revenir l’oignon et le bœuf dans l’huile avec les épices.',
    'Ajoute la pulpe et les pois chiches cuits ; mijote 15 min.',
    'Incorpore les épinards à la fin et laisse-les tomber.'], 'en copeaux sur le plat');
  r('boeuf', 'gnocchis', 'Gnocchis gratinés à la bolognaise', 35, 0, {oignon:60, carotte:40, pulpe:150}, [H2], 'ail, basilic, origan', null, [
    'Prépare la sauce : oignon et carotte hachés dans l’huile, puis le bœuf, la pulpe et les herbes ; 20 min.',
    'Cuis les gnocchis 2 min à l’eau bouillante.',
    'Mélange-les à la sauce dans un plat et passe sous le gril 5 min.'], 'râpé dessus avant de gratiner');
  /* Poisson blanc (le soir : les amandes) */
  r('poisson', 'riz', 'Poisson en papillote aux légumes, riz', 30, 0, {poireau:100, carotte:70, courgette:80}, [H1, CREME], 'citron, aneth, gingembre (au goût)', null, [
    'Taille le poireau, la carotte et la courgette en fine julienne.',
    'Pose le poisson sur les légumes dans du papier cuisson, avec l’huile, la crème, le citron et l’aneth ; ferme.',
    'Four à 200 °C, 15 min, et sers avec le riz.'], 'effilées et grillées, sur la papillote ouverte');
  r('poisson', 'pates', 'Pâtes au poisson, citron et persil', 20, 0, {courgette:120, tomate:100, oignon:30}, [H2], 'ail, zeste de citron, persil, piment', null, [
    'Fais sauter l’échalote, l’ail et la courgette en dés dans l’huile, puis les tomates cerises coupées en deux.',
    'Ajoute le poisson en gros morceaux, 5 min à couvert, sans trop remuer.',
    'Mélange aux pâtes avec le zeste de citron et le persil.'], 'grillées et concassées sur les pâtes');
  r('poisson', 'pdt', 'Poisson au four, pommes de terre vapeur, sauce yaourt-aneth', 30, 0, {haricotsverts:150, oignon:30, salade:70}, [H2], 'aneth, citron, ciboulette', {skyr:50}, [
    'Cuis les pommes de terre et les haricots verts à la vapeur, 20 et 8 min.',
    'Poisson au four à 200 °C, 12 min, arrosé d’huile et de citron.',
    'Sauce : skyr, aneth, ciboulette, échalote ciselée et citron.'], 'sur les haricots verts');
  r('poisson', 'patate', 'Poisson, purée de patate douce au gingembre', 30, 0, {epinards:150, oignon:30, poivron:70}, [H1, COCO], 'gingembre, citron vert, ciboulette', null, [
    'Cuis la patate douce à l’eau 15 min, écrase-la avec le lait de coco et le gingembre râpé.',
    'Fais revenir l’échalote et le poivron dans l’huile, puis les épinards.',
    'Poêle le poisson 3 min de chaque côté et finis au citron vert.'], 'grillées, sur la purée');
  r('poisson', 'quinoa', 'Poisson poêlé, quinoa aux herbes et légumes grillés', 30, 1, {courgette:100, poivron:80, oignon:40, tomate:30}, [H2], 'persil, coriandre, citron, ail', null, [
    'Cuis le quinoa 12 min.',
    'Fais griller courgette, poivron et oignon rouge en lamelles dans la moitié de l’huile.',
    'Poêle le poisson dans le reste ; mélange quinoa, légumes, tomates et herbes, citron.'], 'concassées dans le quinoa');
  r('poisson', 'semoule', 'Poisson à la chermoula, semoule', 35, 0, {tomate:100, poivron:80, oignon:70}, [H2], 'coriandre, cumin, paprika, ail, citron', null, [
    'Mixe coriandre, ail, cumin, paprika, citron et l’huile : c’est la chermoula. Enrobe le poisson.',
    'Dans un plat, tomates, poivron et oignon en lamelles, le poisson dessus : four à 200 °C, 20 min.',
    'Prépare la semoule à l’eau bouillante, 5 min à couvert.'], 'grillées, sur le poisson');
  r('poisson', 'boulgour', 'Poisson et boulgour aux légumes du soleil', 35, 1, {aubergine:100, courgette:70, tomate:50, oignon:30}, [H2], 'thym, ail, basilic', null, [
    'Fais revenir l’oignon, l’aubergine et la courgette en dés dans l’huile, 10 min, puis les tomates et le thym.',
    'Cuis le boulgour 10 min et mélange-le aux légumes.',
    'Pose le poisson dessus, couvre et laisse cuire 6 min à feu doux ; basilic.'], 'grillées, sur le plat');
  r('poisson', 'lentilles', 'Cabillaud sur lit de lentilles, sauce moutarde', 35, 0, {carotte:60, oignon:40, epinards:150}, [H1, CREME], 'thym, laurier, moutarde à l’ancienne, persil', null, [
    'Cuis les lentilles 20 min avec la carotte et l’oignon en dés, le thym et le laurier.',
    'Poêle le poisson dans l’huile, 3 min de chaque côté ; fais tomber les épinards dans la même poêle.',
    'Sauce : crème, moutarde à l’ancienne, persil, sur les lentilles et le poisson.'], 'effilées sur les lentilles');
  r('poisson', 'poischiches', 'Poisson au four, pois chiches au cumin et citron', 30, 1, {tomate:100, oignon:50, concombre:100}, [H2], 'cumin, citron, persil, paprika', {skyr:40}, [
    'Fais rôtir les pois chiches cuits avec la moitié de l’huile, le cumin et le paprika, four à 200 °C, 15 min.',
    'Ajoute le poisson dans le plat, 12 min de plus.',
    'Salade tomate-concombre-oignon rouge au reste d’huile ; sauce skyr-citron.'], 'grillées, sur les pois chiches');
  r('poisson', 'gnocchis', 'Gnocchis, poisson et sauce tomate aux olives', 25, 0, {pulpe:150, oignon:40, courgette:60}, [H1, OLIVE], 'ail, câpres, basilic, origan', null, [
    'Fais fondre l’oignon et l’ail dans l’huile, ajoute la courgette, la pulpe, les olives et les câpres ; 10 min.',
    'Pose le poisson dans la sauce, couvre, 8 min.',
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent et mélange-les à la sauce.'], 'concassées sur le plat');
  /* Poisson gras */
  r('saumon', 'riz', 'Poke bowl saumon, concombre et carotte', 20, 1, {concombre:100, carotte:70, chou:50, oignon:30}, [HSES, SES], 'sauce soja, gingembre, citron vert, vinaigre de riz', null, [
    'Cuis le riz et assaisonne-le d’un trait de vinaigre de riz ; laisse tiédir.',
    'Coupe le saumon en cubes (cru s’il est extra-frais, sinon saisi 1 min) et fais-le mariner soja-gingembre.',
    'Bowl : riz, concombre, carotte râpée, chou émincé, oignon nouveau, saumon ; huile et graines de sésame, citron vert.']);
  r('saumon', 'pates', 'Pâtes au saumon, citron et épinards', 20, 0, {epinards:150, oignon:30, courgette:70}, [H1, CREME], 'zeste de citron, aneth, poivre', null, [
    'Fais fondre l’échalote et la courgette en dés dans l’huile, puis les épinards.',
    'Ajoute le saumon en cubes et la crème, 4 min à feu doux. Avec du maquereau ou des sardines : émiette-les hors du feu.',
    'Mélange aux pâtes avec le zeste de citron et l’aneth.']);
  r('saumon', 'pdt', 'Saumon, pommes de terre et haricots verts, sauce moutarde-aneth', 30, 0, {haricotsverts:180, oignon:30, salade:40}, [H1], 'aneth, moutarde à l’ancienne, citron', {skyr:40}, [
    'Cuis les pommes de terre et les haricots verts à la vapeur.',
    'Saumon au four à 200 °C, 12 min, ou à la poêle dans l’huile.',
    'Sauce : skyr, moutarde à l’ancienne, aneth, échalote ciselée.']);
  r('saumon', 'patate', 'Saumon laqué soja-miel, patate douce rôtie et brocolis', 35, 1, {brocoli:150, oignon:40, poivron:60}, [H1, SES], 'sauce soja, gingembre, ail, citron vert', {miel:5}, [
    'Patate douce en cubes, oignon et poivron, avec l’huile : four à 200 °C, 25 min ; brocolis 10 min avant la fin.',
    'Laque : sauce soja, miel, gingembre et ail râpés.',
    'Badigeonne le saumon de laque, 12 min au four ; sésame et citron vert.']);
  r('saumon', 'quinoa', 'Bowl saumon-quinoa, concombre, roquette et sauce citron', 20, 1, {concombre:100, salade:60, tomate:60, oignon:30}, [H1], 'citron, aneth, ciboulette', {skyr:40}, [
    'Cuis le quinoa 12 min et laisse tiédir.',
    'Saisis le saumon, ou émiette du maquereau ou des sardines égouttés.',
    'Bowl : quinoa, roquette, concombre, tomates, oignon rouge, poisson ; sauce skyr-citron-aneth et l’huile.']);
  r('saumon', 'semoule', 'Saumon et semoule aux herbes, sauce tahini-citron', 25, 1, {tomate:100, concombre:80, oignon:30, poivron:40}, [TAHINI, H1], 'menthe, persil, citron, cumin', null, [
    'Prépare la semoule à l’eau bouillante avec le cumin, 5 min, égrène avec l’huile.',
    'Ajoute tomates, concombre, oignon et poivron en dés, menthe et persil.',
    'Saumon au four ou à la poêle, 10 min ; sauce tahini délayée au citron et à l’eau.']);
  r('saumon', 'boulgour', 'Salade de boulgour au saumon (ou sardines), herbes et câpres', 20, 1, {tomate:100, concombre:100, oignon:30, salade:20}, [H1], 'persil, menthe, citron, câpres', null, [
    'Cuis le boulgour 10 min et laisse-le refroidir.',
    'Ajoute tomates, concombre et oignon rouge en dés, herbes, câpres, huile et citron.',
    'Pose dessus le saumon cuit en morceaux, ou les sardines égouttées.']);
  r('saumon', 'lentilles', 'Saumon (ou maquereau) aux lentilles et poireaux', 35, 0, {poireau:150, carotte:60, oignon:40}, [H1, CREME], 'thym, laurier, moutarde, persil', null, [
    'Cuis les lentilles 20 min avec la carotte, l’oignon, le thym et le laurier.',
    'Fais fondre les poireaux émincés dans l’huile, 10 min, avec la crème et la moutarde.',
    'Poêle le saumon, ou réchauffe le maquereau, et sers sur les lentilles aux poireaux.']);
  r('saumon', 'poischiches', 'Maquereau ou saumon, salade de pois chiches aux herbes', 15, 1, {tomate:100, concombre:70, oignon:40, poivron:40}, [H1], 'persil, coriandre, cumin, citron', null, [
    'Rince les pois chiches cuits et mélange-les aux tomates, concombre, poivron et oignon rouge en dés.',
    'Assaisonne huile, citron et cumin ; ajoute les herbes.',
    'Ajoute le poisson émietté : saumon cuit, maquereau ou sardines égouttés.']);
  r('saumon', 'gnocchis', 'Gnocchis au saumon, épinards et citron', 20, 0, {epinards:170, oignon:30, champignon:50}, [H1, CREME], 'citron, aneth, ail', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais revenir l’ail, l’échalote et les champignons dans l’huile, puis les épinards.',
    'Ajoute le saumon en cubes et la crème, 4 min, remets les gnocchis ; citron et aneth.']);
  /* Crevettes + halloumi */
  r('crevettes', 'riz', 'Riz sauté aux crevettes, halloumi grillé', 20, 1, {poivron:80, petitspois:50, oignon:50, chou:70}, [H1], 'ail, gingembre, sauce soja, ciboule', null, [
    'Fais sauter l’oignon, le poivron, le chou et les petits pois dans l’huile, à feu vif.',
    'Ajoute le riz cuit (idéalement de la veille), l’ail, le gingembre, puis les crevettes et la sauce soja.',
    'Grille le halloumi en tranches à sec et pose-le dessus, avec la ciboule.']);
  r('crevettes', 'pates', 'Pâtes aux crevettes, tomates cerises et halloumi', 20, 0, {tomate:150, oignon:40, courgette:60}, [H1], 'ail, piment, basilic, citron', null, [
    'Fais revenir l’oignon, l’ail et le piment dans l’huile, puis la courgette et les tomates cerises coupées.',
    'Ajoute les crevettes, 2 min.',
    'Mélange aux pâtes ; halloumi grillé en dés, basilic et citron.']);
  r('crevettes', 'pdt', 'Salade tiède de pommes de terre, crevettes et halloumi', 30, 1, {salade:80, concombre:80, oignon:30, tomate:60}, [H1], 'aneth, citron, ciboulette, moutarde', {skyr:40}, [
    'Cuis les pommes de terre à l’eau, 20 min, et coupe-les tièdes.',
    'Sauce : skyr, moutarde, citron, aneth et ciboulette.',
    'Mélange avec la salade, le concombre, les tomates, l’oignon rouge, les crevettes et le halloumi grillé.']);
  r('crevettes', 'patate', 'Bowl patate douce, crevettes et halloumi au paprika', 35, 1, {epinards:80, poivron:80, oignon:40, concombre:50}, [H1], 'paprika fumé, citron vert, coriandre, piment', null, [
    'Patate douce en cubes avec l’huile et le paprika, four à 200 °C, 25 min.',
    'Saisis les crevettes et le halloumi en dés à la poêle.',
    'Bowl : pousses d’épinards, poivron, concombre, oignon rouge, patate douce, crevettes, halloumi ; citron vert et coriandre.']);
  r('crevettes', 'quinoa', 'Bowl crevettes-halloumi-quinoa et légumes rôtis', 35, 1, {courgette:100, poivron:80, oignon:40, tomate:30}, [H1], 'origan, citron, ail', null, [
    'Fais rôtir courgette, poivron et oignon en morceaux avec l’huile et l’origan, four à 200 °C, 20 min.',
    'Cuis le quinoa 12 min.',
    'Saisis crevettes et halloumi ; assemble avec les tomates, l’ail et le citron.']);
  r('crevettes', 'semoule', 'Semoule aux légumes rôtis, crevettes et halloumi', 35, 1, {aubergine:80, courgette:80, poivron:50, oignon:40}, [H1], 'ras-el-hanout, menthe, citron', null, [
    'Fais rôtir aubergine, courgette, poivron et oignon avec l’huile et le ras-el-hanout, four à 200 °C, 25 min.',
    'Prépare la semoule à l’eau bouillante, 5 min à couvert.',
    'Saisis crevettes et halloumi ; mélange tout avec la menthe et le citron.']);
  r('crevettes', 'boulgour', 'Salade de boulgour, crevettes et halloumi grillé', 25, 1, {tomate:100, concombre:80, oignon:30, salade:40}, [H1], 'menthe, persil, citron, sumac (au goût)', null, [
    'Cuis le boulgour 10 min et laisse-le refroidir.',
    'Ajoute tomates, concombre, oignon rouge, salade, herbes, huile et citron.',
    'Pose dessus les crevettes et le halloumi grillé en tranches.']);
  r('crevettes', 'lentilles', 'Salade de lentilles, crevettes et halloumi au cumin', 30, 1, {carotte:50, salade:100, tomate:70, oignon:30}, [H1], 'citron, cumin, coriandre, moutarde', null, [
    'Cuis les lentilles 20 min et laisse-les tiédir.',
    'Vinaigrette : huile, citron, cumin, moutarde ; carotte râpée, tomates, oignon rouge.',
    'Sers sur la salade avec les crevettes et le halloumi grillé.']);
  r('crevettes', 'poischiches', 'Crevettes, halloumi et pois chiches rôtis', 30, 1, {poivron:80, oignon:50, tomate:70, epinards:50}, [H1], 'paprika fumé, cumin, ail, citron', null, [
    'Fais rôtir les pois chiches cuits, le poivron et l’oignon avec l’huile et les épices, four à 200 °C, 20 min.',
    'Ajoute les tomates et le halloumi en dés, 5 min de plus.',
    'Saisis les crevettes à l’ail ; sers sur les pousses d’épinards, avec le citron.']);
  r('crevettes', 'gnocchis', 'Gnocchis poêlés aux crevettes et courgettes', 20, 0, {courgette:150, tomate:70, oignon:30}, [H1], 'ail, citron, basilic, piment', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais sauter la courgette, l’échalote et l’ail dans l’huile, puis les tomates cerises et les crevettes.',
    'Remets les gnocchis, ajoute le halloumi grillé, le citron et le basilic.']);
  /* Œufs + jambon */
  r('oeufs', 'riz', 'Riz cantonais, œufs, jambon et petits pois', 20, 1, {petitspois:70, oignon:50, carotte:60, chou:70}, [H1], 'sauce soja, ciboule, gingembre', null, [
    'Fais sauter l’oignon, la carotte en dés, le chou et les petits pois dans l’huile.',
    'Pousse les légumes, brouille les œufs dans la poêle, puis ajoute le riz cuit et le jambon en dés.',
    'Assaisonne à la sauce soja et parsème de ciboule.']);
  r('oeufs', 'pates', 'Pâtes carbonara légère aux champignons', 20, 0, {champignon:100, oignon:50, salade:100}, [H1, PARM], 'poivre, ail, persil', null, [
    'Fais sauter l’oignon et les champignons dans l’huile, puis le jambon en lanières.',
    'Bats les œufs avec le parmesan et beaucoup de poivre.',
    'Hors du feu, mélange les pâtes chaudes avec la poêlée puis les œufs, en ajoutant un peu d’eau de cuisson ; salade à côté.']);
  r('oeufs', 'pdt', 'Tortilla aux pommes de terre et oignons', 35, 1, {oignon:80, poivron:70, salade:100}, [H2], 'paprika, persil', null, [
    'Fais cuire les pommes de terre en fines rondelles avec l’oignon et le poivron dans l’huile, 20 min à couvert.',
    'Mélange aux œufs battus et au jambon en dés.',
    'Cuis à feu doux 8 min, retourne à l’aide d’une assiette, 3 min ; salade à côté.']);
  r('oeufs', 'patate', 'Omelette, patate douce rôtie et poivrons', 35, 1, {poivron:100, oignon:50, epinards:100}, [H2], 'paprika fumé, cumin, ciboulette', null, [
    'Patate douce en cubes, poivron et oignon, avec l’huile et le paprika : four à 200 °C, 25 min.',
    'Fais tomber les épinards dans une poêle, verse les œufs battus et le jambon, cuis en omelette.',
    'Sers l’omelette avec les légumes rôtis et la ciboulette.']);
  r('oeufs', 'quinoa', 'Quinoa sauté aux œufs, jambon et légumes', 25, 1, {courgette:80, carotte:60, petitspois:50, oignon:60}, [H1], 'sauce soja, ail, ciboule', null, [
    'Cuis le quinoa 12 min.',
    'Fais sauter oignon, carotte, courgette et petits pois dans l’huile, puis brouille les œufs à côté.',
    'Ajoute le quinoa et le jambon en dés, la sauce soja et la ciboule.']);
  r('oeufs', 'semoule', 'Shakshuka et semoule', 30, 0, {pulpe:150, poivron:70, oignon:30}, [H2], 'cumin, paprika, ail, coriandre, piment', null, [
    'Fais revenir l’oignon, l’ail et le poivron dans l’huile avec les épices, ajoute la pulpe ; 10 min.',
    'Creuse des puits, casse les œufs dedans, couvre 6 à 8 min ; le jambon en dés dans la sauce.',
    'Coriandre, et la semoule à côté.']);
  r('oeufs', 'boulgour', 'Boulgour sauté aux œufs, jambon et épinards', 20, 1, {epinards:120, oignon:50, tomate:80}, [H1], 'ail, cumin, persil', null, [
    'Cuis le boulgour 10 min.',
    'Fais revenir l’oignon, l’ail et les tomates dans l’huile, puis les épinards.',
    'Ajoute le boulgour et le jambon, brouille les œufs dedans ; persil.']);
  r('oeufs', 'lentilles', 'Lentilles, œufs mollets et jambon, vinaigrette moutarde', 30, 1, {carotte:70, oignon:50, salade:130}, [H2], 'moutarde, vinaigre, thym, laurier, ciboulette', null, [
    'Cuis les lentilles 20 min avec la carotte, l’oignon, le thym et le laurier.',
    'Œufs mollets : 6 min dans l’eau bouillante, puis dans l’eau froide et écale.',
    'Vinaigrette moutarde-vinaigre-huile ; lentilles tièdes, jambon, œufs, salade, ciboulette.']);
  r('oeufs', 'poischiches', 'Œufs, jambon et pois chiches poêlés aux épices', 20, 1, {pulpe:100, epinards:100, oignon:50}, [H1], 'cumin, paprika, ail, coriandre', null, [
    'Fais revenir l’oignon, l’ail et les épices dans l’huile, ajoute les pois chiches cuits et la pulpe ; 10 min.',
    'Ajoute les épinards et le jambon.',
    'Casse les œufs dessus, couvre 6 min ; coriandre.']);
  r('oeufs', 'gnocchis', 'Gnocchis poêlés au jambon, œuf et champignons', 20, 0, {champignon:120, epinards:100, oignon:30}, [H1, PARM], 'ail, persil, poivre', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais sauter l’échalote, l’ail et les champignons dans l’huile, puis les épinards et le jambon.',
    'Remets les gnocchis, ajoute les œufs au plat ou pochés dessus ; parmesan et persil.']);
  /* Thon */
  r('thon', 'riz', 'Salade de riz au thon', 15, 1, {tomate:100, poivron:60, concombre:60, oignon:30}, [H2], 'moutarde, vinaigre, persil, câpres', null, [
    'Cuis le riz et laisse-le refroidir.',
    'Coupe tomates, poivron, concombre et oignon en dés.',
    'Mélange avec le thon émietté, l’œuf dur en quartiers, la vinaigrette moutarde et les câpres.']);
  r('thon', 'pates', 'Pâtes au thon, tomates et olives', 20, 1, {pulpe:150, oignon:50, courgette:50}, [H1, OLIVE], 'ail, câpres, origan, basilic', null, [
    'Fais fondre l’oignon et l’ail dans l’huile, ajoute la courgette, la pulpe, les olives et les câpres ; 10 min.',
    'Ajoute le thon égoutté hors du feu.',
    'Mélange aux pâtes, l’œuf dur en quartiers dessus, basilic.']);
  r('thon', 'pdt', 'Salade niçoise', 25, 1, {tomate:100, haricotsverts:80, salade:40, oignon:30}, [H1, OLIVE], 'basilic, moutarde, vinaigre, anchois (au goût)', null, [
    'Cuis les pommes de terre à l’eau et les haricots verts 8 min ; laisse refroidir.',
    'Dispose salade, tomates, oignon, haricots, pommes de terre, thon, œuf dur et olives.',
    'Arrose de vinaigrette moutarde-vinaigre-huile ; basilic.']);
  r('thon', 'patate', 'Salade de patate douce au thon, citron vert', 30, 1, {salade:80, poivron:70, oignon:40, concombre:60}, [H2], 'citron vert, coriandre, paprika', null, [
    'Patate douce en cubes au paprika, four à 200 °C, 25 min, ou à la vapeur.',
    'Mélange salade, poivron, concombre et oignon rouge avec l’huile et le citron vert.',
    'Ajoute la patate douce tiède, le thon, l’œuf dur et la coriandre.']);
  r('thon', 'quinoa', 'Salade quinoa-thon aux herbes', 20, 1, {tomate:90, concombre:80, poivron:50, oignon:30}, [H2], 'citron, persil, menthe', null, [
    'Cuis le quinoa 12 min et laisse refroidir.',
    'Ajoute tomates, concombre, poivron et oignon en dés, les herbes, l’huile et le citron.',
    'Thon émietté et œuf dur sur le dessus.']);
  r('thon', 'semoule', 'Taboulé au thon', 15, 1, {tomate:120, concombre:90, oignon:40}, [H2], 'menthe, persil, citron', null, [
    'Verse la semoule dans le même volume d’eau bouillante, 5 min à couvert, égrène et laisse refroidir.',
    'Ajoute tomates, concombre et oignon en petits dés, beaucoup d’herbes, l’huile et le citron.',
    'Thon émietté et œuf dur en quartiers.']);
  r('thon', 'boulgour', 'Boulgour au thon façon pilaf, tomates et poivrons', 25, 1, {pulpe:100, poivron:80, oignon:50, courgette:20}, [H2], 'ail, paprika, cumin, persil', null, [
    'Fais revenir l’oignon, l’ail, le poivron et la courgette dans l’huile avec les épices.',
    'Ajoute le boulgour, la pulpe et 1,5 fois son volume d’eau ; 12 min à couvert.',
    'Incorpore le thon hors du feu ; œuf dur et persil.']);
  r('thon', 'lentilles', 'Salade de lentilles au thon', 25, 1, {tomate:80, carotte:50, oignon:30, salade:90}, [H2], 'moutarde, vinaigre, persil, ciboulette', null, [
    'Cuis les lentilles 20 min et laisse-les tiédir.',
    'Vinaigrette moutarde-vinaigre-huile avec l’échalote ciselée.',
    'Mélange avec la carotte râpée, les tomates, le thon, l’œuf dur et la salade.']);
  r('thon', 'poischiches', 'Salade de pois chiches au thon, cumin et citron', 15, 1, {tomate:100, concombre:80, poivron:40, oignon:30}, [H2], 'cumin, citron, coriandre, persil', null, [
    'Rince les pois chiches cuits.',
    'Ajoute tomates, concombre, poivron et oignon rouge en dés, l’huile, le citron et le cumin.',
    'Thon, œuf dur et herbes sur le dessus.']);
  r('thon', 'gnocchis', 'Gnocchis au thon et aux tomates', 20, 0, {pulpe:150, oignon:50, epinards:50}, [H1, PARM], 'ail, basilic, câpres', null, [
    'Fais fondre l’oignon et l’ail dans l’huile, ajoute la pulpe et les câpres ; 10 min.',
    'Ajoute les épinards puis le thon hors du feu.',
    'Mélange aux gnocchis poêlés, parmesan, basilic ; l’œuf dur à côté.']);
  /* Tofu ferme */
  r('tofu', 'riz', 'Tofu sauté aux légumes, riz', 25, 1, {brocoli:100, poivron:70, oignon:40, chou:40}, [H1, SES], 'sauce soja, gingembre, ail, ciboule', {miel:5}, [
    'Presse le tofu, coupe-le en cubes et fais-le dorer dans l’huile.',
    'Ajoute oignon, brocoli, poivron et chou, 5 min à feu vif.',
    'Sauce soja, miel, gingembre et ail ; sers sur le riz avec le sésame et la ciboule.']);
  r('tofu', 'pates', 'Pâtes au tofu, tomates et basilic', 20, 1, {pulpe:150, oignon:50, courgette:50}, [H1, PARM], 'ail, basilic, origan, paprika fumé', null, [
    'Émiette le tofu et fais-le dorer dans l’huile avec le paprika fumé.',
    'Ajoute l’oignon, l’ail, la courgette, puis la pulpe et l’origan ; 10 min.',
    'Mélange aux pâtes avec le parmesan et le basilic.']);
  r('tofu', 'pdt', 'Tofu grillé, pommes de terre rôties et haricots verts', 40, 1, {haricotsverts:150, oignon:60, tomate:40}, [H2], 'paprika fumé, thym, sauce soja, ail', null, [
    'Pommes de terre en quartiers et oignon avec la moitié de l’huile et le thym, four à 200 °C, 35 min.',
    'Fais mariner le tofu en tranches dans la sauce soja et le paprika, puis grille-le dans le reste d’huile.',
    'Haricots verts à la vapeur ; tomates en quartiers.']);
  r('tofu', 'patate', 'Bowl tofu, patate douce et brocolis', 35, 1, {brocoli:150, oignon:40, epinards:60}, [H1, SES], 'sauce soja, citron vert, gingembre', null, [
    'Patate douce et oignon en cubes avec l’huile, four à 200 °C, 25 min ; brocolis 10 min avant la fin.',
    'Fais dorer le tofu en cubes à la poêle, avec la sauce soja et le gingembre.',
    'Bowl sur les pousses d’épinards, sésame et citron vert.']);
  r('tofu', 'quinoa', 'Bowl tofu-quinoa, sauce soja et sésame', 25, 1, {carotte:70, concombre:80, chou:60, oignon:40}, [HSES, SES], 'sauce soja, vinaigre de riz, gingembre, coriandre', null, [
    'Cuis le quinoa 12 min.',
    'Fais dorer le tofu en cubes à la poêle, puis enrobe-le de sauce soja.',
    'Bowl : quinoa, carotte râpée, concombre, chou émincé, oignon nouveau, tofu ; huile et graines de sésame, vinaigre de riz.']);
  r('tofu', 'semoule', 'Tofu à la marocaine, semoule', 35, 1, {carotte:70, courgette:80, oignon:50, pulpe:50}, [H2], 'ras-el-hanout, cumin, coriandre, citron', null, [
    'Fais dorer le tofu en cubes avec les épices dans l’huile.',
    'Ajoute l’oignon, la carotte, la courgette, la pulpe et un verre d’eau ; 20 min.',
    'Sers avec la semoule, la coriandre et le citron.']);
  r('tofu', 'boulgour', 'Taboulé de boulgour au tofu grillé', 25, 1, {tomate:100, concombre:80, oignon:30, poivron:40}, [H2], 'persil, menthe, citron, sumac (au goût)', null, [
    'Cuis le boulgour 10 min et laisse-le refroidir.',
    'Ajoute légumes en dés, herbes, la moitié de l’huile et le citron.',
    'Grille le tofu en dés dans le reste d’huile et pose-le dessus.']);
  r('tofu', 'lentilles', 'Dahl de lentilles corail au tofu', 30, 1, {oignon:60, pulpe:100, epinards:90}, [H1, COCO], 'curry, curcuma, cumin, gingembre, ail, coriandre', null, [
    'Fais revenir l’oignon, l’ail, le gingembre et les épices dans l’huile.',
    'Ajoute les lentilles corail, la pulpe et 3 fois leur volume d’eau ; 15 min, puis le lait de coco et les épinards.',
    'Fais dorer le tofu en cubes à part et pose-le sur le dahl ; coriandre.']);
  r('tofu', 'poischiches', 'Curry de pois chiches, chou-fleur et tofu, raïta', 35, 1, {oignon:60, choufleur:120, pulpe:70}, [H1, COCO], 'curry, garam masala, gingembre, ail, coriandre', {skyr:40}, [
    'Fais revenir l’oignon, l’ail, le gingembre et les épices dans l’huile.',
    'Ajoute le chou-fleur en fleurettes, les pois chiches cuits, la pulpe, le lait de coco et un peu d’eau ; 20 min.',
    'Ajoute le tofu doré à la poêle ; raïta : skyr et coriandre.']);
  r('tofu', 'gnocchis', 'Gnocchis poêlés au tofu, épinards et champignons', 20, 0, {epinards:120, champignon:100, oignon:30}, [H1, PARM], 'ail, sauce soja, muscade', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais dorer le tofu en dés dans l’huile avec un trait de sauce soja, puis l’échalote, l’ail et les champignons.',
    'Ajoute les épinards et les gnocchis ; muscade et parmesan.']);
  return out;
})();
/* Recettes d'un couple protéine × féculent (une pour l'instant) */
const RECIPE_INDEX = {};
Object.keys(RECIPES).forEach(function(id){ const x = RECIPES[id], k = x.p + '-' + x.s; (RECIPE_INDEX[k] = RECIPE_INDEX[k] || []).push(id); });
function recipesFor(prot, starch){ const k = prot + '-' + starch; return has(RECIPE_INDEX, k) ? RECIPE_INDEX[k].slice() : []; }
/* Recette choisie pour un repas, si elle va avec sa protéine et son féculent ; sinon null */
function recipeOf(choice){
  if (!choice || !has(RECIPES, choice.recette)) return null;
  const x = RECIPES[choice.recette];
  return x.p === choice.prot && x.s === choice.starch ? choice.recette : null;
}
/* Lignes d'une recette choisie : légumes, matière grasse, ajouts (quantités fixes, comme les légumes et la marge cuisine) */
function recipeItems(id){
  const x = RECIPES[id];
  return Object.keys(x.leg).map(function(v){ return it('v-' + v, grams(x.leg[v]), RFOOD[v][0], RFOOD[v][1], mac(v, x.leg[v])); })
    .concat(x.cuis.map(function(c){ return it('f-' + c[0], grams(c[1]), c[2], c[3], mac(c[0], c[1])); }))
    .concat(Object.keys(x.plus).map(function(a){ return it('x-' + a, grams(x.plus[a]), a === 'skyr' ? 'skyr nature' : 'miel', 'pour la sauce', mac(a, x.plus[a])); }));
}

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
/* Chaque jour part sans séance ; seul le repas libre du samedi est prévu par défaut */
/* Séances valides : au plus 4, une seule longue, toujours le matin */
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
/* Plan d'un jour relu du stockage : ce qui n'est pas enregistré (séances, repas libre) vient de la semaine type */
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
const DEFAULT_CHOICES = {
  0:{pdBase:'pain', dej:{prot:'poulet', starch:'pdt'}, diner:{prot:'oeufs', starch:'riz'}},
  1:{pdBase:'avoine', dej:{prot:'poulet', starch:'riz'}, diner:{prot:'crevettes', starch:'quinoa'}},
  2:{pdBase:'avoine', dej:{prot:'poulet', starch:'riz'}, diner:{prot:'boeuf', starch:'pates'}},
  3:{pdBase:'avoine', dej:{prot:'poulet', starch:'riz'}, diner:{prot:'poisson', starch:'lentilles'}},
  4:{pdBase:'avoine', dej:{prot:'boeuf', starch:'riz'}, diner:{prot:'saumon', starch:'riz'}},
  5:{pdBase:'avoine', dej:{prot:'boeuf', starch:'riz'}, diner:{prot:'poulet', starch:'patate'}},
  6:{pdBase:'avoine', dej:{prot:'thon', starch:'pates'}, diner:{prot:'saumon', starch:'pdt'}}
};
/* Aliments proposés : ceux retirés dans les réglages (profil off, entrées « type:id ») ne sont plus proposés ni tirés au
   hasard. Il en reste toujours au moins un par type ; « Aucun » dessert reste toujours possible. */
const CHOICE_IDS = {pd:PD_ORDER, prot:PROT_ORDER, starch:STARCH_ORDER, dessert:DESSERT_ORDER.filter(function(d){ return d !== 'aucun'; })};
function cleanOff(o){
  if (!Array.isArray(o)) return [];
  let out = [];
  o.slice(0, 100).forEach(function(x){
    if (typeof x !== 'string' || out.indexOf(x) >= 0) return;
    const i = x.indexOf(':'), kind = x.slice(0, i), id = x.slice(i + 1);
    if (i > 0 && has(CHOICE_IDS, kind) && CHOICE_IDS[kind].indexOf(id) >= 0) out.push(x);
  });
  Object.keys(CHOICE_IDS).forEach(function(kind){
    if (kind !== 'dessert' && CHOICE_IDS[kind].every(function(id){ return out.indexOf(kind + ':' + id) >= 0; }))
      out = out.filter(function(x){ return x.indexOf(kind + ':') !== 0; });
  });
  return out;
}
function allowed(kind, off){
  const all = kind === 'dessert' ? DESSERT_ORDER : CHOICE_IDS[kind], o = off || [];
  return all.filter(function(id){ return o.indexOf(kind + ':' + id) < 0; });
}
/* Plats proposés par l'appli (mémoire du jour de la semaine, choix par défaut) : un aliment retiré est remplacé par le
   suivant proposé dans la liste (un dessert retiré par « Aucun »), une protéine remplacée jamais par celle de l'autre repas
   (s'il en reste au moins deux). La recette choisie reste si sa protéine et son féculent restent. Les plats choisis pour une
   date ne passent pas par là. */
function withAllowed(c, off){
  const next = function(kind, id, avoid){
    const ok = allowed(kind, off);
    if (ok.indexOf(id) >= 0) return id;
    if (kind === 'dessert') return 'aucun';
    const all = CHOICE_IDS[kind], i = all.indexOf(id);
    for (let j = 1; j <= all.length; j++){ const x = all[(i + j) % all.length]; if (ok.indexOf(x) >= 0 && x !== avoid) return x; }
    return ok[0];
  };
  const dejProt = next('prot', c.dej.prot, allowed('prot', off).indexOf(c.diner.prot) >= 0 ? c.diner.prot : null);
  const meal = function(m, prot){
    const o = {prot:prot, starch:next('starch', m.starch), dessert:next('dessert', dessertOf(m))};
    if (recipeOf({prot:o.prot, starch:o.starch, recette:m.recette})) o.recette = m.recette;
    return o;
  };
  return {pdBase:next('pd', c.pdBase), dej:meal(c.dej, dejProt), diner:meal(c.diner, next('prot', c.diner.prot, dejProt))};
}
/* Repères de la semaine (Santé publique France, 2019) : poisson 2 fois dont 1 poisson gras, légumes secs au moins 2 fois,
   viande rouge 500 g cuits au plus, charcuterie 150 g au plus (le jambon blanc en est). Comptés sur des journées construites
   par buildDay (portions réelles), repas libre exclu ; viande rouge = bœuf cru × rendement de cuisson. */
const WEEK_GOALS = {poisson:2, gras:1, legumes:2, rouge:500, charcuterie:150};
const FISH = ['poisson', 'saumon', 'thon'], LEGUMES = ['lentilles', 'poischiches'];
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
/* « Décide pour moi » : chaque choix tiré au hasard parmi les aliments proposés (rand : nombres dans [0, 1[, Math.random par
   défaut), jamais la même protéine au déjeuner et au dîner (s'il en reste au moins deux), jamais « Œufs + jambon » avec le
   petit-déjeuner salé (s'il reste autre chose). Avec bal (weekBalance du reste de la semaine) et k, le tirage équilibre :
   poisson (et poisson gras) et légumes secs trois fois plus probables tant qu'il en manque, bœuf, « Œufs + jambon » et salé
   écartés s'ils feraient dépasser la viande rouge ou la charcuterie. Sans bal : tirage uniforme. La recette du couple
   protéine × féculent est choisie d'office (tirée au hasard s'il y en a plusieurs). */
/* Tirage pondéré (rand : nombres dans [0, 1[). Poids > 0 : tirage pondéré ; 0 : écarté (repères) ; < 0 : écarté d'abord.
   Sans poids positif, tirage parmi les poids nuls, sinon parmi tous. */
function tieredPick(r, a, w){
  const ws = a.map(function(x){ return w ? w(x) : 1; }), sum = ws.reduce(function(t, x){ return t + Math.max(0, x); }, 0);
  const flat = function(b){ return b[Math.min(b.length - 1, Math.floor(r() * b.length))]; };
  if (sum <= 0){ const soft = a.filter(function(x, i){ return ws[i] === 0; }); return flat(soft.length ? soft : a); }
  let x = r() * sum;
  for (let i = 0; i < a.length; i++){ if (ws[i] > 0){ x -= ws[i]; if (x < 0) return a[i]; } }
  for (let i = a.length - 1; i >= 0; i--) if (ws[i] > 0) return a[i];
}
function randomChoices(rand, off, bal, k){
  const r = rand || Math.random, kk = k || 1, c = bal ? Object.assign({}, bal) : null;
  /* 0 : écarté par les repères ; < 0 : écarté d'abord (œufs-jambon avec le salé) */
  const pick = function(a, w){ return tieredPick(r, a, w); };
  const jambonSale = sc(45, 5, kk), jambonOeufs = sc(90, 5, kk), boeufCuit = sc(150, 10, kk) * YIELD.boeuf;
  const pdBase = pick(allowed('pd', off), function(x){ return c && x === 'sale' && c.charcuterie + jambonSale > WEEK_GOALS.charcuterie ? 0 : 1; });
  if (c && pdBase === 'sale') c.charcuterie += jambonSale;
  const protW = function(p){
    if (p === 'oeufs' && pdBase === 'sale') return -1;
    if (!c) return 1;
    if (p === 'boeuf' && c.rouge + boeufCuit > WEEK_GOALS.rouge) return 0;
    if (p === 'oeufs' && c.charcuterie + jambonOeufs > WEEK_GOALS.charcuterie) return 0;
    if (FISH.indexOf(p) >= 0 && c.poisson < WEEK_GOALS.poisson) return p === 'saumon' && c.gras < WEEK_GOALS.gras ? 6 : 3;
    return 1;
  };
  const starchW = function(s){ return c && LEGUMES.indexOf(s) >= 0 && c.legumes < WEEK_GOALS.legumes ? 3 : 1; };
  const meal = function(not){
    const prots = allowed('prot', off), other = prots.filter(function(p){ return p !== not; });
    const prot = pick(other.length ? other : prots, protW), starch = pick(allowed('starch', off), starchW);
    if (c){
      if (FISH.indexOf(prot) >= 0){ c.poisson++; if (prot === 'saumon') c.gras++; }
      if (prot === 'boeuf') c.rouge += boeufCuit;
      if (prot === 'oeufs') c.charcuterie += jambonOeufs;
      if (LEGUMES.indexOf(starch) >= 0) c.legumes++;
    }
    const o = {prot:prot, starch:starch, dessert:pick(allowed('dessert', off))}, recs = recipesFor(prot, starch);
    if (recs.length) o.recette = recs.length > 1 ? pick(recs) : recs[0];
    return o;
  };
  const dej = meal(null);
  return {pdBase:pdBase, dej:dej, diner:meal(dej.prot)};
}

/* Batch cooking (3.13.0) : pour une période (jours consécutifs, par blocs de 7 à partir du premier), quelques recettes qui
   se gardent (3, 4 ou 5) répétées aux déjeuners et aux dîners, cuisinées en une fois la veille du bloc. Un plat cuisiné se
   garde 3 jours au frigo (FRIDGE_DAYS) : les boîtes mangées plus tard vont au congélateur. */
const BATCH_BLOCK = 7, BATCH_N = [3, 4, 5], FRIDGE_DAYS = 3;
/* Plats d'une période en batch cooking. days : [{libre}] dans l'ordre des dates ; renvoie les choix de chaque jour
   ({pdBase, dej, diner}, recette comprise ; rand comme randomChoices). Par bloc :
   - n recettes au plus (au moins deux repas chacune), parmi celles qui se gardent et dont la protéine et le féculent sont
     proposés ; protéines différentes et féculents variés autant que possible ; poisson, poisson gras et légumes secs
     favorisés tant que le bloc en manque ; bœuf et « Œufs + jambon » écartés d'abord s'ils feraient dépasser la viande rouge
     ou la charcuterie (repas du bloc, au nombre de boîtes le plus haut), comme une protéine qui aurait plus de repas que le
     bloc n'a de jours ; une recette qui se congèle mal seulement si ses boîtes tiennent dans les 3 premiers jours (une par
     jour au plus, avec les autres qui se congèlent mal, une seule par protéine) et qu'il en reste deux qui se congèlent bien
     pour la suite ;
   - boîtes : les moins nombreuses aux recettes servies d'abord (celles qui se congèlent mal, poisson en tête) ; repas
     répartis dans l'ordre des jours, deux recettes en cours à la fois (celle qui se congèle mal, sinon la plus fournie,
     d'abord), en alternant ; jamais la
     même protéine au déjeuner et au dîner si c'est possible (échange avec le repas le plus proche) ;
   - petit-déjeuner comme randomChoices (pas de salé avec « Œufs + jambon », charcuterie comptée), desserts au hasard ; le
     dîner d'un repas libre reçoit une recette du bloc d'une autre protéine, sans boîte. */
function batchChoices(days, n, off, k, rand){
  const r = rand || Math.random, kk = k || 1, nn = BATCH_N.indexOf(n) >= 0 ? n : 4;
  const pick = function(a, w){ return tieredPick(r, a, w); };
  const jambonSale = sc(45, 5, kk), jambonOeufs = sc(90, 5, kk), boeufCuit = sc(150, 10, kk) * YIELD.boeuf;
  const prots = allowed('prot', off), starches = allowed('starch', off);
  const ok = Object.keys(RECIPES).filter(function(id){ return prots.indexOf(RECIPES[id].p) >= 0 && starches.indexOf(RECIPES[id].s) >= 0; });
  const keep = ok.filter(function(id){ return RECIPES[id].box; }), pool = keep.length ? keep : ok;
  const prot = function(e){ return RECIPES[e.id].p; };
  const out = [];
  for (let b = 0; b < days.length; b += BATCH_BLOCK){
    const block = days.slice(b, b + BATCH_BLOCK), slots = [];
    block.forEach(function(d, i){ slots.push({i:i, slot:'dej'}); if (!(d && d.libre)) slots.push({i:i, slot:'diner'}); });
    const m = slots.length, nr = Math.min(nn, m, Math.max(2, Math.floor(m / 2)));
    const cnt = [];
    for (let j = 0; j < nr; j++) cnt.push(Math.floor(m / nr) + (j >= nr - m % nr ? 1 : 0));
    /* Recettes qui se congèlent mal : autant que de boîtes (les moins nombreuses) qui tiennent dans les 3 premiers jours */
    const fridgeSlots = slots.filter(function(sl){ return sl.i < FRIDGE_DAYS; }).length;
    let maxNoGel = 0, used = 0;
    if (block.length <= FRIDGE_DAYS) maxNoGel = nr;
    else while (maxNoGel < nr - 2 && cnt[maxNoGel] <= FRIDGE_DAYS && used + cnt[maxNoGel] <= fridgeSlots){ used += cnt[maxNoGel]; maxNoGel++; }
    const ct = cnt[nr - 1], c = {poisson:0, gras:0, legumes:0, rouge:0, charcuterie:0}, chosen = [], perProt = {}, perFresh = {};
    cnt.forEach(function(){
      const usedP = chosen.map(function(id){ return RECIPES[id].p; }), usedS = chosen.map(function(id){ return RECIPES[id].s; });
      const noGel = chosen.filter(function(id){ return !RECIPES[id].gel; }).length, fresh = pool.filter(function(id){ return chosen.indexOf(id) < 0; });
      const id = pick(fresh.length ? fresh : pool, function(id){
        const x = RECIPES[id];
        if (x.p === 'boeuf' && c.rouge + ct * boeufCuit > WEEK_GOALS.rouge) return -1;
        if (x.p === 'oeufs' && c.charcuterie + ct * jambonOeufs > WEEK_GOALS.charcuterie) return -1;
        if ((perProt[x.p] || 0) + ct > block.length || (!x.gel && (noGel >= maxNoGel || (perFresh[x.p] || 0) + ct > FRIDGE_DAYS))) return -1;
        if (usedP.indexOf(x.p) >= 0) return 0;
        let w = usedS.indexOf(x.s) >= 0 ? 0.3 : 1;
        if (FISH.indexOf(x.p) >= 0 && c.poisson < WEEK_GOALS.poisson) w *= x.p === 'saumon' && c.gras < WEEK_GOALS.gras ? 6 : 3;
        if (LEGUMES.indexOf(x.s) >= 0 && c.legumes < WEEK_GOALS.legumes) w *= 3;
        return w;
      });
      const x = RECIPES[id];
      if (FISH.indexOf(x.p) >= 0){ c.poisson += ct; if (x.p === 'saumon') c.gras += ct; }
      if (LEGUMES.indexOf(x.s) >= 0) c.legumes += ct;
      if (x.p === 'boeuf') c.rouge += ct * boeufCuit;
      if (x.p === 'oeufs') c.charcuterie += ct * jambonOeufs;
      perProt[x.p] = (perProt[x.p] || 0) + ct;
      if (!x.gel) perFresh[x.p] = (perFresh[x.p] || 0) + ct;
      chosen.push(id);
    });
    const ent = chosen.map(function(id, j){ return {id:id, j:j, key:(RECIPES[id].gel ? 2 : 0) + (FISH.indexOf(RECIPES[id].p) >= 0 ? 0 : 1)}; })
      .sort(function(a, x){ return a.key - x.key || a.j - x.j; });
    ent.forEach(function(e, j){ e.left = cnt[j]; });
    const at = block.map(function(){ return {}; });
    let prev = null;
    slots.forEach(function(sl){
      const other = sl.slot === 'diner' && at[sl.i].dej ? prot(at[sl.i].dej) : null;
      const live = ent.filter(function(e){ return e.left > 0; });
      const okP = function(l){ return l.filter(function(e){ return prot(e) !== other; }); };
      let cand = okP(live.slice(0, 2));
      if (!cand.length) cand = okP(live);
      if (!cand.length) cand = live;
      /* Celles qui se congèlent mal d'abord, puis la plus fournie ; pas deux fois de suite la même */
      const score = function(e){ return e.left + (RECIPES[e.id].gel ? 0 : 100) - (e === prev ? 0.5 : 0); };
      const e = cand.reduce(function(best, x){ return score(x) > score(best) ? x : best; });
      e.left--; prev = e; at[sl.i][sl.slot] = e;
    });
    /* Même protéine midi et soir : le dîner est échangé avec le repas le plus proche qui règle les deux jours, sans repousser
       après le 3e jour une recette qui se congèle mal */
    const clash = function(i){ return at[i].dej && at[i].diner && prot(at[i].dej) === prot(at[i].diner); };
    const fresh = function(e, i){ return RECIPES[e.id].gel || i < FRIDGE_DAYS || block.length <= FRIDGE_DAYS; };
    block.forEach(function(d, i){
      if (!clash(i)) return;
      const others = slots.filter(function(sl){ return sl.i !== i; }).sort(function(a, x){ return Math.abs(a.i - i) - Math.abs(x.i - i); });
      for (let t = 0; t < others.length; t++){
        const sl = others[t], a = at[i].diner, x = at[sl.i][sl.slot];
        if (!fresh(x, i) || !fresh(a, sl.i)) continue;
        at[i].diner = x; at[sl.i][sl.slot] = a;
        if (!clash(i) && !clash(sl.i)) return;
        at[i].diner = a; at[sl.i][sl.slot] = x;
      }
    });
    block.forEach(function(d, i){
      const dej = at[i].dej, din = at[i].diner || ent.find(function(e){ return prot(e) !== prot(dej); }) || dej;
      const oe = prot(dej) === 'oeufs' || prot(din) === 'oeufs';
      const pdBase = pick(allowed('pd', off), function(x){
        if (x !== 'sale') return 1;
        if (oe) return -1;
        return c.charcuterie + jambonSale > WEEK_GOALS.charcuterie ? 0 : 1;
      });
      if (pdBase === 'sale') c.charcuterie += jambonSale;
      const meal = function(e){ const x = RECIPES[e.id]; return {prot:x.p, starch:x.s, dessert:pick(allowed('dessert', off)), recette:e.id}; };
      out.push({pdBase:pdBase, dej:meal(dej), diner:meal(din)});
    });
  }
  return out;
}
/* Fiche de batch cooking d'une période : days = [{res}] (résultats de buildDay, dates consécutives), par blocs de 7.
   Pour chaque recette qui se garde servie à au moins deux repas d'un bloc (repas libre exclu) : ses boîtes (jour depuis le début de la
   période, repas, frigo si elle est mangée 3 jours au plus après la cuisson de la veille du bloc, sinon congélateur ;
   protéine et féculent de la boîte) et ce qu'il faut cuire en tout (protéine, féculent, légumes, matière grasse, ajouts :
   somme des boîtes, valeurs des lignes de buildDay). lead : jours entre la cuisson et le premier jour (1 par défaut, la
   veille ; 0 si la période commence aujourd'hui), pour le premier bloc seulement.
   Renvoie [{start, recipes:[{id, t, gel, boxes, totals}]}]. */
function batchCook(days, lead){
  const blocks = [];
  for (let b = 0; b < days.length; b += BATCH_BLOCK){
    const by = {}, order = [];
    days.slice(b, b + BATCH_BLOCK).forEach(function(d, i){
      d.res.secs.forEach(function(sec){
        if ((sec.id !== 'dej' && sec.id !== 'diner') || sec.libre || !sec.recipe) return;
        if (!has(by, sec.recipe)){ by[sec.recipe] = []; order.push(sec.recipe); }
        by[sec.recipe].push({day:b + i, slot:sec.id, after:i + (b === 0 && lead === 0 ? 0 : 1), items:sec.items.filter(function(x){ return /^(p1|p2|st|[vfx]-)/.test(x.key) && x.buy; })});
      });
    });
    const recipes = order.filter(function(id){ return RECIPES[id].box && by[id].length >= 2; }).map(function(id){
      const x = RECIPES[id], tot = {}, ids = [];
      by[id].forEach(function(v){ v.items.forEach(function(i){
        const a = tot[i.buy.id] || (tot[i.buy.id] = {first:i, g:0, n:0, cooked:0});
        if (ids.indexOf(i.buy.id) < 0) ids.push(i.buy.id);
        a.g += i.buy.g || 0; a.n += i.buy.n || 0; a.cooked += i.cook && i.cook.ways.length === 1 ? i.cook.ways[0].g : 0;
      }); });
      const PLURAL = {oeuf:'œufs', thon:'boîtes de thon au naturel'};
      const totals = ids.map(function(bid){
        const a = tot[bid], i = a.first, k = i.key;
        if (a.n) return {id:bid, qty:String(a.n), name:a.n > 1 && has(PLURAL, bid) ? PLURAL[bid] : i.name, note:null};
        const note = a.cooked ? '≈' + NB + shopQty(Math.round(a.cooked / 10) * 10) + ' ' + i.cook.ways[0].adj
          : /^f-/.test(k) ? i.note + ' par boîte' : /^v-/.test(k) ? RFOOD[bid][1] : null;
        return {id:bid, qty:shopQty(a.g), name:i.name, note:note};
      });
      const boxes = by[id].map(function(v){
        return {day:v.day, slot:v.slot, fridge:v.after <= FRIDGE_DAYS, parts:v.items.filter(function(i){ return /^(p1|p2|st)$/.test(i.key); }).map(function(i){
          return {qty:i.qty, name:i.name, cooked:i.cook ? i.cook.ways.map(function(w){ return '≈' + NB + grams(w.g) + ' ' + w.adj; }).join(' ou ') : null};
        })};
      });
      return {id:id, t:x.t, gel:x.gel, boxes:boxes, totals:totals};
    });
    if (recipes.length) blocks.push({start:b, recipes:recipes});
  }
  return blocks;
}

/* Profil et dépense énergétique */
const PROFILE_DEFAULT = {mode:'auto', sexe:'h', age:35, taille:178, poids:72, neat:'assis', gras:null, repos:null, deficit:15, ravito:60, shaker:'oui', shakerKcal:120, shakerProt:24, kcalPetite:null, kcalMoyenne:null, kcalLongueH:null, marge:150, prot:2, off:[], semaine:{jours:{}, libre:6}};
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
  if (o.semaine && typeof o.semaine === 'object'){ const w = cleanWeek(o.semaine); if (Object.keys(w.jours).length || w.libre !== 6) out.semaine = w; }
  return out;
}
/* Profil complet. Enregistré avant la 1.3.0 (sans mode) : manuel s'il contient une dépense valide, sinon automatique. */
function cleanProfile(o){
  const f = profileFields(o);
  if (!f.mode) f.mode = has(f, 'repos') ? 'manuel' : 'auto';
  const out = Object.assign({}, PROFILE_DEFAULT, f);
  out.off = (f.off || []).slice();
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
/* Le déficit est un % de la dépense d'un jour sans sport, retiré chaque jour : les séances restent couvertes */
function energy(plan, p){
  const rest = restNeed(p), cost = dayCost(plan, p), deficit = rest * p.deficit / 100;
  return {bmr:bmr(p), rest:rest, mode:p.mode, restSource:restSource(p), cost:cost, need:rest + cost, deficit:deficit,
    target:Math.round((rest + cost - deficit) / 10) * 10, kgWeek:deficit * 7 / KCAL_PER_KG};
}

function dureeLabel(d){ const x = DUREES.find(function(a){ return a[0] === d; }); return x ? x[1] : DUREES[1][1]; }

/* Petit-déjeuner : menu de sortie longue si longue ; banane dès qu'il y a une séance moyenne ou longue */
function breakfast(long, banane, base, k, kp){
  const items = [];
  /* Salé : pain complet, œufs et une tranche de jambon (portions fixes comme les œufs), sans skyr ni amandes.
     Les jours de sortie longue, version sucrée au pain (plus digeste 1h30 avant de partir). */
  if (base === 'sale' && !long){
    const g = sc(80, 10, k), n = pieces(2, k), j = sc(45, 5, k);
    items.push(it('base', grams(g), 'pain complet', slices(g, 40), mac('pain', g)));
    items.push(it('oeufs', String(n), n > 1 ? 'œufs' : 'œuf', n > 1 ? 'à la coque, pochés ou brouillés sans matière grasse' : 'à la coque, poché ou brouillé sans matière grasse', unitMac('oeuf', n)));
    items.push(it('jambon', grams(j), 'jambon blanc', slices(j, 45), mac('jambon', j)));
    if (banane) items.push(it('fruit', '1', 'banane', null, unitMac('banane', 1)));
    else items.push(it('fruit', grams(125), 'fruits rouges', 'surgelés, c’est parfait', mac('fruitsRouges', 125)));
    return items;
  }
  if (base === 'pain' || base === 'sale'){
    const g = sc(long ? 110 : 80, 10, k);
    items.push(it('base', grams(g), 'pain complet', slices(g, 40) + (base === 'sale' ? ', en version sucrée avant la sortie longue (plus digeste)' : ''), mac('pain', g)));
  } else {
    const g = sc(long ? 80 : 60, 5, k);
    items.push(it('base', grams(g), 'flocons d’avoine ou muesli', 'muesli sans sucre ajouté. En porridge, ou trempés la veille dans le skyr', mac('avoine', g)));
  }
  const sk = Math.max(SKYR_MIN, sc(long ? 150 : 250, 10, kp));
  items.push(adj(it('skyr', grams(sk), 'skyr nature', null, mac('skyr', sk))));
  if (long || banane){
    items.push(it('fruit', '1', 'banane', null, unitMac('banane', 1)));
  } else {
    items.push(it('fruit', grams(125), 'fruits rouges', 'surgelés, c’est parfait', mac('fruitsRouges', 125)));
  }
  if (long){ const mi = sc(15, 5, k); items.push(it('miel', grams(mi), 'miel', null, mac('miel', mi))); }
  const am = sc(15, 5, k);
  items.push(it('am', grams(am), 'amandes', null, mac('amandes', am)));
  return items;
}
/* Collation : œufs, + banane s'il y a une séance, + compote s'il y a une moyenne ou une longue */
/* Déjà des œufs dans la journée (petit-déjeuner salé, « Œufs + jambon ») : skyr et amandes à la place, presque la même
   chose (2 œufs : 144 kcal, 12,6 g de protéines, 9,6 g de lipides ; 100 g de skyr et 15 g d'amandes : 151, 14, 7,9) */
function snackItems(seance, grosse, k, oeufs){
  const n = pieces(2, k), items = [];
  if (oeufs){
    const sk = Math.max(SKYR_MIN, sc(100, 10, k)), am = sc(15, 5, k);
    items.push(it('csk', grams(sk), 'skyr nature', 'à la place des œufs, déjà au menu aujourd’hui', mac('skyr', sk)));
    items.push(it('cam', grams(am), 'amandes', null, mac('amandes', am)));
  } else items.push(it('oe', String(n), n > 1 ? 'œufs' : 'œuf', n > 1 ? 'durs ou mollets, préparés à l’avance' : 'dur ou mollet, préparé à l’avance', unitMac('oeuf', n)));
  if (seance) items.push(it('ban', '1', 'banane', null, unitMac('banane', 1)));
  if (grosse) items.push(it('comp', '1', 'compote', 'sans sucre ajouté', unitMac('compote', 1)));
  return items;
}
/* Shaker de protéines, une dose à l'eau : protéines saisies (au plus kcal / 4),
   le reste des kcal partagé à parts égales entre glucides et lipides */
function shakerMac(p){
  const prot = Math.min(p.shakerProt, p.shakerKcal / 4), rest = p.shakerKcal - 4 * prot;
  return {kcal:p.shakerKcal, p:prot, c:rest / 8, f:rest / 18};
}
function shakerItem(p){ return it('shk', '1', 'shaker de protéines', 'une dose, à l’eau', shakerMac(p), null, {id:'shaker', n:1}); }
function gouterItems(k, kp){
  const sk = Math.max(SKYR_MIN, sc(150, 10, kp)), am = sc(15, 5, k);
  return [
    adj(it('skyr', grams(sk), 'skyr nature', null, mac('skyr', sk))),
    it('pom', '1', 'pomme', null, unitMac('pomme', 1)),
    it('am', grams(am), 'amandes', null, mac('amandes', am))
  ];
}
/* Féculent de chaque repas : plancher en énergie (90 kcal à 72 kg, ≈ 20 g de glucides) et plafond en grammes, une
   portion sportive (cap de STARCH, à 72 kg : 120 g de grains crus, 100 g de lentilles, 400 g de pommes de terre ou de
   patate douce, 300 g de gnocchis) ; les deux × k. Au-delà, un budget d'encas (voir composeDay). */
const STARCH_MIN = 90;
function starchCap(id, k){ const S = STARCH[id]; return S.cap * k * S.f[0] / 100; }
/* Lipides à 72 kg, mis à l'échelle k : plancher 55 g (≈ 0,76 g/kg), plafond 95 g */
const FAT_MIN = 55, FAT_MAX = 95;
/* Protéines : objectif = g/kg du profil × poids (borné comme les portions, 47 à 101 kg), à ±10 % sur la journée.
   Les portions de viande, poisson, œufs (déjeuner, dîner) et le skyr (petit-déjeuner, goûter) sont multipliées par un
   facteur pf, borné à 0,5-1,5, qui reste le plus près possible de 1 (le menu de référence) : il ne bouge que si la
   journée sort de la fourchette, et juste assez pour y rentrer. */
const PROT_BAND = 0.1, PF_MIN = 0.5, PF_MAX = 1.5;
/* Skyr du petit-déjeuner et du goûter : jamais moins d'un petit pot */
const SKYR_MIN = 100;
function protTarget(p){ return p.prot * REF_KG * scaleOf(p); }
function adj(item){ item.adj = true; return item; }
/* Féculent dosé en calories : changer de féculent ne change pas le total de la journée */
function starchItem(id, kcal){
  const S = STARCH[id];
  const q = Math.max(S.step, Math.round(kcal / (S.f[0] / 100) / S.step) * S.step);
  const k = q / 100;
  return it('st', grams(q), S.name, null, {kcal:S.f[0]*k, p:S.f[1]*k, c:S.f[2]*k, f:S.f[3]*k},
    S.cook ? {raw:S.raw, ways:S.cook.map(function(w){ return {g:Math.round(q * w[0] / 10) * 10, adj:w[1]}; })} : null, {id:id, g:q});
}
/* Partage l'énergie des féculents entre déjeuner et dîner, entre plancher et plafond (caps : kcal du plafond de chaque repas).
   off : kcal du dessert de chaque repas, prises sur le féculent du même repas (l'autre compense s'il touche une limite).
   rest > 0 : les deux sont au plafond ; rest < 0 : les deux sont au plancher. */
function splitStarch(budget, share, k, off, caps){
  const o = off || {dej:0, diner:0};
  const lo = STARCH_MIN * k;
  const clampA = function(x){ return Math.min(Math.max(lo, caps.dej), Math.max(lo, x)); };
  const clampB = function(x){ return Math.min(Math.max(lo, caps.diner), Math.max(lo, x)); };
  const avail = budget - o.dej - o.diner;
  let ka = clampA(budget * share - o.dej);
  const kb = clampB(avail - ka);
  ka = clampA(avail - kb);
  return {dej:ka, diner:kb, rest:avail - ka - kb};
}
function dessertOf(choice){ return choice && has(DESSERT, choice.dessert) ? choice.dessert : 'aucun'; }
/* Repas : protéine, féculent (dosé ensuite), légumes ou ceux de la recette choisie (avec sa matière grasse et ses ajouts),
   puis l'ajout du soir (amandes, parmesan), avec la note de la recette s'il y en a une */
function mainItems(slot, choice, k, kp){
  const P = PROT[choice.prot], rec = recipeOf(choice), extra = P[slot](k);
  if (rec && RECIPES[rec].soir) extra.forEach(function(i){ i.note = RECIPES[rec].soir; });
  return P.base(P.fixe ? k : kp).map(function(i){ return P.fixe ? i : adj(i); }).concat([it('st', '', '', null, null)],
    rec ? recipeItems(rec) : [it('leg', grams(250), 'légumes', 'minimum, à volonté', mac('legumes', 250))], extra);
}
function setStarch(sec, item){ sec.items = sec.items.map(function(i){ return i.key === 'st' ? item : i; }); }
function allItems(secs){ return secs.reduce(function(a, s){ return a.concat(s.items); }, []); }
function fuel(d, rate){
  const g = Math.round(rate * d / 5) * 5;
  return it('fuel', grams(g), 'glucides pendant l’effort', rate + NB + 'g par heure' + NB + ': boisson d’effort, gels ou pâtes de fruits', {kcal:g * 4, p:0, c:g, f:0}, null, {id:'ravito', g:g});
}

/* Construit la journée pour un facteur de protéines pf donné (voir buildDay) */
function composeDay(plan, ch, pr, pf){
  const en = energy(plan, pr);
  const S = plan.seances.slice().sort(function(a, b){ return MOMENT_RANK[a.moment] - MOMENT_RANK[b.moment]; });
  const at = function(m){ return S.filter(function(x){ return x.moment === m; }); };
  const matin = at('matin'), midi = at('midi'), soir = at('soir');
  const long = S.some(function(x){ return x.taille === 'longue'; });
  const grosse = S.some(function(x){ return x.taille !== 'petite'; });
  const last = S.length ? S[S.length - 1].moment : null;
  const k = scaleOf(pr), kp = k * pf, shaker = pr.shaker === 'oui', protFloor = (1 - PROT_BAND) * protTarget(pr);
  /* Œufs déjà au menu (petit-déjeuner salé hors sortie longue, « Œufs + jambon » midi ou soir) : pas d'œufs à la collation */
  const oeufs = (ch.pdBase === 'sale' && !long) || ch.dej.prot === 'oeufs' || ch.diner.prot === 'oeufs';
  const secs = [];

  const pd = {id:'pd', title:'Petit-déjeuner', when:null, pick:'pd', items:breakfast(long, grosse, ch.pdBase, k, kp)};
  if (long) pd.when = '1h30 à 2' + NB + 'h avant la sortie';
  else if (matin.length) pd.when = '1h30 avant la séance';
  secs.push(pd);

  /* recipe : la recette choisie ; suggest : celle proposée pour la protéine et le féculent du repas */
  const meal = function(slot, title){
    const c = ch[slot];
    return {id:slot, title:title, when:null, pick:slot, items:mainItems(slot, c, k, kp), recipe:recipeOf(c), suggest:recipesFor(c.prot, c.starch)[0] || null};
  };
  const lunch = meal('dej', 'Déjeuner'), dinner = meal('diner', 'Dîner');
  let co = null, nb = 0;
  /* Marge cuisine : kcal réservées pour la matière grasse de cuisson et les ajouts, moitié au déjeuner, moitié au dîner,
     comptées en lipides (l'huile de cuisson en est l'essentiel). Un repas avec une recette choisie a sa propre matière grasse. */
  const margeDej = Math.round(pr.marge / 2 / 5) * 5;
  [[lunch, margeDej], [dinner, pr.marge - margeDej]].forEach(function(x){
    if (x[1] > 0 && !x[0].recipe) x[0].items.push(it('marge', '≈' + NB + x[1], 'kcal pour la cuisine', 'huile de cuisson, sauce, fromage râpé… (les épices ne comptent pas)', {kcal:x[1], p:0, c:0, f:x[1] / 9}, null, {id:'marge', kcal:x[1]}));
  });
  /* Dessert choisi, en fin de repas */
  [[lunch, ch.dej], [dinner, ch.diner]].forEach(function(x){
    const d = dessertOf(x[1]);
    if (d !== 'aucun') x[0].items.push(DESSERT[d].item());
  });

  /* Un bandeau par séance, à son moment */
  const bands = function(list){
    list.forEach(function(x){
      const b = {band:true, id:'band' + (nb++), title:SIZES[x.taille].band, sub:null, items:[]};
      if (x.taille === 'longue'){ b.sub = 'Vélo ou course, ' + dureeLabel(x.duree) + '.'; b.items = [fuel(x.duree, pr.ravito)]; }
      secs.push(b);
    });
  };
  /* Shaker (s'il est pris) juste après la dernière séance du jour ; sans séance, dans la collation de l'après-midi */
  const shakerSec = function(when){ if (shaker) secs.push({id:'shk', title:'Shaker', when:when, items:[shakerItem(pr)]}); };

  if (matin.length){
    bands(matin);
    if (!long && !soir.length){
      co = {id:'co', title:'Collation', when:'juste après la séance', items:snackItems(true, grosse, k, oeufs)};
      if (last === 'matin' && shaker) co.items.push(shakerItem(pr));
      secs.push(co);
    } else if (last === 'matin'){
      shakerSec(long ? 'juste après la sortie' : 'juste après la séance');
    }
  }
  if (midi.length){
    secs.push({id:'sw', title:'Avant la séance', when:'vers 11' + NB + 'h' + NB + '30', items:[it('ban', '1', 'banane', null, unitMac('banane', 1))]});
    bands(midi);
    if (last === 'midi') shakerSec('juste après la séance');
    lunch.when = 'après la séance';
    if (dessertOf(ch.dej) === 'aucun') lunch.items.push(it('comp', '1', 'compote', 'sans sucre ajouté, en dessert', unitMac('compote', 1)));
  } else if (long){
    lunch.when = 'après la sortie';
  }
  secs.push(lunch);
  if (!co){
    if (long) co = {id:'co', title:'Goûter', when:null, items:gouterItems(k, kp)};
    else if (soir.length) co = {id:'co', title:'Collation', when:'1h30 avant la séance', items:snackItems(true, grosse, k, oeufs)};
    else co = {id:'co', title:'Collation', when:'dans l’après-midi', items:snackItems(S.length > 0, grosse, k, oeufs)};
    if (!S.length && shaker) co.items.push(shakerItem(pr));
    secs.push(co);
  }
  if (soir.length){
    bands(soir);
    shakerSec('juste après la séance');
    dinner.when = 'après la séance';
  }
  secs.push(dinner);

  /* Les féculents complètent jusqu'à l'objectif, répartis selon les séances qui précèdent chaque repas.
     Au-delà de leur plafond (une portion sportive), le reste devient un budget d'encas dans la collation (ou le goûter),
     compté en glucides. */
  const before = matin.concat(midi).reduce(function(a, x){ return a + seanceCost(x, pr); }, 0);
  const after = soir.reduce(function(a, x){ return a + seanceCost(x, pr); }, 0);
  const wDej = 45 + 0.05 * before, wDiner = 30 + 0.02 * before + 0.07 * after;
  const fill = function(){
    co.items = co.items.filter(function(i){ return i.key !== 'encas'; });
    const fixed = total(allItems(secs).filter(function(i){ return i.key !== 'st' && i.key !== 'des'; })).kcal;
    const des = function(sec){ return total(sec.items.filter(function(i){ return i.key === 'des'; })).kcal; };
    const sp = splitStarch(en.target - fixed, wDej / (wDej + wDiner), k, {dej:des(lunch), diner:des(dinner)},
      {dej:starchCap(ch.dej.starch, k), diner:starchCap(ch.diner.starch, k)});
    setStarch(lunch, starchItem(ch.dej.starch, sp.dej));
    setStarch(dinner, starchItem(ch.diner.starch, sp.diner));
    if (sp.rest >= 30){
      const kc = Math.round(sp.rest / 10) * 10;
      co.items.push(it('encas', '≈' + NB + fmtInt(kc), 'kcal d’encas', 'pour tes séances, à répartir autour d’elles si c’est beaucoup' + NB + ': pain complet et miel, fruits secs, riz au lait, barre de céréales', {kcal:kc, p:0, c:kc / 4, f:0}, null, {id:'encas', kcal:kc}));
    }
  };
  fill();
  let tot = total(allItems(secs));
  /* Planchers, revérifiés ensemble car chaque ajout réajuste les féculents (qui portent un peu de protéines et de lipides).
     Aussi le jour du repas libre : la journée est d'abord celle d'un jour normal, puis seul le dîner est remplacé.
     - protéines (objectif hors d'atteinte des portions, thon deux fois…) : skyr le soir, 150 g × k, un peu plus si besoin (jusqu'au double) ;
     - lipides (peu ou pas de marge cuisine, petites portions) : de l'huile en plus au dîner. */
  let skyr = 0, gras = 0, soirSec = null;
  const skyrMax = sc(300, 10, k);
  for (let pass = 0; pass < 12; pass++){
    const lowP = tot.p < protFloor && skyr < skyrMax, lowF = tot.f < FAT_MIN * k && gras < 60;
    if (!lowP && !lowF) break;
    /* Protéines d'abord : le skyr réajuste les féculents et apporte un peu de lipides, l'huile est revue au passage suivant */
    if (lowP){
      skyr = skyr ? Math.min(skyrMax, skyr + Math.max(10, Math.ceil((protFloor - tot.p) / 0.105 / 10) * 10)) : sc(150, 10, k);
      const item = it('skyr', grams(skyr), 'skyr nature', null, mac('skyr', skyr));
      if (soirSec) soirSec.items = [item];
      else { soirSec = {id:'soir', title:'Soir', when:'pour compléter tes protéines', items:[item]}; secs.push(soirSec); }
    }
    else {
      gras += Math.ceil((FAT_MIN * k - tot.f + 0.5) / 5) * 5;
      dinner.items = dinner.items.filter(function(i){ return i.key !== 'gras'; });
      dinner.items.push(it('gras', grams(gras), 'huile d’olive', 'en plus, pour tes lipides', mac('huile', gras)));
    }
    fill();
    tot = total(allItems(secs));
  }
  const ecart = tot.kcal - en.target;

  /* Repas libre : remplace le dîner du jour normal et son skyr du soir s'il y en a un (budget = les deux + 300 × k) */
  let libre = null;
  if (plan.libre){
    const soirKcal = soirSec ? total(soirSec.items).kcal : 0;
    if (soirSec) secs.splice(secs.indexOf(soirSec), 1);
    libre = Math.round((total(dinner.items).kcal + soirKcal + 300 * k) / 50) * 50;
    secs[secs.indexOf(dinner)] = {id:'diner', title:'Repas libre', when:(dinner.when ? dinner.when + ', ' : '') + 'resto ou entre amis', libre:true,
      items:[it('lib', fmtInt(libre), 'kcal environ', 'de quoi te faire plaisir, sans peser', {kcal:libre, p:0, c:0, f:0}, null, {id:'libre', n:1, kcal:libre})]};
    tot = total(allItems(secs));
  }
  const adjP = total(allItems(secs).filter(function(i){ return i.adj; })).p, soirP = soirSec && !plan.libre ? total(soirSec.items).p : 0;
  return {secs:secs, tot:tot, libre:libre, energy:en, ecart:ecart, scale:k, adjP:adjP, soirP:soirP};
}
/* Journée complète. Le facteur de protéines pf part de 1 (menu de référence) et ne bouge que si les protéines de la journée
   sortent de la fourchette objectif ± 10 % : il vise alors juste à l'intérieur (à 2 % du bord, pour absorber les arrondis).
   Quelques passes, car les féculents réajustés portent aussi des protéines. Le jour du repas libre, pf est cherché sur
   la même journée sans repas libre (le repas libre n'a pas de macros connues). */
function buildDay(plan, ch, profile){
  const pr = cleanProfile(profile), T = protTarget(pr), lo = (1 - PROT_BAND) * T, hi = (1 + PROT_BAND) * T;
  const base = plan.libre ? Object.assign({}, plan, {libre:false}) : plan;
  let pf = 1, r = composeDay(base, ch, pr, pf);
  for (let pass = 0; pass < 5; pass++){
    const P = r.tot.p - r.soirP, adj1 = r.adjP / pf;
    if (P >= lo && P <= hi) break;
    /* Rien d'ajustable (thon midi et soir, petit-déjeuner salé) : la journée ne dépend pas de pf, comptée en butée */
    if (adj1 <= 0){ pf = P > hi ? PF_MIN : PF_MAX; break; }
    const aim = P > hi ? hi - 0.02 * T : lo + 0.02 * T;
    const next = Math.min(PF_MAX, Math.max(PF_MIN, (aim - (P - r.adjP)) / adj1));
    /* Presque rien à gagner : on s'arrête, sauf pour atteindre la borne (une pièce d'œuf peut en dépendre) */
    if (next === pf || (Math.abs(next - pf) < 0.01 && next > PF_MIN && next < PF_MAX)) break;
    pf = next;
    r = composeDay(base, ch, pr, pf);
  }
  if (plan.libre) r = composeDay(plan, ch, pr, pf);
  r.prot = {target:T, low:lo, high:hi, floor:lo, factor:pf};
  delete r.adjP; delete r.soirP;
  return r;
}

/* Liste de courses : les achats (buy) de plusieurs journées construites par buildDay, additionnés et rangés par rayon.
   Poids crus, pièces entières, budgets en kcal.
   Renvoie [{title, lines:[{id, qty, name, note}]}], rayons et lignes vides omis. */
const SHOP_AISLES = [
  {title:'Viandes et poissons', ids:['poulet', 'boeuf', 'poisson', 'saumon', 'crevettes', 'jambon']},
  {title:'Crèmerie, œufs et tofu', ids:['skyr', 'oeufs', 'halloumi', 'parmesan', 'creme', 'lait', 'tofu']},
  {title:'Pain et féculents, poids crus', ids:['pain'].concat(STARCH_ORDER)},
  {title:'Fruits et légumes', ids:['legumes'].concat(VEG_IDS.filter(function(v){ return v !== 'pulpe'; }), ['fruitsRouges', 'banane', 'pomme', 'fruit'])},
  {title:'Épicerie', ids:['avoine', 'amandes', 'miel', 'fruitsSecs', 'chocolat', 'thon', 'pulpe', 'compote', 'huile', 'coco', 'olives', 'sesame', 'tahini']},
  {title:'Le reste', ids:['shaker', 'ravito', 'encas', 'marge', 'libre']}
];
function shopQty(g){
  if (g < 1000) return grams(Math.round(g));
  return (Math.round(g / 10) / 100).toLocaleString('fr-FR') + NB + 'kg';
}
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
      shaker:['dose de shaker', 'doses de shaker', null]};
    if (has(PIECES, id)) return a.n ? {qty:String(a.n), name:pl(a.n, PIECES[id][0], PIECES[id][1]), note:PIECES[id][2]} : null;
    if (id === 'libre') return a.n ? {qty:String(a.n), name:pl(a.n, 'repas libre', 'repas libres'), note:kc(a.kcal) + ' au total'} : null;
    if (id === 'encas') return a.kcal ? {qty:kc(a.kcal), name:'d’encas', note:'pain complet et miel, fruits secs, riz au lait, barre de céréales'} : null;
    if (id === 'marge') return a.kcal ? {qty:kc(a.kcal), name:'pour la cuisine', note:'environ ' + grams(Math.round(a.kcal / 9 / 5) * 5) + ' d’huile'} : null;
    if (!a.g) return null;
    if (id === 'ravito') return {qty:shopQty(a.g), name:'de glucides pour l’effort', note:'boisson d’effort, gels ou pâtes de fruits'};
    const NAMES = {poulet:'viande blanche maigre', boeuf:'bœuf haché 5' + NB + '%', poisson:'poisson blanc', saumon:'poisson gras', crevettes:'crevettes cuites',
      jambon:'jambon blanc', skyr:'skyr nature', halloumi:'halloumi', parmesan:'parmesan', tofu:'tofu ferme', pain:'pain complet', legumes:'légumes verts',
      fruitsRouges:'fruits rouges', avoine:'flocons d’avoine ou muesli', amandes:'amandes', miel:'miel', fruitsSecs:'fruits secs', chocolat:'chocolat noir', huile:'huile d’olive'};
    const NOTES = {poulet:'poulet, dinde ou filet mignon de porc', poisson:'cabillaud, colin…', saumon:'saumon, maquereau ou sardines à l’huile', tofu:'nature', avoine:'muesli sans sucre ajouté',
      jambon:slices(a.g, 45), pain:slices(a.g, 40), legumes:'au choix', fruitsRouges:'surgelés, c’est parfait', fruitsSecs:'abricots, pruneaux ou figues',
      chocolat:'70' + NB + '% ou plus'};
    return {qty:shopQty(a.g), name:has(STARCH, id) ? STARCH[id].name : has(NAMES, id) ? NAMES[id] : RFOOD[id][0],
      note:has(NOTES, id) ? NOTES[id] : has(RFOOD, id) ? RFOOD[id][1] : null};
  };
  return SHOP_AISLES.map(function(g){
    return {title:g.title, lines:g.ids.map(function(id){ const l = line(id); return l ? Object.assign({id:id}, l) : null; }).filter(Boolean)};
  }).filter(function(g){ return g.lines.length; });
}

