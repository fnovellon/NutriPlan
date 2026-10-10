/** Types des objets du moteur, pour la lecture (commentaires JSDoc, sans effet sur le code).
 * @typedef {{kcal:number, p:number, c:number, f:number}} Macros  kcal et grammes de protéines, glucides, lipides
 * @typedef {{id:string, g?:number, n?:number, kcal?:number}} Buy  ce qu'il faut acheter : grammes crus, pièces, ou budget
 * @typedef {{raw:string, ways:{g:number, adj:string}[]}} Cook  poids cuit estimé par cuisson : {raw:'cru', ways:[{g:135, adj:'cuit'}]}
 * @typedef {{key:string, qty:string, name:string, note:?string, m:?Macros, cook:?Cook, buy:?Buy, adj?:boolean}} Item
 *   ligne d'un repas (it). key : base, skyr, fruit, am, miel, oeufs, jambon, et depuis la 3.29.0 lait, cacao, fr, pain, epi,
 *   chp, tort, tom (petit-déjeuner) ; oe, ban, comp, csk, cam, et mfo, mfe, mfp, mko, mks, mka, mkc, tht, thc, ths, thg, rzr,
 *   rzl, rzs, bof, bos, boa (collation) ;
 *   p1, p2 (protéine), st (féculent), leg (légumes), v-<légume>, f-<matière grasse>, x-skyr, x-miel (recette), dam, pm (ajout du
 *   soir), marge, des (dessert), gras (huile de secours) ; shk, fuel, pom, encas, skyr (soir), lib (repas libre).
 *   adj : portion ajustée à l'objectif de protéines.
 * @typedef {{id:string, title:string, when:?string, items:Item[], pick?:string, band?:boolean, moment?:string, kcal?:number,
 *   sub?:?string, libre?:boolean, recipe?:?string, suggest?:?string, cs?:boolean}} Section
 *   repas (id pd, sw, dej, co, shk, diner, soir) ou bandeau de séance (band0, band1…, band:true ; moment et coût de la
 *   séance pour la frise et la carte de la page, 3.20.0) ; recipe : recette choisie, suggest : recette proposée pour le
 *   couple protéine × féculent ; libre : le repas libre qui remplace le dîner ; pick : le choix du repas (pd, dej, diner, co) ;
 *   cs : la collation a aussi sa partie glucides au choix (3.29.0).
 * @typedef {{taille:('petite'|'moyenne'|'longue'), moment:('matin'|'midi'|'soir'), duree?:number}} Seance
 * @typedef {{seances:Seance[], libre:boolean, imprevu?:{slot:string, kcal:number, mode:string}, veille?:number, jour?:number}} Plan  plan d'un jour (cleanPlan ;
 *   imprevu : 3.26.0 ; veille : durée en heures de la sortie longue du lendemain, ajoutée par l'interface, 3.28.0 ; jour : numéro du jour, pour faire tourner
 *   la recette proposée, 3.31.0)
 * @typedef {{jours:Object<string, Seance[]>, libre:number}} Week  semaine type : séances par jour (getDay), jour du repas libre
 * @typedef {{prot:string, starch:string, dessert?:string, recette?:string}} MealChoice  plats du déjeuner ou du dîner
 * @typedef {{pdBase:string, dej:MealChoice, diner:MealChoice, co?:string, cs?:string}} Choices  plats d'un jour ; co, cs : collation
 *   (SNACK, SNACK_CS, 3.29.0), absentes = œufs durs, banane et compote
 * @typedef {Object} Profile  profil complet (cleanProfile) : les champs de PROFILE_DEFAULT, off, fav, ban et semaine validés
 * @typedef {{bmr:number, rest:number, mode:string, restSource:string, cost:number, need:number, deficit:number, target:number,
 *   kgWeek:number, recharge:number}} Energy  dépense et objectif du jour (energy ; recharge : grammes de glucides en plus la veille d'une
 *   sortie longue, 3.28.0)
 * @typedef {{secs:Section[], tot:Macros, libre:?number, imprevu:?{slot:string, kcal:number, mode:string, delta:number, over:number}, energy:Energy, ecart:number, scale:number,
 *   prot:{target:number, low:number, high:number, floor:number, factor:number}}} Day  journée construite (buildDay)
 */
