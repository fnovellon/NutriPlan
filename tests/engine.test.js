// Vérifie le moteur de calcul de index.html sans navigateur.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
assert(m, 'script introuvable dans index.html');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[1] + '\n;globalThis.__api = {buildDay, DEFAULT_PLAN, DEFAULT_CHOICES, PROT_ORDER, STARCH_ORDER, CARBS};', ctx);
const { buildDay, DEFAULT_PLAN, DEFAULT_CHOICES, PROT_ORDER, STARCH_ORDER, CARBS } = ctx.__api;

// 1. Jours par défaut : totaux proches des repères
const expected = { 1: [1950, 2250], 2: [2200, 2500], 3: [1750, 1950], 4: [2150, 2400], 5: [1900, 2150], 6: [2850, 3200], 0: [2200, 2450] };
for (const [day, [lo, hi]] of Object.entries(expected)) {
  const r = buildDay(DEFAULT_PLAN[day], DEFAULT_CHOICES[day]);
  assert(r.tot.kcal >= lo && r.tot.kcal <= hi, `jour ${day} : ${Math.round(r.tot.kcal)} kcal, attendu entre ${lo} et ${hi}`);
}

// 2. Toutes les combinaisons : protéines, lipides, calories, glucides du féculent
const ranges = { repos: [1600, 2400], muscu: [1800, 2600], course: [2050, 3100], double: [2150, 3200], longue: [2400, 3300] };
let n = 0;
for (const activity of Object.keys(ranges)) {
  for (const moment of ['matin', 'soir']) for (const natation of [false, true]) for (const pdBase of ['avoine', 'pain']) {
    for (const p1 of PROT_ORDER) for (const s1 of STARCH_ORDER) for (const p2 of PROT_ORDER) for (const s2 of STARCH_ORDER) {
      const combo = `${activity}/${moment}/${natation ? 'natation' : '-'}/${pdBase}/${p1}+${s1}/${p2}+${s2}`;
      const r = buildDay({ activity, moment, duree: 2, natation, libre: false }, { pdBase, dej: { prot: p1, starch: s1 }, diner: { prot: p2, starch: s2 } });
      assert(r.tot.p >= 140, `${combo} : ${Math.round(r.tot.p)} g de protéines`);
      assert(r.tot.f >= 50 && r.tot.f <= 95, `${combo} : ${Math.round(r.tot.f)} g de lipides`);
      const [lo, hi] = ranges[activity];
      assert(r.tot.kcal >= lo && r.tot.kcal <= hi, `${combo} : ${Math.round(r.tot.kcal)} kcal`);
      for (const slot of ['dej', 'diner']) {
        const choice = slot === 'dej' ? s1 : s2;
        if (choice === 'lentilles') continue;
        const sec = r.secs.find(s => s.id === slot);
        const st = sec.items.find(i => i.key === 'st');
        const target = CARBS[activity][slot];
        assert(Math.abs(st.m.c - target) <= target * 0.1 + 3, `${combo} : ${slot} apporte ${st.m.c.toFixed(1)} g de glucides au lieu de ${target}`);
      }
      n++;
    }
  }
}

// 3. Repas libre : budget arrondi à 50, compté dans le total, pas de skyr du soir
for (const activity of Object.keys(ranges)) {
  const r = buildDay({ activity, moment: 'soir', duree: 2, natation: false, libre: true }, DEFAULT_CHOICES[6]);
  assert(r.libre > 0 && r.libre % 50 === 0, `${activity} : budget libre ${r.libre}`);
  assert(r.secs.some(s => s.title === 'Repas libre') && !r.secs.some(s => s.id === 'soir'), `${activity} : sections du repas libre`);
}

// 4. Sortie longue : le ravito suit la durée
const fuel = d => buildDay({ activity: 'longue', moment: 'matin', duree: d, natation: false, libre: false }, DEFAULT_CHOICES[6]).secs.find(s => s.band).items[0].m.c;
assert(fuel(1.5) < fuel(2) && fuel(2) < fuel(2.5) && fuel(2.5) < fuel(3), 'ravito non proportionnel à la durée');

console.log(`moteur OK (${n} combinaisons vérifiées)`);
