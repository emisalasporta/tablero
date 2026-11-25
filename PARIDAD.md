# PARIDAD — todas las funciones de Trello y su estado

Última actualización: 25/11/2026 (Fase 1: todo pendiente, nada construido).

## Cómo leer esta lista
- **Estado:** `pendiente` · `hecha` · `no se puede` (con el porqué en la nota).
- **⚠ parcial** en la nota: se va a hacer, pero no puede quedar idéntico a Trello; la nota dice qué cambia.
- **Tanda:** en qué tanda del PLAN.md entra.
- **Fuente:** de dónde salió la función. `V` = la vi con REA · `A` = leída en el centro de ayuda de Trello · `M` = de memoria, sin verificar hoy (puede haber cambiado; se revisa al llegar a su tanda).
- En Trello muchas funciones dependen del plan pago. **Acá todas van habilitadas para todos.**
- Los números de límite de Trello (tarjetas por tablero, etc.) no se copian como tope: se usan como referencia de cuánto tiene que aguantar la app.

## Resumen
<!-- RESUMEN-INICIO -->
**399 funciones en total** (390 de Trello + 9 requisitos propios del proyecto).

| Estado | Cantidad |
|---|---|
| Hechas | 0 |
| Pendientes (se pueden igualar) | 334 |
| Pendientes pero parciales (⚠, no quedan idénticas) | 18 |
| No se puede | 47 |

| Sección | Total | Pendientes | Parciales | No se puede |
|---|---|---|---|---|
| A. Cuentas y perfil | 22 | 18 | 2 | 2 |
| B. Espacios de trabajo | 28 | 25 | 1 | 2 |
| C. Tableros | 42 | 37 | 2 | 3 |
| D. Listas | 17 | 16 | 0 | 1 |
| E. Tarjetas: lo básico | 22 | 22 | 0 | 0 |
| F. Tarjetas: descripción y texto | 14 | 13 | 1 | 0 |
| G. Tarjetas: miembros y etiquetas | 11 | 11 | 0 | 0 |
| H. Tarjetas: checklists | 13 | 12 | 0 | 1 |
| I. Tarjetas: fechas | 8 | 8 | 0 | 0 |
| J. Tarjetas: adjuntos y portadas | 21 | 15 | 2 | 4 |
| K. Tarjetas: comentarios y actividad | 12 | 10 | 1 | 1 |
| L. Tarjetas especiales y extras | 23 | 20 | 1 | 2 |
| M. Vistas | 15 | 15 | 0 | 0 |
| N. Búsqueda y filtros | 14 | 13 | 0 | 1 |
| O. Atajos de teclado | 9 | 9 | 0 | 0 |
| P. Notificaciones | 14 | 11 | 2 | 1 |
| Q. Automatización | 36 | 30 | 3 | 3 |
| R. Power-Ups e integraciones | 11 | 4 | 0 | 7 |
| S. Inteligencia artificial de Atlassian | 5 | 0 | 0 | 5 |
| T. Bandeja de entrada y Planificador | 12 | 9 | 1 | 2 |
| U. Plantillas | 5 | 4 | 0 | 1 |
| V. Teléfono, instalación y escritorio | 13 | 5 | 2 | 6 |
| W. Importar, exportar e imprimir | 5 | 4 | 0 | 1 |
| X. Apariencia y accesibilidad | 7 | 7 | 0 | 0 |
| Y. Tiempo real | 5 | 5 | 0 | 0 |
| Z. Administración avanzada (Enterprise) | 6 | 2 | 0 | 4 |
| AA. Requisitos propios de este proyecto (no son de Trello, pero se controlan acá) | 9 | 9 | 0 | 0 |
<!-- RESUMEN-FIN -->

---

## A. Cuentas y perfil
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| A01 | Crear cuenta con correo y contraseña | pendiente | 2.1 | M | Solo por invitación (la app es privada) |
| A02 | Iniciar y cerrar sesión; sesión recordada | pendiente | 2.1 | M | |
| A03 | Recuperar contraseña olvidada | pendiente | 2.1 | M | ⚠ parcial: por correo solo si hay cuenta de envío de correos; si no, la restablece un administrador o Alex |
| A04 | Ingresar con Google, Microsoft, Apple o Slack | no se puede | — | M | Cada uno exige registrar la app ante esa empresa. Google se podría sumar más adelante si lo pedís |
| A05 | Cuenta unificada de Atlassian | no se puede | — | A | Es propio de Atlassian; no aplica |
| A06 | Verificación en dos pasos | pendiente | 6.7 | A | Con app de códigos (tipo Google Authenticator) |
| A07 | Perfil: nombre, nombre de usuario, iniciales, biografía | pendiente | 2.1 | V | |
| A08 | Foto de perfil (subir imagen o iniciales) | pendiente | 2.1 | V | |
| A09 | Cambiar correo y contraseña | pendiente | 2.1 | A | |
| A10 | Idioma de la app | pendiente | 6.7 | A | ⚠ parcial: español e inglés (Trello tiene decenas) |
| A11 | Zona horaria y formato de fecha/hora | pendiente | 2.1 | A | |
| A12 | Visibilidad del perfil | pendiente | 6.7 | A | |
| A13 | Página "mi actividad" | pendiente | 6.2 | A | |
| A14 | Página "mis tarjetas" (asignadas a mí, de todos los tableros) | pendiente | 6.2 | A | |
| A15 | Cambiar entre varias cuentas | pendiente | 6.7 | V | |
| A16 | Borrar mi cuenta | pendiente | 6.7 | A | |
| A17 | Cerrar sesión en otros dispositivos | pendiente | 6.7 | M | |
| A18 | Ajuste: frecuencia de correos de aviso | pendiente | 6.1 | A | |
| A19 | Ajuste: permitir avisos de escritorio | pendiente | 6.1 | A | |
| A20 | Ajuste: desactivar atajos de teclado | pendiente | 6.2 | A | |
| A21 | Ajuste: desactivar sugerencias de etiquetas | pendiente | 6.4 | A | |
| A22 | Claves de acceso para programas (tokens) y poder anularlas | pendiente | 3 | A | |

## B. Espacios de trabajo
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| B01 | Crear espacio de trabajo | pendiente | 2.1 | A | |
| B02 | Editar nombre, descripción, sitio web y logo | pendiente | 2.1 | V | |
| B03 | Visibilidad del espacio: privado o público | pendiente | 2.1 | V | |
| B04 | Roles en el espacio: administrador y miembro normal | pendiente | 2.1 | V | |
| B05 | El administrador del espacio administra todos sus tableros, también los privados | pendiente | 2.1 | A | |
| B06 | Invitar miembros por correo o nombre de usuario | pendiente | 2.1 | A | ⚠ parcial: sin cuenta de envío de correos, la invitación se pasa como enlace |
| B07 | Enlace de invitación al espacio (crear y desactivar) | pendiente | 2.1 | A | |
| B08 | Quitar miembros | pendiente | 2.1 | A | |
| B09 | Desactivar miembro (conserva historial, sin acceso) | pendiente | 2.1 | A | |
| B10 | Invitados: personas en tableros sin ser del espacio | pendiente | 2.1 | A | |
| B11 | Invitado de un tablero e invitado de varios tableros | pendiente | 2.1 | V | Sin diferencia de costo: acá no se cobra |
| B12 | Convertir invitado en miembro; el invitado puede pedirlo | pendiente | 2.1 | A | |
| B13 | Página de miembros e invitados del espacio, con pendientes | pendiente | 2.1 | A | |
| B14 | Ajuste: quién puede crear tableros de cada visibilidad | pendiente | 2.1 | V | |
| B15 | Ajuste: quién puede borrar tableros de cada visibilidad | pendiente | 2.1 | V | |
| B16 | Ajuste: quién puede sumar invitados a los tableros | pendiente | 2.1 | A | |
| B17 | Ajuste: limitar invitaciones a ciertos dominios de correo | pendiente | 6.7 | V | |
| B18 | Página con todos los tableros del espacio (orden, filtro, búsqueda) | pendiente | 2.4 | A | |
| B19 | Colecciones de tableros (agrupar y filtrar) | pendiente | 6.7 | A | |
| B20 | Exportar todo el espacio (JSON, CSV, adjuntos en ZIP) | pendiente | 6.7 | A | |
| B21 | Plantillas del espacio | pendiente | 6.4 | A | |
| B22 | Borrar el espacio | pendiente | 2.1 | A | |
| B23 | Fusionar dos espacios | pendiente | 6.7 | A | |
| B24 | Mover un tablero a otro espacio | pendiente | 2.4 | A | |
| B25 | Pedir sumarse a un espacio / aprobar pedidos | pendiente | 2.1 | A | |
| B26 | Ajuste: restricción de tipos de adjunto | pendiente | 6.7 | V | |
| B27 | Planes, facturación, prueba gratis, límite de 10 colaboradores y de 10 tableros | no se puede | — | A | No aplica: la app es tuya, sin planes ni límites |
| B28 | Activar o desactivar la IA para el espacio | no se puede | — | A | Ver sección S |

## C. Tableros
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| C01 | Crear tablero (nombre, fondo, espacio, visibilidad) | pendiente | 2.2 | A | |
| C02 | Renombrar tablero | pendiente | 2.2 | A | |
| C03 | Descripción del tablero ("Acerca de este tablero") | pendiente | 2.4 | A | |
| C04 | Visibilidad: privado | pendiente | 2.1 | V | |
| C05 | Visibilidad: del espacio de trabajo | pendiente | 2.1 | V | |
| C06 | Visibilidad: público (se ve con el enlace, sin cuenta) | pendiente | 2.1 | V | |
| C07 | Visibilidad: de la organización (Enterprise) | no se puede | — | A | No hay nivel "organización" por encima del espacio; no aplica |
| C08 | Roles en el tablero: administrador, miembro normal, observador | pendiente | 2.1 | A | |
| C09 | Invitar al tablero por nombre o correo, eligiendo rol | pendiente | 2.1 | A | |
| C10 | Enlace de invitación al tablero (crear y desactivar) | pendiente | 2.1 | A | |
| C11 | Cambiar rol o quitar a alguien; salir del tablero | pendiente | 2.1 | A | |
| C12 | Pedido de acceso a un tablero y aprobación | pendiente | 2.1 | V | |
| C13 | Permiso: quién comenta (5 opciones) | pendiente | 2.1 | A | |
| C14 | Permiso: quién suma y quita miembros | pendiente | 2.1 | A | |
| C15 | Permiso: los miembros del espacio pueden editar y unirse solos | pendiente | 2.1 | V | |
| C16 | Permiso: quién vota | pendiente | 6.4 | V | |
| C17 | Fondo: color liso o degradado | pendiente | 2.4 | V | |
| C18 | Fondo: foto propia subida | pendiente | 2.4 | V | |
| C19 | Fondo: fotos de la galería Unsplash | pendiente | 6.7 | V | ⚠ parcial: necesita una clave gratuita de Unsplash a tu nombre |
| C20 | Texto claro u oscuro según el fondo; fondo distinto en modo oscuro | pendiente | 2.4 | V | |
| C21 | Marcar tablero como favorito (estrella) y reordenar favoritos | pendiente | 2.4 | A | |
| C22 | Tableros recientes | pendiente | 2.4 | A | |
| C23 | Cerrar tablero, reabrirlo, y borrarlo definitivamente | pendiente | 2.4 | A | |
| C24 | Página de tableros cerrados | pendiente | 2.4 | M | |
| C25 | Copiar tablero (con o sin tarjetas) | pendiente | 2.4 | A | |
| C26 | Seguir tablero (recibir avisos de todo) | pendiente | 6.1 | A | |
| C27 | Menú del tablero | pendiente | 2.4 | A | |
| C28 | Actividad del tablero (todo / solo comentarios, cargar más) | pendiente | 2.3 | A | |
| C29 | Elementos archivados: tarjetas y listas, buscar, restaurar, borrar | pendiente | 2.4 | A | |
| C30 | Ajuste: mostrar u ocultar portadas | pendiente | 2.3 | V | |
| C31 | Ajuste: mostrar el tilde de completada en el frente | pendiente | 2.3 | V | |
| C32 | Ajuste: mostrar cantidad de tarjetas por lista | pendiente | 2.4 | V | |
| C33 | Gestión de etiquetas del tablero | pendiente | 2.3 | A | |
| C34 | Cabecera: avatares de miembros, filtro, estrella, visibilidad, compartir | pendiente | 2.2 | A | |
| C35 | Dirección web corta del tablero y número de tarjeta | pendiente | 2.2 | V | |
| C36 | Convertir tablero en plantilla y volver atrás | pendiente | 6.4 | A | |
| C37 | Crear tarjetas enviando un correo al tablero | pendiente | 6.6 | A | ⚠ parcial: depende de configurar la recepción de correo en tu dominio (Cloudflare) |
| C38 | Elegir lista y posición donde caen los correos | pendiente | 6.6 | V | |
| C39 | Archivado automático de tarjetas | pendiente | 6.5 | V | Solo vi que existe el ajuste; se revisa el detalle |
| C40 | Crear un tablero con IA a partir de una descripción | no se puede | — | A | Ver sección S. Alex puede hacerlo por la puerta MCP |
| C41 | Fondos generados con IA | no se puede | — | A | Ver sección S |
| C42 | Panel lateral por persona (mostrar/ocultar secciones) | pendiente | 2.4 | V | |

## D. Listas
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| D01 | Crear lista | pendiente | 2.2 | A | |
| D02 | Renombrar lista | pendiente | 2.2 | A | |
| D03 | Reordenar listas arrastrando | pendiente | 2.2 | V | |
| D04 | Mover lista (elegir tablero y posición) | pendiente | 2.2 | A | |
| D05 | Copiar lista con sus tarjetas | pendiente | 2.2 | A | |
| D06 | Archivar y restaurar lista | pendiente | 2.2 | A | |
| D07 | Borrar lista archivada | pendiente | 2.4 | A | |
| D08 | Mover todas las tarjetas de la lista | pendiente | 2.2 | A | |
| D09 | Archivar todas las tarjetas de la lista | pendiente | 2.2 | A | |
| D10 | Ordenar lista (alfabético, vencimiento, creación, votos, campos) | pendiente | 2.2 | A | |
| D11 | Agregar tarjeta arriba o abajo desde el menú | pendiente | 2.2 | M | |
| D12 | Seguir lista | pendiente | 6.1 | A | |
| D13 | Color de lista | pendiente | 6.4 | V | |
| D14 | Colapsar y expandir lista | pendiente | 6.4 | V | |
| D15 | Límite de tarjetas por lista (aviso al pasarse) | pendiente | 6.4 | V | |
| D16 | Automatización rápida desde el menú de la lista | pendiente | 6.5 | A | |
| D17 | Lista que muestra trabajo de Jira | no se puede | — | A | Integración de Atlassian |

## E. Tarjetas: lo básico
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| E01 | Crear tarjeta | pendiente | 2.2 | A | |
| E02 | Crear varias tarjetas pegando varias líneas | pendiente | 2.2 | M | |
| E03 | Editar título | pendiente | 2.2 | A | |
| E04 | Abrir tarjeta (dorso) con dirección web propia | pendiente | 2.3 | V | |
| E05 | Arrastrar tarjeta dentro de la lista y entre listas | pendiente | 2.2 | V | |
| E06 | Mover desde un menú (tablero, lista, posición) | pendiente | 2.2 | A | |
| E07 | Mover a otro tablero conservando contenido | pendiente | 2.2 | A | |
| E08 | Copiar tarjeta eligiendo qué conservar | pendiente | 2.2 | A | |
| E09 | Archivar y restaurar tarjeta | pendiente | 2.2 | A | |
| E10 | Borrar tarjeta archivada | pendiente | 2.4 | A | |
| E11 | Marcar tarjeta como completada (círculo) | pendiente | 2.3 | A | |
| E12 | Edición rápida desde el frente (lápiz o clic derecho) | pendiente | 6.2 | A | |
| E13 | Selección múltiple (hasta 20) para mover o copiar en grupo | pendiente | 6.2 | A | |
| E14 | Insignias en el frente (comentarios, adjuntos, checklist, fecha, descripción, seguir, votos, ubicación) | pendiente | 2.3 | V | |
| E15 | Seguir tarjeta | pendiente | 6.1 | A | |
| E16 | Compartir: enlace a tarjeta, a comentario y a una acción | pendiente | 2.3 | A | |
| E17 | Compartir: código QR e incrustar en otra página | pendiente | 6.7 | M | |
| E18 | Deshacer, rehacer y repetir la última acción | pendiente | 6.2 | A | |
| E19 | Fusionar tarjetas | pendiente | 6.4 | V | |
| E20 | Recuperar un título o descripción anterior | pendiente | 6.7 | A | |
| E21 | Fecha de vencimiento escrita en el título al crear | pendiente | 6.2 | A | |
| E22 | Al crear: `@` miembro, `#` etiqueta, `^` posición | pendiente | 6.2 | M | |

## F. Tarjetas: descripción y texto
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| F01 | Descripción con editor con formato | pendiente | 2.3 | A | |
| F02 | Títulos (6 niveles), negrita, cursiva, tachado | pendiente | 2.3 | A | |
| F03 | Listas con viñetas y numeradas, con sangría | pendiente | 2.3 | A | |
| F04 | Enlaces, citas, divisor | pendiente | 2.3 | A | |
| F05 | Código en línea y bloque de código | pendiente | 2.3 | A | |
| F06 | Imágenes dentro del texto | pendiente | 2.3 | A | |
| F07 | Escribir con Markdown y que se convierta solo | pendiente | 2.3 | A | |
| F08 | Atajos de teclado del editor | pendiente | 2.3 | A | |
| F09 | Menú rápido con `/` | pendiente | 6.2 | A | |
| F10 | Emojis con `:nombre:` y selector | pendiente | 2.3 | A | |
| F11 | Emojis propios del espacio | pendiente | 6.7 | V | |
| F12 | Enlace mostrado como dirección, título, tarjeta o incrustado | pendiente | 6.4 | A | ⚠ parcial: incrustado solo para sitios que lo permiten (YouTube, etc.) |
| F13 | Menciones con @ en la descripción | pendiente | 2.3 | A | |
| F14 | Ver el Markdown del texto | pendiente | 6.7 | A | |

## G. Tarjetas: miembros y etiquetas
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| G01 | Asignar y quitar miembros | pendiente | 2.3 | V | |
| G02 | Asignarme con un atajo | pendiente | 6.2 | M | |
| G03 | Al asignarte quedás siguiendo la tarjeta | pendiente | 6.1 | A | |
| G04 | Etiquetas con color y nombre opcional, varias por tarjeta | pendiente | 2.3 | V | |
| G05 | 30 colores de etiqueta + sin color | pendiente | 2.3 | V | Paleta propia, misma cantidad |
| G06 | Crear, renombrar, recolorear y borrar etiquetas | pendiente | 2.3 | A | |
| G07 | Mostrar u ocultar nombres de etiquetas en el frente | pendiente | 2.3 | A | |
| G08 | Modo daltónico (patrones en etiquetas y portadas) | pendiente | 6.7 | A | |
| G09 | Buscar etiquetas al asignar | pendiente | 2.3 | M | |
| G10 | Sugerencia de etiquetas recientes por lista | pendiente | 6.4 | A | |
| G11 | Al mover a otro tablero, las etiquetas se recrean en destino | pendiente | 2.2 | A | |

## H. Tarjetas: checklists
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| H01 | Agregar, renombrar y borrar checklist | pendiente | 2.3 | V | |
| H02 | Agregar, editar, tildar y borrar ítems | pendiente | 2.3 | A | |
| H03 | Pegar varias líneas crea un ítem por línea | pendiente | 2.3 | A | |
| H04 | Reordenar ítems y pasarlos a otra checklist | pendiente | 2.3 | A | |
| H05 | Reordenar checklists | pendiente | 2.3 | V | |
| H06 | Barra de progreso y contador en el frente | pendiente | 2.3 | A | |
| H07 | Ocultar ítems tildados | pendiente | 2.3 | A | |
| H08 | Copiar ítems de otra checklist del tablero | pendiente | 2.3 | A | |
| H09 | Convertir ítem en tarjeta | pendiente | 2.3 | A | |
| H10 | Asignar persona a un ítem | pendiente | 2.3 | A | |
| H11 | Fecha de vencimiento en un ítem | pendiente | 2.3 | A | |
| H12 | Formato, enlaces y menciones en ítems | pendiente | 2.3 | A | |
| H13 | Generar ítems con IA | no se puede | — | A | Ver sección S |

## I. Tarjetas: fechas
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| I01 | Fecha de inicio | pendiente | 2.3 | V | |
| I02 | Fecha y hora de vencimiento | pendiente | 2.3 | V | |
| I03 | Vencimiento cumplido | pendiente | 2.3 | V | |
| I04 | Recordatorio (opciones relativas al vencimiento) | pendiente | 6.1 | V | |
| I05 | Colores de la fecha según cercanía (por vencer, vencida, cumplida) | pendiente | 2.3 | A | |
| I06 | Quitar fechas | pendiente | 2.3 | A | |
| I07 | Vencimiento que se repite | pendiente | 6.4 | V | |
| I08 | Las archivadas no avisan | pendiente | 6.1 | A | |

## J. Tarjetas: adjuntos y portadas
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| J01 | Adjuntar archivo desde la computadora o el teléfono | pendiente | 2.3 | A | Tope por archivo: propongo 250 MB como Trello pago |
| J02 | Adjuntar un enlace | pendiente | 2.3 | A | |
| J03 | Adjuntar otra tarjeta o tablero de la app | pendiente | 2.3 | V | |
| J04 | Soltar archivos sobre la tarjeta | pendiente | 2.3 | A | |
| J05 | Pegar imagen del portapapeles | pendiente | 2.3 | A | |
| J06 | Renombrar, comentar, descargar y borrar adjunto | pendiente | 2.3 | A | |
| J07 | Vista previa de imágenes y documentos comunes | pendiente | 2.3 | A | ⚠ parcial: imágenes, PDF, audio y video; otros formatos se descargan |
| J08 | Miniaturas en varias medidas | pendiente | 2.3 | V | |
| J09 | Adjuntos privados: solo los ve quien puede ver la tarjeta | pendiente | 2.3 | A | |
| J10 | Reordenar adjuntos | pendiente | 2.3 | V | |
| J11 | Selector de Google Drive, Dropbox, Box, OneDrive | no se puede | — | A | Cada uno exige registrar la app ante esa empresa. Se puede pegar el enlace del archivo |
| J12 | Adjuntar de Jira y Confluence | no se puede | — | A | Integración de Atlassian |
| J13 | Portada de color | pendiente | 2.3 | V | |
| J14 | Portada con imagen subida o con un adjunto | pendiente | 2.3 | V | |
| J15 | Portada con foto de Unsplash | pendiente | 6.7 | A | ⚠ parcial: misma clave de C19 |
| J16 | Portada tamaño media o completa; texto claro u oscuro | pendiente | 2.3 | V | |
| J17 | La primera imagen adjunta pasa a ser portada | pendiente | 2.3 | A | |
| J18 | GIF animado en la portada | pendiente | 2.3 | A | |
| J19 | Quitar portada | pendiente | 2.3 | A | |
| J20 | Portada generada con IA | no se puede | — | A | Ver sección S |
| J21 | Aviso de archivo peligroso | no se puede | — | V | Requiere un servicio antivirus externo |

## K. Tarjetas: comentarios y actividad
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| K01 | Comentar con formato | pendiente | 2.3 | A | |
| K02 | Editar y borrar comentario propio; el administrador borra ajenos | pendiente | 2.3 | A | |
| K03 | Mencionar con @usuario | pendiente | 2.3 | A | |
| K04 | Mencionar @card (miembros de la tarjeta) y @board (todo el tablero) | pendiente | 2.3 | A | Con nombres propios en español |
| K05 | Reacciones con emoji | pendiente | 2.3 | V | |
| K06 | Adjuntar al comentar | pendiente | 2.3 | A | |
| K07 | Enlace directo a un comentario | pendiente | 2.3 | A | |
| K08 | Indicador "está escribiendo" | pendiente | 2.3 | A | |
| K09 | Actividad de la tarjeta con quién, qué y cuándo | pendiente | 2.3 | A | |
| K10 | Mostrar u ocultar detalles de actividad | pendiente | 2.3 | A | |
| K11 | Comentar respondiendo al correo de la tarjeta | pendiente | 6.6 | A | ⚠ parcial: misma dependencia que C37 |
| K12 | Escribir o resumir con IA en comentarios y descripción | no se puede | — | A | Ver sección S |

## L. Tarjetas especiales y extras
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| L01 | Tarjeta plantilla y crear tarjeta desde plantilla | pendiente | 6.4 | A | |
| L02 | Separador (tarjeta con `---`) | pendiente | 6.4 | A | |
| L03 | Tarjeta enlace (pegar una dirección como título) | pendiente | 6.4 | A | ⚠ parcial: vista previa con título e imagen del sitio; sin las vistas "inteligentes" de 21 servicios |
| L04 | Conectar cuentas para ver enlaces privados (Figma, Drive, etc.) | no se puede | — | A | Exige acuerdos con cada servicio |
| L05 | Tarjeta tablero (pegar el enlace de un tablero) | pendiente | 6.4 | A | |
| L06 | Tarjeta espejo: la misma tarjeta visible en otro tablero | pendiente | 6.4 | V | |
| L07 | Espejo: reglas (no se borra desde el espejo, aviso si el original se archiva, pedir acceso) | pendiente | 6.4 | A | |
| L08 | Colapsar o expandir todos los espejos | pendiente | 6.4 | V | |
| L09 | Convertir entre tipos de tarjeta | pendiente | 6.4 | A | |
| L10 | Ubicación en la tarjeta (buscar lugar, mapa chico) | pendiente | 6.3 | V | Mapas de OpenStreetMap (gratis) en lugar de los de Trello |
| L11 | Campos personalizados: casilla, fecha, desplegable, número, texto | pendiente | 6.4 | A | |
| L12 | Campos: mostrar en el frente, reordenar, editar, borrar | pendiente | 6.4 | A | |
| L13 | Campos: colores en opciones del desplegable | pendiente | 6.4 | M | |
| L14 | Campos: viajan al mover o copiar a otro tablero | pendiente | 6.4 | A | |
| L15 | Stickers: pegar, mover, rotar y quitar | pendiente | 6.4 | V | Set propio de stickers |
| L16 | Stickers propios subidos | pendiente | 6.4 | V | |
| L17 | Stickers GIF de Giphy | no se puede | — | A | Trello mismo lo retiró |
| L18 | Votos en tarjetas y contador | pendiente | 6.4 | V | |
| L19 | Ocultar votos | pendiente | 6.4 | V | |
| L20 | Envejecimiento de tarjetas (modo normal y "pirata") | pendiente | 6.4 | V | |
| L21 | Tarjetas que se repiten solas (cada día, semana, mes, año) | pendiente | 6.4 | A | |
| L22 | Dependencias entre tareas | pendiente | 6.3 | A | Solo vi que existe; se revisa el detalle |
| L23 | Imprimir tarjeta | pendiente | 6.7 | A | |

## M. Vistas
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| M01 | Conmutador de vistas y activar/desactivar cada una | pendiente | 6.3 | V | |
| M02 | El filtro se mantiene entre vistas | pendiente | 6.3 | A | |
| M03 | Tabla: columnas, edición en línea, ordenar, filtrar, arrastrar filas, agregar | pendiente | 6.3 | A | |
| M04 | Calendario: semana y mes, arrastrar para reprogramar, rangos, crear tarjetas | pendiente | 6.3 | A | |
| M05 | Calendario: muestra también ítems de checklist con fecha | pendiente | 6.3 | A | |
| M06 | Cronograma: zoom día/semana/mes/trimestre/año, botón Hoy | pendiente | 6.3 | A | |
| M07 | Cronograma: agrupar por lista, miembro o etiqueta | pendiente | 6.3 | A | |
| M08 | Cronograma: estirar para cambiar fechas; panel de tarjetas sin fecha | pendiente | 6.3 | A | |
| M09 | Panel: gráficos por lista, vencimiento, miembro y etiqueta | pendiente | 6.3 | A | |
| M10 | Panel: agregar, editar y borrar gráficos (barras, torta, líneas) | pendiente | 6.3 | A | |
| M11 | Mapa: tarjetas con ubicación como marcadores, crear desde el mapa | pendiente | 6.3 | A | Con OpenStreetMap |
| M12 | Tabla de espacio de trabajo (varios tableros) | pendiente | 6.3 | A | |
| M13 | Calendario de espacio de trabajo | pendiente | 6.3 | A | |
| M14 | Guardar vistas de espacio de trabajo | pendiente | 6.3 | M | |
| M15 | Calendario exportable (iCal) para ver fechas en Google Calendar u Outlook | pendiente | 6.6 | V | |

## N. Búsqueda y filtros
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| N01 | Filtro del tablero por palabra | pendiente | 6.2 | A | |
| N02 | Filtro por miembros (incluye "sin miembros" y "mías") | pendiente | 6.2 | A | |
| N03 | Filtro por estado completada / no completada | pendiente | 6.2 | A | |
| N04 | Filtro por vencimiento | pendiente | 6.2 | A | |
| N05 | Filtro por etiquetas | pendiente | 6.2 | A | |
| N06 | Filtro por actividad reciente | pendiente | 6.2 | A | |
| N07 | Coincidencia "cualquiera" o "exacta" | pendiente | 6.2 | A | |
| N08 | El filtro se recuerda; contador de resultados; limpiar | pendiente | 6.2 | A | |
| N09 | Búsqueda global de tarjetas y tableros | pendiente | 6.2 | A | |
| N10 | Búsqueda avanzada con filtros y orden | pendiente | 6.2 | A | |
| N11 | Operadores de búsqueda (miembro, tablero, lista, etiqueta, nombre, descripción, checklist, comentario, creado, editado, vence, tiene, es, orden, negación) | pendiente | 6.2 | A | |
| N12 | Búsquedas guardadas | pendiente | 6.2 | A | |
| N13 | Buscar dentro de elementos archivados | pendiente | 6.2 | A | |
| N14 | Buscar en Jira, Confluence y Atlassian Home | no se puede | — | A | Productos de Atlassian |

## O. Atajos de teclado
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| O01 | Lista de atajos en pantalla | pendiente | 6.2 | A | |
| O02 | Navegar entre tarjetas con teclado | pendiente | 6.2 | A | |
| O03 | Atajos sobre la tarjeta: título, fechas, etiquetas, miembros, seguir, archivar, votar, edición rápida | pendiente | 6.2 | A | |
| O04 | Etiqueta por número (0-9) | pendiente | 6.2 | A | |
| O05 | Crear tarjeta, mover a lista vecina | pendiente | 6.2 | A | |
| O06 | Abrir filtro, "solo mías", limpiar filtro | pendiente | 6.2 | A | |
| O07 | Abrir conmutador de tableros, menú, búsqueda | pendiente | 6.2 | A | |
| O08 | Copiar, cortar y pegar tarjetas | pendiente | 6.2 | M | |
| O09 | Desplazamiento horizontal con Shift + rueda | pendiente | 2.2 | A | |

## P. Notificaciones
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| P01 | Campana con lista de avisos, leído/no leído, marcar todo | pendiente | 6.1 | A | |
| P02 | Aviso al mencionarte | pendiente | 6.1 | A | |
| P03 | Aviso al sumarte a tarjeta, tablero o espacio | pendiente | 6.1 | A | |
| P04 | Aviso al nombrarte administrador, al cerrar un tablero tuyo, al aceptar tu invitación | pendiente | 6.1 | A | |
| P05 | Avisos de ítems de checklist asignados | pendiente | 6.1 | A | |
| P06 | Avisos de lo que seguís (comentarios, fechas, adjuntos, movimientos, archivado) | pendiente | 6.1 | A | |
| P07 | Recordatorios de vencimiento | pendiente | 6.1 | A | |
| P08 | No avisar de las acciones propias | pendiente | 6.1 | A | |
| P09 | Avisos por correo: nunca / resumen / al instante, y por categoría | pendiente | 6.1 | A | ⚠ parcial: necesita la cuenta de envío de correos |
| P10 | Avisos de escritorio (navegador) | pendiente | 6.1 | A | |
| P11 | Avisos en el iPhone | pendiente | 6.1 | A | ⚠ parcial: solo con la app agregada a la pantalla de inicio (regla de Apple) |
| P12 | Contador de no leídos en el ícono de la app | pendiente | 6.1 | V | |
| P13 | Responder un comentario desde el aviso | pendiente | 6.1 | A | |
| P14 | Alertas en Google Chat, Slack o Teams | no se puede | — | A | Ver sección R |

## Q. Automatización
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| Q01 | Reglas: cuando pasa algo, hacer acciones | pendiente | 6.5 | A | |
| Q02 | Botones de tarjeta | pendiente | 6.5 | A | |
| Q03 | Botones de tablero | pendiente | 6.5 | A | |
| Q04 | Programadas (cada día, semana, mes, año) con "ejecutar ahora" | pendiente | 6.5 | A | |
| Q05 | Por vencimiento (antes o después de la fecha) | pendiente | 6.5 | A | |
| Q06 | Hasta 20 acciones por automatización, en orden | pendiente | 6.5 | A | |
| Q07 | Condiciones extra en el disparador | pendiente | 6.5 | A | |
| Q08 | Disparadores de movimiento (tarjeta agregada, movida, archivada; lista creada) | pendiente | 6.5 | M | |
| Q09 | Disparadores de cambios (etiqueta, adjunto, miembro, voto, completada) | pendiente | 6.5 | M | |
| Q10 | Disparadores de fechas | pendiente | 6.5 | M | |
| Q11 | Disparadores de checklists | pendiente | 6.5 | A | |
| Q12 | Disparadores de contenido (título, descripción, comentario, mención) | pendiente | 6.5 | M | |
| Q13 | Disparadores de campos personalizados | pendiente | 6.5 | M | |
| Q14 | Acciones: mover, archivar, tope/fondo, otro tablero | pendiente | 6.5 | A | |
| Q15 | Acciones: crear o copiar tarjeta y lista; crear espejo | pendiente | 6.5 | A | |
| Q16 | Acciones: etiquetas, stickers, enlaces, portada | pendiente | 6.5 | M | |
| Q17 | Acciones: fechas (poner, mover, quitar, completar) | pendiente | 6.5 | A | |
| Q18 | Acciones: checklists (agregar, quitar, tildar, convertir) | pendiente | 6.5 | M | |
| Q19 | Acciones: miembros (sumar, quitar, al azar, por turnos, seguir) | pendiente | 6.5 | M | |
| Q20 | Acciones: renombrar, descripción, comentar | pendiente | 6.5 | M | |
| Q21 | Acciones: campos personalizados | pendiente | 6.5 | M | |
| Q22 | Acciones: ordenar lista | pendiente | 6.5 | A | |
| Q23 | Acciones en cascada (buscar tarjetas, "para cada tarjeta") | pendiente | 6.5 | A | |
| Q24 | Acción: enviar correo | pendiente | 6.5 | A | ⚠ parcial: necesita la cuenta de envío de correos |
| Q25 | Acción: llamar a otro programa por internet (HTTP) | pendiente | 6.5 | A | |
| Q26 | Acciones de Jira, Slack y Bitbucket | no se puede | — | A | Integraciones de Atlassian |
| Q27 | Variables en los textos (fecha, tarjeta, lista, persona, etc.) | pendiente | 6.5 | A | |
| Q28 | Comodines y coincidencias de texto | pendiente | 6.5 | A | |
| Q29 | Activar/desactivar, editar, copiar, borrar, pasar a otro tablero | pendiente | 6.5 | A | |
| Q30 | Registro de ejecuciones y errores | pendiente | 6.5 | A | |
| Q31 | Opciones de botón (compartir con el espacio, cerrar tarjeta al ejecutar) | pendiente | 6.5 | A | |
| Q32 | Automatizaciones sugeridas según tu uso | pendiente | 6.5 | A | ⚠ parcial: sugerencias fijas, no "aprendidas" |
| Q33 | Informes rápidos por correo | pendiente | 6.5 | A | ⚠ parcial: necesita la cuenta de envío de correos |
| Q34 | Bibliotecas para compartir automatizaciones | pendiente | 6.5 | A | |
| Q35 | Escribir la regla en frases en inglés | no se puede | — | A | Se arma con un constructor en español; no se replica el idioma de frases de Trello |
| Q36 | Cuotas mensuales de ejecuciones | no se puede | — | A | No aplica: sin cuotas. Habrá un tope técnico por minuto para proteger el servidor |

## R. Power-Ups e integraciones
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| R01 | Tienda de Power-Ups de terceros (cientos de extensiones) | no se puede | — | A | Son productos de otras empresas hechos para Trello. Lo equivalente acá es pedirle la función a Alex |
| R02 | Plataforma para que terceros programen Power-Ups | no se puede | — | A | Idem |
| R03 | Power-Ups de Trello hacia otros servicios (Zendesk, Box, GitHub, Drive, MailChimp, Salesforce, Evernote, seguimiento de paquetes) | no se puede | — | A | Cada uno depende de acuerdos con ese servicio |
| R04 | Dashcards (tarjeta que muestra el recuento de un filtro) | pendiente | 6.4 | A | |
| R05 | App de Trello para Slack y para Microsoft Teams | no se puede | — | A | Requiere publicar apps en esas tiendas |
| R06 | Complemento de Gmail / Google Workspace | no se puede | — | A | Idem |
| R07 | Extensión de navegador para guardar páginas | no se puede | — | A | Requiere publicar en la tienda de Chrome. Alternativa: un marcador ("bookmarklet") que hace lo mismo |
| R08 | Jira y Confluence dentro de las tarjetas; conmutador de apps Atlassian | no se puede | — | A | Productos de Atlassian |
| R09 | API pública para programas | pendiente | 6.7 | A | Con formato propio (no compatible con programas hechos para Trello) |
| R10 | Avisos salientes a otros programas (webhooks) | pendiente | 6.7 | A | |
| R11 | Conexión con asistentes de IA (MCP) | pendiente | 3 | A | Es la puerta de Alex |

## S. Inteligencia artificial de Atlassian
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| S01 | Escribir, resumir, acortar, corregir y cambiar el tono de textos | no se puede | — | A | Es un servicio de Atlassian. Meter IA propia dentro de la app tendría costo por uso; Alex hace lo mismo desde el chat por la puerta MCP |
| S02 | Resumen con IA de correos y capturas (título, fecha, checklist) | no se puede | — | A | Idem |
| S03 | Planificación automática del día ("Smart Schedule") | no se puede | — | A | Idem |
| S04 | Captura por voz | no se puede | — | A | Idem. En iPhone se puede dictar con el teclado |
| S05 | Acciones sugeridas por IA | no se puede | — | A | Idem |

## T. Bandeja de entrada y Planificador
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| T01 | Bandeja de entrada personal y privada | pendiente | 6.6 | A | |
| T02 | Agregar a la bandeja escribiendo o pegando un enlace | pendiente | 6.6 | A | |
| T03 | Agregar a la bandeja por correo | pendiente | 6.6 | A | ⚠ parcial: misma dependencia que C37 |
| T04 | Agregar desde Slack, Teams, extensión o Siri | no se puede | — | A | Ver R05–R07 y sección V |
| T05 | Tarjetas de bandeja con portada, fechas, checklists y adjuntos | pendiente | 6.6 | A | |
| T06 | Pasar de la bandeja a un tablero | pendiente | 6.6 | A | |
| T07 | Filtro, orden, fondo propio y archivo de la bandeja | pendiente | 6.6 | A | |
| T08 | Paneles lado a lado: Bandeja, Planificador y Tablero, con divisor ajustable | pendiente | 6.6 | A | |
| T09 | Planificador: vista de 1, 3 o 7 días con mis tarjetas con fecha | pendiente | 6.6 | A | |
| T10 | Planificador: bloques de tiempo de foco vinculados a tarjetas | pendiente | 6.6 | V | |
| T11 | Planificador: conectar Google Calendar y Outlook (ver y crear eventos) | no se puede | — | A | Leer y escribir en tu calendario exige registrar y verificar la app ante Google y Microsoft. Alternativa hecha: M15 (tus fechas se ven en Google Calendar) |
| T12 | Planificador: filtros por tablero | pendiente | 6.6 | A | |

## U. Plantillas
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| U01 | Crear tablero desde una plantilla propia | pendiente | 6.4 | A | |
| U02 | Mis plantillas y plantillas favoritas al crear | pendiente | 6.4 | A | |
| U03 | Visibilidad de plantilla (privada, del espacio, pública) | pendiente | 6.4 | A | |
| U04 | En la plantilla se ocultan comentarios y actividad | pendiente | 6.4 | A | |
| U05 | Galería pública de plantillas de la comunidad de Trello | no se puede | — | V | Es contenido de Trello y de terceros. Se puede traer una plantilla puntual importándola (Fase 5) |

## V. Teléfono, instalación y escritorio
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| V01 | Uso completo desde el navegador del teléfono | pendiente | 2.2 | — | |
| V02 | Instalable en la pantalla de inicio del iPhone y Android | pendiente | 2.4 | — | |
| V03 | Arrastrar con el dedo (mantener apretado) | pendiente | 2.2 | M | |
| V04 | Sacar foto y adjuntarla | pendiente | 2.3 | A | |
| V05 | App nativa en App Store y Google Play | no se puede | — | A | Se reemplaza por la app web instalable. Publicar en tiendas tiene costo anual y revisión de Apple |
| V06 | Widgets de pantalla de inicio | no se puede | — | A | Solo las apps nativas pueden |
| V07 | Siri y Atajos de iOS | no se puede | — | A | Idem. Alternativa posible: un Atajo que envíe a la bandeja por correo (T03) |
| V08 | Escanear texto con la cámara | no se puede | — | A | Función de app nativa. El iPhone ya permite copiar texto desde una foto |
| V09 | Uso sin conexión | pendiente | 6.7 | M | ⚠ parcial: ver lo ya cargado sin conexión; los cambios se envían al volver la señal |
| V10 | App de escritorio para Mac y Windows | pendiente | 2.4 | V | ⚠ parcial: se instala como app web desde el navegador |
| V11 | Atajo global de "tarjeta nueva" desde cualquier programa de la Mac | no se puede | — | V | Una app web no puede escuchar el teclado fuera de su ventana |
| V12 | Ícono en la barra de menú y barra táctil de la Mac | no se puede | — | V | Solo apps nativas |
| V13 | Abrir enlaces de la app directamente en la app instalada | pendiente | 2.4 | V | |

## W. Importar, exportar e imprimir
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| W01 | Exportar tablero a JSON | pendiente | 6.7 | A | Con toda la actividad (Trello corta en 1.000) |
| W02 | Exportar tablero a CSV | pendiente | 6.7 | A | |
| W03 | Imprimir tablero | pendiente | 6.7 | A | |
| W04 | Importar tableros desde el JSON de Trello | pendiente | 5 | A | Esto Trello no lo tiene (no reimporta sus exportaciones) |
| W05 | Importar desde otras herramientas (Asana, Jira, etc.) | no se puede | — | A | Fuera de alcance; Trello lo hace con importadores de terceros |

## X. Apariencia y accesibilidad
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| X01 | Modo claro, oscuro e igual que el sistema | pendiente | 2.4 | A | |
| X02 | Respetar "reducir movimiento" del sistema | pendiente | 2.4 | A | |
| X03 | Uso con teclado y con lector de pantalla | pendiente | 6.7 | M | |
| X04 | Alto contraste | pendiente | 6.7 | V | |
| X05 | Pantalla de inicio con tableros y novedades | pendiente | 2.4 | A | |
| X06 | Conmutador de tableros (búsqueda, favoritos, recientes, por espacio; lista o cuadrícula; fijable) | pendiente | 2.4 | A | |
| X07 | Botón Crear (tablero, plantilla, vista, espacio) | pendiente | 2.4 | A | |

## Y. Tiempo real
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| Y01 | Los cambios de otros aparecen al instante sin recargar | pendiente | 2.2 | V | |
| Y02 | Mis cambios se ven al instante y se corrigen si el servidor los rechaza | pendiente | 2.2 | M | |
| Y03 | Reconexión automática y puesta al día tras un corte | pendiente | 2.2 | M | |
| Y04 | Orden estable cuando dos personas mueven a la vez | pendiente | 2.2 | V | |
| Y05 | Avisos y contador de no leídos en vivo | pendiente | 6.1 | V | |

## Z. Administración avanzada (Enterprise)
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| Z01 | Ingreso único corporativo (SSO) y alta automática de usuarios | no se puede | — | A | Depende de Atlassian Guard y de un proveedor de identidad; no aplica a uso privado |
| Z02 | Panel de organización con varios espacios, licencias e informes | no se puede | — | A | No hay "organización" por encima del espacio |
| Z03 | Reglas forzadas para toda la organización | no se puede | — | A | Idem. Las reglas por espacio sí están (B14–B17) |
| Z04 | Lista de Power-Ups aprobados | no se puede | — | A | No hay Power-Ups de terceros |
| Z05 | Panel de administrador general: ver todos los usuarios, espacios y tableros | pendiente | 6.7 | — | Para vos y Alex |
| Z06 | Registro general de quién hizo qué (auditoría) | pendiente | 6.7 | M | |

## AA. Requisitos propios de este proyecto (no son de Trello, pero se controlan acá)
| # | Función | Estado | Tanda | Fuente | Nota |
|---|---|---|---|---|---|
| AA01 | Puerta MCP con acceso de administrador a todo | pendiente | 3 | — | |
| AA02 | Usuario "Alex" y su nombre en la actividad | pendiente | 3 | — | |
| AA03 | Prueba que verifica que cada función tiene su herramienta MCP | pendiente | 3 | — | |
| AA04 | Publicación automática al subir a main | pendiente | 4 | — | |
| AA05 | Pruebas que frenan la publicación si fallan | pendiente | 2.0 | — | Receta lista y probada en esta Mac; falta comprobarlo en Dokploy con una publicación rota a propósito |
| AA06 | Respaldo diario + copia fuera del servidor | pendiente | 4 | — | |
| AA07 | Vuelta atrás documentada y ensayada | pendiente | 4 | — | |
| AA08 | Acceso de Alex a Dokploy (estado, errores, republicar) | pendiente | 4 | — | |
| AA09 | MANUAL.md al día | pendiente | 4 | — | |
