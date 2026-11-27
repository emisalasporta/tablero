// Página de un espacio de trabajo: sus tableros, su gente y sus ajustes.
import { useState } from 'react';
import { api, subir, Avatar, Campo, CopiarEnlace, Formulario, navegar, NOMBRE_VIS, useAccion, useCarga, useRuta, useSesion } from '../base.tsx';
import { GrillaTableros } from './Inicio.tsx';
import type { DatosInicio, ListaTableros } from './Inicio.tsx';

interface Ajustes { crear: Record<string, string>; borrar: Record<string, string>; invitados: string }
interface DatosEspacio { espacio: { id: string; nombre: string; descripcion: string; sitio_web: string; logo: string | null; visibilidad: string; ajustes?: Ajustes }; mi: { rol: string | null; invitado: boolean; administra: boolean } }
interface Persona { id: string; usuario: string; nombre: string; iniciales: string; avatar?: string | null; email?: string }
interface DatosMiembros { miembros: (Persona & { rol: string; desactivado: boolean })[]; invitados: (Persona & { tableros: number })[]; pedidos: { id: string; persona: Persona }[] }

function Miembros({ id, administra }: { id: string; administra: boolean }) {
  const { yo } = useSesion();
  const datos = useCarga<DatosMiembros>(`/api/espacios/${id}/miembros`);
  const inv = useCarga<{ invitacion: { id: string; usos: number } | null }>(administra ? `/api/espacios/${id}/invitacion` : null);
  const accion = useAccion();
  const [quien, setQuien] = useState('');
  const [enlace, setEnlace] = useState<string | null>(null);
  if (datos.error) return <p className="error">{datos.error.message}</p>;
  if (!datos.datos) return null;
  const d = datos.datos;
  const con = (f: () => Promise<unknown>) => accion.hacer(async () => { await f(); datos.recargar(); });
  return (
    <div className="columna" style={{ gap: 20 }}>
      {accion.error && <p className="error" role="alert">{accion.error}</p>}

      {d.pedidos.length > 0 && (
        <div className="panel">
          <h3>Pidieron sumarse</h3>
          <ul className="renglones">{d.pedidos.map((p) => (
            <li key={p.id}><Avatar p={p.persona} /><span className="quien"><b>{p.persona.nombre}</b><small>@{p.persona.usuario}</small></span>
              <button type="button" className="btn chico lleno" onClick={() => con(() => api('PATCH', `/api/pedidos/${p.id}`, { estado: 'aprobado' }))}>Aprobar</button>
              <button type="button" className="btn chico" onClick={() => con(() => api('PATCH', `/api/pedidos/${p.id}`, { estado: 'rechazado' }))}>Rechazar</button></li>
          ))}</ul>
        </div>
      )}

      <div className="panel">
        <div className="fila"><h3>Miembros</h3><span className="chapa">{d.miembros.length}</span></div>
        <ul className="renglones">{d.miembros.map((m) => (
          <li key={m.id} style={m.desactivado ? { opacity: 0.6 } : undefined}>
            <Avatar p={m} />
            <span className="quien"><b>{m.nombre}{m.id === yo?.id ? ' (vos)' : ''}</b><small>@{m.usuario}{m.email ? ` · ${m.email}` : ''}</small></span>
            {m.desactivado && <span className="chapa">Desactivado</span>}
            {administra ? (
              <>
                <select aria-label={`Rol de ${m.nombre}`} value={m.rol} onChange={(e) => con(() => api('PATCH', `/api/espacios/${id}/miembros/${m.id}`, { rol: e.target.value }))}>
                  <option value="admin">Administra</option><option value="normal">Miembro</option>
                </select>
                <button type="button" className="btn chico" onClick={() => con(() => api('PATCH', `/api/espacios/${id}/miembros/${m.id}`, { desactivado: !m.desactivado }))}>{m.desactivado ? 'Reactivar' : 'Desactivar'}</button>
                <button type="button" className="btn chico peligro" onClick={() => con(() => api('DELETE', `/api/espacios/${id}/miembros/${m.id}`))}>Quitar</button>
              </>
            ) : (
              <>
                <span className="chapa">{m.rol === 'admin' ? 'Administra' : 'Miembro'}</span>
                {m.id === yo?.id && <button type="button" className="btn chico peligro" onClick={() => accion.hacer(async () => { await api('DELETE', `/api/espacios/${id}/miembros/${m.id}`); navegar('/'); })}>Salir del espacio</button>}
              </>
            )}
          </li>
        ))}</ul>
      </div>

      {d.invitados.length > 0 && (
        <div className="panel">
          <div className="columna" style={{ gap: 4 }}><h3>Invitados</h3><p className="suave">Están en algún tablero sin ser miembros del espacio. Solo ven esos tableros.</p></div>
          <ul className="renglones">{d.invitados.map((m) => (
            <li key={m.id}><Avatar p={m} /><span className="quien"><b>{m.nombre}</b><small>@{m.usuario} · {m.tableros} {m.tableros === 1 ? 'tablero' : 'tableros'}</small></span>
              {administra && <>
                <button type="button" className="btn chico" onClick={() => con(() => api('POST', `/api/espacios/${id}/miembros`, { usuario_id: m.id }))}>Hacer miembro</button>
                <button type="button" className="btn chico peligro" onClick={() => con(() => api('DELETE', `/api/espacios/${id}/miembros/${m.id}?de_tableros=1`))}>Quitar de los tableros</button>
              </>}</li>
          ))}</ul>
        </div>
      )}

      {administra && (
        <div className="panel">
          <h3>Sumar gente</h3>
          <Formulario boton="Sumar al espacio" alEnviar={async () => { await api('POST', `/api/espacios/${id}/miembros`, { quien }); setQuien(''); datos.recargar(); }}>
            <Campo rotulo="Alguien que ya tiene cuenta" ayuda="Escribí su correo o su nombre de usuario exacto."><input id="sumar-quien" type="text" value={quien} onChange={(e) => setQuien(e.target.value)} required /></Campo>
          </Formulario>
          <div className="columna" style={{ gap: 8, borderTop: '1px solid var(--linea)', paddingTop: 14 }}>
            <p><b>Enlace de invitación</b></p>
            <p className="suave">Quien lo abra puede crear su cuenta y queda como miembro. Hay un solo enlace vivo: crear uno nuevo anula el anterior.</p>
            {enlace ? <CopiarEnlace url={enlace} /> : inv.datos?.invitacion ? <p className="suave">Hay un enlace vivo, usado {inv.datos.invitacion.usos} {inv.datos.invitacion.usos === 1 ? 'vez' : 'veces'}. Por seguridad no se vuelve a mostrar: si no lo tenés, creá uno nuevo.</p> : null}
            <div className="fila">
              <button type="button" className="btn" onClick={() => accion.hacer(async () => { const r = await api<{ token: string }>('POST', `/api/espacios/${id}/invitacion`); setEnlace(`${location.origin}/invitacion/${r.token}`); inv.recargar(); })}>Crear enlace nuevo</button>
              {(enlace || inv.datos?.invitacion) && <button type="button" className="btn peligro" onClick={() => accion.hacer(async () => { await api('DELETE', `/api/espacios/${id}/invitacion`); setEnlace(null); inv.recargar(); })}>Anular enlace</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const QUIEN: [string, string][] = [['miembros', 'Cualquier miembro'], ['admins', 'Solo quien administra'], ['nadie', 'Nadie']];
const QUIEN_BORRA: [string, string][] = [['miembros', 'Quien administra el tablero'], ['admins', 'Solo quien administra el espacio'], ['nadie', 'Nadie']];

function AjustesEspacio({ d, alGuardar }: { d: DatosEspacio; alGuardar: () => void }) {
  const e = d.espacio;
  const [nombre, setNombre] = useState(e.nombre);
  const [descripcion, setDescripcion] = useState(e.descripcion);
  const [sitio, setSitio] = useState(e.sitio_web);
  const [vis, setVis] = useState(e.visibilidad);
  const [aj, setAj] = useState<Ajustes>(e.ajustes!);
  const [guardado, setGuardado] = useState(false);
  const accion = useAccion();
  const fila = (grupo: 'crear' | 'borrar', v: string, opciones: [string, string][]) => (
    <Campo key={grupo + v} rotulo={`Tableros ${NOMBRE_VIS[v].toLowerCase()}`}>
      <select id={`aj-${grupo}-${v}`} value={aj[grupo][v]} onChange={(ev) => setAj({ ...aj, [grupo]: { ...aj[grupo], [v]: ev.target.value } })}>{opciones.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
    </Campo>
  );
  return (
    <div className="columna" style={{ gap: 20 }}>
      <div className="panel">
        <Formulario boton="Guardar cambios" secundario={guardado ? <span className="ok">Guardado</span> : undefined} alEnviar={async () => {
          setGuardado(false);
          await api('PATCH', `/api/espacios/${e.id}`, { nombre, descripcion, sitio_web: sitio, visibilidad: vis, ajustes: aj });
          setGuardado(true); alGuardar();
        }}>
          <h3>Datos del espacio</h3>
          <Campo rotulo="Nombre"><input id="aj-nombre" type="text" value={nombre} onChange={(ev) => setNombre(ev.target.value)} required maxLength={100} /></Campo>
          <Campo rotulo="Descripción"><textarea id="aj-desc" value={descripcion} onChange={(ev) => setDescripcion(ev.target.value)} maxLength={2000} /></Campo>
          <Campo rotulo="Sitio web"><input id="aj-sitio" type="url" value={sitio} onChange={(ev) => setSitio(ev.target.value)} placeholder="https://" /></Campo>
          <Campo rotulo="Quién ve el espacio" ayuda={vis === 'publico' ? 'Cualquiera con el enlace ve el nombre del espacio y sus tableros públicos.' : 'Solo sus miembros (y los invitados, que ven solo sus tableros).'}>
            <select id="aj-vis" value={vis} onChange={(ev) => setVis(ev.target.value)}><option value="privado">Privado</option><option value="publico">Público</option></select>
          </Campo>
          <h3 style={{ marginTop: 8 }}>Quién puede crear tableros</h3>
          {['privado', 'espacio', 'publico'].map((v) => fila('crear', v, QUIEN))}
          <h3 style={{ marginTop: 8 }}>Quién puede borrar tableros</h3>
          {['privado', 'espacio', 'publico'].map((v) => fila('borrar', v, QUIEN_BORRA))}
          <h3 style={{ marginTop: 8 }}>Invitados</h3>
          <Campo rotulo="Quién puede sumar a un tablero a gente de afuera del espacio">
            <select id="aj-invitados" value={aj.invitados} onChange={(ev) => setAj({ ...aj, invitados: ev.target.value })}><option value="miembros">Quien pueda sumar gente al tablero</option><option value="admins">Solo quien administra el espacio</option></select>
          </Campo>
        </Formulario>
      </div>
      <div className="panel">
        <h3>Logo</h3>
        <div className="fila">
          {e.logo ? <img className="logo" src={`/api/fotos/${e.logo}`} alt="Logo actual" /> : <span className="suave">Este espacio no tiene logo.</span>}
          <label className="como-boton btn">{e.logo ? 'Cambiar logo' : 'Subir logo'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void accion.hacer(async () => { await subir(`/api/espacios/${e.id}/logo`, f); alGuardar(); }); }} /></label>
          {e.logo && <button type="button" className="btn peligro" onClick={() => accion.hacer(async () => { await api('DELETE', `/api/espacios/${e.id}/logo`); alGuardar(); })}>Quitar</button>}
        </div>
        <p className="suave" style={{ fontSize: 13 }}>Una imagen PNG, JPG, GIF o WebP de hasta 5 MB.</p>
      </div>
      <div className="panel">
        <h3>Borrar el espacio</h3>
        <p className="suave">Solo se puede si no tiene tableros abiertos. No se puede deshacer.</p>
        {accion.error && <p className="error" role="alert">{accion.error}</p>}
        <div><button type="button" className="btn peligro" disabled={accion.ocupado} onClick={() => accion.hacer(async () => { await api('DELETE', `/api/espacios/${e.id}`); navegar('/'); })}>Borrar este espacio</button></div>
      </div>
    </div>
  );
}

export function Espacio({ id }: { id: string }) {
  const { yo } = useSesion();
  const ruta = useRuta();
  const ver = new URLSearchParams(ruta.split('?')[1] ?? '').get('ver') ?? 'tableros';
  const datos = useCarga<DatosEspacio>(`/api/espacios/${id}`);
  const lista = useCarga<ListaTableros>(`/api/espacios/${id}/tableros`);
  const resumenes = useCarga<DatosInicio>('/api/yo/inicio');
  const accion = useAccion();
  const [pedido, setPedido] = useState(false);
  if (datos.error) return <main className="pagina"><h1>No encontramos ese espacio</h1><p className="suave">{datos.error.message}</p></main>;
  if (!datos.datos) return null;
  const { espacio: e, mi } = datos.datos;
  const esMiembro = mi.rol !== null || mi.administra;
  const pestana = !esMiembro ? 'tableros' : ver === 'ajustes' && !mi.administra ? 'tableros' : ver;
  return (
    <main className="pagina">
      <div className="columna" style={{ gap: 8 }}>
        <div className="encabezado">
          {e.logo && <img className="logo" src={`/api/fotos/${e.logo}`} alt="" />}
          <h1>{e.nombre}</h1>
          <span className="chapa">{e.visibilidad === 'publico' ? 'Espacio público' : 'Espacio privado'}</span>
          {mi.invitado && <span className="chapa">Sos invitado</span>}
        </div>
        {e.descripcion && <p className="suave" style={{ maxWidth: '70ch', whiteSpace: 'pre-wrap' }}>{e.descripcion}</p>}
        {e.sitio_web && <p><a href={e.sitio_web} target="_blank" rel="noreferrer noopener">{e.sitio_web}</a></p>}
        {!esMiembro && yo && (
          <div className="fila">
            {pedido ? <span className="ok">Pedido enviado. Falta que lo aprueben.</span> : <button type="button" className="btn" onClick={() => accion.hacer(async () => { await api('POST', `/api/espacios/${id}/pedidos`); setPedido(true); })}>Pedir sumarme al espacio</button>}
            {accion.error && <span className="error">{accion.error}</span>}
          </div>
        )}
      </div>
      {esMiembro && (
        <div className="pestanas" role="tablist">
          {([['tableros', 'Tableros'], ['miembros', 'Miembros'], ...(mi.administra ? [['ajustes', 'Ajustes']] : [])] as [string, string][]).map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={pestana === k} onClick={() => navegar(k === 'tableros' ? `/e/${id}` : `/e/${id}?ver=${k}`, true)}>{t}</button>
          ))}
        </div>
      )}
      {pestana === 'tableros' && lista.datos && <GrillaTableros espacio={e} lista={lista.datos} resumenes={resumenes.datos?.tableros} />}
      {pestana === 'miembros' && <Miembros id={id} administra={mi.administra} />}
      {pestana === 'ajustes' && e.ajustes && <AjustesEspacio d={datos.datos} alGuardar={datos.recargar} />}
    </main>
  );
}
