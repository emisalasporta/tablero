// La tarjeta por dentro: etiquetas, miembros, checklists, adjuntos, comentarios y actividad.
// Las fechas, la portada y "completada" son datos de la tarjeta y se cambian con PATCH /api/tarjetas/:id (contenido.ts).
// Cada cambio revisa el permiso, queda en la actividad y avisa en vivo: el frente de la tarjeta viaja de nuevo con sus insignias.
import fs from 'node:fs';
import type { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { tipoImagen, TIPOS_FOTO } from '../archivos.ts';
import type { Archivos } from '../archivos.ts';
import { exigirUsuario, fichaPublica, registrarActividad } from '../nucleo.ts';
import { puedeAdministrarTablero, puedeComentar } from '../permisos.ts';
import type { Tablero, Usuario } from '../permisos.ts';
import { ahora, datoInvalido, noExiste, nuevoId, opcion, sinPermiso, texto } from '../util.ts';
import type { Vivo } from '../vivo.ts';
import { frenteEtiqueta, frenteLista, frenteTarjeta, leerPortada, SALTO, TONOS } from './contenido.ts';
import type { Ayuda, Etiqueta, Grupo, Tarjeta } from './contenido.ts';

const CHECKLISTS: Grupo = { tabla: 'checklists', columna: 'tarjeta_id' };
const ITEMS: Grupo = { tabla: 'checklist_items', columna: 'checklist_id' };
const ADJUNTOS: Grupo = { tabla: 'adjuntos', columna: 'tarjeta_id' };
const MAX_TEXTO = 16384;
const MAX_ITEMS_POR_PEDIDO = 100;
export const COLORES_ETIQUETA = ['', ...TONOS.flatMap((t) => [`${t}-1`, `${t}-2`, `${t}-3`])];
/** Tipos que el navegador puede mostrar sin riesgo dentro de la app. Todo lo demás se baja como archivo. */
const SE_VE = /^(image\/(png|jpeg|gif|webp)|application\/pdf|audio\/[\w.+-]+|video\/[\w.+-]+|text\/plain)$/;

interface Checklist { id: string; tarjeta_id: string; nombre: string; posicion: number }
interface Item { id: string; checklist_id: string; texto: string; hecho: number; posicion: number; asignado_id: string | null; vence: string | null }
interface Adjunto { id: string; tarjeta_id: string; tipo: 'archivo' | 'enlace'; nombre: string; url: string; mime: string; tamano: number; posicion: number; creado_por: string | null; creado_en: string }
interface Comentario { id: string; tarjeta_id: string; autor_id: string | null; texto: string; creado_en: string; editado_en: string | null }

const frenteItem = (i: Item) => ({ id: i.id, checklist_id: i.checklist_id, texto: i.texto, hecho: i.hecho === 1, posicion: i.posicion, asignado_id: i.asignado_id, vence: i.vence });
const frenteAdjunto = (a: Adjunto) => ({ id: a.id, tipo: a.tipo, nombre: a.nombre, url: a.url, mime: a.mime, tamano: a.tamano, posicion: a.posicion, creado_en: a.creado_en, es_imagen: a.tipo === 'archivo' && a.mime.startsWith('image/'), se_ve: a.tipo === 'archivo' && SE_VE.test(a.mime) });

export function rutasTarjeta(app: FastifyInstance, db: DatabaseSync, vivo: Vivo, archivos: Archivos, a: Ayuda) {
  const id = (req: FastifyRequest, campo = 'id') => (req.params as Record<string, string>)[campo];
  const cuerpo = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;
  const ficha = (uid: string | null) => {
    const u = uid ? (db.prepare('SELECT id, usuario, nombre, iniciales, avatar, es_robot FROM usuarios WHERE id = ?').get(uid) as unknown as Usuario | undefined) : undefined;
    return u ? fichaPublica(u) : null;
  };
  const anotar = (tipo: string, u: Usuario, t: Tablero, c: Tarjeta, datos: Record<string, unknown> = {}) =>
    registrarActividad(db, tipo, u.id, { espacio_id: t.espacio_id, tablero_id: t.id, tarjeta_id: c.id, datos: { titulo: c.titulo, ...datos } });
  /** Cierra un cambio: vuelve a leer la tarjeta, avisa en vivo y arma la respuesta. */
  const listo = (req: FastifyRequest, tarjetaId: string, extra: Record<string, unknown> = {}) => {
    const c = a.leerTarjeta(tarjetaId)!;
    a.avisar(c.tablero_id, req, { tarjetas: [c] });
    return { tarjeta: frenteTarjeta(c), ...extra };
  };

  const leerChecklist = (cid: string) => db.prepare('SELECT * FROM checklists WHERE id = ?').get(cid) as unknown as Checklist | undefined;
  const leerItem = (iid: string) => db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(iid) as unknown as Item | undefined;
  const leerAdjunto = (aid: string) => db.prepare('SELECT * FROM adjuntos WHERE id = ?').get(aid) as unknown as Adjunto | undefined;
  const leerComentario = (cid: string) => db.prepare('SELECT * FROM comentarios WHERE id = ?').get(cid) as unknown as Comentario | undefined;
  const checklistEditable = (cid: string, u: Usuario) => { const k = leerChecklist(cid); if (!k) throw noExiste(); return { k, ...a.tarjetaEditable(k.tarjeta_id, u) }; };
  const itemEditable = (iid: string, u: Usuario) => { const i = leerItem(iid); if (!i) throw noExiste(); return { i, ...checklistEditable(i.checklist_id, u) }; };
  const esMiembroDelTablero = (tableroId: string, uid: string) => !!db.prepare('SELECT 1 FROM tablero_miembros WHERE tablero_id = ? AND usuario_id = ?').get(tableroId, uid);

  function comentariosDe(tarjetaId: string) {
    const filas = db.prepare('SELECT * FROM comentarios WHERE tarjeta_id = ? ORDER BY creado_en DESC, id').all(tarjetaId) as unknown as Comentario[];
    const reac = db.prepare(`SELECT r.comentario_id, r.emoji, r.usuario_id FROM reacciones r JOIN comentarios c ON c.id = r.comentario_id WHERE c.tarjeta_id = ? ORDER BY r.emoji`).all(tarjetaId) as { comentario_id: string; emoji: string; usuario_id: string }[];
    return filas.map((c) => {
      const porEmoji = new Map<string, string[]>();
      for (const r of reac) if (r.comentario_id === c.id) porEmoji.set(r.emoji, [...(porEmoji.get(r.emoji) ?? []), r.usuario_id]);
      return { id: c.id, autor: ficha(c.autor_id), texto: c.texto, creado_en: c.creado_en, editado_en: c.editado_en, reacciones: [...porEmoji].map(([emoji, usuarios]) => ({ emoji, usuarios })) };
    });
  }
  function interior(tarjetaId: string) {
    const items = db.prepare('SELECT i.* FROM checklist_items i JOIN checklists k ON k.id = i.checklist_id WHERE k.tarjeta_id = ? ORDER BY i.posicion, i.id').all(tarjetaId) as unknown as Item[];
    const checklists = (db.prepare('SELECT * FROM checklists WHERE tarjeta_id = ? ORDER BY posicion, id').all(tarjetaId) as unknown as Checklist[])
      .map((k) => ({ id: k.id, nombre: k.nombre, posicion: k.posicion, items: items.filter((i) => i.checklist_id === k.id).map(frenteItem) }));
    const adjuntos = (db.prepare('SELECT * FROM adjuntos WHERE tarjeta_id = ? ORDER BY posicion, id').all(tarjetaId) as unknown as Adjunto[]).map(frenteAdjunto);
    const actividad = (db.prepare('SELECT id, tipo, actor_id, datos, creado_en FROM actividad WHERE tarjeta_id = ? ORDER BY creado_en DESC, id LIMIT 300').all(tarjetaId) as { id: string; tipo: string; actor_id: string | null; datos: string; creado_en: string }[])
      .map((f) => ({ id: f.id, tipo: f.tipo, actor: ficha(f.actor_id), datos: JSON.parse(f.datos), creado_en: f.creado_en }));
    return { checklists, adjuntos, comentarios: comentariosDe(tarjetaId), actividad };
  }

  // La tarjeta abierta: todo lo que tiene adentro.
  app.get('/api/tarjetas/:id', async (req) => {
    const c = a.leerTarjeta(id(req));
    if (!c) throw noExiste();
    const { t } = a.tableroVisible(c.tablero_id, req.usuario, false);
    return { tarjeta: { ...frenteTarjeta(c), descripcion: c.descripcion }, lista: frenteLista(a.leerLista(c.lista_id)!), tablero: { id: t.id, enlace: t.enlace, nombre: t.nombre }, ...interior(c.id) };
  });

  // =====================================================================
  // ETIQUETAS (son del tablero; cada tarjeta lleva las que quiera)
  // =====================================================================
  const leerEtiqueta = (eid: string) => db.prepare('SELECT * FROM etiquetas WHERE id = ?').get(eid) as unknown as Etiqueta | undefined;
  const datosEtiqueta = (b: Record<string, unknown>, actual?: Etiqueta) => ({
    nombre: b.nombre === undefined ? (actual?.nombre ?? '') : texto(b.nombre, 'el nombre de la etiqueta', { min: 0, max: 200 }),
    color: b.color === undefined ? (actual?.color ?? '') : opcion(b.color, 'el color', COLORES_ETIQUETA),
  });

  app.post('/api/tableros/:id/etiquetas', async (req, reply) => {
    const u = exigirUsuario(req);
    const t = a.tableroEditable(id(req), u);
    const d = datosEtiqueta(cuerpo(req));
    if (!d.nombre && !d.color) throw datoInvalido('La etiqueta necesita un nombre o un color.');
    const eid = nuevoId();
    db.prepare('INSERT INTO etiquetas (id, tablero_id, nombre, color, creada_en) VALUES (?,?,?,?,?)').run(eid, t.id, d.nombre, d.color, ahora());
    vivo.emitir(t.id, { tipo: 'tablero' });
    return reply.code(201).send({ etiqueta: frenteEtiqueta(leerEtiqueta(eid)!) });
  });
  app.patch('/api/etiquetas/:id', async (req) => {
    const u = exigirUsuario(req);
    const e = leerEtiqueta(id(req));
    if (!e) throw noExiste();
    const t = a.tableroEditable(e.tablero_id, u);
    const d = datosEtiqueta(cuerpo(req), e);
    if (!d.nombre && !d.color) throw datoInvalido('La etiqueta necesita un nombre o un color.');
    db.prepare('UPDATE etiquetas SET nombre = ?, color = ? WHERE id = ?').run(d.nombre, d.color, e.id);
    vivo.emitir(t.id, { tipo: 'tablero' });
    return { etiqueta: frenteEtiqueta(leerEtiqueta(e.id)!) };
  });
  app.delete('/api/etiquetas/:id', async (req) => {
    const u = exigirUsuario(req);
    const e = leerEtiqueta(id(req));
    if (!e) throw noExiste();
    const t = a.tableroEditable(e.tablero_id, u);
    db.prepare('DELETE FROM etiquetas WHERE id = ?').run(e.id);
    vivo.emitir(t.id, { tipo: 'tablero' });
    return { ok: true };
  });

  app.post('/api/tarjetas/:id/etiquetas', async (req) => {
    const u = exigirUsuario(req);
    const { c } = a.tarjetaEditable(id(req), u);
    const e = leerEtiqueta(texto(cuerpo(req).etiqueta_id, 'la etiqueta'));
    if (!e || e.tablero_id !== c.tablero_id) throw datoInvalido('Esa etiqueta no es de este tablero.');
    db.prepare('INSERT OR IGNORE INTO tarjeta_etiquetas (tarjeta_id, etiqueta_id) VALUES (?,?)').run(c.id, e.id);
    return listo(req, c.id);
  });
  app.delete('/api/tarjetas/:id/etiquetas/:eid', async (req) => {
    const u = exigirUsuario(req);
    const { c } = a.tarjetaEditable(id(req), u);
    db.prepare('DELETE FROM tarjeta_etiquetas WHERE tarjeta_id = ? AND etiqueta_id = ?').run(c.id, id(req, 'eid'));
    return listo(req, c.id);
  });

  // =====================================================================
  // MIEMBROS DE LA TARJETA
  // =====================================================================
  app.post('/api/tarjetas/:id/miembros', async (req) => {
    const u = exigirUsuario(req);
    const { c, t } = a.tarjetaEditable(id(req), u);
    const uid = texto(cuerpo(req).usuario_id, 'la persona');
    if (!esMiembroDelTablero(t.id, uid)) throw datoInvalido('Esa persona no está en el tablero. Sumala primero desde "Compartir".');
    const r = db.prepare('INSERT OR IGNORE INTO tarjeta_miembros (tarjeta_id, usuario_id) VALUES (?,?)').run(c.id, uid);
    if (r.changes) anotar('tarjeta_miembro_sumado', u, t, c, { usuario_id: uid, nombre: ficha(uid)?.nombre });
    return listo(req, c.id);
  });
  app.delete('/api/tarjetas/:id/miembros/:uid', async (req) => {
    const u = exigirUsuario(req);
    const { c, t } = a.tarjetaEditable(id(req), u);
    const uid = id(req, 'uid');
    const r = db.prepare('DELETE FROM tarjeta_miembros WHERE tarjeta_id = ? AND usuario_id = ?').run(c.id, uid);
    if (r.changes) anotar('tarjeta_miembro_quitado', u, t, c, { usuario_id: uid, nombre: ficha(uid)?.nombre });
    return listo(req, c.id);
  });

  // =====================================================================
  // CHECKLISTS
  // =====================================================================
  // Crea una checklist. Con `copiar_de` trae los ítems de otra (sin tildes).
  app.post('/api/tarjetas/:id/checklists', async (req, reply) => {
    const u = exigirUsuario(req);
    const { c, t } = a.tarjetaEditable(id(req), u);
    const b = cuerpo(req);
    const nombre = texto(b.nombre, 'el nombre de la checklist', { max: 500 });
    let fuente: Checklist | undefined;
    if (typeof b.copiar_de === 'string') {
      fuente = leerChecklist(b.copiar_de);
      const origen = fuente && a.leerTarjeta(fuente.tarjeta_id);
      if (!fuente || !origen) throw datoInvalido('La checklist a copiar no existe.');
      a.tableroVisible(origen.tablero_id, u);
    }
    const kid = nuevoId();
    a.enTransaccion(() => {
      db.prepare('INSERT INTO checklists (id, tarjeta_id, nombre, posicion, creada_en) VALUES (?,?,?,?,?)').run(kid, c.id, nombre, a.resolverPosicion(CHECKLISTS, c.id, 'abajo'), ahora());
      if (fuente) a.copiarItems(fuente.id, kid, false);
      anotar('tarjeta_checklist_creada', u, t, c, { nombre });
    });
    return reply.code(201).send(listo(req, c.id, { checklist_id: kid }));
  });
  app.patch('/api/checklists/:id', async (req) => {
    const u = exigirUsuario(req);
    const { k, c } = checklistEditable(id(req), u);
    const b = cuerpo(req);
    const nombre = b.nombre === undefined ? k.nombre : texto(b.nombre, 'el nombre de la checklist', { max: 500 });
    a.enTransaccion(() => {
      db.prepare('UPDATE checklists SET nombre = ?, posicion = ? WHERE id = ?').run(nombre, b.posicion === undefined ? k.posicion : a.resolverPosicion(CHECKLISTS, c.id, b.posicion, k.id), k.id);
      a.acomodar(CHECKLISTS, c.id);
    });
    return listo(req, c.id);
  });
  app.delete('/api/checklists/:id', async (req) => {
    const u = exigirUsuario(req);
    const { k, c, t } = checklistEditable(id(req), u);
    db.prepare('DELETE FROM checklists WHERE id = ?').run(k.id);
    anotar('tarjeta_checklist_borrada', u, t, c, { nombre: k.nombre });
    return listo(req, c.id);
  });

  // Checklists del tablero, para elegir de cuál copiar los ítems.
  app.get('/api/tableros/:id/checklists', async (req) => {
    const { t } = a.tableroVisible(id(req), req.usuario, false);
    const filas = db.prepare(`SELECT k.id, k.nombre, c.titulo AS tarjeta FROM checklists k JOIN tarjetas c ON c.id = k.tarjeta_id
                              WHERE c.tablero_id = ? AND c.archivada = 0 ORDER BY c.titulo COLLATE NOCASE, k.posicion LIMIT 500`).all(t.id);
    return { checklists: filas };
  });

  // Agrega un ítem, o varios si llega `textos` (uno por renglón pegado).
  app.post('/api/checklists/:id/items', async (req, reply) => {
    const u = exigirUsuario(req);
    const { k, c } = checklistEditable(id(req), u);
    const b = cuerpo(req);
    const crudos = Array.isArray(b.textos) ? b.textos : [b.texto];
    if (crudos.length === 0 || crudos.length > MAX_ITEMS_POR_PEDIDO) throw datoInvalido(`Se pueden agregar de 1 a ${MAX_ITEMS_POR_PEDIDO} ítems por vez.`);
    const textos = crudos.map((v) => texto(v, 'el texto del ítem', { max: MAX_TEXTO }));
    a.enTransaccion(() => {
      for (const t of textos) db.prepare('INSERT INTO checklist_items (id, checklist_id, texto, posicion, creado_en) VALUES (?,?,?,?,?)').run(nuevoId(), k.id, t, a.resolverPosicion(ITEMS, k.id, 'abajo'), ahora());
    });
    return reply.code(201).send(listo(req, c.id));
  });
  // Editar, tildar, reordenar, pasar a otra checklist de la misma tarjeta, asignar persona y poner fecha.
  app.patch('/api/items/:id', async (req) => {
    const u = exigirUsuario(req);
    const { i, k, c, t } = itemEditable(id(req), u);
    const b = cuerpo(req);
    const txt = b.texto === undefined ? i.texto : texto(b.texto, 'el texto del ítem', { max: MAX_TEXTO });
    const hecho = b.hecho === undefined ? i.hecho : b.hecho ? 1 : 0;
    let destino = k;
    if (typeof b.checklist_id === 'string' && b.checklist_id !== k.id) {
      const otra = leerChecklist(b.checklist_id);
      if (!otra || otra.tarjeta_id !== c.id) throw datoInvalido('La checklist de destino tiene que ser de esta misma tarjeta.');
      destino = otra;
    }
    let asignado = i.asignado_id;
    if (b.asignado_id !== undefined) {
      asignado = b.asignado_id === null ? null : texto(b.asignado_id, 'la persona');
      if (asignado && !esMiembroDelTablero(t.id, asignado)) throw datoInvalido('Esa persona no está en el tablero.');
    }
    let vence = i.vence;
    if (b.vence !== undefined) {
      const ms = typeof b.vence === 'string' ? Date.parse(b.vence) : NaN;
      if (b.vence !== null && Number.isNaN(ms)) throw datoInvalido('La fecha del ítem no es válida.');
      vence = b.vence === null ? null : new Date(ms).toISOString();
    }
    a.enTransaccion(() => {
      const posicion = destino.id !== k.id || b.posicion !== undefined ? a.resolverPosicion(ITEMS, destino.id, b.posicion, i.id) : i.posicion;
      db.prepare('UPDATE checklist_items SET texto = ?, hecho = ?, checklist_id = ?, posicion = ?, asignado_id = ?, vence = ? WHERE id = ?').run(txt, hecho, destino.id, posicion, asignado, vence, i.id);
      a.acomodar(ITEMS, destino.id);
      if (hecho !== i.hecho) anotar(hecho ? 'tarjeta_item_hecho' : 'tarjeta_item_pendiente', u, t, c, { texto: txt.slice(0, 200), checklist: destino.nombre });
    });
    return listo(req, c.id);
  });
  app.delete('/api/items/:id', async (req) => {
    const u = exigirUsuario(req);
    const { i, c } = itemEditable(id(req), u);
    db.prepare('DELETE FROM checklist_items WHERE id = ?').run(i.id);
    return listo(req, c.id);
  });
  // Convierte el ítem en una tarjeta nueva, al final de la misma lista.
  app.post('/api/items/:id/convertir', async (req, reply) => {
    const u = exigirUsuario(req);
    const { i, c, t } = itemEditable(id(req), u);
    let nueva = '';
    a.enTransaccion(() => {
      nueva = a.insertarTarjeta(t, c.lista_id, i.texto.slice(0, MAX_TEXTO), '', a.resolverPosicion({ tabla: 'tarjetas', columna: 'lista_id' }, c.lista_id, 'abajo'), u.id);
      db.prepare('DELETE FROM checklist_items WHERE id = ?').run(i.id);
      registrarActividad(db, 'tarjeta_creada', u.id, { espacio_id: t.espacio_id, tablero_id: t.id, tarjeta_id: nueva, datos: { titulo: i.texto, desde_item_de: { id: c.id, titulo: c.titulo } } });
    });
    const creada = a.leerTarjeta(nueva)!;
    a.avisar(t.id, req, { tarjetas: [creada] });
    return reply.code(201).send(listo(req, c.id, { creada: frenteTarjeta(creada) }));
  });

  // =====================================================================
  // ADJUNTOS
  // =====================================================================
  /** Tarjeta que la persona puede ver (para bajar un adjunto). Sin acceso responde como si no existiera. */
  function adjuntoVisible(aid: string, u: Usuario | null) {
    const ad = leerAdjunto(aid);
    const c = ad && a.leerTarjeta(ad.tarjeta_id);
    if (!ad || !c) throw noExiste();
    a.tableroVisible(c.tablero_id, u);
    return { ad, c };
  }
  const adjuntoEditable = (aid: string, u: Usuario) => { const ad = leerAdjunto(aid); if (!ad) throw noExiste(); return { ad, ...a.tarjetaEditable(ad.tarjeta_id, u) }; };

  // Sube un archivo (cuerpo crudo; el nombre y el tipo van en la dirección) o adjunta un enlace (JSON con `url`).
  app.post('/api/tarjetas/:id/adjuntos', async (req, reply) => {
    const u = exigirUsuario(req);
    const { c, t } = a.tarjetaEditable(id(req), u);
    const aid = nuevoId();
    const esArchivo = String(req.headers['content-type'] ?? '').startsWith('application/octet-stream');
    let nombre: string;
    let url = '';
    let mime = '';
    let tamano = 0;
    if (esArchivo) {
      const q = req.query as Record<string, string | undefined>;
      nombre = texto(q.nombre ?? 'archivo', 'el nombre del archivo', { max: 300 }).replace(/[\\/\u0000-\u001f]/g, '_');
      const dicho = String(q.tipo ?? '').toLowerCase();
      const g = await archivos.guardarAdjunto(aid, req.body as Readable);
      tamano = g.tamano;
      // Si dice ser imagen, tiene que serlo de verdad; si no, se trata como archivo común para bajar.
      const imagen = tipoImagen(g.cabeza);
      mime = imagen ? TIPOS_FOTO[imagen] : /^image\//.test(dicho) ? 'application/octet-stream' : /^[\w.+-]+\/[\w.+-]+$/.test(dicho) ? dicho : 'application/octet-stream';
    } else {
      const b = cuerpo(req);
      url = texto(b.url, 'el enlace', { max: 2000 });
      if (!/^https?:\/\//i.test(url)) throw datoInvalido('El enlace tiene que empezar con http:// o https://');
      nombre = b.nombre === undefined || b.nombre === '' ? url : texto(b.nombre, 'el nombre', { max: 300 });
    }
    a.enTransaccion(() => {
      db.prepare('INSERT INTO adjuntos (id, tarjeta_id, tipo, nombre, url, mime, tamano, posicion, creado_por, creado_en) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(aid, c.id, esArchivo ? 'archivo' : 'enlace', nombre, url, mime, tamano, a.resolverPosicion(ADJUNTOS, c.id, 'abajo'), u.id, ahora());
      // La primera imagen que se adjunta pasa a ser la portada.
      if (mime.startsWith('image/') && !c.portada) db.prepare('UPDATE tarjetas SET portada = ? WHERE id = ?').run(JSON.stringify({ color: null, adjunto: aid, tamano: 'media', tono: 'oscuro' }), c.id);
      anotar('tarjeta_adjunto_sumado', u, t, c, { adjunto_id: aid, nombre });
    });
    return reply.code(201).send(listo(req, c.id, { adjunto: frenteAdjunto(leerAdjunto(aid)!) }));
  });
  app.patch('/api/adjuntos/:id', async (req) => {
    const u = exigirUsuario(req);
    const { ad, c } = adjuntoEditable(id(req), u);
    const b = cuerpo(req);
    const nombre = b.nombre === undefined ? ad.nombre : texto(b.nombre, 'el nombre', { max: 300 });
    a.enTransaccion(() => {
      db.prepare('UPDATE adjuntos SET nombre = ?, posicion = ? WHERE id = ?').run(nombre, b.posicion === undefined ? ad.posicion : a.resolverPosicion(ADJUNTOS, c.id, b.posicion, ad.id), ad.id);
      a.acomodar(ADJUNTOS, c.id);
    });
    return listo(req, c.id);
  });
  app.delete('/api/adjuntos/:id', async (req) => {
    const u = exigirUsuario(req);
    const { ad, c, t } = adjuntoEditable(id(req), u);
    a.enTransaccion(() => {
      db.prepare('DELETE FROM adjuntos WHERE id = ?').run(ad.id);
      if (leerPortada(c.portada)?.adjunto === ad.id) db.prepare("UPDATE tarjetas SET portada = '' WHERE id = ?").run(c.id);
      anotar('tarjeta_adjunto_borrado', u, t, c, { nombre: ad.nombre });
    });
    if (ad.tipo === 'archivo') archivos.borrarAdjunto(ad.id);
    return listo(req, c.id);
  });

  // Entrega el archivo, solo a quien puede ver la tarjeta. Acepta pedidos "por partes" (hace falta para ver videos en el iPhone).
  app.get('/api/adjuntos/:id/archivo', async (req, reply: FastifyReply) => {
    const { ad } = adjuntoVisible(id(req), req.usuario);
    if (ad.tipo !== 'archivo') throw noExiste();
    const ruta = archivos.rutaAdjunto(ad.id);
    if (!fs.existsSync(ruta)) throw noExiste('El archivo ya no está en el servidor.');
    const total = fs.statSync(ruta).size;
    const seVe = SE_VE.test(ad.mime) && (req.query as Record<string, string>).bajar === undefined;
    reply.header('content-type', seVe ? ad.mime : 'application/octet-stream')
      .header('content-disposition', `${seVe ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(ad.nombre)}`)
      .header('x-content-type-options', 'nosniff')
      .header('cache-control', 'private, max-age=3600')
      .header('accept-ranges', 'bytes');
    if (ad.mime !== 'application/pdf') reply.header('content-security-policy', "default-src 'none'; sandbox");
    const rango = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
    if (rango && (rango[1] || rango[2])) {
      const desde = rango[1] ? Number(rango[1]) : Math.max(0, total - Number(rango[2]));
      const hasta = rango[1] && rango[2] ? Math.min(Number(rango[2]), total - 1) : total - 1;
      if (desde > hasta || desde >= total) return reply.code(416).header('content-range', `bytes */${total}`).send();
      return reply.code(206).header('content-range', `bytes ${desde}-${hasta}/${total}`).header('content-length', hasta - desde + 1).send(fs.createReadStream(ruta, { start: desde, end: hasta }));
    }
    return reply.header('content-length', total).send(fs.createReadStream(ruta));
  });

  // =====================================================================
  // COMENTARIOS
  // =====================================================================
  /** Tarjeta donde la persona puede comentar (según el permiso "quién comenta" del tablero). */
  function tarjetaComentable(tarjetaId: string, u: Usuario) {
    const c = a.leerTarjeta(tarjetaId);
    if (!c) throw noExiste();
    const { t, c: ctx } = a.tableroVisible(c.tablero_id, u);
    if (!puedeComentar(ctx, t)) throw sinPermiso(t.cerrado ? 'El tablero está cerrado.' : 'No podés comentar en este tablero.');
    return { c, t, ctx };
  }
  app.post('/api/tarjetas/:id/comentarios', async (req, reply) => {
    const u = exigirUsuario(req);
    const { c, t } = tarjetaComentable(id(req), u);
    const txt = texto(cuerpo(req).texto, 'el comentario', { max: MAX_TEXTO });
    const cid = nuevoId();
    db.prepare('INSERT INTO comentarios (id, tarjeta_id, autor_id, texto, creado_en) VALUES (?,?,?,?,?)').run(cid, c.id, u.id, txt, ahora());
    anotar('tarjeta_comentada', u, t, c, { comentario_id: cid, texto: txt.slice(0, 300) });
    return reply.code(201).send(listo(req, c.id, { comentario_id: cid }));
  });
  app.patch('/api/comentarios/:id', async (req) => {
    const u = exigirUsuario(req);
    const com = leerComentario(id(req));
    if (!com) throw noExiste();
    tarjetaComentable(com.tarjeta_id, u);
    if (com.autor_id !== u.id) throw sinPermiso('Solo quien escribió el comentario puede editarlo.');
    db.prepare('UPDATE comentarios SET texto = ?, editado_en = ? WHERE id = ?').run(texto(cuerpo(req).texto, 'el comentario', { max: MAX_TEXTO }), ahora(), com.id);
    return listo(req, com.tarjeta_id);
  });
  app.delete('/api/comentarios/:id', async (req) => {
    const u = exigirUsuario(req);
    const com = leerComentario(id(req));
    const c = com && a.leerTarjeta(com.tarjeta_id);
    if (!com || !c) throw noExiste();
    const { t, c: ctx } = a.tableroVisible(c.tablero_id, u);
    if (com.autor_id !== u.id && !puedeAdministrarTablero(ctx)) throw sinPermiso('Solo quien lo escribió o quien administra el tablero puede borrar el comentario.');
    if (t.cerrado) throw sinPermiso('El tablero está cerrado.');
    a.enTransaccion(() => {
      db.prepare('DELETE FROM comentarios WHERE id = ?').run(com.id);
      db.prepare("DELETE FROM actividad WHERE tarjeta_id = ? AND tipo = 'tarjeta_comentada' AND json_extract(datos, '$.comentario_id') = ?").run(c.id, com.id);
    });
    return listo(req, c.id);
  });
  // Pone o saca mi reacción (un emoji) en un comentario.
  app.post('/api/comentarios/:id/reacciones', async (req) => {
    const u = exigirUsuario(req);
    const com = leerComentario(id(req));
    if (!com) throw noExiste();
    tarjetaComentable(com.tarjeta_id, u);
    const emoji = texto(cuerpo(req).emoji, 'el emoji', { max: 16 });
    const r = db.prepare('DELETE FROM reacciones WHERE comentario_id = ? AND usuario_id = ? AND emoji = ?').run(com.id, u.id, emoji);
    if (!r.changes) db.prepare('INSERT INTO reacciones (comentario_id, usuario_id, emoji) VALUES (?,?,?)').run(com.id, u.id, emoji);
    return listo(req, com.tarjeta_id);
  });

  // =====================================================================
  // ACTIVIDAD DEL TABLERO
  // =====================================================================
  // De a 50, de la más nueva a la más vieja. `antes` pide la tanda siguiente; `solo=comentarios` filtra.
  app.get('/api/tableros/:id/actividad', async (req) => {
    const { t } = a.tableroVisible(id(req), req.usuario, false);
    const q = req.query as Record<string, string | undefined>;
    const antes = q.antes ?? '9999';
    const filtro = q.solo === 'comentarios' ? "AND a.tipo = 'tarjeta_comentada'" : '';
    const filas = db.prepare(`SELECT a.id, a.tipo, a.actor_id, a.tarjeta_id, a.datos, a.creado_en, c.enlace AS tarjeta_enlace
                              FROM actividad a LEFT JOIN tarjetas c ON c.id = a.tarjeta_id
                              WHERE a.tablero_id = ? AND a.creado_en < ? ${filtro} ORDER BY a.creado_en DESC, a.id LIMIT 51`).all(t.id, antes) as { id: string; tipo: string; actor_id: string | null; tarjeta_id: string | null; datos: string; creado_en: string; tarjeta_enlace: string | null }[];
    return {
      actividad: filas.slice(0, 50).map((f) => ({ id: f.id, tipo: f.tipo, actor: ficha(f.actor_id), tarjeta_enlace: f.tarjeta_enlace, datos: JSON.parse(f.datos), creado_en: f.creado_en })),
      hay_mas: filas.length > 50,
    };
  });
}
