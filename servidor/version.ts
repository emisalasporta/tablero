// Qué versión está corriendo. El archivo version.json lo escribe scripts/version.mjs al armar la app.
import fs from 'node:fs';
import path from 'node:path';

export interface Version { version: string; commit: string; armada_en: string | null }

export function leerVersion(): Version {
  const raiz = path.join(import.meta.dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')) as { version: string };
  try {
    const v = JSON.parse(fs.readFileSync(path.join(raiz, 'dist', 'version.json'), 'utf8')) as Partial<Version>;
    return { version: pkg.version, commit: v.commit ?? 'desconocido', armada_en: v.armada_en ?? null };
  } catch {
    return { version: pkg.version, commit: 'desarrollo', armada_en: null };
  }
}
