// Los datos de un tablero abierto: se cargan una vez y después se mantienen al día solos
// con los avisos en vivo del servidor. También aplica mis cambios al instante (sin esperar la respuesta)
// y, si el servidor los rechaza, vuelve a pedir todo para quedar igual que el servidor.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, CLIENTE, ErrorServidor, mensajeDe } from '../base.tsx';

/** Separación entre posiciones vecinas (igual que en el servidor). */
export const SALTO = 65536;

export interface Lista { id: string; tablero_id: string; nombre: string; posicion: number; archivada: boolean }
export interface Portada { color: string | null; adjunto: string | null; tamano: 'media' | 'completa'; tono: 'claro' | 'oscuro' }
export interface Tarjeta {
  id: string; enlace: string; numero: number; tablero_id: string; lista_id: string; titulo: string; posicion: number; archivada: boolean; tiene_descripcion: boolean;
  inicio: string | null; vence: string | null; completada: boolean; portada: Portada | null;
  etiquetas: string[]; miembros: string[]; n_comentarios: number; n_adjuntos: number; n_items: number; n_hechos: number;
}
export interface Etiqueta { id: string; nombre: string; color: string }
export interface Persona { id: string; usuario: string; nombre: string; iniciales: string; avatar?: string | null }
export interface Permisos { comentar: string; invitar: string; union_libre: boolean; edicion_espacio: boolean }
export interface Puede { ver: boolean; editar: boolean; administrar: boolean; comentar: boolean; invitar: boolean; invitar_de_afuera: boolean; unirse: boolean; borrar: boolean }
export interface Datos {
  tablero: { id: string; enlace: string; nombre: string; descripcion: string; visibilidad: string; cerrado: boolean; permisos: Permisos; ajustes: { portadas: boolean; tilde: boolean; conteo: boolean; fondo: { tipo: 'ninguno' | 'color' | 'foto'; valor: string } } };
  listas: Lista[];
  tarjetas: Tarjeta[];
  etiquetas: Etiqueta[];
  espacio: { id: string; nombre: string };
  miembros: (Persona & { rol: string; invitado: boolean })[];
  pedidos: { id: string; persona: Persona }[];
  mi: { rol: string | null; rol_espacio: string | null; favorito: boolean; puede: Puede };
}
export interface Cambio { listas?: Lista[]; tarjetas?: Tarjeta[] }

const porPosicion = (a: { posicion: number; id: string }, b: { posicion: number; id: string }) => a.posicion - b.posicion || (a.id < b.id ? -1 : 1);

/** Aplica un cambio a lo que hay en pantalla. Lo archivado o lo que se fue a otro tablero sale de la vista. */
export function mezclar(d: Datos, c: Cambio): Datos {
  let { listas, tarjetas } = d;
  if (c.listas?.length) {
    const ids = new Set(c.listas.map((l) => l.id));
    listas = listas.filter((l) => !ids.has(l.id)).concat(c.listas.filter((l) => !l.archivada && l.tablero_id === d.tablero.id)).sort(porPosicion);
  }
  if (c.tarjetas?.length) {
    const ids = new Set(c.tarjetas.map((t) => t.id));
    tarjetas = tarjetas.filter((t) => !ids.has(t.id)).concat(c.tarjetas.filter((t) => !t.archivada && t.tablero_id === d.tablero.id)).sort(porPosicion);
  }
  return listas === d.listas && tarjetas === d.tarjetas ? d : { ...d, listas, tarjetas };
}

/** Posición para meter algo en el lugar `indice` de un grupo ya ordenado (sin contar lo que se mueve). */
export function posicionEntre(orden: { posicion: number }[], indice: number): number {
  const antes = orden[indice - 1];
  const despues = orden[indice];
  if (!antes && !despues) return SALTO;
  if (!antes) return despues.posicion / 2;
  if (!despues) return antes.posicion + SALTO;
  return (antes.posicion + despues.posicion) / 2;
}

export type Ops = ReturnType<typeof useTablero>['ops'];

/** `enlace` vacío: todavía no se sabe qué tablero es (se abrió por la dirección de una tarjeta). */
export function useTablero(enlace: string | null) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<ErrorServidor | null>(null);
  const [enLinea, setEnLinea] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Cosas con un cambio mío todavía viajando al servidor: no se pisan con el eco de mis propios avisos. */
  const enVuelo = useRef(new Map<string, number>());
  /** Avisos que llegan mientras se está cargando el tablero: se vuelven a aplicar sobre lo cargado. */
  const cola = useRef<Cambio[] | null>(null);
  const vuelta = useRef(0);
  /** El servidor dijo que no existe o que no tengo acceso: no tiene sentido seguir insistiendo. */
  const definitivo = useRef(false);
  const hayDatos = useRef(false);

  const cargar = useCallback(async () => {
    if (!enlace) return;
    const esta = ++vuelta.current;
    cola.current = [];
    try {
      let d = await api<Datos>('GET', `/api/tableros/${enlace}`);
      if (esta !== vuelta.current) return;
      for (const c of cola.current ?? []) d = mezclar(d, c);
      cola.current = null;
      definitivo.current = false;
      hayDatos.current = true;
      setDatos(d); setError(null);
    } catch (e) {
      if (esta !== vuelta.current) return;
      cola.current = null;
      const err = e instanceof ErrorServidor ? e : new ErrorServidor(0, 'error', mensajeDe(e));
      if (err.estado === 401 || err.estado === 403 || err.estado === 404) { definitivo.current = true; hayDatos.current = false; setDatos(null); setError(err); }
      // Sin conexión o error pasajero: se deja lo que ya había en pantalla.
      else if (!hayDatos.current) setError(err);
    }
  }, [enlace]);

  useEffect(() => {
    if (!enlace) return;
    // Al pasar de un tablero a otro no tiene que quedar a la vista el anterior.
    hayDatos.current = false; definitivo.current = false;
    setDatos((d) => (d && d.tablero.enlace !== enlace && d.tablero.id !== enlace ? null : d));
    let activo = true;
    let ws: WebSocket | null = null;
    let reloj = 0;
    let intentos = 0;
    let ultimo = Date.now();
    const conectar = () => {
      clearTimeout(reloj);
      if (!activo || (ws && ws.readyState <= 1)) return;
      let saludo = false;
      const s = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/tableros/${enlace}/vivo`);
      ws = s;
      ultimo = Date.now();
      s.onmessage = (m) => {
        ultimo = Date.now();
        let ev: { tipo: string; origen?: string | null; listas?: Lista[]; tarjetas?: Tarjeta[] };
        try { ev = JSON.parse(String(m.data)); } catch { return; }
        if (ev.tipo === 'hola') {
          // Línea abierta (la primera vez o después de un corte): se pide todo de nuevo para ponerse al día.
          saludo = true; intentos = 0; setEnLinea(true); void cargar();
        } else if (ev.tipo === 'tablero') void cargar();
        else if (ev.tipo === 'cambio') {
          const mio = ev.origen === CLIENTE;
          const quieto = <T extends { id: string }>(xs: T[] | undefined) => (xs ?? []).filter((x) => !(mio && enVuelo.current.has(x.id)));
          const c: Cambio = { listas: quieto(ev.listas), tarjetas: quieto(ev.tarjetas) };
          cola.current?.push(c);
          setDatos((d) => d && mezclar(d, c));
        }
      };
      s.onclose = () => {
        if (!activo || ws !== s) return;
        ws = null;
        // Si la línea ni llegó a abrir, igual se pide el tablero: así se ve el contenido o el motivo.
        const espera = saludo ? Promise.resolve() : cargar();
        void espera.then(() => {
          if (!activo || definitivo.current) return;
          if (intentos > 0) setEnLinea(false);
          reloj = window.setTimeout(conectar, Math.min(15_000, 1000 * 2 ** intentos++));
        });
      };
    };
    const despertar = () => { if (document.visibilityState === 'visible' && !definitivo.current) { intentos = 0; conectar(); } };
    // Si pasa un minuto sin latido del servidor, la línea está muerta aunque no avise: se corta y se rearma.
    const guardia = window.setInterval(() => { if (ws?.readyState === 1 && Date.now() - ultimo > 60_000) ws.close(); }, 10_000);
    document.addEventListener('visibilitychange', despertar);
    window.addEventListener('online', despertar);
    conectar();
    return () => {
      activo = false;
      clearTimeout(reloj); clearInterval(guardia);
      document.removeEventListener('visibilitychange', despertar);
      window.removeEventListener('online', despertar);
      ws?.close();
    };
  }, [enlace, cargar]);

  /** Hace un cambio: lo muestra ya, lo manda al servidor y, si falla, avisa y vuelve a cargar. */
  const hacer = useCallback(async (ids: string[], optimista: ((d: Datos) => Datos) | null, pedido: () => Promise<Cambio>): Promise<boolean> => {
    const v = enVuelo.current;
    ids.forEach((id) => v.set(id, (v.get(id) ?? 0) + 1));
    if (optimista) setDatos((d) => d && optimista(d));
    const bajar = () => ids.forEach((id) => { const n = (v.get(id) ?? 1) - 1; if (n <= 0) v.delete(id); else v.set(id, n); });
    try {
      const c = await pedido();
      // Si ya hay otro cambio mío posterior sobre lo mismo, manda ese: esta respuesta quedó vieja.
      const ultimoMio = <T extends { id: string }>(xs: T[] | undefined) => (xs ?? []).filter((x) => (v.get(x.id) ?? 0) <= 1);
      setDatos((d) => d && mezclar(d, { listas: ultimoMio(c.listas), tarjetas: ultimoMio(c.tarjetas) }));
      bajar();
      return true;
    } catch (e) {
      bajar();
      setAviso(mensajeDe(e));
      void cargar();
      return false;
    }
  }, [cargar]);

  const ops = useMemo(() => ({
    /** Aplica en pantalla un cambio que ya hizo el servidor (lo usa la tarjeta abierta con cada respuesta). */
    aplicar: (c: Cambio) => setDatos((d) => d && mezclar(d, c)),
    crearLista: (nombre: string) => hacer([], null, async () => ({ listas: [(await api('POST', `/api/tableros/${enlace}/listas`, { nombre })).lista] })),
    cambiarLista: (id: string, cambios: { nombre?: string; posicion?: number; archivada?: boolean; tablero_id?: string }) =>
      hacer([id], (d) => { const l = d.listas.find((x) => x.id === id); return l ? mezclar(d, { listas: [{ ...l, ...cambios }] }) : d; },
        async () => ({ listas: [(await api('PATCH', `/api/listas/${id}`, cambios)).lista] })),
    copiarLista: (id: string, nombre: string) => hacer([], null, async () => { const r = await api('POST', `/api/listas/${id}/copiar`, { nombre }); return { listas: [r.lista], tarjetas: r.tarjetas }; }),
    pasarTarjetas: (id: string, listaId: string) => hacer([], null, () => api('POST', `/api/listas/${id}/mover-tarjetas`, { lista_id: listaId })),
    archivarTarjetas: (id: string) => hacer([], (d) => ({ ...d, tarjetas: d.tarjetas.filter((t) => t.lista_id !== id) }), () => api('POST', `/api/listas/${id}/archivar-tarjetas`)),
    ordenarLista: (id: string, por: 'nombre' | 'nuevas' | 'viejas' | 'vence') => hacer([], null, () => api('POST', `/api/listas/${id}/ordenar`, { por })),
    crearTarjetas: (listaId: string, titulos: string[], posicion: 'arriba' | 'abajo') => hacer([], null, () => api('POST', `/api/listas/${listaId}/tarjetas`, { titulos, posicion })),
    cambiarTarjeta: (id: string, cambios: { titulo?: string; lista_id?: string; posicion?: number; archivada?: boolean; completada?: boolean }, tableroDestino?: string) =>
      hacer([id], (d) => { const t = d.tarjetas.find((x) => x.id === id); return t ? mezclar(d, { tarjetas: [{ ...t, ...cambios, tablero_id: tableroDestino ?? t.tablero_id }] }) : d; },
        async () => ({ tarjetas: [(await api('PATCH', `/api/tarjetas/${id}`, cambios)).tarjeta] })),
    copiarTarjeta: (id: string, cuerpo: { titulo: string; lista_id: string; posicion: number; conservar: Record<string, boolean> }) =>
      hacer([], null, async () => ({ tarjetas: [(await api('POST', `/api/tarjetas/${id}/copiar`, cuerpo)).tarjeta] })),
  }), [enlace, hacer]);

  return { datos, error, enLinea, aviso, cerrarAviso: useCallback(() => setAviso(null), []), recargar: cargar, ops };
}
