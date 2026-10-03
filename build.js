// Construit index.html, la page publiée (une seule page autonome : style et script en ligne, aucune dépendance), à
// partir de src/. src/page.html est le gabarit : {{inclure fichier}} y est remplacé par le fichier (sans son dernier saut
// de ligne, inclusions comprises), {{base64 fichier}} par son contenu en base64 ; chemins relatifs à src/.
//   node build.js          : écrit index.html (npm run build)
//   node build.js --check  : vérifie seulement qu'index.html est à jour (lancé par npm test)
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src'), OUT = path.join(__dirname, 'index.html');

function build(){
  const read = f => fs.readFileSync(path.join(SRC, f));
  const expand = (text, seen) => text.replace(/\{\{(inclure|base64) ([^}\s]+)\}\}/g, (_, how, f) => {
    if (how === 'base64') return read(f).toString('base64');
    if (seen.includes(f)) throw new Error('inclusion en boucle : ' + seen.concat(f).join(' → '));
    return expand(read(f).toString('utf8').replace(/\n$/, ''), seen.concat(f));
  });
  return expand(read('page.html').toString('utf8'), ['page.html']);
}
const upToDate = () => fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === build();

if (require.main === module){
  if (process.argv.includes('--check')){
    if (!upToDate()){ console.error('index.html n’est pas à jour avec src/ : lance npm run build (on modifie src/, jamais index.html à la main)'); process.exit(1); }
    console.log('index.html à jour');
  } else {
    const out = build();
    fs.writeFileSync(OUT, out);
    console.log('index.html construit (' + Math.round(Buffer.byteLength(out) / 1024) + ' Ko)');
  }
}
module.exports = { build, upToDate };
