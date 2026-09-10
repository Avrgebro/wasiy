# Wasiy — Sistema de color «Puerto»

Un rol, dos valores. Cada token existe en claro y en oscuro: nada aparece solo en un esquema.

## Tabla de roles

| Rol | Uso | Claro | Oscuro |
| --- | --- | --- | --- |
| Primario | Navegación activa, botones sólidos, encabezados de dato | `#124E52` | `#1A6B70` |
| Secundario | Iconos, avatares, gráficos, énfasis de apoyo | `#3E7C80` | `#3E7C80` |
| Interactivo | Enlaces y texto accionable sobre fondo o superficie | `#106E74` | `#7FB5B0` |
| Acento | Una sola acción principal por pantalla; cifras destacadas | `#E0A438` | `#E8B45C` |
| Fondo | Lienzo de la aplicación | `#F7F5F0` | `#101D1E` |
| Superficie | Tarjetas, tablas, paneles elevados | `#FFFFFF` | `#16282A` |
| Superficie 2° | Píldoras, tarjetas internas, bandas, riel lateral | `#EAE5DB` | `#1D3335` |
| Panel | Drawers y modales: papel en claro (una porción del lienzo), superficie en oscuro | `#F7F5F0` | `#16282A` |
| Texto | Contenido principal | `#1C2B2C` | `#E9ECE8` |
| Texto 2° | Metadatos, etiquetas, ayudas | `#5A6B6B` | `#9FB0AE` |
| Texto 3° | Pistas, chevrones, marcas de tiempo, segundas líneas | `#9AA6A4` | `#5F7371` |
| Borde | Contornos de tarjetas y controles | `#DDE4E1` | `#2A3F40` |
| Divisor | Separadores de fila dentro de una superficie | `#EAEEEA` | `#22383A` |
| Borde fuerte | Contorno de botones `default` (deben leerse sobre tarjeta blanca) | `#C5CFCC` | `#365052` |
| Hover | Relleno de fila al pasar o seleccionar (tablas) | `#F7F5F0` | `#1B2F31` |
| Hover de control | Botones y opciones con variante `default` al pasar: Superficie 2°, distinta del lienzo, del panel y de la tarjeta | `#EAE5DB` | `#1D3335` |
| Éxito | Confirmado, dentro, al día | `#2E7D5B` | `#4FA97C` |
| Advertencia | Esperado, por vencer, pendiente | `#B97F24` | `#E0A438` |
| Error | Rechazado, revocado, vencido | `#C0442E` | `#E0705C` |
| Información | Neutral, informativo, en proceso | `#2F6F8F` | `#6FA8C7` |

## Notas de sistema

**Paridad de roles.** Cada token existe en ambos esquemas. *Interactivo* se añade también en claro (`#106E74`, ≈ 6.2:1 sobre papel) para enlaces y texto accionable, que antes se resolvían con el primario y perdían distinción del texto normal.

**Superficie 2°.** El segundo nivel de superficie —píldoras, tarjetas internas, bandas, riel lateral— se declara en los dos esquemas: en claro baja del blanco a un crema claramente separado (`#EAE5DB`; el `#F2EFE9` de los mockups quedaba a 1.05:1 del papel y 1.15:1 del blanco, indistinguible en pantalla), en oscuro sube del fondo (`#1D3335`). La jerarquía se construye por elevación, no por bordes.

**Escalera en claro.** Papel (lienzo y paneles) → blanco (tarjetas, campos) → crema (superficie 2°). Cada elemento toma el escalón *siguiente* al de la superficie donde se apoya. Dentro de un panel (Drawer, Modal), que ya es papel, `--wa-surface-2` se redirige al blanco y `--wa-pill-inverse` al crema (`index.css`, bloque `.mantine-Drawer-content`), de modo que las tarjetas internas y píldoras que usan `bg-[var(--wa-surface-2)]` suben en vez de fundirse con el fondo sin cambiar el componente. El valor crudo vive en `--wa-surface-2-base` (indicador del SegmentedControl, cuyo carril es el campo blanco). En oscuro el panel es superficie y la escalera no cambia.

**Estados.** Los cuatro estados se recalibran, no se reutilizan: en oscuro suben en luminosidad y bajan en saturación para no vibrar sobre petróleo. El ámbar cumple doble papel —acento y advertencia—, así que la advertencia siempre lleva ícono y etiqueta.

**Acento en oscuro.** `#E8B45C` sobre `#101D1E` ≈ 8:1 permite usar el acento como texto, algo prohibido en claro. Es la única regla que cambia de comportamiento entre esquemas; todo lo demás es un cambio de valor, no de significado.

## Implementación

- **Escalas Mantine** (`apps/web/src/app/theme.ts`): `teal` (marca), `accent`, `success`, `warning`, `error`, `info`, `gray` (neutros papel: reemplaza el gris frío de Mantine que se filtraba en skeletons, hovers y divisores) y `dark` (petróleo). Los tuples de rol llevan el valor claro en el índice 6 y el oscuro en el 5; `primaryShade: { light: 6, dark: 5 }` hace que `color="success"` etc. resuelvan el valor correcto por esquema.
- **Tokens CSS** (`apps/web/src/index.css`): los 14 roles como variables `--wa-*` (claro en `:root`, oscuro en `:root[data-mantine-color-scheme='dark']`). Nunca `light-dark()` — no está soportado en navegadores móviles antiguos.
- **En componentes**: props Mantine con nombres semánticos (`color="error"`, `color="accent"`) o `var(--wa-...)` en clases Tailwind. No usar `red`/`yellow`/`green`/`blue` ni hex sueltos.

## Trampas conocidas

- **`--mantine-color-<rol>-light-color` no es un color de texto.** Es el color del texto del `Badge` variante `light`; en oscuro resuelve al tono 3 de la escala (un tinte pálido) y lava el color. Para cifras, montos e íconos con color usar siempre `var(--wa-<rol>)`.
- **Gris de Mantine.** `gray-*`, `--mantine-color-default-hover`, `--table-border-color` y `--table-hover-color` están remapeados a los neutros del papel; no usar los hex de Mantine ni `gray-0..9` sueltos.
- **Teal en movimiento.** Los depósitos en garantía o por devolver usan `--wa-interactive` (el teal de los mockups), no `info`.
- **Primario en oscuro** (`#1A6B70`) no alcanza contraste como texto de enlace; por eso *Interactivo* tiene su propio valor en ambos esquemas.
- Los tokens de radio (`--radius-surface`, `--radius-inner`) viven junto a estos en `index.css`, pero son escala, no color: ver `DESIGN-SYSTEM.md` → Radius and Elevation.
