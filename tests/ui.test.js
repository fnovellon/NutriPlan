// Simule l'utilisation de index.html dans un navigateur (jsdom).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const KEY = 'repas-du-jour:v1';
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push((e && e.message) || String(e)));

const open = beforeParse => new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.org/', virtualConsole: vc, beforeParse });
const dom = open();
const w = dom.window;
const d = w.document;
const $ = s => d.querySelector(s);
const click = s => { const el = $(s); assert(el, 'élément introuvable : ' + s); el.click(); };
const sections = () => [...d.querySelectorAll('#day .meal h2, #day .band-t')].map(h => h.childNodes[0].textContent.trim());
const setSwitch = (k, on) => { const b = $(`[data-action="toggle"][data-key="${k}"]`); if ((b.getAttribute('aria-checked') === 'true') !== on) b.click(); };
const starchLine = slot => [...d.querySelectorAll(`[aria-labelledby="h-${slot}"] .items li`)].map(li => li.textContent)
  .find(t => /riz basmati|pâtes crues|pommes de terre|patate douce|quinoa|semoule|boulgour|lentilles|gnocchis/.test(t));

assert(/kcal/.test($('#sum-text').textContent), 'résumé absent au chargement');

// Activités et moment de la séance (choix fixés pour que le skyr du soir ne s'ajoute pas)
setSwitch('libre', false);
setSwitch('natation', false);
click('[data-action="prot"][data-slot="dej"][data-value="poulet"]');
click('[data-action="starch"][data-slot="dej"][data-value="riz"]');
click('[data-action="prot"][data-slot="diner"][data-value="poisson"]');
click('[data-action="starch"][data-slot="diner"][data-value="pdt"]');
click('[data-action="activity"][data-value="repos"]');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner']);
click('[data-action="activity"][data-value="muscu"]');
click('[data-action="moment"][data-value="soir"]');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Séance de muscu', 'Dîner']);
click('[data-action="moment"][data-value="matin"]');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Séance de muscu', 'Collation', 'Déjeuner', 'Dîner']);
click('[data-action="activity"][data-value="longue"]');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Sortie longue', 'Déjeuner', 'Goûter', 'Dîner']);
assert(!$('#row-duree').hidden && $('#row-moment').hidden && $('#sw-nat').hidden, 'options de la sortie longue');

// Natation et repas libre
click('[data-action="activity"][data-value="course"]');
click('[data-action="moment"][data-value="soir"]');
setSwitch('natation', true);
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Avant la natation', 'Natation', 'Déjeuner', 'Collation', 'Course', 'Dîner']);
setSwitch('libre', true);
assert(sections().includes('Repas libre') && /repas libre compris/.test($('#sum-text').textContent), 'repas libre');
setSwitch('libre', false);
setSwitch('natation', false);

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

// Stockage : un plan pour la date du jour, des choix pour ce jour de la semaine
const st = JSON.parse(w.localStorage.getItem(KEY));
assert(Object.keys(st.plans).length === 1 && Object.keys(st.choices).length === 1, 'contenu du stockage');

// Changer de jour puis revenir garde l'activité choisie
const todayJs = new w.Date().getDay();
click(`[data-action="day"][data-value="${(todayJs + 3) % 7}"]`);
assert(!/aujourd/.test($('#title').textContent), 'titre des autres jours');
click(`[data-action="day"][data-value="${todayJs}"]`);
assert(/aujourd/.test($('#title').textContent), 'titre du jour');
assert.strictEqual($('[data-action="activity"][aria-pressed="true"]').dataset.value, 'course', 'activité du jour perdue');

// Revenir au plan de base efface le jour
click('[data-action="reset"]');
const st2 = JSON.parse(w.localStorage.getItem(KEY));
assert.deepStrictEqual(st2.plans, {});
assert.deepStrictEqual(st2.choices, {});

// Un stockage corrompu ne bloque pas la page
const dom2 = open(win => win.localStorage.setItem(KEY, '{pas du json'));
assert(/kcal/.test(dom2.window.document.getElementById('sum-text').textContent), 'page bloquée par un stockage corrompu');

assert.deepStrictEqual(errors, [], 'erreurs JavaScript : ' + errors.join(' | '));
console.log('interface OK');
