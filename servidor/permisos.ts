// Reglas de permisos. Es el único lugar donde se decide quién puede qué.
// Tres niveles, como en Trello: instalación → espacio de trabajo → tablero.
// La pantalla solo esconde botones; la decisión real siempre se toma acá, en el servidor.
import type { DatabaseSync } from 'node:sqlite';

export type RolEspacio = 'admin' | 'normal';
export type RolTablero = 'admin' | 'normal' | 'observador';
export type Quien = 'miembros' | 'admins' | 'nadie';
export type VisTablero = 'privado' | 'espacio' | 'publico';
export const VIS_TABLERO = ['privado', 'espacio', 'publico'] as const;
export const QUIEN = ['miembros', 'admins', 'nadie'] as const;
export const COMENTAR = ['nadie', 'miembros', 'observadores', 'espacio', 'cualquiera'] as const;

export interface AjustesEspacio {
  /** Quién puede crear tableros de cada visibilidad. */
  crear: Record<VisTablero, Quien>;
  /** Quién puede borrar tableros de cada visibilidad ("miembros" = los administradores de ese tablero). */
  borrar: Record<VisTablero, Quien>;
  /** Quién puede sumar a un tablero a gente que no es del espacio (invitados). */
  invitados: 'miembros' | 'admins';
}
export interface PermisosTablero {
  comentar: (typeof COMENTAR)[number];
  /** Quién suma y quita miembros del tablero. */
  invitar: 'admins' | 'miembros';
  /** Los miembros del espacio pueden sumarse solos (si el tablero no es privado). */
  union_libre: boolean;
  /** Los miembros del espacio pueden editar sin ser miembros del tablero (si no es privado). */
  edicion_espacio: boolean;
}

export const AJUSTES_ESPACIO_INICIALES: AjustesEspacio = {
  crear: { privado: 'miembros', espacio: 'miembros', publico: 'miembros' },
  borrar: { privado: 'miembros', espacio: 'miembros', publico: 'miembros' },
  invitados: 'miembros',
};
export const PERMISOS_TABLERO_INICIALES: PermisosTablero = {
  comentar: 'miembros',
  invitar: 'miembros',
  union_libre: true,
  edicion_espacio: true,
};

export interface Usuario {
  id: string; email: string; usuario: string; nombre: string; iniciales: string; bio: string; avatar: string | null;
  es_admin_general: number; es_robot: number; zona_horaria: string; idioma: string; debe_cambiar_clave: number; creado_en: string;
}
export interface Espacio {
  id: string; nombre: string; descripcion: string; sitio_web: string; logo: string | null;
  visibilidad: 'privado' | 'publico'; ajustes: AjustesEspacio; creado_por: string | null; creado_en: string;
}
export interface Tablero {
  id: string; enlace: string; espacio_id: string; nombre: string; descripcion: string; visibilidad: VisTablero;
  permisos: PermisosTablero; cerrado: number; creado_por: string | null; creado_en: string;
}

/** Qué es una persona respecto de un espacio y (si corresponde) de un tablero. */
export interface Contexto {
  usuario: Usuario | null;
  adminGeneral: boolean;
  rolEspacio: RolEspacio | null;
  rolTablero: RolTablero | null;
  /** Está en algún tablero del espacio sin ser miembro del espacio. */
  esInvitado: boolean;
}

export function leerEspacio(db: DatabaseSync, id: string): Espacio | null {
  const f = db.prepare('SELECT * FROM espacios WHERE id = ?').get(id) as (Omit<Espacio, 'ajustes'> & { ajustes: string }) | undefined;
  return f ? { ...f, ajustes: { ...AJUSTES_ESPACIO_INICIALES, ...JSON.parse(f.ajustes) } } : null;
}
export function leerTablero(db: DatabaseSync, idOEnlace: string): Tablero | null {
  const f = db.prepare('SELECT * FROM tableros WHERE id = ? OR enlace = ?').get(idOEnlace, idOEnlace) as (Omit<Tablero, 'permisos'> & { permisos: string }) | undefined;
  return f ? { ...f, permisos: { ...PERMISOS_TABLERO_INICIALES, ...JSON.parse(f.permisos) } } : null;
}

export function contexto(db: DatabaseSync, usuario: Usuario | null, espacioId: string, tableroId?: string): Contexto {
  const vacio: Contexto = { usuario, adminGeneral: false, rolEspacio: null, rolTablero: null, esInvitado: false };
  if (!usuario) return vacio;
  const me = db.prepare('SELECT rol, desactivado FROM espacio_miembros WHERE espacio_id = ? AND usuario_id = ?').get(espacioId, usuario.id) as { rol: RolEspacio; desactivado: number } | undefined;
  const adminGeneral = usuario.es_admin_general === 1;
  // Miembro desactivado: conserva su historial pero no entra a nada de ese espacio.
  if (me?.desactivado && !adminGeneral) return vacio;
  const rolEspacio = me && !me.desactivado ? me.rol : null;
  let rolTablero: RolTablero | null = null;
  if (tableroId) {
    const mt = db.prepare('SELECT rol FROM tablero_miembros WHERE tablero_id = ? AND usuario_id = ?').get(tableroId, usuario.id) as { rol: RolTablero } | undefined;
    rolTablero = mt?.rol ?? null;
  }
  let esInvitado = false;
  if (!rolEspacio) {
    const n = db.prepare('SELECT count(*) AS n FROM tablero_miembros tm JOIN tableros t ON t.id = tm.tablero_id WHERE t.espacio_id = ? AND tm.usuario_id = ?').get(espacioId, usuario.id) as { n: number };
    esInvitado = n.n > 0;
  }
  return { usuario, adminGeneral, rolEspacio, rolTablero, esInvitado };
}

// ---------- espacio ----------
export const puedeAdministrarEspacio = (c: Contexto): boolean => c.adminGeneral || c.rolEspacio === 'admin';
export const puedeVerEspacio = (c: Contexto, e: Espacio): boolean =>
  c.adminGeneral || c.rolEspacio !== null || c.esInvitado || e.visibilidad === 'publico';
export function puedeCrearTablero(c: Contexto, e: Espacio, vis: VisTablero): boolean {
  if (c.adminGeneral) return true;
  const regla = e.ajustes.crear[vis];
  if (regla === 'nadie') return false;
  if (regla === 'admins') return c.rolEspacio === 'admin';
  return c.rolEspacio !== null;
}

// ---------- tablero ----------
export const puedeAdministrarTablero = (c: Contexto): boolean =>
  c.adminGeneral || c.rolEspacio === 'admin' || c.rolTablero === 'admin';
export function puedeVerTablero(c: Contexto, t: Tablero): boolean {
  if (t.visibilidad === 'publico') return true;
  if (puedeAdministrarTablero(c) || c.rolTablero !== null) return true;
  return t.visibilidad === 'espacio' && c.rolEspacio !== null;
}
export function puedeEditarTablero(c: Contexto, t: Tablero): boolean {
  if (t.cerrado) return false;
  if (puedeAdministrarTablero(c) || c.rolTablero === 'normal') return true;
  if (c.rolTablero === 'observador') return false;
  return t.visibilidad !== 'privado' && c.rolEspacio !== null && t.permisos.edicion_espacio;
}
export function puedeComentar(c: Contexto, t: Tablero): boolean {
  if (!c.usuario || t.cerrado || !puedeVerTablero(c, t)) return false;
  const esMiembro = puedeAdministrarTablero(c) || c.rolTablero === 'normal';
  switch (t.permisos.comentar) {
    case 'nadie': return false;
    case 'miembros': return esMiembro;
    case 'observadores': return esMiembro || c.rolTablero === 'observador';
    case 'espacio': return esMiembro || c.rolTablero !== null || c.rolEspacio !== null;
    case 'cualquiera': return true;
  }
}
/** Sumar o quitar gente del tablero. `aAlguienDeAfuera`: la persona no es miembro del espacio (sería invitada). */
export function puedeInvitarATablero(c: Contexto, t: Tablero, e: Espacio, aAlguienDeAfuera: boolean): boolean {
  if (t.cerrado) return false;
  const base = puedeAdministrarTablero(c) || (t.permisos.invitar === 'miembros' && c.rolTablero === 'normal');
  if (!base) return false;
  if (aAlguienDeAfuera && e.ajustes.invitados === 'admins') return c.adminGeneral || c.rolEspacio === 'admin';
  return true;
}
export function puedeUnirseSolo(c: Contexto, t: Tablero): boolean {
  if (!c.usuario || c.rolTablero !== null || t.cerrado) return false;
  if (c.adminGeneral || c.rolEspacio === 'admin') return true;
  return c.rolEspacio !== null && t.visibilidad !== 'privado' && t.permisos.union_libre;
}
export function puedeBorrarTablero(c: Contexto, t: Tablero, e: Espacio): boolean {
  if (c.adminGeneral) return true;
  const regla = e.ajustes.borrar[t.visibilidad];
  if (regla === 'nadie') return false;
  if (regla === 'admins') return c.rolEspacio === 'admin';
  return puedeAdministrarTablero(c);
}

/** Resumen para la pantalla: qué botones mostrar. */
export function capacidadesTablero(c: Contexto, t: Tablero, e: Espacio) {
  return {
    ver: puedeVerTablero(c, t),
    editar: puedeEditarTablero(c, t),
    administrar: puedeAdministrarTablero(c),
    comentar: puedeComentar(c, t),
    invitar: puedeInvitarATablero(c, t, e, false),
    invitar_de_afuera: puedeInvitarATablero(c, t, e, true),
    unirse: puedeUnirseSolo(c, t),
    borrar: puedeBorrarTablero(c, t, e),
  };
}
