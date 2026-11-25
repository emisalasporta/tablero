// ENSAYO: prueba rota a propósito para comprobar que una publicación con pruebas fallidas no sale.
import { expect, it } from 'vitest';
it('ensayo: esta prueba falla a propósito', () => { expect(1).toBe(2); });
