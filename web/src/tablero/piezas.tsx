// Piezas chicas que comparten el frente de la tarjeta y la tarjeta abierta:
// íconos, colores de etiquetas, fechas y el texto de cada renglón de actividad.
import type { ReactNode } from 'react';
import type { Etiqueta, Persona } from './datos.ts';

const TRAZOS = {
  reloj: <><circle cx="8" cy="8" r="6.25" /><path d="M8 4.5V8l2.5 1.5" /></>,
  texto: <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />,
  burbuja: <path d="M2.5 3.5h11v7.5H7l-3 2.5v-2.5H2.5z" />,
  clip: <path d="M10.5 4.5 5.6 9.4a1.6 1.6 0 0 0 2.3 2.3l5-5a2.9 2.9 0 0 0-4.1-4.1L3.6 7.8a4.2 4.2 0 0 0 5.9 5.9l4-4" />,
  lista: <><path d="M2.5 3h11v10h-11z" /><path d="m5.2 8 2 2 3.6-4" /></>,
  tilde: <path d="m3.5 8.5 3 3 6-7" />,
};
export function Icono({ n }: { n: keyof typeof TRAZOS }) {
  return <svg className="ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TRAZOS[n]}</svg>;
}

/** Diez tonos, cada uno en tres intensidades: treinta colores de etiqueta, más "sin color". */
export const TONOS = ['rojo', 'naranja', 'amarillo', 'lima', 'verde', 'turquesa', 'celeste', 'azul', 'violeta', 'rosa'];
export const COLORES = [1, 2, 3].flatMap((i) => TONOS.map((t) => `${t}-${i}`));
export const claseColor = (color: string): string => { const [t, i] = color.split('-'); return t ? `c-${t} i-${i ?? 2}` : 'sin'; };
export const nombreColor = (color: string): string => { const [t, i] = color.split('-'); return t ? `${t} ${['', 'claro', 'medio', 'oscuro'][Number(i)] ?? ''}`.trim() : 'sin color'; };

export function ChipEtiqueta({ e, conNombre = true }: { e: Etiqueta; conNombre?: boolean }) {
  return <span className={`et ${claseColor(e.color)}${conNombre ? '' : ' muda'}`} title={e.nombre || nombreColor(e.color)}>{conNombre ? e.nombre || ' ' : ''}</span>;
}

// ---------- fechas ----------
const DIA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const DIA_ANIO = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const HORA = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** "5 dic, 15:00". Un día suelto (2026-12-05) se muestra sin hora. */
export function fechaCorta(valor: string): string {
  const soloDia = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = soloDia ? new Date(Number(valor.slice(0, 4)), Number(valor.slice(5, 7)) - 1, Number(valor.slice(8, 10))) : new Date(valor);
  const dia = (d.getFullYear() === new Date().getFullYear() ? DIA : DIA_ANIO).format(d).replace('.', '');
  return soloDia ? dia : `${dia}, ${HORA.format(d)}`;
}
/** Cómo pintar un vencimiento: cumplido, vencido, por vencer (menos de un día) o normal. */
export function estadoVence(vence: string | null, completada: boolean): '' | 'hecha' | 'vencida' | 'pronto' {
  if (!vence) return '';
  if (completada) return 'hecha';
  const falta = Date.parse(vence) - Date.now();
  return falta < 0 ? 'vencida' : falta < 86400_000 ? 'pronto' : '';
}
export const NOMBRE_ESTADO = { '': '', hecha: 'cumplida', vencida: 'vencida', pronto: 'vence pronto' };
/** Valor para un campo de fecha y hora del navegador, en la hora local de quien mira. */
export function aCampo(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function hace(iso: string): string {
  const seg = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (seg < 60) return 'recién';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
  return fechaCorta(iso);
}
export function peso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
}

// ---------- actividad ----------
export interface Actividad { id: string; tipo: string; actor: Persona | null; datos: Record<string, any>; creado_en: string; tarjeta_enlace?: string | null }
const N = (v: unknown) => <b>{String(v ?? '')}</b>;
/** Qué pasó, en palabras. `enTarjeta`: se lee desde adentro de la tarjeta (no hace falta nombrarla). */
export function describir(a: Actividad, enTarjeta: boolean): ReactNode {
  const d = a.datos;
  const esta = enTarjeta ? 'esta tarjeta' : <>la tarjeta {N(d.titulo)}</>;
  switch (a.tipo) {
    case 'tarjeta_creada': return <>creó {esta}{d.lista?.nombre ? <> en {N(d.lista.nombre)}</> : null}</>;
    case 'tarjeta_copiada': return <>creó {esta} copiando {N(d.de?.titulo)}</>;
    case 'tarjeta_renombrada': return <>cambió el título de {N(d.antes)} a {N(d.ahora)}</>;
    case 'tarjeta_descripcion': return <>cambió la descripción de {esta}</>;
    case 'tarjeta_movida': return d.a_tablero ? <>pasó {esta} del tablero {N(d.de_tablero?.nombre)} al tablero {N(d.a_tablero?.nombre)}</> : <>movió {esta} de {N(d.de_lista?.nombre)} a {N(d.a_lista?.nombre)}</>;
    case 'tarjeta_archivada': return <>archivó {esta}</>;
    case 'tarjeta_restaurada': return <>restauró {esta}</>;
    case 'tarjeta_vence': return <>puso el vencimiento de {esta} para el {N(fechaCorta(d.vence))}</>;
    case 'tarjeta_vence_quitada': return <>quitó el vencimiento de {esta}</>;
    case 'tarjeta_completada': return <>marcó {esta} como completada</>;
    case 'tarjeta_reabierta': return <>marcó {esta} como pendiente</>;
    case 'tarjeta_miembro_sumado': return <>sumó a {N(d.nombre)} a {esta}</>;
    case 'tarjeta_miembro_quitado': return <>quitó a {N(d.nombre)} de {esta}</>;
    case 'tarjeta_checklist_creada': return <>agregó la checklist {N(d.nombre)} a {esta}</>;
    case 'tarjeta_checklist_borrada': return <>borró la checklist {N(d.nombre)} de {esta}</>;
    case 'tarjeta_item_hecho': return <>tildó {N(d.texto)} en {esta}</>;
    case 'tarjeta_item_pendiente': return <>destildó {N(d.texto)} en {esta}</>;
    case 'tarjeta_adjunto_sumado': return <>adjuntó {N(d.nombre)} a {esta}</>;
    case 'tarjeta_adjunto_borrado': return <>borró el adjunto {N(d.nombre)} de {esta}</>;
    case 'tarjeta_comentada': return <>comentó en {esta}: “{String(d.texto ?? '')}”</>;
    case 'lista_creada': return <>creó la lista {N(d.nombre)}</>;
    case 'lista_renombrada': return <>cambió el nombre de la lista {N(d.antes)} a {N(d.ahora)}</>;
    case 'lista_archivada': return <>archivó la lista {N(d.nombre)}</>;
    case 'lista_restaurada': return <>restauró la lista {N(d.nombre)}</>;
    case 'lista_movida': return <>pasó la lista {N(d.nombre)} al tablero {N(d.a_tablero?.nombre)}</>;
    case 'lista_copiada': return <>copió la lista {N(d.de?.nombre)} como {N(d.nombre)}</>;
    case 'lista_ordenada': return <>ordenó las tarjetas de {N(d.nombre)}</>;
    case 'lista_tarjetas_movidas': return <>pasó {d.cantidad} tarjetas de {N(d.de_lista?.nombre)} a {N(d.a_lista?.nombre)}</>;
    case 'lista_tarjetas_archivadas': return <>archivó las {d.cantidad} tarjetas de {N(d.nombre)}</>;
    case 'tablero_creado': return <>creó este tablero</>;
    case 'tablero_renombrado': return <>cambió el nombre del tablero de {N(d.antes)} a {N(d.ahora)}</>;
    case 'tablero_visibilidad': return <>cambió quién ve el tablero</>;
    case 'tablero_cerrado': return <>cerró el tablero</>;
    case 'tablero_reabierto': return <>reabrió el tablero</>;
    case 'tablero_miembro_sumado': return <>sumó a {N(d.nombre)} al tablero</>;
    case 'tablero_miembro_quitado': return <>quitó a {N(d.nombre)} del tablero</>;
    default: return <>hizo un cambio</>;
  }
}
