# MANUAL — cómo se prueba, se publica, se respalda y se vuelve atrás

Este archivo es para cualquier sesión de Claude (o persona) que retome el proyecto.
Se actualiza al terminar cada tanda. Estado: **tanda 2.0** (esqueleto publicado en https://meetmydash.emilianosalasporta.cloud; publicación automática funcionando).

## Qué hay en cada carpeta
| Carpeta / archivo | Qué es |
|---|---|
| `servidor/` | El programa que corre en el servidor (Node + TypeScript, sin compilar: Node lo ejecuta directo). |
| `servidor/migraciones/` | Cambios de estructura de la base, numerados (`001_…sql`). Nunca se edita uno ya publicado: se agrega otro. |
| `web/` | Las pantallas (React + Vite). Se arman a `dist/web`. |
| `pruebas/` | Pruebas automáticas (Vitest). |
| `scripts/version.mjs` | Anota qué cambio se armó, para verlo en `/api/salud`. |
| `diseno/` | Muestras de diseño. No se publican. |
| `Dockerfile` | Receta con la que Dokploy arma y publica. Corre las pruebas adentro. |
| `PRIVADO.md` | Datos del servidor y claves. **Ignorado por git. No subir nunca.** |

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
