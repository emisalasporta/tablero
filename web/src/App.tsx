// Armazón de la app: la barra de arriba y qué pantalla corresponde a cada dirección.
import { api, Avatar, Enlace, navegar, useAccion, useRuta, useSesion } from './base.tsx';
import { Autorizar } from './pantallas/Autorizar.tsx';
import { Entrar, Invitacion } from './pantallas/Entrar.tsx';
import { Espacio } from './pantallas/Espacio.tsx';
import { Inicio } from './pantallas/Inicio.tsx';
import { Perfil } from './pantallas/Perfil.tsx';
import { Tablero } from './pantallas/Tablero.tsx';

function Barra() {
  const sesion = useSesion();
  const accion = useAccion();
  const salir = () => accion.hacer(async () => { await api('DELETE', '/api/sesion'); sesion.poner(null); navegar('/'); });
  return (
    <header className="barra">
      <Enlace a="/" className="marca"><i />meetmydash</Enlace>
      <span className="hueco" />
      {sesion.yo && (
        <>
          <Enlace a="/perfil" className="btn plano chico" title="Tu cuenta"><Avatar p={sesion.yo} chica /><span>{sesion.yo.nombre.split(' ')[0]}</span></Enlace>
          <button type="button" className="btn chico" onClick={salir}>Salir</button>
        </>
      )}
    </header>
  );
}

function Pantalla() {
  const { yo, cargando } = useSesion();
  const ruta = useRuta();
  const camino = ruta.split('?')[0];
  const partes = camino.split('/').filter(Boolean);
  if (cargando) return null;
  // Direcciones que se pueden abrir sin haber iniciado sesión.
  if (partes[0] === 'invitacion' && partes[1]) return <Invitacion token={partes[1]} />;
  // Un tablero (/t/…) o una tarjeta abierta sobre su tablero (/c/…): es la misma pantalla, para que abrir y cerrar una tarjeta no la rearme.
  if (partes[0] === 't' && partes[1]) return <Tablero enlace={partes[1]} />;
  if (partes[0] === 'c' && partes[1]) return <Tablero deTarjeta={partes[1]} />;
  if (!yo) return <Entrar volverA={camino === '/entrar' ? '/' : ruta} />;
  if (partes[0] === 'oauth' && partes[1] === 'autorizar') return <Autorizar />;
  if (partes[0] === 'e' && partes[1]) return <Espacio key={partes[1]} id={partes[1]} />;
  if (partes[0] === 'perfil') return <Perfil />;
  if (partes.length === 0 || partes[0] === 'entrar') return <Inicio />;
  return <main className="pagina"><h1>Esa página no existe</h1><Enlace a="/">Volver al inicio</Enlace></main>;
}

export function App() {
  return <div className="app"><Barra /><Pantalla /></div>;
}
