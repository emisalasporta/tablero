// Entrar, crear la primera cuenta, y crear cuenta o sumarse con un enlace de invitación.
import { useState } from 'react';
import { api, Campo, Enlace, Formulario, navegar, useAccion, useCarga, useSesion } from '../base.tsx';
import type { Yo } from '../base.tsx';

interface Entrada { tipo: string; espacio_id: string | null; tablero_enlace: string | null }
const destinoDe = (e: Entrada | null): string => (e?.tablero_enlace ? `/t/${e.tablero_enlace}` : e?.espacio_id ? `/e/${e.espacio_id}` : '/');

function DatosCuenta({ invitacion, alTerminar }: { invitacion?: string; alTerminar: (e: Entrada | null) => void }) {
  const sesion = useSesion();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  return (
    <Formulario boton="Crear cuenta" alEnviar={async () => {
      const r = await api<{ usuario: Yo; entrada: Entrada | null }>('POST', '/api/cuenta/registro', { nombre, email, clave, invitacion });
      sesion.poner(r.usuario);
      alTerminar(r.entrada);
    }}>
      <Campo rotulo="Tu nombre"><input id="reg-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required /></Campo>
      <Campo rotulo="Correo"><input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Campo>
      <Campo rotulo="Contraseña" ayuda="Al menos 8 caracteres."><input id="reg-clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" minLength={8} required /></Campo>
    </Formulario>
  );
}

export function Entrar({ volverA }: { volverA?: string }) {
  const sesion = useSesion();
  const inst = useCarga<{ hay_usuarios: boolean }>('/api/instalacion');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  if (inst.cargando) return null;
  const primera = inst.datos && !inst.datos.hay_usuarios;
  return (
    <main className="pagina angosta">
      <div className="panel angosto">
        {primera ? (
          <>
            <div className="columna" style={{ gap: 6 }}><h1>Crear la primera cuenta</h1><p className="suave">Esta cuenta va a administrar toda la instalación. Las demás personas entran con un enlace de invitación.</p></div>
            <DatosCuenta alTerminar={() => navegar('/', true)} />
          </>
        ) : (
          <>
            <div className="columna" style={{ gap: 6 }}><h1>Entrar</h1><p className="suave">Con el correo y la contraseña de tu cuenta.</p></div>
            <Formulario boton="Entrar" alEnviar={async () => {
              const r = await api<{ usuario: Yo }>('POST', '/api/sesion', { email, clave });
              sesion.poner(r.usuario);
              if (volverA) navegar(volverA, true);
            }}>
              <Campo rotulo="Correo"><input id="ent-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Campo>
              <Campo rotulo="Contraseña"><input id="ent-clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required /></Campo>
            </Formulario>
            <p className="suave" style={{ fontSize: 13 }}>¿No tenés cuenta? Pedile un enlace de invitación a quien administra. ¿Olvidaste la contraseña? Esa misma persona puede darte una temporal.</p>
          </>
        )}
      </div>
    </main>
  );
}

export function Invitacion({ token }: { token: string }) {
  const sesion = useSesion();
  const inv = useCarga<{ tipo: string; destino: string | null; invita: string | null }>(`/api/invitaciones/${encodeURIComponent(token)}`);
  const accion = useAccion();
  const [modo, setModo] = useState<'nueva' | 'entrar'>('nueva');
  if (inv.cargando || sesion.cargando) return null;
  if (inv.error) return <main className="pagina angosta"><div className="panel angosto"><h1>Invitación</h1><p className="error">{inv.error.message}</p><Enlace a="/" className="btn">Ir al inicio</Enlace></div></main>;
  const d = inv.datos!;
  const que = d.tipo === 'tablero' ? `al tablero “${d.destino}”` : d.tipo === 'espacio' ? `al espacio de trabajo “${d.destino}”` : 'a meetmydash';
  const aceptar = () => accion.hacer(async () => {
    const r = await api<{ entrada: Entrada }>('POST', `/api/invitaciones/${encodeURIComponent(token)}/aceptar`);
    navegar(destinoDe(r.entrada), true);
  });
  return (
    <main className="pagina angosta">
      <div className="panel angosto">
        <div className="columna" style={{ gap: 6 }}>
          <h1>Te invitaron {que}</h1>
          {d.invita && <p className="suave">Invita {d.invita}.</p>}
        </div>
        {sesion.yo ? (
          <>
            <p>Estás como <b>{sesion.yo.nombre}</b>.</p>
            {accion.error && <p className="error" role="alert">{accion.error}</p>}
            <div><button type="button" className="btn lleno" onClick={aceptar} disabled={accion.ocupado}>{d.tipo === 'instalacion' ? 'Ir al inicio' : 'Sumarme'}</button></div>
          </>
        ) : modo === 'nueva' ? (
          <>
            <DatosCuenta invitacion={token} alTerminar={(e) => navegar(destinoDe(e), true)} />
            <p className="suave" style={{ fontSize: 13 }}>¿Ya tenés cuenta? <button type="button" className="btn plano chico" onClick={() => setModo('entrar')}>Entrar</button></p>
          </>
        ) : (
          <EntrarCorto />
        )}
      </div>
    </main>
  );
}

function EntrarCorto() {
  const sesion = useSesion();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  return (
    <Formulario boton="Entrar" alEnviar={async () => { sesion.poner((await api<{ usuario: Yo }>('POST', '/api/sesion', { email, clave })).usuario); }}>
      <Campo rotulo="Correo"><input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Campo>
      <Campo rotulo="Contraseña"><input id="inv-clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required /></Campo>
    </Formulario>
  );
}
