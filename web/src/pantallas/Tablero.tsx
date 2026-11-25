// Página de un tablero. En esta tanda: cabecera, quién lo ve, su gente y sus permisos.
// Las listas y las tarjetas llegan en la tanda 2.2.
import { useState } from 'react';
import { api, Avatar, AYUDA_VIS, Campo, CopiarEnlace, Dialogo, Enlace, Formulario, navegar, NOMBRE_ROL, NOMBRE_VIS, useAccion, useCarga, useSesion } from '../base.tsx';
import { Entrar } from './Entrar.tsx';

interface Persona { id: string; usuario: string; nombre: string; iniciales: string }
interface Permisos { comentar: string; invitar: string; union_libre: boolean; edicion_espacio: boolean }
interface Puede { ver: boolean; editar: boolean; administrar: boolean; comentar: boolean; invitar: boolean; invitar_de_afuera: boolean; unirse: boolean; borrar: boolean }
interface Datos {
  tablero: { id: string; enlace: string; nombre: string; descripcion: string; visibilidad: string; cerrado: boolean; permisos: Permisos };
  espacio: { id: string; nombre: string };
  miembros: (Persona & { rol: string; invitado: boolean })[];
  pedidos: { id: string; persona: Persona }[];
  mi: { rol: string | null; rol_espacio: string | null; puede: Puede };
}

function Compartir({ d, alCambiar, alCerrar }: { d: Datos; alCambiar: () => void; alCerrar: () => void }) {
  const { yo } = useSesion();
  const t = d.tablero;
  const accion = useAccion();
  const [quien, setQuien] = useState('');
  const [rol, setRol] = useState('normal');
  const [rolEnlace, setRolEnlace] = useState('normal');
  const [enlace, setEnlace] = useState<string | null>(null);
  const con = (f: () => Promise<unknown>) => accion.hacer(async () => { await f(); alCambiar(); });
  return (
    <Dialogo titulo="Compartir el tablero" alCerrar={alCerrar}>
      {accion.error && <p className="error" role="alert">{accion.error}</p>}
      {d.pedidos.length > 0 && (
        <div className="columna" style={{ gap: 6 }}>
          <p className="rotulo">Pidieron acceso</p>
          <ul className="renglones">{d.pedidos.map((p) => (
            <li key={p.id}><Avatar p={p.persona} /><span className="quien"><b>{p.persona.nombre}</b><small>@{p.persona.usuario}</small></span>
              <button type="button" className="btn chico lleno" onClick={() => con(() => api('PATCH', `/api/pedidos/${p.id}`, { estado: 'aprobado' }))}>Aprobar</button>
              <button type="button" className="btn chico" onClick={() => con(() => api('PATCH', `/api/pedidos/${p.id}`, { estado: 'rechazado' }))}>Rechazar</button></li>
          ))}</ul>
        </div>
      )}
      {d.mi.puede.invitar && (
        <Formulario boton="Sumar al tablero" alEnviar={async () => { await api('POST', `/api/tableros/${t.id}/miembros`, { quien, rol }); setQuien(''); alCambiar(); }}>
          <Campo rotulo="Sumar a alguien que ya tiene cuenta" ayuda="Su correo o su nombre de usuario exacto."><input id="comp-quien" type="text" value={quien} onChange={(e) => setQuien(e.target.value)} required /></Campo>
          <Campo rotulo="Como">
            <select id="comp-rol" value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="normal">Miembro: ve y edita</option><option value="observador">Observa: ve, no edita</option>{d.mi.puede.administrar && <option value="admin">Administra</option>}
            </select>
          </Campo>
        </Formulario>
      )}
      {d.mi.puede.invitar_de_afuera && (
        <div className="columna" style={{ gap: 8, borderTop: '1px solid var(--linea)', paddingTop: 14 }}>
          <p><b>Enlace de invitación</b></p>
          <p className="suave">Quien lo abra entra a este tablero (si no tiene cuenta, la crea). Crear uno nuevo anula el anterior.</p>
          {enlace && <CopiarEnlace url={enlace} />}
          <div className="fila">
            <select aria-label="Rol del enlace" value={rolEnlace} onChange={(e) => setRolEnlace(e.target.value)}><option value="normal">Entra como miembro</option><option value="observador">Entra como observador</option></select>
            <button type="button" className="btn" onClick={() => accion.hacer(async () => { const r = await api<{ token: string }>('POST', `/api/tableros/${t.id}/invitacion`, { rol: rolEnlace }); setEnlace(`${location.origin}/invitacion/${r.token}`); })}>Crear enlace</button>
            <button type="button" className="btn peligro" onClick={() => accion.hacer(async () => { await api('DELETE', `/api/tableros/${t.id}/invitacion`); setEnlace(null); })}>Anular enlace</button>
          </div>
        </div>
      )}
      <div className="columna" style={{ gap: 6, borderTop: '1px solid var(--linea)', paddingTop: 14 }}>
        <p className="rotulo">En el tablero ({d.miembros.length})</p>
        <ul className="renglones">{d.miembros.map((m) => (
          <li key={m.id}>
            <Avatar p={m} />
            <span className="quien"><b>{m.nombre}{m.id === yo?.id ? ' (vos)' : ''}</b><small>@{m.usuario}{m.invitado ? ' · invitado' : ''}</small></span>
            {d.mi.puede.administrar ? (
              <select aria-label={`Rol de ${m.nombre}`} value={m.rol} onChange={(e) => con(() => api('PATCH', `/api/tableros/${t.id}/miembros/${m.id}`, { rol: e.target.value }))}>
                <option value="admin">Administra</option><option value="normal">Miembro</option><option value="observador">Observa</option>
              </select>
            ) : <span className="chapa">{NOMBRE_ROL[m.rol]}</span>}
            {(m.id === yo?.id || d.mi.puede.administrar || (d.mi.puede.invitar && m.rol !== 'admin')) && (
              <button type="button" className="btn chico peligro" onClick={() => con(() => api('DELETE', `/api/tableros/${t.id}/miembros/${m.id}`))}>{m.id === yo?.id ? 'Salir' : 'Quitar'}</button>
            )}
          </li>
        ))}</ul>
      </div>
    </Dialogo>
  );
}

const COMENTAR: [string, string][] = [['nadie', 'Nadie'], ['miembros', 'Miembros del tablero'], ['observadores', 'Miembros y observadores'], ['espacio', 'Miembros del espacio de trabajo'], ['cualquiera', 'Cualquier persona con cuenta']];

function Ajustes({ d, alCambiar, alCerrar }: { d: Datos; alCambiar: () => void; alCerrar: () => void }) {
  const t = d.tablero;
  const [nombre, setNombre] = useState(t.nombre);
  const [vis, setVis] = useState(t.visibilidad);
  const [p, setP] = useState<Permisos>(t.permisos);
  const accion = useAccion();
  return (
    <Dialogo titulo="Ajustes del tablero" alCerrar={alCerrar}>
      <Formulario boton="Guardar" alEnviar={async () => { await api('PATCH', `/api/tableros/${t.id}`, { nombre, visibilidad: vis, permisos: p }); alCambiar(); alCerrar(); }}>
        <Campo rotulo="Nombre"><input id="ta-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={200} /></Campo>
        <Campo rotulo="Quién lo ve" ayuda={AYUDA_VIS[vis]}>
          <select id="ta-vis" value={vis} onChange={(e) => setVis(e.target.value)}>{['privado', 'espacio', 'publico'].map((v) => <option key={v} value={v}>{NOMBRE_VIS[v]}</option>)}</select>
        </Campo>
        <Campo rotulo="Quién puede comentar">
          <select id="ta-comentar" value={p.comentar} onChange={(e) => setP({ ...p, comentar: e.target.value })}>{COMENTAR.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        </Campo>
        <Campo rotulo="Quién puede sumar y quitar gente">
          <select id="ta-invitar" value={p.invitar} onChange={(e) => setP({ ...p, invitar: e.target.value })}><option value="miembros">Cualquier miembro del tablero</option><option value="admins">Solo quien administra</option></select>
        </Campo>
        <label className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input id="ta-edicion" type="checkbox" checked={p.edicion_espacio} onChange={(e) => setP({ ...p, edicion_espacio: e.target.checked })} /><span>Los miembros del espacio pueden editar sin estar sumados al tablero <small className="suave">(no aplica si es privado)</small></span></label>
        <label className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input id="ta-union" type="checkbox" checked={p.union_libre} onChange={(e) => setP({ ...p, union_libre: e.target.checked })} /><span>Los miembros del espacio pueden sumarse solos <small className="suave">(no aplica si es privado)</small></span></label>
      </Formulario>
      <div className="columna" style={{ gap: 8, borderTop: '1px solid var(--linea)', paddingTop: 14 }}>
        <p><b>{t.cerrado ? 'Tablero cerrado' : 'Cerrar el tablero'}</b></p>
        <p className="suave">{t.cerrado ? 'Podés reabrirlo o borrarlo para siempre.' : 'Queda guardado sin que nadie pueda editarlo. Se puede reabrir cuando quieras.'}</p>
        {accion.error && <p className="error" role="alert">{accion.error}</p>}
        <div className="fila">
          <button type="button" className="btn" onClick={() => accion.hacer(async () => { await api('PATCH', `/api/tableros/${t.id}`, { cerrado: !t.cerrado }); alCambiar(); alCerrar(); })}>{t.cerrado ? 'Reabrir' : 'Cerrar tablero'}</button>
          {t.cerrado && d.mi.puede.borrar && <button type="button" className="btn peligro" onClick={() => accion.hacer(async () => { await api('DELETE', `/api/tableros/${t.id}`); navegar(`/e/${d.espacio.id}`); })}>Borrar para siempre</button>}
        </div>
      </div>
    </Dialogo>
  );
}

export function Tablero({ enlace }: { enlace: string }) {
  const { yo } = useSesion();
  const datos = useCarga<Datos>(`/api/tableros/${enlace}`);
  const accion = useAccion();
  const [abierto, setAbierto] = useState<'compartir' | 'ajustes' | null>(null);
  const [pedido, setPedido] = useState(false);

  if (datos.error) {
    if (datos.error.estado === 401) return <Entrar volverA={`/t/${enlace}`} />;
    if (datos.error.codigo === 'sin_acceso') return (
      <main className="pagina angosta"><div className="panel angosto">
        <h1>Este tablero es privado</h1>
        <p className="suave">Estás como {yo?.nombre}. Podés pedir acceso y alguien del tablero lo va a ver.</p>
        {accion.error && <p className="error" role="alert">{accion.error}</p>}
        {pedido ? <p className="ok">Pedido enviado. Cuando lo aprueben vas a poder entrar.</p> : <div><button type="button" className="btn lleno" onClick={() => accion.hacer(async () => { await api('POST', `/api/tableros/${enlace}/pedidos`); setPedido(true); })}>Pedir acceso</button></div>}
        <Enlace a="/">Volver al inicio</Enlace>
      </div></main>
    );
    return <main className="pagina"><h1>No encontramos ese tablero</h1><p className="suave">Puede que lo hayan borrado o que el enlace esté mal.</p><Enlace a="/">Volver al inicio</Enlace></main>;
  }
  if (!datos.datos) return null;
  const d = datos.datos;
  const t = d.tablero;
  return (
    <div className="tablero">
      {t.cerrado && <div className="franja">Este tablero está cerrado: se puede ver pero no editar.{d.mi.puede.administrar && <button type="button" className="btn chico" onClick={() => accion.hacer(async () => { await api('PATCH', `/api/tableros/${t.id}`, { cerrado: false }); datos.recargar(); })}>Reabrir</button>}</div>}
      <div className="cab">
        <h1>{t.nombre}</h1>
        <span className="chapa" title={AYUDA_VIS[t.visibilidad]}>{NOMBRE_VIS[t.visibilidad]}</span>
        {yo && <Enlace a={`/e/${d.espacio.id}`} className="suave">{d.espacio.nombre}</Enlace>}
        <span className="hueco" />
        <span className="pila">{d.miembros.slice(0, 6).map((m) => <Avatar key={m.id} p={m} chica />)}</span>
        {d.miembros.length > 6 && <span className="chapa">+{d.miembros.length - 6}</span>}
        {d.mi.puede.unirse && <button type="button" className="btn" onClick={() => accion.hacer(async () => { await api('POST', `/api/tableros/${t.id}/unirse`); datos.recargar(); })}>Sumarme</button>}
        {yo && d.mi.rol !== null && <button type="button" className="btn lleno" onClick={() => setAbierto('compartir')}>Compartir{d.pedidos.length > 0 ? ` (${d.pedidos.length})` : ''}</button>}
        {yo && d.mi.rol === null && d.mi.puede.invitar && <button type="button" className="btn lleno" onClick={() => setAbierto('compartir')}>Compartir</button>}
        {d.mi.puede.administrar && <button type="button" className="btn" onClick={() => setAbierto('ajustes')}>Ajustes</button>}
        {!yo && <Enlace a="/entrar" className="btn">Entrar</Enlace>}
      </div>
      <div className="cuerpo">
        {accion.error && <p className="error" role="alert">{accion.error}</p>}
        <div className="vacio" style={{ borderColor: 'color-mix(in srgb, var(--lienzo-tinta) 25%, transparent)', color: 'var(--lienzo-tinta)', maxWidth: 520 }}>
          <p><b>Acá van a ir las listas y las tarjetas.</b></p>
          <p>Es lo próximo que se construye. Por ahora el tablero ya tiene su gente, su visibilidad y sus permisos.</p>
        </div>
      </div>
      {abierto === 'compartir' && <Compartir d={d} alCambiar={datos.recargar} alCerrar={() => setAbierto(null)} />}
      {abierto === 'ajustes' && <Ajustes d={d} alCambiar={datos.recargar} alCerrar={() => setAbierto(null)} />}
    </div>
  );
}
