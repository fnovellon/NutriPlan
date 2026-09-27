// Simule l'utilisation de index.html dans un navigateur (jsdom), à date fixe.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const KEY = 'repas-du-jour:v2', OLD_KEY = 'repas-du-jour:v1';
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push((e && e.message) || String(e)));

// Horloge fixe : mercredi 7 octobre 2026, 9 h (jour de repos par défaut)
let now = new Date(2026, 9, 7, 9, 0, 0).getTime();
const withClock = win => {
  const R = win.Date;
  class D extends R {
    constructor(...a){ if (a.length) super(...a); else super(now); }
    static now(){ return now; }
  }
  win.Date = D;
};
const open = seed => new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://example.org/', virtualConsole: vc,
  beforeParse: win => { withClock(win); if (seed) seed(win.localStorage); }
});
const tools = dom => {
  const d = dom.window.document;
  const $ = s => d.querySelector(s);
  const click = s => { const el = $(s); assert(el, 'élément introuvable : ' + s); el.click(); };
  return {
    d, $, click,
    stored: () => JSON.parse(dom.window.localStorage.getItem(KEY)),
    sections: () => [...d.querySelectorAll('#day .meal h2, #day .band-t')].map(h => h.childNodes[0].textContent.trim()),
    setSwitch: (k, on) => { const b = $(`[data-action="toggle"][data-key="${k}"]`); if ((b.getAttribute('aria-checked') === 'true') !== on) b.click(); },
    starchLine: slot => [...d.querySelectorAll(`[aria-labelledby="h-${slot}"] .items li`)].map(li => li.textContent)
      .find(t => /riz basmati|pâtes|pommes de terre|patate douce|quinoa|semoule|boulgour|lentilles|gnocchis/.test(t)),
    pressed: action => $(`[data-action="${action}"][aria-pressed="true"]`).dataset.value,
    sess: () => [...d.querySelectorAll('#sess .srow .s-t')].map(e => e.childNodes[0].textContent),
    add: size => click(`[data-action="add"][data-value="${size}"]`),
    at: (i, m) => click(`[data-action="smoment"][data-index="${i}"][data-value="${m}"]`),
    rm: i => click(`[data-action="rm"][data-index="${i}"]`)
  };
};

const dom = open();
const { d, $, click, stored, sections, setSwitch, starchLine, pressed, sess, add, at, rm } = tools(dom);

assert(/kcal/.test($('#sum-text').textContent), 'résumé absent au chargement');
assert.strictEqual($('#date').textContent, 'Aujourd’hui, mercredi 7 octobre');
assert(/aujourd’hui/.test($('#title').textContent), 'titre du jour');
assert(!$('[data-action="day"]') && !$('[data-action="week"]'), 'le calendrier est encore affiché');
assert.deepStrictEqual(sess(), [], 'le jour part sans séance');
assert(/Repos/.test($('#sess').textContent), 'repos non affiché');

// Séances du jour : ajout, moment, retrait (choix fixés pour que le skyr du soir ne s'ajoute pas)
click('[data-action="prot"][data-slot="dej"][data-value="poulet"]');
click('[data-action="starch"][data-slot="dej"][data-value="riz"]');
click('[data-action="prot"][data-slot="diner"][data-value="poisson"]');
click('[data-action="starch"][data-slot="diner"][data-value="pdt"]');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner']);
assert(/shaker de protéines/.test(d.querySelector('[aria-labelledby="h-co"]').textContent), 'shaker dans la collation un jour sans séance');
add('petite');
assert.deepStrictEqual(sess(), ['Petite séance']);
assert.strictEqual(pressed('smoment'), 'soir', 'nouvelle séance le soir par défaut');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Petite séance', 'Shaker', 'Dîner']);
at(0, 'matin');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Petite séance', 'Collation', 'Déjeuner', 'Dîner']);
add('moyenne');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Petite séance', 'Déjeuner', 'Collation', 'Séance moyenne', 'Shaker', 'Dîner']);
add('longue');
assert.deepStrictEqual(sess(), ['Petite séance', 'Séance moyenne', 'Sortie longue']);
assert($('[data-action="add"][data-value="longue"]').disabled && !$('[data-action="add"][data-value="petite"]').disabled, 'une seule sortie longue');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Petite séance', 'Sortie longue', 'Déjeuner', 'Goûter', 'Séance moyenne', 'Shaker', 'Dîner']);
click('[data-action="sduree"][data-index="2"][data-value="3"]');
assert(/^180\sg/.test($('#day .band .qty').textContent), 'ravito de la sortie longue de 3 h');
add('petite');
assert([...d.querySelectorAll('[data-action="add"]')].every(b => b.disabled), 'quatre séances au plus');
rm(3); rm(2); rm(1); rm(0);
assert.deepStrictEqual(sess(), [], 'séances non retirées');
add('petite'); at(0, 'midi');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Avant la séance', 'Petite séance', 'Shaker', 'Déjeuner', 'Collation', 'Dîner']);
rm(0);
add('moyenne');
assert.deepStrictEqual(stored().plans['2026-10-07'].seances, [{ taille: 'moyenne', moment: 'soir' }], 'séances enregistrées');

// Repas libre : un seul par semaine, celui du samedi (par défaut) est retiré
setSwitch('libre', true);
assert(sections().includes('Repas libre') && /repas libre/.test($('#sum-text').textContent), 'repas libre');
assert(/samedi/.test($('#hint').textContent), 'message du repas libre déplacé');
assert.strictEqual(stored().plans['2026-10-10'].libre, false, 'repas libre du samedi non retiré');
setSwitch('libre', false);
assert.strictEqual($('#hint').textContent, '', 'message non effacé');

// Changer de féculent change la quantité et la met en évidence
click('[data-action="starch"][data-slot="dej"][data-value="riz"]');
const riz = starchLine('dej');
click('[data-action="starch"][data-slot="dej"][data-value="pdt"]');
assert.notStrictEqual(starchLine('dej'), riz, 'la quantité de féculent ne change pas');
assert($('[aria-labelledby="h-dej"] .qty.bump'), 'changement non mis en évidence');

// Poids cru et cuit sous la quantité, calories et macros sous chaque aliment
click('[data-action="starch"][data-slot="dej"][data-value="riz"]');
const dejLi = t => [...d.querySelectorAll('[aria-labelledby="h-dej"] .items li')].find(li => li.querySelector('.name').textContent.startsWith(t));
const ck = li => [...li.querySelectorAll('.q .ck')].map(e => e.textContent);
assert.deepStrictEqual(ck(dejLi('poulet')), ['cru', '≈\u00A0135\u00A0g cuit'], 'poids cuit du poulet');
assert(ck(dejLi('riz')).length === 2 && /cuit$/.test(ck(dejLi('riz'))[1]), 'poids cuit du riz');
assert.deepStrictEqual(ck(dejLi('légumes')), [], 'poids cuit des légumes');
click('[data-action="starch"][data-slot="dej"][data-value="pdt"]');
const pdtCk = ck(dejLi('pommes de terre'));
assert(pdtCk.length === 3 && pdtCk[0] === 'crues' && /à l’eau$/.test(pdtCk[1]) && /au four$/.test(pdtCk[2]), 'cuissons des pommes de terre : ' + pdtCk.join(' | '));
click('[data-action="starch"][data-slot="dej"][data-value="riz"]');
const isMarge = li => /pour la cuisine/.test(li.textContent);
for (const id of ['dej', 'diner']) {
  const li = [...d.querySelectorAll(`[aria-labelledby="h-${id}"] .items li`)].find(isMarge);
  assert(li && /≈\s50/.test(li.querySelector('.qty').textContent) && !li.querySelector('.mac'), 'marge cuisine au ' + id);
}
for (const li of d.querySelectorAll('#day .items li')) {
  if (isMarge(li)) continue;
  assert(/kcal\s*P\s\d+\sg\s*G\s\d+\sg\s*L\s\d+\sg/.test(li.querySelector('.mac').textContent), 'macros absentes : ' + li.textContent);
}
for (const meal of d.querySelectorAll('#day .meal')) {
  const shown = [...meal.querySelectorAll('.mac > span:first-child')].reduce((a, e) => a + Number(e.textContent.replace(/\D/g, '')), 0) +
    [...meal.querySelectorAll('.items li')].filter(isMarge).reduce((a, li) => a + Number(li.querySelector('.qty').textContent.replace(/\D/g, '')), 0);
  const head = Number(meal.querySelector('.kcal').textContent.replace(/\D/g, ''));
  assert(Math.abs(shown - head) <= 10, `kcal des aliments (${shown}) et du repas (${head})`);
}

// L'idée de plat suit les choix
click('[data-action="prot"][data-slot="diner"][data-value="boeuf"]');
click('[data-action="starch"][data-slot="diner"][data-value="pates"]');
assert(/bolognaise/.test($('[aria-labelledby="h-diner"] .idea').textContent), 'idée de plat');

// Stockage : l'activité par date, les choix par jour de la semaine
let st = stored();
assert.deepStrictEqual(Object.keys(st.plans).sort(), ['2026-10-07', '2026-10-10'], 'plans enregistrés');
assert.deepStrictEqual(Object.keys(st.choices), ['3'], 'choix enregistrés');

// Revenir au plan de base efface le jour (le samedi garde sa modification)
click('[data-action="reset"]');
st = stored();
assert.deepStrictEqual(Object.keys(st.plans).sort(), ['2026-10-10']);
assert.deepStrictEqual(st.choices, {});
assert.deepStrictEqual(sess(), [], 'séances non effacées');
add('moyenne');

// Page ouverte d'un jour à l'autre : elle revient sur le nouveau jour (jeudi, sans séance enregistrée)
now = new Date(2026, 9, 8, 7, 30, 0).getTime();
dom.window.dispatchEvent(new dom.window.Event('focus'));
assert.strictEqual($('#date').textContent, 'Aujourd’hui, jeudi 8 octobre', 'date non mise à jour');
assert.deepStrictEqual(sess(), [], 'plan de la veille affiché le lendemain');
now = new Date(2026, 9, 7, 9, 0, 0).getTime();

// Données v1 (activité par sport) : converties en séances, v1 laissée intacte, anciennes dates purgées
const oldData = JSON.stringify({
  plans: {
    '2026-10-07': { activity: 'course', moment: 'matin', duree: 2, natation: false, libre: false },
    '2026-10-06': { activity: 'double', moment: 'soir', duree: 2, natation: true, libre: false },
    '2026-09-30': { activity: 'muscu', moment: 'soir', duree: 2, natation: false, libre: false },
    '2026-09-01': { activity: 'muscu', moment: 'soir', duree: 2, natation: false, libre: false }
  },
  choices: { 3: { pdBase: 'pain', dej: { prot: 'thon', starch: 'semoule' }, diner: { prot: 'saumon', starch: 'riz' } } }
});
const seeded = open(ls => ls.setItem(OLD_KEY, oldData));
const s2 = tools(seeded);
assert.deepStrictEqual(s2.sess(), ['Séance moyenne'], 'course v1 non convertie');
assert.strictEqual(s2.pressed('smoment'), 'matin', 'moment v1 perdu');
assert.strictEqual(s2.$('[data-action="prot"][data-slot="dej"][aria-pressed="true"]').dataset.value, 'thon', 'choix v1 perdus');
assert.strictEqual(s2.$('[data-action="pd"][aria-pressed="true"]').dataset.value, 'pain', 'petit-déjeuner v1 perdu');
const conv = s2.stored();
assert.deepStrictEqual(Object.keys(conv.plans).sort(), ['2026-09-30', '2026-10-06', '2026-10-07'], 'purge des plans de plus de 21 jours');
assert.deepStrictEqual(conv.plans['2026-10-06'].seances, [{ taille: 'petite', moment: 'soir' }, { taille: 'moyenne', moment: 'soir' }, { taille: 'petite', moment: 'midi' }], 'muscu + course + natation');
assert.strictEqual(seeded.window.localStorage.getItem(OLD_KEY), oldData, 'la v1 a été modifiée');
// La v2 existe : la v1 n'est plus relue
const both = tools(open(ls => { ls.setItem(OLD_KEY, oldData); ls.setItem(KEY, JSON.stringify({ plans: { '2026-10-07': { seances: [{ taille: 'petite', moment: 'midi' }], libre: false } }, choices: {} })); }));
assert.deepStrictEqual(both.sess(), ['Petite séance'], 'la v1 écrase la v2');

// Stockage corrompu ou piégé : la page s'affiche avec les valeurs par défaut
for (const bad of ['{pas du json', '5', 'null', '[1,2]', JSON.stringify({
  plans: { '2026-10-07': { seances: [{ taille: 'constructor', moment: 'toString' }, 'x'], libre: 'oui' } },
  choices: { 3: { pdBase: 'x', dej: { prot: '__proto__', starch: 'constructor' }, diner: 'poulet' } }
})]) {
  const b = tools(open(ls => ls.setItem(KEY, bad)));
  assert(/kcal/.test(b.$('#sum-text').textContent), 'page bloquée par le stockage : ' + bad);
  assert.deepStrictEqual(b.sess(), [], 'valeurs par défaut non appliquées : ' + bad);
}

// Profil et déficit : clé séparée, la clé v1 n'est pas touchée
const PKEY = 'repas-du-jour:profil:v1';
const v1 = JSON.stringify({ plans: { '2026-10-07': { seances: [], libre: false } }, choices: {} });
const pdom = open(ls => ls.setItem(KEY, v1));
const p = tools(pdom);
const pw = pdom.window;
const field = k => p.$(`#besoins input[data-key="${k}"]`);
const type = (k, v) => { const el = field(k); el.value = String(v); el.dispatchEvent(new pw.Event('input', { bubbles: true })); };
const prof = () => JSON.parse(pw.localStorage.getItem(PKEY));
const kcal = () => Number(p.$('#sum-text strong').textContent.replace(/\D/g, ''));
const note = () => p.$('#sum-note').textContent;

assert(/Complète ton profil/.test(note()) && p.$('#needs-hint').textContent, 'profil à compléter non signalé');
assert(/déficit de 15\s%/.test(p.$('#needs-sum').textContent), 'résumé des besoins');
assert(/Dépense estimée\s:\s2\s330\skcal, moins 350\skcal de déficit/.test(note()), 'dépense du jour sans séance : ' + note());
assert(Math.abs(kcal() - 1980) <= 30, 'objectif du jour sans séance : ' + kcal());
p.click('[data-action="needs"]');
assert(p.$('#besoins').open, 'le lien Régler n’ouvre pas les besoins');

type('age', 40); type('taille', 180); type('poids', 70);
assert.deepStrictEqual(prof(), { mode: 'auto', age: 40, taille: 180, poids: 70 }, 'profil enregistré');
assert(!/Complète/.test(note()) && !p.$('#needs-hint').textContent, 'profil complet encore signalé');
type('age', 5);
assert.strictEqual(field('age').getAttribute('aria-invalid'), 'true', 'âge invalide non signalé');
assert.strictEqual(prof().age, 40, 'âge invalide enregistré');
field('age').dispatchEvent(new pw.Event('change', { bubbles: true }));
assert(field('age').value === '40' && !field('age').hasAttribute('aria-invalid'), 'le champ invalide ne reprend pas la valeur utilisée');
type('age', 41);
assert(!field('age').hasAttribute('aria-invalid') && prof().age === 41, 'âge corrigé');

// Mode manuel : dépense saisie d'un jour sans sport, paramètres du calcul masqués sauf le poids
const shown = k => !field(k).closest('[hidden]');
assert(/automatique/.test(p.$('#needs-sum').textContent) && !shown('repos') && shown('age'), 'mode automatique par défaut');
p.click('[data-action="prof"][data-key="mode"][data-value="manuel"]');
assert.strictEqual(prof().mode, 'manuel', 'mode non enregistré');
assert(shown('repos') && shown('poids') && !shown('age') && !shown('taille') && !shown('gras'), 'champs du mode manuel');
assert(p.$('[data-key="neat"]').closest('[hidden]') && p.$('[data-key="sexe"]').closest('[hidden]'), 'paramètres du calcul visibles en manuel');
assert(/Indique ta dépense/.test(p.$('#needs-hint').textContent) && /2\s280/.test(p.$('#needs-hint').textContent), 'manuel sans dépense : ' + p.$('#needs-hint').textContent);
type('repos', 2600);
assert(/saisie/.test(p.$('#calc-rest').textContent) && /2\s600/.test(note()) && /saisie/.test(p.$('#needs-sum').textContent), 'dépense saisie');
assert(!p.$('#needs-hint').textContent, 'profil manuel complet encore signalé');
// Hors bornes (1 200 à 6 000 kcal) : refusée avec un message, la dernière valeur valide reste utilisée
type('repos', 1000);
assert(/1\s200/.test(p.$('#warn-repos').textContent) && /calories actives/.test(p.$('#warn-repos').textContent), 'dépense trop basse non signalée');
assert.strictEqual(field('repos').getAttribute('aria-invalid'), 'true', 'champ de dépense trop basse non marqué');
assert.strictEqual(prof().repos, 2600, 'dépense hors bornes enregistrée');
field('repos').dispatchEvent(new pw.Event('change', { bubbles: true }));
assert(field('repos').value === '2600' && !field('repos').hasAttribute('aria-invalid') && !p.$('#warn-repos').textContent, 'le champ de dépense ne reprend pas la valeur utilisée');
// Retour en automatique : le calcul reprend, la dépense saisie est gardée pour plus tard
p.click('[data-action="prof"][data-key="mode"][data-value="auto"]');
assert(!/saisie/.test(p.$('#calc-rest').textContent) && !/2\s600/.test(note()) && prof().repos === 2600, 'retour en automatique');
p.click('[data-action="prof"][data-key="mode"][data-value="manuel"]');
assert(/2\s600/.test(note()), 'dépense saisie perdue en changeant de mode');
type('repos', '');
assert(!('repos' in prof()), 'dépense de repos non effacée');
p.click('[data-action="prof"][data-key="mode"][data-value="auto"]');
type('gras', 12);
assert(/Cunningham/.test(p.$('#calc-rest').textContent), 'formule avec masse grasse');

const before = kcal();
type('deficit', 20);
assert.strictEqual(prof().deficit, 20, 'déficit non enregistré');
assert(kcal() < before, 'le déficit ne change pas l’apport');
assert(!p.$('#warn-deficit').textContent, 'alerte à 20 %');
type('deficit', 25);
assert(/20\s%/.test(p.$('#warn-deficit').textContent), 'pas d’alerte au-delà de 20 %');
p.click('[data-action="prof"][data-key="neat"][data-value="debout"]');
assert.strictEqual(prof().neat, 'debout', 'activité hors sport');

// Shaker : composition réglable, reprise dans la journée
type('shakerKcal', 150); type('shakerProt', 30);
assert(prof().shakerKcal === 150 && prof().shakerProt === 30, 'shaker non enregistré');
const pShaker = () => [...pw.document.querySelectorAll('#day li')].find(li => /shaker de protéines/.test(li.textContent)).querySelector('.mac').textContent;
assert(/150\skcal/.test(pShaker()) && /P\s30\sg/.test(pShaker()), 'shaker réglé non repris : ' + pShaker());
assert(/150\skcal/.test(p.$('#calc-shaker').textContent), 'ligne du shaker');
type('shakerKcal', 200);
assert(field('shakerKcal').getAttribute('aria-invalid') === 'true' && prof().shakerKcal === 150, 'shaker hors bornes accepté');
type('shakerKcal', 100);
assert(/25\sg/.test(p.$('#warn-shaker').textContent), 'protéines au-delà de kcal / 4 non signalées');
type('shakerProt', 20);
assert(!p.$('#warn-shaker').textContent, 'alerte du shaker non effacée');
// Shaker optionnel : Non retire la section et la ligne, masque la dose, garde la composition
const shakerShown = () => [...pw.document.querySelectorAll('#day li')].some(li => /shaker de protéines/.test(li.textContent));
p.click('[data-action="prof"][data-key="shaker"][data-value="non"]');
assert.strictEqual(prof().shaker, 'non', 'shaker désactivé non enregistré');
assert(!shakerShown() && !p.$('#day [aria-labelledby="h-shk"]'), 'shaker encore affiché');
assert(!shown('shakerKcal') && /skyr/.test(p.$('#calc-shaker').textContent), 'dose du shaker visible sans shaker');
p.click('[data-action="prof"][data-key="shaker"][data-value="oui"]');
assert(shakerShown() && shown('shakerKcal') && prof().shakerKcal === 100, 'shaker réactivé');

// Calories des séances : placeholder d'après le poids, valeur saisie reprise
assert.strictEqual(field('kcalMoyenne').placeholder, String(Math.round(6.3 * 70 / 10) * 10), 'calories par défaut d’une moyenne');
p.add('moyenne');
const needMoy = () => Number(note().match(/Dépense estimée\s:\s([\d\s]+)kcal/)[1].replace(/\D/g, ''));
const beforeMoy = needMoy();
type('kcalMoyenne', 700);
assert(prof().kcalMoyenne === 700 && needMoy() > beforeMoy, 'calories de la moyenne non prises en compte');
p.rm(0);

// Marge cuisine : curseur enregistré, lignes reprises
type('marge', 200);
assert(prof().marge === 200 && /200\skcal/.test(p.$('#out-marge').textContent), 'marge non enregistrée');
assert(/≈\s100/.test([...p.d.querySelectorAll('[aria-labelledby="h-dej"] .items li')].find(li => /pour la cuisine/.test(li.textContent)).textContent), 'marge du déjeuner non reprise');
type('marge', 0);
assert(![...p.d.querySelectorAll('#day li')].some(li => /pour la cuisine/.test(li.textContent)), 'marge nulle encore affichée');

p.add('longue');
type('ravito', 45);
assert(/^90\sg/.test(p.$('#day .band .qty').textContent), 'ravito réglé non appliqué : ' + p.$('#day .band .qty').textContent);
assert.deepStrictEqual(JSON.parse(pw.localStorage.getItem(KEY)).choices, {}, 'la clé v1 a changé de forme');
assert.strictEqual(JSON.parse(pw.localStorage.getItem(KEY)).plans['2026-10-07'].seances[0].taille, 'longue', 'plan non enregistré');

// Version affichée en bas de page
const version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
assert.strictEqual(p.$('#app-version').textContent, version, 'version non affichée');

// Le profil est relu au chargement, un profil corrompu ne bloque rien
const again = tools(open(ls => ls.setItem(PKEY, JSON.stringify({ age: 41, deficit: 10, neat: 'constructor', poids: 'lourd' }))));
assert.strictEqual(again.$('#besoins input[data-key="age"]').value, '41', 'âge non relu');
assert.strictEqual(again.$('#besoins input[data-key="deficit"]').value, '10', 'déficit non relu');
assert.strictEqual(again.$('#besoins input[data-key="poids"]').value, '', 'poids invalide relu');
// Profils d'avant la 1.3.0 (sans mode) : manuel si la dépense saisie est valide, sinon automatique
const legacy = x => tools(open(ls => ls.setItem(PKEY, JSON.stringify(x))));
const lm = legacy({ age: 30, taille: 168, poids: 71, repos: 2500 });
assert(/saisie/.test(lm.$('#needs-sum').textContent) && lm.$('[data-action="prof"][data-value="manuel"]').getAttribute('aria-pressed') === 'true', 'ancien profil manuel');
const la = legacy({ age: 30, taille: 168, poids: 71, repos: 1000, deficit: 0 });
assert(/automatique/.test(la.$('#needs-sum').textContent) && /2\s260/.test(la.$('#needs-sum').textContent), 'ancien profil à 1 000 kcal : ' + la.$('#needs-sum').textContent);
// Petite corpulence : portions réduites, conseil si les minimums dépassent l'objectif
const light = legacy({ mode: 'auto', sexe: 'f', age: 28, taille: 160, poids: 52, deficit: 20 });
const skyrPd = [...light.d.querySelectorAll('[aria-labelledby="h-pd"] .items li')].find(li => /skyr/.test(li.textContent));
assert(/^180\sg/.test(skyrPd.querySelector('.qty').textContent), '52 kg : skyr du petit-déjeuner ' + skyrPd.querySelector('.qty').textContent);
assert(/dépassent l’objectif/.test(light.$('#sum-note').textContent) && /baisse la marge cuisine ou passe-toi du shaker/.test(light.$('#sum-note').textContent), '52 kg : ' + light.$('#sum-note').textContent);
for (const bad of ['{pas du json', '7', 'null']) {
  const b = tools(open(ls => ls.setItem(PKEY, bad)));
  assert(/kcal/.test(b.$('#sum-text').textContent), 'page bloquée par le profil : ' + bad);
}

assert.deepStrictEqual(errors, [], 'erreurs JavaScript : ' + errors.join(' | '));
console.log('interface OK');
