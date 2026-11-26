// Toda la configuración sale de variables de entorno. Nada sensible se escribe en el código.
import path from 'node:path';

export interface Config {
  puerto: number;
  dirDatos: string;
  zonaHoraria: string;
  /** Tope de cada archivo adjunto, en MB. Cloudflare (plan gratis) no deja pasar más de 100. */
  maxAdjuntoMb: number;
  /** Dirección pública (https://…), para la puerta de Alex. Si falta, se deduce de cada pedido. */
  urlPublica?: string;
}

export function leerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    puerto: Number(env.PORT ?? 3000),
    dirDatos: path.resolve(env.DATA_DIR ?? './datos'),
    zonaHoraria: env.TZ ?? 'America/Argentina/Buenos_Aires',
    maxAdjuntoMb: Number(env.MAX_ADJUNTO_MB ?? 100),
    urlPublica: env.URL_PUBLICA || undefined,
  };
}
