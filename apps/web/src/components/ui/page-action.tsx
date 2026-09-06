import { Button, type ButtonProps } from '@mantine/core'
import type { ComponentPropsWithoutRef } from 'react'

type PageActionProps = ButtonProps & Omit<ComponentPropsWithoutRef<'button'>, keyof ButtonProps>

/** Consistent page-header actions; compact table and card buttons stay separate. */
export function PageAction({ className, ...props }: PageActionProps) {
  return (
    <Button
      {...props}
      h={44}
      px={20}
      className={`[&_.mantine-Button-section_svg]:size-[18px] ${className ?? ''}`}
    />
  )
}
