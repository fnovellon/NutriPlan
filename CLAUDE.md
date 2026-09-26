# Repas du jour

Appli web perso, une seule page : on choisit l'activité du jour et elle affiche tous les repas de la journée avec les quantités, pendant une sèche. Utilisée surtout sur téléphone. Interface en français, tutoiement.

## Objectifs nutritionnels (la source de vérité pour les calculs)

- Sportif d'environ 72 kg, triathlon + muscu orientée force (pas d'hypertrophie).
- Sèche de 8 semaines jusqu'à fin novembre 2026 : déficit d'environ 400-500 kcal/jour, objectif −0,3 à −0,5 kg/semaine, maintien des charges à la muscu.
- Protéines ~150 g/jour (≈ 2 g/kg), jamais sous 140 g. Lipides ~60 g, jamais sous 55 g. Glucides périodisés selon l'activité.
- Repères kcal : repos ~1 800 ; muscu ~2 000 ; course (~1 h) ~2 300 ; muscu + course ~2 450 ; sortie longue 1h30+ de ~2 600 à ~2 900 selon la durée (ravito compris).
- Planning habituel : muscu lundi et vendredi (soir), course mardi et jeudi (soir) et dimanche (matin), vélo long samedi matin, mercredi repos. Natation parfois entre midi et deux (en pause pour l'instant).
- Un repas libre par semaine, le samedi soir par défaut.

## Architecture

- Tout est dans `index.html` : CSS + JavaScript vanilla, aucune dépendance à l'exécution, aucun build. Polices Google Fonts (Archivo, Newsreader) avec polices de secours.
- Le moteur (données + `buildDay`) est pur et testable hors navigateur. L'initialisation du DOM est protégée par `if (typeof document !== 'undefined')` : garder cette séparation.
- Données :
  - `FOOD` : valeurs pour 100 g `[kcal, protéines, glucides, lipides]` ; `UNIT` : valeurs par pièce.
  - `STARCH` : féculents (poids cru, pas d'arrondi, facteur de cuisson) ; `STARCH_ORDER` pour l'ordre des boutons.
  - `PROT` : 7 protéines, chacune avec sa matière grasse ajoutée au déjeuner (`dej`) et au dîner (`diner`) ; `PROT_ORDER`.
  - `IDEAS` : une idée de plat par couple protéine × féculent.
  - `CARBS` : glucides apportés par le féculent de chaque repas, par activité.
  - `DEFAULT_PLAN` / `DEFAULT_CHOICES` : valeurs par défaut par jour, indexées par `Date.getDay()` (0 = dimanche).
- `buildDay(plan, choices)` renvoie `{ secs, tot, libre }` : `secs` est la timeline (repas + bandeaux de séance), `tot` les totaux, `libre` le budget du repas libre.

## Règles de calcul (à respecter)

- Féculent : quantité calculée pour apporter les glucides cibles du repas (`CARBS`), arrondie au pas (5 g pour les grains, 10 g pour tubercules et gnocchis). Poids cru affiché avec l'équivalent cuit.
- Exception lentilles : équivalence sur glucides + protéines par rapport au riz, sinon la portion apporte trop de calories.
- Glucides du féculent (déjeuner / dîner) : repos 45 / 30, muscu 55 / 45, course 55 / 85, muscu + course 55 / 85, sortie longue 85 / 60.
- Petit-déjeuner : 60 g d'avoine (ou 80 g de pain complet) + 250 g de skyr + fruit (fruits rouges, banane les jours de course) + 15 g d'amandes. Sortie longue : 80 g d'avoine (ou 110 g de pain) + 150 g de skyr + banane + 15 g de miel + 15 g d'amandes.
- Collation : 2 œufs marinés, + banane (muscu, course), + compote (course, muscu + course). Goûter de sortie longue : 150 g de skyr + pomme + 15 g d'amandes.
- Timing : séance le soir → collation 1h30 avant, dîner après. Séance le matin → petit-déjeuner 1h30 avant, collation juste après. Sortie longue toujours le matin, ravito à 45 g de glucides par heure (fourchette 30-60 g/h).
- Natation à midi : banane avant, compote au déjeuner.
- Repas libre : remplace le dîner, budget = kcal du dîner normal + 300, arrondi à 50. Les macros affichées sont hors repas libre.
- « Soir : 150 g de skyr » ajouté automatiquement les jours muscu + course, ou si les protéines passent sous 140 g (jamais les jours de repas libre).
- Garde-fous vérifiés par les tests : protéines ≥ 140 g et lipides entre 50 et 95 g pour toutes les combinaisons (hors repas libre), totaux des jours par défaut proches des repères.

## Stockage

- `localStorage`, clé `repas-du-jour:v1` : `{ plans: { 'AAAA-MM-JJ': plan }, choices: { getDay: choix } }`. L'activité est mémorisée par date, les choix de protéines et féculents par jour de la semaine. Plans purgés après 21 jours.
- Toujours en try/catch : l'appli doit fonctionner sans stockage ou avec un stockage corrompu.
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
