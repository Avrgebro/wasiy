import { Button, createTheme, Input, PasswordInput, rem, SegmentedControl, Select, Textarea, TextInput } from '@mantine/core'

/**
 * The portal's control sizes, taken from the 04 series: 44px inputs and
 * 48px buttons with a 10px radius, small muted labels 5px above the field.
 * Applied under the portal layout with MantineThemeProvider so every portal
 * form gets them without per-field props; staff drawers keep the defaults.
 */
const FIELD_LABEL = {
  label: { fontSize: rem(11.5), fontWeight: 600, color: 'var(--mantine-color-dimmed)', marginBottom: rem(5) },
  description: { fontSize: rem(11.5), marginTop: rem(5) },
  error: { fontSize: rem(11.5), marginTop: rem(5) },
}

export const portalTheme = createTheme({
  components: {
    Input: Input.extend({
      defaultProps: { size: 'md' },
      vars: (_theme, props) => ({
        wrapper: props.size === 'md' || props.size === undefined ? { '--input-height': rem(44), '--input-radius': rem(10), '--input-fz': rem(14) } : {},
      }),
    }),
    InputWrapper: Input.Wrapper.extend({ styles: FIELD_LABEL }),
    TextInput: TextInput.extend({ styles: FIELD_LABEL }),
    PasswordInput: PasswordInput.extend({ styles: FIELD_LABEL }),
    Textarea: Textarea.extend({ defaultProps: { rows: 4, resize: 'vertical' }, styles: FIELD_LABEL }),
    Select: Select.extend({ styles: FIELD_LABEL }),
    Button: Button.extend({
      defaultProps: { size: 'md', radius: rem(10) },
      vars: (_theme, props) => ({
        root: props.size === 'md' || props.size === undefined ? { '--button-height': rem(48), '--button-fz': rem(14.5) } : {},
      }),
    }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { radius: rem(10), size: 'md' } }),
  },
})
