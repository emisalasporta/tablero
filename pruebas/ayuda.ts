// Utilidad para las pruebas: cada prueba usa una carpeta de datos temporal propia.
// Nunca se tocan datos de verdad.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function carpetaTemporal(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'meetmydash-prueba-'));
}
