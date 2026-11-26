// Memoria corta de errores: los últimos 100 fallos del servidor, para poder leerlos sin entrar a la máquina.
// Se borra cada vez que la app arranca (no es un archivo). También salen por la consola, como siempre.
export interface ErrorAnotado { cuando: string; donde: string; mensaje: string; detalle: string }
const MAX = 100;
const errores: ErrorAnotado[] = [];

export function anotarError(donde: string, e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e));
  console.error(`[${donde}]`, err);
  errores.unshift({ cuando: new Date().toISOString(), donde: donde.slice(0, 200), mensaje: err.message.slice(0, 500), detalle: (err.stack ?? '').split('\n').slice(1, 6).join('\n') });
  if (errores.length > MAX) errores.length = MAX;
}
export const erroresRecientes = (): ErrorAnotado[] => [...errores];
export const arrancoEn = new Date().toISOString();
