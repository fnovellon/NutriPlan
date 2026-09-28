# Nouveautés

## 3.3.2, 28 septembre 2026

- Grande vérification automatique : des milliers de journées tirées au hasard (tous les profils, séances et choix de repas) recalculées et contrôlées règle par règle, et des centaines de manipulations de l'appli simulées. Ce qu'elle a trouvé est corrigé :
  - le jour du repas libre, les autres repas pouvaient différer un peu d'un jour normal et le budget du repas libre ne tombait pas toujours juste (quand l'huile ou le skyr de secours entraient en jeu). Maintenant, la journée est exactement celle d'un jour normal : seul le dîner (avec le skyr du soir s'il y en avait un) devient ton repas libre, avec 300 kcal de plus ;
  - « ½ avocat, ou 15 g d'amandes » : 15 g d'amandes font 89 kcal, le demi-avocat 137. C'est maintenant « ou 25 g d'amandes », et « ou 20 g de parmesan » pour l'œuf dur, quel que soit ton poids ;
  - petites portions : « 1 œuf mariné » au lieu de « 1 œufs marinés », « 1 œuf », « environ une demi-tranche » ;
  - le premier du mois s'écrit « 1er octobre » ;
  - si tes protéines restent sous ton objectif malgré les portions au maximum (thon aux deux repas, objectif haut, sans shaker), la page te le dit et te propose quoi changer ;
  - dans « Tes besoins », les protéines d'un jour de repas libre sont indiquées « hors repas libre », et au-delà de 101 kg (ou sous 47 kg) la page explique que ton objectif et tes portions ne suivent plus ton poids.
- Ces vérifications font maintenant partie des tests, lancés à chaque modification de l'appli.

## 3.3.1, 28 septembre 2026

- Valeurs des aliments vérifiées une à une avec la table Ciqual de l'Anses, la référence française. La plupart étaient justes ; celles qui s'en écartaient (souvent des valeurs américaines) sont corrigées :
  - avocat 195 kcal et 20,6 g de lipides pour 100 g (au lieu de 160 et 15) ;
  - gnocchis 171 kcal (au lieu de 155) ;
  - pain complet 240 kcal, 8,5 g de protéines, 1,5 g de lipides (au lieu de 250, 10 et 3,5) ;
  - fruits rouges 38 kcal (au lieu de 45) ; amandes 590 kcal et 23 g de protéines ;
  - parmesan, bœuf haché 5 %, saumon, crevettes, jambon, chocolat noir : quelques kcal ou grammes d'écart ;
  - riz basmati, quinoa, semoule, boulgour, lentilles, pommes de terre : quelques kcal d'écart ;
  - banane 24 g de glucides et pomme 17,5 g (fibres retirées, comme dans Ciqual) ; compote 60 kcal.
- La page « Comment ça marche » cite la source des valeurs.

## 3.3.0, 28 septembre 2026

- Vérification de toutes les valeurs : les valeurs nutritionnelles des aliments, les poids cuits, les formules de dépense et les totaux de la journée étaient justes. Ce qui clochait, c'était certaines portions (jusqu'à 710 g de pommes de terre, 165 g de lentilles ou 230 g de pain en plus dans un repas, 90 g de poulet). Corrigé :
- Les féculents ne dépassent plus une portion sportive par repas (à 72 kg : 120 g de riz, pâtes, semoule, boulgour ou quinoa crus, 100 g de lentilles, 400 g de pommes de terre ou de patate douce, 300 g de gnocchis ; ça suit ton poids).
- Les grosses journées, le reste devient un budget d'encas (« ≈ 420 kcal d'encas ») à prendre autour de tes séances : pain complet et miel, fruits secs, riz au lait, barre de céréales. Il remplace le pain en plus.
- Tes protéines tiennent ton objectif à 10 % près chaque jour, et la viande, le poisson, les œufs et le skyr restent au plus près du menu de base : ils ne bougent que ce qu'il faut pour entrer dans la fourchette (à 72 kg et 2,0 g/kg, le plus souvent 110 à 140 g de poulet au lieu de 90 à 120 g).
- Le skyr ne descend plus sous 100 g.

## 3.2.0, 28 septembre 2026

- Nouveau réglage : tes protéines en grammes par kilo (2,0 g/kg par défaut, soit environ 144 g à 72 kg). La viande, le poisson, les œufs et le skyr s'ajustent pour y arriver un jour sans séance ; les calories libérées vont aux féculents, ton total ne bouge pas. Jusqu'ici, le menu en donnait 2,2 à 2,8 g/kg : tes portions de viande baissent (poulet ≈ 110 à 120 g au lieu de 180 g). Pour retrouver à peu près l'ancien menu, règle 2,4 g/kg.
- Les jours de séance, tes portions de viande restent les mêmes : ce sont les féculents qui augmentent.
- Choix des plats plus simples : chaque repas n'affiche que ta sélection (protéine, féculent, dessert). Touche-la : l'écran se grise et tous les choix apparaissent ; touche celui que tu veux pour le valider.
- Nouvelle page « Comment ça marche », avec le « ? » en haut à droite (ou depuis les réglages) : le fonctionnement de l'appli expliqué simplement, et les valeurs (calories, protéines, glucides, lipides) de tous les aliments utilisés.

## 3.1.0, 28 septembre 2026

- Dessert au déjeuner et au dîner : aucun, un fruit, une compote ou 20 g de chocolat noir. Ses calories sont prises sur le féculent du même repas, ton total ne bouge pas. Tes choix sont mémorisés pour chaque jour de la semaine.
- Après une séance à midi, le dessert que tu choisis remplace la compote du déjeuner.
- Plus de lignes « huile d'olive » dans les recettes : ta marge cuisine couvre maintenant ta matière grasse de cuisson. Elle passe à 150 kcal par défaut (environ une cuillère à soupe rase d'huile par repas) et compte comme des lipides. Si tu avais réglé ta marge toi-même, pense à la remonter.
- Les jours où tes lipides ou tes protéines restent trop bas, l'huile ou le skyr de secours s'ajustent jusqu'à atteindre ton minimum.
- Tes réglages ont leur propre écran : touche la roue dentée en haut à droite (ou « Régler » sous le total). Le bouton retour de ton téléphone te ramène à ta journée, là où tu étais.
- L'appli a une icône, dans l'onglet du navigateur et sur l'écran d'accueil de ton téléphone.

## 3.0.0, 27 septembre 2026

- Accueil au premier lancement, en trois étapes : ton profil (sexe, âge, taille, poids, activité hors sport), ton objectif (maintenir, perdre doucement, sèche, perdre plus vite, avec tes calories en direct) et tes habitudes (shaker, marge cuisine). Tu peux le refaire depuis « Tes besoins ».
- Plus de calendrier : l'appli montre toujours ta journée d'aujourd'hui. Tes séances et tes choix de repas restent enregistrés, la règle « un repas libre par semaine » aussi.
- Les portions suivent ton poids : le menu est prévu pour 72 kg, il s'adapte de 47 à 101 kg (viande, poisson, œufs, skyr, avoine, huile…), comme tes minimums de protéines et de lipides. Autour de 72 kg, rien ne change.
- Shaker au choix : Oui ou Non dans « Tes besoins ». Sans shaker, un skyr s'ajoute le soir si tes protéines passent sous ton minimum.
- Si tes minimums dépassent ton objectif, la page te propose de baisser la marge cuisine ou de te passer du shaker.

## 2.1.0, 27 septembre 2026

- Marge cuisine : 100 kcal réservées chaque jour pour ce que tu ajoutes en cuisinant (filet d'huile, sauce, fromage râpé…), une ligne au déjeuner et une au dîner. Les féculents s'ajustent, ton total ne bouge pas.
- Réglable de 0 à 300 kcal dans « Tes besoins ».

## 2.0.0, 26 septembre 2026

- Fini les activités par sport : chaque jour, tu ajoutes tes séances par taille, **petite** (muscu, footing ou vélo court), **moyenne** (sortie normale, ≈ 7 km) ou **longue** (1h30 et plus), et tu choisis quand (matin, midi, soir). Jusqu'à 4 séances par jour.
- Calories de chaque taille calculées d'après ton poids (≈ 290, 450 et 500 kcal par heure), réglables dans « Tes besoins ».
- La journée se construit autour de tes séances : collation avant la séance du soir, shaker juste après la dernière, féculents surtout au repas qui suit.
- Plus de semaine type : chaque jour part sans séance (seul le repas libre du samedi reste prévu). Le déficit est maintenant un % de ta dépense d'un jour sans sport, retiré chaque jour, séances toujours couvertes.
- Tes jours déjà enregistrés sont convertis (muscu → petite, course → moyenne, muscu + course → les deux, sortie longue → longue, natation → petite à midi). L'ancien stockage est gardé tel quel.

## 1.6.0, 26 septembre 2026

- Shaker de protéines tous les jours : juste après la séance (après la sortie longue, dans la collation après une séance du matin), dans la collation de l'après-midi les jours de repos.
- Sa composition se règle dans « Tes besoins » : calories (100 à 160 kcal) et protéines par dose, 120 kcal et 24 g par défaut.
- Le total du jour ne change pas : ses calories sont prises sur les féculents.
- Le skyr du soir ne revient plus que si les protéines passent sous 140 g (le shaker couvre la récupération des jours muscu + course).

## 1.5.0, 26 septembre 2026

- Pommes de terre et patate douce : sous le poids cru, le poids cuit à l'eau (≈ le même) et cuit au four (≈ −25 %).

## 1.4.0, 26 septembre 2026

- Sous chaque aliment, ses calories et ses macros en petit (P, G, L : protéines, glucides, lipides).
- Viande, poisson et féculents : le poids cru reste en gros, le poids cuit estimé s'affiche juste en dessous (poulet 180 g cru, ≈ 135 g cuit).

## 1.3.0, 26 septembre 2026

- Choix du besoin calorique : **Automatique** (calculé à partir de ton profil) ou **Manuel** (tu indiques ta dépense d'un jour sans sport, l'appli ajoute tes séances, calculées avec ton poids). En manuel, seuls la dépense et le poids sont demandés.
- En manuel, la dépense doit être entre 1 200 et 6 000 kcal. Cette règle remplace celle de la 1.2.0 (métabolisme de base × 1,2).
- Changer de mode ne perd rien : les valeurs des deux modes restent enregistrées.

## 1.2.0, 26 septembre 2026

- Une dépense saisie à la main plus basse que ce que ton corps dépense sans bouger (métabolisme de base × 1,2) est refusée : la page l'explique et garde le calcul. Le champ précise qu'il faut le total de la journée, pas les calories actives de la montre.
- Un champ laissé en erreur reprend la valeur réellement utilisée quand tu le quittes.
- Numéro de version affiché en bas de page.

## 1.1.0, 26 septembre 2026

- Carte « Tes besoins » : dépense calculée à partir de ton profil (ou saisie), déficit réglable en %, ravito des sorties longues réglable.
- Les séances sont couvertes : le déficit est le même tous les jours, calculé sur ta semaine type.
- Les féculents complètent la journée jusqu'à l'objectif, dosés en calories : changer de féculent ne change plus le total.
- Un seul repas libre par semaine.
- Semaine précédente et suivante, titres relatifs (hier, demain, lundi prochain), retour automatique sur le jour actuel.
- Stockage plus robuste face aux données abîmées.

## 1.0.0

- Version initiale.
