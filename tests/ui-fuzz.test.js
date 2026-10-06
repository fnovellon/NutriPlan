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
// Séance ajoutée par le panneau (3.20.0) : taille, puis moment (durée pour la longue)
const addSess = (dom, size, how) => { click(dom, '#sess-add'); click(dom, '#sheet [data-action="add"][data-value="' + size + '"]' + (size === 'longue' ? '[data-duree="' + (how || 2) + '"]' : '[data-moment="' + (how || 'soir') + '"]')); };
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
  click(dom, '#acc-next'); scan(dom, 'accueil, étape 4');
  click(dom, '#acs-acts [data-value="petite"]'); click(dom, '#acs-acts [data-value="longue"]'); click(dom, '#acs-lib [data-value="2"]'); scan(dom, 'accueil, étape 4, séances');
  click(dom, '#acc-next'); scan(dom, 'formulaire des repas après l’accueil');
  click(dom, '[data-action="repas-ok"]'); scan(dom, 'page après l’accueil');
}
{
  // Page chargée : séances, repas libre, desserts, panneau de choix, réglages dans tous leurs états, aide
  const dom = open(Object.assign(seen(), { [PKEY]: JSON.stringify({ age: 35, taille: 178, poids: 71 }) }));
  addSess(dom, 'petite', 'midi'); addSess(dom, 'moyenne'); addSess(dom, 'longue', 3);
  scan(dom, 'page, trois séances');
  dom.window.document.querySelector('#wk-bal').open = true; scan(dom, 'page, carte de la semaine ouverte');
  click(dom, '#sess-add'); scan(dom, 'panneau d’ajout d’une séance');
  C.ok([...dom.window.document.querySelectorAll('#sheet [data-value="longue"]')].every(b => b.disabled), '« Sortie longue » active avec une sortie longue', '');
  click(dom, '#sheet .sheet-x');
  click(dom, '#sess-1'); scan(dom, 'panneau d’une séance'); click(dom, '#sheet .sheet-x');
  [...dom.window.document.querySelectorAll('#frise [role="tab"]')].forEach(t => { t.click(); scan(dom, 'page, carte ' + t.dataset.value); });
  addSess(dom, 'petite'); scan(dom, 'page, quatre séances');
  C.ok(dom.window.document.querySelector('#sess-add').disabled, '« + Séance » actif à 4 séances', '');
  click(dom, '[data-action="toggle"][data-key="libre"]'); scan(dom, 'page, repas libre');
  click(dom, '[data-action="open-pick"][data-kind="dessert"][data-slot="dej"]'); scan(dom, 'panneau de choix'); click(dom, '#sheet [data-value="chocolat"]');
  click(dom, '#open-repas'); scan(dom, 'formulaire des repas, repas libre');
  click(dom, '#repas-form .sel[data-kind="prot"][data-slot="dej"]'); scan(dom, 'formulaire des repas, panneau de choix');
  click(dom, '#sheet [data-value="thon"]'); click(dom, '[data-action="repas-ok"]');
  click(dom, '#gear'); scan(dom, 'réglages');
  ['sport', 'repas', 'appli', 'profil'].forEach(t => { click(dom, '#tab-' + t); scan(dom, 'réglages, onglet ' + t); });
  click(dom, '[data-action="prof"][data-key="mode"][data-value="manuel"]'); scan(dom, 'réglages, manuel');
  type(dom, '#besoins input[data-key="repos"]', 900); scan(dom, 'réglages, dépense hors bornes'); type(dom, '#besoins input[data-key="repos"]', 2500);
  click(dom, '[data-action="prof"][data-key="shaker"][data-value="non"]'); scan(dom, 'réglages, sans shaker');
  type(dom, '#besoins input[data-key="deficit"]', 25); scan(dom, 'réglages, déficit 25 %');
  type(dom, '#besoins input[data-key="gras"]', 30); click(dom, '[data-action="prof"][data-key="mode"][data-value="auto"]'); scan(dom, 'réglages, masse grasse');
  click(dom, '#alim-list [data-kind="prot"][data-value="poulet"]'); click(dom, '#alim-list [data-kind="dessert"][data-value="chocolat"]'); scan(dom, 'réglages, aliments retirés');
  ['avoine', 'sale', 'pain'].forEach(v => click(dom, '#alim-list [data-kind="pd"][data-value="' + v + '"]')); scan(dom, 'réglages, dernière base gardée');
  click(dom, '#sem-days [data-value="2"]'); click(dom, '#sem-acts [data-value="petite"]'); click(dom, '#sem-acts [data-value="longue"]'); click(dom, '#sem-lib [data-value="0"]'); scan(dom, 'réglages, semaine type');
  click(dom, '#help-regl'); scan(dom, 'aide');
  // Recettes (3.24.0) : la liste, filtrée, une fiche, prise pour demain soir (repas libre : pas de bouton)
  click(dom, '#nav-rec'); scan(dom, 'recettes');
  click(dom, '#lib-quick'); click(dom, '#lib-mine'); scan(dom, 'recettes filtrées');
  click(dom, '#lib-list .lib-r'); scan(dom, 'fiche de la bibliothèque');
  click(dom, '[data-action="lib-take"]'); scan(dom, 'recette prise');
  click(dom, '[data-action="lib-for"][data-value="1|diner"]'); click(dom, '#lib-list .lib-r'); scan(dom, 'fiche, demain soir');
  click(dom, '#sheet .sheet-x'); click(dom, '#lib-quick'); click(dom, '#lib-mine');
  // Favorite et à éviter (3.25.0) : la fiche, la liste, les réglages
  click(dom, '#lib-list .lib-r'); click(dom, '#rp-fav'); scan(dom, 'fiche, favorite'); click(dom, '#rp-ban'); scan(dom, 'fiche, à éviter'); click(dom, '#sheet .sheet-x');
  click(dom, '#lib-list .lib-r:last-child'); click(dom, '#lib-fav'); scan(dom, 'recettes, favorites');
  click(dom, '#gear'); click(dom, '#tab-repas'); scan(dom, 'réglages, tes recettes'); click(dom, '#nav-jour');
}
{
  // Calendrier, Planifier (formulaire, erreurs, chaque type de plats), détail d'une planification, page du batch
  const dom = open(Object.assign(seen(), { [PKEY]: JSON.stringify({ age: 35, taille: 178, poids: 71 }) }));
  click(dom, '#week [data-value="2026-10-09"]'); scan(dom, 'page, autre jour');
  click(dom, '#wk-next'); scan(dom, 'page, semaine suivante');
  click(dom, '#today-btn');
  click(dom, '#plan-btn'); scan(dom, 'planifier, aucune planification');
  type(dom, 'input[data-range="plan"][data-end="to"]', '2027-01-30'); scan(dom, 'planifier, période trop longue');
  click(dom, '[data-action="pl-preset"][data-value="suivante"]');
  click(dom, '[data-action="pl-type"][data-value="simple"]'); scan(dom, 'planifier, plats simples');
  click(dom, '[data-action="pl-create"]'); scan(dom, 'planification à venir, plats simples');
  click(dom, '#courses-list .chk'); scan(dom, 'planification, ligne cochée');
  click(dom, '#courses [data-action="fermer"]'); scan(dom, 'planifier, une planification à venir');
  click(dom, '[data-action="pl-preset"][data-value="7"]'); scan(dom, 'planifier, jours déjà prévus');
  click(dom, '[data-action="pl-type"][data-value="recettes"]'); click(dom, '#pl-batch'); scan(dom, 'planifier, batch cooking');
  click(dom, '[data-action="pl-create"]'); scan(dom, 'planification en cours, batch cooking');
  click(dom, '#plan-btn'); scan(dom, 'planifier, en cours et à venir');
  click(dom, '#nav-jour');
  const bb = dom.window.document.querySelector('#rec-b-dej, #rec-b-diner');
  C.ok(bb, 'batch cooking : pas de bouton dans la journée', '');
  if (bb){ bb.click(); scan(dom, 'page du batch'); }
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
  // Formulaire des repas : une bulle par choix, avec sa valeur ; courses : chaque ligne a sa quantité
  ['#repas-form'].forEach(id => {
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
  // Calendrier (3.22.0) : un trait sous les jours des planifications enregistrées, et seulement sous eux
  try {
    const q = JSON.parse(w.localStorage.getItem('repas-du-jour:planifs:v1') || '{"list":[]}').list;
    [...d.querySelectorAll('#week [data-action="day"]')].forEach((b, i) => {
      const iso = b.dataset.value, inP = q.some(p => p.from <= iso && p.to >= iso);
      C.ok(d.querySelectorAll('#week .wk-pl')[i].classList.contains('on') === inP, 'calendrier : trait d’une planification', () => iso + ' ' + JSON.stringify(q));
    });
  } catch (e){ C.ok(false, 'planifications illisibles', () => e.message); }
  // « + Séance » désactivé à 4 séances ; une carte par séance
  const n = d.querySelectorAll('#sess .chip[data-action="sess"]').length;
  C.ok($('#sess-add').disabled === (n >= 4), '« + Séance »', where);
  C.ok(d.querySelectorAll('#day .band').length === n, 'un bandeau par séance', where);
  // Frise (3.20.0) : un repère par carte, dans le même ordre, un seul choisi, sa carte seule visible
  const tabs = [...d.querySelectorAll('#frise [role="tab"]')], panels = [...d.querySelectorAll('#day [role="tabpanel"]')];
  const onTabs = tabs.filter(t => t.getAttribute('aria-selected') === 'true'), shown = panels.filter(x => !x.hidden);
  C.ok(tabs.length === panels.length && tabs.every((t, i) => t.getAttribute('aria-controls') === panels[i].id), 'frise : un repère par carte', where);
  C.ok(onTabs.length === 1 && shown.length === 1 && onTabs[0].getAttribute('aria-controls') === shown[0].id && onTabs[0].tabIndex === 0, 'frise : repère choisi ≠ carte affichée', where);
  C.ok(d.querySelectorAll('#frise .f-s').length === n, 'frise : un repère par séance', where);
  // Repas mangés (3.23.0) : frise, boutons et stockage d'accord ; rien à cocher les jours à venir ; « Reste à manger » ou
  // « Tout est mangé » dès qu'un repas affiché est coché
  try {
    const iso = ($('#week [aria-pressed="true"]') || { dataset: {} }).dataset.value, x = new Date(clock.now);
    const tIso = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    const mg = JSON.parse(w.localStorage.getItem('repas-du-jour:manges:v1') || '{}') || {}, l = iso && iso <= tIso && Array.isArray(mg[iso]) ? mg[iso] : [];
    const meals = [...d.querySelectorAll('#frise .f-m')].map(b => b.dataset.value), on = meals.filter(id => l.includes(id));
    C.ok(JSON.stringify([...d.querySelectorAll('#frise .f-m.is-eaten')].map(b => b.dataset.value)) === JSON.stringify(on), 'frise : repas mangés', () => iso + ' ' + JSON.stringify(l) + ' ' + where());
    C.ok(iso > tIso ? !$('#day .eat') : d.querySelectorAll('#day .eat').length === meals.length && [...d.querySelectorAll('#day .eat')].every(b => (b.getAttribute('aria-pressed') === 'true') === l.includes(b.dataset.value)), 'boutons « Mangé »', () => iso + ' ' + tIso + ' ' + where());
    const msg = $('#eat-msg').textContent;
    C.ok(!on.length ? msg === '' : on.length === meals.length ? /^Tout est mangé/.test(msg) : /^Reste à manger\s:\s≈\s[\d\s]+\skcal et \d+\sg de protéines(, plus ton repas libre)?\.$/.test(msg), 'ce qui reste à manger', () => msg + ' ' + JSON.stringify(on) + ' ' + where());
  } catch (e){ C.ok(false, 'repas mangés : lecture', () => e.message); }
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
    const box = meal.querySelector('.rec'), names = [...meal.querySelectorAll('.items .name')].map(n => n.childNodes[0].textContent.trim());
    // Pas de suggestion non plus quand la recette du couple est à éviter (3.25.0)
    const banP = (JSON.parse(w.localStorage.getItem(PKEY) || '{}') || {}).ban || [], sel = k => (meal.querySelector('[data-action="open-pick"][data-kind="' + k + '"]') || { dataset: {} }).dataset.value;
    const couple = sel('prot') + '-' + sel('starch');
    C.ok(!!box === !(sl === 'diner' && libre) || (!box && banP.includes(couple)), 'recette proposée', () => sl + ' ' + where());
    if (box && box.classList.contains('is-on')) C.ok(names.every(n => ['fruit', 'compote', 'fruits secs', 'chocolat noir'].includes(n)) && box.querySelector('h3') && box.querySelector('.rec-k .mac') && meal.querySelector('.picks').nextElementSibling === box, 'recette choisie : ingrédients sur la page', () => names.join(', ') + ' ' + where());
    else if (box) C.ok(names.includes('légumes') && /^Suggestion/.test(box.textContent), 'repas sans recette : légumes absents', () => names.join(', ') + ' ' + where());
  });
  // Recettes à éviter (3.25.0) : jamais proposées sous un repas
  try {
    const ban = (JSON.parse(w.localStorage.getItem(PKEY) || '{}') || {}).ban || [], RR = w.eval('RECIPES');
    d.querySelectorAll('#day .rec:not(.is-on) .rec-n').forEach(n => C.ok(!ban.some(id => RR[id] && RR[id].t === n.textContent), 'suggestion à éviter', () => n.textContent + ' ' + where()));
  } catch (e){ C.ok(false, 'à éviter : lecture', () => e.message); }
}
// Batch cooking : changer une recette de la fiche (une de la liste, au hasard, ou panneau fermé sans rien changer)
function swapRecipe(dom){
  const d = dom.window.document, sw = R.pick([...d.querySelectorAll('#courses-batch [data-action="co-swap"]')]);
  if (!sw || d.querySelector('#courses').hidden) return;
  const before = dom.window.localStorage.getItem(KEY), how = R.pick(['liste', 'hasard', 'échap']);
  sw.click();
  if (d.querySelector('#sheet').hidden || !d.querySelector('#courses').hasAttribute('inert')) throw new Error('panneau changer non ouvert');
  const opts = [...d.querySelectorAll('#sheet .opt')];
  if (how === 'échap') d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  else (how === 'hasard' ? opts[0] : R.pick(opts.slice(1))).click();
  if (!d.querySelector('#sheet').hidden || d.querySelector('#courses').hasAttribute('inert')) throw new Error('panneau changer resté ouvert');
  if (how === 'échap') C.ok(dom.window.localStorage.getItem(KEY) === before, 'changer : Échap a changé les plats', '');
  else C.ok(/ remplace /.test(d.querySelector('#courses-msg').textContent) && d.activeElement && (d.activeElement.dataset.action === 'co-swap' || d.activeElement.tagName === 'SUMMARY' && d.activeElement.parentNode.open && !d.activeElement.parentNode.querySelector('[data-action="co-swap"]')), 'changer : message ou focus', () => d.querySelector('#courses-msg').textContent);
  swaps++;
}
let swaps = 0;
const ACTIONS = {
  // Séances (3.20.0) : « + Séance » puis une taille et un moment ; une pastille puis son moment, sa durée ou « Retirer »
  add: dom => {
    const d = dom.window.document;
    if (d.querySelector('#page').hidden || d.querySelector('#sess-add').disabled) return 'ajoute -';
    d.querySelector('#sess-add').click();
    const b = R.pick([...d.querySelectorAll('#sheet [data-action="add"]:not(:disabled)')]);
    b.click();
    if (!d.querySelector('#sheet').hidden) throw new Error('panneau d’ajout resté ouvert');
    return 'ajoute ' + b.dataset.value + ' ' + (b.dataset.moment || b.dataset.duree);
  },
  moment: dom => {
    const d = dom.window.document, c = R.pick([...d.querySelectorAll('#sess .chip[data-action="sess"]')]);
    if (!c || d.querySelector('#page').hidden) return 'moment -';
    c.click();
    const b = R.pick([...d.querySelectorAll('#sheet [data-action="smoment"], #sheet [data-action="sduree"]')]);
    b.click();
    if (!d.querySelector('#sheet').hidden) throw new Error('panneau d’une séance resté ouvert');
    return 'moment ' + b.dataset.value;
  },
  rm: dom => {
    const d = dom.window.document, c = R.pick([...d.querySelectorAll('#sess .chip[data-action="sess"]')]);
    if (!c || d.querySelector('#page').hidden) return 'retire -';
    c.click(); d.querySelector('#sheet [data-action="rm"]').click();
    return 'retire';
  },
  // Frise : un repère au doigt ou au clavier (flèches, début, fin)
  frise: dom => {
    const d = dom.window.document, w = dom.window;
    if (d.querySelector('#page').hidden) return 'frise -';
    if (R.chance(.5)){ const t = R.pick([...d.querySelectorAll('#frise [role="tab"]')]); t.click(); return 'frise ' + t.dataset.value; }
    const k = R.pick(['ArrowRight', 'ArrowLeft', 'Home', 'End']);
    d.querySelector('#frise [aria-selected="true"]').focus(); d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
    C.ok(d.activeElement.getAttribute('aria-selected') === 'true', 'frise : focus pas sur le repère choisi', k);
    return 'frise ' + k;
  },
  libre: dom => { dom.window.document.querySelector('#sw-lib').click(); return 'repas libre'; },
  // « Mangé » sur la carte d'un repas (3.23.0) : coché, la carte passe au repas suivant pas encore mangé
  mange: dom => {
    const d = dom.window.document, t = R.pick([...d.querySelectorAll('#frise .f-m')]);
    if (d.querySelector('#page').hidden || !t) return 'mangé -';
    t.click();
    const b = d.querySelector('#eat-' + t.dataset.value);
    if (!b) return 'mangé - (à venir)';
    const was = b.getAttribute('aria-pressed') === 'true';
    b.click();
    const b2 = d.querySelector('#eat-' + t.dataset.value), sel = d.querySelector('#frise [aria-selected="true"]').dataset.value;
    C.ok(b2.getAttribute('aria-pressed') === String(!was) && (sel === t.dataset.value ? d.activeElement === b2 : !was && d.activeElement === d.querySelector('#ft-' + sel)), 'bouton « Mangé »', () => t.dataset.value + ' ' + was + ' → ' + sel);
    return 'mangé ' + t.dataset.value + (was ? ' (décoché)' : '');
  },
  // Glisser sur la carte : le repère voisin de la frise, ou rien (geste court, vertical, bout de la frise)
  glisser: dom => {
    const d = dom.window.document, w = dom.window;
    if (d.querySelector('#page').hidden) return 'glisser -';
    const ids = [...d.querySelectorAll('#frise [role="tab"]')].map(b => b.dataset.value), i = ids.indexOf(d.querySelector('#frise [aria-selected="true"]').dataset.value);
    const dx = R.pick([-150, -70, -40, 40, 70, 150]), dy = R.pick([0, 0, 30, 120]);
    const ev = (type, x, y) => { const e = new w.Event(type, { bubbles: true }); const p = [{ clientX: x, clientY: y }]; e.touches = type === 'touchend' ? [] : p; e.changedTouches = p; return e; };
    const card = d.querySelector('#day [role="tabpanel"]:not([hidden])');
    card.dispatchEvent(ev('touchstart', 200, 300)); card.dispatchEvent(ev('touchend', 200 + dx, 300 + dy));
    const j = Math.abs(dx) >= 60 && Math.abs(dx) >= 1.5 * dy ? Math.min(ids.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1))) : i;
    C.ok(d.querySelector('#frise [aria-selected="true"]').dataset.value === ids[j], 'glisser', () => dx + ',' + dy + ' ' + ids[i] + ' → ' + ids[j]);
    return 'glisser ' + dx + ',' + dy;
  },
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
    // Menu (3.20.0) : un écran du menu remplace celui du dessus, « Journée » ou le retour ramènent à la page
    const seq = R.pick([['#gear', '#reglages [data-action="fermer"]'], ['#help', '#aide [data-action="fermer"]'], ['#gear', '#help-regl', '#aide .btn.wide', '#reglages .btn.wide'], ['#gear', 'retour'], ['#help', 'retour'],
      ['#gear', '#plan-btn', 'retour'], ['#help', '#gear', '#nav-jour'], ['#plan-btn', '#help', '#nav-jour'], ['#gear', '#help-regl', '#gear', 'retour'],
      ['#nav-rec', 'retour'], ['#plan-btn', '#nav-rec', '#help'], ['#nav-rec', '#recettes [data-action="fermer"]'], ['#gear', '#nav-rec', '#nav-jour']]);
    seq.forEach(s => { if (s === 'retour') w.dispatchEvent(new w.PopStateEvent('popstate', { state: null })); else { const e = d.querySelector(s); if (e && !e.closest('[hidden]')) e.click(); } });
    const cur = [...d.querySelectorAll('#nav [aria-current="page"]')], vis = ['page', 'reglages', 'aide', 'plan', 'recettes'].filter(id => !d.getElementById(id).hidden);
    C.ok(cur.length === 1 && vis.length === 1 && cur[0].id === { page: 'nav-jour', reglages: 'gear', aide: 'help', plan: 'plan-btn', recettes: 'nav-rec' }[vis[0]], 'menu : écran surligné', () => seq.join(' ') + ' : ' + vis + ' / ' + cur.map(x => x.id));
    if (!d.getElementById('page').hidden) return 'écrans ' + seq.join(' ');
    d.getElementById('nav-jour').click();
    C.ok(!d.getElementById('page').hidden, 'menu : « Journée » ne ramène pas à la page', () => seq.join(' '));
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
      d.querySelector('#open-repas').click();
    }
    const before = bubbles();
    for (let i = R.int(0, 4); i > 0; i--){
      R.pick([...d.querySelectorAll('#repas-form .sel')]).click();
      if (d.querySelector('#sheet').hidden || !d.querySelector('#repas').hasAttribute('inert')) throw new Error('panneau du formulaire non ouvert');
      R.pick([...d.querySelectorAll('#sheet .opt')]).click();
      if (!d.querySelector('#sheet').hidden || d.querySelector('#repas').hasAttribute('inert')) throw new Error('panneau du formulaire resté ouvert');
    }
    const want = [...d.querySelectorAll('#repas-form .sel')].map(b => b.dataset.kind + (b.dataset.slot || '') + '=' + b.dataset.value);
    const how = R.pick(['valide', 'hasard', 'annule', 'menu', 'retour']);
    if (how === 'valide') d.querySelector('[data-action="repas-ok"]').click();
    else if (how === 'hasard') d.querySelector('[data-action="repas-hasard"]').click();
    else if (how === 'annule') d.querySelector('#repas [data-action="fermer"]').click();
    else if (how === 'menu') d.querySelector('#nav-jour').click();
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
  // Planifier (3.21.0) : une nouvelle planification (période, plats simples, recettes ou batch cooking) puis son détail ;
  // ou une planification de la liste ; dans le détail : cocher, changer une recette du batch, ouvrir un jour ou revenir
  planifier: dom => {
    const d = dom.window.document, w = dom.window, QK = 'repas-du-jour:planifs:v1';
    if (d.querySelector('#page').hidden) return 'planifier -';
    d.querySelector('#plan-btn').click();
    const open = [...d.querySelectorAll('[data-action="pl-open"]')];
    let how = 'liste';
    if (open.length && R.chance(.3)) R.pick(open).click();
    else {
      if (R.chance(.6)) R.pick([...d.querySelectorAll('[data-action="pl-preset"]')]).click();
      else type(dom, 'input[data-range="plan"][data-end="' + R.pick(['from', 'to']) + '"]', R.pick(['2026-10-09', '2026-10-20', '2026-12-31', '', '2026-10-01']));
      how = R.pick(['simple', 'recettes', 'batch', 'batch']);
      d.querySelector('[data-action="pl-type"][data-value="' + (how === 'simple' ? 'simple' : 'recettes') + '"]').click();
      const sw = d.querySelector('#pl-batch');
      if (sw && (sw.getAttribute('aria-checked') === 'true') !== (how === 'batch')) d.querySelector('#pl-batch').click();
      if (how === 'batch') R.pick([...d.querySelectorAll('[data-action="pl-nrec"]')]).click();
      const err = d.querySelector('#plan-err').textContent, before = w.localStorage.getItem(QK);
      const from = d.querySelector('input[data-range="plan"][data-end="from"]').value, to = d.querySelector('input[data-range="plan"][data-end="to"]').value;
      d.querySelector('[data-action="pl-create"]').click();
      if (err){ C.ok(!d.querySelector('#plan').hidden && w.localStorage.getItem(QK) === before, 'planification créée malgré l’erreur', err); d.querySelector('#nav-jour').click(); return 'planifier refusé'; }
      // La nouvelle planification : enregistrée, ses jours tirés selon leur type
      const q = JSON.parse(w.localStorage.getItem(QK)), p = q.list.find(x => x.from === from && x.to === to);
      C.ok(!d.querySelector('#courses').hidden && p && p.type === (how === 'simple' ? 'simple' : 'recettes') && (p.n > 0) === (how === 'batch'), 'planification : détail ou enregistrement', () => how + ' ' + from + ' ' + to + ' ' + JSON.stringify(q.list));
      const st = JSON.parse(w.localStorage.getItem(KEY));
      if (how === 'simple' && p) C.ok(Object.keys(st.plans).filter(k => k >= p.from && k <= p.to).every(k => !st.plans[k].ch.dej.recette && !st.plans[k].ch.diner.recette), 'plats simples avec une recette', () => JSON.stringify(p));
      // Planifications : pas de chevauchement, triées
      C.ok(q.list.every((x, i) => i === 0 || q.list[i - 1].to < x.from), 'planifications qui se chevauchent', () => JSON.stringify(q.list));
    }
    if (d.querySelector('#courses').hidden) throw new Error('détail de la planification non ouvert');
    for (let i = R.int(0, 3); i > 0; i--){ const b = R.pick([...d.querySelectorAll('#courses-list .chk')]); if (b) b.click(); }
    if (R.chance(.5)) swapRecipe(dom);
    // Partager la liste, refaire les plats ou retirer la planification (3.22.0), avec ou sans confirmer
    const m = R.pick(['partage', 'refaire', 'retirer', '-', '-']), QK2 = 'repas-du-jour:planifs:v1';
    if (m === 'partage'){ d.querySelector('#co-share').click(); C.ok(!d.querySelector('#co-text').hidden && /^Courses, /.test(d.querySelector('#co-text').value), 'partage de la liste', ''); }
    else if (m !== '-' && !d.querySelector(m === 'refaire' ? '#co-redo' : '#co-del').hidden){
      d.querySelector(m === 'refaire' ? '#co-redo' : '#co-del').click();
      if (d.querySelector('#co-confirm').hidden) throw new Error('pas de confirmation : ' + m);
      if (R.chance(.3)){ const before = w.localStorage.getItem(QK2); d.querySelector('#co-no').click(); C.ok(w.localStorage.getItem(QK2) === before && d.querySelector('#co-confirm').hidden, 'confirmation annulée : rien ne change', m); }
      else {
        const n = JSON.parse(w.localStorage.getItem(QK2)).list.length;
        d.querySelector('#co-ok').click();
        const q2 = JSON.parse(w.localStorage.getItem(QK2)).list;
        C.ok(q2.every((x, i) => i === 0 || q2[i - 1].to < x.from), 'planifications qui se chevauchent après ' + m, () => JSON.stringify(q2));
        if (m === 'retirer'){ C.ok(q2.length === n - 1 && !d.querySelector('#plan').hidden && d.querySelector('#courses').hidden, 'planification non retirée', ''); d.querySelector('#nav-jour').click(); return 'planifier retirée'; }
        C.ok(!d.querySelector('#courses').hidden && /^Plats refaits/.test(d.querySelector('#courses-msg').textContent), 'plats non refaits', '');
      }
    }
    const day = R.pick([...d.querySelectorAll('#courses-days .shop-day')]), end = R.pick(['jour', 'liste', 'menu', 'retour']);
    if (end === 'jour' && day) day.click();
    else if (end === 'liste') d.querySelector('#courses [data-action="fermer"]').click();
    else if (end === 'retour') w.dispatchEvent(new w.PopStateEvent('popstate', { state: null }));
    else d.querySelector('#nav-jour').click();
    if (!d.querySelector('#plan').hidden && R.chance(.5)) d.querySelector('#nav-jour').click();
    C.ok(d.querySelector('#courses').hidden, 'détail resté ouvert', end);
    return 'planifier ' + how + ' ' + end;
  },
  // Recettes (3.24.0) : quelques filtres, une recette prise pour un repas (ou fiche fermée), la date enregistrée suit
  recettes: dom => {
    const d = dom.window.document, w = dom.window;
    if (d.querySelector('#page').hidden) return 'recettes -';
    d.querySelector('#nav-rec').click();
    const pick = (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
    if (R.chance(.4)) pick('#lib-prot', R.pick(['', 'poulet', 'boeuf', 'saumon', 'thon', 'oeufs']));
    if (R.chance(.4)) pick('#lib-starch', R.pick(['', 'riz', 'pates', 'lentilles']));
    if (R.chance(.3)) d.querySelector(R.pick(['#lib-box', '#lib-quick', '#lib-mine'])).click();
    const tg = R.pick([...d.querySelectorAll('[data-action="lib-for"]')]); tg.click();
    const items = [...d.querySelectorAll('#lib-list .lib-r')], n = +(/^\d+/.exec(d.querySelector('#lib-n').textContent) || [0])[0];
    C.ok(items.length === (n || 0) && (!items.length || /\srecettes?(\.|, mais)/.test(d.querySelector('#lib-n').textContent)), 'recettes : nombre affiché', () => n + ' / ' + items.length);
    const bans = items.map(x => x.classList.contains('is-ban'));
    C.ok(bans.every((x, i) => !x || bans.slice(i).every(Boolean)), 'recettes : celles à éviter en fin de liste', () => bans.join());
    const b = R.pick(items), out = () => { d.querySelector(R.pick(['#nav-jour', '#recettes [data-action="fermer"]'])).click(); };
    if (!b){ out(); return 'recettes vides'; }
    b.click();
    const take = d.querySelector('[data-action="lib-take"]');
    if (!take || R.chance(.3)){ d.querySelector('#sheet .sheet-x').click(); C.ok(d.activeElement === d.getElementById(b.id), 'recettes : focus après la fiche', b.id); out(); return 'recettes fiche'; }
    take.click();
    const q = tg.dataset.value.split('|'), x = new Date(clock.now + 864e5 * +q[0]), iso = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    const st = JSON.parse(w.localStorage.getItem(KEY)), c = st.plans[iso] && st.plans[iso].ch && st.plans[iso].ch[q[1]];
    C.ok(c && c.recette === b.dataset.value && d.querySelector('#sheet').hidden && d.activeElement && d.activeElement.id === b.id, 'recettes : prise', () => iso + ' ' + JSON.stringify(c) + ' ' + b.dataset.value);
    if (R.chance(.5)) d.querySelector('#lib-msg [data-action="lib-day"]').click(); else out();
    return 'recette prise ' + b.dataset.value + ' ' + tg.dataset.value;
  },
  // Fiche d'une recette de la page : favorite ou à éviter (l'une ou l'autre), puis fermée
  preferer: dom => {
    const d = dom.window.document, b = R.pick([...d.querySelectorAll('#day [data-action="rec-view"]')]);
    if (d.querySelector('#page').hidden || !b) return 'préférer -';
    b.click();
    const k = R.pick(['fav', 'ban']), btn = d.querySelector('#rp-' + k), was = btn.getAttribute('aria-pressed') === 'true';
    btn.click();
    const other = d.querySelector('#rp-' + (k === 'fav' ? 'ban' : 'fav'));
    C.ok(btn.getAttribute('aria-pressed') === String(!was) && other.getAttribute('aria-pressed') === 'false' && d.activeElement === btn, 'favorite ou à éviter', k);
    d.querySelector('#sheet .sheet-x').click();
    return 'préférer ' + k + (was ? ' (retirée)' : '');
  },
  // Journée : « Un autre plat » pour un repas (un autre couple, le dessert gardé)
  redo: dom => {
    const d = dom.window.document, b = R.pick([...d.querySelectorAll('#day .redo')]);
    if (d.querySelector('#page').hidden || !b) return 'autre plat -';
    const slot = b.dataset.slot, val = k => d.querySelector('[data-action="open-pick"][data-kind="' + k + '"][data-slot="' + slot + '"]').dataset.value;
    const before = val('prot') + '/' + val('starch'), des = val('dessert');
    b.click();
    C.ok((val('prot') + '/' + val('starch') !== before || /Aucun autre plat/.test(d.querySelector('#hint').textContent)) && val('dessert') === des, 'un autre plat', () => before + ' → ' + val('prot') + '/' + val('starch'));
    return 'autre plat ' + slot;
  },
  // Journée : la page du batch d'une recette, puis retour
  batch: dom => {
    const d = dom.window.document, b = d.querySelector('#rec-b-dej, #rec-b-diner');
    if (d.querySelector('#page').hidden || !b) return 'batch -';
    b.click();
    const n = d.querySelectorAll('#batch-body .b-list')[1].querySelectorAll('li').length;
    C.ok(!d.querySelector('#batch').hidden && n >= 2 && new RegExp('\\s' + n + '\\sboîtes\\.').test(d.querySelector('#batch-body .calc').textContent) && d.querySelectorAll('#batch-body .rec-steps li').length === 3, 'page du batch', () => d.querySelector('#batch-body').textContent.slice(0, 160));
    d.querySelector('#batch [data-action="fermer"]').click();
    C.ok(!d.querySelector('#page').hidden && d.activeElement === b.ownerDocument.getElementById(b.id), 'page du batch : retour', '');
    return 'batch';
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
  // Réglages, « Effacer mes données » : annuler (rien ne part) ou confirmer (plus aucune clé de l'appli, accueil), puis « Passer »
  effacer: dom => {
    const d = dom.window.document, ls = dom.window.localStorage;
    if (d.querySelector('#page').hidden) return 'effacer -';
    d.querySelector('#gear').click();
    d.querySelector('[data-action="eff-ask"]').click();
    const keys = () => { const o = []; for (let i = 0; i < ls.length; i++) if (ls.key(i).startsWith('repas-du-jour:')) o.push(ls.key(i)); return o; };
    if (R.chance(.3)){
      const before = keys().length;
      d.querySelector('[data-action="eff-no"]').click();
      C.ok(keys().length === before && d.querySelector('#eff-confirm').hidden, 'effacer : annuler a effacé', '');
      d.querySelector('#reglages [data-action="fermer"]').click();
      return 'effacer annulé';
    }
    d.querySelector('[data-action="eff-ok"]').click();
    C.ok(keys().length === 0 && !d.querySelector('#accueil').hidden && d.querySelector('#reglages').hidden, 'effacer : données restées ou pas d’accueil', () => keys().join(', '));
    d.querySelector('[data-action="acc-skip"]').click();
    if (!d.querySelector('#repas').hidden) d.querySelector('#repas [data-action="fermer"]').click();
    C.ok(!d.querySelector('#page').hidden && d.querySelectorAll('#sess .chip[data-action="sess"]').length === 0, 'effacer : page pas de zéro', '');
    return 'effacer';
  },
  // Réglages : onglets au doigt ou au clavier, puis retour ; le bon panneau seul visible, l'onglet choisi marqué
  onglets: dom => {
    const d = dom.window.document, w = dom.window;
    if (d.querySelector('#page').hidden) return 'onglets -';
    d.querySelector('#gear').click();
    const done = [];
    for (let i = R.int(1, 4); i > 0; i--){
      if (R.chance(.5)){ const t = R.pick([...d.querySelectorAll('#besoins [role="tab"]')]); t.click(); done.push(t.dataset.value); }
      else { const k = R.pick(['ArrowRight', 'ArrowLeft', 'Home', 'End']); d.querySelector('#besoins [role="tab"][aria-selected="true"]').focus(); d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true })); done.push(k); }
      const on = [...d.querySelectorAll('#besoins [role="tab"]')].filter(t => t.getAttribute('aria-selected') === 'true'), vis = [...d.querySelectorAll('#besoins [role="tabpanel"]')].filter(x => !x.hidden);
      C.ok(on.length === 1 && vis.length === 1 && on[0].getAttribute('aria-controls') === vis[0].id && on[0].tabIndex === 0, 'onglets : panneau ou onglet', () => done.join(' '));
    }
    d.querySelector('#reglages > [data-action="fermer"]').click();
    return 'onglets ' + done.join(' ');
  },
  day: dom => { clock.now += 864e5 * R.pick([1, 1, 2, 7]); dom.window.dispatchEvent(new dom.window.Event('focus')); return 'jour suivant'; },
  accueil: dom => {
    const d = dom.window.document;
    d.querySelector('[data-action="accueil"]').click();
    for (let i = R.int(0, 3); i > 0; i--) d.querySelector('#acc-next').click();
    // Dernière étape : quelques boutons de la semaine type
    if (!d.querySelector('#acs').hidden) for (let i = R.int(0, 4); i > 0; i--){ const b = R.pick([...d.querySelectorAll('#acs button:not(:disabled)')]); if (b) b.click(); }
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
      // La carte affichée peut changer au rechargement (repas du moment), pas le contenu des cartes
      const dayHTML = doc => doc.querySelector('#day').innerHTML.replace(/ bump/g, '').replace(/ hidden=""/g, '').replace(/ in-[lr]/g, '');
      const before = dayHTML(was), sumText = was.querySelector('#sum-text').textContent;
      // Au chargement, la page montre aujourd'hui : comparable seulement si elle montrait aujourd'hui
      const onPage = !was.querySelector('#page').hidden && was.querySelector('#date').textContent.startsWith('Aujourd’hui');
      dom = open(snapshot(dom.window));
      const d2 = dom.window.document;
      if (onPage && !d2.querySelector('#page').hidden)
        C.ok(dayHTML(d2) === before && d2.querySelector('#sum-text').textContent === sumText, 'rechargement : page différente', () => log.slice(-5).join(' › '));
      log.push('rechargement');
    }
  }
}
C.ok(errors.length === 0, 'erreur JavaScript dans la page', () => errors.slice(0, 3).join(' | '));
C.done(actions + ' actions au hasard (dont ' + swaps + ' sur « Changer de recette »), 9 dates, ' + C.checks + ' vérifications, graine ' + seed);
