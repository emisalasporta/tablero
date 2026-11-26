// Lo que va adentro de un tablero: listas y tarjetas. Crear, renombrar, ordenar, mover, copiar y archivar.
// Cada cambio revisa el permiso, queda en la actividad y se avisa en vivo a quienes miran el tablero.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { exigirUsuario, registrarActividad } from '../nucleo.ts';
import { contexto, leerEspacio, leerTablero, puedeEditarTablero, puedeVerTablero } from '../permisos.ts';
import type { Tablero, Usuario } from '../permisos.ts';
import { ahora, datoInvalido, ErrorApi, noAutenticado, noExiste, nuevoEnlace, nuevoId, opcion, sinPermiso, texto, textoOpcional } from '../util.ts';
import type { Vivo } from '../vivo.ts';
import type { Archivos } from '../archivos.ts';

/** Separación entre posiciones vecinas. */
export const SALTO = 65536;
/** Los diez tonos de color de etiquetas y portadas. Cada etiqueta usa un tono en tres intensidades: "azul-1", "azul-2", "azul-3". */
export const TONOS = ['rojo', 'naranja', 'amarillo', 'lima', 'verde', 'turquesa', 'celeste', 'azul', 'violeta', 'rosa'] as const;
/** Si dos vecinos quedan más cerca que esto, se vuelve a numerar todo el grupo con separación pareja. */
const MINIMO = 0.001;
const MAX_TITULO = 16384;
const MAX_TARJETAS_POR_PEDIDO = 100;

export interface Lista { id: string; tablero_id: string; nombre: string; posicion: number; archivada: number; creada_por: string | null; creada_en: string }
export interface Tarjeta {
  id: string; enlace: string; numero: number; tablero_id: string; lista_id: string; titulo: string; descripcion: string; posicion: number; archivada: number; creada_por: string | null; creada_en: string;
  inicio: string | null; vence: string | null; completada: number; portada: string;
  // Calculados al leer (ver SEL_TARJETA): lo que el frente de la tarjeta necesita para sus insignias.
  etiquetas: string | null; miembros: string | null; n_comentarios: number; n_adjuntos: number; n_items: number; n_hechos: number;
}
export interface Portada { color: string | null; adjunto: string | null; tamano: 'media' | 'completa'; tono: 'claro' | 'oscuro' }
export interface Etiqueta { id: string; tablero_id: string; nombre: string; color: string; creada_en: string }

/** Lectura de tarjetas con sus cuentas (comentarios, adjuntos, ítems) y los ids de sus etiquetas y miembros. */
export const SEL_TARJETA = `SELECT c.*,
  (SELECT group_concat(etiqueta_id) FROM tarjeta_etiquetas WHERE tarjeta_id = c.id) AS etiquetas,
  (SELECT group_concat(usuario_id) FROM tarjeta_miembros WHERE tarjeta_id = c.id) AS miembros,
  (SELECT count(*) FROM comentarios WHERE tarjeta_id = c.id) AS n_comentarios,
  (SELECT count(*) FROM adjuntos WHERE tarjeta_id = c.id) AS n_adjuntos,
  (SELECT count(*) FROM checklist_items i JOIN checklists k ON k.id = i.checklist_id WHERE k.tarjeta_id = c.id) AS n_items,
  (SELECT count(*) FROM checklist_items i JOIN checklists k ON k.id = i.checklist_id WHERE k.tarjeta_id = c.id AND i.hecho = 1) AS n_hechos
  FROM tarjetas c`;
export const leerPortada = (texto: string): Portada | null => { try { return texto ? (JSON.parse(texto) as Portada) : null; } catch { return null; } };
export const frenteEtiqueta = (e: Etiqueta) => ({ id: e.id, nombre: e.nombre, color: e.color });

export const frenteLista = (l: Lista) => ({ id: l.id, tablero_id: l.tablero_id, nombre: l.nombre, posicion: l.posicion, archivada: l.archivada === 1 });
export const frenteTarjeta = (t: Tarjeta) => ({
  id: t.id, enlace: t.enlace, numero: t.numero, tablero_id: t.tablero_id, lista_id: t.lista_id, titulo: t.titulo,
  posicion: t.posicion, archivada: t.archivada === 1, tiene_descripcion: t.descripcion !== '', creada_en: t.creada_en,
  inicio: t.inicio, vence: t.vence, completada: t.completada === 1, portada: leerPortada(t.portada),
  etiquetas: t.etiquetas ? t.etiquetas.split(',') : [], miembros: t.miembros ? t.miembros.split(',') : [],
  n_comentarios: t.n_comentarios, n_adjuntos: t.n_adjuntos, n_items: t.n_items, n_hechos: t.n_hechos,
});

/** Listas y tarjetas a la vista de un tablero (sin lo archivado), ya ordenadas. */
export function contenidoTablero(db: DatabaseSync, tableroId: string) {
  const listas = db.prepare('SELECT * FROM listas WHERE tablero_id = ? AND archivada = 0 ORDER BY posicion, id').all(tableroId) as unknown as Lista[];
  const tarjetas = db.prepare(`${SEL_TARJETA} JOIN listas l ON l.id = c.lista_id
                               WHERE c.tablero_id = ? AND c.archivada = 0 AND l.archivada = 0 ORDER BY c.posicion, c.id`).all(tableroId) as unknown as Tarjeta[];
  const etiquetas = db.prepare('SELECT * FROM etiquetas WHERE tablero_id = ? ORDER BY creada_en, id').all(tableroId) as unknown as Etiqueta[];
  return { listas: listas.map(frenteLista), tarjetas: tarjetas.map(frenteTarjeta), etiquetas: etiquetas.map(frenteEtiqueta) };
}

export type Grupo = { tabla: 'listas'; columna: 'tablero_id' } | { tabla: 'tarjetas'; columna: 'lista_id' } | { tabla: 'checklists'; columna: 'tarjeta_id' }
  | { tabla: 'checklist_items'; columna: 'checklist_id' } | { tabla: 'adjuntos'; columna: 'tarjeta_id' };
const LISTAS: Grupo = { tabla: 'listas', columna: 'tablero_id' };
const TARJETAS: Grupo = { tabla: 'tarjetas', columna: 'lista_id' };
/** Qué se lleva una copia de tarjeta. Lo que no se nombra, se conserva. */
export type Conservar = Partial<Record<'descripcion' | 'etiquetas' | 'miembros' | 'checklists' | 'adjuntos', unknown>>;
export type Ayuda = ReturnType<typeof rutasContenido>;

export function rutasContenido(app: FastifyInstance, db: DatabaseSync, vivo: Vivo, archivos: Archivos) {
  const origen = (req: FastifyRequest): string | null => {
    const v = req.headers['x-cliente'];
    return typeof v === 'string' && v.length <= 40 ? v : null;
  };
  const enTransaccion = <T>(f: () => T): T => {
    db.exec('BEGIN');
    try { const r = f(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  const leerLista = (id: string) => db.prepare('SELECT * FROM listas WHERE id = ?').get(id) as unknown as Lista | undefined;
  const leerTarjeta = (idOEnlace: string) => db.prepare(`${SEL_TARJETA} WHERE c.id = ? OR c.enlace = ?`).get(idOEnlace, idOEnlace) as unknown as Tarjeta | undefined;
  const tarjetasDe = (listaId: string, conArchivadas = false) =>
    db.prepare(`${SEL_TARJETA} WHERE c.lista_id = ? ${conArchivadas ? '' : 'AND c.archivada = 0'} ORDER BY c.posicion, c.id`).all(listaId) as unknown as Tarjeta[];

  // ---------- permisos ----------
  /** Tablero que la persona puede ver. Si no puede, se responde como si no existiera. */
  function tableroVisible(id: string, u: Usuario | null, ocultar = true) {
    const t = leerTablero(db, id);
    if (!t) throw noExiste();
    const e = leerEspacio(db, t.espacio_id)!;
    const c = contexto(db, u, e.id, t.id);
    if (!puedeVerTablero(c, t)) {
      if (ocultar) throw noExiste();
      if (!u) throw noAutenticado();
      throw new ErrorApi(403, 'sin_acceso', 'No tenés acceso a este tablero. Podés pedirlo.');
    }
    return { t, e, c };
  }
  function tableroEditable(id: string, u: Usuario, mensaje = 'No podés editar este tablero.'): Tablero {
    const { t, c } = tableroVisible(id, u);
    if (!puedeEditarTablero(c, t)) throw sinPermiso(t.cerrado ? 'El tablero está cerrado: se puede ver pero no editar.' : mensaje);
    return t;
  }
  function listaEditable(id: string, u: Usuario) {
    const l = leerLista(id);
    if (!l) throw noExiste();
    return { l, t: tableroEditable(l.tablero_id, u) };
  }
  function tarjetaEditable(id: string, u: Usuario) {
    const c = leerTarjeta(id);
    if (!c) throw noExiste();
    return { c, t: tableroEditable(c.tablero_id, u) };
  }

  // ---------- fechas y portada ----------
  function dia(v: unknown, campo: string): string {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw datoInvalido(`${campo} tiene que ser un día, como 2026-11-30.`);
    return v;
  }
  function momento(v: unknown, campo: string): string {
    const ms = typeof v === 'string' ? Date.parse(v) : NaN;
    if (Number.isNaN(ms)) throw datoInvalido(`${campo} tiene que ser una fecha y hora.`);
    return new Date(ms).toISOString();
  }
  function validarPortada(v: unknown, tarjetaId: string): string {
    if (v === null) return '';
    if (typeof v !== 'object') throw datoInvalido('La portada no tiene el formato esperado.');
    const p = v as Record<string, unknown>;
    const color = p.color == null ? null : opcion(p.color, 'el color de la portada', TONOS);
    const adjunto = typeof p.adjunto === 'string' ? p.adjunto : null;
    if (!color && !adjunto) return '';
    if (adjunto) {
      const a = db.prepare('SELECT mime FROM adjuntos WHERE id = ? AND tarjeta_id = ?').get(adjunto, tarjetaId) as { mime: string } | undefined;
      if (!a || !a.mime.startsWith('image/')) throw datoInvalido('La portada tiene que ser una imagen adjunta a esta tarjeta.');
    }
    const portada: Portada = { color: adjunto ? null : color, adjunto, tamano: p.tamano === 'completa' ? 'completa' : 'media', tono: p.tono === 'claro' ? 'claro' : 'oscuro' };
    return JSON.stringify(portada);
  }

  // ---------- posiciones ----------
  /** Convierte lo pedido ("arriba", "abajo" o un número) en la posición a guardar dentro de un grupo. */
  function resolverPosicion(g: Grupo, contenedorId: string, pedido: unknown, exceptoId = ''): number {
    if (typeof pedido === 'number') {
      if (!Number.isFinite(pedido) || pedido <= 0) throw datoInvalido('La posición tiene que ser un número mayor que cero.');
      return pedido;
    }
    if (pedido !== undefined && pedido !== 'arriba' && pedido !== 'abajo') throw datoInvalido('La posición tiene que ser "arriba", "abajo" o un número.');
    const f = db.prepare(`SELECT min(posicion) AS menor, max(posicion) AS mayor FROM ${g.tabla} WHERE ${g.columna} = ? AND id <> ?`).get(contenedorId, exceptoId) as { menor: number | null; mayor: number | null };
    if (f.mayor === null || f.menor === null) return SALTO;
    return pedido === 'arriba' ? f.menor / 2 : f.mayor + SALTO;
  }
  /** Si dos vecinos quedaron pegados (o iguales), vuelve a numerar el grupo parejo. Devuelve si lo hizo. */
  function acomodar(g: Grupo, contenedorId: string): boolean {
    const filas = db.prepare(`SELECT id, posicion FROM ${g.tabla} WHERE ${g.columna} = ? ORDER BY posicion, id`).all(contenedorId) as { id: string; posicion: number }[];
    let pegados = filas.length > 0 && filas[0].posicion < MINIMO;
    for (let i = 1; i < filas.length && !pegados; i++) pegados = filas[i].posicion - filas[i - 1].posicion < MINIMO;
    if (!pegados) return false;
    const cambiar = db.prepare(`UPDATE ${g.tabla} SET posicion = ? WHERE id = ?`);
    filas.forEach((f, i) => cambiar.run((i + 1) * SALTO, f.id));
    return true;
  }
  function siguienteNumero(tableroId: string): number {
    return (db.prepare('UPDATE tableros SET ultimo_numero = ultimo_numero + 1 WHERE id = ? RETURNING ultimo_numero').get(tableroId) as { ultimo_numero: number }).ultimo_numero;
  }
  function insertarTarjeta(t: Tablero, listaId: string, titulo: string, descripcion: string, posicion: number, autorId: string): string {
    const id = nuevoId();
    db.prepare('INSERT INTO tarjetas (id, enlace, numero, tablero_id, lista_id, titulo, descripcion, posicion, creada_por, creada_en) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id, nuevoEnlace(), siguienteNumero(t.id), t.id, listaId, titulo, descripcion, posicion, autorId, ahora());
    return id;
  }

  /** Al pasar a otro tablero: las etiquetas se buscan (o se crean) allá por nombre y color, y quedan solo los miembros que también están allá. */
  function adaptarATablero(tarjetaId: string, destinoId: string) {
    const puestas = db.prepare('SELECT e.* FROM tarjeta_etiquetas te JOIN etiquetas e ON e.id = te.etiqueta_id WHERE te.tarjeta_id = ?').all(tarjetaId) as unknown as Etiqueta[];
    for (const e of puestas) {
      if (e.tablero_id === destinoId) continue;
      let alla = (db.prepare('SELECT id FROM etiquetas WHERE tablero_id = ? AND nombre = ? AND color = ?').get(destinoId, e.nombre, e.color) as { id: string } | undefined)?.id;
      if (!alla) { alla = nuevoId(); db.prepare('INSERT INTO etiquetas (id, tablero_id, nombre, color, creada_en) VALUES (?,?,?,?,?)').run(alla, destinoId, e.nombre, e.color, ahora()); }
      db.prepare('DELETE FROM tarjeta_etiquetas WHERE tarjeta_id = ? AND etiqueta_id = ?').run(tarjetaId, e.id);
      db.prepare('INSERT OR IGNORE INTO tarjeta_etiquetas (tarjeta_id, etiqueta_id) VALUES (?,?)').run(tarjetaId, alla);
    }
    db.prepare('DELETE FROM tarjeta_miembros WHERE tarjeta_id = ? AND usuario_id NOT IN (SELECT usuario_id FROM tablero_miembros WHERE tablero_id = ?)').run(tarjetaId, destinoId);
  }
  /** Copia a la tarjeta nueva lo de adentro de la original: fechas, portada, etiquetas, miembros, checklists y adjuntos. */
  function copiarInterior(de: Tarjeta, aId: string, destinoId: string, conservar: Conservar = {}) {
    const adjuntos = conservar.adjuntos !== false;
    const mapa = new Map<string, string>();
    if (adjuntos) {
      const filas = db.prepare('SELECT * FROM adjuntos WHERE tarjeta_id = ?').all(de.id) as { id: string; tipo: string; nombre: string; url: string; mime: string; tamano: number; posicion: number; creado_por: string | null }[];
      for (const f of filas) {
        const id = nuevoId();
        if (f.tipo === 'archivo') { try { archivos.copiarAdjunto(f.id, id); } catch { continue; } }
        mapa.set(f.id, id);
        db.prepare('INSERT INTO adjuntos (id, tarjeta_id, tipo, nombre, url, mime, tamano, posicion, creado_por, creado_en) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, aId, f.tipo, f.nombre, f.url, f.mime, f.tamano, f.posicion, f.creado_por, ahora());
      }
    }
    // La portada se conserva si es un color, o si su imagen también se copió.
    const portada = leerPortada(de.portada);
    const nueva = !portada ? '' : portada.adjunto ? (mapa.has(portada.adjunto) ? JSON.stringify({ ...portada, adjunto: mapa.get(portada.adjunto) }) : '') : de.portada;
    db.prepare('UPDATE tarjetas SET inicio = ?, vence = ?, completada = ?, portada = ? WHERE id = ?').run(de.inicio, de.vence, de.completada, nueva, aId);
    if (conservar.etiquetas !== false) db.prepare('INSERT INTO tarjeta_etiquetas (tarjeta_id, etiqueta_id) SELECT ?, etiqueta_id FROM tarjeta_etiquetas WHERE tarjeta_id = ?').run(aId, de.id);
    if (conservar.miembros !== false) db.prepare('INSERT INTO tarjeta_miembros (tarjeta_id, usuario_id) SELECT ?, usuario_id FROM tarjeta_miembros WHERE tarjeta_id = ?').run(aId, de.id);
    if (conservar.checklists !== false) {
      for (const k of db.prepare('SELECT * FROM checklists WHERE tarjeta_id = ?').all(de.id) as { id: string; nombre: string; posicion: number }[]) {
        const id = nuevoId();
        db.prepare('INSERT INTO checklists (id, tarjeta_id, nombre, posicion, creada_en) VALUES (?,?,?,?,?)').run(id, aId, k.nombre, k.posicion, ahora());
        copiarItems(k.id, id, true);
      }
    }
    if (de.tablero_id !== destinoId) adaptarATablero(aId, destinoId);
  }
  /** Copia los ítems de una checklist a otra. `conEstado`: conserva tildes, asignados y fechas. */
  function copiarItems(deId: string, aId: string, conEstado: boolean) {
    for (const i of db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY posicion, id').all(deId) as { texto: string; hecho: number; posicion: number; asignado_id: string | null; vence: string | null }[]) {
      db.prepare('INSERT INTO checklist_items (id, checklist_id, texto, hecho, posicion, asignado_id, vence, creado_en) VALUES (?,?,?,?,?,?,?,?)')
        .run(nuevoId(), aId, i.texto, conEstado ? i.hecho : 0, i.posicion, conEstado ? i.asignado_id : null, conEstado ? i.vence : null, ahora());
    }
  }

  // ---------- avisos en vivo ----------
  const avisar = (tableroId: string, req: FastifyRequest, cambio: { listas?: Lista[]; tarjetas?: Tarjeta[] }) =>
    vivo.emitir(tableroId, { tipo: 'cambio', listas: (cambio.listas ?? []).map(frenteLista), tarjetas: (cambio.tarjetas ?? []).map(frenteTarjeta) }, origen(req));
  /** Tarjetas a avisar: toda la lista si hubo que volver a numerarla; si no, solo las tocadas. */
  const tocadas = (listaId: string, renumerada: boolean, ids: string[]): Tarjeta[] =>
    renumerada ? tarjetasDe(listaId, true) : ids.map((id) => leerTarjeta(id)!);

  // =====================================================================
  // LISTAS
  // =====================================================================
  app.post('/api/tableros/:id/listas', async (req, reply) => {
    const u = exigirUsuario(req);
    const t = tableroEditable((req.params as { id: string }).id, u);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const nombre = texto(b.nombre, 'el nombre de la lista', { max: MAX_TITULO });
    const id = nuevoId();
    const renumerada = enTransaccion(() => {
      db.prepare('INSERT INTO listas (id, tablero_id, nombre, posicion, creada_por, creada_en) VALUES (?,?,?,?,?,?)').run(id, t.id, nombre, resolverPosicion(LISTAS, t.id, b.posicion), u.id, ahora());
      registrarActividad(db, 'lista_creada', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, datos: { lista_id: id, nombre } });
      return acomodar(LISTAS, t.id);
    });
    const lista = leerLista(id)!;
    avisar(t.id, req, { listas: renumerada ? (db.prepare('SELECT * FROM listas WHERE tablero_id = ?').all(t.id) as unknown as Lista[]) : [lista] });
    return reply.code(201).send({ lista: frenteLista(lista) });
  });

  // Renombrar, reordenar, archivar/restaurar o mandar la lista a otro tablero.
  app.patch('/api/listas/:id', async (req) => {
    const u = exigirUsuario(req);
    const { l, t } = listaEditable((req.params as { id: string }).id, u);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const nombre = b.nombre === undefined ? l.nombre : texto(b.nombre, 'el nombre de la lista', { max: MAX_TITULO });
    const archivada = b.archivada === undefined ? l.archivada : b.archivada ? 1 : 0;
    const destino = typeof b.tablero_id === 'string' && b.tablero_id !== t.id ? tableroEditable(b.tablero_id, u, 'No podés editar el tablero de destino.') : t;
    const cambiaTablero = destino.id !== t.id;
    const renumerada = enTransaccion(() => {
      const posicion = cambiaTablero || b.posicion !== undefined ? resolverPosicion(LISTAS, destino.id, b.posicion, l.id) : l.posicion;
      db.prepare('UPDATE listas SET nombre = ?, archivada = ?, posicion = ?, tablero_id = ? WHERE id = ?').run(nombre, archivada, posicion, destino.id, l.id);
      if (cambiaTablero) {
        // Las tarjetas viajan con la lista y reciben número nuevo en el tablero de destino.
        const renumerar = db.prepare('UPDATE tarjetas SET tablero_id = ?, numero = ? WHERE id = ?');
        for (const c of tarjetasDe(l.id, true)) { renumerar.run(destino.id, siguienteNumero(destino.id), c.id); adaptarATablero(c.id, destino.id); }
        const datos = { lista_id: l.id, nombre, de_tablero: { id: t.id, nombre: t.nombre }, a_tablero: { id: destino.id, nombre: destino.nombre } };
        registrarActividad(db, 'lista_movida', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, datos });
        registrarActividad(db, 'lista_movida', u.id, { espacio_id: destino.espacio_id, tablero_id: destino.id, datos });
      }
      if (nombre !== l.nombre) registrarActividad(db, 'lista_renombrada', u.id, { espacio_id: destino.espacio_id, tablero_id: destino.id, datos: { lista_id: l.id, antes: l.nombre, ahora: nombre } });
      if (archivada !== l.archivada) registrarActividad(db, archivada ? 'lista_archivada' : 'lista_restaurada', u.id, { espacio_id: destino.espacio_id, tablero_id: destino.id, datos: { lista_id: l.id, nombre } });
      return acomodar(LISTAS, destino.id);
    });
    const lista = leerLista(l.id)!;
    const listas = renumerada ? (db.prepare('SELECT * FROM listas WHERE tablero_id = ?').all(destino.id) as unknown as Lista[]) : [lista];
    // Al restaurar o al llegar a otro tablero, las pantallas necesitan también sus tarjetas.
    const conTarjetas = cambiaTablero || (l.archivada === 1 && archivada === 0);
    avisar(destino.id, req, { listas, tarjetas: conTarjetas ? tarjetasDe(l.id) : [] });
    if (cambiaTablero) { avisar(t.id, req, { listas: [lista] }); vivo.emitir(destino.id, { tipo: 'tablero' }); }
    return { lista: frenteLista(lista) };
  });

  // Copia la lista con sus tarjetas, al lado de la original.
  app.post('/api/listas/:id/copiar', async (req, reply) => {
    const u = exigirUsuario(req);
    const { l, t } = listaEditable((req.params as { id: string }).id, u);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const nombre = b.nombre === undefined ? l.nombre : texto(b.nombre, 'el nombre de la lista', { max: MAX_TITULO });
    const id = nuevoId();
    const renumerada = enTransaccion(() => {
      const sig = db.prepare('SELECT min(posicion) AS p FROM listas WHERE tablero_id = ? AND posicion > ?').get(t.id, l.posicion) as { p: number | null };
      const posicion = sig.p === null ? l.posicion + SALTO : (l.posicion + sig.p) / 2;
      db.prepare('INSERT INTO listas (id, tablero_id, nombre, posicion, creada_por, creada_en) VALUES (?,?,?,?,?,?)').run(id, t.id, nombre, posicion, u.id, ahora());
      for (const c of tarjetasDe(l.id)) copiarInterior(c, insertarTarjeta(t, id, c.titulo, c.descripcion, c.posicion, u.id), t.id);
      registrarActividad(db, 'lista_copiada', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, datos: { lista_id: id, nombre, de: { id: l.id, nombre: l.nombre } } });
      return acomodar(LISTAS, t.id);
    });
    const lista = leerLista(id)!;
    const tarjetas = tarjetasDe(id);
    avisar(t.id, req, { listas: renumerada ? (db.prepare('SELECT * FROM listas WHERE tablero_id = ?').all(t.id) as unknown as Lista[]) : [lista], tarjetas });
    return reply.code(201).send({ lista: frenteLista(lista), tarjetas: tarjetas.map(frenteTarjeta) });
  });

  // Pasa todas las tarjetas de una lista al final de otra lista del mismo tablero.
  app.post('/api/listas/:id/mover-tarjetas', async (req) => {
    const u = exigirUsuario(req);
    const { l, t } = listaEditable((req.params as { id: string }).id, u);
    const destino = leerLista(texto(((req.body ?? {}) as Record<string, unknown>).lista_id, 'la lista de destino'));
    if (!destino || destino.tablero_id !== t.id || destino.archivada) throw datoInvalido('La lista de destino tiene que ser una lista a la vista de este mismo tablero.');
    if (destino.id === l.id) return { tarjetas: [] };
    const movidas = tarjetasDe(l.id);
    enTransaccion(() => {
      const mover = db.prepare('UPDATE tarjetas SET lista_id = ?, posicion = ? WHERE id = ?');
      for (const c of movidas) mover.run(destino.id, resolverPosicion(TARJETAS, destino.id, 'abajo'), c.id);
      if (movidas.length) registrarActividad(db, 'lista_tarjetas_movidas', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, datos: { de_lista: { id: l.id, nombre: l.nombre }, a_lista: { id: destino.id, nombre: destino.nombre }, cantidad: movidas.length } });
    });
    const tarjetas = movidas.map((c) => leerTarjeta(c.id)!);
    avisar(t.id, req, { tarjetas });
    return { tarjetas: tarjetas.map(frenteTarjeta) };
  });

  app.post('/api/listas/:id/archivar-tarjetas', async (req) => {
    const u = exigirUsuario(req);
    const { l, t } = listaEditable((req.params as { id: string }).id, u);
    const antes = tarjetasDe(l.id);
    enTransaccion(() => {
      db.prepare('UPDATE tarjetas SET archivada = 1 WHERE lista_id = ? AND archivada = 0').run(l.id);
      if (antes.length) registrarActividad(db, 'lista_tarjetas_archivadas', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, datos: { lista_id: l.id, nombre: l.nombre, cantidad: antes.length } });
    });
    const tarjetas = antes.map((c) => leerTarjeta(c.id)!);
    avisar(t.id, req, { tarjetas });
    return { tarjetas: tarjetas.map(frenteTarjeta) };
  });

  // Ordena las tarjetas de la lista y deja ese orden guardado.
  app.post('/api/listas/:id/ordenar', async (req) => {
    const u = exigirUsuario(req);
    const { l, t } = listaEditable((req.params as { id: string }).id, u);
    const por = opcion(((req.body ?? {}) as Record<string, unknown>).por, 'el orden', ['nombre', 'nuevas', 'viejas', 'vence'] as const);
    // Por vencimiento: primero lo que vence antes; lo que no tiene fecha queda al final.
    const orden = { nombre: 'titulo COLLATE NOCASE, posicion', nuevas: 'creada_en DESC, numero DESC', viejas: 'creada_en, numero', vence: 'vence IS NULL, vence, posicion' }[por];
    enTransaccion(() => {
      const ids = db.prepare(`SELECT id FROM tarjetas WHERE lista_id = ? ORDER BY archivada, ${orden}`).all(l.id) as { id: string }[];
      const poner = db.prepare('UPDATE tarjetas SET posicion = ? WHERE id = ?');
      ids.forEach((f, i) => poner.run((i + 1) * SALTO, f.id));
      registrarActividad(db, 'lista_ordenada', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, datos: { lista_id: l.id, nombre: l.nombre, por } });
    });
    const tarjetas = tarjetasDe(l.id);
    avisar(t.id, req, { tarjetas });
    return { tarjetas: tarjetas.map(frenteTarjeta) };
  });

  // =====================================================================
  // TARJETAS
  // =====================================================================
  // Crea una tarjeta, o varias de una vez si llega `titulos` (una por renglón pegado).
  app.post('/api/listas/:id/tarjetas', async (req, reply) => {
    const u = exigirUsuario(req);
    const { l, t } = listaEditable((req.params as { id: string }).id, u);
    if (l.archivada) throw new ErrorApi(409, 'lista_archivada', 'Esa lista está archivada. Restaurala para agregarle tarjetas.');
    const b = (req.body ?? {}) as Record<string, unknown>;
    const crudos = Array.isArray(b.titulos) ? b.titulos : [b.titulo];
    if (crudos.length === 0) throw datoInvalido('Falta el título de la tarjeta.');
    if (crudos.length > MAX_TARJETAS_POR_PEDIDO) throw datoInvalido(`Se pueden crear hasta ${MAX_TARJETAS_POR_PEDIDO} tarjetas por vez.`);
    const titulos = crudos.map((v) => texto(v, 'el título de la tarjeta', { max: MAX_TITULO }));
    const descripcion = textoOpcional(b.descripcion, 'la descripción', 16384) ?? '';
    const ids: string[] = [];
    const renumerada = enTransaccion(() => {
      // El grupo entra junto y en el orden recibido, en el hueco que corresponde.
      let desde: number;
      let paso: number;
      const n = titulos.length;
      if (b.posicion === 'arriba') {
        const menor = (db.prepare('SELECT min(posicion) AS p FROM tarjetas WHERE lista_id = ?').get(l.id) as { p: number | null }).p;
        paso = menor === null ? SALTO : menor / (n + 1);
        desde = paso;
      } else if (typeof b.posicion === 'number') {
        desde = resolverPosicion(TARJETAS, l.id, b.posicion);
        const sig = (db.prepare('SELECT min(posicion) AS p FROM tarjetas WHERE lista_id = ? AND posicion > ?').get(l.id, desde) as { p: number | null }).p;
        paso = sig === null ? SALTO : (sig - desde) / n;
      } else {
        desde = resolverPosicion(TARJETAS, l.id, b.posicion);
        paso = SALTO;
      }
      titulos.forEach((titulo, i) => {
        const id = insertarTarjeta(t, l.id, titulo, descripcion, desde + paso * i, u.id);
        ids.push(id);
        registrarActividad(db, 'tarjeta_creada', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, tarjeta_id: id, datos: { titulo, lista: { id: l.id, nombre: l.nombre } } });
      });
      return acomodar(TARJETAS, l.id);
    });
    avisar(t.id, req, { tarjetas: tocadas(l.id, renumerada, ids) });
    const creadas = ids.map((id) => frenteTarjeta(leerTarjeta(id)!));
    return reply.code(201).send({ tarjeta: creadas[0], tarjetas: creadas });
  });

  // Editar título o descripción, mover (a otra posición, otra lista u otro tablero) y archivar/restaurar.
  app.patch('/api/tarjetas/:id', async (req) => {
    const u = exigirUsuario(req);
    const { c, t } = tarjetaEditable((req.params as { id: string }).id, u);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const titulo = b.titulo === undefined ? c.titulo : texto(b.titulo, 'el título de la tarjeta', { max: MAX_TITULO });
    const descripcion = textoOpcional(b.descripcion, 'la descripción', 16384) ?? c.descripcion;
    const archivada = b.archivada === undefined ? c.archivada : b.archivada ? 1 : 0;
    const completada = b.completada === undefined ? c.completada : b.completada ? 1 : 0;
    const inicio = b.inicio === undefined ? c.inicio : b.inicio === null ? null : dia(b.inicio, 'la fecha de inicio');
    const vence = b.vence === undefined ? c.vence : b.vence === null ? null : momento(b.vence, 'el vencimiento');
    const portada = b.portada === undefined ? c.portada : validarPortada(b.portada, c.id);
    const origenLista = leerLista(c.lista_id)!;
    let lista = origenLista;
    let destino = t;
    if (typeof b.lista_id === 'string' && b.lista_id !== c.lista_id) {
      const l = leerLista(b.lista_id);
      if (!l) throw datoInvalido('La lista de destino no existe.');
      if (l.tablero_id !== t.id) destino = tableroEditable(l.tablero_id, u, 'No podés editar el tablero de destino.');
      if (l.archivada) throw new ErrorApi(409, 'lista_archivada', 'La lista de destino está archivada.');
      lista = l;
    }
    const cambiaLista = lista.id !== c.lista_id;
    const cambiaTablero = destino.id !== t.id;
    const renumerada = enTransaccion(() => {
      const posicion = cambiaLista || b.posicion !== undefined ? resolverPosicion(TARJETAS, lista.id, b.posicion, c.id) : c.posicion;
      const numero = cambiaTablero ? siguienteNumero(destino.id) : c.numero;
      db.prepare('UPDATE tarjetas SET titulo = ?, descripcion = ?, archivada = ?, lista_id = ?, tablero_id = ?, numero = ?, posicion = ?, inicio = ?, vence = ?, completada = ?, portada = ? WHERE id = ?')
        .run(titulo, descripcion, archivada, lista.id, destino.id, numero, posicion, inicio, vence, completada, portada, c.id);
      if (cambiaTablero) adaptarATablero(c.id, destino.id);
      const base = { espacio_id: destino.espacio_id, tablero_id: destino.id, tarjeta_id: c.id };
      if (vence !== c.vence) registrarActividad(db, vence ? 'tarjeta_vence' : 'tarjeta_vence_quitada', u.id, { ...base, datos: { titulo, vence } });
      if (completada !== c.completada) registrarActividad(db, completada ? 'tarjeta_completada' : 'tarjeta_reabierta', u.id, { ...base, datos: { titulo } });
      if (titulo !== c.titulo) registrarActividad(db, 'tarjeta_renombrada', u.id, { ...base, datos: { antes: c.titulo, ahora: titulo } });
      if (descripcion !== c.descripcion) registrarActividad(db, 'tarjeta_descripcion', u.id, { ...base, datos: { titulo } });
      if (cambiaLista) {
        const datos: Record<string, unknown> = { titulo, de_lista: { id: origenLista.id, nombre: origenLista.nombre }, a_lista: { id: lista.id, nombre: lista.nombre } };
        if (cambiaTablero) { datos.de_tablero = { id: t.id, nombre: t.nombre }; datos.a_tablero = { id: destino.id, nombre: destino.nombre }; }
        registrarActividad(db, 'tarjeta_movida', u.id, { ...base, datos });
        if (cambiaTablero) registrarActividad(db, 'tarjeta_movida', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, tarjeta_id: c.id, datos });
      }
      if (archivada !== c.archivada) registrarActividad(db, archivada ? 'tarjeta_archivada' : 'tarjeta_restaurada', u.id, { ...base, datos: { titulo } });
      return acomodar(TARJETAS, lista.id);
    });
    const nueva = leerTarjeta(c.id)!;
    avisar(destino.id, req, { tarjetas: tocadas(lista.id, renumerada, [c.id]) });
    if (cambiaTablero) { avisar(t.id, req, { tarjetas: [nueva] }); vivo.emitir(destino.id, { tipo: 'tablero' }); }
    return { tarjeta: frenteTarjeta(nueva) };
  });

  app.post('/api/tarjetas/:id/copiar', async (req, reply) => {
    const u = exigirUsuario(req);
    const c = leerTarjeta((req.params as { id: string }).id);
    if (!c) throw noExiste();
    tableroVisible(c.tablero_id, u);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const lista = leerLista(typeof b.lista_id === 'string' ? b.lista_id : c.lista_id);
    if (!lista) throw datoInvalido('La lista de destino no existe.');
    if (lista.archivada) throw new ErrorApi(409, 'lista_archivada', 'La lista de destino está archivada.');
    const destino = tableroEditable(lista.tablero_id, u, 'No podés editar el tablero de destino.');
    const titulo = b.titulo === undefined ? c.titulo : texto(b.titulo, 'el título de la tarjeta', { max: MAX_TITULO });
    const conservar = (typeof b.conservar === 'object' && b.conservar !== null ? b.conservar : {}) as Conservar;
    let id = '';
    const renumerada = enTransaccion(() => {
      id = insertarTarjeta(destino, lista.id, titulo, conservar.descripcion === false ? '' : c.descripcion, resolverPosicion(TARJETAS, lista.id, b.posicion), u.id);
      copiarInterior(c, id, destino.id, conservar);
      registrarActividad(db, 'tarjeta_copiada', u.id, { espacio_id: destino.espacio_id, tablero_id: destino.id, tarjeta_id: id, datos: { titulo, de: { id: c.id, titulo: c.titulo }, lista: { id: lista.id, nombre: lista.nombre } } });
      return acomodar(TARJETAS, lista.id);
    });
    avisar(destino.id, req, { tarjetas: tocadas(lista.id, renumerada, [id]) });
    if (destino.id !== c.tablero_id) vivo.emitir(destino.id, { tipo: 'tablero' });
    return reply.code(201).send({ tarjeta: frenteTarjeta(leerTarjeta(id)!) });
  });

  // Borrar para siempre: solo lo que ya está archivado (así nada se borra por un toque sin querer).
  app.delete('/api/tarjetas/:id', async (req) => {
    const u = exigirUsuario(req);
    const { c, t } = tarjetaEditable((req.params as { id: string }).id, u);
    if (!c.archivada) throw new ErrorApi(409, 'no_archivada', 'Primero hay que archivar la tarjeta; después se puede borrar.');
    enTransaccion(() => {
      db.prepare('DELETE FROM tarjetas WHERE id = ?').run(c.id);
      registrarActividad(db, 'tarjeta_borrada', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, datos: { titulo: c.titulo } });
    });
    archivos.barrer(db);
    return { ok: true };
  });
  app.delete('/api/listas/:id', async (req) => {
    const u = exigirUsuario(req);
    const { l, t } = listaEditable((req.params as { id: string }).id, u);
    if (!l.archivada) throw new ErrorApi(409, 'no_archivada', 'Primero hay que archivar la lista; después se puede borrar.');
    enTransaccion(() => {
      db.prepare('DELETE FROM listas WHERE id = ?').run(l.id);
      registrarActividad(db, 'lista_borrada', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, datos: { nombre: l.nombre } });
    });
    archivos.barrer(db);
    return { ok: true };
  });

  // =====================================================================
  // ARCHIVADOS y destinos para mover
  // =====================================================================
  app.get('/api/tableros/:id/archivados', async (req) => {
    const { t } = tableroVisible((req.params as { id: string }).id, req.usuario, false);
    const listas = db.prepare('SELECT * FROM listas WHERE tablero_id = ? AND archivada = 1 ORDER BY nombre COLLATE NOCASE').all(t.id) as unknown as Lista[];
    const tarjetas = db.prepare(`${SEL_TARJETA.replace('FROM tarjetas c', ', l.nombre AS lista_nombre, l.archivada AS lista_archivada FROM tarjetas c')} JOIN listas l ON l.id = c.lista_id
                                 WHERE c.tablero_id = ? AND c.archivada = 1 ORDER BY c.titulo COLLATE NOCASE`).all(t.id) as unknown as (Tarjeta & { lista_nombre: string; lista_archivada: number })[];
    return { listas: listas.map(frenteLista), tarjetas: tarjetas.map((c) => ({ ...frenteTarjeta(c), lista_nombre: c.lista_nombre, lista_archivada: c.lista_archivada === 1 })) };
  });

  // Tableros donde puedo editar: sirve para elegir a dónde mover o copiar.
  app.get('/api/yo/tableros-editables', async (req) => {
    const u = exigirUsuario(req);
    const filas = db.prepare(`SELECT t.id, e.nombre AS espacio FROM tableros t JOIN espacios e ON e.id = t.espacio_id WHERE t.cerrado = 0
                              ORDER BY e.nombre COLLATE NOCASE, t.nombre COLLATE NOCASE`).all() as { id: string; espacio: string }[];
    const tableros = [];
    for (const f of filas) {
      const t = leerTablero(db, f.id)!;
      const c = contexto(db, u, t.espacio_id, t.id);
      if (puedeVerTablero(c, t) && puedeEditarTablero(c, t)) tableros.push({ id: t.id, enlace: t.enlace, nombre: t.nombre, espacio: f.espacio });
    }
    return { tableros };
  });

  return { origen, enTransaccion, leerLista, leerTarjeta, tableroVisible, tableroEditable, tarjetaEditable, resolverPosicion, acomodar, insertarTarjeta, copiarItems, avisar };
}
