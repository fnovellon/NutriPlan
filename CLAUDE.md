# Repas du jour

Appli web perso, une seule page : on choisit l'activité du jour et elle affiche tous les repas de la journée avec les quantités, pendant une sèche. Utilisée surtout sur téléphone. Interface en français, tutoiement.

## Objectifs nutritionnels (la source de vérité pour les calculs)

- Sportif d'environ 72 kg, triathlon + muscu orientée force (pas d'hypertrophie).
- Sèche de 8 semaines jusqu'à fin novembre 2026 : objectif −0,3 à −0,5 kg/semaine (≈ 0,4 à 0,7 % du poids, rythme qui préserve le muscle), maintien des charges à la muscu.
- Protéines ~150 g/jour (≈ 2 g/kg, fourchette conseillée en sèche 1,6 à 2,4 g/kg), jamais sous 140 g. Lipides jamais sous 55 g (≈ 0,8 g/kg). Glucides : ce qui reste, périodisés selon l'activité.
- Les calories du jour ne sont plus des repères fixes : elles viennent de la dépense calculée et du déficit choisi (voir « Dépense et objectif »).
- Planning habituel : muscu lundi et vendredi (soir), course mardi et jeudi (soir) et dimanche (matin), vélo long samedi matin, mercredi repos. Natation parfois entre midi et deux (en pause pour l'instant).
- Un repas libre par semaine, le samedi soir par défaut. L'activer un autre jour retire celui déjà prévu dans la même semaine (lundi → dimanche), avec un message.

## Architecture

- Tout est dans `index.html` : CSS + JavaScript vanilla, aucune dépendance à l'exécution, aucun build. Polices Google Fonts (Archivo, Newsreader) avec polices de secours.
- Le moteur (données + `buildDay`) est pur et testable hors navigateur. L'initialisation du DOM est protégée par `if (typeof document !== 'undefined')` : garder cette séparation.
- Données :
  - `FOOD` : valeurs pour 100 g `[kcal, protéines, glucides, lipides]` ; `UNIT` : valeurs par pièce.
  - `STARCH` : féculents (poids cru, pas d'arrondi, facteur de cuisson) ; `STARCH_ORDER` pour l'ordre des boutons.
  - `PROT` : 7 protéines, chacune avec sa matière grasse ajoutée au déjeuner (`dej`) et au dîner (`diner`) ; `PROT_ORDER`.
  - `IDEAS` : une idée de plat par couple protéine × féculent.
  - `SPLIT` : répartition des féculents entre déjeuner et dîner, par activité (poids relatifs).
  - `DEFAULT_PLAN` / `DEFAULT_CHOICES` : valeurs par défaut par jour, indexées par `Date.getDay()` (0 = dimanche). `DEFAULT_PLAN` sert aussi de « semaine type » pour la dépense moyenne.
  - `PROFILE_DEFAULT`, `PROFILE_RANGES`, `NEAT`, `SESSION` : profil par défaut, bornes des champs, activité hors sport, séances (MET et durée).
- `energy(plan, profil)` renvoie `{ bmr, rest, cost, need, avg, deficit, target, kgWeek }`.
- `buildDay(plan, choices, profil)` renvoie `{ secs, tot, libre, energy, ecart }` : `secs` est la timeline (repas + bandeaux de séance), `tot` les totaux, `libre` le budget du repas libre, `ecart` l'apport moins l'objectif (hors repas libre). Le profil est facultatif (valeurs par défaut).

## Dépense et objectif (à respecter)

- Métabolisme de base : Mifflin-St Jeor (`10 × kg + 6,25 × cm − 5 × âge + 5`, `− 161` pour une femme). Si la masse grasse est saisie : Cunningham (`500 + 22 × masse maigre`), plus juste chez les sportifs d'endurance.
- Dépense un jour de repos = métabolisme de base × activité hors sport (assis 1,4, mixte 1,55, debout 1,7 ; effet thermique des repas compris). Ou la valeur saisie à la main, qui remplace le calcul.
- Coût net d'une séance = (MET − 1) × poids × durée (Compendium des activités physiques, Ainsworth 2011) : muscu 5 MET pendant 1 h, course 9,8 MET (≈ 10 km/h) pendant 1 h, sortie longue 8 MET (vélo d'endurance) sur la durée choisie, natation 7 MET pendant 45 min. Muscu + course = les deux.
- Dépense du jour = dépense de repos + coût de la séance.
- Déficit : un % (0 à 25, 15 par défaut) de la dépense moyenne de la semaine type (`DEFAULT_PLAN`), retiré de la même façon chaque jour. Les séances restent donc entièrement couvertes et la disponibilité énergétique reste la même tous les jours.
- Objectif du jour = dépense du jour − déficit, arrondi à 10 kcal. Perte estimée = déficit × 7 / 7 700 kg par semaine.
- Alertes : déficit au-delà de 20 % ; si la masse grasse est connue, disponibilité énergétique `(dépense de repos − déficit) / masse maigre` sous 30 kcal/kg.
- Profil par défaut tant que rien n'est saisi : homme, 35 ans, 178 cm, 72 kg, assis, déficit 15 %, ravito 60 g/h. La page demande de compléter âge, taille et poids.

## Règles de calcul (à respecter)

- Féculents : ils complètent la journée jusqu'à l'objectif. Énergie à répartir = objectif − tout le reste (petit-déjeuner, collation, protéines, matières grasses, légumes, ravito, skyr du soir).
- Répartition déjeuner / dîner (`SPLIT`) : repos 45 / 30, muscu 55 / 45, course 55 / 85, muscu + course 55 / 85, sortie longue 85 / 60.
- Dosage en calories, pas en glucides : changer de féculent ne change pas le total de la journée (plus d'exception pour les lentilles ou le quinoa). Quantité arrondie au pas (5 g pour les grains, 10 g pour tubercules et gnocchis). Poids cru affiché avec l'équivalent cuit.
- Chaque féculent reste entre 90 et 550 kcal par repas (20 à 120 g de glucides sous forme de riz). Si l'un atteint une limite, l'autre compense. Si les deux sont au plafond, du pain complet s'ajoute à la collation (ou au goûter) « pour couvrir ta séance ». Si les deux sont au plancher, l'apport dépasse l'objectif et la page le dit.
- Petit-déjeuner : 60 g d'avoine (ou 80 g de pain complet) + 250 g de skyr + fruit (fruits rouges, banane les jours de course) + 15 g d'amandes. Sortie longue : 80 g d'avoine (ou 110 g de pain) + 150 g de skyr + banane + 15 g de miel + 15 g d'amandes.
- Collation : 2 œufs marinés, + banane (muscu, course), + compote (course, muscu + course). Goûter de sortie longue : 150 g de skyr + pomme + 15 g d'amandes.
- Timing : séance le soir → collation 1h30 avant, dîner après. Séance le matin → petit-déjeuner 1h30 avant, collation juste après. Sortie longue toujours le matin, ravito à 60 g de glucides par heure par défaut, réglable de 30 à 90 g/h (repère : 30-60 g/h jusqu'à 2h30, jusqu'à 90 g/h au-delà).
- Natation à midi : banane avant, compote au déjeuner.
- Repas libre : remplace le dîner, budget = kcal du dîner normal + 300, arrondi à 50. Le total affiché l'inclut (« dont X kcal de repas libre »), les macros sont hors repas libre.
- « Soir : 150 g de skyr » ajouté automatiquement les jours muscu + course, ou si les protéines passent sous 140 g (jamais les jours de repas libre).
- Garde-fous vérifiés par les tests, pour toutes les combinaisons avec le profil par défaut (hors repas libre) : apport à ±3 % de l'objectif, protéines ≥ 140 g, lipides entre 55 et 95 g, féculents entre leurs limites. Avec 0 et 25 % de déficit : protéines ≥ 140 g, lipides ≥ 55 g, jamais plus de 3 % sous l'objectif, au-dessus seulement si les féculents sont au plancher. Formules vérifiées sur des valeurs calculées à la main.

## Stockage

- `localStorage`, clé `repas-du-jour:v1` : `{ plans: { 'AAAA-MM-JJ': plan }, choices: { getDay: choix } }`. L'activité est mémorisée par date, les choix de protéines et féculents par jour de la semaine. Plans purgés après 21 jours.
- Toujours en try/catch : l'appli doit fonctionner sans stockage ou avec un stockage corrompu (JSON invalide, valeur qui n'est pas un objet). Les identifiants relus (activité, protéine, féculent) sont validés avec `has()` (propriété propre), jamais avec `OBJ[clé]` qui laisserait passer `constructor` ou `__proto__`.
- Navigation : semaine en cours, précédente et suivante (flèches). Le titre et la date sont relatifs (hier, aujourd'hui, demain, « lundi prochain »). Si la page reste ouverte d'un jour à l'autre, elle revient sur le nouveau jour au retour sur l'onglet (`focus`, `visibilitychange`, `pageshow`).
- Profil : clé séparée `repas-du-jour:profil:v1`, seulement les champs saisis `{ sexe, age, taille, poids, gras, neat, repos, deficit, ravito }`, relus avec `profileFields()` (bornes de `PROFILE_RANGES`). Un champ vidé reprend sa valeur par défaut. La clé `v1` n'a pas changé de forme.
- Si le format change, passer à une nouvelle clé (v2) ou migrer, sans casser les données existantes.

## Design

- Palette : papier `#EEF1EB`, encre `#1A2620`, betterave `#8A2657` (bandeau de séance, jour actuel, focus), protéines `#2E5C8A`, glucides `#B37E17`, lipides `#667624`. Mode sombre via `prefers-color-scheme` et l'attribut `data-theme`.
- Typographie : Archivo pour les titres et les grammes (chiffres larges et gras, c'est l'élément signature), Newsreader pour les noms d'aliments.
- Timeline verticale des repas, bandeau betterave pour la séance.
- À éviter : labels en capitales, surtitres, séparateurs à point médian, cartes identiques avec ombre.
- Mobile d'abord : `viewport-fit=cover` et marges safe-area, jamais de défilement horizontal de la page (les rangées de boutons défilent dans leur conteneur), focus visible, `prefers-reduced-motion` respecté.
- Typographie française : espace insécable avant `: ? %` et entre un nombre et son unité.

## Commandes

- Voir l'appli : ouvrir `index.html` dans un navigateur.
- Tests : `npm install` puis `npm test` (moteur de calcul + simulation de l'interface avec jsdom). Les lancer après chaque modification.
- Le test d'interface tourne à date fixe (mercredi 7 octobre 2026, horloge simulée) : il ne doit jamais dépendre du jour réel.
