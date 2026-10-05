'use strict';
/* Moteur, outils communs : version, lignes d'un repas (it) et leurs valeurs (mac, unitMac), portions au poids (scaleOf, sc,
   pieces), textes (grams, slices, fmtInt, typo). Premier fichier du script : les autres s'en servent dès le chargement. */
const NB = '\u00A0';
/* Version de l'appli : la même que package.json, notée dans CHANGELOG.md */
const APP_VERSION = '3.22.0';

function has(o, k){ return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
function grams(n){ return n + NB + 'g'; }
/* Valeurs d'une quantité ; buy : ce qu'il faut acheter (voir it) */
function mac(food, g){ const f = FOOD[food], k = g / 100; return {kcal:f[0]*k, p:f[1]*k, c:f[2]*k, f:f[3]*k, buy:{id:food, g:g}}; }
function unitMac(u, n){ const f = UNIT[u]; return {kcal:f[0]*n, p:f[1]*n, c:f[2]*n, f:f[3]*n, buy:{id:u, n:n}}; }
/* cook : poids cuit estimé par mode de cuisson, affiché sous la quantité crue,
   ex. {raw:'cru', ways:[{g:135, adj:'cuit'}]} ou {raw:'crues', ways:[{g:340, adj:'à l’eau'}, {g:260, adj:'au four'}]} */
/* Ligne d'un repas. m : kcal et macros ; buy : l'achat pour la liste de courses, {id, g} en grammes, {id, n} en pièces ou
   {id, kcal} pour un budget (pris dans m.buy si absent) */
/** @returns {Item} */
function it(key, qty, name, note, m, cook, buy){
  return {key:key, qty:qty, name:name, note:note || null, m:m ? {kcal:m.kcal, p:m.p, c:m.c, f:m.f} : null, cook:cook || null, buy:buy || (m && m.buy) || null};
}

/* Portions : menu de référence pour 72 kg, mis à l'échelle du poids (k = poids / 72, borné à 0,65-1,4 ≈ 47 à 101 kg) */
const REF_KG = 72, SCALE_MIN = 0.65, SCALE_MAX = 1.4;
function scaleOf(p){ return Math.min(SCALE_MAX, Math.max(SCALE_MIN, p.poids / REF_KG)); }
/* Quantité de référence g mise à l'échelle k, arrondie au pas (jamais moins d'un pas) ; pièces arrondies à l'unité, au moins 1 */
function sc(g, step, k){ return Math.max(step, Math.round(g * k / step) * step); }
function pieces(n, k){ return Math.max(1, Math.round(n * k)); }
/* Nombre de tranches (pain 40 g, jambon 45 g la tranche), à la demi-tranche près */
function slices(g, per){
  const t = Math.round(g / per * 2) / 2;
  return (t === g / per ? '' : 'environ ') + (t === 0.5 ? 'une demi-tranche' : t.toLocaleString('fr-FR') + ' tranche' + (t >= 2 ? 's' : ''));
}
function meat(g, name, note, food){
  return it('p1', grams(g), name, note, mac(food, g), {raw:'cru', ways:[{g:Math.round(g * YIELD[food] / 5) * 5, adj:'cuit'}]});
}
function total(items){
  const t = {kcal:0, p:0, c:0, f:0};
  items.forEach(function(i){ if (i.m){ t.kcal += i.m.kcal; t.p += i.m.p; t.c += i.m.c; t.f += i.m.f; } });
  return t;
}
function fmtInt(n){ return Math.round(n).toLocaleString('fr-FR'); }

/* Typographie française des textes écrits avec des espaces simples : espace insécable avant « : ; ? ! % » et entre un
   nombre et son unité (« 8 min », « 200 °C », « 1 c. à café ») */
function typo(t){
  return t.replace(/ ([:;?!%])/g, NB + '$1').replace(/(\d) (g|kg|kcal|min|ml|cl|°C)(?![A-Za-zÀ-ÿ])/g, '$1' + NB + '$2')
    .replace(/(\d) c\./g, '$1' + NB + 'c.').replace(/c\. à/g, 'c.' + NB + 'à');
}
