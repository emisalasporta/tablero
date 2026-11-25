// Vuelve a calcular el resumen de PARIDAD.md a partir de las filas de cada sección.
// Uso: node scripts/paridad.mjs   (después de cambiar el estado de alguna fila)
import fs from 'node:fs';

const archivo = new URL('../PARIDAD.md', import.meta.url);
const texto = fs.readFileSync(archivo, 'utf8');
const secciones = [];
let actual = null;
for (const linea of texto.split('\n')) {
  const titulo = linea.match(/^## ([A-Z]{1,2}\. .+)$/);
  if (titulo) { actual = { nombre: titulo[1], total: 0, hechas: 0, pendientes: 0, parciales: 0, imposibles: 0 }; secciones.push(actual); continue; }
  const fila = actual && linea.match(/^\| [A-Z]{1,2}\d+ \|/) ? linea.split('|').map((c) => c.trim()) : null;
  if (!fila) continue;
  const estado = fila[3];
  const nota = fila[6] ?? '';
  actual.total++;
  if (estado === 'hecha') actual.hechas++;
  else if (estado === 'no se puede') actual.imposibles++;
  else if (estado === 'pendiente') { if (nota.includes('⚠ parcial')) actual.parciales++; else actual.pendientes++; }
  else throw new Error(`Estado desconocido en ${fila[1]}: "${estado}"`);
}
const suma = (k) => secciones.reduce((n, s) => n + s[k], 0);
const propias = secciones.find((s) => s.nombre.startsWith('AA.'))?.total ?? 0;
const resumen = [
  `**${suma('total')} funciones en total** (${suma('total') - propias} de Trello + ${propias} requisitos propios del proyecto).`,
  '',
  '| Estado | Cantidad |', '|---|---|',
  `| Hechas | ${suma('hechas')} |`,
  `| Pendientes (se pueden igualar) | ${suma('pendientes')} |`,
  `| Pendientes pero parciales (⚠, no quedan idénticas) | ${suma('parciales')} |`,
  `| No se puede | ${suma('imposibles')} |`,
  '',
  '"Hecha" quiere decir: construida, con pruebas automáticas que pasan, y publicada.',
  '',
  '| Sección | Total | Hechas | Pendientes | Parciales | No se puede |', '|---|---|---|---|---|---|',
  ...secciones.map((s) => `| ${s.nombre} | ${s.total} | ${s.hechas} | ${s.pendientes} | ${s.parciales} | ${s.imposibles} |`),
].join('\n');
const nuevo = texto.replace(/<!-- RESUMEN-INICIO -->[\s\S]*<!-- RESUMEN-FIN -->/, `<!-- RESUMEN-INICIO -->\n${resumen}\n<!-- RESUMEN-FIN -->`);
fs.writeFileSync(archivo, nuevo);
console.log(`Hechas ${suma('hechas')} · pendientes ${suma('pendientes')} · parciales ${suma('parciales')} · no se puede ${suma('imposibles')} · total ${suma('total')}`);
