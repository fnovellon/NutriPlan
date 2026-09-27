# Repas du jour

Appli web perso, une seule page : on choisit l'activité du jour et elle affiche tous les repas de la journée avec les quantités, pendant une sèche. Utilisée surtout sur téléphone. Interface en français, tutoiement.

## Objectifs nutritionnels (la source de vérité pour les calculs)

- Sportif d'environ 72 kg, triathlon + muscu orientée force (pas d'hypertrophie).
- Sèche de 8 semaines jusqu'à fin novembre 2026 : objectif −0,3 à −0,5 kg/semaine (≈ 0,4 à 0,7 % du poids, rythme qui préserve le muscle), maintien des charges à la muscu.
- Protéines ~150 g/jour (≈ 2 g/kg, fourchette conseillée en sèche 1,6 à 2,4 g/kg), jamais sous 140 g. Lipides jamais sous 55 g (≈ 0,8 g/kg). Glucides : ce qui reste, périodisés selon l'activité.
- Le menu est écrit pour 72 kg (poids de référence `REF_KG`). Pour d'autres corpulences (l'appli est partagée), les portions suivent le poids (voir « Portions au poids ») et les planchers deviennent : protéines ≥ 140 × k g (≈ 1,95 g/kg), lipides ≥ 55 × k g (≈ 0,76 g/kg), plafond des lipides 95 × k g (≈ 1,3 g/kg) ; `PROT_MIN`, `FAT_MIN`, `FAT_MAX`.
- Les calories du jour ne sont plus des repères fixes : elles viennent de la dépense calculée et du déficit choisi (voir « Dépense et objectif »).
- Pas de planning fixe : chaque jour, l'utilisateur indique les séances faites, par taille (petite, moyenne, longue) et par moment (matin, midi, soir). Les sports ne sont plus distingués, seule compte l'énergie dépensée.
- Un repas libre par semaine, le samedi soir par défaut. L'activer un autre jour retire celui déjà prévu dans la même semaine (lundi → dimanche), avec un message.

## Architecture

- Tout est dans `index.html` : CSS + JavaScript vanilla, aucune dépendance à l'exécution, aucun build. Polices Google Fonts (Archivo, Newsreader) avec polices de secours.
- Le moteur (données + `buildDay`) est pur et testable hors navigateur. L'initialisation du DOM est protégée par `if (typeof document !== 'undefined')` : garder cette séparation.
- Données :
  - `FOOD` : valeurs pour 100 g `[kcal, protéines, glucides, lipides]` ; `UNIT` : valeurs par pièce.
  - `STARCH` : féculents (poids cru, pas d'arrondi, cuissons `cook : [[facteur, accord], …]`, accord du cru `raw`) ; `STARCH_ORDER` pour l'ordre des boutons.
  - Chaque aliment (`it()`) porte ses macros `m` et, si c'est pertinent, `cook : { raw, ways : [{ g, adj }, …] }`, le poids cuit estimé pour chaque cuisson. Viande et poisson : rendements `YIELD` (poids cuit / cru, ≈ table USDA des rendements de cuisson 2012) : poulet 0,75, bœuf haché 0,75, poisson blanc 0,80, saumon 0,80, arrondi à 5 g. Féculents : facteurs de `STARCH` (riz 3, pâtes 2,3, quinoa 2,7, semoule 2,3, boulgour 2,5, lentilles 2,5), arrondi à 10 g. Pommes de terre et patate douce : deux cuissons, à l'eau × 1 (le poids bouge à peine) et au four × 0,75 (≈ 25 % d'eau perdue en morceaux rôtis). Pas de poids cuit pour les gnocchis ni pour les aliments déjà prêts (crevettes cuites, jambon, thon, œufs, halloumi).
  - `PROT` : 7 protéines, chacune avec sa matière grasse ajoutée au déjeuner (`dej`) et au dîner (`diner`) ; `PROT_ORDER`.
  - `IDEAS` : une idée de plat par couple protéine × féculent.
  - `SIZES` (petite, moyenne, longue : titre du bandeau et coût net par kg), `MOMENTS`, `MAX_SEANCES` (4), `DUREES` (longue).
  - Plan d'un jour : `{ seances: [{ taille, moment, duree? }], libre }`. `emptyPlan(js)` (aucune séance, repas libre le samedi), `cleanPlan(p, js)` (validation), `migratePlan(p)` (plan d'avant la 2.0.0 → séances).
  - `DEFAULT_CHOICES` : choix de repas par défaut par jour, indexés par `Date.getDay()` (0 = dimanche).
  - `PROFILE_DEFAULT`, `PROFILE_RANGES`, `NEAT` : profil par défaut, bornes des champs, activité hors sport.
- `seanceCost(séance, profil)`, `dayCost(plan, profil)`. `energy(plan, profil)` renvoie `{ bmr, rest, restSource, cost, need, deficit, target, kgWeek }` (`mode` : `'auto'` ou `'manuel'` ; `restSource` : `'calcul'` ou `'saisie'`).
- `buildDay(plan, choices, profil)` renvoie `{ secs, tot, libre, energy, ecart, scale }` : `secs` est la timeline (repas + bandeaux de séance), `tot` les totaux, `libre` le budget du repas libre, `ecart` l'apport moins l'objectif (hors repas libre), `scale` le facteur de portions `k`. Le profil est facultatif (valeurs par défaut).
- Portions : `scaleOf(profil)` donne `k`, passé explicitement aux constructeurs de repas (`breakfast`, `snackItems`, `gouterItems`, `mainItems` → `PROT[p].base(k)` / `.dej(k)` / `.diner(k)`, `oil(g, k)`, `avocat(k)`) ; `sc(g, pas, k)` arrondit au pas, `pieces(n, k)` à l'unité, `slices(g, par)` écrit « 2 tranches » ou « environ 3 tranches ».

## Dépense et objectif (à respecter)

- Métabolisme de base : Mifflin-St Jeor (`10 × kg + 6,25 × cm − 5 × âge + 5`, `− 161` pour une femme). Si la masse grasse est saisie : Cunningham (`500 + 22 × masse maigre`), plus juste chez les sportifs d'endurance.
- Deux modes, au choix en tête de la carte « Tes besoins » :
  - **Automatique** (par défaut) : dépense un jour de repos = métabolisme de base × activité hors sport (assis 1,4, mixte 1,55, debout 1,7 ; effet thermique des repas compris). Paramètres affichés : sexe, âge, taille, poids, masse grasse, hors sport.
  - **Manuel** : l'utilisateur saisit sa dépense totale d'un jour sans sport (pas les calories actives d'une montre), entre 1 200 et 6 000 kcal. Seuls la dépense et le poids sont affichés : le poids sert au coût des séances. Hors bornes : champ en erreur avec un message, valeur non enregistrée, la dernière valeur valide revient quand on quitte le champ. Sans dépense valide, le calcul automatique prend le relais et la carte le dit.
  - Changer de mode ne perd rien : les valeurs des deux modes restent enregistrées.
- Coût net d'une séance (le repos est déjà compté), réglable dans le profil (`kcalPetite` 100-1 000, `kcalMoyenne` 150-1 500, `kcalLongueH` 200-1 200 ; vide = calcul) :
  - petite (muscu, footing ou vélo court, natation) : 4 × poids, ≈ 1 h de muscu à 5 MET (Compendium des activités physiques, Ainsworth 2011) ;
  - moyenne (sortie normale, ≈ 7 km de course) : 6,3 × poids (≈ 0,9 kcal/kg/km nets × 7 km) ;
  - longue (1h30 à 3 h et plus, toujours le matin, une par jour au plus) : 7 × poids par heure (vélo d'endurance à 8 MET).
- Dépense du jour = dépense de repos + somme des séances (4 au plus).
- Déficit : un % (0 à 25, 15 par défaut) de la dépense d'un jour sans sport, retiré de la même façon chaque jour. Les séances restent donc entièrement couvertes et la disponibilité énergétique reste la même tous les jours. Plus de semaine type.
- Objectif du jour = dépense du jour − déficit, arrondi à 10 kcal. Perte estimée = déficit × 7 / 7 700 kg par semaine.
- Alertes : déficit au-delà de 20 % ; en automatique, si la masse grasse est connue, disponibilité énergétique `(dépense de repos − déficit) / masse maigre` sous 30 kcal/kg.
- Profil par défaut tant que rien n'est saisi : homme, 35 ans, 178 cm, 72 kg, assis, déficit 15 %, ravito 60 g/h, shaker oui (120 kcal et 24 g de protéines), marge cuisine 100 kcal. La page demande de compléter âge, taille et poids.

## Règles de calcul (à respecter)

- Féculents : ils complètent la journée jusqu'à l'objectif. Énergie à répartir = objectif − tout le reste (petit-déjeuner, collation, shaker, protéines, matières grasses, légumes, marge cuisine, ravito, skyr du soir).
- Répartition déjeuner / dîner selon les séances qui précèdent chaque repas (A = coût des séances du matin et de midi, B = du soir) : déjeuner 45 + 0,05 × A, dîner 30 + 0,02 × A + 0,07 × B (poids relatifs).
- Dosage en calories, pas en glucides : changer de féculent ne change pas le total de la journée (plus d'exception pour les lentilles ou le quinoa). Quantité arrondie au pas (5 g pour les grains, 10 g pour tubercules et gnocchis). Poids cru affiché avec l'équivalent cuit.
- Chaque féculent reste entre 90 × k et 550 × k kcal par repas (20 à 120 g de glucides sous forme de riz à 72 kg). Si l'un atteint une limite, l'autre compense. Si les deux sont au plafond, du pain complet s'ajoute à la collation (ou au goûter) « pour couvrir ta séance ». Si les deux sont au plancher, l'apport dépasse l'objectif et la page le dit.
- Petit-déjeuner : 60 g d'avoine (ou 80 g de pain complet) + 250 g de skyr + fruit (fruits rouges, banane s'il y a une séance moyenne ou longue) + 15 g d'amandes. Sortie longue : 80 g d'avoine (ou 110 g de pain) + 150 g de skyr + banane + 15 g de miel + 15 g d'amandes.
- Collation : 2 œufs marinés, + banane s'il y a une séance, + compote s'il y a une moyenne ou une longue. Goûter les jours de sortie longue : 150 g de skyr + pomme + 15 g d'amandes.
- Timing (un bandeau par séance, à son moment ; une seule collation) : séance le soir → collation 1h30 avant, dîner après. Séance le matin sans séance le soir → petit-déjeuner 1h30 avant, collation juste après. Sans séance, collation l'après-midi. Sortie longue toujours le matin, ravito à 60 g de glucides par heure par défaut, réglable de 30 à 90 g/h (repère : 30-60 g/h jusqu'à 2h30, jusqu'à 90 g/h au-delà).
- Séance à midi : banane vers 11 h 30, déjeuner après la séance avec une compote.
- Shaker de protéines tous les jours si `shaker` vaut `'oui'` (défaut ; `'non'` : ni section ni ligne, le skyr du soir compense au besoin), une dose à l'eau, repas libre compris. Composition du profil : `shakerKcal` (100 à 160, défaut 120) et `shakerProt` (10 à 40 g, défaut 24) ; protéines limitées à kcal / 4, le reste des kcal partagé à parts égales entre glucides et lipides (`shakerMac`). Placement : juste après la dernière séance du jour (section « Shaker » après son bandeau, ou dans la collation qui suit une séance du matin) ; sans séance, dans la collation de l'après-midi.
- Marge cuisine : `marge` du profil (0 à 300 kcal, défaut 100), réservée pour les ajouts en cuisinant (filet d'huile, sauce, fromage râpé ; les épices ne comptent pas). Une ligne « ≈ 50 kcal pour la cuisine » au déjeuner (moitié arrondie à 5) et au dîner (le reste), aucune si la marge vaut 0. Macros nulles (composition inconnue), seulement des kcal : les féculents baissent d'autant, le total du jour ne bouge pas.
- Repas libre : remplace le dîner, budget = kcal du dîner normal + 300 × k, arrondi à 50. Le total affiché l'inclut (« dont X kcal de repas libre »), les macros sont hors repas libre.
- « Soir : 150 g de skyr » (× k) ajouté seulement si les protéines passent sous 140 × k g (jamais les jours de repas libre). Le shaker couvre la récupération, y compris les jours à plusieurs séances.
- Lipides de secours : si les lipides restent sous 55 × k g (arrondis de l'huile chez les petits gabarits), de l'huile d'olive s'ajoute au dîner « en plus, pour tes lipides » (jamais les jours de repas libre), puis les féculents se réajustent.
- Si l'apport dépasse l'objectif de plus de 3 % (féculents au plancher, surtout sous 60 kg), la page le dit et propose de baisser la marge cuisine ou de se passer du shaker.

## Portions au poids (à respecter)

- `k = poids / 72`, borné à 0,65-1,4 (≈ 47 à 101 kg). À 71, 72 ou 73 kg, les portions sont exactement celles des règles ci-dessus (arrondis).
- Multipliés par k : protéines du déjeuner et du dîner, matières grasses des recettes, petit-déjeuner, collation, goûter, skyr du soir, planchers et plafond (protéines, lipides, féculents), supplément du repas libre. Arrondis : 10 g pour viande, poisson, crevettes, skyr, pain ; 5 g pour avoine, amandes, huile, parmesan, miel, halloumi, jambon ; œufs à l'unité (au moins 1). Notes recalculées (tranches de pain et de jambon, amandes en remplacement de l'avocat).
- Inchangés : légumes, fruits à l'unité, ½ avocat, boîte de thon, shaker (dose saisie), ravito (g/h), marge cuisine (kcal saisies).
- Exemples : 52 kg (k ≈ 0,72) → poulet 130 g, skyr 180 g, 2 œufs ; 100 kg → poulet 250 g.
- Garde-fous vérifiés par les tests, pour 12 journées types de 0 à 4 séances × toutes les combinaisons de repas avec le profil par défaut (hors repas libre) : apport à ±3 % de l'objectif, protéines ≥ 140 g, lipides entre 55 et 95 g, féculents entre leurs limites. Avec 0 et 25 % de déficit : protéines ≥ 140 g, lipides ≥ 55 g, jamais plus de 3 % sous l'objectif, au-dessus seulement si les féculents sont au plancher. Pour 52 kg (20 %), 58 kg (avec et sans shaker ni marge), 85 kg et 100 kg (10 %), sur les 12 journées types × toutes les protéines : planchers et plafonds × k, jamais plus de 3 % sous l'objectif, au-dessus seulement si les féculents sont au plancher. Sans shaker : protéines ≥ 140 g. Formules vérifiées sur des valeurs calculées à la main.

## Stockage

- `localStorage`, clé `repas-du-jour:v2` : `{ plans: { 'AAAA-MM-JJ': { seances, libre } }, choices: { getDay: choix } }`. Les séances sont mémorisées par date, les choix de protéines et féculents par jour de la semaine. Plans purgés après 21 jours.
- Migration 2.0.0 : si `v2` n'existe pas, `repas-du-jour:v1` (`{ activity, moment, duree, natation, libre }` par date) est convertie avec `migratePlan` (repos → aucune séance ; muscu → petite ; course → moyenne ; muscu + course → petite + moyenne, au moment enregistré ; sortie longue → longue ; natation → + petite à midi), les choix sont repris, `v2` est écrite et `v1` laissée intacte.
- Toujours en try/catch : l'appli doit fonctionner sans stockage ou avec un stockage corrompu (JSON invalide, valeur qui n'est pas un objet). Les identifiants relus (taille, moment, protéine, féculent) sont validés avec `has()` (propriété propre), jamais avec `OBJ[clé]` qui laisserait passer `constructor` ou `__proto__`.
- Pas de calendrier (retiré en 3.0.0, récupérable depuis le commit `eb38a17`) : la page montre toujours aujourd'hui (« Aujourd'hui, samedi 27 septembre »). Les dates de la semaine en cours servent seulement à la règle du repas libre. Si la page reste ouverte d'un jour à l'autre, elle revient sur le nouveau jour au retour sur l'onglet (`focus`, `visibilitychange`, `pageshow`).
- Profil : clé séparée `repas-du-jour:profil:v1`, seulement les champs saisis `{ mode, sexe, age, taille, poids, gras, neat, repos, deficit, ravito, shaker, shakerKcal, shakerProt, kcalPetite, kcalMoyenne, kcalLongueH, marge }`, relus avec `profileFields()` (bornes de `PROFILE_RANGES`). Un champ vidé reprend sa valeur par défaut. La clé `v1` n'a pas changé de forme (3.0.0 : champ `shaker` ajouté, absent = `'oui'`).
- Migration du profil (1.3.0, champ `mode` ajouté) : un profil sans `mode` est lu en `'manuel'` s'il contient une dépense valide, sinon en `'auto'` (`cleanProfile`), et le mode déduit est fixé au chargement.
- Si le format change, passer à une nouvelle clé (v2) ou migrer, sans casser les données existantes.

## Version

- Une seule source : `APP_VERSION` dans `index.html`, identique au champ `version` de `package.json` (et de `package-lock.json`, régénéré avec `npm install --package-lock-only`). Affichée en bas de page avec un lien vers `CHANGELOG.md`.
- Semver : correctif → patch (1.2.1), nouveauté → mineure (1.3.0), changement incompatible (refonte des calculs, format de stockage) → majeure (2.0.0).
- À chaque changement visible : nouvelle version et entrée en tête de `CHANGELOG.md` (en français, pour l'utilisateur), dans le même commit. Les tests vérifient que les trois concordent.

## Design

- Palette : papier `#EEF1EB`, encre `#1A2620`, betterave `#8A2657` (bandeau de séance, focus, alertes), protéines `#2E5C8A`, glucides `#B37E17`, lipides `#667624`. Mode sombre via `prefers-color-scheme` et l'attribut `data-theme`.
- Typographie : Archivo pour les titres et les grammes (chiffres larges et gras, c'est l'élément signature), Newsreader pour les noms d'aliments.
- Timeline verticale des repas, bandeau betterave pour chaque séance (« Petite séance », « Séance moyenne », « Sortie longue »).
- Séances du jour : une ligne par séance (nom, bouton pour la retirer, moment Matin / Midi / Soir ou durée pour la longue), puis trois boutons « + Petite », « + Moyenne », « + Longue » (désactivés à 4 séances, « + Longue » s'il y en a déjà une). « Repos, pas de séance. » quand la liste est vide.
- Ligne d'un aliment : à gauche le poids cru en gros et, s'il existe, « cru » puis une ligne par cuisson en petit dessous (« ≈ 135 g cuit », ou « ≈ 340 g à l'eau » et « ≈ 260 g au four ») ; à droite le nom, la note, puis les calories et les macros en petit (« 198 kcal  P 41 g  G 0 g  L 3 g », petits carrés aux couleurs de la légende, lettres P, G, L expliquées en pied de page). Pas de ligne de macros pour le repas libre ni pour la marge cuisine, qui ne sont que des budgets.
- À éviter : labels en capitales, surtitres, séparateurs à point médian, cartes identiques avec ombre.
- Mobile d'abord : `viewport-fit=cover` et marges safe-area, jamais de défilement horizontal de la page (les rangées de boutons défilent dans leur conteneur), focus visible, `prefers-reduced-motion` respecté.
- Typographie française : espace insécable avant `: ? %` et entre un nombre et son unité.

## Commandes

- Voir l'appli : ouvrir `index.html` dans un navigateur.
- Tests : `npm install` puis `npm test` (moteur de calcul + simulation de l'interface avec jsdom). Les lancer après chaque modification.
- Le test d'interface tourne à date fixe (mercredi 7 octobre 2026, horloge simulée) : il ne doit jamais dépendre du jour réel.
