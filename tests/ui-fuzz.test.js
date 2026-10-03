// Tests de fond de l'interface (jsdom) : chaque écran relu (textes, typographie, accessibilité), changements d'heure,
// puis des centaines d'actions au hasard avec des vérifications après chacune (totaux affichés, stockage, rechargement).
// Reproductible : graine fixe. Plus fort : FUZZ=10 npm test, ou npm run test:deep.
process.env.TZ = 'Europe/Paris';   // avant toute date : les changements d'heure testés sont ceux de la France
const { openPage, rng, settings, checker } = require('./lib');

const { factor, seed } = settings(7102026);
const R = rng(seed);
const C = checker('fond de l’interface');
const PKEY = 'repas-du-jour:profil:v1', KEY = 'repas-du-jour:v2', RKEY = 'repas-du-jour:repas:v1';
const errors = [];
const clock = { now: new Date(2026, 9, 7, 9).getTime() };
const open = storage => openPage({ clock, storage, errors });
// Formulaire des repas déjà vu aujourd'hui : il ne s'ouvre pas tout seul
const seen = () => { const x = new Date(clock.now); return { [RKEY]: x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') }; };
const num = s => Number(String(s).replace(/[^\d,-]/g, '').replace(',', '.'));
const click = (dom, s) => { const e = dom.window.document.querySelector(s); if (!e) throw new Error('introuvable : ' + s); e.click(); };
const type = (dom, s, v, change) => {
  const w = dom.window, e = w.document.querySelector(s);
  e.value = String(v);
  e.dispatchEvent(new w.Event('input', { bubbles: true }));
  if (change) e.dispatchEvent(new w.Event('change', { bubbles: true }));
};

// --- 1. Chaque écran relu : textes, typographie française, accessibilité -------------------------------------------
function scan(dom, label){
  const w = dom.window, d = w.document;
  const visible = el => !el.closest('[hidden]');
  const walker = d.createTreeWalker(d.body, w.NodeFilter.SHOW_TEXT), texts = [];
  let n;
  while ((n = walker.nextNode())) if (!n.parentElement.closest('script,style')) texts.push(n.textContent);
  const attrs = [...d.querySelectorAll('[aria-label],[title],[placeholder]')].flatMap(e => ['aria-label', 'title', 'placeholder'].map(a => e.getAttribute(a)).filter(Boolean));
  texts.concat(attrs, [d.title]).forEach(t => {
    const s = t.replace(/https?:\/\/\S+/g, '');
    C.ok(!/NaN|undefined|null|Infinity|\[object/.test(s), 'texte cassé', () => label + ' : ' + s.trim().slice(0, 140));
    C.ok(!/\d (g|kcal|km|kg|cm|%|ans|h)\b/.test(s), 'espace normale entre un nombre et son unité', () => label + ' : ' + s.trim().slice(0, 160));
    C.ok(!/ [:;?!%]/.test(s), 'espace normale avant : ; ? ! %', () => label + ' : ' + s.trim().slice(0, 160));
    C.ok(!/[^\s\u00a0\u202f\d][:;?!]/.test(s.replace(/\d:\d/g, '')), 'pas d’espace avant : ; ? !', () => label + ' : ' + s.trim().slice(0, 160));
    C.ok(!/'/.test(s), 'apostrophe droite', () => label + ' : ' + s.trim().slice(0, 140));
    C.ok(!/(^|[^\d,\u202f\u00a0 ])1[ \u00a0](œufs|bananes|pommes|compotes|tranches|séances|boîtes|fruits)\b/.test(s), 'pluriel après 1', () => label + ' : ' + s.trim().slice(0, 140));
  });
  const ids = [...d.querySelectorAll('[id]')].map(e => e.id);
  C.ok(ids.length === new Set(ids).size, 'identifiant en double', () => label + ' : ' + ids.filter((x, i) => ids.indexOf(x) !== i).join(', '));
  d.querySelectorAll('[aria-labelledby]').forEach(e => e.getAttribute('aria-labelledby').split(/\s+/).forEach(id => C.ok(d.getElementById(id), 'aria-labelledby vers un élément absent', () => label + ' : ' + id)));
  d.querySelectorAll('label[for]').forEach(e => C.ok(d.getElementById(e.getAttribute('for')), 'label for vers un élément absent', () => label + ' : ' + e.getAttribute('for')));
  d.querySelectorAll('button').forEach(b => {
    if (!visible(b)) return;
    C.ok((b.getAttribute('aria-label') || b.textContent || '').trim(), 'bouton sans nom', () => label + ' : ' + b.outerHTML.slice(0, 120));
    C.ok(b.getAttribute('type') === 'button', 'bouton sans type="button"', () => label + ' : ' + b.outerHTML.slice(0, 120));
  });
  d.querySelectorAll('input').forEach(i => C.ok(i.closest('label') || (i.id && d.querySelector('label[for="' + i.id + '"]')) || i.getAttribute('aria-label') || i.getAttribute('aria-labelledby'), 'champ sans libellé', () => label + ' : ' + i.outerHTML.slice(0, 120)));
  C.ok([...d.querySelectorAll('main')].filter(m => !m.hidden).length === 1, 'un seul écran visible', label);
  C.ok([...d.querySelectorAll('h1')].filter(visible).length === 1, 'un seul titre h1 visible', label);
}
{
  // Premier lancement : les trois étapes de l'accueil, avec et sans erreur
  const dom = open({});
  scan(dom, 'accueil, étape 1'); click(dom, '#acc-next'); scan(dom, 'accueil, étape 1 incomplète');
  click(dom, '#accueil [data-key="sexe"][data-value="f"]');
  type(dom, '#accueil input[data-acc="age"]', 30); type(dom, '#accueil input[data-acc="taille"]', 165); type(dom, '#accueil input[data-acc="poids"]', 52);
  click(dom, '#acc-next'); scan(dom, 'accueil, étape 2');
  click(dom, '#accueil [data-key="deficit"][data-value="0"]'); scan(dom, 'accueil, étape 2, maintenir');
  click(dom, '#acc-next'); scan(dom, 'accueil, étape 3');
  click(dom, '#accueil [data-key="shaker"][data-value="non"]'); scan(dom, 'accueil, étape 3, sans shaker');
  click(dom, '#acc-next'); scan(dom, 'formulaire des repas après l’accueil');
  click(dom, '[data-action="repas-ok"]'); scan(dom, 'page après l’accueil');
}
{
  // Page chargée : séances, repas libre, desserts, panneau de choix, réglages dans tous leurs états, aide
  const dom = open(Object.assign(seen(), { [PKEY]: JSON.stringify({ age: 35, taille: 178, poids: 71 }) }));
  ['petite', 'moyenne', 'longue'].forEach(a => click(dom, '[data-action="add"][data-value="' + a + '"]'));
  scan(dom, 'page, trois séances');
  dom.window.document.querySelector('#wk-bal').open = true; scan(dom, 'page, carte de la semaine ouverte');
  C.ok(dom.window.document.querySelector('#acts [data-value="longue"]').disabled, '« + Longue » actif avec une sortie longue', '');
  click(dom, '[data-action="add"][data-value="petite"]'); scan(dom, 'page, quatre séances');
  C.ok([...dom.window.document.querySelectorAll('#acts button')].every(b => b.disabled), 'bouton d’ajout actif à 4 séances', '');
  click(dom, '[data-action="toggle"][data-key="libre"]'); scan(dom, 'page, repas libre');
  click(dom, '[data-action="open-pick"][data-kind="dessert"][data-slot="dej"]'); scan(dom, 'panneau de choix'); click(dom, '#sheet [data-value="chocolat"]');
  click(dom, '#open-repas'); scan(dom, 'formulaire des repas, repas libre');
  click(dom, '#repas-form .sel[data-kind="prot"][data-slot="dej"]'); scan(dom, 'formulaire des repas, panneau de choix');
  click(dom, '#sheet [data-value="thon"]'); click(dom, '[data-action="repas-ok"]');
  click(dom, '#gear'); scan(dom, 'réglages');
  click(dom, '[data-action="prof"][data-key="mode"][data-value="manuel"]'); scan(dom, 'réglages, manuel');
  type(dom, '#besoins input[data-key="repos"]', 900); scan(dom, 'réglages, dépense hors bornes'); type(dom, '#besoins input[data-key="repos"]', 2500);
  click(dom, '[data-action="prof"][data-key="shaker"][data-value="non"]'); scan(dom, 'réglages, sans shaker');
  type(dom, '#besoins input[data-key="deficit"]', 25); scan(dom, 'réglages, déficit 25 %');
  type(dom, '#besoins input[data-key="gras"]', 30); click(dom, '[data-action="prof"][data-key="mode"][data-value="auto"]'); scan(dom, 'réglages, masse grasse');
  click(dom, '#alim-list [data-kind="prot"][data-value="poulet"]'); click(dom, '#alim-list [data-kind="dessert"][data-value="chocolat"]'); scan(dom, 'réglages, aliments retirés');
  ['avoine', 'sale', 'pain'].forEach(v => click(dom, '#alim-list [data-kind="pd"][data-value="' + v + '"]')); scan(dom, 'réglages, dernière base gardée');
  click(dom, '#sem-days [data-value="2"]'); click(dom, '#sem-acts [data-value="petite"]'); click(dom, '#sem-acts [data-value="longue"]'); click(dom, '#sem-lib [data-value="0"]'); scan(dom, 'réglages, semaine type');
  click(dom, '#help-regl'); scan(dom, 'aide');
}
{
  // Calendrier, assistant de planification (dates, étapes, erreurs), courses
  const dom = open(Object.assign(seen(), { [PKEY]: JSON.stringify({ age: 35, taille: 178, poids: 71 }) }));
  click(dom, '#week [data-value="2026-10-09"]'); scan(dom, 'page, autre jour');
  click(dom, '#wk-next'); scan(dom, 'page, semaine suivante');
  click(dom, '#today-btn');
  click(dom, '#plan-btn'); scan(dom, 'planifier, dates');
  type(dom, 'input[data-range="plan"][data-end="to"]', '2027-01-30'); scan(dom, 'planifier, période trop longue');
  click(dom, '[data-action="pl-preset"][data-value="7"]');
  click(dom, '[data-action="pl-start"]'); scan(dom, 'planifier, premier jour');
  click(dom, '#plan-body [data-action="add"][data-value="longue"]'); click(dom, '#plan-body [data-action="toggle"]'); scan(dom, 'planifier, sortie longue et repas libre');
  click(dom, '#plan-body .sel[data-kind="starch"][data-slot="dej"]'); scan(dom, 'planifier, panneau de choix'); click(dom, '#sheet [data-value="poischiches"]');
  click(dom, '[data-action="pl-hasard-tous"]'); scan(dom, 'courses');
  click(dom, '#courses-list .chk'); scan(dom, 'courses, ligne cochée');
  type(dom, 'input[data-range="courses"][data-end="to"]', '2026-09-01'); scan(dom, 'courses, période invalide');
}
[
  ['petite corpulence au-dessus de l’objectif', { sexe: 'f', age: 28, taille: 160, poids: 45, deficit: 25, prot: 2.2 }],
  ['objectif de protéines bas', { age: 35, taille: 178, poids: 71, prot: 1.6 }],
  ['130 kg', { age: 35, taille: 190, poids: 130 }],
  ['objectif de protéines au plus haut, sans shaker', { age: 35, taille: 178, poids: 71, prot: 2.2, shaker: 'non' }],
  ['objectif enregistré avant la 3.11.1 au-dessus de 2,2', { age: 35, taille: 178, poids: 71, prot: 3, shaker: 'non' }]
].forEach(([label, prof]) => {
  const dom = open({ [RKEY]: seen()[RKEY], [PKEY]: JSON.stringify(prof), [KEY]: JSON.stringify({ plans: {}, choices: { 3: { pdBase: 'pain', dej: { prot: 'thon', starch: 'riz' }, diner: { prot: 'thon', starch: 'pates' } } } }) });
  scan(dom, label); click(dom, '#gear'); scan(dom, label + ', réglages');
});

// --- 2. Dates : changements d'heure, nouvel an, « 1er », semaine du repas libre -----------------------------------
[
  // heure locale (Paris), titre attendu, samedi de la même semaine (lundi → dimanche)
  ['2026-10-25T00:30', 'dimanche 25 octobre', '2026-10-24'],
  ['2026-10-25T02:30', 'dimanche 25 octobre', '2026-10-24'],
  ['2026-10-25T23:30', 'dimanche 25 octobre', '2026-10-24'],
  ['2026-10-26T00:10', 'lundi 26 octobre', '2026-10-31'],
  ['2027-03-28T01:30', 'dimanche 28 mars', '2027-03-27'],
  ['2027-03-28T03:30', 'dimanche 28 mars', '2027-03-27'],
  ['2026-12-31T23:59', 'jeudi 31 décembre', '2027-01-02'],
  ['2027-01-01T00:01', 'vendredi 1er janvier', '2027-01-02'],
  ['2026-11-01T12:00', 'dimanche 1er novembre', '2026-10-31']
].forEach(([iso, title, sat]) => {
  clock.now = new Date(iso).getTime();
  const dom = open({ [PKEY]: '{}' }), d = dom.window.document;
  const today = iso.slice(0, 10);
  C.ok(d.getElementById('date').textContent === 'Aujourd’hui, ' + title.replace(/(\d|er) /, '$1\u00A0'), 'date du jour', () => iso + ' : ' + d.getElementById('date').textContent);
  click(dom, '#sw-lib');   // repas libre aujourd'hui : celui du samedi de la même semaine est retiré
  const st = JSON.parse(dom.window.localStorage.getItem(KEY));
  C.ok(st.plans[today] && st.plans[today].libre === true, 'repas libre enregistré à la bonne date', () => iso + ' : ' + JSON.stringify(st.plans));
  if (sat !== today) C.ok(st.plans[sat] && st.plans[sat].libre === false && /samedi/.test(d.getElementById('hint').textContent), 'repas libre du samedi de la même semaine retiré', () => iso + ' : ' + JSON.stringify(st.plans));
  C.ok(Object.keys(st.plans).every(k => k === today || k === sat), 'date enregistrée inattendue', () => iso + ' : ' + Object.keys(st.plans).join(' '));
});
{
  // Page ouverte d'un jour à l'autre : au retour sur l'onglet, elle passe au nouveau jour
  clock.now = new Date('2026-10-31T23:58').getTime();
  const dom = open({ [PKEY]: '{}' }), d = dom.window.document;
  C.ok(/samedi 31\soctobre/.test(d.getElementById('date').textContent), 'veille de changement de mois', () => d.getElementById('date').textContent);
  clock.now = new Date('2026-11-01T00:03').getTime();
  dom.window.dispatchEvent(new dom.window.Event('focus'));
  C.ok(/dimanche 1er\snovembre/.test(d.getElementById('date').textContent), 'passage au jour suivant', () => d.getElementById('date').textContent);
}

// --- 3. Actions au hasard, vérifiées après chacune --------------------------------------------------------------
const snapshot = w => { const o = {}; for (let i = 0; i < w.localStorage.length; i++){ const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
const lineKcal = li => { const mac = li.querySelector('.mac > span:first-child'); return mac ? num(mac.textContent) : num(li.querySelector('.qty').textContent); };
function check(dom, log){
  const w = dom.window, d = w.document, $ = s => d.querySelector(s);
  const where = () => log.slice(-5).join(' › ');
  C.ok([...d.querySelectorAll('main')].filter(m => !m.hidden).length === 1, 'un seul écran visible', where);
  // Stockage toujours lisible et valide
  try {
    const s = JSON.parse(w.localStorage.getItem(KEY) || '{"plans":{},"choices":{}}');
    C.ok(s && typeof s === 'object' && s.plans && s.choices, 'stockage invalide', where);
    Object.entries(s.plans).forEach(([date, p]) => {
      C.ok(/^\d{4}-\d\d-\d\d$/.test(date), 'date enregistrée invalide', () => date);
      // Enregistré champ par champ (3.11.0) : ce qui manque vient de la semaine type
      C.ok(p && typeof p === 'object' && Object.keys(p).every(k => ['seances', 'libre', 'ch'].includes(k)) && (!('seances' in p) || (Array.isArray(p.seances) && p.seances.length <= 4)) && (!('libre' in p) || typeof p.libre === 'boolean'), 'plan enregistré invalide', () => JSON.stringify(p));
      // Recette enregistrée : toujours celle de la protéine et du féculent du repas
      if (p && p.ch) C.ok(['dej', 'diner'].every(sl => !p.ch[sl] || !('recette' in p.ch[sl]) || p.ch[sl].recette === p.ch[sl].prot + '-' + p.ch[sl].starch), 'recette enregistrée qui ne va pas', () => JSON.stringify(p.ch));
    });
    const pr = JSON.parse(w.localStorage.getItem(PKEY) || '{}');
    Object.entries(pr).forEach(([k, v]) => C.ok(v !== null && (typeof v !== 'number' || isFinite(v)), 'profil enregistré invalide', () => k + '=' + v));
    // Aliments retirés : valides, au moins un proposé par type (sauf les desserts), les mêmes que dans les réglages
    const all = [...d.querySelectorAll('#alim-list .opt')], off = pr.off || [];
    C.ok(Array.isArray(off) && off.every(x => all.some(b => b.dataset.kind + ':' + b.dataset.value === x)), 'aliments retirés invalides', () => JSON.stringify(off));
    ['pd', 'prot', 'starch'].forEach(k => C.ok(all.some(b => b.dataset.kind === k && !off.includes(k + ':' + b.dataset.value)), 'plus aucun aliment proposé', () => k + ' ' + where()));
    C.ok(all.every(b => (b.getAttribute('aria-pressed') === 'false') === off.includes(b.dataset.kind + ':' + b.dataset.value)), 'réglages ≠ aliments retirés', where);
  } catch (e){ C.ok(false, 'stockage illisible', () => e.message + ' ' + where()); }
  // Assistant et formulaire : une bulle par choix, avec sa valeur ; courses : chaque ligne a sa quantité
  ['#plan-body', '#repas-form'].forEach(id => {
    if ($(id).closest('main').hidden || !$(id + ' .sel')) return;
    const sels = [...d.querySelectorAll(id + ' .sel')];
    C.ok(sels.length === 7 && sels.every(b => b.dataset.value && b.textContent.trim()), 'bulles de choix', () => id + ' ' + where());
  });
  // Fiche du batch cooking : chaque recette annonce autant de boîtes qu'elle en liste, deux au moins
  if (!$('#courses').hidden) d.querySelectorAll('#courses-batch details.batch').forEach(card => {
    const n = card.querySelectorAll('.b-list')[1].querySelectorAll('li').length;
    C.ok(n >= 2 && new RegExp('^' + n + '\\sboîtes').test(card.querySelector('.b-n').textContent) && card.querySelectorAll('.rec-steps li').length === 3, 'fiche de batch cooking', () => card.textContent.slice(0, 160) + ' ' + where());
  });
  if (!$('#courses').hidden) d.querySelectorAll('#courses-list .chk').forEach(b => C.ok(/\d/.test(b.querySelector('.q').textContent) && ['true', 'false'].includes(b.getAttribute('aria-checked')), 'courses : ligne sans quantité', where));
  if ($('#page').hidden) return;
  // Total affiché = somme des lignes (arrondies), chaque repas aussi
  // Lignes des aliments et cartes des recettes choisies (leurs ingrédients sont dans la fiche, leurs macros sur la carte)
  const lis = [...d.querySelectorAll('#day li, #day .rec-k')];
  const total = num($('#sum-text strong').textContent), sum = lis.reduce((a, li) => a + lineKcal(li), 0);
  C.ok(Math.abs(sum - total) <= 10 + lis.length * 0.5, 'total affiché ≠ somme des aliments', () => total + ' / ' + sum + ' : ' + where());
  d.querySelectorAll('#day .meal').forEach(meal => {
    const head = meal.querySelector('.kcal'); if (!head) return;
    const items = [...meal.querySelectorAll('li, .rec-k')], s = items.reduce((a, li) => a + lineKcal(li), 0);
    C.ok(Math.abs(s - num(head.textContent)) <= 5 + items.length * 0.5, 'total du repas ≠ somme de ses aliments', () => num(head.textContent) + ' / ' + s + ' : ' + where());
  });
  const leg = [...d.querySelectorAll('#legend b')].map(b => num(b.textContent));
  C.ok(leg.length === 3 && leg.every(x => x >= 0), 'légende des macros', () => leg.join() + ' : ' + where());
  // Boutons d'ajout : désactivés à 4 séances, « + Longue » s'il y en a déjà une
  const n = d.querySelectorAll('#sess .srow').length, hasLong = [...d.querySelectorAll('#sess .s-t')].some(e => /Sortie longue/.test(e.textContent));
  d.querySelectorAll('#acts button').forEach(b => C.ok(b.disabled === (n >= 4 || (b.dataset.value === 'longue' && hasLong)), 'bouton d’ajout', () => b.dataset.value + ' ' + b.disabled + ' : ' + where()));
  C.ok(d.querySelectorAll('#day .band').length === n, 'un bandeau par séance', where);
  // Jour dont les séances n'ont jamais été modifiées : celles de la semaine type (aucune sans elle)
  try {
    const iso = ($('#week [aria-pressed="true"]') || { dataset: {} }).dataset.value, st = JSON.parse(w.localStorage.getItem(KEY) || '{"plans":{}}');
    const rec = st.plans[iso], sem = (JSON.parse(w.localStorage.getItem(PKEY) || '{}') || {}).semaine, js = new Date(iso + 'T12:00:00').getDay();
    if (iso && !(rec && 'seances' in rec)) C.ok(n === (sem && sem.jours && sem.jours[js] ? sem.jours[js].length : 0), 'séances de la semaine type', () => iso + ' : ' + n + ' ' + JSON.stringify(sem) + ' ' + where());
  } catch (e){ C.ok(false, 'séances de la semaine type : lecture', () => e.message); }
  C.ok(n > 0 || $('#sess .rest-t'), '« Repos, pas de séance » sans séance', where);
  const libre = $('#sw-lib').getAttribute('aria-checked') === 'true';
  C.ok(libre === /Repas libre/.test(($('#h-diner') || { textContent: '' }).textContent), 'interrupteur du repas libre ≠ page', where);
  C.ok($('#sheet').hidden || /^choose-open/.test(log[log.length - 1]), 'panneau de choix resté ouvert', where);
  // Ta semaine : cinq repères, une phrase ; alerte si un repère est dépassé, « équilibrée » si tous sont tenus
  const wbRows = [...d.querySelectorAll('#wb-list li')];
  C.ok(wbRows.length === 5 && $('#wb-msg').textContent.trim().length > 10, 'carte de la semaine', where);
  C.ok($('#wk-bal').classList.contains('is-over') === wbRows.some(li => li.className === 'is-over'), 'carte de la semaine : alerte', () => $('#wb-msg').textContent + ' : ' + where());
  C.ok($('#wk-bal').classList.contains('is-ok') === wbRows.every(li => li.className === 'is-ok') && $('#wk-bal').classList.contains('is-ok') === /équilibrée/.test($('#wb-msg').textContent), 'carte de la semaine : équilibre', () => $('#wb-msg').textContent + ' : ' + where());
  // Semaine type : profil valide (jours 0 à 6, 4 séances au plus, une longue), repas libre d'un jour de 0 à 6
  try {
    const sem = (JSON.parse(w.localStorage.getItem(PKEY) || '{}') || {}).semaine;
    if (sem) C.ok(Number.isInteger(sem.libre) && sem.libre >= 0 && sem.libre <= 6 && Object.entries(sem.jours).every(([js, l]) => /^[0-6]$/.test(js) && l.length >= 1 && l.length <= 4 && l.filter(x => x.taille === 'longue').length <= 1), 'semaine type enregistrée invalide', () => JSON.stringify(sem));
  } catch (e){ C.ok(false, 'semaine type illisible', () => e.message); }
  // Chaque bulle de choix montre une valeur qui existe
  d.querySelectorAll('#day .sel').forEach(b => C.ok(b.dataset.value && b.textContent.trim(), 'bulle de choix vide', () => b.outerHTML.slice(0, 120)));
  // Recettes : une sous le déjeuner et le dîner (pas au repas libre) ; choisie, ni « légumes » ni marge cuisine dans le repas
  ['dej', 'diner'].forEach(sl => {
    const meal = $('[aria-labelledby="h-' + sl + '"]'); if (!meal) return;
    const box = meal.querySelector('.rec'), names = [...meal.querySelectorAll('.items .name')].map(n => n.childNodes[0].textContent);
    C.ok(!!box === !(sl === 'diner' && libre), 'recette proposée', () => sl + ' ' + where());
    if (box && box.classList.contains('is-on')) C.ok(names.every(n => ['fruit', 'compote', 'fruits secs', 'chocolat noir'].includes(n)) && box.querySelector('h3') && box.querySelector('.rec-k .mac') && meal.querySelector('.picks').nextElementSibling === box, 'recette choisie : ingrédients sur la page', () => names.join(', ') + ' ' + where());
    else if (box) C.ok(names.includes('légumes') && /^Suggestion/.test(box.textContent), 'repas sans recette : légumes absents', () => names.join(', ') + ' ' + where());
  });
}
const ACTIONS = {
  add: dom => { const b = R.pick([...dom.window.document.querySelectorAll('#acts button')]); b.click(); return 'ajoute ' + b.dataset.value; },
  moment: dom => { const b = R.pick([...dom.window.document.querySelectorAll('[data-action="smoment"],[data-action="sduree"]')]); if (!b) return 'moment -'; b.click(); return 'moment ' + b.dataset.value; },
  rm: dom => { const b = R.pick([...dom.window.document.querySelectorAll('[data-action="rm"]')]); if (!b) return 'retire -'; b.click(); return 'retire'; },
  libre: dom => { dom.window.document.querySelector('#sw-lib').click(); return 'repas libre'; },
  choose: dom => {
    const d = dom.window.document, b = R.pick([...d.querySelectorAll('#day .sel')]);
    if (!b) return 'choix -';
    b.click();
    if (d.querySelector('#sheet').hidden) throw new Error('panneau non ouvert');
    const opts = [...d.querySelectorAll('#sheet .opt')], off = JSON.parse(dom.window.localStorage.getItem(PKEY) || '{}').off || [];
    C.ok(opts.filter(x => x.getAttribute('aria-pressed') === 'true').length === 1 && opts.every(x => x.dataset.value === b.dataset.value || !off.includes(b.dataset.kind + ':' + x.dataset.value)), 'panneau : aliment retiré proposé', () => b.dataset.kind + ' ' + JSON.stringify(off) + ' ' + opts.map(x => x.dataset.value).join());
    const o = R.pick(opts); o.click();
    if (b.dataset.kind && d.querySelector('[data-action="open-pick"][data-kind="' + b.dataset.kind + '"]' + (b.dataset.slot ? '[data-slot="' + b.dataset.slot + '"]' : '')).dataset.value !== o.dataset.value) throw new Error('choix non appliqué');
    return 'choix ' + b.dataset.kind + '=' + o.dataset.value;
  },
  cancel: dom => {
    const d = dom.window.document, w = dom.window, b = R.pick([...d.querySelectorAll('#day .sel')]);
    if (!b) return 'annule -';
    const before = b.dataset.value, kind = b.dataset.kind, slot = b.dataset.slot;
    b.click();
    const how = R.pick(['fond', 'croix', 'échap', 'retour']);
    if (how === 'fond') d.querySelector('#sheet .scrim').click();
    else if (how === 'croix') d.querySelector('#sheet .sheet-x').click();
    else if (how === 'échap') d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    else w.dispatchEvent(new w.PopStateEvent('popstate', { state: null }));
    const now = d.querySelector('[data-action="open-pick"][data-kind="' + kind + '"]' + (slot ? '[data-slot="' + slot + '"]' : ''));
    if (now && now.dataset.value !== before) throw new Error('fermer le panneau a changé le choix');
    return 'annule ' + how;
  },
  reset: dom => { dom.window.document.querySelector('[data-action="reset"]').click(); return 'plan de base'; },
  // Recette d'un repas : choisir ou retirer depuis la page, ou ouvrir la fiche (choisir, retirer ou fermer)
  recette: dom => {
    const d = dom.window.document, w = dom.window;
    if (d.querySelector('#page').hidden) return 'recette -';
    const box = R.pick([...d.querySelectorAll('#day .rec')]);
    if (!box) return 'recette -';
    const on = box.classList.contains('is-on'), slot = box.closest('.meal').getAttribute('aria-labelledby').slice(2), how = R.pick(['page', 'fiche', 'ferme']);
    if (how === 'page') box.querySelector('[data-action="rec-on"], [data-action="rec-off"]').click();
    else {
      box.querySelector('[data-action="rec-view"]').click();
      if (d.querySelector('#sheet').hidden || d.querySelector('#sheet-rec').hidden || !d.querySelector('#page').hasAttribute('inert')) throw new Error('fiche non ouverte');
      C.ok(d.querySelectorAll('#sheet-rec .rec-steps li').length === 3 && d.querySelectorAll('#sheet-rec .items li').length >= 4 && d.querySelector('#sheet-t').textContent.length > 5, 'fiche de recette incomplète', () => d.querySelector('#sheet-rec').textContent.slice(0, 200));
      if (how === 'fiche') d.querySelector('#sheet-rec .btn').click();
      else if (R.chance(.5)) d.querySelector('#sheet .sheet-x').click();
      else w.dispatchEvent(new w.PopStateEvent('popstate', { state: null }));
      if (!d.querySelector('#sheet').hidden || d.querySelector('#page').hasAttribute('inert')) throw new Error('fiche restée ouverte');
    }
    const now = d.querySelector('[aria-labelledby="h-' + slot + '"] .rec'), want = how === 'ferme' ? on : !on;
    C.ok(now && now.classList.contains('is-on') === want, 'recette : choix non appliqué', () => slot + ' ' + how + ' ' + on);
    return 'recette ' + slot + ' ' + how + (want ? ' choisie' : ' retirée');
  },
  screens: dom => {
    const d = dom.window.document, w = dom.window;
    const seq = R.pick([['#gear', '#reglages [data-action="fermer"]'], ['#help', '#aide [data-action="fermer"]'], ['#gear', '#help-regl', '#aide .btn.wide', '#reglages .btn.wide'], ['#gear', 'retour'], ['#help', 'retour']]);
    seq.forEach(s => { if (s === 'retour') w.dispatchEvent(new w.PopStateEvent('popstate', { state: null })); else { const e = d.querySelector(s); if (e && !e.closest('[hidden]')) e.click(); } });
    return 'écrans ' + seq.join(' ');
  },
  prof: dom => { const b = R.pick([...dom.window.document.querySelectorAll('#besoins [data-action="prof"]')]); b.click(); return 'réglage ' + b.dataset.key + '=' + b.dataset.value; },
  field: dom => {
    const e = R.pick([...dom.window.document.querySelectorAll('#besoins input[data-key]')]);
    const lo = Number(e.min || 0), hi = Number(e.max || 100);
    const v = R.pick(['', '0', '-5', '1e9', 'abc', '72', '2,5', String(Math.round(lo + R.next() * (hi - lo)))]);
    type(dom, '#besoins input[data-key="' + e.dataset.key + '"]', v, R.chance(.5));
    return 'champ ' + e.dataset.key + '=' + v;
  },
  // Formulaire des repas : ouvert (ou déjà ouvert tout seul), quelques choix, puis valider, tirer au hasard ou fermer
  repas: dom => {
    const d = dom.window.document, w = dom.window;
    const bubbles = () => [...d.querySelectorAll('#day .sel')].map(b => b.dataset.kind + (b.dataset.slot || '') + '=' + b.dataset.value);
    if (d.querySelector('#repas').hidden){
      if (d.querySelector('#page').hidden) return 'repas -';
      d.querySelector(R.pick(['#open-repas', '#repas-btn'])).click();
    }
    const before = bubbles();
    for (let i = R.int(0, 4); i > 0; i--){
      R.pick([...d.querySelectorAll('#repas-form .sel')]).click();
      if (d.querySelector('#sheet').hidden || !d.querySelector('#repas').hasAttribute('inert')) throw new Error('panneau du formulaire non ouvert');
      R.pick([...d.querySelectorAll('#sheet .opt')]).click();
      if (!d.querySelector('#sheet').hidden || d.querySelector('#repas').hasAttribute('inert')) throw new Error('panneau du formulaire resté ouvert');
    }
    const want = [...d.querySelectorAll('#repas-form .sel')].map(b => b.dataset.kind + (b.dataset.slot || '') + '=' + b.dataset.value);
    const how = R.pick(['valide', 'hasard', 'flèche', 'retour']);
    if (how === 'valide') d.querySelector('[data-action="repas-ok"]').click();
    else if (how === 'hasard') d.querySelector('[data-action="repas-hasard"]').click();
    else if (how === 'flèche') d.querySelector('#repas [data-action="fermer"]').click();
    else w.dispatchEvent(new w.PopStateEvent('popstate', { state: null }));
    C.ok(d.querySelector('#repas').hidden, 'formulaire resté ouvert', how);
    const after = bubbles();
    if (how === 'valide') C.ok(after.every(x => want.includes(x)), 'formulaire validé : choix non appliqués', () => want.join(' ') + ' // ' + after.join(' '));
    else if (how === 'hasard'){
      const prot = slot => (after.find(x => x.startsWith('prot' + slot + '=')) || '').split('=')[1];
      // Même protéine seulement s'il n'en reste qu'une de proposée (réglages, « Tes aliments »)
      const off = JSON.parse(w.localStorage.getItem(PKEY) || '{}').off || [];
      const prots = [...d.querySelectorAll('#alim-list [data-kind="prot"]')].filter(b => !off.includes('prot:' + b.dataset.value)).length;
      C.ok(!prot('diner') || prots < 2 || prot('dej') !== prot('diner'), 'hasard : même protéine midi et soir', () => after.join(' ') + ' ' + JSON.stringify(off));
      // Jamais « Œufs + jambon » avec le petit-déjeuner salé, s'il reste d'autres protéines
      if (after.includes('pd=sale') && prots > 2) C.ok(prot('dej') !== 'oeufs' && prot('diner') !== 'oeufs', 'hasard : œufs-jambon avec le salé', () => after.join(' '));
    } else C.ok(after.join() === before.join(), 'formulaire fermé sans valider : choix changés', () => before.join(' ') + ' // ' + after.join(' '));
    return 'repas ' + how;
  },
  // Calendrier : un jour de la semaine, semaine d'avant ou d'après, retour à aujourd'hui
  cal: dom => {
    const d = dom.window.document;
    if (d.querySelector('#page').hidden) return 'calendrier -';
    const b = R.pick([...d.querySelectorAll('#week button:not(:disabled), #wk-prev:not(:disabled), #wk-next:not(:disabled), #today-btn:not([hidden])')]);
    b.click();
    const on = d.querySelector('#week [aria-pressed="true"]');
    C.ok(on && d.querySelectorAll('#week [aria-pressed="true"]').length === 1, 'calendrier : un seul jour choisi', b.id || b.dataset.value);
    return 'calendrier ' + (b.dataset.value || b.id);
  },
  // Assistant : dates (raccourci ou champs), quelques étapes avec séances et plats, puis courses, hasard pour tous ou flèche
  planifier: dom => {
    const d = dom.window.document, w = dom.window;
    if (d.querySelector('#page').hidden) return 'planifier -';
    d.querySelector('#plan-btn').click();
    if (R.chance(.5)) R.pick([...d.querySelectorAll('[data-action="pl-preset"]')]).click();
    else type(dom, 'input[data-range="plan"][data-end="to"]', R.pick(['2026-10-09', '2026-10-20', '2026-12-31', '', '2026-10-01']));
    // Batch cooking : nombre de recettes, puis tout d'un coup, et les courses avec la fiche
    if (R.chance(.5)){
      if (R.chance(.8)) R.pick([...d.querySelectorAll('[data-action="pl-preset"]')]).click();
      R.pick([...d.querySelectorAll('[data-action="pl-nrec"]')]).click();
      d.querySelector('[data-action="pl-batch"]').click();
      if (!d.querySelector('#plan').hidden) d.querySelector('#plan [data-action="fermer"]').click();
      C.ok(d.querySelector('#plan').hidden, 'assistant resté ouvert', 'batch');
      if (!d.querySelector('#courses').hidden && R.chance(.3)) d.querySelector('#courses [data-action="fermer"]').click();
      return 'planifier batch';
    }
    d.querySelector('[data-action="pl-start"]').click();
    for (let i = R.int(0, 4); i > 0 && d.querySelector('[data-action="pl-next"]'); i--){
      for (let j = R.int(0, 3); j > 0; j--){
        const b = R.pick([...d.querySelectorAll('#plan-body button:not(:disabled)')].filter(x => !/^pl-/.test(x.dataset.action)));
        if (b) b.click();
        // Une bulle de plat ouvre le panneau : un choix le valide et le ferme
        if (!d.querySelector('#sheet').hidden){
          R.pick([...d.querySelectorAll('#sheet .opt')]).click();
          if (!d.querySelector('#sheet').hidden) throw new Error('panneau de l’assistant resté ouvert');
        }
      }
      R.pick(['pl-next', 'pl-next', 'pl-prev', 'pl-hasard']).split().forEach(a => { const b = d.querySelector('[data-action="' + a + '"]'); if (b) b.click(); });
    }
    const end = R.pick(['courses', 'tous', 'flèche', 'retour']);
    if (end === 'courses') while (!d.querySelector('#plan').hidden && d.querySelector('[data-action="pl-next"]')) d.querySelector('[data-action="pl-next"]').click();
    else if (end === 'tous' && d.querySelector('[data-action="pl-hasard-tous"]')) d.querySelector('[data-action="pl-hasard-tous"]').click();
    else if (end === 'retour') w.dispatchEvent(new w.PopStateEvent('popstate', { state: null }));
    if (!d.querySelector('#plan').hidden) d.querySelector('#plan [data-action="fermer"]').click();
    C.ok(d.querySelector('#plan').hidden, 'assistant resté ouvert', end);
    if (!d.querySelector('#courses').hidden && R.chance(.5)) d.querySelector('#courses [data-action="fermer"]').click();
    return 'planifier ' + end;
  },
  // Courses : ouvrir, cocher, changer la période, ouvrir un jour ou revenir
  courses: dom => {
    const d = dom.window.document;
    if (d.querySelector('#courses').hidden){ if (d.querySelector('#page').hidden) return 'courses -'; d.querySelector('#courses-btn').click(); }
    for (let i = R.int(0, 3); i > 0; i--){ const b = R.pick([...d.querySelectorAll('#courses-list .chk')]); if (b) b.click(); }
    if (R.chance(.3)) type(dom, 'input[data-range="courses"][data-end="' + R.pick(['from', 'to']) + '"]', R.pick(['2026-10-10', '2026-10-31', '', '2026-09-01', '2027-06-01']));
    const day = R.pick([...d.querySelectorAll('#courses-days .shop-day')]);
    if (day && R.chance(.4)) day.click(); else d.querySelector('#courses [data-action="fermer"]').click();
    C.ok(d.querySelector('#courses').hidden, 'courses restées ouvertes', '');
    return 'courses';
  },
  // Ta semaine : ouvrir ou refermer la carte
  semaine: dom => { const e = dom.window.document.querySelector('#wk-bal'); if (dom.window.document.querySelector('#page').hidden) return 'semaine -'; e.open = !e.open; return 'semaine ' + (e.open ? 'ouverte' : 'fermée'); },
  // Réglages, « Ta semaine type » : un jour, quelques séances ajoutées, déplacées ou retirées, le soir du repas libre
  semaineType: dom => {
    const d = dom.window.document;
    if (d.querySelector('#page').hidden) return 'semaine type -';
    d.querySelector('#gear').click();
    const done = [];
    for (let i = R.int(1, 5); i > 0; i--){
      const b = R.pick([...d.querySelectorAll('#semaine button:not(:disabled)')]);
      b.click(); done.push(b.dataset.action + '=' + (b.dataset.value || ''));
    }
    d.querySelector('#reglages [data-action="fermer"]').click();
    return 'semaine type ' + done.join(' ');
  },
  // Réglages, « Tes aliments » : retirer ou remettre quelques aliments
  aliments: dom => {
    const d = dom.window.document;
    if (d.querySelector('#page').hidden) return 'aliments -';
    d.querySelector('#gear').click();
    const done = [];
    for (let i = R.int(1, 4); i > 0; i--){ const b = R.pick([...d.querySelectorAll('#alim-list .opt')]); b.click(); done.push(b.dataset.value); }
    d.querySelector('#reglages [data-action="fermer"]').click();
    return 'aliments ' + done.join(' ');
  },
  day: dom => { clock.now += 864e5 * R.pick([1, 1, 2, 7]); dom.window.dispatchEvent(new dom.window.Event('focus')); return 'jour suivant'; },
  accueil: dom => {
    const d = dom.window.document;
    d.querySelector('[data-action="accueil"]').click();
    for (let i = R.int(0, 2); i > 0; i--) d.querySelector('#acc-next').click();
    d.querySelector(R.pick(['[data-action="acc-skip"]', '#acc-next'])).click();
    if (!d.querySelector('#accueil').hidden) d.querySelector('[data-action="acc-skip"]').click();
    return 'accueil';
  }
};
const RUNS = 4, STEPS = Math.round(60 * factor);
let actions = 0;
for (let run = 0; run < RUNS; run++){
  clock.now = new Date(2026, 9, 7, 9).getTime();
  const prof = [{}, { age: 35, taille: 178, poids: 71 }, { sexe: 'f', age: 26, taille: 160, poids: 50, shaker: 'non', marge: 0 }, { poids: 110, prot: 2.4 }][run];
  let dom = open({ [PKEY]: JSON.stringify(prof) });
  const log = [];
  for (let step = 0; step < STEPS; step++){
    const a = R.pick(Object.keys(ACTIONS));
    try { log.push(ACTIONS[a](dom)); } catch (e){ C.ok(false, 'action en erreur : ' + a, () => e.message + ' après ' + log.slice(-4).join(' › ')); log.push(a + ' ✗'); }
    actions++;
    check(dom, log);
    // Rechargement : même page (séances, choix, profil relus du stockage)
    if (step % 30 === 29){
      const was = dom.window.document;
      const before = was.querySelector('#day').innerHTML.replace(/ bump/g, ''), sumText = was.querySelector('#sum-text').textContent;
      // Au chargement, la page montre aujourd'hui : comparable seulement si elle montrait aujourd'hui
      const onPage = !was.querySelector('#page').hidden && was.querySelector('#date').textContent.startsWith('Aujourd’hui');
      dom = open(snapshot(dom.window));
      const d2 = dom.window.document;
      if (onPage && !d2.querySelector('#page').hidden)
        C.ok(d2.querySelector('#day').innerHTML.replace(/ bump/g, '') === before && d2.querySelector('#sum-text').textContent === sumText, 'rechargement : page différente', () => log.slice(-5).join(' › '));
      log.push('rechargement');
    }
  }
}
C.ok(errors.length === 0, 'erreur JavaScript dans la page', () => errors.slice(0, 3).join(' | '));
C.done(actions + ' actions au hasard, 9 dates, ' + C.checks + ' vérifications, graine ' + seed);
