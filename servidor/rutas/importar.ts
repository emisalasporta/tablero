// Traer tableros de afuera. Por ahora: la exportación JSON de Trello.
// El archivo llega crudo (igual que un adjunto) y se lee entero en memoria, con tope.
import type { FastifyInstance } from 'fastify';
import type { Readable } from 'node:stream';
import type { DatabaseSync } from 'node:sqlite';
import { importarTrello, yaImportado } from '../importar.ts';
import { exigirUsuario } from '../nucleo.ts';
import { contexto, leerEspacio, puedeCrearTablero, puedeVerEspacio, VIS_TABLERO } from '../permisos.ts';
import { datoInvalido, ErrorApi, noExiste, opcion, sinPermiso } from '../util.ts';

const MAX_IMPORTAR = 50 * 1024 * 1024;

export function rutasImportar(app: FastifyInstance, db: DatabaseSync, zona: string) {
  // Consulta: visibilidad (privado, espacio, publico), repetir=1 para traerlo aunque ya se haya importado,
  // emparejar=usuarioDeTrello:usuarioDeAca,otro:otro para decir a mano quién es quién.
  app.post('/api/espacios/:id/importar/trello', async (req, reply) => {
    const u = exigirUsuario(req);
    const e = leerEspacio(db, (req.params as { id: string }).id);
    if (!e) throw noExiste('Ese espacio no existe.');
    const c = contexto(db, u, e.id);
    if (!puedeVerEspacio(c, e)) throw noExiste('Ese espacio no existe.');
    const q = (req.query ?? {}) as Record<string, string | undefined>;
    const vis = q.visibilidad === undefined ? 'espacio' : opcion(q.visibilidad, 'la visibilidad', VIS_TABLERO);
    if (!puedeCrearTablero(c, e, vis)) throw sinPermiso('En este espacio no podés crear tableros con esa visibilidad.');

    const flujo = req.body as Readable | undefined;
    if (!flujo || typeof (flujo as Readable)[Symbol.asyncIterator] !== 'function') throw datoInvalido('Falta el archivo.');
    const partes: Buffer[] = [];
    let total = 0;
    for await (const trozo of flujo) {
      const b = Buffer.isBuffer(trozo) ? trozo : Buffer.from(trozo as string);
      total += b.length;
      if (total > MAX_IMPORTAR) throw new ErrorApi(413, 'muy_grande', 'El archivo supera el tope de 50 MB.');
      partes.push(b);
    }
    let json: unknown;
    try { json = JSON.parse(Buffer.concat(partes).toString('utf8').replace(/^﻿/, '')); } catch { throw datoInvalido('El archivo no se pudo leer: tiene que ser el JSON que exporta Trello.'); }

    const previo = yaImportado(db, json);
    if (previo && q.repetir !== '1') throw new ErrorApi(409, 'ya_importado', `Ese tablero ya se importó: es "${previo.nombre}". Si querés traerlo otra vez como un tablero nuevo, confirmalo.`);

    const emparejar: Record<string, string> = {};
    for (const par of (q.emparejar ?? '').split(',')) { const [de, a] = par.split(':').map((x) => x?.trim()); if (de && a) emparejar[de] = a; }
    return reply.code(201).send({ informe: importarTrello(db, json, { espacio: e, usuario: u, zona, visibilidad: vis, emparejar }) });
  });
}
