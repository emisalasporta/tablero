// Toda la configuración sale de variables de entorno. Nada sensible se escribe en el código.
import path from 'node:path';
import type { ConfigExterno } from './respaldo.ts';
import type { ConfigDokploy } from './rutas/servidor.ts';

export interface Config {
  puerto: number;
  dirDatos: string;
  zonaHoraria: string;
  /** Tope de cada archivo adjunto, en MB. Cloudflare (plan gratis) no deja pasar más de 100. */
  maxAdjuntoMb: number;
  /** Dirección pública (https://…), para la puerta de Alex. Si falta, se deduce de cada pedido. */
  urlPublica?: string;
  /** Copia del respaldo fuera del servidor: se enciende cuando están las cuatro variables R2_*. */
  externo: ConfigExterno | null;
  /** Acceso a Dokploy: se enciende cuando están las tres variables DOKPLOY_*. */
  dokploy: ConfigDokploy | null;
  /** Nombre de un respaldo a restaurar al arrancar (una sola vez). */
  restaurar?: string;
}

export function leerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    puerto: Number(env.PORT ?? 3000),
    dirDatos: path.resolve(env.DATA_DIR ?? './datos'),
    zonaHoraria: env.TZ ?? 'America/Argentina/Buenos_Aires',
    maxAdjuntoMb: Number(env.MAX_ADJUNTO_MB ?? 100),
    urlPublica: env.URL_PUBLICA || undefined,
    externo: env.R2_ENDPOINT && env.R2_BUCKET && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
      ? { endpoint: env.R2_ENDPOINT, deposito: env.R2_BUCKET, clave: env.R2_ACCESS_KEY_ID, secreto: env.R2_SECRET_ACCESS_KEY } : null,
    dokploy: env.DOKPLOY_URL && env.DOKPLOY_API_KEY && env.DOKPLOY_APP_ID ? { url: env.DOKPLOY_URL, clave: env.DOKPLOY_API_KEY, app: env.DOKPLOY_APP_ID } : null,
    restaurar: env.RESTAURAR || undefined,
  };
}
