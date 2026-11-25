// Arma el servidor: las rutas /api y las pantallas ya construidas (dist/web).
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { leerVersion } from './version.ts';

export interface Dependencias {
  db: DatabaseSync;
  zonaHoraria: string;
  dirWeb?: string;
}

export function crearApp({ db, zonaHoraria, dirWeb }: Dependencias): FastifyInstance {
  const app = Fastify({ logger: false });
  const version = leerVersion();

  // Chequeo de salud: sirve para saber qué versión está publicada y si la base responde.
  app.get('/api/salud', async () => {
    const fila = db.prepare('SELECT count(*) AS n FROM migraciones').get() as { n: number };
    return {
      ok: true,
      app: 'meetmydash',
      version: version.version,
      commit: version.commit,
      armada_en: version.armada_en,
      migraciones: fila.n,
      zona: zonaHoraria,
      ahora: new Date().toISOString(),
    };
  });

  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'no_existe', mensaje: 'Esa dirección no existe.' });
    // Cualquier otra dirección la resuelve la pantalla (para que /b/xxxx funcione al recargar).
    if (dirWeb && fs.existsSync(path.join(dirWeb, 'index.html'))) return reply.sendFile('index.html');
    return reply.code(404).send('Las pantallas todavía no están armadas. Corré: npm run build');
  });

  if (dirWeb && fs.existsSync(dirWeb)) {
    app.register(fastifyStatic, { root: dirWeb, wildcard: false });
  }
  return app;
}
