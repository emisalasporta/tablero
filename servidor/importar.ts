// Importador de la exportación JSON de Trello (Menú del tablero → Imprimir, exportar y compartir → Exportar como JSON).
// Lee ese archivo y arma un tablero nuevo acá. Nunca habla con Trello: trabaja solo con el archivo.
// Todo entra en una sola operación: si algo falla a mitad de camino, no queda nada a medias.
import type { DatabaseSync } from 'node:sqlite';
import { AJUSTES_TABLERO_INICIALES, PERMISOS_TABLERO_INICIALES, type Espacio, type RolTablero, type Usuario, type VisTablero } from './permisos.ts';
import { SALTO } from './rutas/contenido.ts';
import { ahora, datoInvalido, nuevoEnlace, nuevoId } from './util.ts';

const MAX_TEXTO = 16384;
const MAX_NOMBRE = 200;

// Para comparar nombres: palabras en minúscula y sin acentos.
const palabras = (v: unknown): string[] => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
// Dos nombres se parecen si todas las palabras del más corto están en el más largo.
const contenido = (a: string[], b: string[]): boolean => { if (!a.length || !b.length) return false; const [corto, largo] = a.length <= b.length ? [a, b] : [b, a]; return corto.every((p) => largo.includes(p)); };

// Colores de Trello → tonos de la casa. Trello tiene tres intensidades por color (claro, normal, oscuro), igual que acá.
const TONO: Record<string, string> = { green: 'verde', yellow: 'amarillo', orange: 'naranja', red: 'rojo', purple: 'violeta', blue: 'azul', sky: 'celeste', lime: 'lima', pink: 'rosa' };
const FONDO: Record<string, string> = { blue: 'oceano', sky: 'oceano', orange: 'atardecer', red: 'coral', pink: 'coral', green: 'bosque', lime: 'bosque', purple: 'uva', grey: 'grafito' };

type Dic = Record<string, any>;
const lista = (v: unknown): Dic[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const txt = (v: unknown, max = MAX_TEXTO): string => (typeof v === 'string' ? v : '').slice(0, max);
const fecha = (v: unknown): string | null => { const n = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isNaN(n) ? null : new Date(n).toISOString(); };
const porPos = (a: Dic, b: Dic) => (Number(a.pos) || 0) - (Number(b.pos) || 0);

/** "blue_dark" → "azul-3". El negro de Trello no tiene par acá: queda sin color. */
export function colorEtiqueta(c: unknown): string {
  if (typeof c !== 'string') return '';
  const [base, matiz] = c.split('_');
  return TONO[base] ? `${TONO[base]}-${matiz === 'light' ? 1 : matiz === 'dark' ? 3 : 2}` : '';
}
/** El día (2026-11-30) de un momento, visto desde la zona horaria de la instalación. */
function dia(iso: string, zona: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export interface Informe {
  tablero: { id: string; enlace: string; nombre: string };
  entraron: { listas: number; tarjetas: number; etiquetas: number; checklists: number; items: number; comentarios: number; adjuntos: number; actividad: number; miembros: number };
  /** Personas del tablero de Trello que no tienen cuenta acá (sus comentarios quedan con su nombre de Trello). */
  personas_sin_cuenta: string[];
  /** Lo que el archivo traía y no se pudo traer, en palabras. */
  no_entro: string[];
  avisos: string[];
}

export interface OpcionesImportar {
  espacio: Espacio; usuario: Usuario; zona: string; visibilidad: VisTablero;
  /** Emparejar a mano: usuario de Trello → usuario o correo de acá. */
  emparejar?: Record<string, string>;
}

export function importarTrello(db: DatabaseSync, crudo: unknown, o: OpcionesImportar): Informe {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) throw datoInvalido('El archivo no es una exportación de un tablero de Trello.');
  const j = crudo as Dic;
  if (typeof j.name !== 'string' || !Array.isArray(j.lists) || !Array.isArray(j.cards)) throw datoInvalido('El archivo no parece una exportación de un tablero de Trello (faltan el nombre, las listas o las tarjetas).');

  const cuando = ahora();
  const noEntro: string[] = [];
  const avisos: string[] = [];
  const reconocidas: string[] = [];
  const cuenta = { listas: 0, tarjetas: 0, etiquetas: 0, checklists: 0, items: 0, comentarios: 0, adjuntos: 0, actividad: 0, miembros: 0 };

  // ---------- personas ----------
  const usuarios = db.prepare('SELECT id, usuario, nombre, email, es_robot FROM usuarios').all() as { id: string; usuario: string; nombre: string; email: string; es_robot: number }[];
  const buscar = (v: string | undefined) => { const b = (v ?? '').trim().toLowerCase(); return b ? usuarios.find((u) => u.usuario.toLowerCase() === b || u.email.toLowerCase() === b || u.nombre.toLowerCase() === b) : undefined; };
  const persona = new Map<string, string>();   // id de Trello → id de acá
  const nombreDe = new Map<string, string>();  // id de Trello → nombre para mostrar
  const sinCuenta = new Set<string>();
  const manual = Object.fromEntries(Object.entries(o.emparejar ?? {}).map(([k, v]) => [k.toLowerCase().replace(/^@/, ''), v]));
  const miembros = lista(j.members);
  // Primera pasada: coincidencia exacta (a mano, correo, usuario o nombre).
  for (const m of miembros) {
    nombreDe.set(m.id, txt(m.fullName, MAX_NOMBRE) || txt(m.username, MAX_NOMBRE) || 'Alguien');
    const u = buscar(manual[String(m.username ?? '').toLowerCase()]) ?? buscar(m.email) ?? buscar(m.username) ?? buscar(m.fullName);
    if (u) persona.set(m.id, u.id);
  }
  // Segunda pasada: nombres parecidos ("Emiliano" acá, "Emiliano Salas Porta" en Trello). Solo vale si no hay dudas:
  // una única cuenta libre que se parezca, y una única persona de Trello que se parezca a esa cuenta.
  const tomadas = () => new Set(persona.values());
  const candidatos = new Map<string, string[]>();   // id de acá → ids de Trello que se le parecen
  for (const m of miembros) {
    if (persona.has(m.id)) continue;
    const a = palabras(m.fullName);
    const parecidas = usuarios.filter((u) => !u.es_robot && !tomadas().has(u.id) && contenido(a, palabras(u.nombre)));
    if (parecidas.length === 1) candidatos.set(parecidas[0].id, [...(candidatos.get(parecidas[0].id) ?? []), m.id]);
  }
  for (const [uid, ids] of candidatos) if (ids.length === 1) { persona.set(ids[0], uid); reconocidas.push(`"${nombreDe.get(ids[0])}" de Trello quedó como ${usuarios.find((u) => u.id === uid)!.nombre}.`); }
  // Un tablero con una sola persona es de quien lo trae.
  if (miembros.length === 1 && !persona.has(miembros[0].id) && !tomadas().has(o.usuario.id)) { persona.set(miembros[0].id, o.usuario.id); reconocidas.push(`"${nombreDe.get(miembros[0].id)}" de Trello quedó como ${o.usuario.nombre}, porque era la única persona del tablero.`); }
  for (const m of miembros) if (!persona.has(m.id)) sinCuenta.add(nombreDe.get(m.id)!);
  // Quien hizo algo y ya no está en el tablero también figura en la actividad.
  for (const a of lista(j.actions)) if (a.idMemberCreator && !nombreDe.has(a.idMemberCreator) && a.memberCreator) nombreDe.set(a.idMemberCreator, txt(a.memberCreator.fullName, MAX_NOMBRE) || 'Alguien');

  db.exec('BEGIN');
  try {
    // ---------- tablero ----------
    const tableroId = nuevoId();
    const enlace = nuevoEnlace();
    const nombreTablero = txt(j.name, MAX_NOMBRE).trim() || 'Tablero importado';
    const fondo = FONDO[String(j.prefs?.background ?? '')];
    const ajustes = { ...AJUSTES_TABLERO_INICIALES, fondo: fondo ? { tipo: 'color', valor: fondo } : AJUSTES_TABLERO_INICIALES.fondo };
    if (!fondo && j.prefs?.backgroundImage) noEntro.push('La foto de fondo del tablero (podés subir una desde el menú del tablero).');
    db.prepare('INSERT INTO tableros (id, enlace, espacio_id, nombre, descripcion, visibilidad, permisos, cerrado, ajustes, creado_por, creado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(tableroId, enlace, o.espacio.id, nombreTablero, txt(j.desc, 16000), o.visibilidad, JSON.stringify(PERMISOS_TABLERO_INICIALES), j.closed ? 1 : 0, JSON.stringify(ajustes), o.usuario.id, cuando);
    if (j.closed) avisos.push('El tablero estaba cerrado en Trello y entró cerrado. Se puede reabrir desde su menú.');

    // Quien importa administra. El resto entra con el rol que tenía en Trello, si tiene cuenta acá.
    const sumar = db.prepare('INSERT OR IGNORE INTO tablero_miembros (tablero_id, usuario_id, rol, creado_en) VALUES (?,?,?,?)');
    const sumarEspacio = db.prepare('INSERT OR IGNORE INTO espacio_miembros (espacio_id, usuario_id, rol, creado_en) VALUES (?,?,?,?)');
    sumar.run(tableroId, o.usuario.id, 'admin', cuando);
    for (const m of lista(j.memberships)) {
      const uid = persona.get(m.idMember);
      if (!uid || uid === o.usuario.id) continue;
      const rol: RolTablero = m.memberType === 'admin' ? 'admin' : m.memberType === 'observer' ? 'observador' : 'normal';
      sumar.run(tableroId, uid, rol, cuando);
      sumarEspacio.run(o.espacio.id, uid, 'normal', cuando);
      cuenta.miembros++;
    }

    // ---------- etiquetas ----------
    const etiqueta = new Map<string, string>();
    const insEtiqueta = db.prepare('INSERT INTO etiquetas (id, tablero_id, nombre, color, creada_en) VALUES (?,?,?,?,?)');
    for (const e of lista(j.labels)) {
      const id = nuevoId();
      etiqueta.set(e.id, id);
      insEtiqueta.run(id, tableroId, txt(e.name, MAX_NOMBRE), colorEtiqueta(e.color), cuando);
      cuenta.etiquetas++;
    }

    // ---------- listas ----------
    const listaDe = new Map<string, { id: string; nombre: string }>();
    const insLista = db.prepare('INSERT INTO listas (id, tablero_id, nombre, posicion, archivada, creada_por, creada_en) VALUES (?,?,?,?,?,?,?)');
    lista(j.lists).sort(porPos).forEach((l, i) => {
      const id = nuevoId();
      const nombre = txt(l.name, MAX_NOMBRE).trim() || 'Sin nombre';
      listaDe.set(l.id, { id, nombre });
      insLista.run(id, tableroId, nombre, (i + 1) * SALTO, l.closed ? 1 : 0, o.usuario.id, cuando);
      cuenta.listas++;
    });

    // ---------- tarjetas ----------
    const tarjeta = new Map<string, { id: string; titulo: string }>();
    const insTarjeta = db.prepare(`INSERT INTO tarjetas (id, enlace, numero, tablero_id, lista_id, titulo, descripcion, posicion, archivada, creada_por, creada_en, inicio, vence, completada, portada)
                                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insTE = db.prepare('INSERT OR IGNORE INTO tarjeta_etiquetas (tarjeta_id, etiqueta_id) VALUES (?,?)');
    const insTM = db.prepare('INSERT OR IGNORE INTO tarjeta_miembros (tarjeta_id, usuario_id) VALUES (?,?)');
    const insAdj = db.prepare("INSERT INTO adjuntos (id, tarjeta_id, tipo, nombre, url, mime, tamano, posicion, creado_por, creado_en) VALUES (?,?,'enlace',?,?,'',0,?,?,?)");
    const usados = new Set<number>();
    let ultimoNumero = 0;
    let sinLista = 0, archivosTrello = 0, portadasFoto = 0, plantillas = 0, miembrosPerdidos = 0;
    const puestos = new Map<string, number>();  // cuántas tarjetas lleva cada lista (para la posición)
    // Momento de creación: lo dice la actividad si está; si no, sale del propio identificador de Trello (sus primeros 8 caracteres son la fecha).
    const creada = new Map<string, string>();
    for (const a of lista(j.actions)) if ((a.type === 'createCard' || a.type === 'copyCard' || a.type === 'convertToCardFromCheckItem') && a.data?.card?.id) { const f = fecha(a.date); if (f) creada.set(a.data.card.id, f); }
    const nacio = (id: unknown): string => { const s = parseInt(String(id).slice(0, 8), 16); return /^[0-9a-f]{24}$/.test(String(id)) && s > 0 ? new Date(s * 1000).toISOString() : cuando; };

    for (const c of lista(j.cards).sort(porPos)) {
      const l = listaDe.get(c.idList);
      if (!l) { sinLista++; continue; }
      const id = nuevoId();
      const titulo = txt(c.name).trim() || 'Sin título';
      tarjeta.set(c.id, { id, titulo });
      let numero = Number.isInteger(c.idShort) && c.idShort > 0 && !usados.has(c.idShort) ? c.idShort : 0;
      if (!numero) { numero = Math.max(ultimoNumero, ...usados, 0) + 1; }
      usados.add(numero);
      ultimoNumero = Math.max(ultimoNumero, numero);
      const n = (puestos.get(l.id) ?? 0) + 1;
      puestos.set(l.id, n);
      const vence = fecha(c.due);
      const inicio = fecha(c.start);
      let portada = '';
      const tono = TONO[String(c.cover?.color ?? '').split('_')[0]];
      if (tono) portada = JSON.stringify({ color: tono, adjunto: null, tamano: c.cover.size === 'full' ? 'completa' : 'media', tono: c.cover.brightness === 'light' ? 'claro' : 'oscuro' });
      else if (c.cover?.idAttachment || c.cover?.idUploadedBackground) portadasFoto++;
      if (c.isTemplate) plantillas++;
      insTarjeta.run(id, nuevoEnlace(), numero, tableroId, l.id, titulo, txt(c.desc), n * SALTO, c.closed ? 1 : 0, persona.get(c.idMemberCreator) ?? o.usuario.id, creada.get(c.id) ?? nacio(c.id),
        inicio ? dia(inicio, o.zona) : null, vence, c.dueComplete ? 1 : 0, portada);
      cuenta.tarjetas++;
      for (const e of Array.isArray(c.idLabels) ? c.idLabels : []) { const eid = etiqueta.get(e); if (eid) insTE.run(id, eid); }
      for (const m of Array.isArray(c.idMembers) ? c.idMembers : []) { const uid = persona.get(m); if (uid) insTM.run(id, uid); else miembrosPerdidos++; }
      lista(c.attachments).sort(porPos).forEach((a, i) => {
        const url = txt(a.url, 2000);
        if (!/^https?:\/\//i.test(url)) return;
        if (a.isUpload) archivosTrello++;
        insAdj.run(nuevoId(), id, txt(a.name, MAX_NOMBRE).trim() || url.slice(0, MAX_NOMBRE), url, (i + 1) * SALTO, persona.get(a.idMember) ?? o.usuario.id, fecha(a.date) ?? cuando);
        cuenta.adjuntos++;
      });
    }
    db.prepare('UPDATE tableros SET ultimo_numero = ? WHERE id = ?').run(ultimoNumero, tableroId);

    // ---------- checklists ----------
    const insCheck = db.prepare('INSERT INTO checklists (id, tarjeta_id, nombre, posicion, creada_en) VALUES (?,?,?,?,?)');
    const insItem = db.prepare('INSERT INTO checklist_items (id, checklist_id, texto, hecho, posicion, asignado_id, vence, creado_en) VALUES (?,?,?,?,?,?,?,?)');
    const porTarjeta = new Map<string, number>();
    for (const k of lista(j.checklists).sort(porPos)) {
      const t = tarjeta.get(k.idCard);
      if (!t) continue;
      const kid = nuevoId();
      const n = (porTarjeta.get(t.id) ?? 0) + 1;
      porTarjeta.set(t.id, n);
      insCheck.run(kid, t.id, txt(k.name, MAX_NOMBRE).trim() || 'Checklist', n * SALTO, cuando);
      cuenta.checklists++;
      lista(k.checkItems).sort(porPos).forEach((it, i) => {
        insItem.run(nuevoId(), kid, txt(it.name).trim() || '—', it.state === 'complete' ? 1 : 0, (i + 1) * SALTO, persona.get(it.idMember) ?? null, fecha(it.due), cuando);
        cuenta.items++;
      });
    }

    // ---------- comentarios y actividad ----------
    const insCom = db.prepare('INSERT INTO comentarios (id, tarjeta_id, autor_id, autor_externo, texto, creado_en, editado_en) VALUES (?,?,?,?,?,?,?)');
    const insAct = db.prepare('INSERT INTO actividad (id, tipo, actor_id, espacio_id, tablero_id, tarjeta_id, datos, creado_en) VALUES (?,?,?,?,?,?,?,?)');
    let sinTraducir = 0;
    for (const a of lista(j.actions)) {
      const f = fecha(a.date);
      if (!f) continue;
      const d = (a.data ?? {}) as Dic;
      const actor = persona.get(a.idMemberCreator) ?? null;
      const t = d.card?.id ? tarjeta.get(d.card.id) : undefined;
      // Si quien lo hizo no tiene cuenta acá, queda su nombre de Trello para que la actividad no diga "Alguien".
      const extra = actor ? {} : { de_trello: nombreDe.get(a.idMemberCreator) ?? txt(a.memberCreator?.fullName, MAX_NOMBRE) ?? '' };
      const anotar = (tipo: string, datos: Dic, conTarjeta = true) => {
        if (conTarjeta && !t) return;
        insAct.run(nuevoId(), tipo, actor, o.espacio.id, tableroId, conTarjeta ? t!.id : null, JSON.stringify({ ...(conTarjeta ? { titulo: t!.titulo } : {}), ...datos, ...extra }), f);
        cuenta.actividad++;
      };
      const ln = (x: Dic | undefined) => ({ id: listaDe.get(x?.id)?.id ?? null, nombre: txt(x?.name, MAX_NOMBRE) });
      const viejo = (d.old ?? {}) as Dic;
      switch (a.type) {
        case 'commentCard': {
          if (!t) break;
          const cuerpo = txt(d.text).trim();
          if (!cuerpo) break;
          const cid = nuevoId();
          // Sin cuenta acá no hay a quién atribuirlo: queda guardado su nombre de Trello.
          insCom.run(cid, t.id, actor, actor ? null : (extra.de_trello || 'Alguien'), cuerpo, f, fecha(d.dateLastEdited));
          cuenta.comentarios++;
          anotar('tarjeta_comentada', { comentario_id: cid, texto: cuerpo.slice(0, 300) });
          break;
        }
        case 'createCard': anotar('tarjeta_creada', { lista: ln(d.list) }); break;
        case 'copyCard': anotar('tarjeta_copiada', { de: { id: null, titulo: txt(d.cardSource?.name, 300) }, lista: ln(d.list) }); break;
        case 'convertToCardFromCheckItem': anotar('tarjeta_creada', { lista: ln(d.list) }); break;
        case 'updateCard':
          if (d.listBefore && d.listAfter) anotar('tarjeta_movida', { de_lista: ln(d.listBefore), a_lista: ln(d.listAfter) });
          else if ('closed' in viejo) anotar(d.card?.closed ? 'tarjeta_archivada' : 'tarjeta_restaurada', {});
          else if ('name' in viejo) anotar('tarjeta_renombrada', { antes: txt(viejo.name, 300), ahora: txt(d.card?.name, 300) });
          else if ('desc' in viejo) anotar('tarjeta_descripcion', {});
          else if ('due' in viejo) anotar(d.card?.due ? 'tarjeta_vence' : 'tarjeta_vence_quitada', { vence: fecha(d.card?.due) });
          else if ('dueComplete' in viejo) anotar(d.card?.dueComplete ? 'tarjeta_completada' : 'tarjeta_reabierta', {});
          else sinTraducir++;
          break;
        case 'addMemberToCard': anotar('tarjeta_miembro_sumado', { nombre: txt(a.member?.fullName, MAX_NOMBRE) || nombreDe.get(d.idMember) || 'alguien' }); break;
        case 'removeMemberFromCard': anotar('tarjeta_miembro_quitado', { nombre: txt(a.member?.fullName, MAX_NOMBRE) || nombreDe.get(d.idMember) || 'alguien' }); break;
        case 'addChecklistToCard': anotar('tarjeta_checklist_creada', { nombre: txt(d.checklist?.name, MAX_NOMBRE) }); break;
        case 'removeChecklistFromCard': anotar('tarjeta_checklist_borrada', { nombre: txt(d.checklist?.name, MAX_NOMBRE) }); break;
        case 'updateCheckItemStateOnCard': anotar(d.checkItem?.state === 'complete' ? 'tarjeta_item_hecho' : 'tarjeta_item_pendiente', { texto: txt(d.checkItem?.name, 300) }); break;
        case 'addAttachmentToCard': anotar('tarjeta_adjunto_sumado', { nombre: txt(d.attachment?.name, MAX_NOMBRE) }); break;
        case 'deleteAttachmentFromCard': anotar('tarjeta_adjunto_borrado', { nombre: txt(d.attachment?.name, MAX_NOMBRE) }); break;
        case 'createList': anotar('lista_creada', { lista_id: listaDe.get(d.list?.id)?.id ?? null, nombre: txt(d.list?.name, MAX_NOMBRE) }, false); break;
        case 'updateList':
          if ('name' in viejo) anotar('lista_renombrada', { lista_id: listaDe.get(d.list?.id)?.id ?? null, antes: txt(viejo.name, MAX_NOMBRE), ahora: txt(d.list?.name, MAX_NOMBRE) }, false);
          else if ('closed' in viejo) anotar(d.list?.closed ? 'lista_archivada' : 'lista_restaurada', { lista_id: listaDe.get(d.list?.id)?.id ?? null, nombre: txt(d.list?.name, MAX_NOMBRE) }, false);
          else sinTraducir++;
          break;
        case 'createBoard': anotar('tablero_creado', {}, false); break;
        default: sinTraducir++;
      }
    }
    insAct.run(nuevoId(), 'tablero_importado', o.usuario.id, o.espacio.id, tableroId, null, JSON.stringify({ origen: 'Trello', nombre: nombreTablero }), cuando);

    // ---------- lo que no entró ----------
    if (archivosTrello) noEntro.push(`${archivosTrello} ${archivosTrello === 1 ? 'archivo adjunto quedó' : 'archivos adjuntos quedaron'} como enlace a Trello: el archivo sigue guardado allá y solo se abre con la sesión de Trello iniciada. Si se cierra esa cuenta, se pierden.`);
    if (portadasFoto) noEntro.push(`${portadasFoto} ${portadasFoto === 1 ? 'portada con foto' : 'portadas con foto'} (la foto es un archivo que quedó en Trello).`);
    const campos = lista(j.customFields).length;
    if (campos) noEntro.push(`${campos} ${campos === 1 ? 'campo personalizado' : 'campos personalizados'} y sus valores (la app todavía no tiene campos personalizados).`);
    const pegatinas = lista(j.cards).reduce((n, c) => n + lista(c.stickers).length, 0);
    if (pegatinas) noEntro.push(`${pegatinas} ${pegatinas === 1 ? 'pegatina' : 'pegatinas'} de tarjetas.`);
    if (lista(j.pluginData).length || lista(j.cards).some((c) => lista(c.pluginData).length)) noEntro.push('Los datos de los Power-Ups (complementos de Trello).');
    if (plantillas) noEntro.push(`La marca de "plantilla" de ${plantillas} ${plantillas === 1 ? 'tarjeta' : 'tarjetas'} (entraron como tarjetas comunes).`);
    if (miembrosPerdidos) noEntro.push(`${miembrosPerdidos} ${miembrosPerdidos === 1 ? 'asignación' : 'asignaciones'} de personas a tarjetas, porque esas personas todavía no tienen cuenta acá.`);
    if (sinLista) noEntro.push(`${sinLista} ${sinLista === 1 ? 'tarjeta' : 'tarjetas'} cuya lista no viene en el archivo.`);
    if (sinTraducir) noEntro.push(`${sinTraducir} ${sinTraducir === 1 ? 'movimiento' : 'movimientos'} del historial de un tipo que acá no existe.`);
    const acciones = lista(j.actions).length;
    if (acciones >= 1000) avisos.push('Trello exporta como mucho los últimos 1.000 movimientos del tablero: el historial y los comentarios más viejos pueden no estar en el archivo. Las tarjetas, listas, etiquetas y checklists entran completas igual.');
    avisos.push(...reconocidas);
    if (sinCuenta.size) avisos.push('Los comentarios y movimientos de quienes no tienen cuenta acá entraron con su nombre de Trello.');

    const informe: Informe = { tablero: { id: tableroId, enlace, nombre: nombreTablero }, entraron: cuenta, personas_sin_cuenta: [...sinCuenta].sort(), no_entro: noEntro, avisos };
    db.prepare('INSERT INTO importaciones (id, origen, origen_id, tablero_id, informe, creado_por, creado_en) VALUES (?,?,?,?,?,?,?)')
      .run(nuevoId(), 'trello', txt(j.id, 100) || nombreTablero, tableroId, JSON.stringify(informe), o.usuario.id, cuando);
    db.exec('COMMIT');
    return informe;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** ¿Este tablero de Trello ya se trajo antes y el tablero resultante sigue existiendo? */
export function yaImportado(db: DatabaseSync, crudo: unknown): { nombre: string; enlace: string } | null {
  const id = (crudo as Dic | null)?.id;
  if (typeof id !== 'string' || !id) return null;
  return (db.prepare(`SELECT t.nombre, t.enlace FROM importaciones i JOIN tableros t ON t.id = i.tablero_id WHERE i.origen = 'trello' AND i.origen_id = ? ORDER BY i.creado_en DESC LIMIT 1`).get(id) as { nombre: string; enlace: string } | undefined) ?? null;
}

// Decir después quién es alguien que entró solo con su nombre de Trello (por ejemplo, cuando esa persona recién se hace la cuenta).
// Sus comentarios y movimientos de ese tablero pasan a ser de la cuenta indicada.
export function nombresDeTrello(db: DatabaseSync, tableroId: string): string[] {
  const filas = db.prepare(`SELECT autor_externo AS n FROM comentarios WHERE autor_externo IS NOT NULL AND tarjeta_id IN (SELECT id FROM tarjetas WHERE tablero_id = ?)
    UNION SELECT json_extract(datos, '$.de_trello') FROM actividad WHERE tablero_id = ? AND actor_id IS NULL AND json_extract(datos, '$.de_trello') IS NOT NULL`).all(tableroId, tableroId) as { n: string }[];
  return filas.map((f) => f.n).filter(Boolean).sort();
}
export function reconocerPersona(db: DatabaseSync, tableroId: string, nombre: string, usuarioId: string): { comentarios: number; actividad: number } {
  db.exec('BEGIN');
  try {
    const c = db.prepare('UPDATE comentarios SET autor_id = ?, autor_externo = NULL WHERE autor_externo = ? AND tarjeta_id IN (SELECT id FROM tarjetas WHERE tablero_id = ?)').run(usuarioId, nombre, tableroId);
    const a = db.prepare("UPDATE actividad SET actor_id = ?, datos = json_remove(datos, '$.de_trello') WHERE tablero_id = ? AND actor_id IS NULL AND json_extract(datos, '$.de_trello') = ?").run(usuarioId, tableroId, nombre);
    db.exec('COMMIT');
    return { comentarios: Number(c.changes), actividad: Number(a.changes) };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
