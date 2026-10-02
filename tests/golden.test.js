// Journées de référence : 28 journées types écrites en clair dans tests/golden.txt (portions, poids cuits, totaux).
// Tout changement du moteur qui touche une portion fait échouer ce test et montre les lignes qui changent.
// Changement voulu : npm run golden (réécrit tests/golden.txt), puis relire le diff avant de le committer.
const fs = require('fs');
const path = require('path');
const { loadEngine } = require('./lib');

const A = loadEngine();
const FILE = path.join(__dirname, 'golden.txt');
const update = process.argv.includes('--update') || process.env.UPDATE_GOLDEN === '1';

const petite = moment => ({ taille: 'petite', moment });
const moyenne = moment => ({ taille: 'moyenne', moment });
const longue = duree => ({ taille: 'longue', moment: 'matin', duree });
const choices = (js, extra) => Object.assign(JSON.parse(JSON.stringify(A.DEFAULT_CHOICES[js])), extra || {});
const meal = (prot, starch, dessert) => ({ prot, starch, dessert: dessert || 'aucun' });
const rec = (prot, starch, dessert) => Object.assign(meal(prot, starch, dessert), { recette: prot + '-' + starch });
const SETS = [
  ['repos', []],
  ['petite le soir', [petite('soir')]],
  ['petite le matin', [petite('matin')]],
  ['petite à midi', [petite('midi')]],
  ['moyenne le soir', [moyenne('soir')]],
  ['moyenne le matin', [moyenne('matin')]],
  ['petite + moyenne le soir', [petite('soir'), moyenne('soir')]],
  ['petite le matin + moyenne le soir', [petite('matin'), moyenne('soir')]],
  ['deux moyennes', [moyenne('matin'), moyenne('soir')]],
  ['longue 2 h', [longue(2)]],
  ['longue 3 h + petite le soir', [longue(3), petite('soir')]],
  ['quatre séances', [petite('matin'), petite('midi'), moyenne('soir'), petite('soir')]]
];
const CASES = SETS.map(([name, s]) => ['72 kg, profil par défaut, ' + name, {}, { seances: s, libre: false }, choices(3)]).concat([
  ['72 kg, repas libre, repos (samedi)', {}, { seances: [], libre: true }, choices(6)],
  ['72 kg, repas libre, petite le soir, desserts', {}, { seances: [petite('soir')], libre: true }, choices(6, { dej: meal('thon', 'pates', 'fruit'), diner: meal('saumon', 'pdt', 'chocolat') })],
  ['72 kg, moyenne à midi, pain, chocolat et fruit', {}, { seances: [moyenne('midi')], libre: false }, choices(2, { pdBase: 'pain', dej: meal('poulet', 'riz', 'chocolat'), diner: meal('boeuf', 'pates', 'fruit') })],
  ['52 kg, femme, déficit 20 %, repos', { sexe: 'f', age: 30, taille: 162, poids: 52, deficit: 20 }, { seances: [], libre: false }, choices(1)],
  ['100 kg, déficit 10 %, deux moyennes', { age: 40, taille: 190, poids: 100, deficit: 10 }, { seances: [moyenne('matin'), moyenne('soir')], libre: false }, choices(4)],
  ['58 kg, sans shaker ni marge, petite le matin', { sexe: 'f', age: 28, taille: 165, poids: 58, shaker: 'non', marge: 0 }, { seances: [petite('matin')], libre: false }, choices(2)],
  ['80 kg, dépense saisie 2 600 kcal, longue 3 h + petite le soir', { mode: 'manuel', repos: 2600, poids: 80 }, { seances: [longue(3), petite('soir')], libre: false }, choices(5)],
  ['72 kg, 2,2 g/kg, salé, thon deux fois, sans shaker (skyr du soir)', { prot: 2.2, shaker: 'non' }, { seances: [], libre: false }, choices(3, { pdBase: 'sale', dej: meal('thon', 'gnocchis'), diner: meal('thon', 'pdt') })],
  ['75 kg, 12 % de masse grasse, petite à midi', { poids: 75, gras: 12, neat: 'mixte' }, { seances: [petite('midi')], libre: false }, choices(0)],
  ['130 kg, quatre séances (encas)', { age: 30, taille: 195, poids: 130, neat: 'debout', deficit: 10 }, { seances: [petite('matin'), moyenne('matin'), petite('midi'), moyenne('soir')], libre: false }, choices(4)],
  ['72 kg, 1,6 g/kg, œufs et crevettes', { prot: 1.6 }, { seances: [petite('soir')], libre: false }, choices(3, { dej: meal('oeufs', 'gnocchis'), diner: meal('crevettes', 'patate') })],
  ['72 kg, petit-déjeuner salé, moyenne le soir, tofu et fruits secs', {}, { seances: [moyenne('soir')], libre: false }, choices(3, { pdBase: 'sale', dej: meal('tofu', 'poischiches', 'fruitsSecs'), diner: meal('saumon', 'lentilles') })],
  ['72 kg, petit-déjeuner salé, longue 2 h (version sucrée)', {}, { seances: [longue(2)], libre: false }, choices(0, { pdBase: 'sale' })],
  ['45 kg, déficit 25 %, repos (au-dessus de l’objectif)', { sexe: 'f', age: 50, taille: 150, poids: 45, deficit: 25 }, { seances: [], libre: false }, choices(3, { dej: meal('saumon', 'boulgour', 'compote'), diner: meal('poisson', 'semoule', 'fruit') })],
  // Recettes choisies (3.12.0) : leurs légumes, matière grasse et ajouts à la place des légumes et de la marge cuisine
  ['72 kg, recettes midi et soir, repos (curry, bolognaise)', {}, { seances: [], libre: false }, choices(3, { dej: rec('poulet', 'riz'), diner: rec('boeuf', 'pates') })],
  ['72 kg, recette au dîner, moyenne le soir, chocolat (poke bowl)', {}, { seances: [moyenne('soir')], libre: false }, choices(1, { diner: rec('saumon', 'riz', 'chocolat') })]
]);

const plainText = s => String(s).replace(/[  ]/g, ' ');
const n0 = x => Math.round(x);
function describe(name, prof, plan, ch){
  const r = A.buildDay(plan, ch, prof), t = r.tot, e = r.energy;
  const out = ['== ' + name,
    'dépense ' + n0(e.need) + ' kcal (repos ' + n0(e.rest) + ', séances ' + n0(e.cost) + '), objectif ' + e.target + ' kcal, apport ' + n0(t.kcal) +
      ' kcal (écart ' + n0(r.ecart) + ')' + (r.libre ? ', dont repas libre ' + r.libre : ''),
    'P ' + n0(t.p) + ' g (fourchette ' + n0(r.prot.low) + ' à ' + n0(r.prot.high) + ', facteur ' + r.prot.factor.toFixed(2) + '), G ' + n0(t.c) + ' g, L ' + n0(t.f) + ' g, portions × ' + r.scale.toFixed(3)];
  r.secs.forEach(s => {
    out.push('  ' + s.title + (s.when ? ' (' + s.when + ')' : '') + (s.sub ? ' ' + s.sub : '') + (s.items.length ? ' :' : ''));
    s.items.forEach(x => out.push('    ' + x.qty + ' ' + x.name + (x.cook ? ' [' + x.cook.ways.map(w => '≈ ' + w.g + ' g ' + w.adj).join(', ') + ']' : '') +
      (x.note ? ' (' + x.note + ')' : '') + '  ' + n0(x.m.kcal) + ' kcal'));
  });
  return plainText(out.join('\n'));
}
const text = '# Journées de référence (npm run golden pour réécrire après un changement voulu)\n\n' + CASES.map(c => describe(...c)).join('\n\n') + '\n';

if (update || !fs.existsSync(FILE)){
  fs.writeFileSync(FILE, text);
  console.log('journées de référence écrites (' + CASES.length + ') : tests/golden.txt');
} else {
  const want = fs.readFileSync(FILE, 'utf8');
  if (want === text) console.log('journées de référence OK (' + CASES.length + ')');
  else {
    // Par journée : lignes disparues (-) et nouvelles (+)
    const blocks = s => new Map(s.split('\n\n').map(b => [b.split('\n')[0], b.split('\n')]));
    const a = blocks(want), b = blocks(text), diff = [];
    new Set([...a.keys(), ...b.keys()]).forEach(title => {
      const x = a.get(title) || [], y = b.get(title) || [];
      const gone = x.filter(l => !y.includes(l)), added = y.filter(l => !x.includes(l));
      if (gone.length || added.length) diff.push(title, ...gone.map(l => '  - ' + l.trim()), ...added.map(l => '  + ' + l.trim()));
    });
    console.error('journées de référence : le moteur ne donne plus les mêmes journées.\n' +
      'Si le changement est voulu : npm run golden, puis relis le diff de tests/golden.txt.\n\n' + diff.slice(0, 60).join('\n'));
    process.exitCode = 1;
  }
}
