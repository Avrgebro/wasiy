import { Card, Container, createTheme, Paper, rem, Select } from "@mantine/core";
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
 * Paleta «Puerto» — see colorschema.md at the repo root.
 * Petróleo profundo + ámbar sobre papel cálido; the brand colors are
 * constant across modes, only surfaces/borders/text change.
 */
const teal: MantineColorsTuple = [
  "#E6F0EF", // 0
  "#CFE0DD", // 1
  "#A9C4C0", // 2
  "#7FB5B0", // 3  ← interactive (dark)
  "#3E7C80", // 4  ← secondary
  "#1A5F63", // 5
  "#124E52", // 6  ← primary
  "#0A3538", // 7  ← primary-dark
  "#16282A", // 8  ← surface (dark)
  "#101D1E", // 9  ← background (dark)
];

const amber: MantineColorsTuple = [
  "#FBF3E2", // 0
  "#F7EEDD", // 1
  "#F0DCAE", // 2
  "#E8B45C", // 3  ← accent-hover / emphasis text in dark
  "#E0A438", // 4  ← accent (CTA); always with dark text, never white
  "#C79433", // 5  ← pressed
  "#B97F24", // 6  ← warning (light)
  "#8F6119", // 7
  "#6B4A14", // 8
  "#4A3520", // 9
];

/**
 * Replaces Mantine's neutral-gray dark scale so dark mode keeps the
 * petroleum background instead of gray. Mapped to Mantine's dark-mode
 * conventions: 7 = body, 6 = surfaces (Paper/Card/inputs), 5 = raised/hover,
 * 8 = sunken (sidebar), 4 = borders, 2 = dimmed text, 0 = text.
 */
const dark: MantineColorsTuple = [
  "#E9ECE8", // 0  ← text
  "#C9D2D0", // 1
  "#9FB0AE", // 2  ← text-secondary / dimmed
  "#5F7371", // 3  ← text-subtle / placeholders
  "#2A3F40", // 4  ← border
  "#1D3335", // 5  ← surface-raised (hover, selected, chips, modals)
  "#16282A", // 6  ← surface (cards, tables, fields)
  "#101D1E", // 7  ← app background
  "#0D1A1B", // 8  ← surface-sunken (sidebar, heros)
  "#081314", // 9
];

export const mantineTheme: MantineThemeOverride = createTheme({
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
  primaryShade: { light: 6, dark: 6 },
  colors: { teal, amber, dark },
  white: "#FFFFFF",
  black: "#1C2B2C",
  // Amber CTAs (`color="amber.4"`) must carry dark text (#1C2B2C), never
  // white; autoContrast resolves that from luminance instead of per-button
  // `c` props.
  autoContrast: true,
  components: {
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
    Paper: Paper.extend({
      defaultProps: {
        p: "md",
        shadow: "xl",
        radius: "md",
        withBorder: true,
      },
    }),

    Card: Card.extend({
      defaultProps: {
        p: "xl",
        shadow: "xl",
        radius: "var(--mantine-radius-default)",
        withBorder: true,
      },
    }),
    Select: Select.extend({
      defaultProps: {
        checkIconPosition: "right",
      },
    }),
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
 * stylesheet override in index.css would always lose to it. Dark mode
 * needs nothing here — the petroleum `dark` scale above already feeds it.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-body": "#F7F5F0",
    "--mantine-color-default-border": "#DDE4E1",
    "--mantine-color-dimmed": "#5A6B6B",
    "--mantine-color-placeholder": "#9AA6A4",
  },
  dark: {},
});
