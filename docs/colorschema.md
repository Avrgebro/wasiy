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
| Superficie 2° | Campos, filas alternas, riel lateral | `#EFEBE2` | `#1D3335` |
| Texto | Contenido principal | `#1C2B2C` | `#E9ECE8` |
| Texto 2° | Metadatos, etiquetas, ayudas | `#5A6B6B` | `#9FB0AE` |
| Borde | Separadores y contornos de control | `#DDE4E1` | `#2A3F40` |
| Éxito | Confirmado, dentro, al día | `#2E7D5B` | `#4FA97C` |
| Advertencia | Esperado, por vencer, pendiente | `#B97F24` | `#E0A438` |
| Error | Rechazado, revocado, vencido | `#C0442E` | `#E0705C` |
| Información | Neutral, informativo, en proceso | `#2F6F8F` | `#6FA8C7` |

## Notas de sistema

**Paridad de roles.** Cada token existe en ambos esquemas. *Interactivo* se añade también en claro (`#106E74`, ≈ 6.2:1 sobre papel) para enlaces y texto accionable, que antes se resolvían con el primario y perdían distinción del texto normal.

**Superficie 2°.** El segundo nivel de superficie —campos, filas alternas, riel lateral— se declara en los dos esquemas: en claro baja del blanco al papel (`#EFEBE2`), en oscuro sube del fondo (`#1D3335`). La jerarquía se construye por elevación, no por bordes.

**Estados.** Los cuatro estados se recalibran, no se reutilizan: en oscuro suben en luminosidad y bajan en saturación para no vibrar sobre petróleo. El ámbar cumple doble papel —acento y advertencia—, así que la advertencia siempre lleva ícono y etiqueta.

**Acento en oscuro.** `#E8B45C` sobre `#101D1E` ≈ 8:1 permite usar el acento como texto, algo prohibido en claro. Es la única regla que cambia de comportamiento entre esquemas; todo lo demás es un cambio de valor, no de significado.

## Implementación

- **Escalas Mantine** (`apps/web/src/app/theme.ts`): `teal` (marca), `accent`, `success`, `warning`, `error`, `info`, `dark` (petróleo). Los tuples de rol llevan el valor claro en el índice 6 y el oscuro en el 5; `primaryShade: { light: 6, dark: 5 }` hace que `color="success"` etc. resuelvan el valor correcto por esquema.
- **Tokens CSS** (`apps/web/src/index.css`): los 14 roles como variables `--wa-*` (claro en `:root`, oscuro en `:root[data-mantine-color-scheme='dark']`). Nunca `light-dark()` — no está soportado en navegadores móviles antiguos.
- **En componentes**: props Mantine con nombres semánticos (`color="error"`, `color="accent"`) o `var(--wa-...)` en clases Tailwind. No usar `red`/`yellow`/`green`/`blue` ni hex sueltos.
