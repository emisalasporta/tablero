// Pantalla de permiso: un asistente (Claude) pide manejar la app como "Alex" y la persona decide.
// Solo puede aprobar quien tiene la administración general. Al aprobar, se vuelve a Claude con un código de un solo uso.
import { useState } from 'react';
import { api, Enlace, useAccion, useCarga } from '../base.tsx';

export function Autorizar() {
  const q = new URLSearchParams(location.search);
  const dato = (k: string) => q.get(k) ?? '';
  const pedido = useCarga<{ aplicacion: string; vuelve_a: string; puede_aprobar: boolean }>(
    `/api/oauth/pedido?client_id=${encodeURIComponent(dato('client_id'))}&redirect_uri=${encodeURIComponent(dato('redirect_uri'))}`);
  const accion = useAccion();
  const [yendo, setYendo] = useState(false);
  if (pedido.cargando) return null;

  const aprobar = () => accion.hacer(async () => {
    const r = await api<{ ir_a: string }>('POST', '/api/oauth/aprobar', {
      client_id: dato('client_id'), redirect_uri: dato('redirect_uri'), response_type: dato('response_type'),
      code_challenge: dato('code_challenge'), code_challenge_method: dato('code_challenge_method'), state: q.get('state') ?? undefined,
    });
    setYendo(true);
    location.href = r.ir_a;
  });
  // La dirección de regreso ya fue comprobada por el servidor: recién entonces se puede volver con la negativa.
  const rechazar = () => {
    const d = new URL(dato('redirect_uri'));
    d.searchParams.set('error', 'access_denied');
    if (q.get('state')) d.searchParams.set('state', q.get('state')!);
    location.href = d.toString();
  };

  return (
    <main className="pagina angosta">
      <div className="panel angosto">
        {pedido.error || !pedido.datos ? (
          <>
            <h1>No se puede dar el permiso</h1>
            <p className="error" role="alert">{pedido.error?.message ?? 'El pedido no es válido.'}</p>
            <p className="suave">Volvé a Claude y empezá la conexión de nuevo.</p>
          </>
        ) : !pedido.datos.puede_aprobar ? (
          <>
            <h1>Hace falta la administración general</h1>
            <p className="suave">Solo quien administra toda la instalación puede darle acceso a un asistente. Tu cuenta no tiene ese permiso.</p>
            <div><Enlace a="/" className="btn">Ir al inicio</Enlace></div>
          </>
        ) : (
          <>
            <div className="columna" style={{ gap: 6 }}>
              <h1>¿Dejar entrar a {pedido.datos.aplicacion}?</h1>
              <p className="suave">Pide manejar meetmydash con la cuenta <b>Alex</b>.</p>
            </div>
            <ul className="permiso">
              <li>Va a poder ver y cambiar <b>todo</b>: espacios, tableros, tarjetas, miembros y permisos.</li>
              <li>Cada cosa que haga queda en la actividad a nombre de Alex.</li>
              <li>No puede crear ni anular llaves de acceso: eso solo lo hacés vos.</li>
              <li>Lo podés cortar cuando quieras desde Tu cuenta → Alex.</li>
            </ul>
            <p className="suave" style={{ fontSize: 13 }}>Al permitir, volvés a <b>{pedido.datos.vuelve_a}</b>. Si no empezaste vos esta conexión, no la permitas.</p>
            {accion.error && <p className="error" role="alert">{accion.error}</p>}
            <div className="fila">
              <button type="button" className="btn lleno" onClick={aprobar} disabled={accion.ocupado || yendo}>{yendo ? 'Volviendo a Claude…' : 'Permitir'}</button>
              <button type="button" className="btn" onClick={rechazar} disabled={accion.ocupado || yendo}>No permitir</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
