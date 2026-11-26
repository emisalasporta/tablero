// Cuidar la instalación: respaldos y estado del servidor. Solo para la administración general (y Alex por su puerta).
// Lo de Dokploy se enciende con las variables DOKPLOY_URL, DOKPLOY_API_KEY y DOKPLOY_APP_ID; sin ellas, esa parte avisa que no está configurada.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { exigirUsuario } from '../nucleo.ts';
import { anotarError, arrancoEn, erroresRecientes } from '../registro.ts';
import type { Respaldos } from '../respaldo.ts';
import { ErrorApi, sinPermiso } from '../util.ts';
import { leerVersion } from '../version.ts';

export interface ConfigDokploy { url: string; clave: string; app: string }
interface Publicacion { deploymentId: string; title: string; description: string | null; status: string; createdAt: string; finishedAt: string | null; errorMessage: string | null }

export function rutasServidor(app: FastifyInstance, respaldos: Respaldos, dokploy: ConfigDokploy | null, pedir: typeof fetch = fetch) {
  const exigirAdmin = (req: FastifyRequest) => { if (exigirUsuario(req).es_admin_general !== 1) throw sinPermiso('Solo la administración general puede hacer eso.'); };

  async function aDokploy<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
    if (!dokploy) throw new ErrorApi(503, 'sin_configurar', 'El acceso a Dokploy no está configurado en este servidor.');
    let r: Response;
    try {
      r = await pedir(`${dokploy.url.replace(/\/+$/, '')}/api/${ruta}`, { method: metodo, headers: { 'x-api-key': dokploy.clave, ...(cuerpo ? { 'content-type': 'application/json' } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal: AbortSignal.timeout(15_000) });
    } catch (e) { anotarError('dokploy', e); throw new ErrorApi(502, 'dokploy_no_responde', 'No se pudo hablar con Dokploy.'); }
    if (!r.ok) throw new ErrorApi(502, 'dokploy_error', `Dokploy respondió ${r.status}.`);
    return (await r.json().catch(() => ({}))) as T;
  }

  // ---------- respaldos ----------
  app.get('/api/admin/respaldos', async (req) => { exigirAdmin(req); return respaldos.estado(); });
  app.post('/api/admin/respaldos', async (req, reply) => {
    exigirAdmin(req);
    try { return reply.code(201).send({ respaldo: await respaldos.hacer('manual'), externo: respaldos.estado().externo }); } catch (e) {
      if ((e as Error).message.includes('en curso')) throw new ErrorApi(409, 'ocupado', 'Ya hay un respaldo en curso. Probá en un minuto.');
      throw e;
    }
  });

  // ---------- servidor ----------
  app.get('/api/admin/servidor', async (req) => {
    exigirAdmin(req);
    const v = leerVersion();
    let publicacion: unknown = { configurado: false };
    if (dokploy) {
      try {
        const [a, lista] = await Promise.all([
          aDokploy<{ applicationStatus: string }>('GET', `application.one?applicationId=${encodeURIComponent(dokploy.app)}`),
          aDokploy<Publicacion[]>('GET', `deployment.all?applicationId=${encodeURIComponent(dokploy.app)}`),
        ]);
        const ultimas = [...lista].sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1)).slice(0, 10);
        publicacion = { configurado: true, estado: a.applicationStatus, ultimas: ultimas.map((d) => ({ que: d.title.split('\n')[0], cambio: (d.description ?? '').replace(/^Commit: /, '').slice(0, 12), estado: d.status, cuando: d.createdAt, termino: d.finishedAt, error: d.errorMessage })) };
      } catch (e) { publicacion = { configurado: true, error: (e as Error).message }; }
    }
    return { app: { version: v.version, commit: v.commit, armada_en: v.armada_en, arranco_en: arrancoEn, ahora: new Date().toISOString() }, publicacion, errores: erroresRecientes() };
  });

  // Volver a armar y publicar lo que hay en main. La app se reinicia sola al terminar (unos segundos sin responder).
  app.post('/api/admin/servidor/publicar', async (req) => {
    exigirAdmin(req);
    await aDokploy('POST', 'application.deploy', { applicationId: dokploy?.app });
    return { ok: true, mensaje: 'Publicación pedida. Tarda de 1 a 3 minutos; el resultado se ve con el estado del servidor.' };
  });
}
