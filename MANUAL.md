# MANUAL — cómo se prueba, se publica, se respalda y se vuelve atrás

Este archivo es para cualquier sesión de Claude (o persona) que retome el proyecto.
Se actualiza al terminar cada tanda. Estado: **tanda 2.0** (esqueleto; todavía sin publicar).

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
Pendiente de configurar (tanda 2.0, publicación de prueba). El molde está en PRIVADO.md.
Regla: subir a `main` → Dokploy arma con el Dockerfile → si `npm test` falla dentro del armado, no se publica.

## Datos y migraciones
- Base: `DATA_DIR/tablero.db` (SQLite). Al arrancar se aplican las migraciones pendientes, cada una en una transacción (si falla, no queda nada a medias).
- Antes de aplicar migraciones sobre una base que ya existía se guarda una copia en `DATA_DIR/respaldos/antes-de-NNN-<fecha>.db`.

## Respaldo
Pendiente (Fase 4): diario + copia fuera del servidor.

## Volver atrás
Pendiente de ensayar (Fase 4). Procedimiento previsto:
1. Código: `git revert <cambio>` y subir a `main` (se publica sola la versión anterior).
2. Datos: frenar la app, reemplazar `tablero.db` por la copia `antes-de-NNN-…db`, arrancar.
