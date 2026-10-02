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
    sess: () => [...d.querySelectorAll('#sess .srow .s-t')].map(e => e.childNodes[0].textContent),
    add: size => click(`[data-action="add"][data-value="${size}"]`),
    at: (i, m) => click(`[data-action="smoment"][data-index="${i}"][data-value="${m}"]`),
    rm: i => click(`[data-action="rm"][data-index="${i}"]`)
  };
};

const dom = open();
const { d, $, click, stored, sections, setSwitch, starchLine, pressed, choose, chosen, sess, add, at, rm } = tools(dom);

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
assert.deepStrictEqual(r.stored().choices[3].diner, { prot: 'thon', starch: 'gnocchis', dessert: 'chocolat' }, 'tirage non enregistré');
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
// Icône « Choisir mes repas » en haut de la page : ouvre le formulaire, le focus y revient à la fermeture
r.click('#repas-btn');
assert(!r.$('#repas').hidden && r.$('#page').hidden, 'icône du formulaire des repas');
r.click('#repas [data-action="fermer"]');
assert.strictEqual(rw.document.activeElement, r.$('#repas-btn'), 'focus rendu à l’icône');
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

// L'idée de plat suit les choix
choose('prot', 'diner', 'boeuf');
choose('starch', 'diner', 'pates');
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
assert.strictEqual(s2.pressed('smoment'), 'matin', 'moment v1 perdu');
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
type('prot', 2.4);
assert(prof().prot === 2.4 && /2,4\sg\/kg/.test(p.$('#out-prot').textContent) && /Environ 168\sg/.test(p.$('#calc-prot').textContent), 'objectif de protéines non enregistré');
assert(pouletQty() > poulet20 && /Aujourd’hui\s:\s\d+\sg/.test(p.$('#calc-prot').textContent), 'portions non ajustées à l’objectif de protéines');
type('prot', 2);

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

// Réglages dans un écran à part : roue dentée en haut de la page, retour par la flèche, le bouton du bas ou le bouton retour du téléphone
p.click('[data-action="fermer"]');
assert(p.$('#reglages').hidden && !p.$('#page').hidden && pw.document.activeElement === p.$('#gear'), 'réglages non fermés par la flèche');
assert(p.$('#gear').getAttribute('aria-label') === 'Réglages' && p.$('#gear svg'), 'roue dentée absente');
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
assert(p.d.querySelectorAll('#ref-tables table').length === 5 && refRows.length === 34, 'table des aliments : ' + refRows.length + ' lignes');
const pouletRow = [...p.$('#ref-tables tr[data-key="poulet"]').querySelectorAll('td')].map(td => td.textContent);
assert.deepStrictEqual(pouletRow, ['110', '23', '0', '1,4'], 'valeurs du poulet');
assert.deepStrictEqual([...p.$('#ref-tables tr[data-key="riz"]').querySelectorAll('td')].map(td => td.textContent), ['352', '8,4', '77', '1'], 'valeurs du riz (cru)');
// Nouveaux aliments (3.7.0) et groupes de valeurs proches
const refCells = key => [...p.$(`#ref-tables tr[data-key="${key}"]`).querySelectorAll('th, td')].map(td => td.textContent.trim());
assert.deepStrictEqual(refCells('tofu'), ['Tofu ferme, nature', '148', '14,4', '1,1', '9,3'], 'tofu dans la table');
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
const light = legacy({ mode: 'auto', sexe: 'f', age: 28, taille: 160, poids: 52, deficit: 25, prot: 2.6 });
const skyrPd = [...light.d.querySelectorAll('[aria-labelledby="h-pd"] .items li')].find(li => /skyr/.test(li.textContent));
assert(parseInt(skyrPd.querySelector('.qty').textContent, 10) < 250, '52 kg : skyr du petit-déjeuner ' + skyrPd.querySelector('.qty').textContent);
assert(/dépassent l’objectif/.test(light.$('#sum-note').textContent) && /baisse la marge cuisine, passe-toi du shaker ou baisse ton objectif de protéines/.test(light.$('#sum-note').textContent), '52 kg : ' + light.$('#sum-note').textContent);
// Protéines sous la fourchette malgré les portions au maximum (thon deux fois, 3,0 g/kg, sans shaker) : la page le dit
const thon2 = tools(open(ls => {
  ls.setItem(PKEY, JSON.stringify({ mode: 'auto', age: 35, taille: 178, poids: 71, prot: 3, shaker: 'non' }));
  ls.setItem(KEY, JSON.stringify({ plans: {}, choices: { 3: { pdBase: 'avoine', dej: { prot: 'thon', starch: 'riz' }, diner: { prot: 'thon', starch: 'pates' } } } }));
}));
assert(/Tes protéines restent sous ton objectif \(\d+\sg, pour 192 à 234\sg\)\s: remplace le thon, reprends un shaker ou baisse ton objectif de protéines\./.test(thon2.$('#sum-note').textContent), 'protéines sous la fourchette : ' + thon2.$('#sum-note').textContent);
thon2.choose('pd', null, 'sale');
assert(/: remplace le thon, prends un petit-déjeuner sucré \(avec du skyr\), reprends un shaker ou baisse ton objectif de protéines\./.test(thon2.$('#sum-note').textContent), 'salé, protéines sous la fourchette : ' + thon2.$('#sum-note').textContent);
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
assert.deepStrictEqual([c.$('#date').textContent, c.$('#title').textContent, c.$('#sw-lib-t').textContent], ['Vendredi 9 octobre', 'Qu’est-ce que tu prévois vendredi 9 octobre ?', 'Repas libre le soir'], 'autre jour');
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

// Planifier : raccourcis ou dates, puis un jour par étape, puis les courses
c.click('#plan-btn');
assert(!c.$('#plan').hidden && c.$('#page').hidden && cw.document.activeElement === c.$('#plan-h'), 'assistant ouvert');
const planSpan = () => c.$('#plan-span').textContent, planErr = () => c.$('#plan-err').textContent;
assert.strictEqual(planSpan(), '7 jours, du mercredi 7 octobre au mardi 13 octobre.', 'les 7 prochains jours par défaut');
assert.strictEqual(c.$('[data-action="pl-preset"][aria-pressed="true"]').dataset.value, '7', 'raccourci choisi');
c.click('[data-action="pl-preset"][data-value="suivante"]');
assert.strictEqual(planSpan(), '7 jours, du lundi 12 octobre au dimanche 18 octobre.', 'la semaine prochaine');
const setEnd = (which, end, v) => { const el = c.$(`input[data-range="${which}"][data-end="${end}"]`); el.value = v; el.dispatchEvent(new cw.Event('input', { bubbles: true })); };
setEnd('plan', 'to', '2026-11-30');
assert(/31\sjours au plus/.test(planErr()) && !planSpan(), 'période trop longue : ' + planErr());
c.click('[data-action="pl-start"]');
assert(c.$('#plan-step').textContent === '', 'assistant lancé malgré l’erreur');
setEnd('plan', 'to', '2026-10-10');
assert(/La fin doit venir après le début/.test(planErr()), 'fin avant le début : ' + planErr());
setEnd('plan', 'from', '2026-10-01');
assert(/Commence aujourd’hui ou plus tard/.test(planErr()), 'début passé : ' + planErr());
setEnd('plan', 'from', '2026-10-08');
assert.strictEqual(planSpan(), '3 jours, du jeudi 8 octobre au samedi 10 octobre.', 'dates choisies');
c.click('[data-action="pl-start"]');
assert.deepStrictEqual([c.$('#plan-step').textContent, c.$('#plan-h').textContent], ['Jour 1 sur 3', 'Demain, jeudi 8 octobre'], 'première étape');
assert(cw.document.activeElement === c.$('#plan-h'), 'focus sur le jour');
c.click('#plan-body [data-action="add"][data-value="petite"]');
c.click('#plan-body [data-action="smoment"][data-index="0"][data-value="matin"]');
c.click('#plan-body .sel[data-kind="starch"][data-slot="diner"]');
c.click('#sheet [data-value="pdt"]');
assert(cw.document.activeElement === c.$('#sel-pstarch-diner') && c.$('#sel-pstarch-diner').dataset.value === 'pdt', 'focus gardé sur le choix');
cs = c.stored();
assert(cs.plans['2026-10-08'].seances[0].moment === 'matin' && cs.plans['2026-10-08'].ch.diner.starch === 'pdt', 'étape enregistrée pour sa date');
assert(/Environ\s[\d\s]+\skcal/.test(c.$('.plan-kcal').textContent), 'total du jour dans l’assistant');
c.click('[data-action="pl-next"]');
assert.deepStrictEqual([c.$('#plan-step').textContent, c.$('#plan-h').textContent], ['Jour 2 sur 3', 'Vendredi 9 octobre'], 'deuxième étape');
assert(c.$('#plan-body .srow') && /Séance moyenne/.test(c.$('#plan-body .sess').textContent), 'séances déjà prévues ce jour-là');
c.click('[data-action="pl-prev"]');
assert.strictEqual(c.$('#plan-step').textContent, 'Jour 1 sur 3', 'retour à l’étape d’avant');
c.click('[data-action="pl-next"]');
cw.Math.random = () => 0.999;
c.click('[data-action="pl-hasard"]');
assert(c.stored().plans['2026-10-09'].ch.dej.prot === 'tofu' && /tirés au hasard/.test(c.$('#plan-hint').textContent), 'hasard pour ce jour');
// Samedi 10 : repas libre par défaut, gardé ; « Décide pour tous les jours restants » mène aux courses
c.click('[data-action="pl-next"]');
assert(c.$('#plan-body [data-action="toggle"]').getAttribute('aria-checked') === 'true' && !c.$('[data-action="pl-hasard-tous"]') && c.$('[data-action="pl-next"]').textContent === 'Voir mes courses', 'dernière étape');
c.click('[data-action="pl-prev"]');
cw.Math.random = () => 0;
c.click('[data-action="pl-hasard-tous"]');
assert(!c.$('#courses').hidden && c.$('#plan').hidden && cw.document.activeElement === c.$('#courses-h'), 'courses après l’assistant');
cs = c.stored();
assert(cs.plans['2026-10-09'].ch.dej.prot === 'poulet' && cs.plans['2026-10-10'].ch.diner.prot === 'boeuf' && cs.plans['2026-10-08'].ch.diner.starch === 'pdt', 'hasard pour tous les jours restants seulement');
assert(c.$('#date').textContent.startsWith('Aujourd’hui'), 'page revenue sur le jour d’avant l’assistant');
// Courses : période de l'assistant, rayons, lignes à cocher, jour par jour
assert.strictEqual(c.$('#courses-span').textContent, '3 jours, du jeudi 8 octobre au samedi 10 octobre.', 'période des courses');
const aisles = [...c.d.querySelectorAll('#courses-list h2')].map(h => h.textContent);
assert.deepStrictEqual(aisles, ['Viandes et poissons', 'Crèmerie, œufs et tofu', 'Pain et féculents, poids crus', 'Fruits et légumes', 'Épicerie', 'Le reste'], 'rayons : ' + aisles);
const shopLine = name => [...c.d.querySelectorAll('#courses-list .chk')].find(b => b.querySelector('.name').childNodes[0].textContent === name);
assert(shopLine('repas libre') && shopLine('doses de shaker').querySelector('.q').textContent === '3', 'repas libre et shaker comptés');
// La liste est la somme des jours : le skyr des trois jours, relu sur chaque page du jour
const skyrOf = t => [...t.d.querySelectorAll('#day li')].filter(li => /skyr nature/.test(li.textContent)).reduce((a, li) => a + parseInt(li.querySelector('.qty').textContent, 10), 0);
let skyrSum = 0;
for (const iso of ['2026-10-08', '2026-10-09', '2026-10-10']) {
  const t = tools(open(ls => { ls.setItem(KEY, JSON.stringify(cs)); }));
  t.click(`#week [data-value="${iso}"]`);
  skyrSum += skyrOf(t);
}
assert.strictEqual(parseInt(shopLine('skyr nature').querySelector('.q').textContent.replace(/\D/g, ''), 10) * (/kg/.test(shopLine('skyr nature').querySelector('.q').textContent) ? 10 : 1), skyrSum, 'skyr des courses ≠ somme des jours');
const days = [...c.d.querySelectorAll('#courses-days .shop-day')];
assert(days.length === 3 && /^Jeudi 8\soctobre/.test(days[0].textContent) && /1\sséance/.test(days[0].textContent) && /repas libre le soir/.test(days[2].textContent), 'jour par jour : ' + days.map(x => x.textContent).join(' | '));
// Cocher : gardé au rechargement ; tout décocher
const line = shopLine('skyr nature'), key = line.dataset.value;
c.click(`#courses-list [data-value="${key}"]`);
assert(line.getAttribute('aria-checked') === 'true' && JSON.parse(cw.localStorage.getItem('repas-du-jour:courses:v1')).checked.includes(key), 'ligne cochée');
const cs2 = snapOf(cw), again2 = tools(open(ls => Object.entries(cs2).forEach(([k, v]) => ls.setItem(k, v))));
again2.click('#courses-btn');
assert(again2.$(`#courses-list [data-value="${key}"]`).getAttribute('aria-checked') === 'true' && again2.$('#courses-span').textContent.startsWith('3'), 'coche et période gardées');
c.click('[data-action="co-uncheck"]');
assert(c.$(`#courses-list [data-value="${key}"]`).getAttribute('aria-checked') === 'false', 'tout décocher');
// Période des courses changée : liste recalculée ; un jour de la liste ouvre ce jour
setEnd('courses', 'to', '2026-10-08');
assert(c.$('#courses-span').textContent.startsWith('1 jour') && c.d.querySelectorAll('#courses-days .shop-day').length === 1, 'période d’un jour');
setEnd('courses', 'to', '2026-10-01');
assert(/La fin doit venir après le début/.test(c.$('#courses-err').textContent) && !c.$('#courses-list').textContent, 'période invalide');
setEnd('courses', 'to', '2026-10-10');
c.click('#courses-days [data-value="2026-10-09"]');
assert(!c.$('#page').hidden && c.$('#courses').hidden && c.$('#date').textContent === 'Vendredi 9 octobre', 'jour ouvert depuis les courses');
// Depuis la page : les courses gardent la dernière période ; la flèche de l'assistant ramène le jour d'avant
c.click('#courses-btn');
assert(c.$('#courses-span').textContent.startsWith('3'), 'dernière période des courses');
c.click('#courses [data-action="fermer"]');
c.click('#plan-btn');
c.click('[data-action="pl-start"]');
assert(c.$('#date').textContent.startsWith('Aujourd’hui'), 'assistant : la page suit l’étape');
c.click('#plan [data-action="fermer"]');
assert(!c.$('#page').hidden && c.$('#date').textContent === 'Vendredi 9 octobre', 'flèche de l’assistant : jour d’avant');
// Le formulaire des repas vaut pour le jour affiché
c.click('#repas-btn');
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
al.click('#aliments ~ [data-action="fermer"]');
al.choose('starch', 'dej', 'pates');
al.click('#gear');
al.click('#alim-list [data-kind="prot"][data-value="poulet"]');
assert(alim('prot', 'poulet').getAttribute('aria-pressed') === 'false' && aw.document.activeElement === alim('prot', 'poulet'), 'poulet retiré, focus gardé');
assert.deepStrictEqual(aprof().off, ['prot:poulet'], 'retrait enregistré');
al.click('#aliments ~ [data-action="fermer"]');
assert.strictEqual(al.chosen('prot', 'dej'), 'poulet', 'plat déjà choisi aujourd’hui perdu');
assert.deepStrictEqual(sheetVals('#sel-prot-dej'), ['poulet', 'boeuf', 'poisson', 'saumon', 'crevettes', 'oeufs', 'thon', 'tofu'], 'le plat choisi reste dans les choix');
assert(!sheetVals('#sel-prot-diner').includes('poulet'), 'poulet encore proposé au dîner');
al.click('#week [data-value="2026-10-06"]');
assert(al.chosen('prot', 'dej') === 'poisson' && al.chosen('prot', 'diner') === 'boeuf', 'mardi sans poulet : ' + al.chosen('prot', 'dej') + ' / ' + al.chosen('prot', 'diner'));
al.click('#wk-next'); al.click('#week [data-value="2026-10-14"]');
assert(al.chosen('prot', 'dej') === 'boeuf' && !al.stored().plans['2026-10-14'], 'mémoire du mercredi : poulet remplacé');
// Formulaire et assistant : mêmes choix ; « Décide pour moi » ne tire jamais un aliment retiré
al.click('#repas-btn');
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
al.click('#aliments ~ [data-action="fermer"]');
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
al.click('#plan-btn'); al.click('[data-action="pl-start"]');
assert(!sheetVals('#sel-pprot-diner').includes('poulet') && !sheetVals('#sel-ppd').includes('avoine'), 'assistant : aliment retiré proposé');
al.click('#plan [data-action="fermer"]');
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
// Assistant : la semaine en une phrase sous le total du jour
hv.click('#plan-btn'); hv.click('[data-action="pl-start"]');
assert(/^Ta semaine\s: trop de charcuterie/.test(hv.$('#plan-wb').textContent), 'semaine dans l’assistant : ' + hv.$('#plan-wb').textContent);
hv.click('#plan [data-action="fermer"]');

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
assert(step(f) === '3' && f.$('#acc-next').textContent === 'Voir mes repas', 'étape 3');
f.click('#acc-back');
assert(step(f) === '2' && accPressed(f, 'deficit').value === '20', 'retour à l’étape 2');
f.click('#acc-next');
// Habitudes : shaker oui par défaut (dose visible), marge 150
assert(accPressed(f, 'shaker').value === 'oui' && !f.$('#acc-dose').hidden && accPressed(f, 'marge').value === '150', 'habitudes par défaut');
f.click('#accueil [data-key="shaker"][data-value="non"]');
assert(f.$('#acc-dose').hidden && /skyr/.test(f.$('#acc-shaker-t').textContent), 'dose visible sans shaker');
f.click('#accueil [data-key="marge"][data-value="250"]');
f.click('#acc-next');
assert.deepStrictEqual(fprof(), { mode: 'auto', sexe: 'f', age: 30, taille: 165, poids: 58.5, deficit: 20, shaker: 'non', marge: 250 }, 'profil de l’accueil');
// Puis le formulaire des repas du jour, puis la page
assert(f.$('#accueil').hidden && !f.$('#repas').hidden && fdom.window.document.activeElement === f.$('#repas-h'), 'formulaire des repas après l’accueil');
f.click('[data-action="repas-ok"]');
assert(f.$('#accueil').hidden && f.$('#repas').hidden && !f.$('#page').hidden && /Ajoute tes séances/.test(f.$('#intro').textContent), 'page du jour après l’accueil');
assert(!/Complète/.test(f.$('#sum-note').textContent) && /1\s830/.test(f.$('#sum-note').textContent), 'profil de l’accueil non utilisé : ' + f.$('#sum-note').textContent);
assert(![...f.d.querySelectorAll('#day li')].some(li => /shaker de protéines/.test(li.textContent)), 'shaker affiché après l’avoir refusé');
assert(f.$('#besoins input[data-key="age"]').value === '30' && f.$('#besoins input[data-key="deficit"]').value === '20', 'besoins non remplis après l’accueil');
assert.strictEqual(fdom.window.document.activeElement, f.$('#title'), 'focus sur le titre après l’accueil');
f.add('petite');
assert(!f.$('#intro').textContent && f.sess().length === 1, 'message d’accueil resté affiché');
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
assert(fprof().deficit === 10 && fprof().shaker === 'oui' && fprof().shakerKcal === 130 && fprof().marge === 250 && f.$('#accueil').hidden, 'accueil refait : ' + JSON.stringify(fprof()));
assert(f.$('#repas').hidden && !f.$('#page').hidden, 'formulaire des repas rouvert le même jour');
assert.deepStrictEqual(f.sess(), ['Petite séance'], 'séances perdues en refaisant l’accueil');
// Passer : garde ce qui est déjà saisi, le reste prend les valeurs par défaut
const sk = tools(open(null, true));
accType(sk, sk.d.defaultView, 'age', 25);
sk.click('[data-action="acc-skip"]');
assert.deepStrictEqual(JSON.parse(sk.d.defaultView.localStorage.getItem(PKEY)), { mode: 'auto', age: 25 }, 'profil après Passer');
assert(!sk.$('#repas').hidden, 'formulaire des repas après Passer');
sk.click('[data-action="repas-hasard"]');
assert(sk.$('#accueil').hidden && !sk.$('#page').hidden && /Complète ton profil/.test(sk.$('#sum-note').textContent), 'page après Passer');

assert.deepStrictEqual(errors, [], 'erreurs JavaScript : ' + errors.join(' | '));
console.log('interface OK');
