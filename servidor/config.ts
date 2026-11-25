// Toda la configuración sale de variables de entorno. Nada sensible se escribe en el código.
import path from 'node:path';

export interface Config {
  puerto: number;
  dirDatos: string;
  zonaHoraria: string;
}

export function leerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    puerto: Number(env.PORT ?? 3000),
    dirDatos: path.resolve(env.DATA_DIR ?? './datos'),
    zonaHoraria: env.TZ ?? 'America/Argentina/Buenos_Aires',
  };
}
