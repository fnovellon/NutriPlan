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
