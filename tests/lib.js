// Outils partagés par les tests de fond (fuzz.test.js, golden.test.js, ui-fuzz.test.js).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// APP_HTML : tester une autre copie de la page (par exemple une copie volontairement cassée, pour vérifier que les tests la repèrent)
const html = fs.readFileSync(process.env.APP_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');

// Moteur hors navigateur : le script de index.html dans un contexte isolé (la partie DOM ne s'exécute pas).
// Toute déclaration de premier niveau (const, let, function) est lisible par son nom : A.buildDay, A.PF_MIN…
function loadEngine(){
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('script introuvable dans index.html');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(m[1], ctx);
  const cache = new Map();
  return new Proxy({}, {
    get(_, name){
      if (typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) return undefined;
      if (!cache.has(name)){
        const v = vm.runInContext('typeof ' + name + ' === "undefined" ? undefined : ' + name, ctx);
        if (v === undefined) throw new Error('introuvable dans le moteur : ' + name);
        cache.set(name, v);
      }
      return cache.get(name);
    }
  });
}

// Tirages reproductibles (mulberry32) : une graine donne toujours la même suite
function rng(seed){
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: p => next() < p,
    pick: a => a[Math.floor(next() * a.length)],
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    between: (a, b, step) => { const v = a + next() * (b - a); return step ? Math.round(v / step) * step : v; }
  };
}

// Intensité des tests de fond : FUZZ=10 (variable d'environnement) ou premier argument (npm run test:deep).
// Graine : SEED, sinon fixe (les tests donnent toujours le même résultat).
function settings(defaultSeed){
  const arg = process.argv.slice(2).find(a => /^\d+(\.\d+)?$/.test(a));
  return {
    factor: Math.max(0.1, Number(process.env.FUZZ || arg || 1)),
    seed: process.env.SEED ? Number(process.env.SEED) : defaultSeed
  };
}

// Violations regroupées par type, avec quelques exemples reproductibles ; le test échoue (code de sortie 1) s'il y en a
function checker(name){
  const found = new Map();
  let checks = 0;
  return {
    ok(cond, type, detail){
      checks++;
      if (cond) return true;
      if (!found.has(type)) found.set(type, []);
      const list = found.get(type);
      if (list.length < 3) list.push(typeof detail === 'function' ? detail() : detail);
      else list.push(null);
      return false;
    },
    get checks(){ return checks; },
    done(summary){
      if (!found.size){ console.log(name + ' OK (' + summary + ')'); return; }
      console.error(name + ' : ' + found.size + ' type(s) de violation');
      for (const [type, list] of found){
        console.error('\n✗ ' + type + ' (' + list.length + ' cas)');
        list.filter(x => x !== null).forEach(x => console.error('  ' + String(x).slice(0, 1500)));
      }
      console.error('');
      process.exitCode = 1;
    }
  };
}

// Page simulée (jsdom) à une horloge donnée ; storage : clés du localStorage enregistrées avant le chargement
function openPage(opts){
  const { JSDOM, VirtualConsole } = require('jsdom');
  const o = opts || {};
  const errors = o.errors || [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push((e && e.message) || String(e)));
  const clock = o.clock || { now: new Date(2026, 9, 7, 9).getTime() };
  return new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://example.org/', virtualConsole: vc,
    beforeParse: win => {
      const R = win.Date;
      class D extends R {
        constructor(...a){ if (a.length) super(...a); else super(clock.now); }
        static now(){ return clock.now; }
      }
      win.Date = D;
      for (const [k, v] of Object.entries(o.storage || {})) win.localStorage.setItem(k, v);
    }
  });
}

module.exports = { html, loadEngine, rng, settings, checker, openPage };
