// Mi cuenta: perfil, correo, contraseña, tema. Y, para la administración general, la gente de la instalación.
import { useState } from 'react';
import { api, subir, Avatar, Campo, CopiarEnlace, Formulario, leerTema, ponerTema, useAccion, useCarga, useSesion } from '../base.tsx';
import type { Tema, Yo } from '../base.tsx';
import { hace } from '../tablero/piezas.tsx';

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

/** Alex: el asistente (Claude) que maneja la app por su propia puerta. Acá se ve por dónde entra y se le corta el paso. */
function Alex() {
  const datos = useCarga<{ alex: { nombre: string } | null; direccion: string; llaves: { id: string; nombre: string; tipo: 'conexion' | 'fija'; creada_en: string; ultima_vez: string | null }[] }>('/api/admin/alex');
  const accion = useAccion();
  const [nombre, setNombre] = useState('');
  const [nueva, setNueva] = useState<string | null>(null);
  const d = datos.datos;
  if (!d) return null;
  return (
    <div className="panel" id="alex">
      <div className="columna" style={{ gap: 4 }}><h2>Alex</h2><p className="suave">Alex es tu asistente (Claude). Entra por una puerta propia, sin contraseña, y administra toda la instalación. Lo que hace queda en la actividad con su nombre.</p></div>
      {accion.error && <p className="error" role="alert">{accion.error}</p>}
      <div className="columna" style={{ gap: 8 }}>
        <p><b>Dirección para conectar a Claude</b></p>
        <p className="suave">En Claude: Conectores → Agregar conector personalizado → pegá esta dirección. Claude te trae de vuelta acá para que lo permitas.</p>
        <CopiarEnlace url={d.direccion} />
      </div>
      <div className="columna" style={{ gap: 8 }}>
        <p><b>Por dónde entra hoy</b></p>
        {d.llaves.length === 0 ? <p className="suave">Todavía por ningún lado.</p> : (
          <ul className="renglones">{d.llaves.map((l) => (
            <li key={l.id}>
              <span className="quien"><b>{l.nombre}</b><small>{l.tipo === 'conexion' ? 'Conexión permitida' : 'Llave fija'} · creada {hace(l.creada_en)} · {l.ultima_vez ? `último uso ${hace(l.ultima_vez)}` : 'sin usar'}</small></span>
              <button type="button" className="btn chico peligro" onClick={() => { if (confirm(`¿Cortar "${l.nombre}"? Deja de entrar en el momento.`)) void accion.hacer(async () => { await api('DELETE', `/api/admin/alex/llaves/${l.id}`); datos.recargar(); }); }}>Cortar</button>
            </li>
          ))}</ul>
        )}
      </div>
      <div className="columna" style={{ gap: 8 }}>
        <p><b>Llave fija</b></p>
        <p className="suave">Para programas que no pueden pedir permiso por pantalla (por ejemplo Claude Code). Quien tenga la llave maneja todo: guardala como una contraseña.</p>
        {nueva && <div className="columna" style={{ gap: 6 }}><p>Copiala ahora: no se vuelve a mostrar.</p><div className="codigo">{nueva}</div></div>}
        <form className="fila" onSubmit={(e) => { e.preventDefault(); void accion.hacer(async () => { const r = await api<{ llave: string }>('POST', '/api/admin/alex/llaves', { nombre }); setNueva(r.llave); setNombre(''); datos.recargar(); }); }}>
          <input type="text" aria-label="Nombre de la llave" placeholder="Para qué es (ej.: Claude Code)" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} style={{ flex: '1 1 200px' }} />
          <button type="submit" className="btn" disabled={accion.ocupado}>Crear llave</button>
        </form>
      </div>
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
  const foto = useAccion();
  return (
    <main className="pagina" style={{ maxWidth: 640 }}>
      <div className="encabezado"><Avatar p={yo} /><h1>Tu cuenta</h1></div>
      {yo.debe_cambiar_clave && <p className="error">Entraste con una contraseña temporal. Cambiala acá abajo.</p>}
      <div className="panel">
        <h2>Foto</h2>
        <div className="fila">
          <span className="foto-grande"><Avatar p={yo} /></span>
          <label className="como-boton btn">{yo.avatar ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void foto.hacer(async () => { await subir('/api/yo/avatar', f); await sesion.recargar(); }); }} /></label>
          {yo.avatar && <button type="button" className="btn peligro" onClick={() => foto.hacer(async () => { await api('DELETE', '/api/yo/avatar'); await sesion.recargar(); })}>Quitar</button>}
        </div>
        {foto.error && <p className="error" role="alert">{foto.error}</p>}
        <p className="suave" style={{ fontSize: 13 }}>Una imagen PNG, JPG, GIF o WebP de hasta 5 MB. Sin foto se muestran tus iniciales.</p>
      </div>
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
      {yo.es_admin_general && <Alex />}
      {yo.es_admin_general && <AdminGeneral />}
    </main>
  );
}
