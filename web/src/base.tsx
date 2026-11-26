// Base de las pantallas: hablar con el servidor, navegar entre direcciones, saber quién inició sesión
// y las piezas chicas que se repiten (botón, campo, avatar, diálogo).
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { FormEvent, MouseEvent, ReactNode } from 'react';

// ---------- servidor ----------
export class ErrorServidor extends Error {
  estado: number;
  codigo: string;
  constructor(estado: number, codigo: string, mensaje: string) { super(mensaje); this.estado = estado; this.codigo = codigo; }
}
/** Identifica a esta pantalla abierta. Viaja en cada pedido para reconocer mis propios cambios cuando vuelven como aviso en vivo. */
export const CLIENTE = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
export async function api<T = any>(metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cuerpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { method: metodo, headers: cuerpo !== undefined ? { 'content-type': 'application/json', 'x-cliente': CLIENTE } : { 'x-cliente': CLIENTE }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined, credentials: 'same-origin' });
  } catch {
    throw new ErrorServidor(0, 'sin_conexion', 'No hay conexión con el servidor. Revisá tu internet y probá de nuevo.');
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorServidor(r.status, datos.error ?? 'error', datos.mensaje ?? 'Algo salió mal.');
  return datos as T;
}
/** Sube un archivo crudo al servidor. `alAvanzar` recibe de 0 a 1 mientras sube. */
export function subir<T = any>(url: string, archivo: Blob, alAvanzar?: (parte: number) => void): Promise<T> {
  return new Promise((ok, mal) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.setRequestHeader('content-type', 'application/octet-stream');
    x.setRequestHeader('x-cliente', CLIENTE);
    x.upload.onprogress = (e) => { if (e.lengthComputable) alAvanzar?.(e.loaded / e.total); };
    x.onerror = () => mal(new ErrorServidor(0, 'sin_conexion', 'No se pudo subir el archivo. Revisá tu internet y probá de nuevo.'));
    x.onload = () => {
      let datos: any = {};
      try { datos = JSON.parse(x.responseText); } catch { /* respuesta sin cuerpo */ }
      if (x.status >= 200 && x.status < 300) ok(datos as T);
      else mal(new ErrorServidor(x.status, datos.error ?? 'error', datos.mensaje ?? (x.status === 413 ? 'El archivo es demasiado grande.' : 'No se pudo subir el archivo.')));
    };
    x.send(archivo);
  });
}
export const mensajeDe = (e: unknown): string => (e instanceof Error ? e.message : 'Algo salió mal.');

/** Carga datos del servidor y los vuelve a pedir cuando cambia la dirección o se llama a `recargar`. */
export function useCarga<T>(url: string | null) {
  const [estado, setEstado] = useState<{ datos: T | null; error: ErrorServidor | null; cargando: boolean }>({ datos: null, error: null, cargando: !!url });
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (!url) return;
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true }));
    api<T>('GET', url)
      .then((datos) => vigente && setEstado({ datos, error: null, cargando: false }))
      .catch((error) => vigente && setEstado({ datos: null, error, cargando: false }));
    return () => { vigente = false; };
  }, [url, vuelta]);
  return { ...estado, recargar: useCallback(() => setVuelta((v) => v + 1), []) };
}

// ---------- navegación ----------
const oyentes = new Set<() => void>();
const suscribir = (f: () => void) => { oyentes.add(f); window.addEventListener('popstate', f); return () => { oyentes.delete(f); window.removeEventListener('popstate', f); }; };
export function navegar(a: string, reemplazar = false) {
  if (reemplazar) history.replaceState(null, '', a); else history.pushState(null, '', a);
  oyentes.forEach((f) => f());
  window.scrollTo(0, 0);
}
export const useRuta = (): string => useSyncExternalStore(suscribir, () => location.pathname + location.search);
export function Enlace({ a, className, children, title }: { a: string; className?: string; children: ReactNode; title?: string }) {
  const alHacerClic = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navegar(a);
  };
  return <a href={a} className={className} onClick={alHacerClic} title={title}>{children}</a>;
}

// ---------- sesión ----------
export interface Yo { id: string; usuario: string; nombre: string; iniciales: string; avatar?: string | null; email: string; bio: string; zona_horaria: string; es_admin_general: boolean; debe_cambiar_clave: boolean }
interface Sesion { yo: Yo | null; cargando: boolean; poner: (y: Yo | null) => void; recargar: () => Promise<void> }
const ContextoSesion = createContext<Sesion>({ yo: null, cargando: true, poner: () => {}, recargar: async () => {} });
export const useSesion = () => useContext(ContextoSesion);
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [yo, setYo] = useState<Yo | null>(null);
  const [cargando, setCargando] = useState(true);
  const recargar = useCallback(async () => {
    try { setYo((await api<{ usuario: Yo }>('GET', '/api/yo')).usuario); } catch { setYo(null); }
    setCargando(false);
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);
  return <ContextoSesion.Provider value={{ yo, cargando, poner: setYo, recargar }}>{children}</ContextoSesion.Provider>;
}

// ---------- tema claro / oscuro ----------
export type Tema = 'sistema' | 'claro' | 'oscuro';
export function leerTema(): Tema {
  try { const t = localStorage.getItem('tema'); return t === 'claro' || t === 'oscuro' ? t : 'sistema'; } catch { return 'sistema'; }
}
export function ponerTema(t: Tema) {
  if (t === 'sistema') document.documentElement.removeAttribute('data-tema'); else document.documentElement.setAttribute('data-tema', t);
  try { localStorage.setItem('tema', t); } catch { /* sin almacenamiento: vale solo para esta visita */ }
}

// ---------- piezas ----------
const COLORES_PERSONA = ['#3F6FB5', '#A8507A', '#6B7A2A', '#3A3F4B', '#8A5A2B', '#2C7A7B', '#6B4FA8', '#B0483C'];
export function Avatar({ p, chica }: { p: { id: string; nombre: string; iniciales: string; avatar?: string | null }; chica?: boolean }) {
  if (p.avatar) return <img className={'per' + (chica ? ' chica' : '')} src={`/api/fotos/${p.avatar}`} alt={p.nombre} title={p.nombre} />;
  let suma = 0;
  for (const c of p.id) suma = (suma + c.charCodeAt(0)) % COLORES_PERSONA.length;
  return <span className={'per' + (chica ? ' chica' : '')} style={{ background: COLORES_PERSONA[suma] }} title={p.nombre}>{p.iniciales}</span>;
}

export function Campo({ rotulo, ayuda, children }: { rotulo: string; ayuda?: string; children: ReactNode }) {
  return <label className="campo"><span>{rotulo}</span>{children}{ayuda && <small>{ayuda}</small>}</label>;
}

export function Dialogo({ titulo, alCerrar, children, ancho }: { titulo: string; alCerrar: () => void; children: ReactNode; ancho?: boolean }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [alCerrar]);
  return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div className={'dialogo' + (ancho ? ' ancho' : '')} role="dialog" aria-modal="true" aria-label={titulo}>
        <header><h2>{titulo}</h2><button type="button" className="btn plano chico" onClick={alCerrar} aria-label="Cerrar">✕</button></header>
        {children}
      </div>
    </div>
  );
}

/** Formulario que muestra el error del servidor y bloquea el botón mientras envía. */
export function Formulario({ alEnviar, boton, children, secundario }: { alEnviar: () => Promise<void>; boton: string; children: ReactNode; secundario?: ReactNode }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true); setError(null);
    try { await alEnviar(); } catch (err) { setError(mensajeDe(err)); }
    setEnviando(false);
  };
  return (
    <form className="columna" onSubmit={enviar}>
      {children}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="fila"><button type="submit" className="btn lleno" disabled={enviando}>{enviando ? 'Un momento…' : boton}</button>{secundario}</div>
    </form>
  );
}

/** Ejecuta una acción suelta (un botón) y muestra el error si falla. */
export function useAccion() {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const hacer = useCallback(async (f: () => Promise<unknown>) => {
    setOcupado(true); setError(null);
    try { await f(); } catch (e) { setError(mensajeDe(e)); }
    setOcupado(false);
  }, []);
  return { error, ocupado, hacer };
}

export function CopiarEnlace({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* se puede seleccionar a mano */ }
  };
  return <div className="columna" style={{ gap: 8 }}><div className="codigo">{url}</div><div><button type="button" className="btn chico" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar enlace'}</button></div></div>;
}

export const NOMBRE_VIS: Record<string, string> = { privado: 'Privado', espacio: 'Del espacio', publico: 'Público' };
export const AYUDA_VIS: Record<string, string> = {
  privado: 'Solo lo ven las personas sumadas al tablero y quien administra el espacio.',
  espacio: 'Lo ven todos los miembros del espacio de trabajo.',
  publico: 'Lo ve cualquiera que tenga el enlace, sin necesidad de cuenta. Solo los miembros pueden editar.',
};
export const NOMBRE_ROL: Record<string, string> = { admin: 'Administra', normal: 'Miembro', observador: 'Observa' };
