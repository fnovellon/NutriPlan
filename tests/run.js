// Lance les fichiers de test en parallèle (un processus chacun, autant à la fois que de cœurs) et affiche leurs
// résultats dans l'ordre de la liste ; échoue si l'un d'eux échoue.
//   node tests/run.js        : npm test
//   node tests/run.js deep   : npm run test:deep (tests de fond beaucoup plus longs)
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const deep = process.argv[2] === 'deep';
const JOBS = deep
  ? [['fuzz.test.js', '20'], ['ui-fuzz.test.js', '10'], ['diff.test.js', '10']]
  : ['engine', 'golden', 'fuzz', 'ui', 'ui-fuzz', 'pwa', 'diff'].map(n => [n + '.test.js']);
const results = new Array(JOBS.length);
let next = 0, running = 0, failed = 0;
const start = Date.now();

function launch(){
  while (running < Math.max(1, os.cpus().length) && next < JOBS.length){
    const i = next++, [file, ...args] = JOBS[i], t0 = Date.now();
    let out = '';
    const p = spawn(process.execPath, [path.join(__dirname, file), ...args], { env: process.env });
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    running++;
    p.on('close', code => {
      running--;
      results[i] = { file, code, out, s: Math.round((Date.now() - t0) / 1000) };
      if (code) failed++;
      flush();
      launch();
    });
  }
}
// Résultats affichés dans l'ordre de la liste, dès que les précédents sont là
let shown = 0;
function flush(){
  while (shown < JOBS.length && results[shown]){
    const r = results[shown++];
    process.stdout.write(r.out.replace(/\s*$/, '') + (r.code ? '\n✗ ' + r.file + ' a échoué' : '') + '  [' + r.s + ' s]\n');
  }
  if (shown === JOBS.length){
    console.log(failed ? '\n' + failed + ' fichier(s) de test en échec' : '\nTous les tests passent (' + Math.round((Date.now() - start) / 1000) + ' s)');
    process.exitCode = failed ? 1 : 0;
  }
}
launch();
