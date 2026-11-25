// Utilidades chicas que usa todo el servidor.
import crypto from 'node:crypto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function textoAleatorio(largo: number): string {
  const bytes = crypto.randomBytes(largo);
  let s = '';
  for (let i = 0; i < largo; i++) s += ALFABETO[bytes[i] % ALFABETO.length];
  return s;
}
export const nuevoId = (): string => textoAleatorio(20);
export const nuevoEnlace = (): string => textoAleatorio(8);
export const nuevoToken = (): string => crypto.randomBytes(32).toString('base64url');
export const hashToken = (t: string): string => crypto.createHash('sha256').update(t).digest('hex');
export const ahora = (): string => new Date().toISOString();

/** Error con mensaje para la persona. El servidor lo convierte en una respuesta ordenada. */
export class ErrorApi extends Error {
  estado: number;
  codigo: string;
  constructor(estado: number, codigo: string, mensaje: string) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}
export const noAutenticado = () => new ErrorApi(401, 'sin_sesion', 'Tenés que iniciar sesión.');
export const sinPermiso = (m = 'No tenés permiso para hacer eso.') => new ErrorApi(403, 'sin_permiso', m);
export const noExiste = (m = 'No existe o no tenés acceso.') => new ErrorApi(404, 'no_existe', m);
export const datoInvalido = (m: string) => new ErrorApi(400, 'dato_invalido', m);

export function texto(v: unknown, campo: string, { min = 1, max = 200 } = {}): string {
  if (typeof v !== 'string') throw datoInvalido(`Falta ${campo}.`);
  const t = v.trim();
  if (t.length < min) throw datoInvalido(min === 1 ? `Falta ${campo}.` : `${campo} tiene que tener al menos ${min} caracteres.`);
  if (t.length > max) throw datoInvalido(`${campo} no puede tener más de ${max} caracteres.`);
  return t;
}
export function textoOpcional(v: unknown, campo: string, max = 2000): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw datoInvalido(`${campo} tiene que ser texto.`);
  if (v.length > max) throw datoInvalido(`${campo} no puede tener más de ${max} caracteres.`);
  return v.trim();
}
export function opcion<T extends string>(v: unknown, campo: string, validas: readonly T[]): T {
  if (typeof v !== 'string' || !validas.includes(v as T)) throw datoInvalido(`${campo} tiene que ser: ${validas.join(', ')}.`);
  return v as T;
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length >= 2 ? partes[0][0] + partes[partes.length - 1][0] : (partes[0] ?? '?').slice(0, 2);
  return letras.toUpperCase();
}
