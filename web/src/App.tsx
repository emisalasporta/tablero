// Pantalla provisoria de la tanda 2.0: solo confirma que la app está publicada y qué versión corre.
import { useEffect, useState } from 'react';

interface Salud { ok: boolean; version: string; commit: string; armada_en: string | null; migraciones: number }

export function App() {
  const [salud, setSalud] = useState<Salud | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/salud')
      .then((r) => r.json() as Promise<Salud>)
      .then(setSalud)
      .catch(() => setError('No se pudo hablar con el servidor.'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '15vh auto', padding: '0 20px', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>meetmydash</h1>
      <p>La app está en construcción. Esta pantalla solo confirma que la publicación funciona.</p>
      {error && <p role="alert">{error}</p>}
      {salud && (
        <p style={{ fontVariantNumeric: 'tabular-nums' }}>
          Versión {salud.version} · cambio {salud.commit}
          {salud.armada_en ? ` · armada el ${new Date(salud.armada_en).toLocaleString('es-AR')}` : ''}
        </p>
      )}
    </main>
  );
}
