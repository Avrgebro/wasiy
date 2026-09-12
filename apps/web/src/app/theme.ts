import { Badge, Container, createTheme, Drawer, Input, Modal, rem, SegmentedControl, Select, Textarea } from "@mantine/core";
import type {
  CSSVariablesResolver,
  MantineColorsTuple,
  MantineThemeOverride,
} from "@mantine/core";

const CONTAINER_SIZES: Record<string, string> = {
  xxs: rem("200px"),
  xs: rem("300px"),
  sm: rem("400px"),
  md: rem("500px"),
  lg: rem("600px"),
  xl: rem("1400px"),
  xxl: rem("1600px"),
};

/**
 * Paleta «Puerto» — see docs/colorschema.md.
 * «Un rol, dos valores»: every role exists in both schemes. Role tuples
 * (accent/success/warning/error/info) carry the light value at shade 6 and
 * the dark value at shade 5; with `primaryShade: { light: 6, dark: 5 }`
 * Mantine's filled/outline variants resolve the right value per scheme, and
 * the `-light`/`-light-color` variables derive tints from the outer stops.
 */
const teal: MantineColorsTuple = [
  "#E6F0EF", // 0
  "#CFE0DD", // 1
  "#A9C4C0", // 2
  "#7FB5B0", // 3  ← interactive (dark)
  "#3E7C80", // 4  ← secondary
  "#1A6B70", // 5  ← primary (dark)
  "#124E52", // 6  ← primary (light)
  "#0A3538", // 7
  "#16282A", // 8  ← surface (dark)
  "#101D1E", // 9  ← background (dark)
];

// One main action per screen; always dark text (#1C2B2C), never white.
const accent: MantineColorsTuple = [
  "#FBF3E2", // 0
  "#F7E9C9", // 1
  "#F2DBA4", // 2
  "#EDC981", // 3
  "#EBBF6E", // 4
  "#E8B45C", // 5  ← accent (dark); hover in light
  "#E0A438", // 6  ← accent (light)
  "#C79433", // 7  ← pressed
  "#8F6119", // 8
  "#6B4A14", // 9
];

const success: MantineColorsTuple = [
  "#E9F5EE", // 0
  "#CCE7D8", // 1
  "#A6D4BC", // 2
  "#82C2A1", // 3
  "#66B58D", // 4
  "#4FA97C", // 5  ← success (dark)
  "#2E7D5B", // 6  ← success (light)
  "#25654A", // 7
  "#1C4E39", // 8
  "#143A2A", // 9
];

// Dark warning = light accent (#E0A438): the doubled role is deliberate, so
// warnings always carry an icon and a label, never color alone.
const warning: MantineColorsTuple = [
  "#FCF4E4", // 0
  "#F9EACF", // 1
  "#F4DAAB", // 2
  "#EDC983", // 3
  "#E7B65C", // 4
  "#E0A438", // 5  ← warning (dark)
  "#B97F24", // 6  ← warning (light)
  "#96661C", // 7
  "#734E15", // 8
  "#52380F", // 9
];

const error: MantineColorsTuple = [
  "#FCEEEB", // 0
  "#FADDD7", // 1
  "#F5C4BA", // 2
  "#F0A99B", // 3
  "#E88D7C", // 4
  "#E0705C", // 5  ← error (dark)
  "#C0442E", // 6  ← error (light)
  "#9C3625", // 7
  "#77291C", // 8
  "#531D13", // 9
];

const info: MantineColorsTuple = [
  "#EDF5F9", // 0
  "#DCEBF2", // 1
  "#C1DCE9", // 2
  "#A5CBDE", // 3
  "#8ABAD3", // 4
  "#6FA8C7", // 5  ← info (dark)
  "#2F6F8F", // 6  ← info (light)
  "#265A74", // 7
  "#1D4459", // 8
  "#142F3E", // 9
];

/**
 * Mantine's stock gray is a cool blue-gray that shows through Skeleton,
 * dividers, hovers and anything using `gray`. Replaced with the paper
 * neutrals of the palette so light mode stays warm (colorschema.md).
 */
const gray: MantineColorsTuple = [
  "#F7F5F0", // 0  ← bg / hover
  "#EAE5DB", // 1  ← surface 2°
  "#EAEEEA", // 2  ← divider
  "#DDE4E1", // 3  ← border
  "#C5CFCC", // 4
  "#9AA6A4", // 5  ← text 3° / placeholder
  "#5A6B6B", // 6  ← text 2° / dimmed
  "#3E4F4F", // 7
  "#2A3A3B", // 8
  "#1C2B2C", // 9  ← text
];

/**
 * Replaces Mantine's neutral-gray dark scale so dark mode keeps the
 * petroleum background instead of gray. Mapped to Mantine's dark-mode
 * conventions: 7 = body, 6 = surfaces (Paper/Card/inputs), 5 = surface 2°
 * (fields, alternate rows, sidebar rail), 4 = borders, 2 = dimmed text,
 * 0 = text.
 */
const dark: MantineColorsTuple = [
  "#E9ECE8", // 0  ← text
  "#C9D2D0", // 1
  "#9FB0AE", // 2  ← text-secondary / dimmed
  "#5F7371", // 3  ← text-subtle / placeholders
  "#2A3F40", // 4  ← border
  "#1D3335", // 5  ← surface 2° (hover, selected, chips, modals, sidebar rail)
  "#16282A", // 6  ← surface (cards, tables, fields)
  "#101D1E", // 7  ← app background
  "#0D1A1B", // 8  ← sunken (heros)
  "#081314", // 9
];

/** Text color of a `light` Badge per semantic color name. */
const PILL_TEXT: Record<string, string> = {
  success: "var(--wa-success)",
  warning: "var(--wa-warning)",
  error: "var(--wa-error)",
  info: "var(--wa-info)",
  accent: "var(--wa-accent)",
  teal: "var(--wa-interactive)",
  gray: "var(--mantine-color-dimmed)",
};

export const mantineTheme: MantineThemeOverride = createTheme({
  // `lg` is the surface radius (14px, see --radius-surface in index.css) so
  // Modal/Paper/Skeleton radius="lg" match the Tailwind cards; md stays the
  // 8px control radius.
  radius: { xs: rem(2), sm: rem(4), md: rem(8), lg: rem(14), xl: rem(32) },
  fontSizes: {
    xs: rem("12px"),
    sm: rem("14px"),
    md: rem("16px"),
    lg: rem("18px"),
    xl: rem("20px"),
    "2xl": rem("24px"),
    "3xl": rem("30px"),
    "4xl": rem("36px"),
    "5xl": rem("48px"),
  },
  spacing: {
    "3xs": rem("4px"),
    "2xs": rem("8px"),
    xs: rem("10px"),
    sm: rem("12px"),
    md: rem("16px"),
    lg: rem("20px"),
    xl: rem("24px"),
    "2xl": rem("28px"),
    "3xl": rem("32px"),
  },
  primaryColor: "teal",
  primaryShade: { light: 6, dark: 5 },
  colors: { teal, accent, success, warning, error, info, gray, dark },
  white: "#FFFFFF",
  black: "#1C2B2C",
  // Accent CTAs (`color="accent"`) must carry dark text (#1C2B2C), never
  // white; autoContrast resolves that from luminance instead of per-button
  // `c` props.
  autoContrast: true,
  components: {
    // Panels take --wa-panel: paper in light (a slice of the canvas, so the
    // white cards and fields inside keep their step) and the surface in dark
    // (Mantine would paint the body color there, the app background the
    // mockups reserve for fields). index.css flips --wa-surface-2 to white
    // inside light panels so inner cards do not melt into the paper.
    Drawer: Drawer.extend({
      styles: { content: { backgroundColor: "var(--wa-panel)" }, header: { backgroundColor: "var(--wa-panel)" } },
    }),
    Modal: Modal.extend({
      styles: { content: { backgroundColor: "var(--wa-panel)" }, header: { backgroundColor: "var(--wa-panel)" } },
    }),
    // Hints read as "what you typed means" when they sit under the field;
    // above it they push labels apart in two-column rows (UX audit).
    InputWrapper: Input.Wrapper.extend({
      defaultProps: { inputWrapperOrder: ["label", "input", "description", "error"] },
    }),
    Container: Container.extend({
      vars: (_, { size, fluid }) => ({
        root: {
          "--container-size": fluid
            ? "100%"
            : size !== undefined && size in CONTAINER_SIZES
              ? CONTAINER_SIZES[size]
              : rem(size),
        },
      }),
    }),

    // The mockups' segment: track on the field color with a border, the
    // indicator on surface 2° with a border, no separators between items.
    // The active label color needs a selector, so it lives in index.css.
    SegmentedControl: SegmentedControl.extend({
      defaultProps: { size: "md", radius: "md", withItemsBorders: false },
      styles: {
        root: { backgroundColor: "var(--wa-field)", border: "1px solid var(--mantine-color-default-border)", padding: 3 },
        indicator: { backgroundColor: "var(--wa-surface-2-base)", border: "1px solid var(--mantine-color-default-border)", boxShadow: "none" },
        label: { fontWeight: 600, color: "var(--mantine-color-dimmed)" },
      },
    }),
    Select: Select.extend({
      defaultProps: {
        checkIconPosition: "right",
      },
    }),
    // The design system's status pill: role-colored text on the neutral
    // second surface (mockups draw every pill this way). Mantine's stock
    // `light` variant tints the background and pales the text instead, so
    // the variant is remapped here for all 25+ badges at once.
    Badge: Badge.extend({
      defaultProps: { radius: "xl" },
      // `light`: the pill on a card. `surface`: the same pill placed on a
      // surface-2 box (inner cards, bands), where it inverts (--wa-pill-inverse:
      // white on a page, cream inside a light panel) so it does not vanish.
      vars: (_theme, props) =>
        props.variant === "light" || props.variant === "surface"
          ? {
              root: {
                "--badge-bg":
                  props.variant === "surface" ? "var(--wa-pill-inverse)" : "var(--wa-surface-2)",
                "--badge-color": PILL_TEXT[props.color ?? "teal"] ?? PILL_TEXT.teal,
              },
            }
          : { root: {} },
    }),
    // One height for every multiline field: four rows, and a vertical grip so
    // a long note can be pulled taller. Callers do not pass rows.
    Textarea: Textarea.extend({ defaultProps: { rows: 4, resize: "vertical" } }),
    Input: Input.extend({
      defaultProps: { size: "md" },
    }),
    Button: {
      defaultProps: { size: "md", radius: "md" },
    },
  },
  other: {
    style: "mantine",
  },
});

/**
 * Light-mode tokens Mantine derives from values we must not change:
 * the body defaults to theme.white, but «papel, no blanco» wants the app
 * background on #F7F5F0 while white stays reserved for floating surfaces.
 * These land in the provider's runtime-injected style tag, so a plain
 * stylesheet override in index.css would always lose to it. Surfaces and
 * text in dark come from the petroleum `dark` scale above; only the anchor
 * («Interactivo» role) needs an explicit value in both schemes.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-body": "#F7F5F0",
    "--mantine-color-default-border": "#DDE4E1",
    "--mantine-color-dimmed": "#5A6B6B",
    "--mantine-color-placeholder": "#9AA6A4",
    // Default-variant hover (buttons, options): surface 2° base, one clear
    // step below both white cards and the paper canvas (and paper panels), so
    // a hovered button never blends into whatever it sits on. Table rows
    // hover on --wa-hover (paper) instead; see index.css.
    "--mantine-color-default-hover": "#EAE5DB",
    // «Interactivo» role: links get their own color (≈6.2:1 on paper)
    // instead of reusing the primary, which read as plain text.
    "--mantine-color-anchor": "#106E74",
  },
  dark: {
    // «Interactivo» (dark): petroleum has insufficient contrast for links.
    "--mantine-color-anchor": "#7FB5B0",
    "--mantine-color-default-hover": "#1D3335",
  },
});
