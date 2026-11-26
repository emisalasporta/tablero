// Arma el servidor: las rutas /api y las pantallas ya construidas (dist/web).
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { Archivos } from './archivos.ts';
import { identificar } from './nucleo.ts';
import { contexto, leerTablero, puedeVerTablero } from './permisos.ts';
import { rutasContenido } from './rutas/contenido.ts';
import { rutasCuenta } from './rutas/cuenta.ts';
import { rutasEspacios } from './rutas/espacios.ts';
import { rutasFotos } from './rutas/fotos.ts';
import { rutasImportar } from './rutas/importar.ts';
import { rutasPuerta } from './rutas/puerta.ts';
import { rutasMcp } from './mcp/puerta.ts';
import { rutasServidor, type ConfigDokploy } from './rutas/servidor.ts';
import { Respaldos, type ConfigExterno } from './respaldo.ts';
import { anotarError } from './registro.ts';
import { rutasTarjeta } from './rutas/tarjeta.ts';
import { rutasTableros } from './rutas/tableros.ts';
import { ErrorApi, noAutenticado, noExiste } from './util.ts';
import { leerVersion } from './version.ts';
import { Vivo } from './vivo.ts';

export interface Dependencias {
  db: DatabaseSync;
  zonaHoraria: string;
  dirWeb?: string;
  /** Carpeta donde se guardan los archivos subidos (adjuntos, fotos). */
  dirArchivos: string;
  /** Tope de cada adjunto, en MB. */
  maxAdjuntoMb?: number;
  /** Dirección pública de la app (https://…). Si falta, se deduce de cada pedido. */
  urlPublica?: string;
  /** Depósito para la copia del respaldo fuera del servidor. Sin esto, el respaldo queda solo en el servidor. */
  externo?: ConfigExterno | null;
  /** Acceso a Dokploy, para ver publicaciones y volver a publicar. */
  dokploy?: ConfigDokploy | null;
  /** Con qué se hacen los pedidos hacia afuera (las pruebas lo reemplazan por uno de mentira). */
  pedirAfuera?: typeof fetch;
}

declare module 'fastify' {
  interface FastifyInstance { /** Todas las rutas registradas, como "GET /api/salud". La usa la prueba de cobertura de la puerta de Alex. */ rutas: string[]; respaldos: Respaldos }
}

export function crearApp({ db, zonaHoraria, dirWeb, dirArchivos, maxAdjuntoMb, urlPublica, externo, dokploy, pedirAfuera }: Dependencias): FastifyInstance {
  // trustProxy: la app corre detrás del proxy de Dokploy y de Cloudflare; así sabe si el pedido original vino por HTTPS.
  const app = Fastify({ logger: false, trustProxy: true, bodyLimit: 1024 * 1024 });
  const version = leerVersion();

  app.decorate('rutas', [] as string[]);
  app.addHook('onRoute', (r) => {
    for (const m of Array.isArray(r.method) ? r.method : [r.method]) if (m !== 'HEAD' && m !== 'OPTIONS') app.rutas.push(`${m} ${r.url}`);
  });

  app.decorateRequest('usuario', null);
  app.decorateRequest('sesionId', null);
  app.decorateRequest('llaveId', null);
  app.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/mcp')) identificar(db, req);
  });

  // Todos los errores salen con la misma forma: { error: código, mensaje: texto para la persona }.
  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, _req, reply) => {
    if (err instanceof ErrorApi) return reply.code(err.estado).send({ error: err.codigo, mensaje: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'pedido_invalido', mensaje: 'El pedido no tiene el formato esperado.' });
    anotarError(`${_req.method} ${_req.url.split('?')[0]}`, err);
    return reply.code(500).send({ error: 'interno', mensaje: 'Algo falló del lado del servidor. Probá de nuevo.' });
  });

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

  // Los archivos subidos llegan "crudos" y se pasan tal cual a la ruta, que los va guardando en disco.
  app.addContentTypeParser('application/octet-stream', (_req, cuerpo, listo) => listo(null, cuerpo));
  // El estándar de permisos (OAuth) manda sus datos como formulario.
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, cuerpo, listo) => listo(null, Object.fromEntries(new URLSearchParams(cuerpo as string))));
  const archivos = new Archivos(dirArchivos, maxAdjuntoMb);
  archivos.barrer(db);

  rutasCuenta(app, db);
  rutasEspacios(app, db, archivos);
  const vivo = new Vivo(db);
  app.addHook('onClose', async () => vivo.cerrar());
  rutasTableros(app, db, vivo, archivos);
  const ayuda = rutasContenido(app, db, vivo, archivos);
  rutasTarjeta(app, db, vivo, archivos, ayuda);
  rutasFotos(app, db, archivos);
  rutasImportar(app, db, zonaHoraria);
  rutasPuerta(app, db, urlPublica);
  rutasMcp(app, urlPublica);
  const respaldos = new Respaldos(db, path.dirname(dirArchivos), zonaHoraria, externo ?? null, pedirAfuera);
  app.decorate('respaldos', respaldos);
  app.addHook('onClose', async () => respaldos.parar());
  rutasServidor(app, respaldos, dokploy ?? null, pedirAfuera);

  // Línea en vivo de un tablero. Solo se abre si la persona puede ver ese tablero.
  app.register(fastifyWebsocket, { options: { maxPayload: 4096 } });
  app.register(async (f) => {
    f.get('/api/tableros/:id/vivo', {
      websocket: true,
      preValidation: async (req) => {
        const t = leerTablero(db, (req.params as { id: string }).id);
        if (!t) throw noExiste();
        if (!puedeVerTablero(contexto(db, req.usuario, t.espacio_id, t.id), t)) throw req.usuario ? noExiste() : noAutenticado();
      },
    }, (socket, req) => {
      const t = leerTablero(db, (req.params as { id: string }).id);
      if (!t) return socket.close(4404, 'no existe');
      vivo.entrar(t.id, socket, req.usuario?.id ?? null);
    });
  });

  app.setNotFoundHandler(async (req, reply) => {
    if (/^\/(api|mcp|oauth\/(token|registro)|\.well-known)(\/|$|\?)/.test(req.url)) return reply.code(404).send({ error: 'no_existe', mensaje: 'Esa dirección no existe.' });
    // Cualquier otra dirección la resuelve la pantalla (para que /t/xxxx funcione al recargar).
    if (dirWeb && fs.existsSync(path.join(dirWeb, 'index.html'))) return reply.sendFile('index.html', dirWeb);
    return reply.code(404).send('Las pantallas todavía no están armadas. Corré: npm run build');
  });

  if (dirWeb && fs.existsSync(dirWeb)) {
    app.register(fastifyStatic, { root: dirWeb, wildcard: false });
  }
  return app;
}
