// Contraseñas: se guarda solo una huella irreversible (scrypt). Nadie puede leer la contraseña original.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (clave: string, sal: Buffer, largo: number) => Promise<Buffer>;

export async function hashClave(clave: string): Promise<string> {
  const sal = crypto.randomBytes(16);
  const huella = await scrypt(clave, sal, 64);
  return `scrypt$${sal.toString('hex')}$${huella.toString('hex')}`;
}

export async function verificarClave(clave: string, guardada: string): Promise<boolean> {
  const [algoritmo, salHex, huellaHex] = guardada.split('$');
  if (algoritmo !== 'scrypt' || !salHex || !huellaHex) return false;
  const esperada = Buffer.from(huellaHex, 'hex');
  const calculada = await scrypt(clave, Buffer.from(salHex, 'hex'), esperada.length);
  return crypto.timingSafeEqual(esperada, calculada);
}
