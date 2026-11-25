// Deja anotado en dist/version.json qué cambio (commit) se está armando, para poder
// comprobar desde afuera (/api/salud) qué versión quedó publicada.
import fs from 'node:fs';
import path from 'node:path';

function commit() {
  if (process.env.COMMIT) return process.env.COMMIT;
  try {
    const cabeza = fs.readFileSync('.git/HEAD', 'utf8').trim();
    if (!cabeza.startsWith('ref: ')) return cabeza;
    const ref = cabeza.slice(5);
    if (fs.existsSync(path.join('.git', ref))) return fs.readFileSync(path.join('.git', ref), 'utf8').trim();
    const empaquetadas = fs.readFileSync('.git/packed-refs', 'utf8');
    const linea = empaquetadas.split('\n').find((l) => l.endsWith(' ' + ref));
    return linea ? linea.split(' ')[0] : 'desconocido';
  } catch { return 'desconocido'; }
}
fs.mkdirSync('dist', { recursive: true });
const datos = { commit: commit().slice(0, 12), armada_en: new Date().toISOString() };
fs.writeFileSync('dist/version.json', JSON.stringify(datos));
console.log('version.json:', datos);
