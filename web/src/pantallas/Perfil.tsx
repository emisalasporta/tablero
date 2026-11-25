// Mi cuenta: perfil, correo, contraseña, tema. Y, para la administración general, la gente de la instalación.
import { useState } from 'react';
import { api, Avatar, Campo, CopiarEnlace, Formulario, leerTema, ponerTema, useAccion, useCarga, useSesion } from '../base.tsx';
import type { Tema, Yo } from '../base.tsx';

function AdminGeneral() {
  const lista = useCarga<{ usuarios: { id: string; usuario: string; nombre: string; iniciales: string; email: string; es_admin_general: boolean; es_robot: boolean }[] }>('/api/admin/usuarios');
  const accion = useAccion();
  const [enlace, setEnlace] = useState<string | null>(null);
  const [temporal, setTemporal] = useState<{ nombre: string; clave: string } | null>(null);
  return (
    <div className="panel">
      <div className="columna" style={{ gap: 4 }}><h2>Administración general</h2><p className="suave">Solo vos ves esta parte: todas las cuentas de la instalación.</p></div>
      {accion.error && <p className="error" role="alert">{accion.error}</p>}
      <div className="columna" style={{ gap: 8 }}>
        <p><b>Invitar a alguien a crear su cuenta</b></p>
        <p className="suave">El enlace sirve para crear una cuenta sin entrar todavía a ningún espacio. Crear uno nuevo anula el anterior.</p>
        {enlace && <CopiarEnlace url={enlace} />}
        <div><button type="button" className="btn" onClick={() => accion.hacer(async () => { const r = await api<{ token: string }>('POST', '/api/admin/invitaciones'); setEnlace(`${location.origin}/invitacion/${r.token}`); })}>Crear enlace de invitación</button></div>
      </div>
      {temporal && <div className="columna" style={{ gap: 6 }}><p>Contraseña temporal de <b>{temporal.nombre}</b>. Pasásela por un medio seguro; no se vuelve a mostrar.</p><div className="codigo">{temporal.clave}</div></div>}
      <ul className="renglones">{lista.datos?.usuarios.map((u) => (
        <li key={u.id}><Avatar p={u} /><span className="quien"><b>{u.nombre}</b><small>@{u.usuario} · {u.email}</small></span>
          {u.es_admin_general && <span className="chapa acento">Administración general</span>}
          {!u.es_robot && <button type="button" className="btn chico" onClick={() => accion.hacer(async () => { const r = await api<{ clave_temporal: string }>('POST', `/api/admin/usuarios/${u.id}/clave-temporal`); setTemporal({ nombre: u.nombre, clave: r.clave_temporal }); })}>Dar contraseña temporal</button>}
        </li>
      ))}</ul>
    </div>
  );
}

export function Perfil() {
  const sesion = useSesion();
  const yo = sesion.yo!;
  const [nombre, setNombre] = useState(yo.nombre);
  const [usuario, setUsuario] = useState(yo.usuario);
  const [bio, setBio] = useState(yo.bio);
  const [zona, setZona] = useState(yo.zona_horaria);
  const [okPerfil, setOkPerfil] = useState(false);
  const [email, setEmail] = useState(yo.email);
  const [claveEmail, setClaveEmail] = useState('');
  const [okEmail, setOkEmail] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [okClave, setOkClave] = useState(false);
  const [tema, setTema] = useState<Tema>(leerTema());
  return (
    <main className="pagina" style={{ maxWidth: 640 }}>
      <div className="encabezado"><Avatar p={yo} /><h1>Tu cuenta</h1></div>
      {yo.debe_cambiar_clave && <p className="error">Entraste con una contraseña temporal. Cambiala acá abajo.</p>}
      <div className="panel">
        <Formulario boton="Guardar perfil" secundario={okPerfil ? <span className="ok">Guardado</span> : undefined} alEnviar={async () => {
          setOkPerfil(false);
          sesion.poner((await api<{ usuario: Yo }>('PATCH', '/api/yo', { nombre, usuario, bio, zona_horaria: zona })).usuario);
          setOkPerfil(true);
        }}>
          <h2>Perfil</h2>
          <Campo rotulo="Nombre"><input id="pf-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} /></Campo>
          <Campo rotulo="Nombre de usuario" ayuda="Para que te mencionen con @. Minúsculas, números o guion bajo."><input id="pf-usuario" type="text" value={usuario} onChange={(e) => setUsuario(e.target.value)} required maxLength={30} /></Campo>
          <Campo rotulo="Sobre vos (opcional)"><textarea id="pf-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} /></Campo>
          <Campo rotulo="Zona horaria" ayuda="Por ejemplo: America/Argentina/Buenos_Aires"><input id="pf-zona" type="text" value={zona} onChange={(e) => setZona(e.target.value)} required /></Campo>
        </Formulario>
      </div>
      <div className="panel">
        <h2>Apariencia</h2>
        <Campo rotulo="Tema">
          <select id="pf-tema" value={tema} onChange={(e) => { const t = e.target.value as Tema; setTema(t); ponerTema(t); }}>
            <option value="sistema">Igual que el dispositivo</option><option value="claro">Claro</option><option value="oscuro">Oscuro</option>
          </select>
        </Campo>
      </div>
      <div className="panel">
        <Formulario boton="Cambiar correo" secundario={okEmail ? <span className="ok">Cambiado</span> : undefined} alEnviar={async () => {
          setOkEmail(false);
          sesion.poner((await api<{ usuario: Yo }>('POST', '/api/yo/email', { email, clave: claveEmail })).usuario);
          setClaveEmail(''); setOkEmail(true);
        }}>
          <h2>Correo</h2>
          <Campo rotulo="Correo"><input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Campo>
          <Campo rotulo="Tu contraseña, para confirmar"><input id="pf-email-clave" type="password" value={claveEmail} onChange={(e) => setClaveEmail(e.target.value)} autoComplete="current-password" required /></Campo>
        </Formulario>
      </div>
      <div className="panel">
        <Formulario boton="Cambiar contraseña" secundario={okClave ? <span className="ok">Cambiada. Se cerraron tus otras sesiones.</span> : undefined} alEnviar={async () => {
          setOkClave(false);
          await api('POST', '/api/yo/clave', { actual, nueva });
          setActual(''); setNueva(''); setOkClave(true);
          await sesion.recargar();
        }}>
          <h2>Contraseña</h2>
          <Campo rotulo="Contraseña actual"><input id="pf-actual" type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required /></Campo>
          <Campo rotulo="Contraseña nueva" ayuda="Al menos 8 caracteres."><input id="pf-nueva" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" minLength={8} required /></Campo>
        </Formulario>
      </div>
      {yo.es_admin_general && <AdminGeneral />}
    </main>
  );
}
