// Simule l'utilisation de index.html dans un navigateur (jsdom), à date fixe.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const KEY = 'repas-du-jour:v1';
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
      .find(t => /riz basmati|pâtes crues|pommes de terre|patate douce|quinoa|semoule|boulgour|lentilles|gnocchis/.test(t)),
    pressed: action => $(`[data-action="${action}"][aria-pressed="true"]`).dataset.value
  };
};

const dom = open();
const { d, $, click, stored, sections, setSwitch, starchLine, pressed } = tools(dom);

assert(/kcal/.test($('#sum-text').textContent), 'résumé absent au chargement');
assert.strictEqual($('#date').textContent, 'Aujourd’hui, mercredi 7 octobre');
assert(/aujourd’hui/.test($('#title').textContent), 'titre du jour');
assert.strictEqual(pressed('activity'), 'repos', 'le mercredi est un jour de repos');

// Activités et moment de la séance (choix fixés pour que le skyr du soir ne s'ajoute pas)
click('[data-action="prot"][data-slot="dej"][data-value="poulet"]');
click('[data-action="starch"][data-slot="dej"][data-value="riz"]');
click('[data-action="prot"][data-slot="diner"][data-value="poisson"]');
click('[data-action="starch"][data-slot="diner"][data-value="pdt"]');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner']);
click('[data-action="activity"][data-value="muscu"]');
click('[data-action="moment"][data-value="soir"]');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Séance de muscu', 'Dîner']);
click('[data-action="moment"][data-value="matin"]');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Séance de muscu', 'Collation', 'Déjeuner', 'Dîner']);
click('[data-action="activity"][data-value="longue"]');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Sortie longue', 'Déjeuner', 'Goûter', 'Dîner']);
assert(!$('#row-duree').hidden && $('#row-moment').hidden && $('#sw-nat').hidden, 'options de la sortie longue');

// Natation
click('[data-action="activity"][data-value="course"]');
click('[data-action="moment"][data-value="soir"]');
setSwitch('natation', true);
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Avant la natation', 'Natation', 'Déjeuner', 'Collation', 'Course', 'Dîner']);
setSwitch('natation', false);

// Repas libre : un seul par semaine, celui du samedi (par défaut) est retiré
setSwitch('libre', true);
assert(sections().includes('Repas libre') && /repas libre/.test($('#sum-text').textContent), 'repas libre');
assert(/samedi/.test($('#hint').textContent), 'message du repas libre déplacé');
assert.strictEqual(stored().plans['2026-10-10'].libre, false, 'repas libre du samedi non retiré');
click('[data-action="day"][data-value="6"]');
assert.strictEqual($('#sw-lib').getAttribute('aria-checked'), 'false', 'samedi garde son repas libre');
assert.strictEqual($('#hint').textContent, '', 'message non effacé');
click('[data-action="day"][data-value="3"]');
setSwitch('libre', false);

// Changer de féculent change la quantité et la met en évidence
click('[data-action="starch"][data-slot="dej"][data-value="riz"]');
const riz = starchLine('dej');
click('[data-action="starch"][data-slot="dej"][data-value="pdt"]');
assert.notStrictEqual(starchLine('dej'), riz, 'la quantité de féculent ne change pas');
assert($('[aria-labelledby="h-dej"] .qty.bump'), 'changement non mis en évidence');

// L'idée de plat suit les choix
click('[data-action="prot"][data-slot="diner"][data-value="boeuf"]');
click('[data-action="starch"][data-slot="diner"][data-value="pates"]');
assert(/bolognaise/.test($('[aria-labelledby="h-diner"] .idea').textContent), 'idée de plat');

// Stockage : l'activité par date, les choix par jour de la semaine
let st = stored();
assert.deepStrictEqual(Object.keys(st.plans).sort(), ['2026-10-07', '2026-10-10'], 'plans enregistrés');
assert.deepStrictEqual(Object.keys(st.choices), ['3'], 'choix enregistrés');

// Demain, puis retour : l'activité choisie est gardée
click('[data-action="day"][data-value="4"]');
assert.strictEqual($('#date').textContent, 'Demain, jeudi 8 octobre');
assert(/demain/.test($('#title').textContent), 'titre de demain');
click('[data-action="day"][data-value="1"]');
assert(/as fait lundi/.test($('#title').textContent), 'titre d’un jour passé');
click('[data-action="day"][data-value="3"]');
assert.strictEqual(pressed('activity'), 'course', 'activité du jour perdue');

// Semaine suivante : dates, titre, bornes, enregistrement à la bonne date
assert($('#wk-prev').disabled === false && $('#wk-next').disabled === false, 'flèches de semaine');
click('#wk-next');
assert.strictEqual($('#date').textContent, 'Mercredi 14 octobre, semaine prochaine');
assert(/mercredi prochain/.test($('#title').textContent), 'titre de la semaine prochaine');
assert($('#wk-next').disabled, 'pas plus loin que la semaine prochaine');
assert(!d.querySelector('#week .is-today'), 'aujourd’hui marqué dans une autre semaine');
assert.strictEqual(pressed('activity'), 'repos', 'plan par défaut la semaine prochaine');
click('[data-action="activity"][data-value="muscu"]');
assert.strictEqual(stored().plans['2026-10-14'].activity, 'muscu', 'plan de la semaine prochaine');
click('#wk-prev');
click('#wk-prev');
assert(/semaine dernière/.test($('#date').textContent) && $('#wk-prev').disabled, 'semaine dernière');
click('#wk-next');
assert.strictEqual(pressed('activity'), 'course', 'retour sur la semaine en cours');

// Revenir au plan de base efface le jour (le samedi garde sa modification)
click('[data-action="reset"]');
st = stored();
assert.deepStrictEqual(Object.keys(st.plans).sort(), ['2026-10-10', '2026-10-14']);
assert.deepStrictEqual(st.choices, {});

// Page ouverte d'un jour à l'autre : elle revient sur le nouveau jour
click('[data-action="day"][data-value="1"]');
now = new Date(2026, 9, 8, 7, 30, 0).getTime();
dom.window.dispatchEvent(new dom.window.Event('focus'));
assert.strictEqual($('#date').textContent, 'Aujourd’hui, jeudi 8 octobre', 'date non mise à jour');
assert.strictEqual(pressed('day'), '4', 'jour sélectionné non mis à jour');
now = new Date(2026, 9, 7, 9, 0, 0).getTime();

// Données v1 existantes : reprises telles quelles, anciennes dates purgées
const seeded = open(ls => ls.setItem(KEY, JSON.stringify({
  plans: {
    '2026-10-07': { activity: 'course', moment: 'matin', duree: 2, natation: false, libre: false },
    '2026-09-30': { activity: 'muscu', moment: 'soir', duree: 2, natation: false, libre: false },
    '2026-09-01': { activity: 'muscu', moment: 'soir', duree: 2, natation: false, libre: false }
  },
  choices: { 3: { pdBase: 'pain', dej: { prot: 'thon', starch: 'semoule' }, diner: { prot: 'saumon', starch: 'riz' } } }
})));
const s2 = tools(seeded);
assert.strictEqual(s2.pressed('activity'), 'course', 'plan v1 perdu');
assert.strictEqual(s2.pressed('moment'), 'matin', 'moment v1 perdu');
assert.strictEqual(s2.$('[data-action="prot"][data-slot="dej"][aria-pressed="true"]').dataset.value, 'thon', 'choix v1 perdus');
assert.strictEqual(s2.$('[data-action="pd"][aria-pressed="true"]').dataset.value, 'pain', 'petit-déjeuner v1 perdu');
s2.click('[data-action="moment"][data-value="soir"]');
assert.deepStrictEqual(Object.keys(s2.stored().plans).sort(), ['2026-09-30', '2026-10-07'], 'purge des plans de plus de 21 jours');

// Stockage corrompu ou piégé : la page s'affiche avec les valeurs par défaut
for (const bad of ['{pas du json', '5', 'null', '[1,2]', JSON.stringify({
  plans: { '2026-10-07': { activity: 'constructor', moment: 'toString' } },
  choices: { 3: { pdBase: 'x', dej: { prot: '__proto__', starch: 'constructor' }, diner: 'poulet' } }
})]) {
  const b = tools(open(ls => ls.setItem(KEY, bad)));
  assert(/kcal/.test(b.$('#sum-text').textContent), 'page bloquée par le stockage : ' + bad);
  assert.strictEqual(b.pressed('activity'), 'repos', 'valeurs par défaut non appliquées : ' + bad);
}

// Profil et déficit : clé séparée, la clé v1 n'est pas touchée
const PKEY = 'repas-du-jour:profil:v1';
const v1 = JSON.stringify({ plans: { '2026-10-07': { activity: 'repos', moment: 'soir', duree: 2, natation: false, libre: false } }, choices: {} });
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
assert(/Dépense estimée\s:\s2\s330\skcal, moins 420\skcal de déficit/.test(note()), 'dépense du jour de repos : ' + note());
assert.strictEqual(kcal(), 1900, 'objectif du jour de repos');
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

p.click('[data-action="activity"][data-value="longue"]');
type('ravito', 45);
assert(/^90\sg/.test(p.$('#day .band .qty').textContent), 'ravito réglé non appliqué : ' + p.$('#day .band .qty').textContent);
assert.deepStrictEqual(JSON.parse(pw.localStorage.getItem(KEY)).choices, {}, 'la clé v1 a changé de forme');
assert.strictEqual(JSON.parse(pw.localStorage.getItem(KEY)).plans['2026-10-07'].activity, 'longue', 'plan v1 non enregistré');

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
assert(/automatique/.test(la.$('#needs-sum').textContent) && /2\s750/.test(la.$('#needs-sum').textContent), 'ancien profil à 1 000 kcal : ' + la.$('#needs-sum').textContent);
for (const bad of ['{pas du json', '7', 'null']) {
  const b = tools(open(ls => ls.setItem(PKEY, bad)));
  assert(/kcal/.test(b.$('#sum-text').textContent), 'page bloquée par le profil : ' + bad);
}

assert.deepStrictEqual(errors, [], 'erreurs JavaScript : ' + errors.join(' | '));
console.log('interface OK');
