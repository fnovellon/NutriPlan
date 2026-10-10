/* Données : recettes (3.12.0), une par couple protéine × féculent, avec leurs légumes et matières grasses (RFOOD, VEG_IDS),
   et l'accès à la recette d'un repas (recipesFor, recipeOf, recipeItems). */
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
/* Oignon compté en unités (3.27.0) : un oignon moyen ≈ 100 g épluché, une échalote ≈ 25 g ; les recettes en mettent ½ (50 g)
   ou 1 (100 g). Quantité au demi le plus proche (« ½ », « 1 », « 1 ½ »), pluriel à partir de 2, et le poids en note (avec
   l'équivalent en échalotes jusqu'à un oignon). */
const ONION_G = 100;
function onionQty(g){ const h = Math.max(1, Math.round(g * 2 / ONION_G)), n = Math.floor(h / 2); return (n ? String(n) : '') + (h % 2 ? (n ? NB : '') + '½' : ''); }
function onionName(g){ return Math.round(g * 2 / ONION_G) >= 4 ? 'oignons' : 'oignon'; }
function onionNote(g){ const e = Math.round(g / 25); return '≈' + NB + grams(g) + (g <= ONION_G ? ', ou ' + e + NB + 'échalote' + (e > 1 ? 's' : '') : ''); }
const VEG_IDS = ['oignon', 'tomate', 'pulpe', 'poivron', 'courgette', 'champignon', 'epinards', 'brocoli', 'carotte', 'petitspois', 'haricotsverts',
  'concombre', 'aubergine', 'choufleur', 'chou', 'poireau', 'salade'];
/* Recettes (3.12.0) : une par couple protéine × féculent (deux depuis la 3.31.0, voir v), proposée sous le déjeuner et le dîner, choisie ou non.
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
  const add = function(id, p, s, t, min, box, leg, cuis, aro, plus, steps, soir){
    out[id] = {p:p, s:s, t:typo(t), min:min, box:!!box, gel:!leg.salade && !leg.concombre && !/^(Salade|Taboulé|Bowl|Poke)/.test(t), leg:leg, aro:typo(aro), plus:plus || {}, steps:steps.map(typo), soir:soir ? typo(soir) : null,
      cuis:cuis.map(function(c){ return [c[0], c[1], c[2], typo(c[3])]; })};
  };
  /* r : la première recette d'un couple (identifiant protéine-féculent) ; v (3.31.0) : une autre recette du même couple,
     identifiant protéine-féculent-suffixe */
  const r = function(p, s){ add.apply(null, [p + '-' + s].concat([].slice.call(arguments))); };
  const v = function(suf, p, s){ add.apply(null, [p + '-' + s + '-' + suf].concat([].slice.call(arguments, 1))); };
  /* Viande blanche (le soir : les amandes) */
  r('poulet', 'riz', 'Poulet au curry doux, riz basmati', 25, 1, {oignon:100, poivron:70, epinards:80}, [H1, COCO], 'ail, gingembre, curry, coriandre', {skyr:40}, [
    'Fais revenir l’oignon émincé, l’ail et le gingembre dans l’huile, puis le poulet en dés avec le curry.',
    'Ajoute le poivron en lanières, puis les épinards et le lait de coco ; laisse mijoter 8 min.',
    'Hors du feu, lie la sauce avec le skyr et sers sur le riz, avec la coriandre.'], 'effilées et grillées à sec, sur le curry');
  r('poulet', 'pates', 'Pâtes au poulet, tomates et basilic', 20, 1, {oignon:50, pulpe:150, courgette:50}, [H1, PARM], 'ail, basilic, origan, piment', null, [
    'Dore le poulet en lanières dans l’huile, puis réserve.',
    'Dans la même poêle, fais fondre l’oignon et l’ail, ajoute la courgette en dés, la pulpe et l’origan ; 10 min.',
    'Remets le poulet, mélange aux pâtes, parsème de parmesan et de basilic.'], 'concassées sur les pâtes, avec le parmesan');
  r('poulet', 'pdt', 'Poulet rôti, pommes de terre et oignons rouges', 45, 0, {oignon:100, haricotsverts:150}, [H2], 'thym, romarin, ail en chemise, paprika', null, [
    'Coupe les pommes de terre en quartiers et l’oignon rouge en pétales ; mélange avec l’huile, le thym et le paprika.',
    'Four à 200 °C : 20 min, puis ajoute le poulet assaisonné et l’ail en chemise, 20 min de plus.',
    'Cuis les haricots verts 8 min à la vapeur et sers tout ensemble.']);
  r('poulet', 'patate', 'Poulet au paprika, patate douce rôtie et brocolis', 35, 1, {brocoli:150, oignon:100}, [H2], 'paprika fumé, cumin, citron vert', null, [
    'Patate douce en cubes et oignon rouge en quartiers, avec l’huile et le paprika : four à 200 °C, 25 min.',
    'Ajoute les brocolis en fleurettes 10 min avant la fin.',
    'Poêle le poulet au cumin et finis d’un filet de citron vert.']);
  r('poulet', 'quinoa', 'Bowl poulet-quinoa aux légumes croquants', 25, 1, {concombre:70, carotte:70, poivron:60, oignon:50}, [H1, SES], 'sauce soja, gingembre, citron vert, coriandre', {miel:5}, [
    'Rince le quinoa et cuis-le 12 min, puis laisse tiédir.',
    'Fais mariner le poulet 10 min dans la sauce soja et le gingembre, puis saisis-le à la poêle.',
    'Monte le bowl : quinoa, légumes crus en bâtonnets, oignon nouveau, poulet ; sauce soja, citron vert et miel, sésame.']);
  r('poulet', 'semoule', 'Couscous au poulet et aux légumes', 40, 1, {carotte:70, courgette:100, oignon:50, pulpe:30}, [H2], 'ras-el-hanout, cumin, coriandre, harissa (au goût)', null, [
    'Fais revenir le poulet et l’oignon avec les épices dans l’huile.',
    'Ajoute carottes et courgettes en tronçons, la pulpe et un verre d’eau ; mijote 20 min.',
    'Verse la semoule dans le même volume d’eau bouillante salée, 5 min à couvert, égrène ; nappe de bouillon.']);
  r('poulet', 'boulgour', 'Taboulé de boulgour au poulet grillé', 25, 1, {tomate:100, concombre:80, oignon:50, poivron:20}, [H2], 'persil, menthe, citron, cumin', null, [
    'Cuis le boulgour 10 min, égoutte-le et laisse-le refroidir.',
    'Coupe tomates, concombre, oignon rouge et poivron en petits dés ; cisèle persil et menthe.',
    'Assaisonne huile et citron, et pose le poulet grillé en tranches sur le dessus.']);
  r('poulet', 'lentilles', 'Salade tiède de lentilles au poulet', 30, 1, {carotte:70, oignon:50, salade:130}, [H2], 'moutarde, vinaigre de cidre, thym, laurier', null, [
    'Cuis les lentilles 20 min avec la carotte en dés, le thym et le laurier.',
    'Prépare une vinaigrette moutarde-vinaigre-huile avec l’échalote ciselée.',
    'Mélange les lentilles tièdes à la vinaigrette, sers sur la salade avec le poulet poêlé en tranches.']);
  r('poulet', 'poischiches', 'Poulet et pois chiches façon tajine', 40, 1, {oignon:100, carotte:70, pulpe:80}, [H2], 'cumin, cannelle, curcuma, gingembre, coriandre', null, [
    'Dore le poulet et l’oignon dans l’huile avec les épices.',
    'Ajoute les carottes en rondelles, la pulpe, les pois chiches cuits et 15 cl d’eau ; 25 min à couvert.',
    'Parsème de coriandre et sers avec un quartier de citron.']);
  r('poulet', 'gnocchis', 'Gnocchis poêlés au poulet, épinards et champignons', 20, 0, {epinards:130, champignon:70, oignon:50}, [H1, CREME], 'ail, muscade, poivre', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais sauter le poulet, l’échalote et les champignons dans l’huile, puis les épinards jusqu’à ce qu’ils tombent.',
    'Ajoute la crème et la muscade, remets les gnocchis et mélange.']);
  /* Bœuf (le soir : le parmesan) */
  r('boeuf', 'riz', 'Chili de bœuf aux poivrons, riz', 30, 1, {oignon:100, poivron:70, pulpe:80}, [H2], 'ail, cumin, paprika, piment, origan', {skyr:40}, [
    'Fais revenir l’oignon et l’ail dans l’huile, ajoute le bœuf et laisse colorer.',
    'Ajoute les poivrons en dés, les épices et la pulpe ; mijote 15 min.',
    'Sers sur le riz avec une cuillère de skyr et de la coriandre.'], 'râpé sur le chili, comme un cheddar');
  r('boeuf', 'pates', 'Pâtes à la bolognaise', 35, 1, {oignon:50, carotte:50, pulpe:150}, [H2], 'ail, laurier, thym, basilic', null, [
    'Fais fondre l’oignon et la carotte hachés dans l’huile, 5 min.',
    'Ajoute le bœuf, colore-le, puis la pulpe, l’ail et les herbes ; 20 min à feu doux.',
    'Mélange la sauce aux pâtes.'], 'râpé sur les pâtes');
  r('boeuf', 'pdt', 'Hachis parmentier léger, salade', 45, 1, {oignon:100, carotte:60, salade:90}, [H1, LAIT], 'thym, muscade, persil', null, [
    'Cuis les pommes de terre 20 min à l’eau et écrase-les avec le lait et la muscade.',
    'Fais revenir le bœuf avec l’oignon et la carotte hachés dans l’huile, et le thym.',
    'Viande puis purée dans un plat, four à 200 °C 15 min ; salade à côté.'], 'râpé sur la purée avant d’enfourner');
  r('boeuf', 'patate', 'Hachis parmentier à la patate douce', 45, 1, {oignon:100, poivron:80, epinards:70}, [H1, LAIT], 'cumin, paprika fumé, ail', null, [
    'Cuis la patate douce à l’eau 15 min et écrase-la avec le lait.',
    'Fais revenir le bœuf, l’oignon et le poivron avec les épices dans l’huile, puis les épinards.',
    'Viande puis purée dans un plat, four à 200 °C 15 min.'], 'râpé sur la purée avant d’enfourner');
  r('boeuf', 'quinoa', 'Bowl bœuf épicé et quinoa, sauce citron-herbes', 25, 1, {tomate:90, concombre:60, oignon:50, salade:50}, [H2], 'paprika, cumin, ail, citron, coriandre', {skyr:40}, [
    'Cuis le quinoa 12 min.',
    'Saisis le bœuf avec l’ail, le paprika et le cumin dans la moitié de l’huile.',
    'Bowl : quinoa, salade, tomates, concombre, oignon rouge, bœuf ; sauce skyr-citron-coriandre et le reste d’huile.'], 'en copeaux sur le bowl');
  r('boeuf', 'semoule', 'Boulettes de bœuf à la tomate, semoule', 35, 1, {oignon:50, pulpe:130, courgette:70}, [H2], 'cumin, coriandre, menthe, ail', null, [
    'Mélange le bœuf avec la moitié de l’oignon râpé, l’ail et le cumin ; forme 8 boulettes.',
    'Saisis-les dans l’huile, ajoute le reste de l’oignon, la courgette en dés et la pulpe ; 15 min.',
    'Prépare la semoule à l’eau bouillante, 5 min à couvert, et sers avec la sauce.'], 'en copeaux sur les boulettes');
  r('boeuf', 'boulgour', 'Boulgour et boulettes façon kefta, sauce menthe', 35, 1, {oignon:50, tomate:100, concombre:100}, [H2], 'persil, menthe, cumin, cannelle', {skyr:50}, [
    'Mélange le bœuf, l’oignon râpé, le persil, le cumin et la cannelle ; forme des boulettes allongées.',
    'Fais-les dorer dans la moitié de l’huile ; cuis le boulgour 10 min.',
    'Sers avec une salade tomate-concombre au reste d’huile et une sauce skyr-menthe.'], 'râpé sur le boulgour chaud');
  r('boeuf', 'lentilles', 'Chili aux haricots rouges (ou aux lentilles)', 35, 1, {oignon:100, poivron:80, pulpe:70}, [H2], 'ail, cumin, paprika, piment, origan', null, [
    'Fais revenir l’oignon et l’ail dans l’huile, puis le bœuf.',
    'Ajoute le poivron, les épices, la pulpe et les haricots rouges cuits ; mijote 20 min.',
    'Sers chaud, avec de la coriandre si tu en as.'], 'râpé sur le chili, comme un cheddar');
  r('boeuf', 'poischiches', 'Bœuf épicé aux pois chiches et tomates', 30, 1, {oignon:50, pulpe:130, epinards:70}, [H2], 'ras-el-hanout, ail, cumin, coriandre', null, [
    'Fais revenir l’oignon et le bœuf dans l’huile avec les épices.',
    'Ajoute la pulpe et les pois chiches cuits ; mijote 15 min.',
    'Incorpore les épinards à la fin et laisse-les tomber.'], 'en copeaux sur le plat');
  r('boeuf', 'gnocchis', 'Gnocchis gratinés à la bolognaise', 35, 0, {oignon:50, carotte:40, pulpe:160}, [H2], 'ail, basilic, origan', null, [
    'Prépare la sauce : oignon et carotte hachés dans l’huile, puis le bœuf, la pulpe et les herbes ; 20 min.',
    'Cuis les gnocchis 2 min à l’eau bouillante.',
    'Mélange-les à la sauce dans un plat et passe sous le gril 5 min.'], 'râpé dessus avant de gratiner');
  /* Poisson blanc (le soir : les amandes) */
  r('poisson', 'riz', 'Poisson en papillote aux légumes, riz', 30, 0, {poireau:100, carotte:70, courgette:80}, [H1, CREME], 'citron, aneth, gingembre (au goût)', null, [
    'Taille le poireau, la carotte et la courgette en fine julienne.',
    'Pose le poisson sur les légumes dans du papier cuisson, avec l’huile, la crème, le citron et l’aneth ; ferme.',
    'Four à 200 °C, 15 min, et sers avec le riz.'], 'effilées et grillées, sur la papillote ouverte');
  r('poisson', 'pates', 'Pâtes au poisson, citron et persil', 20, 0, {courgette:100, tomate:100, oignon:50}, [H2], 'ail, zeste de citron, persil, piment', null, [
    'Fais sauter l’échalote, l’ail et la courgette en dés dans l’huile, puis les tomates cerises coupées en deux.',
    'Ajoute le poisson en gros morceaux, 5 min à couvert, sans trop remuer.',
    'Mélange aux pâtes avec le zeste de citron et le persil.'], 'grillées et concassées sur les pâtes');
  r('poisson', 'pdt', 'Poisson au four, pommes de terre vapeur, sauce yaourt-aneth', 30, 0, {haricotsverts:130, oignon:50, salade:70}, [H2], 'aneth, citron, ciboulette', {skyr:50}, [
    'Cuis les pommes de terre et les haricots verts à la vapeur, 20 et 8 min.',
    'Poisson au four à 200 °C, 12 min, arrosé d’huile et de citron.',
    'Sauce : skyr, aneth, ciboulette, échalote ciselée et citron.'], 'sur les haricots verts');
  r('poisson', 'patate', 'Poisson, purée de patate douce au gingembre', 30, 0, {epinards:130, oignon:50, poivron:70}, [H1, COCO], 'gingembre, citron vert, ciboulette', null, [
    'Cuis la patate douce à l’eau 15 min, écrase-la avec le lait de coco et le gingembre râpé.',
    'Fais revenir l’échalote et le poivron dans l’huile, puis les épinards.',
    'Poêle le poisson 3 min de chaque côté et finis au citron vert.'], 'grillées, sur la purée');
  r('poisson', 'quinoa', 'Poisson poêlé, quinoa aux herbes et légumes grillés', 30, 1, {courgette:90, poivron:80, oignon:50, tomate:30}, [H2], 'persil, coriandre, citron, ail', null, [
    'Cuis le quinoa 12 min.',
    'Fais griller courgette, poivron et oignon rouge en lamelles dans la moitié de l’huile.',
    'Poêle le poisson dans le reste ; mélange quinoa, légumes, tomates et herbes, citron.'], 'concassées dans le quinoa');
  r('poisson', 'semoule', 'Poisson à la chermoula, semoule', 35, 0, {tomate:70, poivron:80, oignon:100}, [H2], 'coriandre, cumin, paprika, ail, citron', null, [
    'Mixe coriandre, ail, cumin, paprika, citron et l’huile : c’est la chermoula. Enrobe le poisson.',
    'Dans un plat, tomates, poivron et oignon en lamelles, le poisson dessus : four à 200 °C, 20 min.',
    'Prépare la semoule à l’eau bouillante, 5 min à couvert.'], 'grillées, sur le poisson');
  r('poisson', 'boulgour', 'Poisson et boulgour aux légumes du soleil', 35, 1, {aubergine:80, courgette:70, tomate:50, oignon:50}, [H2], 'thym, ail, basilic', null, [
    'Fais revenir l’oignon, l’aubergine et la courgette en dés dans l’huile, 10 min, puis les tomates et le thym.',
    'Cuis le boulgour 10 min et mélange-le aux légumes.',
    'Pose le poisson dessus, couvre et laisse cuire 6 min à feu doux ; basilic.'], 'grillées, sur le plat');
  r('poisson', 'lentilles', 'Cabillaud sur lit de lentilles, sauce moutarde', 35, 0, {carotte:60, oignon:50, epinards:140}, [H1, CREME], 'thym, laurier, moutarde à l’ancienne, persil', null, [
    'Cuis les lentilles 20 min avec la carotte et l’oignon en dés, le thym et le laurier.',
    'Poêle le poisson dans l’huile, 3 min de chaque côté ; fais tomber les épinards dans la même poêle.',
    'Sauce : crème, moutarde à l’ancienne, persil, sur les lentilles et le poisson.'], 'effilées sur les lentilles');
  r('poisson', 'poischiches', 'Poisson au four, pois chiches au cumin et citron', 30, 1, {tomate:100, oignon:50, concombre:100}, [H2], 'cumin, citron, persil, paprika', {skyr:40}, [
    'Fais rôtir les pois chiches cuits avec la moitié de l’huile, le cumin et le paprika, four à 200 °C, 15 min.',
    'Ajoute le poisson dans le plat, 12 min de plus.',
    'Salade tomate-concombre-oignon rouge au reste d’huile ; sauce skyr-citron.'], 'grillées, sur les pois chiches');
  r('poisson', 'gnocchis', 'Gnocchis, poisson et sauce tomate aux olives', 25, 0, {pulpe:140, oignon:50, courgette:60}, [H1, OLIVE], 'ail, câpres, basilic, origan', null, [
    'Fais fondre l’oignon et l’ail dans l’huile, ajoute la courgette, la pulpe, les olives et les câpres ; 10 min.',
    'Pose le poisson dans la sauce, couvre, 8 min.',
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent et mélange-les à la sauce.'], 'concassées sur le plat');
  /* Poisson gras */
  r('saumon', 'riz', 'Poke bowl saumon, concombre et carotte', 20, 1, {concombre:80, carotte:70, chou:50, oignon:50}, [HSES, SES], 'sauce soja, gingembre, citron vert, vinaigre de riz', null, [
    'Cuis le riz et assaisonne-le d’un trait de vinaigre de riz ; laisse tiédir.',
    'Coupe le saumon en cubes (cru s’il est extra-frais, sinon saisi 1 min) et fais-le mariner soja-gingembre.',
    'Bowl : riz, concombre, carotte râpée, chou émincé, oignon nouveau, saumon ; huile et graines de sésame, citron vert.']);
  r('saumon', 'pates', 'Pâtes au saumon, citron et épinards', 20, 0, {epinards:130, oignon:50, courgette:70}, [H1, CREME], 'zeste de citron, aneth, poivre', null, [
    'Fais fondre l’échalote et la courgette en dés dans l’huile, puis les épinards.',
    'Ajoute le saumon en cubes et la crème, 4 min à feu doux. Avec du maquereau ou des sardines : émiette-les hors du feu.',
    'Mélange aux pâtes avec le zeste de citron et l’aneth.']);
  r('saumon', 'pdt', 'Saumon, pommes de terre et haricots verts, sauce moutarde-aneth', 30, 0, {haricotsverts:160, oignon:50, salade:40}, [H1], 'aneth, moutarde à l’ancienne, citron', {skyr:40}, [
    'Cuis les pommes de terre et les haricots verts à la vapeur.',
    'Saumon au four à 200 °C, 12 min, ou à la poêle dans l’huile.',
    'Sauce : skyr, moutarde à l’ancienne, aneth, échalote ciselée.']);
  r('saumon', 'patate', 'Saumon laqué soja-miel, patate douce rôtie et brocolis', 35, 1, {brocoli:140, oignon:50, poivron:60}, [H1, SES], 'sauce soja, gingembre, ail, citron vert', {miel:5}, [
    'Patate douce en cubes, oignon et poivron, avec l’huile : four à 200 °C, 25 min ; brocolis 10 min avant la fin.',
    'Laque : sauce soja, miel, gingembre et ail râpés.',
    'Badigeonne le saumon de laque, 12 min au four ; sésame et citron vert.']);
  r('saumon', 'quinoa', 'Bowl saumon-quinoa, concombre, roquette et sauce citron', 20, 1, {concombre:80, salade:60, tomate:60, oignon:50}, [H1], 'citron, aneth, ciboulette', {skyr:40}, [
    'Cuis le quinoa 12 min et laisse tiédir.',
    'Saisis le saumon, ou émiette du maquereau ou des sardines égouttés.',
    'Bowl : quinoa, roquette, concombre, tomates, oignon rouge, poisson ; sauce skyr-citron-aneth et l’huile.']);
  r('saumon', 'semoule', 'Saumon et semoule aux herbes, sauce tahini-citron', 25, 1, {tomate:80, concombre:80, oignon:50, poivron:40}, [TAHINI, H1], 'menthe, persil, citron, cumin', null, [
    'Prépare la semoule à l’eau bouillante avec le cumin, 5 min, égrène avec l’huile.',
    'Ajoute tomates, concombre, oignon et poivron en dés, menthe et persil.',
    'Saumon au four ou à la poêle, 10 min ; sauce tahini délayée au citron et à l’eau.']);
  r('saumon', 'boulgour', 'Salade de boulgour au saumon (ou sardines), herbes et câpres', 20, 1, {tomate:80, concombre:100, oignon:50, salade:20}, [H1], 'persil, menthe, citron, câpres', null, [
    'Cuis le boulgour 10 min et laisse-le refroidir.',
    'Ajoute tomates, concombre et oignon rouge en dés, herbes, câpres, huile et citron.',
    'Pose dessus le saumon cuit en morceaux, ou les sardines égouttées.']);
  r('saumon', 'lentilles', 'Saumon (ou maquereau) aux lentilles et poireaux', 35, 0, {poireau:140, carotte:60, oignon:50}, [H1, CREME], 'thym, laurier, moutarde, persil', null, [
    'Cuis les lentilles 20 min avec la carotte, l’oignon, le thym et le laurier.',
    'Fais fondre les poireaux émincés dans l’huile, 10 min, avec la crème et la moutarde.',
    'Poêle le saumon, ou réchauffe le maquereau, et sers sur les lentilles aux poireaux.']);
  r('saumon', 'poischiches', 'Maquereau ou saumon, salade de pois chiches aux herbes', 15, 1, {tomate:90, concombre:70, oignon:50, poivron:40}, [H1], 'persil, coriandre, cumin, citron', null, [
    'Rince les pois chiches cuits et mélange-les aux tomates, concombre, poivron et oignon rouge en dés.',
    'Assaisonne huile, citron et cumin ; ajoute les herbes.',
    'Ajoute le poisson émietté : saumon cuit, maquereau ou sardines égouttés.']);
  r('saumon', 'gnocchis', 'Gnocchis au saumon, épinards et citron', 20, 0, {epinards:150, oignon:50, champignon:50}, [H1, CREME], 'citron, aneth, ail', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais revenir l’ail, l’échalote et les champignons dans l’huile, puis les épinards.',
    'Ajoute le saumon en cubes et la crème, 4 min, remets les gnocchis ; citron et aneth.']);
  /* Crevettes + halloumi */
  r('crevettes', 'riz', 'Riz sauté aux crevettes, halloumi grillé', 20, 1, {poivron:80, petitspois:50, oignon:50, chou:70}, [H1], 'ail, gingembre, sauce soja, ciboule', null, [
    'Fais sauter l’oignon, le poivron, le chou et les petits pois dans l’huile, à feu vif.',
    'Ajoute le riz cuit (idéalement de la veille), l’ail, le gingembre, puis les crevettes et la sauce soja.',
    'Grille le halloumi en tranches à sec et pose-le dessus, avec la ciboule.']);
  r('crevettes', 'pates', 'Pâtes aux crevettes, tomates cerises et halloumi', 20, 0, {tomate:140, oignon:50, courgette:60}, [H1], 'ail, piment, basilic, citron', null, [
    'Fais revenir l’oignon, l’ail et le piment dans l’huile, puis la courgette et les tomates cerises coupées.',
    'Ajoute les crevettes, 2 min.',
    'Mélange aux pâtes ; halloumi grillé en dés, basilic et citron.']);
  r('crevettes', 'pdt', 'Salade tiède de pommes de terre, crevettes et halloumi', 30, 1, {salade:60, concombre:80, oignon:50, tomate:60}, [H1], 'aneth, citron, ciboulette, moutarde', {skyr:40}, [
    'Cuis les pommes de terre à l’eau, 20 min, et coupe-les tièdes.',
    'Sauce : skyr, moutarde, citron, aneth et ciboulette.',
    'Mélange avec la salade, le concombre, les tomates, l’oignon rouge, les crevettes et le halloumi grillé.']);
  r('crevettes', 'patate', 'Bowl patate douce, crevettes et halloumi au paprika', 35, 1, {epinards:70, poivron:80, oignon:50, concombre:50}, [H1], 'paprika fumé, citron vert, coriandre, piment', null, [
    'Patate douce en cubes avec l’huile et le paprika, four à 200 °C, 25 min.',
    'Saisis les crevettes et le halloumi en dés à la poêle.',
    'Bowl : pousses d’épinards, poivron, concombre, oignon rouge, patate douce, crevettes, halloumi ; citron vert et coriandre.']);
  r('crevettes', 'quinoa', 'Bowl crevettes-halloumi-quinoa et légumes rôtis', 35, 1, {courgette:90, poivron:80, oignon:50, tomate:30}, [H1], 'origan, citron, ail', null, [
    'Fais rôtir courgette, poivron et oignon en morceaux avec l’huile et l’origan, four à 200 °C, 20 min.',
    'Cuis le quinoa 12 min.',
    'Saisis crevettes et halloumi ; assemble avec les tomates, l’ail et le citron.']);
  r('crevettes', 'semoule', 'Semoule aux légumes rôtis, crevettes et halloumi', 35, 1, {aubergine:70, courgette:80, poivron:50, oignon:50}, [H1], 'ras-el-hanout, menthe, citron', null, [
    'Fais rôtir aubergine, courgette, poivron et oignon avec l’huile et le ras-el-hanout, four à 200 °C, 25 min.',
    'Prépare la semoule à l’eau bouillante, 5 min à couvert.',
    'Saisis crevettes et halloumi ; mélange tout avec la menthe et le citron.']);
  r('crevettes', 'boulgour', 'Salade de boulgour, crevettes et halloumi grillé', 25, 1, {tomate:80, concombre:80, oignon:50, salade:40}, [H1], 'menthe, persil, citron, sumac (au goût)', null, [
    'Cuis le boulgour 10 min et laisse-le refroidir.',
    'Ajoute tomates, concombre, oignon rouge, salade, herbes, huile et citron.',
    'Pose dessus les crevettes et le halloumi grillé en tranches.']);
  r('crevettes', 'lentilles', 'Salade de lentilles, crevettes et halloumi au cumin', 30, 1, {carotte:50, salade:80, tomate:70, oignon:50}, [H1], 'citron, cumin, coriandre, moutarde', null, [
    'Cuis les lentilles 20 min et laisse-les tiédir.',
    'Vinaigrette : huile, citron, cumin, moutarde ; carotte râpée, tomates, oignon rouge.',
    'Sers sur la salade avec les crevettes et le halloumi grillé.']);
  r('crevettes', 'poischiches', 'Crevettes, halloumi et pois chiches rôtis', 30, 1, {poivron:80, oignon:50, tomate:70, epinards:50}, [H1], 'paprika fumé, cumin, ail, citron', null, [
    'Fais rôtir les pois chiches cuits, le poivron et l’oignon avec l’huile et les épices, four à 200 °C, 20 min.',
    'Ajoute les tomates et le halloumi en dés, 5 min de plus.',
    'Saisis les crevettes à l’ail ; sers sur les pousses d’épinards, avec le citron.']);
  r('crevettes', 'gnocchis', 'Gnocchis poêlés aux crevettes et courgettes', 20, 0, {courgette:130, tomate:70, oignon:50}, [H1], 'ail, citron, basilic, piment', null, [
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
  r('oeufs', 'pdt', 'Tortilla aux pommes de terre et oignons', 35, 1, {oignon:100, poivron:70, salade:80}, [H2], 'paprika, persil', null, [
    'Fais cuire les pommes de terre en fines rondelles avec l’oignon et le poivron dans l’huile, 20 min à couvert.',
    'Mélange aux œufs battus et au jambon en dés.',
    'Cuis à feu doux 8 min, retourne à l’aide d’une assiette, 3 min ; salade à côté.']);
  r('oeufs', 'patate', 'Omelette, patate douce rôtie et poivrons', 35, 1, {poivron:100, oignon:50, epinards:100}, [H2], 'paprika fumé, cumin, ciboulette', null, [
    'Patate douce en cubes, poivron et oignon, avec l’huile et le paprika : four à 200 °C, 25 min.',
    'Fais tomber les épinards dans une poêle, verse les œufs battus et le jambon, cuis en omelette.',
    'Sers l’omelette avec les légumes rôtis et la ciboulette.']);
  r('oeufs', 'quinoa', 'Quinoa sauté aux œufs, jambon et légumes', 25, 1, {courgette:90, carotte:60, petitspois:50, oignon:50}, [H1], 'sauce soja, ail, ciboule', null, [
    'Cuis le quinoa 12 min.',
    'Fais sauter oignon, carotte, courgette et petits pois dans l’huile, puis brouille les œufs à côté.',
    'Ajoute le quinoa et le jambon en dés, la sauce soja et la ciboule.']);
  r('oeufs', 'semoule', 'Shakshuka et semoule', 30, 0, {pulpe:130, poivron:70, oignon:50}, [H2], 'cumin, paprika, ail, coriandre, piment', null, [
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
  r('oeufs', 'gnocchis', 'Gnocchis poêlés au jambon, œuf et champignons', 20, 0, {champignon:100, epinards:100, oignon:50}, [H1, PARM], 'ail, persil, poivre', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais sauter l’échalote, l’ail et les champignons dans l’huile, puis les épinards et le jambon.',
    'Remets les gnocchis, ajoute les œufs au plat ou pochés dessus ; parmesan et persil.']);
  /* Thon */
  r('thon', 'riz', 'Salade de riz au thon', 15, 1, {tomate:80, poivron:60, concombre:60, oignon:50}, [H2], 'moutarde, vinaigre, persil, câpres', null, [
    'Cuis le riz et laisse-le refroidir.',
    'Coupe tomates, poivron, concombre et oignon en dés.',
    'Mélange avec le thon émietté, l’œuf dur en quartiers, la vinaigrette moutarde et les câpres.']);
  r('thon', 'pates', 'Pâtes au thon, tomates et olives', 20, 1, {pulpe:150, oignon:50, courgette:50}, [H1, OLIVE], 'ail, câpres, origan, basilic', null, [
    'Fais fondre l’oignon et l’ail dans l’huile, ajoute la courgette, la pulpe, les olives et les câpres ; 10 min.',
    'Ajoute le thon égoutté hors du feu.',
    'Mélange aux pâtes, l’œuf dur en quartiers dessus, basilic.']);
  r('thon', 'pdt', 'Salade niçoise', 25, 1, {tomate:80, haricotsverts:80, salade:40, oignon:50}, [H1, OLIVE], 'basilic, moutarde, vinaigre, anchois (au goût)', null, [
    'Cuis les pommes de terre à l’eau et les haricots verts 8 min ; laisse refroidir.',
    'Dispose salade, tomates, oignon, haricots, pommes de terre, thon, œuf dur et olives.',
    'Arrose de vinaigrette moutarde-vinaigre-huile ; basilic.']);
  r('thon', 'patate', 'Salade de patate douce au thon, citron vert', 30, 1, {salade:70, poivron:70, oignon:50, concombre:60}, [H2], 'citron vert, coriandre, paprika', null, [
    'Patate douce en cubes au paprika, four à 200 °C, 25 min, ou à la vapeur.',
    'Mélange salade, poivron, concombre et oignon rouge avec l’huile et le citron vert.',
    'Ajoute la patate douce tiède, le thon, l’œuf dur et la coriandre.']);
  r('thon', 'quinoa', 'Salade quinoa-thon aux herbes', 20, 1, {tomate:70, concombre:80, poivron:50, oignon:50}, [H2], 'citron, persil, menthe', null, [
    'Cuis le quinoa 12 min et laisse refroidir.',
    'Ajoute tomates, concombre, poivron et oignon en dés, les herbes, l’huile et le citron.',
    'Thon émietté et œuf dur sur le dessus.']);
  r('thon', 'semoule', 'Taboulé au thon', 15, 1, {tomate:110, concombre:90, oignon:50}, [H2], 'menthe, persil, citron', null, [
    'Verse la semoule dans le même volume d’eau bouillante, 5 min à couvert, égrène et laisse refroidir.',
    'Ajoute tomates, concombre et oignon en petits dés, beaucoup d’herbes, l’huile et le citron.',
    'Thon émietté et œuf dur en quartiers.']);
  r('thon', 'boulgour', 'Boulgour au thon façon pilaf, tomates et poivrons', 25, 1, {pulpe:100, poivron:80, oignon:50, courgette:20}, [H2], 'ail, paprika, cumin, persil', null, [
    'Fais revenir l’oignon, l’ail, le poivron et la courgette dans l’huile avec les épices.',
    'Ajoute le boulgour, la pulpe et 1,5 fois son volume d’eau ; 12 min à couvert.',
    'Incorpore le thon hors du feu ; œuf dur et persil.']);
  r('thon', 'lentilles', 'Salade de lentilles au thon', 25, 1, {tomate:80, carotte:50, oignon:50, salade:70}, [H2], 'moutarde, vinaigre, persil, ciboulette', null, [
    'Cuis les lentilles 20 min et laisse-les tiédir.',
    'Vinaigrette moutarde-vinaigre-huile avec l’échalote ciselée.',
    'Mélange avec la carotte râpée, les tomates, le thon, l’œuf dur et la salade.']);
  r('thon', 'poischiches', 'Salade de pois chiches au thon, cumin et citron', 15, 1, {tomate:80, concombre:80, poivron:40, oignon:50}, [H2], 'cumin, citron, coriandre, persil', null, [
    'Rince les pois chiches cuits.',
    'Ajoute tomates, concombre, poivron et oignon rouge en dés, l’huile, le citron et le cumin.',
    'Thon, œuf dur et herbes sur le dessus.']);
  r('thon', 'gnocchis', 'Gnocchis au thon et aux tomates', 20, 0, {pulpe:150, oignon:50, epinards:50}, [H1, PARM], 'ail, basilic, câpres', null, [
    'Fais fondre l’oignon et l’ail dans l’huile, ajoute la pulpe et les câpres ; 10 min.',
    'Ajoute les épinards puis le thon hors du feu.',
    'Mélange aux gnocchis poêlés, parmesan, basilic ; l’œuf dur à côté.']);
  /* Tofu ferme */
  r('tofu', 'riz', 'Tofu sauté aux légumes, riz', 25, 1, {brocoli:90, poivron:70, oignon:50, chou:40}, [H1, SES], 'sauce soja, gingembre, ail, ciboule', {miel:5}, [
    'Presse le tofu, coupe-le en cubes et fais-le dorer dans l’huile.',
    'Ajoute oignon, brocoli, poivron et chou, 5 min à feu vif.',
    'Sauce soja, miel, gingembre et ail ; sers sur le riz avec le sésame et la ciboule.']);
  r('tofu', 'pates', 'Pâtes au tofu, tomates et basilic', 20, 1, {pulpe:150, oignon:50, courgette:50}, [H1, PARM], 'ail, basilic, origan, paprika fumé', null, [
    'Émiette le tofu et fais-le dorer dans l’huile avec le paprika fumé.',
    'Ajoute l’oignon, l’ail, la courgette, puis la pulpe et l’origan ; 10 min.',
    'Mélange aux pâtes avec le parmesan et le basilic.']);
  r('tofu', 'pdt', 'Tofu grillé, pommes de terre rôties et haricots verts', 40, 1, {haricotsverts:160, oignon:50, tomate:40}, [H2], 'paprika fumé, thym, sauce soja, ail', null, [
    'Pommes de terre en quartiers et oignon avec la moitié de l’huile et le thym, four à 200 °C, 35 min.',
    'Fais mariner le tofu en tranches dans la sauce soja et le paprika, puis grille-le dans le reste d’huile.',
    'Haricots verts à la vapeur ; tomates en quartiers.']);
  r('tofu', 'patate', 'Bowl tofu, patate douce et brocolis', 35, 1, {brocoli:140, oignon:50, epinards:60}, [H1, SES], 'sauce soja, citron vert, gingembre', null, [
    'Patate douce et oignon en cubes avec l’huile, four à 200 °C, 25 min ; brocolis 10 min avant la fin.',
    'Fais dorer le tofu en cubes à la poêle, avec la sauce soja et le gingembre.',
    'Bowl sur les pousses d’épinards, sésame et citron vert.']);
  r('tofu', 'quinoa', 'Bowl tofu-quinoa, sauce soja et sésame', 25, 1, {carotte:70, concombre:70, chou:60, oignon:50}, [HSES, SES], 'sauce soja, vinaigre de riz, gingembre, coriandre', null, [
    'Cuis le quinoa 12 min.',
    'Fais dorer le tofu en cubes à la poêle, puis enrobe-le de sauce soja.',
    'Bowl : quinoa, carotte râpée, concombre, chou émincé, oignon nouveau, tofu ; huile et graines de sésame, vinaigre de riz.']);
  r('tofu', 'semoule', 'Tofu à la marocaine, semoule', 35, 1, {carotte:70, courgette:80, oignon:50, pulpe:50}, [H2], 'ras-el-hanout, cumin, coriandre, citron', null, [
    'Fais dorer le tofu en cubes avec les épices dans l’huile.',
    'Ajoute l’oignon, la carotte, la courgette, la pulpe et un verre d’eau ; 20 min.',
    'Sers avec la semoule, la coriandre et le citron.']);
  r('tofu', 'boulgour', 'Taboulé de boulgour au tofu grillé', 25, 1, {tomate:80, concombre:80, oignon:50, poivron:40}, [H2], 'persil, menthe, citron, sumac (au goût)', null, [
    'Cuis le boulgour 10 min et laisse-le refroidir.',
    'Ajoute légumes en dés, herbes, la moitié de l’huile et le citron.',
    'Grille le tofu en dés dans le reste d’huile et pose-le dessus.']);
  r('tofu', 'lentilles', 'Dahl de lentilles corail au tofu', 30, 1, {oignon:50, pulpe:110, epinards:90}, [H1, COCO], 'curry, curcuma, cumin, gingembre, ail, coriandre', null, [
    'Fais revenir l’oignon, l’ail, le gingembre et les épices dans l’huile.',
    'Ajoute les lentilles corail, la pulpe et 3 fois leur volume d’eau ; 15 min, puis le lait de coco et les épinards.',
    'Fais dorer le tofu en cubes à part et pose-le sur le dahl ; coriandre.']);
  r('tofu', 'poischiches', 'Curry de pois chiches, chou-fleur et tofu, raïta', 35, 1, {oignon:50, choufleur:130, pulpe:70}, [H1, COCO], 'curry, garam masala, gingembre, ail, coriandre', {skyr:40}, [
    'Fais revenir l’oignon, l’ail, le gingembre et les épices dans l’huile.',
    'Ajoute le chou-fleur en fleurettes, les pois chiches cuits, la pulpe, le lait de coco et un peu d’eau ; 20 min.',
    'Ajoute le tofu doré à la poêle ; raïta : skyr et coriandre.']);
  r('tofu', 'gnocchis', 'Gnocchis poêlés au tofu, épinards et champignons', 20, 0, {epinards:100, champignon:100, oignon:50}, [H1, PARM], 'ail, sauce soja, muscade', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais dorer le tofu en dés dans l’huile avec un trait de sauce soja, puis l’échalote, l’ail et les champignons.',
    'Ajoute les épinards et les gnocchis ; muscade et parmesan.']);
  /* 3.31.0 : une deuxième recette par couple, d'un autre style que la première (grillé, au four, au air fryer, en salade…) */
  const PARM10 = ['parmesan', 10, 'parmesan râpé', '2 c. à soupe, pour la panure'], LAITS = ['lait', 50, 'lait demi-écrémé', '50 ml, pour la sauce'];
  /* Viande blanche */
  v('teriyaki', 'poulet', 'riz', 'Poulet teriyaki, riz et brocolis', 25, 1, {brocoli:130, carotte:70, oignon:50}, [HSES, SES], 'sauce soja, gingembre, ail, ciboule', {miel:5}, [
    'Cuis le riz. Fais sauter le poulet en dés dans l’huile de sésame avec l’ail et le gingembre.',
    'Ajoute l’oignon, la carotte en rondelles fines et les brocolis en petites fleurettes, avec un fond d’eau ; 6 min à couvert.',
    'Verse la sauce soja et le miel, laisse réduire 2 min pour laquer ; sésame et ciboule.'], 'concassées sur le poulet');
  v('pesto', 'poulet', 'pates', 'Pâtes au poulet, pesto d’épinards et parmesan', 20, 1, {epinards:120, courgette:80, oignon:50}, [H1, PARM], 'ail, basilic, citron', null, [
    'Mixe la moitié des épinards avec le basilic, l’ail, l’huile, le parmesan et un peu d’eau de cuisson des pâtes.',
    'Fais dorer le poulet en lanières à sec, puis l’oignon et la courgette en demi-rondelles ; ajoute le reste des épinards.',
    'Mélange les pâtes au pesto et au poulet, avec un filet de citron.'], 'concassées sur les pâtes');
  v('airfryer', 'poulet', 'pdt', 'Poulet croustillant au air fryer, frites maison et coleslaw', 30, 0, {chou:150, carotte:50, oignon:50}, [H1, PARM10], 'paprika fumé, ail en poudre, origan, moutarde, citron', {skyr:40}, [
    'Coupe les pommes de terre en frites avec la peau, mélange-les à l’huile et au sel : air fryer à 200 °C, 18 à 20 min, en secouant à mi-cuisson.',
    'Coupe le poulet en aiguillettes, enrobe-les de la moitié du skyr à l’ail, roule-les dans le parmesan mêlé au paprika et à l’origan ; air fryer à 200 °C, 12 à 14 min, retournées à mi-cuisson.',
    'Coleslaw : chou et carotte râpés, oignon rouge émincé, le reste du skyr avec la moutarde et le citron.'], 'concassées sur le coleslaw');
  v('tikka', 'poulet', 'patate', 'Poulet tikka, patate douce rôtie et épinards', 35, 1, {epinards:100, oignon:100, pulpe:50}, [H1], 'garam masala, curcuma, cumin, gingembre, ail, citron', {skyr:50}, [
    'Fais mariner le poulet en dés 15 min dans le skyr, le citron et les épices.',
    'Patate douce en cubes au four à 200 °C, 25 min ; pendant ce temps, fais revenir l’oignon dans l’huile, ajoute le poulet et sa marinade, puis la pulpe ; 10 min.',
    'Ajoute les épinards jusqu’à ce qu’ils tombent et sers avec la patate douce.'], 'effilées sur le poulet tikka');
  v('mexicain', 'poulet', 'quinoa', 'Quinoa à la mexicaine, poulet et poivrons', 30, 1, {poivron:100, pulpe:50, oignon:50, tomate:50}, [H2], 'cumin, paprika, piment, coriandre, citron vert', null, [
    'Fais revenir l’oignon et les poivrons en lanières dans l’huile, puis le poulet en dés avec les épices.',
    'Ajoute le quinoa rincé, la pulpe et deux fois le volume du quinoa d’eau ; 15 min à couvert.',
    'Tomate en dés, coriandre et citron vert au moment de servir.'], 'grillées sur le quinoa');
  v('citron', 'poulet', 'semoule', 'Poulet au citron et aux olives, semoule', 35, 1, {oignon:100, courgette:100, carotte:50}, [H1, OLIVE], 'citron confit (ou citron), curcuma, gingembre, coriandre', null, [
    'Dore le poulet et l’oignon dans l’huile avec le curcuma et le gingembre.',
    'Ajoute la courgette et la carotte en bâtonnets, le citron, les olives et un verre d’eau ; 20 min à couvert.',
    'Sers sur la semoule gonflée 5 min dans son volume d’eau bouillante, avec la coriandre.'], 'effilées sur la semoule');
  v('pilaf', 'poulet', 'boulgour', 'Pilaf de boulgour au poulet et aux légumes', 30, 1, {poivron:80, courgette:70, oignon:50, pulpe:50}, [H2], 'cumin, paprika, cannelle, persil', null, [
    'Fais revenir l’oignon et le poulet en dés dans l’huile avec les épices.',
    'Ajoute le poivron et la courgette en dés, le boulgour, la pulpe et deux fois le volume du boulgour d’eau ; 12 min à couvert.',
    'Laisse reposer 5 min hors du feu et parsème de persil.'], 'grillées sur le pilaf');
  v('curry', 'poulet', 'lentilles', 'Curry de lentilles corail au poulet', 30, 1, {oignon:100, epinards:100, pulpe:50}, [H1, COCO], 'curry, curcuma, cumin, gingembre, ail, coriandre', null, [
    'Fais revenir l’oignon, l’ail, le gingembre et les épices dans l’huile, puis le poulet en dés.',
    'Ajoute les lentilles corail, la pulpe et trois fois leur volume d’eau ; 15 min.',
    'Ajoute le lait de coco et les épinards, 2 min ; coriandre.'], 'effilées sur le curry');
  v('salade', 'poulet', 'poischiches', 'Salade de pois chiches rôtis, poulet et sauce yaourt', 25, 1, {salade:80, tomate:70, concombre:50, oignon:50}, [H1], 'paprika, cumin, citron, menthe, ail', {skyr:40}, [
    'Égoutte et sèche les pois chiches, mélange-les à la moitié de l’huile et aux épices : four (ou air fryer) à 200 °C, 15 min.',
    'Poêle le poulet en lanières dans le reste de l’huile.',
    'Salade, tomate, concombre, oignon rouge, pois chiches et poulet ; sauce skyr, citron, menthe et ail.'], 'sur la salade');
  v('four', 'poulet', 'gnocchis', 'Gnocchis au four, poulet, tomates et poivrons', 30, 0, {pulpe:100, poivron:100, oignon:50}, [H1, PARM], 'ail, origan, basilic', null, [
    'Fais revenir l’oignon, l’ail et le poivron en lanières dans l’huile, puis le poulet en dés.',
    'Ajoute la pulpe et l’origan, 5 min, puis mélange avec les gnocchis crus dans un plat.',
    'Parsème de parmesan : four à 200 °C, 15 min ; basilic.'], 'concassées sur les gnocchis');
  /* Bœuf */
  v('saute', 'boeuf', 'riz', 'Bœuf sauté aux légumes, sauce soja, riz', 20, 1, {poivron:80, brocoli:70, oignon:50, carotte:50}, [HSES], 'sauce soja, gingembre, ail, ciboule', {miel:5}, [
    'Cuis le riz. Saisis le bœuf émietté à feu vif dans l’huile, avec l’ail et le gingembre.',
    'Ajoute l’oignon, la carotte en bâtonnets, le poivron et les brocolis, avec un fond d’eau ; 5 min, ils restent croquants.',
    'Sauce soja et miel, 1 min ; ciboule.'], 'en copeaux sur les légumes');
  v('goulash', 'boeuf', 'pates', 'Pâtes au bœuf façon goulash, poivrons et paprika', 30, 1, {poivron:100, oignon:100, pulpe:50}, [H1, CREME], 'paprika doux, cumin, ail', null, [
    'Fais fondre l’oignon dans l’huile, ajoute le bœuf, l’ail et le paprika.',
    'Ajoute les poivrons en lanières, la pulpe et un peu d’eau ; 15 min.',
    'Hors du feu, la crème ; mélange aux pâtes.'], 'râpé sur les pâtes');
  v('burger', 'boeuf', 'pdt', 'Burger sans pain, potatoes au air fryer', 30, 0, {salade:60, tomate:90, oignon:50, concombre:50}, [H1], 'paprika, ail en poudre, moutarde, cornichons', {skyr:40}, [
    'Potatoes : pommes de terre en quartiers avec la peau, l’huile et le paprika ; air fryer à 200 °C, 20 min (ou four, 30 min).',
    'Façonne le bœuf en steaks, sale, poivre et cuis-les à la poêle à sec, 3 min par face.',
    'Sers sur la salade avec tomate, oignon rouge et concombre ; sauce skyr, moutarde et cornichons hachés.'], 'en copeaux sur le steak');
  v('texmex', 'boeuf', 'patate', 'Bœuf et patate douce façon tex-mex', 40, 1, {poivron:100, oignon:100, pulpe:50}, [H1], 'cumin, paprika fumé, piment, origan, coriandre', {skyr:40}, [
    'Patate douce en cubes avec l’huile et la moitié des épices : four à 200 °C, 25 min.',
    'Fais revenir l’oignon et le poivron, puis le bœuf avec le reste des épices et la pulpe ; 10 min.',
    'Mélange avec la patate douce ; skyr et coriandre dessus.'], 'râpé dessus, façon cheddar');
  v('boulettes', 'boeuf', 'quinoa', 'Boulettes de bœuf au four, quinoa et ratatouille', 40, 1, {aubergine:70, courgette:80, oignon:50, pulpe:50}, [H2], 'herbes de Provence, ail, basilic', null, [
    'Façonne des boulettes de bœuf avec l’ail et les herbes : four à 200 °C, 15 min.',
    'Ratatouille : oignon, aubergine et courgette en dés dans l’huile, puis la pulpe ; 20 min à couvert.',
    'Cuis le quinoa 12 min et sers avec les boulettes et la ratatouille.'], 'râpé sur la ratatouille');
  v('couscous', 'boeuf', 'semoule', 'Semoule façon couscous au bœuf épicé', 35, 1, {carotte:70, courgette:80, oignon:50, poivron:50}, [H2], 'ras-el-hanout, cumin, harissa (au goût), coriandre', null, [
    'Fais revenir l’oignon et le bœuf dans l’huile avec les épices.',
    'Ajoute carotte, courgette et poivron en morceaux et un verre d’eau ; 20 min.',
    'Verse la semoule dans son volume d’eau bouillante, 5 min à couvert, égrène ; nappe de bouillon, coriandre.'], 'en copeaux, à côté');
  v('farcis', 'boeuf', 'boulgour', 'Poivrons farcis au bœuf et au boulgour', 45, 1, {poivron:150, oignon:50, pulpe:50}, [H1], 'cumin, paprika, ail, persil', null, [
    'Cuis le boulgour 10 min. Fais revenir l’oignon, l’ail et le bœuf dans l’huile avec les épices.',
    'Mélange le bœuf, le boulgour, la pulpe et le persil ; garnis les poivrons coupés en deux.',
    'Four à 190 °C, 25 min.'], 'gratiné sur les poivrons');
  v('bolo', 'boeuf', 'lentilles', 'Bolognaise de bœuf et lentilles', 35, 1, {oignon:50, carotte:60, pulpe:140}, [H1], 'ail, origan, laurier, thym', null, [
    'Fais revenir l’oignon, la carotte en petits dés et l’ail dans l’huile, puis le bœuf.',
    'Ajoute les lentilles, la pulpe, les herbes et deux fois le volume des lentilles d’eau ; 25 min à petit feu.',
    'Rectifie l’assaisonnement ; c’est encore meilleur réchauffé.'], 'râpé dessus');
  v('harira', 'boeuf', 'poischiches', 'Soupe harira au bœuf et pois chiches', 40, 1, {oignon:100, pulpe:100, carotte:50}, [H1], 'cumin, curcuma, gingembre, coriandre, citron', null, [
    'Fais revenir l’oignon et le bœuf dans l’huile avec les épices.',
    'Ajoute la carotte en dés, la pulpe, les pois chiches cuits et 50 cl d’eau ; 25 min.',
    'Coriandre et un filet de citron au moment de servir.'], 'en copeaux, à côté');
  v('poele', 'boeuf', 'gnocchis', 'Gnocchis poêlés au bœuf, poivrons et paprika', 25, 0, {poivron:120, oignon:50, epinards:80}, [H1], 'paprika fumé, ail, origan', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais revenir l’oignon et le poivron dans l’huile, puis le bœuf avec l’ail et le paprika.',
    'Ajoute les épinards et les gnocchis, mélange 2 min.'], 'râpé sur les gnocchis');
  /* Poisson blanc */
  v('curry', 'poisson', 'riz', 'Curry de poisson blanc au lait de coco, riz', 25, 0, {poivron:80, epinards:70, oignon:50, tomate:50}, [H1, COCO], 'curry, curcuma, gingembre, ail, citron vert, coriandre', null, [
    'Fais revenir l’oignon, l’ail, le gingembre et les épices dans l’huile, puis le poivron et la tomate.',
    'Ajoute le lait de coco et un peu d’eau, puis le poisson en gros morceaux ; 6 min à petit feu.',
    'Les épinards à la fin ; citron vert et coriandre, avec le riz.'], 'effilées sur le curry');
  v('brocolis', 'poisson', 'pates', 'Pâtes au poisson blanc, brocolis et crème citronnée', 20, 0, {brocoli:150, oignon:50, epinards:50}, [H1, CREME], 'citron, ail, aneth', null, [
    'Cuis les brocolis en petites fleurettes avec les pâtes, les 4 dernières minutes.',
    'Poêle le poisson en morceaux dans l’huile avec l’oignon et l’ail, 4 min ; ajoute les épinards.',
    'Hors du feu, la crème, le zeste et le jus de citron ; mélange aux pâtes, aneth.'], 'effilées sur les pâtes');
  v('salade', 'poisson', 'pdt', 'Salade de pommes de terre au poisson blanc, sauce moutarde', 30, 1, {haricotsverts:100, salade:50, concombre:50, oignon:50}, [H1], 'moutarde, cornichons, câpres, persil, ciboulette, citron', {skyr:40}, [
    'Cuis les pommes de terre avec la peau, 20 min à l’eau salée, et les haricots verts 8 min ; laisse tiédir.',
    'Poche le poisson 6 min dans l’eau frémissante citronnée (ou à la vapeur), puis effeuille-le.',
    'Mélange pommes de terre en rondelles, haricots, concombre, échalote ciselée, cornichons, câpres et poisson ; sauce skyr, moutarde, huile et herbes ; sers sur la salade.'], 'concassées sur la salade');
  v('pane', 'poisson', 'patate', 'Poisson pané au air fryer, frites de patate douce', 30, 0, {chou:100, carotte:100, oignon:50}, [H1, PARM10], 'paprika, citron, aneth, persil', {skyr:40}, [
    'Frites de patate douce avec l’huile et le paprika : air fryer à 200 °C, 15 à 18 min, en secouant à mi-cuisson.',
    'Enrobe le poisson d’un peu de skyr, puis du parmesan mêlé aux herbes : air fryer à 200 °C, 8 à 10 min.',
    'Chou et carotte râpés, oignon émincé, le reste du skyr et le citron.'], 'concassées sur le chou');
  v('bowl', 'poisson', 'quinoa', 'Bowl de quinoa au poisson grillé, sauce verte', 25, 1, {concombre:70, tomate:80, salade:50, oignon:50}, [H1], 'persil, coriandre, menthe, citron, ail', {skyr:40}, [
    'Cuis le quinoa 12 min et laisse tiédir.',
    'Grille le poisson à la poêle dans l’huile, 3 min par face.',
    'Sauce verte : skyr, herbes hachées, ail et citron ; bowl de quinoa, crudités, oignon rouge et poisson.'], 'grillées sur le bowl');
  v('tajine', 'poisson', 'semoule', 'Tajine de poisson blanc aux légumes, semoule', 35, 0, {tomate:80, carotte:70, oignon:50, poivron:50}, [H1, OLIVE], 'cumin, paprika, curcuma, coriandre, citron', null, [
    'Fais revenir l’oignon, la carotte et le poivron dans l’huile avec les épices.',
    'Ajoute la tomate en dés, les olives et un fond d’eau, 10 min, puis le poisson dessus ; 8 min à couvert.',
    'Sers sur la semoule, avec la coriandre et le citron.'], 'sur la semoule');
  v('taboule', 'poisson', 'boulgour', 'Taboulé libanais au poisson grillé', 25, 1, {tomate:120, concombre:80, oignon:50}, [H2], 'persil plat (beaucoup), menthe, citron', null, [
    'Cuis le boulgour fin 8 min et laisse-le refroidir.',
    'Hache beaucoup de persil et de menthe ; tomates, concombre et oignon en petits dés ; assaisonne avec la moitié de l’huile et le citron.',
    'Grille le poisson dans le reste de l’huile et pose-le dessus.'], 'concassées sur le taboulé');
  v('dahl', 'poisson', 'lentilles', 'Dahl de lentilles corail et poisson poché', 30, 0, {oignon:50, pulpe:100, epinards:100}, [H1, COCO], 'curry, cumin, curcuma, gingembre, citron', null, [
    'Fais revenir l’oignon et les épices dans l’huile.',
    'Ajoute les lentilles corail, la pulpe et trois fois leur volume d’eau ; 15 min, puis le lait de coco et les épinards.',
    'Pose le poisson sur le dahl, couvre et laisse pocher 6 min ; citron.'], 'effilées sur le dahl');
  v('ragout', 'poisson', 'poischiches', 'Ragoût de poisson aux pois chiches, tomates et épinards', 30, 0, {oignon:50, pulpe:120, epinards:80}, [H1], 'ail, paprika fumé, cumin, persil', null, [
    'Fais revenir l’oignon et l’ail dans l’huile avec le paprika et le cumin.',
    'Ajoute la pulpe et les pois chiches cuits, 10 min, puis les épinards.',
    'Pose le poisson dessus, couvre et laisse cuire 7 min ; persil.'], 'grillées par-dessus');
  v('four', 'poisson', 'gnocchis', 'Gnocchis et poisson rôtis au four, courgettes et citron', 30, 0, {courgette:120, tomate:80, oignon:50}, [H1, PARM], 'citron, ail, thym', null, [
    'Gnocchis, courgette en rondelles, tomates et oignon avec l’huile et le thym : four à 210 °C, 15 min.',
    'Ajoute le poisson citronné sur le dessus, 10 min de plus.',
    'Parmesan et zeste de citron en sortant du four.'], 'concassées dessus');
  /* Poisson gras */
  v('teriyaki', 'saumon', 'riz', 'Saumon teriyaki, riz et haricots verts', 20, 1, {haricotsverts:150, oignon:50, carotte:50}, [HSES, SES], 'sauce soja, gingembre, ail, ciboule', {miel:5}, [
    'Cuis le riz, et les haricots verts et la carotte 8 min à la vapeur.',
    'Saisis le saumon dans l’huile, 3 min par face, avec l’oignon émincé.',
    'Sauce soja, miel et gingembre dans la poêle, 1 min pour laquer ; sésame et ciboule.']);
  v('poireaux', 'saumon', 'pates', 'Pâtes au saumon, poireaux et crème légère', 25, 0, {poireau:150, oignon:50, epinards:50}, [H1, CREME], 'aneth, citron, poivre', null, [
    'Fais fondre les poireaux émincés et l’oignon dans l’huile, 10 min à couvert.',
    'Ajoute le saumon en dés et les épinards, 4 min.',
    'Hors du feu, la crème, l’aneth et le citron ; mélange aux pâtes.']);
  v('airfryer', 'saumon', 'pdt', 'Saumon et pommes de terre grenaille au air fryer, salade de concombre', 25, 0, {concombre:120, salade:80, oignon:50}, [H1], 'aneth, citron, ail, moutarde', {skyr:40}, [
    'Pommes de terre coupées en deux avec l’huile et l’ail : air fryer à 200 °C, 18 min.',
    'Ajoute le saumon assaisonné pour les 8 dernières minutes.',
    'Concombre en fines rondelles, oignon rouge, salade ; sauce skyr, moutarde, aneth et citron.']);
  v('curry', 'saumon', 'patate', 'Curry de saumon, patate douce et épinards', 30, 0, {epinards:120, oignon:100, poivron:30}, [H1, COCO], 'curry, curcuma, gingembre, citron vert, coriandre', null, [
    'Fais revenir l’oignon et les épices dans l’huile, ajoute la patate douce en cubes, le poivron et un verre d’eau ; 15 min.',
    'Ajoute le lait de coco et le saumon en gros dés ; 5 min à petit feu.',
    'Les épinards à la fin ; citron vert et coriandre.']);
  v('four', 'saumon', 'quinoa', 'Saumon rôti, quinoa et légumes du soleil', 30, 1, {courgette:80, poivron:70, tomate:50, oignon:50}, [H1], 'herbes de Provence, citron, ail', null, [
    'Courgette, poivron, tomates et oignon en morceaux avec l’huile et les herbes : four à 200 °C, 15 min.',
    'Ajoute le saumon citronné, 12 min de plus.',
    'Sers sur le quinoa cuit 12 min.']);
  v('chermoula', 'saumon', 'semoule', 'Saumon à la chermoula, semoule aux carottes', 30, 1, {carotte:100, oignon:50, courgette:100}, [H1], 'cumin, paprika, coriandre, persil, ail, citron', null, [
    'Chermoula : herbes hachées, ail, épices, citron et huile ; enrobe-en le saumon.',
    'Fais revenir l’oignon, la carotte et la courgette râpées 5 min dans la poêle, puis le saumon, 4 min par face.',
    'Sers sur la semoule gonflée à l’eau bouillante.']);
  v('pilaf', 'saumon', 'boulgour', 'Pilaf de boulgour au saumon, épinards et citron', 25, 1, {epinards:120, oignon:50, poivron:80}, [H1], 'citron, aneth, ail', null, [
    'Fais revenir l’oignon et le poivron dans l’huile, ajoute le boulgour et deux fois son volume d’eau ; 12 min.',
    'Pose le saumon en morceaux sur le boulgour, couvre et laisse cuire 8 min à petit feu.',
    'Ajoute les épinards, l’aneth et le citron, mélange en effeuillant le saumon.']);
  v('salade', 'saumon', 'lentilles', 'Salade de lentilles au saumon (ou maquereau), concombre et aneth', 25, 1, {concombre:80, carotte:60, salade:60, oignon:50}, [H1], 'moutarde, vinaigre de cidre, aneth', null, [
    'Cuis les lentilles 20 min et laisse tiédir.',
    'Cuis le saumon 8 min à la vapeur (ou ouvre une boîte de maquereau au naturel) et effeuille-le.',
    'Mélange lentilles, carotte râpée, concombre, échalote et poisson ; vinaigrette moutarde, aneth ; sur la salade.']);
  v('four', 'saumon', 'poischiches', 'Saumon au four, pois chiches rôtis et brocolis', 30, 1, {brocoli:150, oignon:50, tomate:50}, [H1], 'paprika fumé, cumin, citron, ail', null, [
    'Pois chiches cuits, brocolis et oignon avec l’huile et les épices : four à 200 °C, 15 min.',
    'Ajoute le saumon et les tomates cerises, 12 min de plus.',
    'Un filet de citron en sortant du four.']);
  v('petitspois', 'saumon', 'gnocchis', 'Gnocchis poêlés au saumon, petits pois et menthe', 20, 0, {petitspois:100, courgette:100, oignon:50}, [H1], 'menthe, citron, ail', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais revenir l’oignon et la courgette dans l’huile, ajoute les petits pois et le saumon en dés ; 5 min.',
    'Remets les gnocchis, menthe et citron.']);
  /* Crevettes + halloumi */
  v('curry', 'crevettes', 'riz', 'Curry de crevettes au lait de coco, halloumi grillé, riz', 25, 0, {poivron:80, epinards:70, oignon:50, tomate:50}, [H1, COCO], 'curry, gingembre, ail, citron vert, coriandre', null, [
    'Fais revenir l’oignon, l’ail, le gingembre et le curry dans l’huile, puis le poivron et la tomate ; 5 min.',
    'Ajoute le lait de coco, les crevettes et les épinards ; 3 min.',
    'Grille le halloumi en tranches à la poêle et sers avec le riz ; citron vert, coriandre.']);
  v('ail', 'crevettes', 'pates', 'Pâtes aux crevettes, ail et citron, halloumi grillé', 20, 0, {courgette:100, epinards:100, oignon:50}, [H1], 'ail, piment, citron, persil', null, [
    'Grille le halloumi en dés à sec, puis réserve.',
    'Fais revenir l’ail, l’oignon et la courgette dans l’huile, ajoute les crevettes et les épinards ; 3 min.',
    'Mélange aux pâtes avec le citron, le persil et le halloumi.']);
  v('brochettes', 'crevettes', 'pdt', 'Brochettes de crevettes et halloumi, pommes de terre rôties', 35, 1, {poivron:100, courgette:100, oignon:50}, [H1], 'paprika, origan, ail, citron', null, [
    'Pommes de terre en quartiers avec l’huile et le paprika : four à 200 °C, 30 min.',
    'Monte les brochettes : crevettes, halloumi, poivron, courgette et oignon.',
    'Grille-les 8 min à la poêle ou au four ; origan et citron.']);
  v('gingembre', 'crevettes', 'patate', 'Patate douce et crevettes sautées au gingembre, halloumi', 30, 1, {brocoli:120, poivron:80, oignon:50}, [HSES], 'gingembre, ail, sauce soja, citron vert', null, [
    'Cuis la patate douce en cubes 10 min à la vapeur.',
    'Fais sauter l’oignon, le poivron et les brocolis dans l’huile, puis les crevettes, l’ail et le gingembre ; 4 min.',
    'Ajoute la patate douce et le halloumi grillé ; sauce soja et citron vert.']);
  v('saute', 'crevettes', 'quinoa', 'Quinoa sauté aux crevettes, halloumi et petits pois', 25, 1, {petitspois:80, carotte:70, oignon:50, poivron:50}, [H1], 'ail, gingembre, sauce soja, ciboule', null, [
    'Cuis le quinoa 12 min et égoutte-le bien.',
    'Fais sauter l’oignon, la carotte et le poivron en dés dans l’huile, puis les petits pois et les crevettes.',
    'Ajoute le quinoa et le halloumi grillé en dés ; sauce soja et ciboule.']);
  v('taboule', 'crevettes', 'semoule', 'Taboulé aux crevettes et halloumi grillé', 20, 1, {tomate:100, concombre:100, oignon:50}, [H1], 'menthe, persil, citron', null, [
    'Fais gonfler la semoule dans son volume d’eau bouillante, laisse refroidir.',
    'Ajoute tomate, concombre et oignon en petits dés, les herbes, l’huile et le citron.',
    'Grille le halloumi et poêle les crevettes 2 min ; pose-les dessus.']);
  v('pilaf', 'crevettes', 'boulgour', 'Pilaf de boulgour aux crevettes, halloumi et tomates', 30, 1, {pulpe:80, poivron:70, courgette:50, oignon:50}, [H1], 'paprika, cumin, ail, persil', null, [
    'Fais revenir l’oignon, le poivron et la courgette dans l’huile avec les épices.',
    'Ajoute le boulgour, la pulpe et deux fois le volume du boulgour d’eau ; 12 min à couvert.',
    'Ajoute les crevettes et le halloumi en dés, 3 min ; persil.']);
  v('dahl', 'crevettes', 'lentilles', 'Dahl de lentilles corail, crevettes et halloumi grillé', 30, 1, {oignon:50, pulpe:100, epinards:100}, [H1, COCO], 'curry, curcuma, cumin, gingembre, coriandre', null, [
    'Fais revenir l’oignon et les épices dans l’huile, puis ajoute les lentilles corail, la pulpe et trois fois leur volume d’eau ; 15 min.',
    'Ajoute le lait de coco, les épinards et les crevettes ; 3 min.',
    'Grille le halloumi et pose-le dessus ; coriandre.']);
  v('salade', 'crevettes', 'poischiches', 'Salade de pois chiches, crevettes, halloumi et concombre', 20, 1, {concombre:90, tomate:80, salade:30, oignon:50}, [H1], 'menthe, citron, sumac (au goût)', null, [
    'Grille le halloumi en dés et poêle les crevettes 2 min.',
    'Mélange pois chiches cuits, concombre, tomate et oignon rouge.',
    'Ajoute crevettes, halloumi, menthe, huile et citron ; sur la salade.']);
  v('tomate', 'crevettes', 'gnocchis', 'Gnocchis à la tomate, crevettes et halloumi', 20, 0, {pulpe:120, poivron:80, oignon:50}, [H1], 'ail, basilic, piment', null, [
    'Fais revenir l’oignon, l’ail et le poivron dans l’huile, ajoute la pulpe ; 10 min.',
    'Ajoute les gnocchis et les crevettes, 3 min.',
    'Halloumi grillé en dés et basilic dessus.']);
  /* Œufs + jambon */
  v('bibimbap', 'oeufs', 'riz', 'Bibimbap express, œuf au plat et jambon', 25, 0, {epinards:80, carotte:70, chou:50, oignon:50}, [HSES, SES], 'sauce soja, ail, piment (au goût)', null, [
    'Cuis le riz. Fais sauter séparément, dans un peu d’huile, les épinards, la carotte en julienne et le chou émincé.',
    'Fais cuire les œufs au plat et dore le jambon en lanières.',
    'Bol de riz, légumes en tas, jambon, œuf ; sauce soja, ail, sésame.']);
  v('frittata', 'oeufs', 'pates', 'Frittata de pâtes au jambon et aux courgettes', 30, 1, {courgette:150, oignon:50, tomate:50}, [H1, PARM], 'basilic, ail, poivre', null, [
    'Fais revenir l’oignon et la courgette râpée dans l’huile, 5 min.',
    'Mélange les pâtes cuites, les œufs battus, le jambon en dés, le parmesan et la courgette.',
    'Cuis à la poêle à couvert 10 min, retourne, 3 min ; tomates et basilic.']);
  v('salade', 'oeufs', 'pdt', 'Salade de pommes de terre, œufs durs et jambon', 25, 1, {haricotsverts:100, salade:50, tomate:50, oignon:50}, [H1], 'moutarde, cornichons, ciboulette, vinaigre', {skyr:40}, [
    'Cuis les pommes de terre 20 min, les haricots verts 8 min et les œufs 10 min.',
    'Coupe pommes de terre, œufs et jambon ; ajoute haricots, tomates, échalote et cornichons.',
    'Sauce skyr, moutarde, huile, vinaigre et ciboulette ; sur la salade.']);
  v('poelee', 'oeufs', 'patate', 'Poêlée de patate douce, jambon et œufs au plat', 25, 0, {poivron:100, epinards:100, oignon:50}, [H1], 'paprika fumé, cumin, ciboulette', null, [
    'Fais dorer la patate douce en petits dés dans l’huile, 12 min à couvert.',
    'Ajoute l’oignon, le poivron et le jambon, 5 min, puis les épinards.',
    'Creuse des puits, casse les œufs, couvre 4 min ; ciboulette.']);
  v('bowl', 'oeufs', 'quinoa', 'Bowl quinoa, œufs mollets, jambon et crudités', 25, 1, {concombre:70, carotte:70, salade:60, oignon:50}, [H1], 'moutarde, citron, ciboulette', {skyr:40}, [
    'Cuis le quinoa 12 min, et les œufs 6 min avant de les rafraîchir.',
    'Carotte râpée, concombre, oignon nouveau, salade, jambon en lanières.',
    'Sauce skyr, moutarde, huile et citron ; les œufs coupés en deux dessus.']);
  v('cocotte', 'oeufs', 'semoule', 'Œufs cocotte à la tomate et au jambon, semoule aux herbes', 25, 0, {pulpe:100, courgette:100, oignon:50}, [H1], 'cumin, paprika, persil', null, [
    'Fais revenir l’oignon et la courgette en dés dans l’huile, ajoute la pulpe et les épices ; 10 min.',
    'Verse dans des ramequins, ajoute le jambon et casse un œuf dans chacun : four à 180 °C, 12 min.',
    'Sers avec la semoule gonflée et le persil.']);
  v('taboule', 'oeufs', 'boulgour', 'Taboulé de boulgour, œufs durs et jambon', 20, 1, {tomate:100, concombre:100, oignon:50}, [H1], 'persil, menthe, citron', null, [
    'Cuis le boulgour 10 min et les œufs 10 min ; laisse refroidir.',
    'Ajoute tomate, concombre et oignon en dés, les herbes, l’huile et le citron.',
    'Le jambon en lanières et les œufs en quartiers dessus.']);
  v('curry', 'oeufs', 'lentilles', 'Lentilles au curry, œufs durs et jambon', 30, 1, {oignon:50, pulpe:100, epinards:100}, [H1], 'curry, curcuma, cumin, gingembre', null, [
    'Fais revenir l’oignon et les épices dans l’huile, ajoute les lentilles, la pulpe et deux fois leur volume d’eau ; 20 min.',
    'Cuis les œufs 10 min, écale-les.',
    'Ajoute les épinards et le jambon en dés aux lentilles, puis les œufs coupés en deux.']);
  v('salade', 'oeufs', 'poischiches', 'Salade de pois chiches, œufs mollets et jambon', 20, 1, {tomate:80, concombre:70, salade:50, oignon:50}, [H1], 'cumin, citron, persil, moutarde', null, [
    'Cuis les œufs 6 min et rafraîchis-les.',
    'Mélange pois chiches cuits, tomate, concombre, oignon rouge, jambon en dés et persil.',
    'Vinaigrette moutarde-citron-cumin ; sur la salade, avec les œufs coupés en deux.']);
  v('gratin', 'oeufs', 'gnocchis', 'Gratin de gnocchis au jambon, épinards et œuf', 30, 0, {epinards:150, champignon:50, oignon:50}, [PARM, LAITS], 'muscade, ail, poivre', null, [
    'Fais tomber les épinards avec l’oignon, l’ail et les champignons à sec.',
    'Mélange gnocchis, légumes, jambon en dés, les œufs battus avec le lait et la muscade.',
    'Parmesan dessus : four à 200 °C, 20 min.']);
  /* Thon */
  v('saute', 'thon', 'riz', 'Riz sauté au thon, œuf et légumes', 20, 1, {petitspois:70, carotte:70, poivron:60, oignon:50}, [H1], 'sauce soja, gingembre, ciboule', null, [
    'Fais sauter l’oignon, la carotte et le poivron en dés dans l’huile, puis les petits pois.',
    'Ajoute le riz cuit (froid, c’est mieux) et l’œuf battu, mélange 2 min.',
    'Le thon émietté, la sauce soja et la ciboule.']);
  v('salade', 'thon', 'pates', 'Salade de pâtes au thon, tomates et olives', 20, 1, {tomate:100, poivron:50, concombre:50, oignon:50}, [H1, OLIVE], 'basilic, vinaigre balsamique, câpres', null, [
    'Cuis les pâtes et rafraîchis-les ; cuis l’œuf 10 min.',
    'Tomate, poivron, concombre et oignon rouge en dés, olives et câpres.',
    'Mélange avec le thon, l’huile, le vinaigre et le basilic ; l’œuf en quartiers.']);
  v('galettes', 'thon', 'pdt', 'Galettes de thon et pommes de terre au air fryer, salade', 35, 1, {salade:100, tomate:100, oignon:50}, [H1], 'persil, ciboulette, citron, moutarde', {skyr:40}, [
    'Cuis les pommes de terre 20 min à l’eau et écrase-les.',
    'Mélange avec le thon, l’œuf battu, les herbes et l’échalote ; forme des galettes, badigeonne-les d’huile : air fryer à 200 °C, 12 min.',
    'Salade et tomates ; sauce skyr, moutarde et citron.']);
  v('farcie', 'thon', 'patate', 'Patate douce farcie au thon, sauce yaourt', 35, 1, {epinards:80, poivron:70, concombre:50, oignon:50}, [H1], 'paprika, ciboulette, citron', {skyr:40}, [
    'Patate douce coupée en deux : four à 200 °C, 30 min (ou micro-ondes 8 min).',
    'Fais revenir l’oignon, le poivron et les épinards dans l’huile, ajoute le thon et l’œuf dur haché.',
    'Garnis la patate douce ; skyr, citron et ciboulette, concombre à côté.']);
  v('galettes', 'thon', 'quinoa', 'Galettes de quinoa au thon, salade de concombre', 30, 1, {concombre:120, salade:80, oignon:50}, [H1], 'persil, cumin, citron', {skyr:40}, [
    'Cuis le quinoa 12 min et laisse tiédir.',
    'Mélange quinoa, thon, œuf battu, persil et cumin ; forme des galettes et dore-les à la poêle dans l’huile, 3 min par face.',
    'Concombre et oignon en lamelles, salade ; sauce skyr citronnée.']);
  v('roties', 'thon', 'semoule', 'Semoule aux légumes rôtis et au thon, sauce harissa-citron', 30, 1, {courgette:80, poivron:70, aubergine:50, oignon:50}, [H1], 'harissa, cumin, citron, coriandre', null, [
    'Courgette, poivron, aubergine et oignon en dés avec l’huile et le cumin : four à 200 °C, 20 min.',
    'Fais gonfler la semoule dans son volume d’eau bouillante.',
    'Mélange légumes, semoule, thon et l’œuf dur en quartiers ; harissa, citron et coriandre.']);
  v('salade', 'thon', 'boulgour', 'Salade de boulgour au thon, poivrons grillés et persil', 20, 1, {poivron:100, tomate:50, concombre:50, oignon:50}, [H1], 'persil, citron, cumin', null, [
    'Cuis le boulgour 10 min et laisse refroidir ; grille le poivron en lanières à la poêle.',
    'Tomate, concombre et oignon en dés, beaucoup de persil.',
    'Mélange avec le thon, l’huile et le citron ; l’œuf dur en quartiers.']);
  v('tomate', 'thon', 'lentilles', 'Lentilles à la tomate et au thon, épinards', 30, 1, {pulpe:100, epinards:100, oignon:50}, [H1], 'ail, cumin, laurier, persil', null, [
    'Fais revenir l’oignon et l’ail dans l’huile, ajoute les lentilles, la pulpe, le laurier et deux fois leur volume d’eau ; 20 min.',
    'Ajoute les épinards, puis le thon émietté.',
    'Sers avec l’œuf dur et le persil.']);
  v('houmous', 'thon', 'poischiches', 'Houmous de pois chiches, thon et crudités', 15, 1, {carotte:80, concombre:70, poivron:50, oignon:50}, [TAHINI, H1], 'citron, ail, cumin, paprika', null, [
    'Mixe les pois chiches cuits avec le tahini, l’huile, le citron, l’ail, le cumin et un peu d’eau.',
    'Coupe carotte, concombre et poivron en bâtonnets, l’oignon en lamelles.',
    'Étale le houmous, pose le thon et l’œuf dur ; paprika, crudités à tremper.']);
  v('courgettes', 'thon', 'gnocchis', 'Gnocchis poêlés au thon, courgettes et citron', 20, 0, {courgette:130, tomate:70, oignon:50}, [H1], 'ail, citron, basilic', null, [
    'Poêle les gnocchis à sec jusqu’à ce qu’ils dorent, puis réserve.',
    'Fais revenir l’oignon et la courgette dans l’huile, ajoute les tomates.',
    'Remets les gnocchis, le thon et l’œuf dur ; citron et basilic.']);
  /* Tofu ferme */
  v('airfryer', 'tofu', 'riz', 'Tofu croustillant au air fryer, riz et légumes sautés', 30, 0, {brocoli:100, carotte:50, poivron:50, oignon:50}, [HSES, SES], 'sauce soja, ail, gingembre, ciboule, fécule de maïs (1 c. à café)', {miel:5}, [
    'Tofu en cubes enrobés de sauce soja puis de fécule : air fryer à 200 °C, 15 min, en secouant.',
    'Fais sauter oignon, carotte, poivron et brocolis dans l’huile de sésame, avec l’ail et le gingembre.',
    'Mélange au tofu avec la sauce soja et le miel ; sur le riz, sésame et ciboule.']);
  v('bolo', 'tofu', 'pates', 'Bolognaise de tofu émietté, pâtes', 30, 1, {oignon:50, carotte:60, pulpe:140}, [H1], 'ail, origan, sauce soja, laurier', null, [
    'Émiette le tofu et dore-le dans l’huile avec un trait de sauce soja.',
    'Ajoute l’oignon, la carotte en petits dés, l’ail, puis la pulpe et les herbes ; 20 min.',
    'Mélange aux pâtes.']);
  v('airfryer', 'tofu', 'pdt', 'Tofu et pommes de terre au air fryer, sauce yaourt aux herbes', 30, 0, {haricotsverts:120, tomate:80, oignon:50}, [H1], 'paprika fumé, ail, ciboulette, citron', {skyr:40}, [
    'Pommes de terre en cubes avec l’huile et le paprika : air fryer à 200 °C, 12 min, puis ajoute le tofu en cubes, 10 min.',
    'Cuis les haricots verts 8 min à la vapeur.',
    'Tomates et oignon en salade ; sauce skyr, ail, ciboulette et citron.']);
  v('curry', 'tofu', 'patate', 'Curry de tofu et patate douce au lait de coco', 35, 1, {epinards:100, poivron:50, oignon:100}, [H1, COCO], 'curry, curcuma, gingembre, ail, coriandre', null, [
    'Fais revenir l’oignon et les épices dans l’huile, ajoute la patate douce en cubes, le poivron et un verre d’eau ; 15 min.',
    'Ajoute le lait de coco et le tofu en cubes ; 5 min.',
    'Les épinards à la fin ; coriandre.']);
  v('saute', 'tofu', 'quinoa', 'Quinoa sauté au tofu, brocolis et gingembre', 25, 1, {brocoli:120, carotte:80, oignon:50}, [HSES], 'sauce soja, gingembre, ail, citron vert', null, [
    'Cuis le quinoa 12 min.',
    'Dore le tofu en cubes dans l’huile, puis l’oignon, la carotte et les brocolis avec l’ail et le gingembre.',
    'Ajoute le quinoa et la sauce soja ; citron vert.']);
  v('taboule', 'tofu', 'semoule', 'Taboulé de semoule au tofu mariné', 20, 1, {tomate:100, concombre:100, oignon:50}, [H1], 'menthe, persil, citron, sauce soja', null, [
    'Fais mariner le tofu en dés dans la sauce soja et le citron, 10 min.',
    'Fais gonfler la semoule dans son volume d’eau bouillante, laisse refroidir ; ajoute les légumes en dés, les herbes et l’huile.',
    'Dore le tofu à la poêle et pose-le dessus.']);
  v('pilaf', 'tofu', 'boulgour', 'Pilaf de boulgour au tofu, aubergine et épices', 35, 1, {aubergine:100, pulpe:50, poivron:50, oignon:50}, [H1], 'cumin, cannelle, paprika, persil', null, [
    'Fais dorer l’aubergine en dés et le tofu dans l’huile, avec les épices.',
    'Ajoute l’oignon, le poivron, le boulgour, la pulpe et deux fois le volume du boulgour d’eau ; 12 min à couvert.',
    'Laisse reposer 5 min ; persil.']);
  v('salade', 'tofu', 'lentilles', 'Salade de lentilles, tofu grillé et carottes', 25, 1, {carotte:80, salade:70, tomate:50, oignon:50}, [H1], 'moutarde, vinaigre de cidre, sauce soja', null, [
    'Cuis les lentilles 20 min et laisse tiédir.',
    'Grille le tofu en tranches avec un trait de sauce soja.',
    'Lentilles, carotte râpée, tomate, échalote ; vinaigrette moutarde ; sur la salade avec le tofu.']);
  v('rotis', 'tofu', 'poischiches', 'Tofu et pois chiches rôtis, sauce tahini', 25, 1, {brocoli:100, poivron:100, oignon:50}, [H1, TAHINI], 'paprika fumé, cumin, citron, ail', null, [
    'Tofu en cubes, pois chiches cuits, brocolis, poivron et oignon avec l’huile et les épices : four (ou air fryer) à 200 °C, 20 min.',
    'Sauce : tahini, citron, ail et un peu d’eau.',
    'Nappe et sers tiède.']);
  v('tomate', 'tofu', 'gnocchis', 'Gnocchis à la tomate, tofu et olives', 20, 0, {pulpe:120, courgette:80, oignon:50}, [H1, OLIVE], 'ail, basilic, origan', null, [
    'Dore le tofu en dés dans l’huile.',
    'Ajoute l’oignon, l’ail, la courgette, la pulpe et les olives ; 10 min.',
    'Ajoute les gnocchis, 3 min ; basilic.']);
  return out;
})();
/* Recettes d'un couple protéine × féculent, dans l'ordre (la première d'abord) */
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
  return Object.keys(x.leg).map(function(v){
    const g = x.leg[v];
    return v === 'oignon' ? it('v-oignon', onionQty(g), onionName(g), onionNote(g), mac(v, g)) : it('v-' + v, grams(g), RFOOD[v][0], RFOOD[v][1], mac(v, g));
  })
    .concat(x.cuis.map(function(c){ return it('f-' + c[0], grams(c[1]), c[2], c[3], mac(c[0], c[1])); }))
    .concat(Object.keys(x.plus).map(function(a){ return it('x-' + a, grams(x.plus[a]), a === 'skyr' ? 'skyr nature' : 'miel', 'pour la sauce', mac(a, x.plus[a])); }));
}
