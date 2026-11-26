// Punto de arranque: lee la configuración, abre la base y pone a escuchar el servidor.
import path from 'node:path';
import { leerConfig } from './config.ts';
import { abrirDb } from './db.ts';
import { crearApp } from './app.ts';
import { restaurarSiSePide } from './respaldo.ts';

const config = leerConfig();
const restauracion = restaurarSiSePide(config.dirDatos, config.restaurar);
if (restauracion) console.log(`RESTAURADO el respaldo ${restauracion.restaurado}. Lo que había quedó en ${restauracion.copiaDeLoAnterior ?? '(no había base)'}. Ya se puede quitar la variable RESTAURAR.`);
const { db, migracion } = abrirDb(config.dirDatos);
if (migracion.aplicadas.length) {
  console.log(`Migraciones aplicadas: ${migracion.aplicadas.join(', ')}` + (migracion.copiaPrevia ? ` (copia previa: ${migracion.copiaPrevia})` : ''));
}
const app = crearApp({ db, zonaHoraria: config.zonaHoraria, dirWeb: path.join(import.meta.dirname, '..', 'dist', 'web'),
  dirArchivos: path.join(config.dirDatos, 'archivos'), maxAdjuntoMb: config.maxAdjuntoMb, urlPublica: config.urlPublica, externo: config.externo, dokploy: config.dokploy });
app.respaldos.iniciar();

await app.listen({ port: config.puerto, host: '0.0.0.0' });
console.log(`meetmydash escuchando en el puerto ${config.puerto} · datos en ${config.dirDatos}`);

for (const senal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(senal, async () => { await app.close(); db.close(); process.exit(0); });
}
