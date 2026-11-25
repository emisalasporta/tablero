// Tableros, por ahora solo lo que hace a permisos: crear, visibilidad, miembros, invitaciones y pedidos de acceso.
// Listas y tarjetas llegan en la tanda 2.2.
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { buscarUsuario, cantidadAdminsTablero, crearInvitacion, exigirUsuario, fichaPublica, leerUsuario, registrarActividad, sumarAEspacio, sumarATablero } from '../nucleo.ts';
import { capacidadesTablero, COMENTAR, contexto, leerEspacio, leerTablero, PERMISOS_TABLERO_INICIALES, puedeAdministrarEspacio, puedeAdministrarTablero, puedeBorrarTablero, puedeCrearTablero, puedeEditarTablero, puedeInvitarATablero, puedeUnirseSolo, puedeVerEspacio, puedeVerTablero, VIS_TABLERO } from '../permisos.ts';
import type { PermisosTablero, RolTablero, Tablero, Usuario } from '../permisos.ts';
import { ahora, datoInvalido, ErrorApi, noAutenticado, noExiste, nuevoEnlace, nuevoId, opcion, sinPermiso, texto, textoOpcional } from '../util.ts';

const ROLES_TABLERO = ['admin', 'normal', 'observador'] as const;

function validarPermisos(v: unknown, actuales: PermisosTablero): PermisosTablero {
  if (typeof v !== 'object' || v === null) throw datoInvalido('Los permisos no tienen el formato esperado.');
  const p = v as Record<string, unknown>;
  const booleano = (x: unknown, campo: string): boolean => { if (typeof x !== 'boolean') throw datoInvalido(`${campo} tiene que ser sí o no.`); return x; };
  return {
    comentar: p.comentar === undefined ? actuales.comentar : opcion(p.comentar, 'quién comenta', COMENTAR),
    invitar: p.invitar === undefined ? actuales.invitar : opcion(p.invitar, 'quién invita', ['admins', 'miembros'] as const),
    union_libre: p.union_libre === undefined ? actuales.union_libre : booleano(p.union_libre, 'unión libre'),
    edicion_espacio: p.edicion_espacio === undefined ? actuales.edicion_espacio : booleano(p.edicion_espacio, 'edición del espacio'),
  };
}

export function rutasTableros(app: FastifyInstance, db: DatabaseSync) {
  const resumen = (t: Tablero) => ({ id: t.id, enlace: t.enlace, espacio_id: t.espacio_id, nombre: t.nombre, descripcion: t.descripcion, visibilidad: t.visibilidad, cerrado: t.cerrado === 1 });

  /** Trae tablero, espacio y contexto. Si la persona no puede verlo: 401 sin sesión, 403 "sin acceso" con sesión (para ofrecer pedir acceso). */
  function abrir(idOEnlace: string, u: Usuario | null) {
    const t = leerTablero(db, idOEnlace);
    if (!t) throw noExiste();
    const e = leerEspacio(db, t.espacio_id)!;
    const c = contexto(db, u, e.id, t.id);
    if (!puedeVerTablero(c, t)) {
      if (!u) throw noAutenticado();
      throw new ErrorApi(403, 'sin_acceso', 'No tenés acceso a este tablero. Podés pedirlo.');
    }
    return { t, e, c };
  }

  // Tableros de un espacio que la persona puede ver.
  app.get('/api/espacios/:id/tableros', async (req) => {
    const e = leerEspacio(db, (req.params as { id: string }).id);
    if (!e) throw noExiste();
    const ce = contexto(db, req.usuario, e.id);
    if (!puedeVerEspacio(ce, e)) throw noExiste();
    const ids = db.prepare('SELECT id FROM tableros WHERE espacio_id = ? ORDER BY nombre COLLATE NOCASE').all(e.id) as { id: string }[];
    const visibles = ids.map((f) => leerTablero(db, f.id)!).filter((t) => {
      const c = contexto(db, req.usuario, e.id, t.id);
      // En un espacio público, quien no es del espacio solo ve los tableros públicos (y los suyos).
      return puedeVerTablero(c, t);
    });
    return {
      tableros: visibles.map((t) => ({ ...resumen(t), mi_rol: contexto(db, req.usuario, e.id, t.id).rolTablero })),
      puede_crear: Object.fromEntries(VIS_TABLERO.map((v) => [v, puedeCrearTablero(ce, e, v)])),
    };
  });

  app.post('/api/tableros', async (req, reply) => {
    const u = exigirUsuario(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const e = leerEspacio(db, texto(b.espacio_id, 'el espacio'));
    if (!e) throw noExiste('Ese espacio no existe.');
    const c = contexto(db, u, e.id);
    if (!puedeVerEspacio(c, e)) throw noExiste('Ese espacio no existe.');
    const vis = b.visibilidad === undefined ? 'espacio' : opcion(b.visibilidad, 'la visibilidad', VIS_TABLERO);
    if (!puedeCrearTablero(c, e, vis)) throw sinPermiso('En este espacio no podés crear tableros con esa visibilidad.');
    const id = nuevoId();
    db.prepare('INSERT INTO tableros (id, enlace, espacio_id, nombre, descripcion, visibilidad, permisos, creado_por, creado_en) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, nuevoEnlace(), e.id, texto(b.nombre, 'el nombre del tablero', { max: 200 }), textoOpcional(b.descripcion, 'la descripción', 16000) ?? '', vis, JSON.stringify(PERMISOS_TABLERO_INICIALES), u.id, ahora());
    sumarATablero(db, id, u.id, 'admin');
    registrarActividad(db, 'tablero_creado', u.id, { espacio_id: e.id, tablero_id: id });
    return reply.code(201).send({ tablero: resumen(leerTablero(db, id)!) });
  });

  app.get('/api/tableros/:id', async (req) => {
    const { t, e, c } = abrir((req.params as { id: string }).id, req.usuario);
    const miembros = db.prepare(`SELECT u.id, u.usuario, u.nombre, u.iniciales, u.avatar, u.es_robot, tm.rol,
                                        (SELECT 1 FROM espacio_miembros em WHERE em.espacio_id = ? AND em.usuario_id = u.id) AS del_espacio
                                 FROM tablero_miembros tm JOIN usuarios u ON u.id = tm.usuario_id WHERE tm.tablero_id = ? ORDER BY u.nombre COLLATE NOCASE`).all(e.id, t.id) as unknown as (Usuario & { rol: RolTablero; del_espacio: number | null })[];
    const administra = puedeAdministrarTablero(c);
    const pedidos = !administra ? [] : db.prepare(`SELECT p.id, p.creado_en, u.id AS uid, u.usuario, u.nombre, u.iniciales, u.avatar, u.es_robot
                              FROM pedidos_acceso p JOIN usuarios u ON u.id = p.usuario_id WHERE p.tipo = 'tablero' AND p.destino_id = ? AND p.estado = 'pendiente' ORDER BY p.creado_en`).all(t.id) as unknown as (Usuario & { uid: string })[];
    return {
      tablero: { ...resumen(t), permisos: t.permisos },
      espacio: { id: e.id, nombre: e.nombre },
      miembros: miembros.map((m) => ({ ...fichaPublica(m), rol: m.rol, invitado: !m.del_espacio })),
      pedidos: pedidos.map((p) => ({ id: p.id, creado_en: p.creado_en, persona: fichaPublica({ ...p, id: p.uid }) })),
      mi: { rol: c.rolTablero, rol_espacio: c.rolEspacio, puede: capacidadesTablero(c, t, e) },
    };
  });

  app.patch('/api/tableros/:id', async (req) => {
    const u = exigirUsuario(req);
    const { t, e, c } = abrir((req.params as { id: string }).id, u);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const tocaAjustes = b.visibilidad !== undefined || b.permisos !== undefined || b.cerrado !== undefined;
    if (tocaAjustes && !puedeAdministrarTablero(c)) throw sinPermiso('Solo quien administra el tablero puede cambiar eso.');
    // Reabrir un tablero cerrado es lo único que se puede hacer sobre un tablero cerrado.
    if (!tocaAjustes && !puedeEditarTablero(c, t)) throw sinPermiso('No podés editar este tablero.');
    const nombre = b.nombre === undefined ? t.nombre : texto(b.nombre, 'el nombre del tablero', { max: 200 });
    const descripcion = textoOpcional(b.descripcion, 'la descripción', 16000) ?? t.descripcion;
    const vis = b.visibilidad === undefined ? t.visibilidad : opcion(b.visibilidad, 'la visibilidad', VIS_TABLERO);
    if (vis !== t.visibilidad && !puedeCrearTablero(contexto(db, u, e.id), e, vis)) throw sinPermiso('En este espacio no podés tener tableros con esa visibilidad.');
    const permisos = b.permisos === undefined ? t.permisos : validarPermisos(b.permisos, t.permisos);
    const cerrado = b.cerrado === undefined ? t.cerrado : b.cerrado ? 1 : 0;
    db.prepare('UPDATE tableros SET nombre = ?, descripcion = ?, visibilidad = ?, permisos = ?, cerrado = ? WHERE id = ?')
      .run(nombre, descripcion, vis, JSON.stringify(permisos), cerrado, t.id);
    if (vis !== t.visibilidad) registrarActividad(db, 'tablero_visibilidad', u.id, { espacio_id: e.id, tablero_id: t.id, datos: { antes: t.visibilidad, ahora: vis } });
    if (cerrado !== t.cerrado) registrarActividad(db, cerrado ? 'tablero_cerrado' : 'tablero_reabierto', u.id, { espacio_id: e.id, tablero_id: t.id });
    if (nombre !== t.nombre) registrarActividad(db, 'tablero_renombrado', u.id, { espacio_id: e.id, tablero_id: t.id, datos: { antes: t.nombre, ahora: nombre } });
    const nuevo = leerTablero(db, t.id)!;
    return { tablero: { ...resumen(nuevo), permisos: nuevo.permisos } };
  });

  app.delete('/api/tableros/:id', async (req) => {
    const u = exigirUsuario(req);
    const { t, e, c } = abrir((req.params as { id: string }).id, u);
    if (!puedeBorrarTablero(c, t, e)) throw sinPermiso('No podés borrar este tablero.');
    if (!t.cerrado) throw new ErrorApi(409, 'no_cerrado', 'Primero hay que cerrar el tablero; después se puede borrar.');
    db.prepare('DELETE FROM tableros WHERE id = ?').run(t.id);
    registrarActividad(db, 'tablero_borrado', u.id, { espacio_id: e.id, datos: { nombre: t.nombre } });
    return { ok: true };
  });

  // ---------- miembros del tablero ----------
  app.post('/api/tableros/:id/miembros', async (req, reply) => {
    const u = exigirUsuario(req);
    const { t, e, c } = abrir((req.params as { id: string }).id, u);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const persona = typeof b.usuario_id === 'string' ? leerUsuario(db, b.usuario_id) : buscarUsuario(db, texto(b.quien, 'el correo o nombre de usuario'));
    if (!persona) throw new ErrorApi(404, 'persona_no_encontrada', 'No hay ninguna cuenta con ese correo o nombre de usuario. Pasale un enlace de invitación.');
    const rol = b.rol === undefined ? 'normal' : opcion(b.rol, 'el rol', ROLES_TABLERO);
    const deAfuera = !db.prepare('SELECT 1 FROM espacio_miembros WHERE espacio_id = ? AND usuario_id = ? AND desactivado = 0').get(e.id, persona.id);
    if (!puedeInvitarATablero(c, t, e, deAfuera)) throw sinPermiso(deAfuera ? 'En este espacio solo quien administra puede sumar invitados de afuera.' : 'No podés sumar gente a este tablero.');
    if (rol === 'admin' && !puedeAdministrarTablero(c)) throw sinPermiso('Solo quien administra el tablero puede nombrar administradores.');
    if (db.prepare('SELECT 1 FROM tablero_miembros WHERE tablero_id = ? AND usuario_id = ?').get(t.id, persona.id)) throw new ErrorApi(409, 'ya_es_miembro', `${persona.nombre} ya está en el tablero.`);
    sumarATablero(db, t.id, persona.id, rol);
    db.prepare("UPDATE pedidos_acceso SET estado = 'aprobado', resuelto_por = ?, resuelto_en = ? WHERE tipo = 'tablero' AND destino_id = ? AND usuario_id = ? AND estado = 'pendiente'").run(u.id, ahora(), t.id, persona.id);
    registrarActividad(db, 'tablero_miembro_sumado', u.id, { espacio_id: e.id, tablero_id: t.id, datos: { usuario_id: persona.id, nombre: persona.nombre, rol } });
    return reply.code(201).send({ miembro: { ...fichaPublica(persona), rol, invitado: deAfuera } });
  });

  app.patch('/api/tableros/:id/miembros/:uid', async (req) => {
    const u = exigirUsuario(req);
    const { id, uid } = req.params as { id: string; uid: string };
    const { t, e, c } = abrir(id, u);
    if (!puedeAdministrarTablero(c)) throw sinPermiso('Solo quien administra el tablero puede cambiar roles.');
    const actual = db.prepare('SELECT rol FROM tablero_miembros WHERE tablero_id = ? AND usuario_id = ?').get(t.id, uid) as { rol: RolTablero } | undefined;
    if (!actual) throw noExiste('Esa persona no está en el tablero.');
    const rol = opcion(((req.body ?? {}) as Record<string, unknown>).rol, 'el rol', ROLES_TABLERO);
    if (actual.rol === 'admin' && rol !== 'admin' && cantidadAdminsTablero(db, t.id) <= 1) throw new ErrorApi(409, 'ultimo_admin', 'El tablero tiene que tener al menos una persona que lo administre.');
    db.prepare('UPDATE tablero_miembros SET rol = ? WHERE tablero_id = ? AND usuario_id = ?').run(rol, t.id, uid);
    registrarActividad(db, 'tablero_miembro_cambiado', u.id, { espacio_id: e.id, tablero_id: t.id, datos: { usuario_id: uid, rol } });
    return { ok: true, rol };
  });

  app.delete('/api/tableros/:id/miembros/:uid', async (req) => {
    const u = exigirUsuario(req);
    const { id, uid } = req.params as { id: string; uid: string };
    const { t, e, c } = abrir(id, u);
    const actual = db.prepare('SELECT rol FROM tablero_miembros WHERE tablero_id = ? AND usuario_id = ?').get(t.id, uid) as { rol: RolTablero } | undefined;
    if (!actual) throw noExiste('Esa persona no está en el tablero.');
    if (uid !== u.id) {
      // Quitar a otro: quien administra siempre; un miembro normal solo si el tablero lo permite y no es a un administrador.
      const puede = puedeAdministrarTablero(c) || (puedeInvitarATablero(c, t, e, false) && actual.rol !== 'admin');
      if (!puede) throw sinPermiso('No podés quitar a esa persona del tablero.');
    }
    if (actual.rol === 'admin' && cantidadAdminsTablero(db, t.id) <= 1) throw new ErrorApi(409, 'ultimo_admin', 'El tablero tiene que tener al menos una persona que lo administre. Nombrá a otra antes.');
    db.prepare('DELETE FROM tablero_miembros WHERE tablero_id = ? AND usuario_id = ?').run(t.id, uid);
    registrarActividad(db, 'tablero_miembro_quitado', u.id, { espacio_id: e.id, tablero_id: t.id, datos: { usuario_id: uid } });
    return { ok: true };
  });

  // Sumarse solo a un tablero del espacio (si el tablero lo permite).
  app.post('/api/tableros/:id/unirse', async (req) => {
    const u = exigirUsuario(req);
    const { t, e, c } = abrir((req.params as { id: string }).id, u);
    if (!puedeUnirseSolo(c, t)) throw sinPermiso('Este tablero no permite sumarse sin invitación.');
    sumarATablero(db, t.id, u.id, 'normal');
    registrarActividad(db, 'tablero_miembro_sumado', u.id, { espacio_id: e.id, tablero_id: t.id, datos: { usuario_id: u.id, nombre: u.nombre, rol: 'normal', se_unio: true } });
    return { ok: true };
  });

  // ---------- enlace de invitación al tablero ----------
  app.post('/api/tableros/:id/invitacion', async (req, reply) => {
    const u = exigirUsuario(req);
    const { t, e, c } = abrir((req.params as { id: string }).id, u);
    // Un enlace puede traer gente de afuera del espacio, así que pide ese permiso.
    if (!puedeInvitarATablero(c, t, e, true)) throw sinPermiso('No podés crear enlaces de invitación para este tablero.');
    const rol = opcion(((req.body ?? {}) as Record<string, unknown>).rol ?? 'normal', 'el rol', ['normal', 'observador'] as const);
    return reply.code(201).send(crearInvitacion(db, 'tablero', t.id, rol, u.id));
  });
  app.get('/api/tableros/:id/invitacion', async (req) => {
    const u = exigirUsuario(req);
    const { t, e, c } = abrir((req.params as { id: string }).id, u);
    if (!puedeInvitarATablero(c, t, e, true)) throw sinPermiso();
    return { invitacion: db.prepare("SELECT id, rol, creada_en, usos FROM invitaciones WHERE tipo = 'tablero' AND destino_id = ? AND revocada = 0").get(t.id) ?? null };
  });
  app.delete('/api/tableros/:id/invitacion', async (req) => {
    const u = exigirUsuario(req);
    const { t, e, c } = abrir((req.params as { id: string }).id, u);
    if (!puedeInvitarATablero(c, t, e, true)) throw sinPermiso();
    db.prepare("UPDATE invitaciones SET revocada = 1 WHERE tipo = 'tablero' AND destino_id = ?").run(t.id);
    return { ok: true };
  });

  // ---------- pedidos de acceso ----------
  // Pedir acceso a un tablero que no puedo ver. No revela nada del tablero.
  app.post('/api/tableros/:id/pedidos', async (req, reply) => {
    const u = exigirUsuario(req);
    const t = leerTablero(db, (req.params as { id: string }).id);
    if (!t) throw noExiste();
    if (db.prepare('SELECT 1 FROM tablero_miembros WHERE tablero_id = ? AND usuario_id = ?').get(t.id, u.id)) throw new ErrorApi(409, 'ya_es_miembro', 'Ya estás en este tablero.');
    try {
      db.prepare("INSERT INTO pedidos_acceso (id, tipo, destino_id, usuario_id, creado_en) VALUES (?, 'tablero', ?, ?, ?)").run(nuevoId(), t.id, u.id, ahora());
    } catch { throw new ErrorApi(409, 'ya_pedido', 'Ya pediste acceso. Falta que alguien del tablero lo apruebe.'); }
    return reply.code(201).send({ ok: true });
  });

  // Aprobar o rechazar un pedido (de tablero o de espacio).
  app.patch('/api/pedidos/:id', async (req) => {
    const u = exigirUsuario(req);
    const p = db.prepare("SELECT id, tipo, destino_id, usuario_id FROM pedidos_acceso WHERE id = ? AND estado = 'pendiente'").get((req.params as { id: string }).id) as
      { id: string; tipo: 'espacio' | 'tablero'; destino_id: string; usuario_id: string } | undefined;
    if (!p) throw noExiste('Ese pedido ya no está pendiente.');
    const estado = opcion(((req.body ?? {}) as Record<string, unknown>).estado, 'la respuesta', ['aprobado', 'rechazado'] as const);
    const persona = leerUsuario(db, p.usuario_id)!;
    if (p.tipo === 'tablero') {
      const { t, e, c } = abrir(p.destino_id, u);
      const deAfuera = !db.prepare('SELECT 1 FROM espacio_miembros WHERE espacio_id = ? AND usuario_id = ? AND desactivado = 0').get(e.id, persona.id);
      if (!puedeInvitarATablero(c, t, e, deAfuera)) throw sinPermiso('No podés responder pedidos de este tablero.');
      if (estado === 'aprobado') {
        sumarATablero(db, t.id, persona.id, 'normal');
        registrarActividad(db, 'tablero_miembro_sumado', u.id, { espacio_id: e.id, tablero_id: t.id, datos: { usuario_id: persona.id, nombre: persona.nombre, rol: 'normal', por_pedido: true } });
      }
    } else {
      const e = leerEspacio(db, p.destino_id);
      if (!e) throw noExiste();
      if (!puedeAdministrarEspacio(contexto(db, u, e.id))) throw sinPermiso('Solo quien administra el espacio puede responder pedidos.');
      if (estado === 'aprobado') {
        sumarAEspacio(db, e.id, persona.id, 'normal');
        registrarActividad(db, 'espacio_miembro_sumado', u.id, { espacio_id: e.id, datos: { usuario_id: persona.id, nombre: persona.nombre, rol: 'normal', por_pedido: true } });
      }
    }
    db.prepare('UPDATE pedidos_acceso SET estado = ?, resuelto_por = ?, resuelto_en = ? WHERE id = ?').run(estado, u.id, ahora(), p.id);
    return { ok: true, estado };
  });
}
