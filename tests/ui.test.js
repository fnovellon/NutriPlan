// Simule l'utilisation de index.html dans un navigateur (jsdom), à date fixe.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const KEY = 'repas-du-jour:v2', OLD_KEY = 'repas-du-jour:v1', PKEY = 'repas-du-jour:profil:v1', RKEY = 'repas-du-jour:repas:v1';
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
const isoOf = t => { const x = new Date(t); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
// Un profil (vide) est enregistré, sauf pour un premier lancement (fresh) : l'accueil ne s'affiche pas.
// Le formulaire des repas est noté comme déjà vu aujourd'hui (il ne s'ouvre pas tout seul), sauf avec fresh ou repas.
const open = (seed, fresh, repas) => new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://example.org/', virtualConsole: vc,
  beforeParse: win => {
    withClock(win);
    if (!fresh) win.localStorage.setItem(PKEY, '{}');
    if (!fresh && !repas) win.localStorage.setItem(RKEY, isoOf(now));
    if (seed) seed(win.localStorage);
  }
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
    // Choix d'un plat : toucher la bulle ouvre le panneau, toucher un choix le valide et le ferme
    choose: (kind, slot, value) => {
      click(`[data-action="open-pick"][data-kind="${kind}"]` + (slot ? `[data-slot="${slot}"]` : ''));
      assert(!$('#sheet').hidden, 'panneau de choix non ouvert : ' + kind);
      click(`#sheet [data-value="${value}"]`);
      assert($('#sheet').hidden, 'panneau de choix resté ouvert : ' + kind);
    },
    chosen: (kind, slot) => $(`[data-action="open-pick"][data-kind="${kind}"]` + (slot ? `[data-slot="${slot}"]` : '')).dataset.value,
    // Séances de la page (3.20.0) : une pastille par séance (nom complet dans son aria-label), dans l'ordre de la journée ;
    // ajout, moment, durée et retrait par le panneau du bas
    sess: () => [...d.querySelectorAll('#sess .chip[data-action="sess"]')].sort((a, b) => a.dataset.index - b.dataset.index).map(e => e.getAttribute('aria-label').split(',')[0]),
    chips: () => [...d.querySelectorAll('#sess .chip[data-action="sess"]')].map(e => e.textContent),
    add: (size, how) => {
      click('#sess-add');
      assert(!$('#sheet').hidden, 'panneau d’ajout non ouvert');
      click(`#sheet [data-action="add"][data-value="${size}"]` + (size === 'longue' ? `[data-duree="${how || 2}"]` : `[data-moment="${how || 'soir'}"]`));
      assert($('#sheet').hidden, 'panneau d’ajout resté ouvert');
    },
    at: (i, m) => { click(`#sess-${i}`); click(`#sheet [data-action="smoment"][data-index="${i}"][data-value="${m}"]`); },
    dur: (i, h) => { click(`#sess-${i}`); click(`#sheet [data-action="sduree"][data-index="${i}"][data-value="${h}"]`); },
    rm: i => { click(`#sess-${i}`); click(`#sheet [data-action="rm"][data-index="${i}"]`); }
  };
};

const dom = open();
const { d, $, click, stored, sections, setSwitch, starchLine, pressed, choose, chosen, sess, chips, add, at, dur, rm } = tools(dom);

assert(/kcal/.test($('#sum-text').textContent), 'résumé absent au chargement');
assert.strictEqual($('#date').textContent, 'Aujourd’hui, mercredi 7 octobre');
assert(/aujourd’hui/.test($('#title').textContent), 'titre du jour');
assert.strictEqual(d.querySelectorAll('#week [data-action="day"]').length, 7, 'bandeau de la semaine');
assert.deepStrictEqual(sess(), [], 'le jour part sans séance');
assert($('#accueil').hidden && !$('#page').hidden, 'accueil affiché alors qu’un profil existe');
assert(/Repos/.test($('#sess').textContent), 'repos non affiché');

// Séances du jour : ajout, moment, retrait (choix fixés pour que le skyr du soir ne s'ajoute pas)
choose('prot', 'dej', 'poulet');
choose('starch', 'dej', 'riz');
choose('prot', 'diner', 'poisson');
choose('starch', 'diner', 'pdt');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner']);
assert(/shaker de protéines/.test(d.querySelector('[aria-labelledby="h-co"]').textContent), 'shaker dans la collation un jour sans séance');
add('petite');
assert.deepStrictEqual(sess(), ['Petite séance']);
assert.deepStrictEqual(chips(), ['Petite, soir'], 'pastille de la séance');
assert.strictEqual(d.activeElement, $('#sess-add'), 'focus rendu à « + Séance »');
// Toucher la pastille : son moment (choisi), « Retirer » ; Échap ferme sans rien changer
click('#sess-0');
assert(!$('#sheet').hidden && $('#sheet-t').textContent === 'Petite séance, le soir' && $('#sheet [data-action="smoment"][aria-pressed="true"]').dataset.value === 'soir' && $('#sheet [data-action="rm"]'), 'panneau d’une séance');
assert($('#page').hasAttribute('inert') && $('#nav').hasAttribute('inert') && d.activeElement === $('#sheet [aria-pressed="true"]'), 'page et menu inertes, focus sur le moment');
d.dispatchEvent(new d.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert($('#sheet').hidden && d.activeElement === $('#sess-0') && chips()[0] === 'Petite, soir', 'Échap : séance inchangée');
// Ajout en un toucher, avec son moment
click('#sess-add');
assert($('#sheet-t').textContent === 'Ajouter une séance' && d.querySelectorAll('#sheet [data-action="add"]').length === 10 && $('#sheet-list').classList.contains('sess-sheet'), 'panneau d’ajout');
assert.strictEqual($('#sheet [data-value="moyenne"][data-moment="midi"]').getAttribute('aria-label'), 'Séance moyenne, à midi', 'nom d’un ajout');
click('#sheet .sheet-x');
add('moyenne', 'midi');
assert.deepStrictEqual(chips(), ['Moyenne, midi', 'Petite, soir'], 'ajout avec son moment, pastilles dans l’ordre de la journée');
rm(1);
assert.deepStrictEqual(chips(), ['Petite, soir'], 'séance retirée par son panneau');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Petite séance', 'Shaker', 'Dîner']);
at(0, 'matin');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Petite séance', 'Collation', 'Déjeuner', 'Dîner']);
add('moyenne');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Petite séance', 'Déjeuner', 'Collation', 'Séance moyenne', 'Shaker', 'Dîner']);
add('longue');
assert.deepStrictEqual(sess(), ['Petite séance', 'Séance moyenne', 'Sortie longue']);
assert.deepStrictEqual(chips(), ['Petite, matin', 'Longue, 2\u00a0h', 'Moyenne, soir'], 'pastilles dans l’ordre de la journée');
click('#sess-add');
assert([...d.querySelectorAll('#sheet [data-action="add"][data-value="longue"]')].every(b => b.disabled) && !$('#sheet [data-action="add"][data-value="petite"]').disabled, 'une seule sortie longue');
click('#sheet .sheet-x');
assert.deepStrictEqual(sections(), ['Petit-déjeuner', 'Petite séance', 'Sortie longue', 'Déjeuner', 'Goûter', 'Séance moyenne', 'Shaker', 'Dîner']);
dur(2, 3);
assert(/^180\sg/.test($('#day .band .qty').textContent), 'ravito de la sortie longue de 3 h');
add('petite');
assert($('#sess-add').disabled && d.activeElement === $('#sess-3'), 'quatre séances au plus, focus sur la nouvelle');
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
// Son interrupteur est dans la carte du dîner (3.20.0) : le focus y reste, la frise dit « Repas libre »
assert($('#sw-lib').closest('#sec-diner') && d.activeElement === $('#sw-lib') && $('#ft-diner .f-l').textContent === 'Repas libre', 'repas libre dans la carte du dîner');
assert(/samedi/.test($('#hint').textContent), 'message du repas libre déplacé');
assert.strictEqual(stored().plans['2026-10-10'].libre, false, 'repas libre du samedi non retiré');
setSwitch('libre', false);
assert.strictEqual($('#hint').textContent, '', 'message non effacé');

// Frise (3.20.0) : un repère par repas et par séance, dans l'ordre de la journée, une seule carte affichée (celle du repère
// choisi) ; à 9 h aujourd'hui, le petit-déjeuner
{
  const tabs = () => [...d.querySelectorAll('#frise [role="tab"]')];
  const shownCard = () => [...d.querySelectorAll('#day [role="tabpanel"]')].filter(x => !x.hidden).map(x => x.id).join();
  const key = k => d.activeElement.dispatchEvent(new d.defaultView.KeyboardEvent('keydown', { key: k, bubbles: true }));
  assert.deepStrictEqual(tabs().map(t => t.dataset.value), ['pd', 'dej', 'co', 'band0', 'shk', 'diner'], 'repères de la frise');
  assert.deepStrictEqual(tabs().map(t => t.getAttribute('aria-label')), ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Séance moyenne, le soir', 'Shaker', 'Dîner'], 'noms des repères');
  assert(shownCard() === 'sec-pd' && $('#ft-pd').getAttribute('aria-selected') === 'true' && $('#ft-pd').tabIndex === 0 && $('#ft-dej').tabIndex === -1, 'carte du petit-déjeuner à 9 h');
  assert($('#ft-band0').classList.contains('f-s') && $('#ft-band0 .tip').textContent === 'Séance moyenne, le soir', 'repère de séance, son nom au survol');
  click('#ft-diner');
  assert(shownCard() === 'sec-diner' && $('#ft-diner').getAttribute('aria-selected') === 'true' && $('#ft-pd').getAttribute('aria-selected') === 'false', 'carte du dîner');
  // Clavier : flèches en boucle, début, fin ; le focus suit
  $('#ft-diner').focus(); key('ArrowRight');
  assert(shownCard() === 'sec-pd' && d.activeElement === $('#ft-pd'), 'flèche droite depuis le dernier : le premier');
  key('ArrowLeft'); assert(shownCard() === 'sec-diner' && d.activeElement === $('#ft-diner'), 'flèche gauche depuis le premier : le dernier');
  key('Home'); assert(shownCard() === 'sec-pd', 'début');
  key('End'); key('ArrowLeft'); assert(shownCard() === 'sec-shk', 'fin, puis flèche gauche');
  // Carte d'une séance : son nom, son moment, ce qu'elle coûte
  click('#ft-band0');
  assert(shownCard() === 'sec-band0' && /^Séance moyenne\s*le soir/.test($('#sec-band0').textContent) && /Environ [\d\s]+\skcal dépensées, comptées dans ta journée\./.test($('#sec-band0').textContent), 'carte de la séance : ' + $('#sec-band0').textContent);
  // Un choix redessine la page sans changer de carte ; une séance retirée : sa carte part, celle du moment revient
  choose('starch', 'dej', 'pates'); choose('starch', 'dej', 'riz');
  assert.strictEqual(shownCard(), 'sec-band0', 'carte gardée après un choix');
  click('#ft-diner');
  // Repas du moment selon l'heure ; un autre jour, le petit-déjeuner ; en changeant de jour, la carte reste si elle existe
  const keep = now;
  for (const [h, id] of [[7, 'pd'], [12, 'dej'], [16, 'co'], [20, 'diner']]) {
    now = new Date(2026, 9, 7, h).getTime();
    const t = tools(open());
    assert.strictEqual(t.$('#frise [aria-selected="true"]').dataset.value, id, 'repas du moment à ' + h + ' h');
    t.click('#week [data-value="2026-10-08"]');
    assert.strictEqual(t.$('#frise [aria-selected="true"]').dataset.value, id, 'carte gardée en changeant de jour (' + id + ')');
  }
  // À 20 h, un autre jour sans la séance affichée : son petit-déjeuner (pas le repas du moment)
  now = new Date(2026, 9, 7, 20).getTime();
  const other = tools(open(ls => ls.setItem(KEY, JSON.stringify({ plans: { '2026-10-07': { seances: [{ taille: 'petite', moment: 'soir' }] } }, choices: {} }))));
  other.click('#ft-band0'); other.click('#week [data-value="2026-10-08"]');
  assert.strictEqual(other.$('#frise [aria-selected="true"]').dataset.value, 'pd', 'autre jour sans cette séance : le petit-déjeuner');
  now = keep;
}

// Changer de féculent change la quantité et la met en évidence
choose('starch', 'dej', 'riz');
const riz = starchLine('dej');
choose('starch', 'dej', 'pdt');
assert.notStrictEqual(starchLine('dej'), riz, 'la quantité de féculent ne change pas');
assert($('[aria-labelledby="h-dej"] .qty.bump'), 'changement non mis en évidence');

// Poids cru et cuit sous la quantité, calories et macros sous chaque aliment
choose('starch', 'dej', 'riz');
const dejLi = t => [...d.querySelectorAll('[aria-labelledby="h-dej"] .items li')].find(li => li.querySelector('.name').textContent.startsWith(t));
const ck = li => [...li.querySelectorAll('.q .ck')].map(e => e.textContent);
const pouletCru = parseInt(dejLi('viande blanche').querySelector('.qty').textContent, 10);
assert.deepStrictEqual(ck(dejLi('viande blanche')), ['cru', '≈\u00A0' + Math.round(pouletCru * 0.75 / 5) * 5 + '\u00A0g cuit'], 'poids cuit du poulet');
assert(ck(dejLi('riz')).length === 2 && /cuit$/.test(ck(dejLi('riz'))[1]), 'poids cuit du riz');
assert.deepStrictEqual(ck(dejLi('légumes')), [], 'poids cuit des légumes');
choose('starch', 'dej', 'pdt');
const pdtCk = ck(dejLi('pommes de terre'));
assert(pdtCk.length === 3 && pdtCk[0] === 'crues' && /à l’eau$/.test(pdtCk[1]) && /au four$/.test(pdtCk[2]), 'cuissons des pommes de terre : ' + pdtCk.join(' | '));
choose('starch', 'dej', 'riz');
const isMarge = li => /pour la cuisine/.test(li.textContent);
for (const id of ['dej', 'diner']) {
  const li = [...d.querySelectorAll(`[aria-labelledby="h-${id}"] .items li`)].find(isMarge);
  assert(li && /≈\s75/.test(li.querySelector('.qty').textContent) && !li.querySelector('.mac'), 'marge cuisine au ' + id);
}
// Budgets (marge cuisine, encas) : une quantité en kcal, pas de ligne de macros
const isBudget = li => isMarge(li) || /kcal d’encas/.test(li.textContent);
for (const li of d.querySelectorAll('#day .items li')) {
  if (isBudget(li)) { assert(!li.querySelector('.mac') && /^≈/.test(li.querySelector('.qty').textContent), 'budget avec des macros : ' + li.textContent); continue; }
  assert(/kcal\s*P\s\d+\sg\s*G\s\d+\sg\s*L\s\d+\sg/.test(li.querySelector('.mac').textContent), 'macros absentes : ' + li.textContent);
}
for (const meal of d.querySelectorAll('#day .meal')) {
  const shown = [...meal.querySelectorAll('.mac > span:first-child')].reduce((a, e) => a + Number(e.textContent.replace(/\D/g, '')), 0) +
    [...meal.querySelectorAll('.items li')].filter(isBudget).reduce((a, li) => a + Number(li.querySelector('.qty').textContent.replace(/\D/g, '')), 0);
  const head = Number(meal.querySelector('.kcal').textContent.replace(/\D/g, ''));
  assert(Math.abs(shown - head) <= 10, `kcal des aliments (${shown}) et du repas (${head})`);
}

// Choix des plats : une seule bulle par rangée ; la toucher grise l'écran et ouvre le panneau des choix
const win = dom.window;
assert.strictEqual(d.querySelectorAll('#day .sel').length, 7, 'une bulle par choix (base, 3 au déjeuner, 3 au dîner)');
assert(!d.querySelector('#day [data-action="prot"], #day [data-action="starch"], #day [data-action="dessert"], #day [data-action="pd"]'), 'les autres choix sont affichés dans la page');
const trig = $('[data-action="open-pick"][data-kind="prot"][data-slot="dej"]');
assert(trig.textContent.trim() === 'Viande blanche' && trig.getAttribute('aria-haspopup') === 'dialog', 'bulle de la protéine du déjeuner : ' + trig.textContent);
const openSheet = () => { click('[data-action="open-pick"][data-kind="prot"][data-slot="dej"]'); assert(!$('#sheet').hidden, 'panneau non ouvert'); };
openSheet();
assert($('#sheet-t').textContent === 'Protéine du déjeuner' && d.querySelectorAll('#sheet .opt').length === 8, 'titre et choix du panneau');
assert($('#page').hasAttribute('inert') && win.history.state && win.history.state.pick, 'page non inerte sous le panneau');
assert.strictEqual(d.activeElement, $('#sheet .opt[aria-pressed="true"]'), 'focus sur le choix actuel');
assert.strictEqual(d.activeElement.dataset.value, 'poulet', 'choix actuel du panneau');
d.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert($('#sheet').hidden && !$('#page').hasAttribute('inert') && d.activeElement === $('#sel-prot-dej'), 'Échap ne ferme pas le panneau');
openSheet(); click('#sheet .scrim');
assert($('#sheet').hidden && chosen('prot', 'dej') === 'poulet', 'le fond grisé ne ferme pas le panneau sans rien changer');
openSheet(); click('#sheet .sheet-x');
assert($('#sheet').hidden, 'le bouton × ne ferme pas le panneau');
openSheet(); win.dispatchEvent(new win.PopStateEvent('popstate', { state: null }));
assert($('#sheet').hidden, 'le bouton retour ne ferme pas le panneau');
choose('prot', 'dej', 'boeuf');
assert(chosen('prot', 'dej') === 'boeuf' && /Bœuf/.test($('#sel-prot-dej').textContent) && stored().choices[3].dej.prot === 'boeuf', 'choix non validé');
assert.strictEqual(d.activeElement, $('#sel-prot-dej'), 'focus non rendu à la bulle');
choose('prot', 'dej', 'poulet');
choose('pd', null, 'pain');
assert(chosen('pd') === 'pain' && /Pain complet/.test($('#sel-pd').textContent), 'base du petit-déjeuner');
choose('pd', null, 'avoine');
// Trois bases au petit-déjeuner, avec leur détail ; le salé : pain, œufs, une tranche de jambon et fruit, ni skyr ni amandes
const pdLines = () => [...d.querySelectorAll('[aria-labelledby="h-pd"] .items li')].map(li => li.textContent);
click('#sel-pd');
assert.deepStrictEqual([...d.querySelectorAll('#sheet .opt')].map(o => [o.dataset.value, (o.querySelector('.opt-s') || {}).textContent || null]),
  [['avoine', 'ou muesli sans sucre ajouté'], ['pain', null], ['sale', 'pain complet, œufs, jambon']], 'bases du petit-déjeuner');
click('#sheet [data-value="sale"]');
assert(chosen('pd') === 'sale' && $('#sel-pd').textContent.trim() === 'Salé' && stored().choices[3].pdBase === 'sale', 'petit-déjeuner salé non choisi');
assert(pdLines().length === 4 && /2\s*œufs/.test(pdLines()[1]) && /jambon blanc/.test(pdLines()[2]) && /1 tranche/.test(pdLines()[2]) && !pdLines().some(t => /skyr|amandes/.test(t)), 'petit-déjeuner salé : ' + pdLines().join(' / '));
choose('pd', null, 'avoine');
assert(/flocons d’avoine ou muesli/.test(pdLines()[0]) && /trempés la veille dans le skyr/.test(pdLines()[0]), 'avoine ou muesli : ' + pdLines()[0]);
// Collation : des œufs tout court
assert([...d.querySelectorAll('#day li')].some(li => /^2\s*œufs/.test(li.textContent.trim()) && /durs ou mollets/.test(li.textContent)) && !/mariné/.test($('#day').textContent), 'œufs de la collation');

// Dessert : rangée au déjeuner et au dîner, Aucun par défaut, ligne en fin de repas, choix enregistré
const desPressed = slot => chosen('dessert', slot);
const lastLine = slot => [...d.querySelectorAll(`[aria-labelledby="h-${slot}"] .items li`)].slice(-1)[0].textContent;
click('[data-action="open-pick"][data-kind="dessert"][data-slot="dej"]');
assert.strictEqual(d.querySelectorAll('#sheet [data-action="dessert"][data-slot="dej"]').length, 5, 'choix de dessert au déjeuner');
click('#sheet .scrim');
assert(desPressed('dej') === 'aucun' && desPressed('diner') === 'aucun', 'aucun dessert par défaut');
// Le dessert est pris sur le féculent du même repas, ou sur l'encas si ce féculent est déjà à son plafond
const dejStarch = () => parseInt(starchLine('dej').match(/^\d+/)[0], 10);
const encasKcal = () => { const li = [...d.querySelectorAll('#day li')].find(l => /kcal d’encas/.test(l.textContent)); return li ? Number(li.querySelector('.qty').textContent.replace(/\D/g, '')) : 0; };
const totalBefore = $('#sum-text strong').textContent, starchBefore = dejStarch(), encasBefore = encasKcal();
choose('dessert', 'dej', 'chocolat');
assert(/chocolat noir/.test(lastLine('dej')) && /20\sg/.test(lastLine('dej')) && desPressed('dej') === 'chocolat', 'dessert du déjeuner : ' + lastLine('dej'));
assert.strictEqual(stored().choices[3].dej.dessert, 'chocolat', 'dessert non enregistré');
assert(Math.abs(Number($('#sum-text strong').textContent.replace(/\D/g, '')) - Number(totalBefore.replace(/\D/g, ''))) <= 20, 'le dessert change le total : ' + totalBefore + ' → ' + $('#sum-text strong').textContent);
assert(dejStarch() < starchBefore || encasKcal() < encasBefore, 'le dessert n’est pris ni sur le féculent ni sur l’encas');
choose('dessert', 'diner', 'fruit');
assert(/fruit/.test(lastLine('diner')) && /pomme, poire/.test(lastLine('diner')), 'dessert du dîner : ' + lastLine('diner'));
choose('dessert', 'dej', 'aucun');
choose('dessert', 'diner', 'aucun');
assert(!/chocolat|fruit/.test(lastLine('dej') + lastLine('diner')) && stored().choices[3].dej.dessert === 'aucun', 'dessert non retiré');
// Choix d'un repas sur une ligne (3.20.0) : libellés lus seulement par le lecteur d'écran ; sans dessert, « + Dessert » en contour
assert([...d.querySelectorAll('#day .pick-l')].every(l => l.classList.contains('sr')) && $('#sec-dej .picks').querySelectorAll(':scope > .pick').length === 3 && $('#sec-dej .picks > #redo-dej').getAttribute('aria-label') === 'Un autre plat du déjeuner', 'choix du déjeuner sur une ligne, puis « Un autre plat »');
assert($('#sel-dessert-dej').classList.contains('empty') && $('#sel-dessert-dej').textContent === '+\u00a0Dessert' && $('#sel-dessert-dej').getAttribute('aria-label') === 'Dessert\u00a0: aucun', 'sans dessert : ' + $('#sel-dessert-dej').textContent);
choose('dessert', 'dej', 'fruit');
assert(!$('#sel-dessert-dej').classList.contains('empty') && $('#sel-dessert-dej').textContent.trim() === 'Fruit' && $('#sel-dessert-dej').getAttribute('aria-labelledby') === 'l-dessert-dej sel-dessert-dej', 'dessert choisi : ' + $('#sel-dessert-dej').textContent);
choose('dessert', 'dej', 'aucun');

// Formulaire des repas du jour : s'ouvre tout seul à la première ouverture de la journée, une seule fois
const rdom = open(null, false, true), r = tools(rdom), rw = rdom.window;
assert(!r.$('#repas').hidden && r.$('#page').hidden, 'formulaire des repas non ouvert au premier passage du jour');
assert.strictEqual(rw.document.activeElement, r.$('#repas-h'), 'focus sur le titre du formulaire');
assert.strictEqual(rw.localStorage.getItem(RKEY), '2026-10-07', 'formulaire non noté comme vu');
// Même sélecteur que la page : une ligne par choix, la sélection dans une bulle (mercredi : avoine, poulet + riz, poisson + lentilles, sans dessert)
const rows = () => [...r.d.querySelectorAll('#repas-form .sel')].map(b => b.dataset.value);
assert.deepStrictEqual(rows(), ['avoine', 'poulet', 'riz', 'aucun', 'poisson', 'lentilles', 'aucun'], 'choix du jour présélectionnés');
assert(!r.d.querySelector('#repas-form .opt') && r.$('#repas-form .sel[data-kind="prot"][data-slot="dej"]').textContent === 'Viande blanche', 'formulaire : une bulle par choix');
assert.deepStrictEqual([...r.d.querySelectorAll('#repas-form h2')].map(h => h.textContent), ['Petit-déjeuner', 'Déjeuner', 'Dîner'], 'repas du formulaire');
// La bulle ouvre le panneau des choix, avec le détail des groupes ; toucher un choix le met dans le brouillon et ferme le panneau
r.click('#repas-form .sel[data-kind="prot"][data-slot="dej"]');
assert(!r.$('#sheet').hidden && r.$('#repas').hasAttribute('inert') && r.$('#sheet-t').textContent === 'Protéine du déjeuner', 'panneau ouvert depuis le formulaire');
assert.strictEqual(r.d.querySelectorAll('#sheet .opt').length, 8, 'toutes les protéines');
assert.strictEqual(r.$('#sheet [data-value="saumon"] .opt-s').textContent, 'saumon, maquereau, sardines à l’huile', 'détail du poisson gras');
r.click('#sheet .sheet-x');
assert(r.$('#sheet').hidden && !r.$('#repas').hasAttribute('inert') && rw.document.activeElement === r.$('#sel-rprot-dej'), 'panneau fermé, focus sur la bulle');
const rf = (kind, slot, v) => {
  r.click(`#repas-form .sel[data-kind="${kind}"]` + (slot ? `[data-slot="${slot}"]` : ''));
  r.click(`#sheet [data-value="${v}"]`);
  assert(r.$('#sheet').hidden, 'panneau du formulaire resté ouvert');
};
rf('pd', null, 'pain'); rf('prot', 'dej', 'boeuf'); rf('starch', 'dej', 'pates'); rf('dessert', 'dej', 'chocolat'); rf('dessert', 'diner', 'fruit');
assert.deepStrictEqual(rows(), ['pain', 'boeuf', 'pates', 'chocolat', 'poisson', 'lentilles', 'fruit'], 'sélection dans le formulaire');
assert.strictEqual(rw.localStorage.getItem(KEY), null, 'choix enregistrés avant de valider');
// « Voir ma journée » : enregistre et affiche le récap
r.click('[data-action="repas-ok"]');
assert(r.$('#repas').hidden && !r.$('#page').hidden && rw.document.activeElement === r.$('#title'), 'récap non affiché après validation');
assert.deepStrictEqual(['pd', 'prot', 'starch', 'dessert'].map(k => r.chosen(k, k === 'pd' ? null : 'dej')).concat([r.chosen('dessert', 'diner')]), ['pain', 'boeuf', 'pates', 'chocolat', 'fruit'], 'choix du formulaire dans le récap');
assert.deepStrictEqual(r.stored().choices[3], { pdBase: 'pain', dej: { prot: 'boeuf', starch: 'pates', dessert: 'chocolat' }, diner: { prot: 'poisson', starch: 'lentilles', dessert: 'fruit' } }, 'choix du formulaire enregistrés');
assert([...r.d.querySelectorAll('[aria-labelledby="h-dej"] li')].some(li => /chocolat noir/.test(li.textContent)), 'dessert absent du récap');
// La sélection reste possible depuis le récap
r.choose('starch', 'dej', 'riz');
assert.strictEqual(r.stored().choices[3].dej.starch, 'riz', 'choix depuis le récap');
// Rechargée le même jour : pas de formulaire
const snapOf = w => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
const rsnap = snapOf(rw);
const reload = tools(open(ls => Object.entries(rsnap).forEach(([k, v]) => ls.setItem(k, v)), false, true));
assert(reload.$('#repas').hidden && !reload.$('#page').hidden, 'formulaire rouvert le même jour');
// « Choisir mes repas » : rouvre le formulaire sur les choix du jour ; la flèche et le bouton retour ferment sans rien changer
r.click('#open-repas');
assert(!r.$('#repas').hidden && rows()[2] === 'riz', 'formulaire rouvert sur les choix du jour');
rf('prot', 'diner', 'thon');
r.click('#repas [data-action="fermer"]');
assert(!r.$('#page').hidden && r.chosen('prot', 'diner') === 'poisson' && r.stored().choices[3].diner.prot === 'poisson', 'formulaire fermé sans valider : choix changé');
assert.strictEqual(rw.document.activeElement, r.$('#open-repas'), 'focus rendu au bouton');
r.click('#open-repas');
rf('prot', 'diner', 'thon');
rw.dispatchEvent(new rw.PopStateEvent('popstate', { state: null }));
assert(!r.$('#page').hidden && r.$('#repas').hidden && r.chosen('prot', 'diner') === 'poisson', 'bouton retour : formulaire non fermé ou choix changé');
// « Décide pour moi » : tout au hasard (hasard simulé), jamais la même protéine midi et soir, enregistré, récap
const everything = () => [r.chosen('pd'), r.chosen('prot', 'dej'), r.chosen('starch', 'dej'), r.chosen('dessert', 'dej'), r.chosen('prot', 'diner'), r.chosen('starch', 'diner'), r.chosen('dessert', 'diner')];
r.click('#open-repas');
rw.Math.random = () => 0.999;
r.click('[data-action="repas-hasard"]');
assert(!r.$('#page').hidden && r.$('#repas').hidden, 'récap non affiché après le tirage');
assert.deepStrictEqual(everything(), ['sale', 'tofu', 'gnocchis', 'chocolat', 'thon', 'gnocchis', 'chocolat'], 'tirage (dernier choix de chaque liste, protéine du dîner différente)');
assert.deepStrictEqual(r.stored().choices[3].diner, { prot: 'thon', starch: 'gnocchis', dessert: 'chocolat', recette: 'thon-gnocchis' }, 'tirage non enregistré (recette choisie d’office)');
assert(r.$('[aria-labelledby="h-dej"] .rec.is-on') && r.$('[aria-labelledby="h-diner"] .rec.is-on'), 'tirage : recettes choisies sur la page');
assert(/tirés au hasard/.test(r.$('#hint').textContent), 'message du tirage : ' + r.$('#hint').textContent);
r.click('#open-repas');
rw.Math.random = () => 0;
r.click('[data-action="repas-hasard"]');
assert.deepStrictEqual(everything(), ['avoine', 'poulet', 'riz', 'aucun', 'boeuf', 'riz', 'aucun'], 'tirage (premier choix de chaque liste, protéine du dîner différente)');
// Jour de repas libre : le formulaire le rappelle au dîner
r.setSwitch('libre', true);
r.click('#open-repas');
assert(/Ce soir, c’est ton repas libre\s: ce dîner est gardé pour les prochains mercredis\./.test(r.$('[aria-labelledby="repas-h-diner"]').textContent), 'repas libre dans le formulaire');
r.click('[data-action="repas-ok"]');
// Menu (3.20.0) : « Journée » surligné sur la page et dans le formulaire, qu'il ferme sans rien changer
assert.deepStrictEqual([...r.d.querySelectorAll('#nav [aria-current="page"]')].map(b => b.id), ['nav-jour'], 'menu : journée surlignée');
r.click('#open-repas');
assert(r.$('#nav-jour').getAttribute('aria-current') === 'page' && !r.$('#nav').hidden, 'menu : journée surlignée dans le formulaire');
rf('prot', 'diner', 'thon');
r.click('#nav-jour');
assert(!r.$('#page').hidden && r.$('#repas').hidden && r.stored().choices[3].diner.prot === 'boeuf', 'menu : formulaire fermé sans rien changer');
assert.strictEqual(rw.document.activeElement, r.$('#open-repas'), 'menu : focus rendu au bouton du formulaire');
// Installer l'appli (Android) : bouton caché tant que le navigateur ne le propose pas ; il lance la proposition puis disparaît
assert(r.$('#install').hidden, 'bouton Installer affiché sans proposition du navigateur');
let prompted = 0;
const offer = () => { const ev = new rw.Event('beforeinstallprompt', { cancelable: true }); ev.prompt = () => { prompted++; }; rw.dispatchEvent(ev); return ev; };
const bip = offer();
assert(bip.defaultPrevented && !r.$('#install').hidden, 'bouton Installer non affiché');
r.click('#install');
assert(prompted === 1 && r.$('#install').hidden, 'installation non proposée');
offer();
rw.dispatchEvent(new rw.Event('appinstalled'));
assert(r.$('#install').hidden, 'bouton Installer resté affiché après l’installation');
// Sans stockage : le formulaire ne s'ouvre jamais tout seul
const nostore = tools(new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.org/', virtualConsole: vc,
  beforeParse: win => { withClock(win); Object.defineProperty(win, 'localStorage', { get(){ throw new Error('stockage bloqué'); } }); } }));
assert(nostore.$('#repas').hidden && !nostore.$('#page').hidden && nostore.$('#accueil').hidden, 'sans stockage : ' + ['accueil', 'page', 'repas'].filter(id => !nostore.$('#' + id).hidden));

// Recettes (3.12.0) : la suggestion suit la protéine et le féculent ; « Voir la recette » ouvre sa fiche, « Choisir » la prend,
// « Retirer » revient au repas de base ; changer de féculent l'oublie
choose('prot', 'diner', 'boeuf');
choose('starch', 'diner', 'pates');
const recBox = slot => $(`[aria-labelledby="h-${slot}"] .rec`);
const dinerNames = () => [...d.querySelectorAll('[aria-labelledby="h-diner"] .items li .name')].map(n => n.childNodes[0].textContent.trim());
const kcalOf = el => Number(el.textContent.replace(/\D/g, ''));
assert(/^Suggestion\s:\sPâtes à la bolognaise/.test(recBox('diner').textContent) && !recBox('diner').classList.contains('is-on'), 'suggestion du dîner : ' + recBox('diner').textContent);
assert(/35\smin, se garde/.test(recBox('diner').textContent) && $('#rec-c-diner').getAttribute('aria-label') === 'Choisir la recette du dîner', 'temps et bouton de la suggestion');
assert(dinerNames().includes('légumes') && dinerNames().includes('kcal pour la cuisine'), 'dîner sans recette : ' + dinerNames().join(', '));
const totalR0 = kcalOf($('#sum-text strong'));
click('#rec-v-diner');
assert(!$('#sheet').hidden && $('#sheet-t').textContent === 'Pâtes à la bolognaise' && $('#sheet-list').hidden && !$('#sheet-rec').hidden && $('#page').hasAttribute('inert'), 'fiche de la recette');
assert.strictEqual(d.activeElement, $('#sheet-rec [data-action="rec-on"]'), 'focus sur « Choisir cette recette »');
const fiche = $('#sheet-rec').textContent;
assert(d.querySelectorAll('#sheet-rec .rec-steps li').length === 3 && /bœuf haché/.test(fiche) && /pâtes/.test(fiche) && /oignon/.test(fiche) && /pulpe de tomate/.test(fiche) && /huile d’olive/.test(fiche) && /Ail, laurier, thym, basilic\./.test(fiche), 'fiche : quantités, aromates, étapes');
assert(!/kcal pour la cuisine|chocolat/.test(fiche) && /En tout\s:\s*[\d\s]+kcal/.test($('#sheet-rec .rec-tot').textContent), 'fiche : sans marge ni dessert, total du repas');
d.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert($('#sheet').hidden && d.activeElement === $('#rec-v-diner') && !recBox('diner').classList.contains('is-on') && !('recette' in stored().choices[3].diner), 'Échap : fiche fermée sans rien choisir');
// Choisir depuis la fiche : la recette passe en tête du repas, à la place de ses ingrédients (3.14.0 : ils sont dans sa fiche) ;
// ses calories et macros restent affichées, le total ne bouge pas
click('#rec-v-diner'); click('#sheet-rec [data-action="rec-on"]');
assert($('#sheet').hidden && recBox('diner').classList.contains('is-on') && recBox('diner').querySelector('h3').textContent === 'Pâtes à la bolognaise', 'recette choisie');
assert.strictEqual(d.activeElement, $('#rec-v-diner'), 'focus rendu au bouton de la fiche');
assert(stored().plans['2026-10-07'].ch.diner.recette === 'boeuf-pates' && stored().choices[3].diner.recette === 'boeuf-pates', 'recette enregistrée');
{
  const meal = $('[aria-labelledby="h-diner"]'), picks = meal.querySelector('.picks');
  assert(picks.nextElementSibling === recBox('diner') && !meal.querySelector('.items') && dinerNames().length === 0, 'recette en tête du repas, sans ingrédients : ' + dinerNames().join(', '));
  assert(/kcal\s*P\s\d+\sg\s*G\s\d+\sg\s*L\s\d+\sg/.test(recBox('diner').querySelector('.rec-k').textContent) && Math.abs(kcalOf(recBox('diner').querySelector('.rec-k .mac > span')) - kcalOf(meal.querySelector('.kcal'))) <= 5, 'macros de la recette = le repas');
  assert(/35\smin, se garde/.test(recBox('diner').textContent) && $('#rec-v-diner').classList.contains('is-main') && $('#rec-c-diner').textContent === 'Retirer', 'temps et boutons de la recette choisie');
}
assert(Math.abs(kcalOf($('#sum-text strong')) - totalR0) <= 20, 'la recette change le total : ' + totalR0 + ' → ' + kcalOf($('#sum-text strong')));
// Les ingrédients, avec leurs quantités et macros, dans la fiche
click('#rec-v-diner');
{
  const names = [...d.querySelectorAll('#sheet-rec .items li .name')].map(n => n.childNodes[0].textContent);
  assert(['bœuf haché 5\u00a0%', 'pâtes', 'oignon', 'carottes', 'pulpe de tomate', 'huile d’olive', 'parmesan'].every(n => names.includes(n)) && !names.includes('légumes') && !names.includes('kcal pour la cuisine'), 'ingrédients de la recette dans la fiche : ' + names.join(', '));
  assert(d.querySelectorAll('#sheet-rec .items li').length === d.querySelectorAll('#sheet-rec .items .mac').length, 'fiche : macros de chaque ingrédient');
}
click('#sheet .sheet-x');
// Le dessert n'est pas un ingrédient de la recette : il reste une ligne, sous la recette
choose('dessert', 'diner', 'chocolat');
assert.deepStrictEqual(dinerNames(), ['chocolat noir'], 'dessert sous la recette');
{
  const meal = $('[aria-labelledby="h-diner"]');
  const shown = [...meal.querySelectorAll('.mac > span:first-child')].reduce((a, e) => a + kcalOf(e), 0);
  assert(Math.abs(shown - kcalOf(meal.querySelector('.kcal'))) <= 10, 'recette et dessert : kcal du repas');
}
choose('dessert', 'diner', 'aucun');
// Retirer, puis choisir depuis la page : le focus reste sur le bouton
click('#rec-c-diner');
assert(!recBox('diner').classList.contains('is-on') && dinerNames().includes('légumes') && !('recette' in stored().choices[3].diner) && d.activeElement === $('#rec-c-diner') && $('#rec-c-diner').textContent === 'Choisir', 'recette retirée');
click('#rec-c-diner');
assert(recBox('diner').classList.contains('is-on') && d.activeElement === $('#rec-c-diner') && $('#rec-c-diner').textContent === 'Retirer', 'recette choisie depuis la page');
click('#rec-v-diner');
assert($('#sheet-rec [data-action="rec-off"]') && /Choisie pour ce dîner/.test($('#sheet-rec .rec-meta').textContent) && d.querySelectorAll('#sheet-rec .rec-steps li').length === 3, 'fiche d’une recette choisie : ingrédients et étapes');
click('#sheet .sheet-x');
// Changer de féculent : la recette est oubliée, celle du nouveau couple est proposée
choose('starch', 'diner', 'riz');
assert(/^Suggestion\s:\sChili de bœuf aux poivrons, riz/.test(recBox('diner').textContent) && !('recette' in stored().choices[3].diner) && dinerNames().includes('légumes'), 'féculent changé : recette oubliée');
choose('starch', 'diner', 'pates');
assert(!recBox('diner').classList.contains('is-on'), 'revenir au féculent ne reprend pas la recette');
// Repas libre : pas de recette au dîner
setSwitch('libre', true);
assert(!recBox('diner') && recBox('dej'), 'repas libre : pas de suggestion au dîner');
setSwitch('libre', false);
// Rechargée : la recette choisie est relue (et refusée si elle ne va pas avec les plats enregistrés)
const recSeed = (diner, extra) => ls => ls.setItem(KEY, JSON.stringify({ plans: { '2026-10-07': { ch: { pdBase: 'avoine', dej: { prot: 'poulet', starch: 'riz', recette: 'poulet-riz' }, diner } } }, choices: {} }));
const rl = tools(open(recSeed({ prot: 'saumon', starch: 'riz', recette: 'poulet-riz' })));
assert(rl.$('[aria-labelledby="h-dej"] .rec.is-on') && !rl.$('[aria-labelledby="h-diner"] .rec.is-on') && /Poke bowl/.test(rl.$('[aria-labelledby="h-diner"] .rec').textContent), 'recettes relues et validées');
const rl2 = tools(open(recSeed({ prot: 'saumon', starch: 'riz', recette: '__proto__' })));
assert(!rl2.$('[aria-labelledby="h-diner"] .rec.is-on'), 'recette abîmée refusée');
// Formulaire des repas : la recette suit le brouillon (gardée si le couple ne change pas, oubliée sinon)
rl.click('#open-repas'); rl.click('[data-action="repas-ok"]');
assert(rl.$('[aria-labelledby="h-dej"] .rec.is-on'), 'formulaire validé sans changement : recette gardée');
rl.click('#open-repas');
rl.click('#repas-form .sel[data-kind="starch"][data-slot="dej"]'); rl.click('#sheet [data-value="pates"]');
rl.click('#repas-form .sel[data-kind="starch"][data-slot="dej"]'); rl.click('#sheet [data-value="riz"]');
rl.click('[data-action="repas-ok"]');
assert(!rl.$('[aria-labelledby="h-dej"] .rec.is-on'), 'formulaire : féculent changé, recette oubliée');

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
assert.strictEqual($('#date').textContent, 'Aujourd’hui, jeudi 8 octobre', 'date non mise à jour');
assert.deepStrictEqual(sess(), [], 'plan de la veille affiché le lendemain');
// Nouveau jour : le formulaire des repas s'ouvre, avec les choix du jeudi
assert(!$('#repas').hidden && $('#page').hidden && dom.window.localStorage.getItem(RKEY) === '2026-10-08', 'formulaire des repas non ouvert le lendemain');
assert.strictEqual($('#repas-form .sel[data-kind="prot"][data-slot="dej"]').dataset.value, 'boeuf', 'choix du jeudi dans le formulaire');
click('#repas [data-action="fermer"]');
assert(!$('#page').hidden && $('#repas').hidden, 'formulaire non fermé');
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
assert.deepStrictEqual(s2.chips(), ['Moyenne, matin'], 'moment v1 perdu');
assert.strictEqual(s2.chosen('prot', 'dej'), 'thon', 'choix v1 perdus');
assert.strictEqual(s2.chosen('pd'), 'pain', 'petit-déjeuner v1 perdu');
assert.strictEqual(s2.chosen('dessert', 'dej'), 'aucun', 'choix sans dessert : Aucun');
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
p.click('#sum-note [data-action="needs"]');
assert(!p.$('#reglages').hidden && p.$('#page').hidden && pw.document.activeElement === p.$('#regl-h'), 'le lien Régler n’ouvre pas les réglages');

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

// Objectif de protéines en g/kg : curseur, grammes du jour, portions ajustées
const pouletQty = () => parseInt([...p.d.querySelectorAll('#day li')].find(li => /viande blanche maigre/.test(li.textContent)).querySelector('.qty').textContent, 10);
assert(/2,0\sg\/kg/.test(p.$('#out-prot').textContent) && /Environ 140\sg par jour \(2,0 × 70,0\skg\)/.test(p.$('#calc-prot').textContent), 'objectif de protéines par défaut : ' + p.$('#calc-prot').textContent);
const poulet20 = pouletQty();
type('prot', 2.2);
assert(prof().prot === 2.2 && /2,2\sg\/kg/.test(p.$('#out-prot').textContent) && /Environ 154\sg/.test(p.$('#calc-prot').textContent), 'objectif de protéines non enregistré');
assert(pouletQty() > poulet20 && /Aujourd’hui\s:\s\d+\sg/.test(p.$('#calc-prot').textContent), 'portions non ajustées à l’objectif de protéines');
type('prot', 2);

// Onglets des réglages (3.18.0) : Profil, Sport, Repas, Appli ; un seul panneau visible, l'onglet choisi marqué
const tabState = () => ['profil', 'sport', 'repas', 'appli'].map(t => (p.$('#tab-' + t).getAttribute('aria-selected') === 'true' ? '+' : '-') + (p.$('#pan-' + t).hidden ? 'h' : 'v') + p.$('#tab-' + t).tabIndex).join(' ');
assert.strictEqual(tabState(), '+v0 -h-1 -h-1 -h-1', 'onglet Profil au départ');
p.click('#tab-repas');
assert.strictEqual(tabState(), '-h-1 -h-1 +v0 -h-1', 'onglet Repas');
// Shaker : composition réglable, reprise dans la journée (onglet Repas)
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

// Calories des séances : placeholder d'après le poids, valeur saisie reprise (onglet Sport)
p.click('#tab-sport');
assert(shown('kcalMoyenne') && !shown('shakerKcal') && !shown('age'), 'onglet Sport');
assert.strictEqual(field('kcalMoyenne').placeholder, String(Math.round(6.3 * 70 / 10) * 10), 'calories par défaut d’une moyenne');
p.add('moyenne');
const needMoy = () => Number(note().match(/Dépense estimée\s:\s([\d\s]+)kcal/)[1].replace(/\D/g, ''));
const beforeMoy = needMoy();
type('kcalMoyenne', 700);
assert(prof().kcalMoyenne === 700 && needMoy() > beforeMoy, 'calories de la moyenne non prises en compte');
p.rm(0);

// Marge cuisine : curseur enregistré, lignes reprises (onglet Repas)
p.click('#tab-repas');
assert(!p.$('#in-marge').closest('[hidden]'), 'marge dans l’onglet Repas');
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

// Réglages dans un écran à part : roue dentée en haut de la page, retour par la flèche, le bouton du bas ou le bouton retour du téléphone
p.click('[data-action="fermer"]');
assert(p.$('#reglages').hidden && !p.$('#page').hidden && pw.document.activeElement === p.$('#gear'), 'réglages non fermés par la flèche');
assert(p.$('#gear').textContent.trim() === 'Réglages' && p.$('#gear svg'), 'roue dentée absente');
p.click('#gear');
assert(!p.$('#reglages').hidden && pw.history.state && pw.history.state.screen === 'reglages', 'la roue dentée n’ouvre pas les réglages');
pw.dispatchEvent(new pw.PopStateEvent('popstate', { state: null }));
assert(p.$('#reglages').hidden && !p.$('#page').hidden, 'le bouton retour ne ferme pas les réglages');
p.click('#gear');
p.click('#reglages .btn.wide');
assert(p.$('#reglages').hidden && !p.$('#page').hidden, 'réglages non fermés par « Voir ma journée »');

// Aide : « ? » en haut de la page ou lien des réglages ; retour d'un cran (flèche, bouton, historique)
const view = () => ['accueil', 'page', 'reglages', 'aide'].filter(id => !p.$('#' + id).hidden).join();
p.click('#help');
assert(view() === 'aide' && pw.document.activeElement === p.$('#aide-h') && pw.history.state.screen === 'aide', 'le « ? » n’ouvre pas l’aide');
assert(/Ta journée en trois temps/.test(p.$('#aide').textContent) && /cru/.test(p.$('#aide').textContent), 'explications absentes');
const refRows = [...p.d.querySelectorAll('#ref-tables tbody tr')];
assert(p.d.querySelectorAll('#ref-tables table').length === 6 && refRows.length === 57, 'table des aliments : ' + refRows.length + ' lignes');
const pouletRow = [...p.$('#ref-tables tr[data-key="poulet"]').querySelectorAll('td')].map(td => td.textContent);
assert.deepStrictEqual(pouletRow, ['110', '23', '0', '1,4'], 'valeurs du poulet');
assert.deepStrictEqual([...p.$('#ref-tables tr[data-key="riz"]').querySelectorAll('td')].map(td => td.textContent), ['352', '8,4', '77', '1'], 'valeurs du riz (cru)');
// Nouveaux aliments (3.7.0) et groupes de valeurs proches
const refCells = key => [...p.$(`#ref-tables tr[data-key="${key}"]`).querySelectorAll('th, td')].map(td => td.textContent.trim());
assert.deepStrictEqual(refCells('tofu'), ['Tofu ferme, nature', '148', '14,4', '1,1', '9,3'], 'tofu dans la table');
// Légumes et matières grasses des recettes (3.12.0)
assert.deepStrictEqual(refCells('oignon'), ['Oignon (ou échalote)', '39', '1,1', '6,3', '0,6'], 'oignon dans la table');
assert.deepStrictEqual(refCells('coco'), ['Lait de coco', '190', '2', '6,3', '17,6'], 'lait de coco dans la table');
assert.deepStrictEqual(refCells('fruitsSecs'), ['Fruits secs (abricots, pruneaux, figues)', '245', '2,7', '56', '0,7'], 'fruits secs dans la table');
assert(/Pois chiches/.test(refCells('poischiches')[0]) && refCells('poischiches')[1] === '351', 'pois chiches dans la table');
assert(/Poisson gras \(saumon, maquereau, sardines/.test(refCells('saumon')[0]) && /Viande blanche maigre \(poulet, dinde, filet mignon de porc\)/.test(refCells('poulet')[0]), 'groupes dans la table');
p.click('#aide [data-action="fermer"]');
assert(view() === 'page' && pw.document.activeElement === p.$('#help'), 'retour de l’aide vers la page');
p.click('#gear'); p.click('#help-regl');
assert(view() === 'aide', 'l’aide ne s’ouvre pas depuis les réglages');
p.click('#aide .btn.wide');
assert(view() === 'reglages', 'retour de l’aide vers les réglages');
p.click('#help-regl');
pw.dispatchEvent(new pw.PopStateEvent('popstate', { state: { screen: 'reglages' } }));
assert(view() === 'reglages', 'bouton retour depuis l’aide');
pw.dispatchEvent(new pw.PopStateEvent('popstate', { state: null }));
assert(view() === 'page', 'bouton retour depuis les réglages');
// Menu (3.20.0) : l'écran affiché surligné ; un écran du menu remplace celui du dessus (le retour ramène à la journée),
// déjà ouvert plus bas, on y redescend ; « Journée » ferme tout
{
  const cur = () => [...p.d.querySelectorAll('#nav [aria-current="page"]')].map(b => b.id).join();
  assert(cur() === 'nav-jour' && !p.$('#nav').hidden, 'menu : journée');
  p.click('#gear');
  assert(cur() === 'gear' && view() === 'reglages', 'menu : réglages');
  const hl = pw.history.length;
  p.click('#plan-btn');
  assert.strictEqual(pw.history.length, hl, 'menu : pas de nouvelle entrée d’historique');
  assert(cur() === 'plan-btn' && !p.$('#plan').hidden && view() === '' && pw.history.state.screen === 'plan', 'menu : Planifier à la place des réglages');
  pw.dispatchEvent(new pw.PopStateEvent('popstate', { state: null }));
  assert(view() === 'page' && p.$('#plan').hidden && cur() === 'nav-jour', 'menu : le retour ramène à la journée');
  assert.deepStrictEqual([...p.d.querySelectorAll('#nav button')].map(b => b.textContent.trim()), ['Journée', 'Planifier', 'Aide', 'Réglages'], 'menu : quatre boutons (3.21.0)');
  p.click('#gear'); p.click('#help-regl');
  assert(view() === 'aide' && cur() === 'help', 'menu : aide depuis les réglages');
  p.click('#gear');
  assert(view() === 'reglages' && cur() === 'gear', 'menu : réglages, sous l’aide');
  p.click('#reglages .btn.wide');
  assert(view() === 'page', 'menu : réglages retrouvés sous l’aide, un seul écran à fermer');
  p.click('#gear');
  p.click('#plan-btn');
  assert(!p.$('#plan').hidden && cur() === 'plan-btn' && pw.document.activeElement === p.$('#plan-h'), 'menu : planifier');
  p.click('#nav-jour');
  assert(view() === 'page' && p.$('#plan').hidden && cur() === 'nav-jour' && pw.document.activeElement === p.$('#gear'), 'menu : journée, focus rendu');
  p.click('#nav-jour');
  assert(view() === 'page' && pw.document.activeElement === p.$('#title'), 'menu : journée depuis la journée');
  p.click('#gear'); p.click('#help-regl'); p.click('#nav-jour');
  assert(view() === 'page', 'menu : « Journée » ferme l’aide et les réglages dessous');
}

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
// Séance à midi : le dessert choisi remplace la compote automatique du déjeuner
const mid = tools(open());
mid.add('petite'); mid.at(0, 'midi');
const dejLines = () => [...mid.d.querySelectorAll('[aria-labelledby="h-dej"] .items li')].map(li => li.textContent);
assert.strictEqual(dejLines().filter(t => /compote/.test(t)).length, 1, 'compote de midi absente');
mid.choose('dessert', 'dej', 'fruit');
assert(!dejLines().some(t => /compote/.test(t)) && dejLines().some(t => /pomme, poire/.test(t)), 'deux desserts au déjeuner : ' + dejLines().join(' | '));

// Petite corpulence : portions réduites ; objectif de protéines élevé : conseil si les minimums dépassent l'objectif
const light = legacy({ mode: 'auto', sexe: 'f', age: 28, taille: 160, poids: 52, deficit: 25, prot: 2.2 });
const skyrPd = [...light.d.querySelectorAll('[aria-labelledby="h-pd"] .items li')].find(li => /skyr/.test(li.textContent));
assert(parseInt(skyrPd.querySelector('.qty').textContent, 10) < 250, '52 kg : skyr du petit-déjeuner ' + skyrPd.querySelector('.qty').textContent);
assert(/dépassent l’objectif/.test(light.$('#sum-note').textContent) && /baisse la marge cuisine, passe-toi du shaker ou baisse ton objectif de protéines/.test(light.$('#sum-note').textContent), '52 kg : ' + light.$('#sum-note').textContent);
// Objectif de protéines de 1,6 à 2,2 g/kg (3.11.1) : un objectif enregistré à 3,0 avant est relu comme 2,2 ;
// même thon midi et soir sans shaker, les protéines restent alors dans la fourchette (le skyr du soir complète au besoin)
const thon2 = tools(open(ls => {
  ls.setItem(PKEY, JSON.stringify({ mode: 'auto', age: 35, taille: 178, poids: 71, prot: 3, shaker: 'non' }));
  ls.setItem(KEY, JSON.stringify({ plans: {}, choices: { 3: { pdBase: 'avoine', dej: { prot: 'thon', starch: 'riz' }, diner: { prot: 'thon', starch: 'pates' } } } }));
}));
assert(thon2.$('#in-prot').max === '2.2' && thon2.$('#in-prot').min === '1.6' && thon2.$('#out-prot').textContent === '2,2\u00a0g/kg', 'curseur des protéines : ' + thon2.$('#out-prot').textContent);
assert(/de 141 à 172\sg/.test(thon2.$('#calc-prot').textContent) && /Repère en sèche\s: 1,6 à 2,2\sg\/kg, 2,0 par défaut\./.test(thon2.$('#calc-prot').textContent), 'objectif relu à 2,2 : ' + thon2.$('#calc-prot').textContent);
assert(!/restent sous ton objectif/.test(thon2.$('#sum-note').textContent), 'protéines sous la fourchette à 2,2 g/kg : ' + thon2.$('#sum-note').textContent);
thon2.choose('pd', null, 'sale');
assert(!/restent sous ton objectif/.test(thon2.$('#sum-note').textContent), 'salé, protéines sous la fourchette à 2,2 g/kg : ' + thon2.$('#sum-note').textContent);
assert(!/restent sous ton objectif/.test(p.$('#sum-note').textContent), 'alerte protéines sans raison');
// Au-delà de 101 kg (ou sous 47 kg), le calcul des protéines s'arrête à la borne des portions, et la page l'explique
for (const [poids, re] of [[130, /2,0 × 100,8\skg\)[^]*Au-delà de 100,8\skg, ton objectif et tes portions ne suivent plus ton poids\./], [40, /2,0 × 46,8\skg\)[^]*Sous 46,8\skg, ton objectif et tes portions ne suivent plus ton poids\./]]) {
  const x = legacy({ mode: 'auto', age: 35, taille: 178, poids });
  assert(re.test(x.$('#calc-prot').textContent), poids + ' kg : ' + x.$('#calc-prot').textContent);
}
assert(!/ne suivent plus/.test(p.$('#calc-prot').textContent), 'explication de la borne sans raison');
// Le jour du repas libre, les protéines du jour sont comptées hors repas libre
const lib = legacy({ mode: 'auto', age: 35, taille: 178, poids: 71 });
lib.setSwitch('libre', true);
assert(/Aujourd’hui\s:\s\d+\sg hors repas libre\./.test(lib.$('#calc-prot').textContent), 'protéines du jour libre : ' + lib.$('#calc-prot').textContent);
// Le 1er du mois : « 1er octobre »
now = new Date(2026, 9, 1, 9, 0, 0).getTime();
assert.strictEqual(tools(open()).$('#date').textContent, 'Aujourd’hui, jeudi 1er octobre', 'premier du mois');
now = new Date(2026, 9, 7, 9, 0, 0).getTime();
for (const bad of ['{pas du json', '7', 'null']) {
  const b = tools(open(ls => ls.setItem(PKEY, bad)));
  assert(/kcal/.test(b.$('#sum-text').textContent), 'page bloquée par le profil : ' + bad);
}

// Calendrier : semaine du jour affiché, aujourd'hui marqué, titres relatifs, un point sous les jours planifiés
const cdom = open(), c = tools(cdom), cw = cdom.window;
const weekBtns = () => [...c.d.querySelectorAll('#week button')];
const dayBtn = iso => c.$(`#week [data-value="${iso}"]`);
assert.strictEqual(c.$('#cal-t').textContent, 'Du 5 au 11 oct.', 'semaine affichée');
assert.deepStrictEqual(weekBtns().map(b => b.dataset.value), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'], 'jours de la semaine');
assert(dayBtn('2026-10-07').classList.contains('is-today') && dayBtn('2026-10-07').getAttribute('aria-pressed') === 'true' && c.$('#today-btn').hidden, 'aujourd’hui choisi');
assert.strictEqual(dayBtn('2026-10-07').getAttribute('aria-label'), 'Mercredi 7 octobre, aujourd’hui', 'nom du jour');
c.click('#week [data-value="2026-10-08"]');
assert.deepStrictEqual([c.$('#date').textContent, c.$('#title').textContent], ['Demain, jeudi 8 octobre', 'Qu’est-ce que tu prévois demain ?'], 'demain');
c.click('#week [data-value="2026-10-06"]');
assert.deepStrictEqual([c.$('#date').textContent, c.$('#title').textContent], ['Hier, mardi 6 octobre', 'Qu’est-ce que tu as fait hier ?'], 'hier');
c.click('#week [data-value="2026-10-09"]');
assert.deepStrictEqual([c.$('#date').textContent, c.$('#title').textContent, c.$('#sw-lib').textContent], ['Vendredi 9 octobre', 'Qu’est-ce que tu prévois vendredi 9 octobre ?', 'Repas libre le soir'], 'autre jour');
assert(!c.$('#today-btn').hidden, 'bouton « Revenir à aujourd’hui »');
// Séances et plats du jour affiché, enregistrés pour sa date (plats aussi en mémoire pour ce jour de la semaine)
c.add('moyenne');
c.choose('prot', 'dej', 'saumon');
let cs = c.stored();
assert.deepStrictEqual(cs.plans['2026-10-09'].seances, [{ taille: 'moyenne', moment: 'soir' }], 'séance enregistrée pour sa date');
assert(cs.plans['2026-10-09'].ch.dej.prot === 'saumon' && cs.choices[5].dej.prot === 'saumon', 'plats enregistrés pour la date et le jour de la semaine');
assert(dayBtn('2026-10-09').classList.contains('is-planned') && !dayBtn('2026-10-08').classList.contains('is-planned'), 'point sous le jour planifié');
// Semaine suivante : même jour de la semaine ; un vendredi pas encore choisi reprend les plats du dernier vendredi
c.click('#wk-next');
assert(c.$('#cal-t').textContent === 'Du 12 au 18 oct.' && c.$('#week [aria-pressed="true"]').dataset.value === '2026-10-16', 'semaine suivante');
assert(c.chosen('prot', 'dej') === 'saumon' && c.sess().length === 0, 'vendredi suivant : plats repris, pas de séance');
c.choose('prot', 'dej', 'thon');
c.click('#wk-prev');
assert(c.$('#week [aria-pressed="true"]').dataset.value === '2026-10-07', 'retour sur la semaine en cours : aujourd’hui');
c.click('#week [data-value="2026-10-09"]');
assert(c.chosen('prot', 'dej') === 'saumon' && c.sess().length === 1, 'chaque date garde ses plats');
c.click('#today-btn');
assert(c.$('#date').textContent === 'Aujourd’hui, mercredi 7 octobre' && c.sess().length === 0 && c.chosen('prot', 'dej') === 'poulet', 'aujourd’hui inchangé');
// Jusqu'à 21 jours en arrière (les jours plus anciens sont effacés)
c.click('#wk-prev'); c.click('#wk-prev');
assert(!c.$('#wk-prev').disabled, 'semaine précédente possible');
c.click('#wk-prev');
assert(c.$('#wk-prev').disabled && dayBtn('2026-09-15').disabled && !dayBtn('2026-09-16').disabled, 'pas plus de 21 jours en arrière');
c.click('#today-btn');
// Un repas libre par semaine, dans la semaine du jour affiché
c.click('#wk-next');
c.click('#week [data-value="2026-10-15"]');
c.setSwitch('libre', true);
cs = c.stored();
assert(cs.plans['2026-10-17'] && cs.plans['2026-10-17'].libre === false && /samedi est retiré/.test(c.$('#hint').textContent), 'repas libre du samedi de la même semaine retiré');
assert(!cs.plans['2026-10-10'], 'samedi d’une autre semaine touché');
// Revenir au plan de base : la date est effacée
c.click('[data-action="reset"]');
assert(!c.stored().plans['2026-10-15'], 'jour non effacé');
c.click('#today-btn');
// Jours passés depuis plus de 21 jours effacés, jours à venir gardés
const old = tools(open(ls => ls.setItem(KEY, JSON.stringify({ plans: { '2026-09-01': { seances: [], libre: false }, '2026-09-20': { seances: [], libre: true }, '2026-12-25': { seances: [{ taille: 'petite', moment: 'midi' }], libre: false, ch: { pdBase: 'pain', dej: { prot: 'boeuf', starch: 'pdt' } } }, 'n’importe quoi': {} }, choices: {} }))));
old.click('#week [data-value="2026-10-07"]');
assert.deepStrictEqual(Object.keys(old.stored().plans).sort(), ['2026-09-20', '2026-12-25'], 'purge des jours');

// Planifier (3.21.0) : la liste des planifications, puis « Nouvelle planification » (période, plats simples ou recettes, option
// batch cooking) ; créer tire les plats de la période et ouvre son détail : jour par jour, batch cooking, courses
const QKEY = 'repas-du-jour:planifs:v1';
const planifsOf = w => JSON.parse(w.localStorage.getItem(QKEY) || 'null');
c.click('#plan-btn');
assert(!c.$('#plan').hidden && c.$('#page').hidden && cw.document.activeElement === c.$('#plan-h') && c.$('#plan-btn').getAttribute('aria-current') === 'page', 'Planifier ouvert');
assert(/Aucune planification pour l’instant/.test(c.$('#plan-body').textContent) && !c.$('#plan-body .is-cur') && !c.$('#pl-list-t'), 'aucune planification au départ');
const planSpan = () => c.$('#plan-span').textContent, planErr = () => c.$('#plan-err').textContent;
assert(/^7\sjours, du mercredi 7\soctobre au mardi 13\soctobre\.$/.test(planSpan()), 'les 7 prochains jours par défaut : ' + planSpan());
assert.strictEqual(c.$('[data-action="pl-preset"][aria-pressed="true"]').dataset.value, '7', 'raccourci choisi');
c.click('[data-action="pl-preset"][data-value="suivante"]');
assert(/^7\sjours, du lundi 12\soctobre au dimanche 18\soctobre\.$/.test(planSpan()) && cw.document.activeElement === c.$('[data-action="pl-preset"][data-value="suivante"]'), 'la semaine prochaine, focus gardé');
const setEnd = (which, end, v) => { const el = c.$(`input[data-range="${which}"][data-end="${end}"]`); el.value = v; el.dispatchEvent(new cw.Event('input', { bubbles: true })); };
setEnd('plan', 'to', '2026-11-30');
assert(/31\sjours au plus/.test(planErr()) && !planSpan(), 'période trop longue : ' + planErr());
c.click('[data-action="pl-create"]');
assert(c.$('#courses').hidden && planifsOf(cw) === null, 'planification créée malgré l’erreur');
setEnd('plan', 'to', '2026-10-10');
assert(/La fin doit venir après le début/.test(planErr()), 'fin avant le début : ' + planErr());
setEnd('plan', 'from', '2026-10-01');
assert(/Commence aujourd’hui ou plus tard/.test(planErr()), 'début passé : ' + planErr());
setEnd('plan', 'from', '2026-10-08');
assert(/^3\sjours, du jeudi 8\soctobre au samedi 10\soctobre\.$/.test(planSpan()), 'dates choisies : ' + planSpan());
assert(/^1\sjour a déjà ses plats\s: ils seront remplacés\. Tes séances restent\.$/.test(c.$('#plan-over').textContent), 'jours déjà prévus : ' + c.$('#plan-over').textContent);
// Plats : recettes par défaut, sans batch cooking ; plats simples sans l'option ; l'option et son nombre de recettes
const plPressed = a => c.$(`[data-action="${a}"][aria-pressed="true"]`).dataset.value;
assert(plPressed('pl-type') === 'recettes' && c.$('#pl-batch').getAttribute('aria-checked') === 'false' && !c.$('[data-action="pl-nrec"]'), 'recettes par défaut, sans batch cooking');
c.click('[data-action="pl-type"][data-value="simple"]');
assert(plPressed('pl-type') === 'simple' && !c.$('#pl-batch') && cw.document.activeElement === c.$('[data-action="pl-type"][data-value="simple"]') && /sans recette/.test(c.$('#plan-body').textContent), 'plats simples : pas d’option batch cooking');
c.click('[data-action="pl-type"][data-value="recettes"]');
c.click('#pl-batch');
assert(c.$('#pl-batch').getAttribute('aria-checked') === 'true' && cw.document.activeElement === c.$('#pl-batch') && plPressed('pl-nrec') === '4', 'batch cooking : 4 recettes par défaut');
c.click('[data-action="pl-nrec"][data-value="3"]');
assert(plPressed('pl-nrec') === '3' && cw.document.activeElement === c.$('[data-action="pl-nrec"][data-value="3"]'), 'nombre de recettes, focus gardé');
// Plats simples, l'option batch cooking restée allumée : elle ne compte pas
c.click('[data-action="pl-type"][data-value="simple"]');
// Créer (plats simples) : plats tirés et enregistrés pour chaque date (sans recette), séances gardées, détail ouvert
c.click('[data-action="pl-create"]');
assert(!c.$('#courses').hidden && c.$('#plan').hidden && cw.document.activeElement === c.$('#courses-h') && c.$('#plan-btn').getAttribute('aria-current') === 'page', 'détail après la création');
assert.deepStrictEqual([c.$('#courses-h').textContent, c.$('#courses-span').textContent], ['Du 8 au 10 octobre', '3 jours, plats simples, à venir.'], 'titre du détail');
assert.deepStrictEqual(planifsOf(cw), { list: [{ from: '2026-10-08', to: '2026-10-10', type: 'simple', n: 0, checked: [] }] }, 'planification enregistrée');
cs = c.stored();
assert(['2026-10-08', '2026-10-09', '2026-10-10'].every(iso => cs.plans[iso].ch && !cs.plans[iso].ch.dej.recette && !cs.plans[iso].ch.diner.recette), 'plats simples : sans recette');
assert(cs.plans['2026-10-09'].seances.length === 1 && cs.plans['2026-10-07'] === undefined && c.$('#date').textContent.startsWith('Aujourd’hui'), 'séances gardées, aujourd’hui pas touché');
// Courses : rayons, lignes à cocher ; jour par jour
const aisles = [...c.d.querySelectorAll('#courses-list h3')].map(h => h.textContent);
assert.deepStrictEqual(aisles, ['Viandes et poissons', 'Crèmerie, œufs et tofu', 'Pain et féculents, poids crus', 'Fruits et légumes', 'Épicerie', 'Le reste'], 'rayons : ' + aisles);
const shopLine = name => [...c.d.querySelectorAll('#courses-list .chk')].find(b => b.querySelector('.name').childNodes[0].textContent === name);
assert(shopLine('repas libre') && shopLine('doses de shaker').querySelector('.q').textContent === '3', 'repas libre et shaker comptés');
// La liste est la somme des jours : le skyr des trois jours, relu sur chaque page du jour
// Skyr de la page, et celui des recettes choisies (dans leur fiche, 3.14.0)
const skyrIn = (t, sel) => [...t.d.querySelectorAll(sel)].filter(li => /skyr nature/.test(li.textContent)).reduce((a, li) => a + parseInt(li.querySelector('.qty').textContent, 10), 0);
const skyrOf = t => skyrIn(t, '#day li') + [...t.d.querySelectorAll('#day .rec.is-on [data-action="rec-view"]')].reduce((a, b) => {
  b.click(); const x = skyrIn(t, '#sheet-rec .items li'); t.click('#sheet .sheet-x'); return a + x;
}, 0);
let skyrSum = 0;
for (const iso of ['2026-10-08', '2026-10-09', '2026-10-10']) {
  const t = tools(open(ls => { ls.setItem(KEY, JSON.stringify(cs)); }));
  t.click(`#week [data-value="${iso}"]`);
  skyrSum += skyrOf(t);
}
assert.strictEqual(parseInt(shopLine('skyr nature').querySelector('.q').textContent.replace(/\D/g, ''), 10) * (/kg/.test(shopLine('skyr nature').querySelector('.q').textContent) ? 10 : 1), skyrSum, 'skyr des courses ≠ somme des jours');
const days = [...c.d.querySelectorAll('#courses-days .shop-day')];
assert(days.length === 3 && /^Jeudi 8\soctobre/.test(days[0].textContent) && /Repos, midi\s: /.test(days[0].textContent) && /1\sséance/.test(days[1].textContent) && /repas libre le soir/.test(days[2].textContent), 'jour par jour : ' + days.map(x => x.textContent).join(' | '));
// Partager la liste (3.22.0) : sans partage ni presse-papiers, dans un champ à copier ; tout, puis ce qui n'est pas coché
const line = shopLine('skyr nature'), key = line.dataset.value;
c.click('#co-share');
const shared = () => c.$('#co-text').value;
assert(!c.$('#co-text').hidden && /^Courses, du 8 au 10\soctobre\n\nViandes et poissons\n- /.test(shared()) && shared().includes('- ' + line.querySelector('.q').textContent + ' skyr nature') && c.$('#courses-msg').textContent === 'Copie la liste ci-dessous.', 'liste partagée : ' + shared().slice(0, 80));
// Cocher : gardé dans la planification, au rechargement ; tout décocher
c.click(`#courses-list [data-value="${key}"]`);
assert(line.getAttribute('aria-checked') === 'true' && planifsOf(cw).list[0].checked.includes(key), 'ligne cochée');
c.click('#co-share');
assert(!shared().includes('skyr nature') && /doses de shaker/.test(shared()), 'liste partagée sans les lignes cochées');
const cs2 = snapOf(cw), again2 = tools(open(ls => Object.entries(cs2).forEach(([k, v]) => ls.setItem(k, v))));
again2.click('#plan-btn');
assert(/^Du 8 au 10\soctobreÀ venir3\sjours, plats simples\.$/.test(again2.$('#plan-body .shop-day').textContent) && !again2.$('#plan-body .is-cur'), 'planification à venir dans la liste : ' + again2.$('#plan-body .shop-day').textContent);
again2.click('[data-action="pl-open"][data-value="2026-10-08|2026-10-10"]');
assert(again2.$(`#courses-list [data-value="${key}"]`).getAttribute('aria-checked') === 'true', 'coche gardée');
c.click('[data-action="co-uncheck"]');
assert(c.$(`#courses-list [data-value="${key}"]`).getAttribute('aria-checked') === 'false' && planifsOf(cw).list[0].checked.length === 0, 'tout décocher');
// Retour à Planifier : la liste ; une nouvelle planification qui en chevauche une la raccourcit (une recette par repas)
c.click('#courses [data-action="fermer"]');
assert(!c.$('#plan').hidden && c.$('[data-action="pl-open"][data-value="2026-10-08|2026-10-10"]'), 'retour à la liste');
setEnd('plan', 'from', '2026-10-10'); setEnd('plan', 'to', '2026-10-11');
c.click('[data-action="pl-type"][data-value="recettes"]');
assert(c.$('#pl-batch').getAttribute('aria-checked') === 'true', 'option batch cooking gardée');
c.click('#pl-batch');
c.click('[data-action="pl-create"]');
assert.deepStrictEqual(planifsOf(cw).list.map(p => [p.from, p.to, p.type, p.n]), [['2026-10-08', '2026-10-09', 'simple', 0], ['2026-10-10', '2026-10-11', 'recettes', 0]], 'chevauchement : la plus ancienne raccourcie');
cs = c.stored();
assert(cs.plans['2026-10-10'].ch.dej.recette && cs.plans['2026-10-11'].ch.dej.recette && cs.plans['2026-10-11'].ch.diner.recette && /une recette par repas/.test(c.$('#courses-span').textContent), 'une recette par repas');
c.click('#plan-btn');
assert.deepStrictEqual([...c.d.querySelectorAll('#plan-body [data-action="pl-open"]')].map(b => b.dataset.value), ['2026-10-08|2026-10-09', '2026-10-10|2026-10-11'], 'deux planifications à venir');
// Un jour du récap ouvre ce jour sur la page ; dans le calendrier, un trait sous les jours de chaque planification (3.22.0)
c.click('[data-action="pl-open"][data-value="2026-10-08|2026-10-09"]');
c.click('#courses-days [data-value="2026-10-09"]');
assert.deepStrictEqual([...c.d.querySelectorAll('#week .wk-pl')].map(x => x.className.replace('wk-pl', '').trim()), ['', '', '', 'on s', 'on e', 'on s', 'on e'], 'calendrier : planifications');
assert(/, dans une planification$/.test(c.$('#week [data-value="2026-10-09"]').getAttribute('aria-label')) && !/planification/.test(c.$('#week [data-value="2026-10-07"]').getAttribute('aria-label')), 'calendrier : nom des jours planifiés');
assert(!c.$('#page').hidden && c.$('#courses').hidden && c.$('#plan').hidden && /^Vendredi 9\soctobre$/.test(c.$('#date').textContent), 'jour ouvert depuis le récap');
// Le formulaire des repas vaut pour le jour affiché
c.click('#open-repas');
assert.strictEqual(c.$('#repas-h').textContent, 'Tes repas, vendredi 9 octobre', 'formulaire d’un autre jour');
c.click('#repas-form .sel[data-kind="prot"][data-slot="diner"]');
c.click('#sheet [data-value="saumon"]');
c.click('[data-action="repas-ok"]');
assert(c.stored().plans['2026-10-09'].ch.diner.prot === 'saumon' && c.stored().plans['2026-10-07'] === undefined, 'formulaire enregistré pour ce jour');

// Réglages, « Tes aliments » : tout est proposé au départ ; un aliment touché n'est plus proposé (ni dans les choix, ni au hasard)
const adom = open(), al = tools(adom), aw = adom.window;
const aprof = () => JSON.parse(aw.localStorage.getItem(PKEY));
const alim = (kind, v) => al.$(`#alim-list [data-kind="${kind}"][data-value="${v}"]`);
const sheetVals = sel => { al.click(sel); const v = [...al.d.querySelectorAll('#sheet .opt')].map(o => o.dataset.value); al.click('#sheet .sheet-x'); return v; };
al.click('#gear');
assert.deepStrictEqual([...al.d.querySelectorAll('#alim-list .rf-l')].map(x => x.textContent), ['Base du petit-déjeuner', 'Protéines', 'Féculents', 'Desserts'], 'types d’aliments');
assert(al.d.querySelectorAll('#alim-list .opt').length === 25 && !al.$('#alim-list .opt[aria-pressed="false"]'), 'tout est proposé au départ');
assert.strictEqual(alim('prot', 'saumon').querySelector('.opt-s').textContent, 'saumon, maquereau, sardines à l’huile', 'détail du groupe');
assert(!al.$('#alim-list [data-value="aucun"]'), '« Aucun » ne se retire pas');
// Aujourd'hui (mercredi) a un plat choisi : il le garde ; les autres jours, le poulet est remplacé par le suivant proposé
al.click('#reglages > [data-action="fermer"]');
al.choose('starch', 'dej', 'pates');
al.click('#gear');
al.click('#alim-list [data-kind="prot"][data-value="poulet"]');
assert(alim('prot', 'poulet').getAttribute('aria-pressed') === 'false' && aw.document.activeElement === alim('prot', 'poulet'), 'poulet retiré, focus gardé');
assert.deepStrictEqual(aprof().off, ['prot:poulet'], 'retrait enregistré');
al.click('#reglages > [data-action="fermer"]');
assert.strictEqual(al.chosen('prot', 'dej'), 'poulet', 'plat déjà choisi aujourd’hui perdu');
assert.deepStrictEqual(sheetVals('#sel-prot-dej'), ['poulet', 'boeuf', 'poisson', 'saumon', 'crevettes', 'oeufs', 'thon', 'tofu'], 'le plat choisi reste dans les choix');
assert(!sheetVals('#sel-prot-diner').includes('poulet'), 'poulet encore proposé au dîner');
al.click('#week [data-value="2026-10-06"]');
assert(al.chosen('prot', 'dej') === 'poisson' && al.chosen('prot', 'diner') === 'boeuf', 'mardi sans poulet : ' + al.chosen('prot', 'dej') + ' / ' + al.chosen('prot', 'diner'));
al.click('#wk-next'); al.click('#week [data-value="2026-10-14"]');
assert(al.chosen('prot', 'dej') === 'boeuf' && !al.stored().plans['2026-10-14'], 'mémoire du mercredi : poulet remplacé');
// Formulaire et assistant : mêmes choix ; « Décide pour moi » ne tire jamais un aliment retiré
al.click('#open-repas');
assert(!sheetVals('#sel-rprot-dej').includes('poulet') && al.$('#sel-rprot-dej').dataset.value === 'boeuf', 'formulaire : poulet proposé');
al.click('#repas [data-action="fermer"]');
al.click('#today-btn');
al.click('#gear');
al.click('#alim-list [data-kind="pd"][data-value="avoine"]');
al.click('#alim-list [data-kind="pd"][data-value="sale"]');
al.click('#alim-list [data-kind="pd"][data-value="pain"]');
assert(/Garde au moins une base pour le petit-déjeuner\./.test(al.$('#alim-warn').textContent) && alim('pd', 'pain').getAttribute('aria-pressed') === 'true', 'dernière base retirée');
assert.deepStrictEqual(aprof().off, ['prot:poulet', 'pd:avoine', 'pd:sale'], 'retraits enregistrés');
['fruit', 'compote', 'fruitsSecs', 'chocolat'].forEach(v => al.click(`#alim-list [data-kind="dessert"][data-value="${v}"]`));
assert(!al.$('#alim-warn').textContent && al.d.querySelectorAll('#alim-list [data-kind="dessert"][aria-pressed="false"]').length === 4, 'tous les desserts peuvent être retirés');
al.click('#reglages > [data-action="fermer"]');
assert.deepStrictEqual(sheetVals('#sel-dessert-dej'), ['aucun'], 'desserts proposés');
aw.Math.random = () => 0.999;
al.click('#open-repas');
al.click('[data-action="repas-hasard"]');
const drawn = al.stored().choices[3];
assert(drawn.pdBase === 'pain' && drawn.dej.prot === 'tofu' && drawn.diner.prot === 'thon' && drawn.dej.dessert === 'aucun', 'tirage avec retraits : ' + JSON.stringify(drawn));
aw.Math.random = () => 0;
al.click('#open-repas');
al.click('[data-action="repas-hasard"]');
// Le reste de la semaine a déjà 400 à 500 g de viande rouge : un bœuf de plus dépasserait, il est écarté du tirage
assert(/Viande rouge, cuite≈\s(4[0-9]0|500)\sg/.test(al.$('#wb-list').textContent) && al.stored().choices[3].dej.prot === 'poisson' && al.stored().choices[3].diner.prot === 'saumon', 'tirage sans poulet ni bœuf : ' + JSON.stringify(al.stored().choices[3]) + ' ' + al.$('#wb-list').textContent);
// Une planification (plats simples, les 7 prochains jours) ne tire jamais un aliment retiré
al.click('#plan-btn'); al.click('[data-action="pl-type"][data-value="simple"]'); al.click('[data-action="pl-create"]');
{
  const st = al.stored().plans, isos = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'];
  assert(isos.every(iso => st[iso].ch.pdBase === 'pain' && st[iso].ch.dej.prot !== 'poulet' && st[iso].ch.diner.prot !== 'poulet' && st[iso].ch.dej.dessert === 'aucun'), 'planification : aliment retiré tiré');
}
al.click('#nav-jour');
// Remis : de nouveau proposé ; relu au rechargement ; profil abîmé : tout est proposé
al.click('#gear');
al.click('#alim-list [data-kind="prot"][data-value="poulet"]');
assert.deepStrictEqual(aprof().off, ['pd:avoine', 'pd:sale', 'dessert:fruit', 'dessert:compote', 'dessert:fruitsSecs', 'dessert:chocolat'], 'poulet remis');
const asnap = snapOf(aw), arel = tools(open(ls => Object.entries(asnap).forEach(([k, v]) => ls.setItem(k, v))));
assert(arel.$('#alim-list [data-kind="pd"][data-value="avoine"]').getAttribute('aria-pressed') === 'false' && arel.$('#alim-list [data-kind="prot"][data-value="poulet"]').getAttribute('aria-pressed') === 'true', 'retraits relus');
const abad = tools(open(ls => ls.setItem(PKEY, JSON.stringify({ off: ['prot:constructor', '__proto__:x', 'pd:avoine', 'pd:pain', 'pd:sale', 5, 'starch:riz'] }))));
assert(abad.$('#alim-list [data-kind="pd"][data-value="avoine"]').getAttribute('aria-pressed') === 'true' && abad.$('#alim-list [data-kind="starch"][data-value="riz"]').getAttribute('aria-pressed') === 'false', 'retraits abîmés');
assert.strictEqual(abad.chosen('starch', 'dej'), 'pates', 'riz retiré : remplacé par les pâtes');

// Ta semaine : repères de Santé publique France, sous le calendrier (semaine par défaut : il manque des légumes secs)
const wkd = open(), wk = tools(wkd), ww = wkd.window;
const wbRows = t => [...t.d.querySelectorAll('#wb-list li')].map(li => [li.className, li.querySelector('span').textContent]);
assert(wk.$('#wk-bal').tagName === 'DETAILS' && !wk.$('#wk-bal').open && /^Pense aux légumes secs, encore une fois/.test(wk.$('#wb-msg').textContent), 'carte de la semaine : ' + wk.$('#wb-msg').textContent);
assert.deepStrictEqual(wbRows(wk), [['is-ok', 'Poisson'], ['is-ok', 'dont poisson gras'], ['is-todo', 'Légumes secs'], ['is-ok', 'Viande rouge, cuite'], ['is-ok', 'Charcuterie']], 'repères de la semaine');
assert(/1 sur 2\s\(à prévoir\)/.test(wk.$('#wb-list').textContent), 'légumes secs à prévoir');
wk.choose('starch', 'dej', 'poischiches');
assert(wk.$('#wb-msg').textContent === 'Elle est équilibrée, bravo.' && wk.$('#wk-bal').classList.contains('is-ok'), 'semaine équilibrée : ' + wk.$('#wb-msg').textContent);
// Un choix qui fait déborder la semaine : le message le dit tout de suite ; la carte passe en alerte
const heavy = {};
['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'].forEach(iso => { heavy[iso] = { seances: [], libre: false, ch: { pdBase: 'sale', dej: { prot: 'boeuf', starch: 'riz' }, diner: { prot: iso === '2026-10-05' ? 'boeuf' : 'oeufs', starch: 'pates' } } }; });
const hvd = open(ls => ls.setItem(KEY, JSON.stringify({ plans: heavy, choices: {} }))), hv = tools(hvd), hw = hvd.window;
assert(/^Trop de charcuterie \(≈\s\d+\sg, 150\sg au plus\)\s: préfère le petit-déjeuner sucré/.test(hv.$('#wb-msg').textContent) && hv.$('#wk-bal').classList.contains('is-over'), 'trop de charcuterie : ' + hv.$('#wb-msg').textContent);
hv.choose('prot', 'dej', 'boeuf');
assert(/^Ça fait ≈\s\d+\sg de viande rouge cuite cette semaine, 500\sg au plus\s: alterne avec la volaille, le poisson ou le tofu\.$/.test(hv.$('#hint').textContent), 'viande rouge dépassée : ' + hv.$('#hint').textContent);
hv.choose('prot', 'dej', 'poulet');
// « Décide pour moi » équilibre : ni bœuf, ni salé, ni œufs-jambon quand la semaine en a déjà trop ; poisson et légumes secs favorisés
let seedR = 7; hw.Math.random = () => (seedR = (seedR * 16807) % 2147483647) / 2147483647;
let fishN = 0, legN = 0;
for (let i = 0; i < 25; i++) {
  hv.click('#open-repas'); hv.click('[data-action="repas-hasard"]');
  const c = hv.stored().plans['2026-10-07'].ch;
  assert(c.pdBase !== 'sale' && ![c.dej.prot, c.diner.prot].some(p => p === 'boeuf' || p === 'oeufs'), 'tirage déséquilibré : ' + JSON.stringify(c));
  fishN += [c.dej.prot, c.diner.prot].filter(p => ['poisson', 'saumon', 'thon'].includes(p)).length;
  legN += [c.dej.starch, c.diner.starch].filter(st => ['lentilles', 'poischiches'].includes(st)).length;
}
assert(fishN >= 15 && legN >= 8, `poisson et légumes secs favorisés : ${fishN} poissons, ${legN} légumes secs sur 50 repas`);
// Collation : pas d'œufs quand il y en a déjà au menu (petit-déjeuner salé)
hv.choose('pd', null, 'sale');
const coLis = [...hv.d.querySelectorAll('[aria-labelledby="h-co"] li')].map(li => li.textContent);
assert(/skyr nature/.test(coLis[0]) && /à la place des œufs, déjà au menu aujourd’hui/.test(coLis[0]) && /amandes/.test(coLis[1]) && !coLis.some(t => /œuf/.test(t.replace('à la place des œufs', ''))), 'collation sans œufs : ' + coLis.join(' / '));

// Réglages, « Ta semaine type » : séances habituelles par jour et soir du repas libre, reprises par les jours pas encore remplis
const swd = open(), sw = tools(swd), sww = swd.window;
const sprof = () => JSON.parse(sww.localStorage.getItem(PKEY));
const semDays = () => [...sw.d.querySelectorAll('#sem-days button')].map(b => b.querySelector('.wd').textContent + b.querySelector('.dn').textContent);
sw.click('#gear');
assert.deepStrictEqual(semDays(), ['lun.–', 'mar.–', 'mer.–', 'jeu.–', 'ven.–', 'sam.–', 'dim.–'], 'semaine type vide au départ');
assert(sw.$('#sem-days [aria-pressed="true"]').dataset.value === '3' && sw.$('#sem-h').textContent === 'Mercredi' && /Repos, pas de séance/.test(sw.$('#sem-sess').textContent), 'jour d’aujourd’hui choisi');
assert.strictEqual(sw.$('#sem-lib [aria-pressed="true"]').dataset.value, '6', 'repas libre le samedi par défaut');
sw.click('#sem-days [data-value="1"]');
assert.strictEqual(sww.document.activeElement, sw.$('#sem-days [data-value="1"]'), 'focus gardé sur le jour');
sw.click('#sem-acts [data-value="petite"]'); sw.click('#sem-acts [data-value="moyenne"]');
sw.click('#sem-sess [data-action="sem-smoment"][data-index="1"][data-value="matin"]');
sw.click('#sem-days [data-value="3"]'); sw.click('#sem-acts [data-value="longue"]');
sw.click('#sem-sess [data-action="sem-sduree"][data-index="0"][data-value="3"]');
assert(sw.$('#sem-acts [data-value="longue"]').disabled && !sw.$('#sem-acts [data-value="petite"]').disabled, 'une seule sortie longue par jour');
sw.click('#sem-lib [data-value="0"]');
assert.deepStrictEqual(semDays(), ['lun.2', 'mar.–', 'mer.1', 'jeu.–', 'ven.–', 'sam.–', 'dim.–'], 'séances par jour');
assert.deepStrictEqual(sprof().semaine, { jours: { 1: [{ taille: 'petite', moment: 'soir' }, { taille: 'moyenne', moment: 'matin' }], 3: [{ taille: 'longue', moment: 'matin', duree: 3 }] }, libre: 0 }, 'semaine type enregistrée');
assert.strictEqual(sw.$('#sem-days [data-value="1"]').getAttribute('aria-label'), 'lundi\u00a0: 2 séances', 'jour lu par les lecteurs d’écran');
// Les jours pas encore remplis la reprennent : aujourd'hui (mercredi) la sortie longue, rien d'enregistré pour la date
sw.click('#reglages [data-action="fermer"]');
assert.deepStrictEqual(sw.sess(), ['Sortie longue'], 'séances de la semaine type sur la page');
assert(!sw.stored() || !sw.stored().plans['2026-10-07'], 'jour non rempli enregistré');
const libreOf = iso => { sw.click(`#week [data-value="${iso}"]`); return sw.$('#sw-lib').getAttribute('aria-checked') === 'true'; };
assert(!libreOf('2026-10-10') && libreOf('2026-10-11'), 'repas libre de la semaine type : dimanche');
// Choisir un plat n'enregistre pas les séances : elles suivent toujours la semaine type
sw.click('#week [data-value="2026-10-07"]');
sw.choose('starch', 'dej', 'pates');
assert.deepStrictEqual(Object.keys(sw.stored().plans['2026-10-07']), ['ch'], 'plats seuls enregistrés');
sw.click('#gear'); sw.click('#sem-days [data-value="3"]'); sw.click('#sem-sess [data-action="sem-rm"][data-index="0"]');
assert.strictEqual(sww.document.activeElement, sw.$('#sem-acts [data-value="petite"]'), 'focus après le retrait');
sw.click('#reglages [data-action="fermer"]');
assert(sw.sess().length === 0 && sw.chosen('starch', 'dej') === 'pates', 'semaine type changée : séances suivies, plats gardés');
// Un jour modifié à la main garde ses séances ; « Revenir au plan de base » revient à la semaine type
sw.click('#week [data-value="2026-10-05"]');
assert.deepStrictEqual(sw.sess(), ['Petite séance', 'Séance moyenne'], 'lundi : séances de la semaine type');
sw.rm(0);
sw.click('#gear'); sw.click('#sem-days [data-value="1"]'); sw.click('#sem-acts [data-value="petite"]'); sw.click('#reglages [data-action="fermer"]');
assert.deepStrictEqual(sw.sess(), ['Séance moyenne'], 'jour modifié : séances gardées');
assert.deepStrictEqual(Object.keys(sw.stored().plans['2026-10-05']), ['seances'], 'séances seules enregistrées');
sw.click('[data-action="reset"]');
assert.strictEqual(sw.sess().length, 3, 'plan de base : semaine type');
// Un seul repas libre par semaine : l'activer jeudi retire celui de la semaine type (dimanche)
sw.click('#week [data-value="2026-10-08"]');
sw.setSwitch('libre', true);
assert(/celui de dimanche est retiré/.test(sw.$('#hint').textContent) && sw.stored().plans['2026-10-11'].libre === false, 'repas libre de la semaine type retiré : ' + sw.$('#hint').textContent);
assert(!libreOf('2026-10-11'), 'dimanche sans repas libre');
// La semaine suivante, pas encore remplie : la semaine type, aussi dans une planification (ses séances gardées)
sw.click('#today-btn');
sw.click('#plan-btn');
assert(/celles de ta semaine type/.test(sw.$('#plan-body').textContent), 'Planifier : semaine type annoncée');
{ const el = sw.$('input[data-range="plan"][data-end="to"]'); el.value = '2026-10-12'; el.dispatchEvent(new sww.Event('input', { bubbles: true })); }
sw.click('[data-action="pl-create"]');
const mon = [...sw.d.querySelectorAll('#courses-days .shop-day')].find(b => b.dataset.value === '2026-10-12');
assert(mon && /^3\sséances/.test(mon.querySelector('.note').textContent) && !('seances' in sw.stored().plans['2026-10-12']), 'planification : semaine type ' + (mon && mon.textContent));
sw.click('#nav-jour');
// Relue au rechargement ; abîmée, elle est ignorée
const ssnap = snapOf(sww), srel = tools(open(ls => Object.entries(ssnap).forEach(([k, v]) => ls.setItem(k, v))));
srel.click('#wk-next'); srel.click('#week [data-value="2026-10-12"]');
assert.strictEqual(srel.sess().length, 3, 'semaine type relue');
const sbad = tools(open(ls => ls.setItem(PKEY, JSON.stringify({ semaine: { jours: { 3: 'x', 9: [{ taille: 'petite' }], __proto__: [] }, libre: 'dimanche' } }))));
assert(sbad.sess().length === 0 && sbad.$('#sem-lib [aria-pressed="true"]').dataset.value === '6', 'semaine type abîmée');

// Accueil au premier lancement : rien n'est enregistré avant la fin
const fdom = open(null, true), f = tools(fdom), fw = fdom.window;
const fprof = () => JSON.parse(fw.localStorage.getItem(PKEY));
const step = t => [...t.d.querySelectorAll('#accueil [data-step]')].filter(x => !x.hidden).map(x => x.dataset.step).join();
const accType = (t, w, k, v) => { const el = t.$(`#accueil input[data-acc="${k}"]`); el.value = String(v); el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const accPressed = (t, k) => (t.$(`#accueil [data-key="${k}"][aria-pressed="true"]`) || {}).dataset;
assert(!f.$('#accueil').hidden && f.$('#page').hidden && step(f) === '1', 'accueil non affiché au premier lancement');
assert(f.$('#acc-back').hidden && f.$('#acc-next').textContent === 'Continuer' && f.$('#acc-bar').getAttribute('aria-valuenow') === '1', 'étape 1');
assert(!accPressed(f, 'sexe') && accPressed(f, 'neat').value === 'assis', 'sexe à choisir, assis par défaut');
f.click('#acc-next');
assert(step(f) === '1' && /homme ou une femme/.test(f.$('#acc-err').textContent) && /ton âge, ta taille et ton poids/.test(f.$('#acc-err').textContent), 'champs obligatoires : ' + f.$('#acc-err').textContent);
assert.strictEqual(f.$('#accueil input[data-acc="age"]').getAttribute('aria-invalid'), 'true', 'âge manquant non signalé');
f.click('#accueil [data-key="sexe"][data-value="f"]');
assert(!f.$('#acc-err').textContent && accPressed(f, 'sexe').value === 'f', 'sexe choisi');
accType(f, fw, 'age', 30); accType(f, fw, 'taille', 165); accType(f, fw, 'poids', 5);
assert(!f.$('#accueil input[data-acc="age"]').hasAttribute('aria-invalid'), 'âge corrigé encore en erreur');
f.click('#acc-next');
assert(step(f) === '1' && /Vérifie ton poids \(35 à 250\skg\)/.test(f.$('#acc-err').textContent), 'poids hors bornes : ' + f.$('#acc-err').textContent);
accType(f, fw, 'poids', 58.5);
f.click('#acc-next');
assert(step(f) === '2' && !f.$('#acc-back').hidden && !f.$('#acc-err').textContent, 'étape 2');
assert.strictEqual(fw.localStorage.getItem(PKEY), null, 'profil enregistré avant la fin');
// Objectif : sèche présélectionnée, aperçu en direct (femme, 30 ans, 165 cm, 58,5 kg, assise : 1 305 × 1,4 = 1 827 kcal, −15 % → 1 550 kcal)
assert.strictEqual(accPressed(f, 'deficit').value, '15', 'sèche présélectionnée');
assert(/1\s830\skcal/.test(f.$('#acc-prev').textContent) && /1\s550\skcal/.test(f.$('#acc-prev').textContent) && /par semaine/.test(f.$('#acc-prev').textContent), 'aperçu : ' + f.$('#acc-prev').textContent);
f.click('#accueil [data-key="deficit"][data-value="0"]');
assert(/garder ton poids/.test(f.$('#acc-prev').textContent) && /1\s830\skcal\./.test(f.$('#acc-prev').textContent), 'aperçu sans déficit : ' + f.$('#acc-prev').textContent);
f.click('#accueil [data-key="deficit"][data-value="20"]');
f.click('#acc-next');
assert(step(f) === '3' && f.$('#acc-next').textContent === 'Continuer' && f.$('#acc-bar').getAttribute('aria-label') === 'Étape 3 sur 4', 'étape 3');
f.click('#acc-back');
assert(step(f) === '2' && accPressed(f, 'deficit').value === '20', 'retour à l’étape 2');
f.click('#acc-next');
// Habitudes : shaker oui par défaut (dose visible), marge 150
assert(accPressed(f, 'shaker').value === 'oui' && !f.$('#acc-dose').hidden && accPressed(f, 'marge').value === '150', 'habitudes par défaut');
f.click('#accueil [data-key="shaker"][data-value="non"]');
assert(f.$('#acc-dose').hidden && /skyr/.test(f.$('#acc-shaker-t').textContent), 'dose visible sans shaker');
f.click('#accueil [data-key="marge"][data-value="250"]');
f.click('#acc-next');
// Ta semaine (3.18.0) : facultative, le même éditeur que les réglages, aujourd'hui (mercredi) choisi, rien d'enregistré avant la fin
assert(step(f) === '4' && f.$('#acc-next').textContent === 'Voir mes repas' && f.$('#acc-bar').getAttribute('aria-valuenow') === '4' && fdom.window.document.activeElement === f.$('#acc-h4'), 'étape 4');
assert(f.$('#acs-days [aria-pressed="true"]').dataset.value === '3' && /Mercredi/.test(f.$('#acs-h').textContent) && f.$('#acs-sess .rest-t') && f.$('#acs-lib [aria-pressed="true"]').dataset.value === '6', 'semaine vide au départ');
f.click('#acs-acts [data-value="moyenne"]');
f.click('#acs-sess [data-action="acs-smoment"][data-value="matin"]');
assert(f.$('#acs-days [data-value="3"] .dn').textContent === '1' && /Séance moyenne/.test(f.$('#acs-sess').textContent) && fdom.window.document.activeElement.dataset.action === 'acs-smoment', 'séance ajoutée, focus gardé');
f.click('#acs-days [data-value="6"]');
f.click('#acs-acts [data-value="longue"]');
assert(f.$('#acs-acts [data-value="longue"]').disabled, 'une seule sortie longue par jour');
f.click('#acs-lib [data-value="0"]');
assert.strictEqual(fw.localStorage.getItem(PKEY), null, 'semaine enregistrée avant la fin');
f.click('#acc-next');
assert.deepStrictEqual(fprof(), { mode: 'auto', sexe: 'f', age: 30, taille: 165, poids: 58.5, deficit: 20, shaker: 'non', marge: 250,
  semaine: { jours: { 3: [{ taille: 'moyenne', moment: 'matin' }], 6: [{ taille: 'longue', moment: 'matin', duree: 2 }] }, libre: 0 } }, 'profil de l’accueil');
// La semaine type remplit aujourd'hui (mercredi : une moyenne le matin) et les réglages la montrent
assert(f.$('#sem-days [data-value="3"] .dn').textContent === '1' && f.$('#sem-lib [aria-pressed="true"]').dataset.value === '0', 'réglages : semaine de l’accueil');
// Puis le formulaire des repas du jour, puis la page
assert(f.$('#accueil').hidden && !f.$('#repas').hidden && fdom.window.document.activeElement === f.$('#repas-h'), 'formulaire des repas après l’accueil');
f.click('[data-action="repas-ok"]');
assert(f.$('#accueil').hidden && f.$('#repas').hidden && !f.$('#page').hidden && /Ajoute tes séances/.test(f.$('#intro').textContent), 'page du jour après l’accueil');
assert(/1\s830/.test(f.$('#calc-rest').textContent) && !/Complète/.test(f.$('#sum-note').textContent), 'profil de l’accueil non utilisé : ' + f.$('#sum-note').textContent);
assert.deepStrictEqual(f.sess(), ['Séance moyenne'], 'semaine type de l’accueil pas reprise aujourd’hui');
assert(![...f.d.querySelectorAll('#day li')].some(li => /shaker de protéines/.test(li.textContent)), 'shaker affiché après l’avoir refusé');
assert(f.$('#besoins input[data-key="age"]').value === '30' && f.$('#besoins input[data-key="deficit"]').value === '20', 'besoins non remplis après l’accueil');
assert.strictEqual(fdom.window.document.activeElement, f.$('#title'), 'focus sur le titre après l’accueil');
f.add('petite');
assert(!f.$('#intro').textContent && f.sess().length === 2, 'message d’accueil resté affiché');
// Refaire l'accueil : prérempli, les changements sont enregistrés à la fin
f.click('[data-action="accueil"]');
assert(!f.$('#accueil').hidden && step(f) === '1' && accPressed(f, 'sexe').value === 'f' && f.$('#accueil input[data-acc="poids"]').value === '58.5', 'accueil non prérempli');
f.click('#acc-next');
assert(step(f) === '2' && accPressed(f, 'deficit').value === '20', 'objectif non prérempli');
f.click('#accueil [data-key="deficit"][data-value="10"]');
f.click('#acc-next');
f.click('#accueil [data-key="shaker"][data-value="oui"]');
accType(f, fw, 'shakerKcal', 300);
f.click('#acc-next');
assert(step(f) === '3' && /Vérifie les calories par dose \(100 à 160\skcal\)/.test(f.$('#acc-err').textContent), 'dose hors bornes : ' + f.$('#acc-err').textContent);
accType(f, fw, 'shakerKcal', 130);
f.click('#acc-next');
// Semaine préremplie avec celle du profil ; vidée ici, elle part aussi du profil
assert(step(f) === '4' && f.$('#acs-days [data-value="3"] .dn').textContent === '1' && f.$('#acs-lib [aria-pressed="true"]').dataset.value === '0', 'semaine non préremplie');
f.click('#acs-days [data-value="3"]');
f.click('#acs-sess [data-action="acs-rm"]');
f.click('#acs-days [data-value="6"]');
f.click('#acs-sess [data-action="acs-rm"]');
f.click('#acs-lib [data-value="6"]');
f.click('#acc-next');
assert(!('semaine' in fprof()), 'semaine vidée gardée : ' + JSON.stringify(fprof()));
assert(fprof().deficit === 10 && fprof().shaker === 'oui' && fprof().shakerKcal === 130 && fprof().marge === 250 && f.$('#accueil').hidden, 'accueil refait : ' + JSON.stringify(fprof()));
assert(f.$('#repas').hidden && !f.$('#page').hidden, 'formulaire des repas rouvert le même jour');
assert.deepStrictEqual(f.sess(), ['Séance moyenne', 'Petite séance'], 'séances perdues en refaisant l’accueil');
// Passer : garde ce qui est déjà saisi, le reste prend les valeurs par défaut
const sk = tools(open(null, true));
accType(sk, sk.d.defaultView, 'age', 25);
sk.click('[data-action="acc-skip"]');
assert.deepStrictEqual(JSON.parse(sk.d.defaultView.localStorage.getItem(PKEY)), { mode: 'auto', age: 25 }, 'profil après Passer');
assert(!sk.$('#repas').hidden, 'formulaire des repas après Passer');
sk.click('[data-action="repas-hasard"]');
assert(sk.$('#accueil').hidden && !sk.$('#page').hidden && /Complète ton profil/.test(sk.$('#sum-note').textContent), 'page après Passer');

// Batch cooking (3.13.0) : « Planifier », recettes en batch cooking, 3 recettes pour les 7 prochains jours (mercredi → mardi,
// repas libre samedi), répétées midi et soir ; le détail montre la fiche (à cuisiner aujourd'hui, boîtes au frigo puis au
// congélateur)
{
  const bt = tools(open()), bw = bt.d.defaultView;
  bt.click('#plan-btn');
  bt.click('#pl-batch');
  assert(bt.$('[data-action="pl-nrec"][aria-pressed="true"]').dataset.value === '4' && /Quelques recettes qui se gardent/.test(bt.$('#plan-body').textContent), '4 recettes par défaut');
  bt.click('[data-action="pl-nrec"][data-value="3"]');
  assert(bt.$('[data-action="pl-nrec"][aria-pressed="true"]').dataset.value === '3' && bt.d.activeElement === bt.$('[data-action="pl-nrec"][data-value="3"]'), 'nombre de recettes choisi, focus gardé');
  let seed = 11;
  bw.Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  bt.click('[data-action="pl-create"]');
  assert(!bt.$('#courses').hidden && bt.$('#plan').hidden && bt.$('#courses-span').textContent === '7\u00a0jours, batch cooking de 3\u00a0recettes, en cours.', 'détail après le batch : ' + bt.$('#courses-span').textContent);
  // Planifier : la planification en cours, en tête et en évidence
  bt.click('#plan-btn');
  assert(bt.$('#plan-body > .pl-now .is-cur[data-value="2026-10-07|2026-10-13"]') && /^Du 7 au 13\soctobreEn cours7\sjours, batch cooking de 3\srecettes\. Le récap et tes courses\.$/.test(bt.$('.is-cur').textContent) && !bt.$('#pl-list-t'), 'planification en cours : ' + bt.$('#plan-body').textContent.slice(0, 120));
  bt.click('.is-cur');
  assert(!bt.$('#courses').hidden && bt.$('#courses-h').textContent === 'Du 7 au 13\u00a0octobre', 'détail de la planification en cours');
  const st = bt.stored(), isos = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'];
  const meals = isos.flatMap(iso => { const c = st.plans[iso].ch; return iso === '2026-10-10' ? [c.dej] : [c.dej, c.diner]; });
  const count = {};
  meals.forEach(m => { assert.strictEqual(m.recette, m.prot + '-' + m.starch, 'recette enregistrée'); count[m.recette] = (count[m.recette] || 0) + 1; });
  assert(Object.keys(count).length === 3 && Object.values(count).sort().join() === '4,4,5', 'trois recettes, 13 boîtes : ' + JSON.stringify(count));
  isos.forEach(iso => { const c = st.plans[iso].ch; assert(c.dej.prot !== c.diner.prot, 'même protéine midi et soir : ' + iso); });
  assert.deepStrictEqual(st.choices[3], st.plans['2026-10-07'].ch, 'mémoire du mercredi');
  // Fiche : à cuisiner aujourd'hui (la période commence aujourd'hui), une fiche par recette, boîtes au frigo 3 jours
  assert(/^À cuisiner aujourd’hui\s:\s3 recettes, 13\sboîtes\./.test(bt.$('#courses-batch .calc').textContent), 'fiche : ' + bt.$('#courses-batch .calc').textContent);
  const cards = [...bt.d.querySelectorAll('#courses-batch details.batch')];
  assert(cards.length === 3 && cards.every(x => !x.open), 'une fiche repliée par recette');
  let boxes = 0, freezer = 0;
  cards.forEach(card => {
    const lis = [...card.querySelectorAll('.b-list')[1].querySelectorAll('li')];
    assert(new RegExp('^' + lis.length + '\\sboîtes').test(card.querySelector('.b-n').textContent), 'nombre de boîtes : ' + card.querySelector('.b-n').textContent);
    lis.forEach(li => {
      const day = Number(li.querySelector('.b-q').textContent.match(/\d+/)[0]), cold = /congélateur/.test(li.textContent);
      assert.strictEqual(cold, day >= 11, 'frigo jusqu’au samedi, congélateur ensuite : ' + li.textContent);
      if (cold) freezer++;
    });
    boxes += lis.length;
    assert(card.querySelectorAll('.rec-steps li').length === 3 && card.querySelector('.b-list li .b-q').textContent.length > 0, 'à cuire et préparation');
  });
  assert(boxes === 13 && new RegExp('mets les ' + freezer + ' boîtes marquées').test(bt.$('#courses-batch .calc').textContent), 'boîtes au congélateur : ' + freezer);
  // À cuire en tout = somme des boîtes (la protéine, première ligne, crue)
  const amount = t => { const x = Number(t.replace(/[^\d,]/g, '').replace(',', '.')); return /kg/.test(t) ? x * 1000 : x; };
  cards.forEach(card => {
    const total = amount(card.querySelector('.b-list li .b-q').textContent);
    const sum = [...card.querySelectorAll('.b-list')[1].querySelectorAll('li .name')].reduce((a, n) => a + Number(n.textContent.match(/^\d+/)[0]), 0);
    assert(Math.abs(total - sum) <= (total >= 1000 ? 5 : 0), 'à cuire ≠ somme des boîtes : ' + total + ' / ' + sum);
  });
  // Chiffres ronds (3.17.0) : la protéine de chaque recette arrondie aux 100 g (poids fixés dans les plats enregistrés) ;
  // jambon par paquet : 0 ou 4 tranches (180 g) dans les courses
  const roundCards = () => [...bt.d.querySelectorAll('#courses-batch details.batch')].forEach(card => {
    const id = card.querySelector('[data-action="co-swap"]') ? card.querySelector('[data-action="co-swap"]').dataset.value.split('|')[1] : null;
    if (!id || ['thon', 'oeufs'].includes(id.split('-')[0])) return;
    const meals = isos.flatMap(iso => { const c = bt.stored().plans[iso].ch; return [c.dej, c.diner]; }).filter(m => m.recette === id);
    if (!meals.every(m => Number.isInteger(m.g))) return;
    const q = card.querySelector('.b-list li .b-q').textContent;
    assert(/^\d+00\u00a0g$|^\d+(,\d)?\u00a0kg$/.test(q) && amount(q) % 100 === 0, 'compte rond : ' + id + ' ' + q);
    roundN++;
  });
  let roundN = 0;
  roundCards();
  assert(roundN >= 2, 'recettes arrondies : ' + roundN);
  const ham = [...bt.d.querySelectorAll('#courses-list .chk')].find(x => /jambon blanc/.test(x.textContent));
  assert(!ham || ham.querySelector('.q').textContent === '180\u00a0g', 'jambon par paquet : ' + (ham && ham.textContent));
  // Changer une recette (3.16.0) : bouton dans la fiche, panneau « Une autre au hasard » puis les recettes qui vont ;
  // Échap ne change rien ; un choix remplace l'ancienne dans toutes ses boîtes, la fiche s'ouvre sur elle, le message le dit
  {
    const ids = Object.keys(count), stored0 = JSON.stringify(bt.stored());
    const btn = cards[0].querySelector('[data-action="co-swap"]'), oldId = btn.dataset.value.split('|')[1], oldT = cards[0].querySelector('.b-t').textContent;
    assert(btn.dataset.value === '0|' + oldId && ids.includes(oldId) && btn.textContent === 'Changer de recette', 'bouton changer de recette');
    btn.click();
    assert(!bt.$('#sheet').hidden && bt.$('#courses').hasAttribute('inert') && bt.$('#sheet-t').textContent === 'Remplacer «\u00a0' + oldT + '\u00a0»' && bt.$('#sheet-list').classList.contains('swap'), 'panneau changer : ' + bt.$('#sheet-t').textContent);
    const opts = [...bt.d.querySelectorAll('#sheet .opt')];
    assert(opts[0].dataset.value === '*' && /^Une autre au hasard/.test(opts[0].textContent) && bt.d.activeElement === opts[0], 'au hasard en tête, focus dessus');
    const prots = ids.filter(x => x !== oldId).map(x => x.split('-')[0]);
    opts.slice(1).forEach(o => assert(!ids.includes(o.dataset.value) && !prots.includes(o.dataset.value.split('-')[0]) && /\d\u00a0min$/.test(o.querySelector('.opt-s').textContent), 'recette proposée : ' + o.dataset.value));
    bt.d.dispatchEvent(new bw.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(bt.$('#sheet').hidden && JSON.stringify(bt.stored()) === stored0 && bt.d.activeElement === btn && !bt.$('#courses').hasAttribute('inert'), 'Échap : rien ne change, focus rendu');
    // Une recette de la liste (la dernière : une autre protéine)
    btn.click();
    const last = [...bt.d.querySelectorAll('#sheet .opt')].pop(), nid = last.dataset.value;
    last.click();
    assert(bt.$('#sheet').hidden && !bt.$('#courses').hasAttribute('inert'), 'panneau fermé après le choix');
    const st2 = bt.stored(), count2 = {};
    isos.forEach(iso => { const c = st2.plans[iso].ch; (iso === '2026-10-10' ? [c.dej] : [c.dej, c.diner]).forEach(m => { assert.strictEqual(m.recette, m.prot + '-' + m.starch, 'recette enregistrée'); count2[m.recette] = (count2[m.recette] || 0) + 1; }); });
    assert(!count2[oldId] && count2[nid] === count[oldId] && ids.filter(x => x !== oldId).every(x => count2[x] === count[x]), 'remplacée dans toutes ses boîtes : ' + JSON.stringify(count2));
    // Chiffres ronds : la nouvelle recette est arrondie à son tour (poids fixés sur toutes ses boîtes)
    if (!['thon', 'oeufs'].includes(nid.split('-')[0])) assert(isos.every(iso => { const c = st2.plans[iso].ch; return (iso === '2026-10-10' ? [c.dej] : [c.dej, c.diner]).filter(m => m.recette === nid).every(m => Number.isInteger(m.g)); }), 'recette changée arrondie : ' + nid);
    isos.forEach(iso => { const c = st2.plans[iso].ch, c0 = st.plans[iso].ch; assert(c.dej.prot !== c.diner.prot && c.dej.dessert === c0.dej.dessert, 'même protéine ou dessert changé : ' + iso); });
    const card2 = bt.$('#swap-0-' + nid).closest('details');
    assert(card2.open && bt.d.activeElement === bt.$('#swap-0-' + nid) && card2.querySelectorAll('.b-list')[1].querySelectorAll('li').length === count[oldId], 'fiche ouverte sur la remplaçante, focus');
    assert.strictEqual(bt.$('#courses-msg').textContent, '«\u00a0' + card2.querySelector('.b-t').textContent + '\u00a0» remplace «\u00a0' + oldT + '\u00a0» dans tes ' + count[oldId] + '\u00a0boîtes.');
    // Au hasard : une autre recette, toujours trois recettes et 13 boîtes
    bt.$('#swap-0-' + nid).click();
    bt.click('#sheet .opt[data-value="*"]');
    const st3 = bt.stored(), count3 = {};
    isos.forEach(iso => { const c = st3.plans[iso].ch; (iso === '2026-10-10' ? [c.dej] : [c.dej, c.diner]).forEach(m => { count3[m.recette] = (count3[m.recette] || 0) + 1; }); });
    assert(!count3[nid] && Object.keys(count3).length === 3 && Object.values(count3).reduce((x, y) => x + y, 0) === 13, 'au hasard : ' + JSON.stringify(count3));
    assert.deepStrictEqual(st3.choices[3], st3.plans['2026-10-07'].ch, 'mémoire du mercredi après le changement');
    // La nouvelle recette est arrondie à son tour, les autres gardent leurs poids
    roundN = 0;
    roundCards();
    assert(roundN >= 2, 'arrondie après le changement : ' + roundN);
  }
  // La page du jour suit : recette choisie à midi, celle enregistrée pour aujourd'hui
  bt.click('#courses [data-action="fermer"]');
  {
    // Poids fixés : gardés par le formulaire des repas validé, oubliés avec la recette (Retirer)
    const today = () => bt.stored().plans['2026-10-07'].ch;
    const slot = ['dej', 'diner'].find(sl => Number.isInteger(today()[sl].g));
    if (slot){
      const g0 = today()[slot].g;
      bt.click('#open-repas');
      bt.click('[data-action="repas-ok"]');
      assert.strictEqual(today()[slot].g, g0, 'formulaire des repas : poids fixé gardé');
      bt.click('#rec-v-' + slot);
      assert.strictEqual(bt.$('#sheet-rec .items li .qty').textContent, g0 + '\u00a0g', 'fiche de la recette : poids fixé');
      bt.click('#sheet .sheet-x');
      bt.click('#rec-c-' + slot);
      assert(!('g' in today()[slot]) && !('recette' in today()[slot]), 'recette retirée : poids fixé oublié');
      bt.click('#rec-c-' + slot);
    }
  }
  assert(bt.$('[aria-labelledby="h-dej"] .rec.is-on'), 'recette du batch sur la page');
  {
    const id = bt.stored().plans['2026-10-07'].ch.dej.recette;
    assert.strictEqual(bt.$('[aria-labelledby="h-dej"] .rec-h3').textContent, bt.d.defaultView.eval('RECIPES')[id].t, 'page du jour à jour après le changement : ' + id);
    // Panneau de choix d'un plat ensuite : la liste reprend sa forme de bulles
    bt.click('[data-action="open-pick"][data-kind="starch"][data-slot="dej"]');
    assert(!bt.$('#sheet-list').classList.contains('swap'), 'panneau de choix en bulles');
    bt.click('#sheet .sheet-x');
  }
  // Journée (3.21.0) : une recette du batch a son bouton « Batch cooking » ; sa page : seulement cette recette, le jour où la
  // cuisiner, ce qu'il faut cuire, ses boîtes, sa préparation
  bt.click('#nav-jour');
  {
    const id = bt.stored().plans['2026-10-07'].ch.dej.recette, R = bw.eval('RECIPES')[id];
    assert(bt.$('#rec-b-dej') && bt.$('#rec-b-dej').textContent === 'Batch cooking' && bt.$('#rec-b-dej').getAttribute('aria-label') === 'Batch cooking de la recette du déjeuner', 'bouton du batch : ' + id);
    bt.click('#rec-b-dej');
    assert(!bt.$('#batch').hidden && bt.$('#page').hidden && bt.d.activeElement === bt.$('#batchp-h') && bt.$('#batchp-h').textContent === R.t && bt.$('#nav-jour').getAttribute('aria-current') === 'page', 'page du batch');
    const n = bt.d.querySelectorAll('#batch-body .b-list')[1].querySelectorAll('li').length;
    assert(new RegExp('^À cuisiner aujourd’hui\\s:\\s' + n + '\\sboîtes\\.').test(bt.$('#batch-body .calc').textContent) && n >= 2, 'jour et boîtes : ' + bt.$('#batch-body .calc').textContent);
    assert.deepStrictEqual([...bt.d.querySelectorAll('#batch-body h3')].map(h => h.textContent), ['À cuire en tout', 'Les boîtes', 'Aromates, sans compter', 'Préparation'], 'fiche du batch');
    assert(/^Mer\. 7, midi/.test(bt.$('#batch-body .b-list:nth-of-type(2) li .b-q').textContent) && !bt.$('#batch [data-action="co-swap"]') && bt.d.querySelectorAll('#batch-body .rec-steps li').length === 3, 'boîtes et préparation, sans « Changer »');
    bt.click('#batch [data-action="fermer"]');
    assert(!bt.$('#page').hidden && bt.d.activeElement === bt.$('#rec-b-dej'), 'retour à la journée, focus sur le bouton');
    // Une recette servie une seule fois : pas de bouton ; la planification finie, la semaine du jour sert de repli
    bt.choose('starch', 'dej', bt.chosen('starch', 'dej') === 'riz' ? 'pates' : 'riz');
    assert(!bt.$('#rec-b-dej'), 'recette changée : plus de bouton');
  }
  // Période invalide : pas de planification
  bt.click('#plan-btn');
  const end = bt.$('input[data-range="plan"][data-end="to"]');
  end.value = '2026-10-01'; end.dispatchEvent(new bw.Event('input', { bubbles: true }));
  const nq = JSON.parse(bw.localStorage.getItem('repas-du-jour:planifs:v1')).list.length;
  bt.click('[data-action="pl-create"]');
  assert(!bt.$('#plan').hidden && /La fin doit venir après le début/.test(bt.$('#plan-err').textContent) && JSON.parse(bw.localStorage.getItem('repas-du-jour:planifs:v1')).list.length === nq, 'planification refusée sur une période invalide');
}

// Onglets des réglages (3.18.0) : flèches, début et fin (le focus suit) ; le dernier onglet gardé à la réouverture par la
// roue dentée ; « Régler » de la note du total ouvre Repas quand elle propose le shaker ou la marge cuisine, sinon Profil
{
  const t = tools(open(ls => ls.setItem(PKEY, JSON.stringify({ age: 35, taille: 178, poids: 72 })))), tw = t.d.defaultView;
  const sel = () => [...t.d.querySelectorAll('#besoins [role="tab"]')].filter(x => x.getAttribute('aria-selected') === 'true').map(x => x.id).join();
  const panes = () => [...t.d.querySelectorAll('#besoins [role="tabpanel"]')].filter(x => !x.hidden).map(x => x.id).join();
  const key = k => t.d.activeElement.dispatchEvent(new tw.KeyboardEvent('keydown', { key: k, bubbles: true }));
  t.click('#gear');
  assert(sel() === 'tab-profil' && panes() === 'pan-profil', 'Profil à la première ouverture');
  assert.deepStrictEqual([...t.d.querySelectorAll('#besoins [role="tab"]')].map(x => x.textContent), ['Profil', 'Sport', 'Repas', 'Appli'], 'onglets');
  [...t.d.querySelectorAll('#besoins [role="tabpanel"]')].forEach(x => assert(t.$('#' + x.getAttribute('aria-labelledby')).getAttribute('aria-controls') === x.id, 'onglet ↔ panneau'));
  t.$('#tab-profil').focus();
  key('ArrowRight');
  assert(sel() === 'tab-sport' && panes() === 'pan-sport' && t.d.activeElement === t.$('#tab-sport'), 'flèche droite');
  key('End');
  assert(sel() === 'tab-appli' && t.d.activeElement === t.$('#tab-appli'), 'fin');
  key('ArrowRight');
  assert(sel() === 'tab-profil', 'flèche droite après le dernier : le premier');
  key('ArrowLeft');
  assert(sel() === 'tab-appli', 'flèche gauche avant le premier : le dernier');
  key('Home');
  assert(sel() === 'tab-profil', 'début');
  t.click('#tab-repas');
  t.click('#reglages > [data-action="fermer"]');
  t.click('#gear');
  assert(sel() === 'tab-repas' && panes() === 'pan-repas', 'dernier onglet gardé : ' + sel());
  t.click('#reglages > [data-action="fermer"]');
  // « Régler » : profil complet et rien à proposer → Profil ; trop d'apport avec shaker et marge → Repas
  assert.strictEqual(t.$('#sum-note [data-action="needs"]').dataset.value, 'profil', 'Régler : Profil');
  t.click('#sum-note [data-action="needs"]');
  assert(sel() === 'tab-profil' && !t.$('#reglages').hidden, 'Régler ouvre Profil');
  t.click('#reglages > [data-action="fermer"]');
  const lw = tools(open(ls => ls.setItem(PKEY, JSON.stringify({ sexe: 'f', age: 28, taille: 160, poids: 45, deficit: 25, prot: 2.2 }))));
  assert(/dépassent l’objectif/.test(lw.$('#sum-note').textContent) && lw.$('#sum-note [data-action="needs"]').dataset.value === 'repas', 'Régler : Repas quand la note propose le shaker ou la marge');
  lw.click('#sum-note [data-action="needs"]');
  assert(lw.$('#tab-repas').getAttribute('aria-selected') === 'true' && !lw.$('#pan-repas').hidden, 'Régler ouvre Repas');
  // Effacer mes données (onglet Appli) : la prochaine ouverture repart sur Profil
  t.click('#gear'); t.click('#tab-appli');
  t.click('[data-action="eff-ask"]'); t.click('[data-action="eff-ok"]');
  t.click('[data-action="acc-skip"]');
  if (!t.$('#repas').hidden) t.click('#repas [data-action="fermer"]');
  t.click('#gear');
  assert.strictEqual(sel(), 'tab-profil', 'après effacement : Profil');
}

// « Ta semaine » (3.17.0) : un paquet de jambon (4 petits-déjeuners salés, 180 g) toléré, sans alerte ; 5 (225 g) : alerte
{
  // Toute la semaine (lundi → dimanche) prévue, sans œufs-jambon ; n petits-déjeuners salés
  const week = n => { const plans = {}; ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].forEach((iso, i) => { plans[iso] = { ch: { pdBase: i < n ? 'sale' : 'avoine', dej: { prot: 'poulet', starch: 'riz' }, diner: { prot: 'poisson', starch: 'pates' } } }; }); return plans; };
  [[4, false], [5, true]].forEach(([n, over]) => {
    const t = tools(open(ls => ls.setItem(KEY, JSON.stringify({ plans: week(n), choices: {} }))));
    const row = [...t.d.querySelectorAll('#wb-list li')].find(li => /Charcuterie/.test(li.textContent));
    assert.strictEqual(t.$('#wk-bal').classList.contains('is-over'), over, 'charcuterie ' + n + ' tranches : alerte ' + over);
    assert(over ? /^Trop de charcuterie/.test(t.$('#wb-msg').textContent) && row.className === 'is-over' : /un paquet de 4 tranches/.test(row.textContent) && row.className === 'is-ok', 'charcuterie ' + n + ' tranches : ' + row.textContent + ' / ' + t.$('#wb-msg').textContent);
  });
}

// Gérer une planification (3.22.0) : refaire ses plats (à partir d'aujourd'hui si elle a commencé : les jours passés restent
// une planification à part), la retirer de la liste (ses plats restent), avec une confirmation ; « Un autre plat » sur la page
{
  const QK = 'repas-du-jour:planifs:v1', isos = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
  const seedCh = { pdBase: 'pain', dej: { prot: 'boeuf', starch: 'pdt' }, diner: { prot: 'tofu', starch: 'riz' } };
  const t = tools(open(ls => { ls.setItem(QK, JSON.stringify({ list: [{ from: '2026-10-05', to: '2026-10-09', type: 'simple', n: 0, checked: ['a|1'] }] }));
    const plans = {}; isos.forEach(iso => { plans[iso] = { ch: seedCh }; }); ls.setItem(KEY, JSON.stringify({ plans, choices: {} })); }));
  const tw = t.d.defaultView, list = () => JSON.parse(tw.localStorage.getItem(QK)).list;
  t.click('#plan-btn'); t.click('.is-cur');
  t.click('#co-redo');
  assert(t.$('#co-ask').hidden && !t.$('#co-confirm').hidden && /^Refaire tous les plats d’aujourd’hui au vendredi 9\soctobre\s\?/.test(t.$('#co-q').textContent) && t.d.activeElement === t.$('#co-no'), 'refaire : confirmation');
  t.click('#co-no');
  assert(!t.$('#co-ask').hidden && t.$('#co-confirm').hidden && t.d.activeElement === t.$('#co-redo') && JSON.stringify(t.stored().plans['2026-10-07'].ch) === JSON.stringify(seedCh), 'refaire annulé');
  t.click('#co-redo'); t.click('#co-ok');
  assert.deepStrictEqual(list().map(p => [p.from, p.to, p.type, p.checked.join()]), [['2026-10-05', '2026-10-06', 'simple', 'a|1'], ['2026-10-07', '2026-10-09', 'simple', '']], 'refaite à partir d’aujourd’hui');
  const st = t.stored().plans;
  assert(JSON.stringify(st['2026-10-05'].ch) === JSON.stringify(seedCh) && JSON.stringify(st['2026-10-06'].ch) === JSON.stringify(seedCh) && ['2026-10-07', '2026-10-08', '2026-10-09'].every(iso => !st[iso].ch.dej.recette), 'jours passés gardés, plats simples refaits');
  assert(t.$('#courses-h').textContent === 'Du 7 au 9 octobre' && /^Plats refaits\s: du 7 au 9\soctobre\.$/.test(t.$('#courses-msg').textContent) && t.d.activeElement === t.$('#co-redo'), 'refaite : détail et message');
  // Retirer : de la liste seulement, retour à Planifier avec un message
  t.click('#co-del');
  assert(/^Retirer cette planification de ta liste\s\? Ses plats restent prévus, jour par jour\.$/.test(t.$('#co-q').textContent) && t.$('#co-ok').textContent === 'Oui, la retirer', 'retirer : confirmation');
  t.click('#co-ok');
  assert(!t.$('#plan').hidden && t.$('#courses').hidden && /^Du 7 au 9\soctobre\s: retirée de ta liste\.$/.test(t.$('#plan-msg').textContent) && !t.$('.is-cur'), 'retirée : retour à Planifier');
  assert.deepStrictEqual(list().map(p => p.from), ['2026-10-05'], 'retirée de la liste');
  assert(t.stored().plans['2026-10-08'].ch, 'retirée : plats gardés');
  t.click('#nav-jour');
  assert(![...t.d.querySelectorAll('#week .wk-pl')].slice(2, 5).some(x => x.classList.contains('on')) && t.d.querySelectorAll('#week .wk-pl.on').length === 2, 'retirée : plus de trait dans le calendrier (seuls lundi et mardi, l’autre planification)');
  t.click('#plan-btn');
  // Une planification passée ne se refait pas
  t.click('[data-action="pl-open"][data-value="2026-10-05|2026-10-06"]');
  assert(t.$('#co-redo').hidden && !t.$('#co-del').hidden, 'planification passée : pas de « Refaire »');
  t.click('#nav-jour');
  // « Un autre plat » : un autre couple, une autre protéine que l'autre repas, le dessert gardé, le focus aussi
  t.choose('dessert', 'dej', 'fruit');
  for (let i = 0; i < 6; i++) {
    const before = JSON.stringify(t.stored().plans['2026-10-07'].ch.dej), other = t.chosen('prot', 'diner');
    t.click('#redo-dej');
    const now = t.stored().plans['2026-10-07'].ch.dej;
    assert(JSON.stringify({ prot: now.prot, starch: now.starch }) !== JSON.stringify({ prot: JSON.parse(before).prot, starch: JSON.parse(before).starch }) && now.prot !== other && now.dessert === 'fruit' && t.d.activeElement === t.$('#redo-dej'), 'un autre plat : ' + before + ' → ' + JSON.stringify(now));
    assert(t.chosen('prot', 'dej') === now.prot && t.stored().choices[3].dej.prot === now.prot, 'un autre plat : page et mémoire');
  }
  // Dans une planification en recettes, le nouveau plat a sa recette ; sinon seulement si le repas en avait une
  assert(!t.stored().plans['2026-10-07'].ch.dej.recette, 'plats simples : pas de recette');
  t.click('#plan-btn'); t.click('[data-action="pl-create"]'); t.click('#nav-jour');
  t.click('#redo-diner');
  assert(t.stored().plans['2026-10-07'].ch.diner.recette, 'planification en recettes : la recette du nouveau plat');
  // Jour de repas libre : pas de bouton au dîner
  t.click('#week [data-value="2026-10-10"]');
  assert(t.$('#redo-dej') && !t.$('#redo-diner'), 'repas libre : pas d’autre plat au dîner');
}

// Repas mangés (3.23.0) : « Mangé » coche le repas (frise, stockage) et passe au suivant pas encore mangé ; sous la frise, ce
// qu'il reste à manger ; décocher garde la carte ; pas de bouton les jours à venir ; stockage relu, validé, purgé à 21 jours
{
  const MK = 'repas-du-jour:manges:v1';
  const t = tools(open(ls => ls.setItem(MK, JSON.stringify({ '2026-09-01': ['pd'], '2026-09-20': ['dej', 'x'], '2026-10-07': ['pd', '__proto__', 'pd', 'constructor'], 'x': ['pd'], '2026-10-08': 'pd' }))));
  const tw = t.d.defaultView, mg = () => JSON.parse(tw.localStorage.getItem(MK));
  const tabs = () => [...t.d.querySelectorAll('#frise .f-m')].map(b => b.dataset.value), eatenTabs = () => [...t.d.querySelectorAll('#frise .f-m.is-eaten')].map(b => b.dataset.value);
  const kc = id => Number(t.$('#sec-' + id + ' .kcal').textContent.replace(/\D/g, ''));
  // Relu : seul le petit-déjeuner d'aujourd'hui (identifiants validés, doublons retirés)
  assert.deepStrictEqual(eatenTabs(), ['pd'], 'relu : ' + eatenTabs());
  assert(t.$('#eat-pd').getAttribute('aria-pressed') === 'true' && t.$('#ft-pd').getAttribute('aria-label') === 'Petit-déjeuner, mangé' && t.$('#ft-pd .f-d svg') && t.$('#sec-pd').classList.contains('is-eaten'), 'petit-déjeuner coché');
  assert(t.$('#eat-dej').getAttribute('aria-pressed') === 'false' && t.$('#eat-dej').getAttribute('aria-label') === 'Déjeuner mangé', 'déjeuner pas coché');
  const total0 = Number(t.$('#sum-text strong').textContent.replace(/\D/g, ''));
  const left = () => { const m = /^Reste à manger\s:\s≈\s([\d\s]+)\skcal et (\d+)\sg de protéines\.$/.exec(t.$('#eat-msg').textContent); return m ? Number(m[1].replace(/\D/g, '')) : null; };
  assert(left() !== null && Math.abs(left() - (total0 - kc('pd'))) <= 10, 'reste à manger : ' + t.$('#eat-msg').textContent + ' / ' + total0 + ' − ' + kc('pd'));
  // Décocher : la carte reste, le focus aussi ; le stockage garde les autres jours (purgés et validés)
  t.click('#ft-pd'); t.click('#eat-pd');
  assert(t.$('#eat-pd').getAttribute('aria-pressed') === 'false' && t.$('#ft-pd').getAttribute('aria-selected') === 'true' && t.d.activeElement === t.$('#eat-pd') && t.$('#eat-msg').textContent === '', 'décoché');
  assert.deepStrictEqual(mg(), { '2026-09-20': ['dej'] }, 'stockage purgé et validé');
  // Cocher le déjeuner puis le petit-déjeuner : on passe au premier repas suivant pas encore mangé (la collation)
  t.click('#ft-dej'); t.click('#eat-dej');
  const after = tabs()[tabs().indexOf('dej') + 1];
  assert(t.$('#ft-' + after).getAttribute('aria-selected') === 'true' && !t.$('#sec-' + after).hidden && t.d.activeElement === t.$('#ft-' + after), 'déjeuner coché : carte suivante ' + after);
  t.click('#ft-pd'); t.click('#eat-pd');
  assert(t.$('#ft-co').getAttribute('aria-selected') === 'true', 'petit-déjeuner coché : le déjeuner, déjà mangé, est sauté');
  assert.deepStrictEqual(mg()['2026-10-07'], ['dej', 'pd'], 'stockage du jour');
  // Tout cocher : « Tout est mangé », le dernier reste affiché avec le focus sur son bouton
  tabs().filter(id => !eatenTabs().includes(id)).forEach(id => { t.click('#ft-' + id); t.click('#eat-' + id); });
  const last = tabs()[tabs().length - 1];
  assert(t.$('#eat-msg').textContent === 'Tout est mangé pour aujourd’hui.' && eatenTabs().length === tabs().length && t.d.activeElement === t.$('#eat-' + last), 'tout mangé : ' + t.$('#eat-msg').textContent);
  // Rechargée : même état ; demain, pas de bouton ni de message ; hier, des boutons
  const r = tools(open(ls => ls.setItem(MK, tw.localStorage.getItem(MK))));
  assert.deepStrictEqual([...r.d.querySelectorAll('#frise .f-m.is-eaten')].map(b => b.dataset.value), tabs(), 'rechargée');
  r.click('#week [data-value="2026-10-08"]');
  assert(!r.$('#day .eat') && !r.$('#frise .is-eaten') && r.$('#eat-msg').textContent === '', 'demain : rien à cocher');
  r.click('#week [data-value="2026-10-06"]');
  r.click('#eat-' + r.$('#frise [aria-selected="true"]').dataset.value);
  assert(JSON.parse(r.d.defaultView.localStorage.getItem(MK))['2026-10-06'].length === 1 && /^Reste à manger/.test(r.$('#eat-msg').textContent), 'hier : coché');
  // Repas libre : son budget à part
  r.click('#week [data-value="2026-10-07"]');
  r.click('#ft-diner'); r.click('#eat-diner');
  r.setSwitch('libre', true);
  assert(/^Reste à manger\s:\s≈\s[\d\s]+\skcal et \d+\sg de protéines, plus ton repas libre\.$/.test(r.$('#eat-msg').textContent), 'repas libre à part : ' + r.$('#eat-msg').textContent);
}

// Ce qui reste à manger avec une sortie longue : son ravito compté tant qu'aucun repas d'après n'est coché ; au retour sur
// l'onglet un autre jour, les repas mangés de plus de 21 jours sont effacés du stockage
{
  const MK = 'repas-du-jour:manges:v1';
  const t = tools(open(ls => ls.setItem(MK, JSON.stringify({ '2026-09-17': ['pd'] }))));
  t.add('longue', 2);
  const ids = [...t.d.querySelectorAll('#frise [role="tab"]')].map(b => b.dataset.value), band = ids.find(id => t.$('#sec-' + id).classList.contains('band'));
  const after = ids.slice(ids.indexOf(band) + 1).find(id => t.$('#sec-' + id).classList.contains('meal'));
  const kc = id => Number(t.$('#sec-' + id + ' .kcal').textContent.replace(/\D/g, '')), left = () => Number(/≈\s([\d\s]+)\skcal/.exec(t.$('#eat-msg').textContent)[1].replace(/\D/g, ''));
  const ravito = [...t.d.querySelectorAll('#sec-' + band + ' .items li')].reduce((a, li) => a + Number(li.querySelector('.mac span').textContent.replace(/\D/g, '')), 0);
  const meals = ids.filter(id => t.$('#sec-' + id).classList.contains('meal'));
  t.click('#ft-pd'); t.click('#eat-pd');
  assert(ravito > 100 && Math.abs(left() - (meals.filter(id => id !== 'pd').reduce((a, id) => a + kc(id), 0) + ravito)) <= 15, 'ravito compté avant : ' + left() + ' ' + ravito);
  t.click('#ft-' + after); t.click('#eat-' + after);
  assert(Math.abs(left() - meals.filter(id => id !== 'pd' && id !== after).reduce((a, id) => a + kc(id), 0)) <= 15, 'ravito plus compté après : ' + left());
  const tw = t.d.defaultView, keep = now;
  assert(JSON.parse(tw.localStorage.getItem(MK))['2026-09-17'], 'gardé à 20 jours');
  now = new Date(2026, 9, 9, 9).getTime();
  tw.dispatchEvent(new tw.Event('focus'));
  assert(!JSON.parse(tw.localStorage.getItem(MK))['2026-09-17'] && JSON.parse(tw.localStorage.getItem(MK))['2026-10-07'], 'effacé à 22 jours, le reste gardé');
  now = keep;
}

// Glisser sur la carte (3.23.0) : vers la gauche, le repère suivant de la frise (séances comprises), vers la droite le
// précédent ; pas de boucle ; un geste court ou surtout vertical ne fait rien
{
  const t = tools(open()), tw = t.d.defaultView;
  t.add('petite', 'soir');
  const ids = () => [...t.d.querySelectorAll('#frise [role="tab"]')].map(b => b.dataset.value), sel = () => t.$('#frise [aria-selected="true"]').dataset.value;
  const swipe = (dx, dy) => {
    const ev = (type, x, y) => { const e = new tw.Event(type, { bubbles: true }); const p = [{ clientX: x, clientY: y }]; e.touches = type === 'touchend' ? [] : p; e.changedTouches = p; return e; };
    t.$('#day .meal').dispatchEvent(ev('touchstart', 200, 400));
    t.$('#day .meal').dispatchEvent(ev('touchend', 200 + dx, 400 + (dy || 0)));
  };
  t.click('#ft-pd');
  const seen = [sel()];
  for (let i = 1; i < ids().length + 2; i++){ swipe(-90); seen.push(sel()); }
  assert.deepStrictEqual([...new Set(seen)], ids(), 'vers la gauche : ' + seen.join());
  assert(t.$('#frise .f-s') && ids().includes(seen[seen.length - 1]) && seen[seen.length - 1] === ids()[ids().length - 1], 'jusqu’au dernier repère, sans boucle');
  assert(t.$('#sec-' + sel()).classList.contains('in-l') && !t.$('#sec-' + sel()).hidden, 'carte animée depuis la droite');
  swipe(90);
  assert(sel() === ids()[ids().length - 2] && t.$('#sec-' + sel()).classList.contains('in-r'), 'vers la droite : le précédent');
  const s0 = sel();
  swipe(-40); swipe(-80, 90);
  assert(sel() === s0, 'geste court ou vertical : rien');
  t.click('#ft-pd'); swipe(120);
  assert(sel() === 'pd', 'premier repère : pas de boucle');
}

// Légumes à volonté (3.23.0) ; protéines au-dessus de la fourchette (thon, lentilles) : la note du total le dit
{
  const t = tools(open(ls => ls.setItem(PKEY, JSON.stringify({ age: 35, taille: 178, poids: 72 }))));
  const leg = [...t.d.querySelectorAll('#sec-dej .items li')].find(li => /légumes/.test(li.textContent));
  assert(leg.querySelector('.vol').textContent === 'à volonté' && /^au moins, et plus si tu as faim \(≈\s30\skcal les 100\sg\)$/.test(leg.querySelector('.note').textContent), 'légumes à volonté : ' + leg.textContent);
  assert(!/Tes protéines dépassent/.test(t.$('#sum-note').textContent), 'pas de note des protéines par défaut');
  t.choose('prot', 'dej', 'thon'); t.choose('starch', 'dej', 'lentilles');
  const m = /Tes protéines dépassent ton objectif \((\d+)\sg, pour (\d+) à (\d+)\sg\), sans risque pour ta sèche\s: pour t’en rapprocher, remplace le thon, prends un autre féculent que les lentilles ou les pois chiches ou passe-toi du shaker\./.exec(t.$('#sum-note').textContent);
  assert(m && +m[1] > +m[3] && +m[2] === 130 && +m[3] === 158, 'note des protéines : ' + t.$('#sum-note').textContent);
  assert(t.$('#sum-note [data-action="needs"]').dataset.value === 'repas', '« Régler » : onglet Repas (shaker)');
  // Recette choisie : ses légumes à volonté aussi
  t.click('#rec-c-dej');
  assert(/^à volonté des légumes en plus si tu as faim/.test(t.$('#sec-dej .rec-vol').textContent), 'recette : légumes à volonté');
}

// Planifications relues et validées (3.21.0) : abîmées, ignorées (l'ancienne période des courses n'est alors pas reprise) ;
// triées ; finies depuis plus de 21 jours, effacées
{
  const QK = 'repas-du-jour:planifs:v1';
  for (const bad of ['{pas du json', '5', 'null', '[1]', JSON.stringify({ list: 'x' }), JSON.stringify({ list: [null, 5, { from: '2026-10-08', to: '2026-10-01' }, { from: '2026-10-01', to: '2026-12-31' }, { from: 'x', to: '2026-10-09' }] })]) {
    const t = tools(open(ls => { ls.setItem(QK, bad); ls.setItem('repas-du-jour:courses:v1', JSON.stringify({ from: '2026-10-07', to: '2026-10-09', checked: [] })); }));
    t.click('#plan-btn');
    assert(/Aucune planification pour l’instant/.test(t.$('#plan-body').textContent), 'planifications abîmées : ' + bad);
  }
  const t = tools(open(ls => ls.setItem(QK, JSON.stringify({ list: [
    { from: '2026-10-20', to: '2026-10-22', type: 'simple' },
    { from: '2026-09-01', to: '2026-09-07', type: 'simple' },
    { from: '2026-10-07', to: '2026-10-09', type: '__proto__', n: 7, checked: ['a|1', 5] },
    { from: '2026-09-20', to: '2026-09-26', type: 'simple', n: 3 }] }))));
  assert.deepStrictEqual(JSON.parse(t.d.defaultView.localStorage.getItem(QK)).list, [
    { from: '2026-09-20', to: '2026-09-26', type: 'simple', n: 0, checked: [] },
    { from: '2026-10-07', to: '2026-10-09', type: 'recettes', n: 0, checked: ['a|1'] },
    { from: '2026-10-20', to: '2026-10-22', type: 'simple', n: 0, checked: [] }], 'planifications validées, triées, purgées');
  t.click('#plan-btn');
  assert(t.$('.is-cur[data-value="2026-10-07|2026-10-09"]') && t.$('#pl-list-t').textContent === 'Tes autres planifications', 'en cours');
  assert.deepStrictEqual([...t.d.querySelectorAll('#plan-body [data-action="pl-open"]')].map(b => b.dataset.value + ' ' + b.querySelector('.k').textContent),
    ['2026-10-07|2026-10-09 En cours', '2026-10-20|2026-10-22 À venir', '2026-09-20|2026-09-26 Passée'], 'ordre : en cours, à venir, passées');
  // Une nouvelle planification au milieu d'une autre la coupe en deux (ses coches gardées des deux côtés)
  const tw = t.d.defaultView, setT = (end, v) => { const el = t.$(`input[data-range="plan"][data-end="${end}"]`); el.value = v; el.dispatchEvent(new tw.Event('input', { bubbles: true })); };
  setT('from', '2026-10-08'); setT('to', '2026-10-08');
  t.click('[data-action="pl-create"]');
  assert.deepStrictEqual(JSON.parse(tw.localStorage.getItem(QK)).list.map(p => [p.from, p.to, p.checked.join()]),
    [['2026-09-20', '2026-09-26', ''], ['2026-10-07', '2026-10-07', 'a|1'], ['2026-10-08', '2026-10-08', ''], ['2026-10-09', '2026-10-09', 'a|1'], ['2026-10-20', '2026-10-22', '']], 'planification coupée en deux');
}

// Réglages, « Effacer mes données » (3.15.0) : demander, annuler (rien ne bouge), confirmer (tout ce qui est à l'appli
// part, l'ancienne v1 comprise, le reste du stockage non), puis l'appli repart comme au premier lancement
{
  const full = ls => {
    ls.setItem(KEY, JSON.stringify({ plans: { '2026-10-07': { seances: [{ taille: 'moyenne', moment: 'soir' }], libre: false, ch: { pdBase: 'pain', dej: { prot: 'boeuf', starch: 'pates', recette: 'boeuf-pates' }, diner: { prot: 'tofu', starch: 'riz' } } } }, choices: { 3: { pdBase: 'pain', dej: { prot: 'boeuf', starch: 'pates' }, diner: { prot: 'tofu', starch: 'riz' } } } }));
    ls.setItem(OLD_KEY, JSON.stringify({ plans: { '2026-10-07': { activity: 'course', moment: 'soir' } }, choices: {} }));
    ls.setItem(PKEY, JSON.stringify({ sexe: 'f', age: 30, taille: 165, poids: 58, off: ['prot:thon'], semaine: { jours: { 1: [{ taille: 'petite', moment: 'soir' }] }, libre: 4 } }));
    ls.setItem('repas-du-jour:courses:v1', JSON.stringify({ from: '2026-10-07', to: '2026-10-09', checked: ['skyr|500 g'] }));
    ls.setItem('repas-du-jour:manges:v1', JSON.stringify({ '2026-10-07': ['pd'] }));
    ls.setItem('autre-appli:cle', 'garde');
  };
  const ef = tools(open(full)), ew = ef.d.defaultView;
  // Migration (3.21.0) : l'ancienne période des courses devient une planification (avec ses coches), l'ancienne clé reste
  assert.deepStrictEqual(JSON.parse(ew.localStorage.getItem('repas-du-jour:planifs:v1')), { list: [{ from: '2026-10-07', to: '2026-10-09', type: 'recettes', n: 0, checked: ['skyr|500 g'] }] }, 'courses converties en planification');
  assert(/"from":"2026-10-07"/.test(ew.localStorage.getItem('repas-du-jour:courses:v1')), 'ancienne clé des courses touchée');
  assert(ef.sess().join() === 'Séance moyenne' && ef.chosen('prot', 'dej') === 'boeuf' && ef.$('#frise .f-m.is-eaten'), 'données de départ');
  ef.click('#gear');
  assert(!ef.$('#eff-ask').hidden && ef.$('#eff-confirm').hidden && /Effacer mes données/.test(ef.$('#effacer h2').textContent), 'carte « Effacer mes données »');
  ef.click('[data-action="eff-ask"]');
  assert(ef.$('#eff-ask').hidden && !ef.$('#eff-confirm').hidden && ew.document.activeElement === ef.$('#eff-no') && /C’est définitif/.test(ef.$('#eff-q').textContent), 'confirmation demandée, focus sur « Annuler »');
  ef.click('[data-action="eff-no"]');
  assert(!ef.$('#eff-ask').hidden && ef.$('#eff-confirm').hidden && ew.document.activeElement === ef.$('#eff-btn') && ew.localStorage.getItem(PKEY) !== null && ew.localStorage.getItem(KEY) !== null, 'annuler : rien n’est effacé');
  // La confirmation ne reste pas ouverte d'une visite à l'autre
  ef.click('[data-action="eff-ask"]'); ef.click('#reglages [data-action="fermer"]'); ef.click('#gear');
  assert(!ef.$('#eff-ask').hidden && ef.$('#eff-confirm').hidden, 'confirmation refermée en revenant dans les réglages');
  ef.click('[data-action="eff-ask"]');
  ef.click('[data-action="eff-ok"]');
  const left = []; for (let i = 0; i < ew.localStorage.length; i++) left.push(ew.localStorage.key(i));
  assert.deepStrictEqual(left, ['autre-appli:cle'], 'clés restantes : ' + left.join(', '));
  assert(!ef.$('#accueil').hidden && ef.$('#reglages').hidden && ef.$('#page').hidden && ew.document.activeElement === ef.$('#acc-h1'), 'accueil comme au premier lancement');
  assert([...ef.d.querySelectorAll('#accueil input[data-acc]')].every(el => el.value === ''), 'accueil vide');
  // Passer : la page part de zéro (repos, plats par défaut du mercredi, sans recette) et le formulaire des repas s'ouvre
  ef.click('[data-action="acc-skip"]');
  assert(!ef.$('#repas').hidden, 'formulaire des repas après l’accueil');
  ef.click('#repas [data-action="fermer"]');
  assert(!ef.$('#page').hidden && ef.$('#date').textContent.startsWith('Aujourd’hui') && /Repos/.test(ef.$('#sess').textContent), 'page de zéro');
  assert(ef.chosen('prot', 'dej') === 'poulet' && ef.chosen('starch', 'dej') === 'riz' && !ef.$('.rec.is-on') && !ef.$('#frise .is-eaten') && ef.$('#eat-msg').textContent === '', 'plats par défaut, rien de mangé');
  assert(!ew.localStorage.getItem(KEY) || Object.keys(JSON.parse(ew.localStorage.getItem(KEY)).plans).length === 0, 'aucun jour enregistré');
  assert(ef.$('#alim-list [data-kind="prot"][data-value="thon"]').getAttribute('aria-pressed') === 'true' && !ef.d.querySelector('#alim-list [aria-pressed="false"]'), 'aliments : tous proposés');
  ef.click('#gear');
  assert(ef.$('#besoins [data-key="poids"]').value === '' && ef.d.querySelectorAll('#sem-days .dn').length === 7 && [...ef.d.querySelectorAll('#sem-days .dn')].every(x => x.textContent === '–'), 'profil et semaine type remis à zéro');
  ef.click('#reglages [data-action="fermer"]');
  // Planifier : plus aucune planification (l'ancienne clé des courses ne revient pas)
  ef.click('#plan-btn');
  assert(/Aucune planification pour l’instant/.test(ef.$('#plan-body').textContent) && !ef.$('[data-action="pl-open"]'), 'planifications remises à zéro');
  ef.click('#nav-jour');
  // Rechargée : plus d'accueil (le profil vide est enregistré par « Passer »), toujours rien de l'ancienne v1
  const snap = {}; for (let i = 0; i < ew.localStorage.length; i++) { const k = ew.localStorage.key(i); snap[k] = ew.localStorage.getItem(k); }
  const again = tools(open(ls => { ls.clear(); Object.entries(snap).forEach(([k, v]) => ls.setItem(k, v)); }, true));
  assert(again.$('#accueil').hidden && /Repos/.test(again.$('#sess').textContent), 'rechargée après l’effacement');
}

assert.deepStrictEqual(errors, [], 'erreurs JavaScript : ' + errors.join(' | '));
console.log('interface OK');
