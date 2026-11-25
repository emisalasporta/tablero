# MANUAL — cómo se prueba, se publica, se respalda y se vuelve atrás

Este archivo es para cualquier sesión de Claude (o persona) que retome el proyecto.
Se actualiza al terminar cada tanda. Estado: **tanda 2.2** hecha (lo de la 2.1 más listas, tarjetas, arrastre y tiempo real). Publicado en https://meetmydash.emilianosalasporta.cloud.

## Qué hay en cada carpeta
| Carpeta / archivo | Qué es |
|---|---|
| `servidor/` | El programa que corre en el servidor (Node + TypeScript, sin compilar: Node lo ejecuta directo). |
| `servidor/migraciones/` | Cambios de estructura de la base, numerados (`001_…sql`). Nunca se edita uno ya publicado: se agrega otro. |
| `web/` | Las pantallas (React + Vite). Se arman a `dist/web`. |
| `pruebas/` | Pruebas automáticas (Vitest). |
| `scripts/version.mjs` | Anota qué cambio se armó, para verlo en `/api/salud`. |
| `scripts/paridad.mjs` | Recalcula el resumen de PARIDAD.md después de cambiar el estado de una fila: `node scripts/paridad.mjs`. |
| `diseno/` | Muestras de diseño. No se publican. |
| `Dockerfile` | Receta con la que Dokploy arma y publica. Corre las pruebas adentro. |
| `PRIVADO.md` | Datos del servidor y claves. **Ignorado por git. No subir nunca.** |

## Cómo está armado
| Archivo | Qué hace |
|---|---|
| `servidor/permisos.ts` | **Único lugar** donde se decide quién puede qué (instalación → espacio → tablero). Si cambia una regla, se cambia acá y en `pruebas/tableros-permisos.test.ts`. |
| `servidor/nucleo.ts` | Sesiones (galleta `mmd_sesion`), registro de actividad, membresías e invitaciones por enlace. |
| `servidor/rutas/cuenta.ts` | Crear cuenta, entrar, perfil, contraseña, administración general. |
| `servidor/rutas/espacios.ts` | Espacios de trabajo, miembros, invitados, enlaces, pedidos. |
| `servidor/rutas/tableros.ts` | Tableros: visibilidad, miembros, permisos, cerrar/borrar. |
| `servidor/rutas/contenido.ts` | Listas y tarjetas: crear, renombrar, ordenar, mover (también a otro tablero), copiar, archivar. Acá están las reglas de posición. |
| `servidor/vivo.ts` | Tiempo real: una línea abierta (WebSocket) por pantalla que mira un tablero, en `/api/tableros/:id/vivo`. |
| `web/src/base.tsx` | Base de las pantallas: pedidos al servidor, navegación, sesión, piezas comunes. |
| `web/src/estilos.css` | Todos los colores y letras, como variables. Sale de `diseno/muestra.html` (diseño aprobado). |
| `web/src/pantallas/` | Una pantalla por archivo. |
| `web/src/tablero/datos.ts` | Los datos del tablero abierto: carga, avisos en vivo, reconexión y cambios que se ven al instante. |
| `web/src/tablero/arrastre.ts` | El arrastre con mouse y con dedo (hecho a medida, sin librerías). |
| `web/src/tablero/Listas.tsx`, `Menus.tsx` | Las listas y tarjetas en pantalla; menú de lista, tarjeta abierta y archivados. |

Reglas de la casa:
- La app es privada: la **primera cuenta** que se crea queda como administración general; las demás entran con enlace de invitación.
- Contraseñas y códigos de sesión o invitación se guardan solo como huella (no legibles).
- Toda acción que cambia algo llama a `registrarActividad` con quién la hizo.
- Los errores salen siempre como `{ error: código, mensaje: texto para la persona }`.
- **Orden de listas y tarjetas:** cada una guarda un número `posicion`, separado de a 65.536. Para meter algo entre dos se manda el número del medio; `"arriba"` y `"abajo"` también valen. Si dos quedan pegados, el servidor vuelve a numerar ese grupo solo.
- **Tiempo real:** todo cambio de listas o tarjetas llama a `vivo.emitir(tablero, { tipo: 'cambio', listas, tarjetas })` con las filas completas ya cambiadas. La pantalla las reemplaza; lo archivado o lo que pasó a otro tablero sale de la vista. Cambios de cabecera (nombre, gente, permisos) mandan `{ tipo: 'tablero' }` y la pantalla vuelve a pedir todo. Antes de cada aviso se revisa de nuevo el permiso de cada pantalla conectada. Hay un latido cada 25 segundos; si la pantalla pasa un minuto sin recibirlo, se reconecta y vuelve a cargar.
- Cada pedido de la pantalla lleva la cabecera `x-cliente` (un código por pestaña) y el aviso la devuelve en `origen`: así la pantalla reconoce el eco de sus propios cambios.
- Las letras están dentro de la app (`@fontsource`): no se pide nada a servidores de terceros.

## Probar
```bash
npm install
```
```bash
npm test
```
`npm test` revisa los tipos (TypeScript) y corre todas las pruebas. Cada prueba usa una carpeta de datos temporal: nunca toca datos reales.

## Levantar la app en la Mac
```bash
npm run build
```
```bash
DATA_DIR=./datos PORT=3000 npm start
```
Abre en http://localhost:3000. Para trabajar en las pantallas con recarga automática: `npm run dev` en una terminal y `npm run dev:web` en otra.

## Variables de entorno
| Variable | Para qué | Por defecto |
|---|---|---|
| `PORT` | Puerto | `3000` |
| `DATA_DIR` | Carpeta de datos (base, adjuntos, respaldos) | `./datos` (en Docker: `/app/data`) |
| `TZ` | Zona horaria | `America/Argentina/Buenos_Aires` |

## Cómo saber qué versión está publicada
`GET /api/salud` devuelve `version`, `commit` (los primeros 12 caracteres del cambio) y `armada_en`.

## Publicar
Se publica solo: cada cambio que llega a `main` en GitHub dispara un aviso (webhook) a Dokploy, que arma la app con el `Dockerfile` y la reemplaza. Tarda 1 a 3 minutos.

- Dokploy: proyecto `tablero`, aplicación `app`. Origen: Git, `https://github.com/emisalasporta/tablero.git`, rama `main`, Dockerfile. Volumen `tablero-datos` en `/app/data`.
- Los identificadores, la dirección de prueba, la dirección del aviso y la clave de la API de Dokploy están en `PRIVADO.md`.
- Las pruebas corren dentro del armado (`RUN npm test`). Si fallan, el armado falla y sigue funcionando la versión anterior.

### Comprobar que se publicó
Pedir https://meetmydash.emilianosalasporta.cloud/api/salud y comparar `commit` con `git rev-parse --short=12 HEAD`.

### Ver el estado o volver a publicar a mano (API de Dokploy)
Con `DOKPLOY_URL` y `DOKPLOY_API_KEY` de `PRIVADO.md`, encabezado `x-api-key`:
- Estado y últimas publicaciones: `GET /api/deployment.all?applicationId=<id>` (cada una trae `status`, `title` y `logPath`).
- Datos de la app: `GET /api/application.one?applicationId=<id>` (`applicationStatus`).
- Volver a publicar: `POST /api/application.deploy` con `{"applicationId":"<id>"}`.
- El manual completo de la API está en `GET /api/settings.getOpenApiDocument`.

## Datos y migraciones
- Base: `DATA_DIR/tablero.db` (SQLite). Al arrancar se aplican las migraciones pendientes, cada una en una transacción (si falla, no queda nada a medias).
- Antes de aplicar migraciones sobre una base que ya existía se guarda una copia en `DATA_DIR/respaldos/antes-de-NNN-<fecha>.db`.

## Respaldo
Pendiente (Fase 4): diario + copia fuera del servidor.

## Volver atrás
**Código (ensayado el 25/11/2026):**
```bash
git revert --no-edit HEAD
```
```bash
git push
```
Se publica sola la versión anterior en menos de un minuto. Comprobar con `/api/salud`.

Si lo que se subió tenía pruebas rotas no hace falta apurarse: Dokploy no lo publica y sigue la versión anterior (también ensayado). La aplicación figura con estado `error` en Dokploy hasta la siguiente publicación buena.

**Datos (pendiente de ensayar, Fase 4):** frenar la app, reemplazar `tablero.db` por la copia `respaldos/antes-de-NNN-…db`, arrancar.
